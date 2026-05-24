import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import { PersistService } from '@/core/PersistService';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { getCatalogSlots, type CatalogSlot } from '@/config/fruitCatalog';
import { DAILY_LIMITED_LEVELS } from '@/config/dailyLimitedLevels';
import { BOWL_BADGES, type BowlBadgeDef } from '@/config/bowlBadges';
import { getMaxUnlockedBowlBadgeLevelNumber } from '@/game/BowlProgress';
import { mountBowlBadgeIcon } from '@/gameobjects/BowlBadgeIcon';
import {
  loadBowlCoreSubpackage,
  loadBowlBadgesSubpackage,
  loadCatalogAssetsSubpackage,
  loadDailyRecipesSubpackage,
} from '@/utils/loadBowlSubpackage';
import { showInterstitialAd } from '@/utils/interstitialAd';
import { TextureCache } from '@/utils/TextureCache';

type PixiEventsHost = {
  domElement?: HTMLElement;
  mapPositionToPoint?: (point: PIXI.IPointData, x: number, y: number) => void;
};

type CatalogTab = 'fruit' | 'badge' | 'drink';

interface BadgeCatalogSlot {
  badge: BowlBadgeDef;
  textureKey: string;
  unlocked: boolean;
}

interface DailyLimitedRewardState {
  claimedRecipeDateByTheme?: Record<string, string>;
}

interface DrinkRecipeCatalogSlot {
  themeId: string;
  title: string;
  subtitle: string;
  textureKey: string;
  asset: string;
  unlocked: boolean;
}

interface TabButton {
  container: PIXI.Container;
  activeSprite: PIXI.Sprite;
  inactiveSprite: PIXI.Sprite;
  label: PIXI.Text;
  /** 当前展示的 sprite（active/inactive 之一），决定 hitArea 命中范围 */
  refresh: () => void;
}

const CHROME_TEX_BASEBOARD = 'subpackages/catalog_assets/assets/images/catalog/catalog_baseboard.png';
const CHROME_TEX_TAB_ACTIVE = 'subpackages/catalog_assets/assets/images/catalog/catalog_tab_active.png';
const CHROME_TEX_TAB_INACTIVE = 'subpackages/catalog_assets/assets/images/catalog/catalog_tab_inactive.png';
const CHROME_TEX_ITEM_CARD = 'subpackages/catalog_assets/assets/images/catalog/catalog_item_card.png';
const DAILY_LIMITED_REWARD_STATE_KEY = 'hot_pot_daily_limited_reward_v1';

/** 底板 PNG 内已经画好的"图鉴"标题 / 返回按钮在缩到 logicWidth 后的近似坐标 */
const PAINTED_BACK_X = 80;
const PAINTED_BACK_Y = 112;
const PAINTED_BACK_HIT_R = 64;

/** 在底板上叠 Tab / 网格的相对 Y 偏移（相对 baseboardY） */
const TAB_ROW_OFFSET_Y = 220;
const GRID_TOP_OFFSET_Y = 305;

const TAB_DISPLAY_W = 172;
const TAB_DISPLAY_H = 80;
const TAB_GAP = 8;

const GRID_PAD_X = 22;
const GRID_GAP = 14;
const GRID_COLS = 3;
const ROW_GAP_Y = 22;

/** 冰饮 tab 缩略图分批加载，避免一次性解码过多大图 */
const DRINK_THUMB_LOAD_BATCH = 6;

interface DrinkRecipeThumbMount {
  slot: DrinkRecipeCatalogSlot;
  thumbRoot: PIXI.Container;
  iconH: number;
  cellW: number;
}

function destroyContainerChildren(container: PIXI.Container): void {
  const children = container.removeChildren();
  children.forEach((child) => child.destroy({ children: true }));
}

/** 图鉴：水果图鉴 / 徽章图鉴 / 冰饮制作 */
export class CatalogScene implements Scene {
  readonly name = 'catalog';
  readonly container = new PIXI.Container();

  private readonly bgFill = new PIXI.Graphics();
  private readonly baseboardSprite = new PIXI.Sprite();
  private readonly headerHit = new PIXI.Container();

  private readonly chromeRoot = new PIXI.Container();
  private readonly tabsRoot = new PIXI.Container();
  private readonly tabButtons: Record<CatalogTab, TabButton>;

  private readonly gridRoot = new PIXI.Container();
  private readonly gridMask = new PIXI.Graphics();
  private readonly loadedTabs = new Set<CatalogTab>();
  /** 透明命中层：仅用 hitArea，避免极低 alpha 的 Graphics 在部分环境下不命中 */
  private readonly scrollHit = new PIXI.Container();
  private activeTab: CatalogTab = 'fruit';
  private loading = false;
  private chromeReady = false;
  private baseboardY = 0;
  private gridTop = 0;
  private scrollY = 0;
  private maxScrollY = 0;
  private dragging = false;
  /** 当前拖动是否走 DOM 捕获（微信等环境下 Pixi 的 pointermove 可能跟丢） */
  private dragUsesDom = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;
  private domDragCleanup: (() => void) | null = null;
  private readonly loadedContentTextureKeys = new Set<string>();
  private recipePreview: PIXI.Container | null = null;
  /** 取消进行中的冰饮缩略图灌图（切 tab / 重建网格时递增） */
  private drinkThumbHydrateGen = 0;
  private active = false;

  constructor() {
    this.computeLayout();

    this.bgFill.beginFill(0xf7e4c4);
    this.bgFill.drawRect(0, 0, Game.logicWidth, Game.logicHeight);
    this.bgFill.endFill();
    this.container.addChild(this.bgFill);

    this.baseboardSprite.position.set(0, this.baseboardY);
    this.container.addChild(this.baseboardSprite);

    this.bindBackButton();
    this.container.addChild(this.headerHit);

    this.tabButtons = {
      fruit: this.createTabButton('水果图鉴', 'fruit'),
      badge: this.createTabButton('徽章图鉴', 'badge'),
      drink: this.createTabButton('冰饮制作', 'drink'),
    };
    this.tabsRoot.addChild(this.tabButtons.fruit.container, this.tabButtons.badge.container, this.tabButtons.drink.container);
    this.chromeRoot.addChild(this.tabsRoot);
    this.container.addChild(this.chromeRoot);

    this.gridRoot.position.set(0, this.gridTop);
    this.gridRoot.eventMode = 'static';
    this.gridRoot.mask = this.gridMask;
    this.container.addChild(this.gridMask);
    this.buildScrollArea();
    this.container.addChild(this.scrollHit);
    this.container.addChild(this.gridRoot);

    void this.loadChromeTextures();
  }

  onEnter(): void {
    this.active = true;
    this.loadedTabs.delete('drink');
    void this.preloadAndBuild(this.activeTab);
    // 进入图鉴时尝试展示插屏广告；微信平台自带频次限制，业务侧无需节流
    void showInterstitialAd({ scene: 'catalog_open' });
  }

  onExit(): void {
    this.active = false;
    this.stopCatalogDrag();
    this.destroyRecipePreview();
    destroyContainerChildren(this.gridRoot);
    TextureCache.unloadMany(this.loadedContentTextureKeys);
    this.loadedContentTextureKeys.clear();
    this.loadedTabs.clear();
  }

  private computeLayout(): void {
    // 底板 PNG 顶部已经留了 ~70px 的"竹席留白"作为状态栏安全区，
    // 设备 safeTop > 这个安全区时把底板整体下移，确保画面里的"图鉴"标题永远落在状态栏下方。
    this.baseboardY = Math.max(0, Game.safeTop - 70);
    this.gridTop = this.baseboardY + GRID_TOP_OFFSET_Y;
  }

  private async loadChromeTextures(): Promise<void> {
    // chrome 4 张 PNG 已下沉到 catalog_assets 分包，必须先把分包载入再加载贴图
    await loadCatalogAssetsSubpackage();
    await Promise.all([
      TextureCache.load('catalog_baseboard', CHROME_TEX_BASEBOARD),
      TextureCache.load('catalog_tab_active', CHROME_TEX_TAB_ACTIVE),
      TextureCache.load('catalog_tab_inactive', CHROME_TEX_TAB_INACTIVE),
      TextureCache.load('catalog_item_card', CHROME_TEX_ITEM_CARD),
    ]);
    this.applyChromeTextures();
  }

  private applyChromeTextures(): void {
    const baseTex = TextureCache.get('catalog_baseboard');
    if (baseTex) {
      this.baseboardSprite.texture = baseTex;
      const targetW = Game.logicWidth;
      const scale = targetW / baseTex.width;
      this.baseboardSprite.scale.set(scale);
    }

    const activeTex = TextureCache.get('catalog_tab_active');
    const inactiveTex = TextureCache.get('catalog_tab_inactive');
    if (activeTex) {
      this.fitTabSprite(this.tabButtons.fruit.activeSprite, activeTex);
      this.fitTabSprite(this.tabButtons.badge.activeSprite, activeTex);
      this.fitTabSprite(this.tabButtons.drink.activeSprite, activeTex);
    }
    if (inactiveTex) {
      this.fitTabSprite(this.tabButtons.fruit.inactiveSprite, inactiveTex);
      this.fitTabSprite(this.tabButtons.badge.inactiveSprite, inactiveTex);
      this.fitTabSprite(this.tabButtons.drink.inactiveSprite, inactiveTex);
    }

    this.layoutTabs();
    this.refreshTabs();
    this.chromeReady = true;
    if (this.activeTab && this.loadedTabs.has(this.activeTab)) {
      this.buildActiveGrid();
    }
  }

  private fitTabSprite(sp: PIXI.Sprite, tex: PIXI.Texture): void {
    sp.texture = tex;
    sp.anchor.set(0.5);
    sp.width = TAB_DISPLAY_W;
    sp.height = TAB_DISPLAY_H;
  }

  private layoutTabs(): void {
    const W = Game.logicWidth;
    const tabY = this.baseboardY + TAB_ROW_OFFSET_Y;
    const step = TAB_DISPLAY_W + TAB_GAP;
    this.tabButtons.fruit.container.position.set(W / 2 - step, tabY);
    this.tabButtons.badge.container.position.set(W / 2, tabY);
    this.tabButtons.drink.container.position.set(W / 2 + step, tabY);
  }

  private bindBackButton(): void {
    this.headerHit.position.set(this.baseboardY ? 0 : 0, this.baseboardY);
    const btn = new PIXI.Container();
    btn.position.set(PAINTED_BACK_X, PAINTED_BACK_Y);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.Circle(0, 0, PAINTED_BACK_HIT_R);
    btn.on('pointertap', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('home');
    });
    this.headerHit.addChild(btn);
  }

  private createTabButton(label: string, tab: CatalogTab): TabButton {
    const container = new PIXI.Container();
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.hitArea = new PIXI.RoundedRectangle(
      -TAB_DISPLAY_W / 2,
      -TAB_DISPLAY_H / 2,
      TAB_DISPLAY_W,
      TAB_DISPLAY_H,
      TAB_DISPLAY_H / 2,
    );

    const inactiveSprite = new PIXI.Sprite();
    inactiveSprite.anchor.set(0.5);
    const activeSprite = new PIXI.Sprite();
    activeSprite.anchor.set(0.5);

    const text = new PIXI.Text(label, {
      fontSize: 22,
      fill: 0xffffff,
      fontWeight: '800',
      stroke: 0x6a3a18,
      strokeThickness: 4,
    });
    text.anchor.set(0.5);
    // 文字略微下移，与按钮立体厚度的视觉中心对齐
    text.position.set(0, -2);

    container.addChild(inactiveSprite, activeSprite, text);

    container.on('pointertap', () => {
      if (this.activeTab === tab) {
        return;
      }
      AudioManager.playButtonSound();
      this.activeTab = tab;
      this.scrollY = 0;
      this.refreshTabs();
      void this.preloadAndBuild(tab);
    });

    const refresh = (): void => {
      const isActive = this.activeTab === tab;
      activeSprite.visible = isActive;
      inactiveSprite.visible = !isActive;
      text.style.fill = isActive ? 0xffffff : 0x8b5a3c;
      text.style.stroke = isActive ? 0x6a3a18 : 0xfff4dc;
      text.style.strokeThickness = isActive ? 4 : 3;
      container.alpha = isActive ? 1 : 0.94;
    };

    return { container, activeSprite, inactiveSprite, label: text, refresh };
  }

  private refreshTabs(): void {
    this.tabButtons.fruit.refresh();
    this.tabButtons.badge.refresh();
    this.tabButtons.drink.refresh();
  }

  private getPixiEvents(): PixiEventsHost | null {
    try {
      const r = Game.app?.renderer as PIXI.Renderer & { events?: PixiEventsHost };
      return r?.events ?? null;
    } catch {
      return null;
    }
  }

  private mapClientToGlobal(clientX: number, clientY: number): PIXI.Point {
    const pt = new PIXI.Point();
    const events = this.getPixiEvents();
    if (events?.mapPositionToPoint) {
      events.mapPositionToPoint(pt, clientX, clientY);
    }
    return pt;
  }

  private stopCatalogDrag(): void {
    this.dragging = false;
    this.dragUsesDom = false;
    this.detachDomDragListeners();
  }

  private detachDomDragListeners(): void {
    this.domDragCleanup?.();
    this.domDragCleanup = null;
  }

  /** 在 canvas DOM 上捕获移动，避免手指移出小块命中区后收不到 pointermove */
  private attachDomDragListeners(): void {
    if (this.domDragCleanup) {
      return;
    }
    const el = this.getPixiEvents()?.domElement;
    if (!el?.addEventListener) {
      return;
    }

    const onMove = (ev: PointerEvent | TouchEvent) => {
      if (!this.dragging) {
        return;
      }
      let cx = 0;
      let cy = 0;
      if (ev.type === 'touchmove' && 'touches' in ev) {
        if (ev.touches.length === 0) {
          return;
        }
        cx = ev.touches[0]!.clientX;
        cy = ev.touches[0]!.clientY;
      } else if ('clientY' in ev) {
        const pe = ev as PointerEvent;
        cx = pe.clientX;
        cy = pe.clientY;
      } else {
        return;
      }
      const g = this.mapClientToGlobal(cx, cy);
      this.setScrollY(this.dragStartScrollY - (g.y - this.dragStartY));
      if (ev.type === 'touchmove') {
        (ev as TouchEvent).preventDefault();
      }
    };

    const onEnd = () => {
      this.stopCatalogDrag();
    };

    el.addEventListener('pointermove', onMove as EventListener, true);
    el.addEventListener('touchmove', onMove as EventListener, { capture: true, passive: false });
    el.addEventListener('pointerup', onEnd, true);
    el.addEventListener('pointercancel', onEnd, true);
    el.addEventListener('touchend', onEnd, true);
    el.addEventListener('touchcancel', onEnd, true);

    this.domDragCleanup = () => {
      el.removeEventListener('pointermove', onMove as EventListener, true);
      el.removeEventListener('touchmove', onMove as EventListener, { capture: true } as AddEventListenerOptions);
      el.removeEventListener('pointerup', onEnd, true);
      el.removeEventListener('pointercancel', onEnd, true);
      el.removeEventListener('touchend', onEnd, true);
      el.removeEventListener('touchcancel', onEnd, true);
    };
  }

  private async preloadAndBuild(tab: CatalogTab): Promise<void> {
    if (this.loading) {
      return;
    }
    this.loading = true;
    try {
      if (!this.loadedTabs.has(tab)) {
        if (tab === 'fruit') {
          await Promise.all([loadBowlCoreSubpackage(), loadCatalogAssetsSubpackage()]);
          const slots = getCatalogSlots();
          const loads = slots
            .filter((slot) => slot.unlocked)
            .flatMap((slot) =>
              slot.assetCandidates.map((asset, index) => this.loadContentTexture(this.catalogTextureKey(slot, index), asset)),
            );
          await Promise.all(loads);
        } else if (tab === 'badge') {
          await loadBowlBadgesSubpackage();
          await Promise.all(
            BOWL_BADGES.map((badge) => this.loadContentTexture(this.badgeTextureKey(badge), badge.asset)),
          );
        } else {
          await loadDailyRecipesSubpackage();
        }
        this.loadedTabs.add(tab);
      }
      if (this.active && tab === this.activeTab && this.chromeReady) {
        this.buildActiveGrid();
      }
    } finally {
      if (!this.active) {
        TextureCache.unloadMany(this.loadedContentTextureKeys);
        this.loadedContentTextureKeys.clear();
        this.loadedTabs.clear();
      }
      this.loading = false;
    }
  }

  private async loadContentTexture(key: string, asset: string): Promise<PIXI.Texture | null> {
    const texture = await TextureCache.load(key, asset);
    if (texture) {
      this.loadedContentTextureKeys.add(key);
    }
    return texture;
  }

  private buildScrollArea(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const viewportH = H - this.gridTop - 24;
    this.gridMask.clear();
    this.gridMask.beginFill(0xffffff, 1);
    this.gridMask.drawRect(0, this.gridTop, W, viewportH);
    this.gridMask.endFill();

    this.scrollHit.eventMode = 'static';
    this.scrollHit.cursor = 'default';
    this.scrollHit.hitArea = new PIXI.Rectangle(0, this.gridTop, W, viewportH);

    this.scrollHit.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
      this.dragging = true;
      this.dragStartY = event.global.y;
      this.dragStartScrollY = this.scrollY;
      this.attachDomDragListeners();
      this.dragUsesDom = this.domDragCleanup !== null;
    });

    this.scrollHit.on('pointermove', (event: PIXI.FederatedPointerEvent) => {
      if (!this.dragging || this.dragUsesDom) {
        return;
      }
      this.setScrollY(this.dragStartScrollY - (event.global.y - this.dragStartY));
    });

    this.scrollHit.on('globalpointermove', (event: PIXI.FederatedPointerEvent) => {
      if (!this.dragging || this.dragUsesDom) {
        return;
      }
      this.setScrollY(this.dragStartScrollY - (event.global.y - this.dragStartY));
    });

    const stopDrag = () => {
      this.stopCatalogDrag();
    };
    this.scrollHit.on('pointerup', stopDrag);
    this.scrollHit.on('pointerupoutside', stopDrag);
    this.scrollHit.on('pointercancel', stopDrag);

    this.scrollHit.on('wheel', (event: PIXI.FederatedWheelEvent) => {
      if (this.maxScrollY <= 0) {
        return;
      }
      event.preventDefault?.();
      this.setScrollY(this.scrollY + event.deltaY);
    });
  }

  private buildActiveGrid(): void {
    if (this.activeTab === 'fruit') {
      this.buildFruitGrid(getCatalogSlots());
    } else if (this.activeTab === 'badge') {
      this.buildBadgeGrid(this.getBadgeSlots());
    } else {
      this.buildDrinkRecipeGrid(this.getDrinkRecipeSlots().filter((slot) => slot.unlocked));
    }
  }

  /** 通用：用卡片贴图作为格子底板，并返回内部纸面区的几何信息 */
  private mountCardBackground(cell: PIXI.Container, cellW: number): {
    cardW: number;
    cardH: number;
    /** 内部奶油纸面顶部 Y（相对 cell 原点） */
    innerTop: number;
    /** 内部奶油纸面高度 */
    innerH: number;
    /** 内部奶油纸面宽度 */
    innerW: number;
  } {
    const tex = TextureCache.get('catalog_item_card');
    const cardW = cellW;
    const aspect = tex && tex.height > 0 ? tex.height / tex.width : 1;
    const cardH = cardW * aspect;
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5, 0);
      sp.width = cardW;
      sp.height = cardH;
      cell.addChild(sp);
    } else {
      const ph = new PIXI.Graphics();
      ph.beginFill(0xf6e6cd);
      ph.lineStyle(4, 0xc99a5e, 1);
      ph.drawRoundedRect(-cardW / 2, 0, cardW, cardH, 18);
      ph.endFill();
      cell.addChild(ph);
    }
    // 卡片画面里"木框"内边距大约占总尺寸 13%，纸面占中间 ~74%（横向） / ~72%（纵向）
    const innerTop = cardH * 0.13;
    const innerH = cardH * 0.74;
    const innerW = cardW * 0.74;
    return { cardW, cardH, innerTop, innerH, innerW };
  }

  private buildFruitGrid(slots: CatalogSlot[]): void {
    destroyContainerChildren(this.gridRoot);

    const W = Game.logicWidth;
    const cellW = (W - GRID_PAD_X * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
    const tex = TextureCache.get('catalog_item_card');
    const aspect = tex && tex.height > 0 ? tex.height / tex.width : 1;
    const cardH = cellW * aspect;
    const rowH = cardH + ROW_GAP_Y;

    const rowCount = Math.ceil(slots.length / GRID_COLS);
    this.maxScrollY = Math.max(
      0,
      rowCount * rowH + ROW_GAP_Y - (Game.logicHeight - this.gridTop - 24),
    );
    this.setScrollY(Math.min(this.scrollY, this.maxScrollY));

    slots.forEach((slot, i) => {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const x = GRID_PAD_X + col * (cellW + GRID_GAP);
      const y = ROW_GAP_Y + row * rowH;

      const cell = new PIXI.Container();
      cell.position.set(x + cellW / 2, y);

      const { innerTop, innerH, innerW } = this.mountCardBackground(cell, cellW);
      // 上 65% 放图、下 30% 放名字，留 5% 间距
      const iconAreaH = innerH * 0.62;
      const labelAreaTop = innerTop + innerH * 0.68;
      const iconCenterY = innerTop + iconAreaH / 2;
      // 缩小水果，留出留白与卡片内框留间距
      const iconMaxSide = Math.min(innerW * 0.78, iconAreaH * 0.92);
      const labelFont = Math.max(18, Math.round(innerH * 0.18));

      if (!slot.unlocked) {
        cell.alpha = 0.78;
        const q = new PIXI.Text('?', {
          fontSize: Math.round(iconAreaH * 0.6),
          fill: 0xb29074,
          fontWeight: '900',
        });
        q.anchor.set(0.5);
        q.position.set(0, iconCenterY);
        cell.addChild(q);

        const lb = this.createCellLabel('未解锁', false, labelFont);
        lb.position.set(0, labelAreaTop);
        cell.addChild(lb);
      } else {
        const fruitTex = this.getCatalogTexture(slot);
        if (fruitTex) {
          const sp = new PIXI.Sprite(fruitTex);
          sp.anchor.set(0.5);
          const s = iconMaxSide / Math.max(sp.width, sp.height);
          sp.scale.set(s);
          sp.position.set(0, iconCenterY);
          cell.addChild(sp);
        } else {
          const ph = new PIXI.Graphics();
          ph.beginFill(0xc8b8a0);
          ph.drawCircle(0, iconCenterY, iconMaxSide / 2);
          ph.endFill();
          cell.addChild(ph);
        }

        const lb = this.createCellLabel(slot.label, true, labelFont);
        lb.position.set(0, labelAreaTop);
        cell.addChild(lb);
      }

      this.gridRoot.addChild(cell);
    });
  }

  private getBadgeSlots(): BadgeCatalogSlot[] {
    const maxUnlockedBadge = getMaxUnlockedBowlBadgeLevelNumber();
    return BOWL_BADGES.map((badge) => ({
      badge,
      textureKey: this.badgeTextureKey(badge),
      unlocked: badge.levelNumber <= maxUnlockedBadge,
    }));
  }

  private buildBadgeGrid(slots: BadgeCatalogSlot[]): void {
    destroyContainerChildren(this.gridRoot);

    const W = Game.logicWidth;
    const cellW = (W - GRID_PAD_X * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
    // 徽章 Tab：徽章充满整张卡片，关卡/名称两行写在卡片"下方"（框外）
    const cardH = cellW;
    const labelLineH = 26;
    const labelBlockH = labelLineH * 2 + 12;
    const rowH = cardH + labelBlockH + ROW_GAP_Y;

    const rowCount = Math.ceil(slots.length / GRID_COLS);
    this.maxScrollY = Math.max(
      0,
      rowCount * rowH + ROW_GAP_Y - (Game.logicHeight - this.gridTop - 24),
    );
    this.setScrollY(Math.min(this.scrollY, this.maxScrollY));

    slots.forEach((slot, i) => {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const x = GRID_PAD_X + col * (cellW + GRID_GAP);
      const y = ROW_GAP_Y + row * rowH;
      const cell = new PIXI.Container();
      cell.position.set(x + cellW / 2, y);

      const badgeMount = new PIXI.Container();
      badgeMount.position.set(-cellW / 2, 0);
      const badgeTex = TextureCache.get(slot.textureKey);
      mountBowlBadgeIcon(badgeMount, slot.badge, badgeTex, cellW, {
        locked: !slot.unlocked,
        spriteScale: 0.84,
        spriteOffsetY: -4,
      });
      cell.addChild(badgeMount);

      const levelLabel = new PIXI.Text(`第${slot.badge.levelNumber}关`, {
        fontSize: 18,
        fill: slot.unlocked ? 0x3d2818 : 0x7a6a5a,
        fontWeight: '800',
      });
      levelLabel.anchor.set(0.5, 0);
      levelLabel.position.set(0, cardH + 6);
      cell.addChild(levelLabel);

      const title = new PIXI.Text(slot.unlocked ? slot.badge.title : '未获得', {
        fontSize: 16,
        fill: slot.unlocked ? 0x5a3720 : 0x8a7a6a,
        fontWeight: '700',
      });
      title.anchor.set(0.5, 0);
      title.position.set(0, cardH + 6 + labelLineH);
      cell.addChild(title);

      this.gridRoot.addChild(cell);
    });
  }

  private getDrinkRecipeSlots(): DrinkRecipeCatalogSlot[] {
    const state = PersistService.readJSON<DailyLimitedRewardState>(DAILY_LIMITED_REWARD_STATE_KEY);
    const claimed = state?.claimedRecipeDateByTheme ?? {};
    return DAILY_LIMITED_LEVELS.map((level) => ({
      themeId: level.themeId,
      title: level.recipeCard.catalogTitle,
      subtitle: level.recipeCard.catalogSubtitle,
      textureKey: level.recipeCard.textureKey,
      asset: level.recipeCard.path,
      unlocked: !!claimed[level.themeId],
    }));
  }

  private buildDrinkRecipeGrid(slots: DrinkRecipeCatalogSlot[]): void {
    this.drinkThumbHydrateGen += 1;
    destroyContainerChildren(this.gridRoot);

    if (slots.length === 0) {
      this.maxScrollY = 0;
      this.setScrollY(0);
      const empty = new PIXI.Text('还没有解锁冰饮制作方法\n通关每日限定关卡后会收入这里', {
        fontSize: 28,
        fill: 0x7a4a22,
        fontWeight: '800',
        align: 'center',
        lineHeight: 42,
      });
      empty.anchor.set(0.5, 0);
      empty.resolution = 2;
      empty.position.set(Game.logicWidth / 2, 80);
      this.gridRoot.addChild(empty);
      return;
    }

    const W = Game.logicWidth;
    const cellW = (W - GRID_PAD_X * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
    // 冰饮制作沿用徽章图鉴的无框陈列：上方图标，下方两行文字。
    const iconH = cellW;
    const labelLineH = 26;
    const labelBlockH = labelLineH * 2 + 12;
    const rowH = iconH + labelBlockH + ROW_GAP_Y;
    const rowCount = Math.ceil(slots.length / GRID_COLS);
    this.maxScrollY = Math.max(
      0,
      rowCount * rowH + ROW_GAP_Y - (Game.logicHeight - this.gridTop - 24),
    );
    this.setScrollY(Math.min(this.scrollY, this.maxScrollY));

    const thumbMounts: DrinkRecipeThumbMount[] = [];

    slots.forEach((slot, i) => {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const x = GRID_PAD_X + col * (cellW + GRID_GAP);
      const y = ROW_GAP_Y + row * rowH;
      const cell = new PIXI.Container();
      cell.position.set(x + cellW / 2, y);
      cell.eventMode = 'static';
      cell.cursor = 'pointer';
      cell.hitArea = new PIXI.Rectangle(-cellW / 2, 0, cellW, iconH + labelBlockH);
      cell.on('pointertap', () => {
        AudioManager.playButtonSound();
        void this.showRecipePreview(slot);
      });

      const thumbRoot = new PIXI.Container();
      cell.addChild(thumbRoot);
      thumbMounts.push({ slot, thumbRoot, iconH, cellW });

      const title = this.createCellLabel(slot.title, true, 18);
      title.position.set(0, iconH + 6);
      cell.addChild(title);
      const subtitle = new PIXI.Text(slot.subtitle, {
        fontSize: 16,
        fill: 0x8a5b28,
        fontWeight: '700',
      });
      subtitle.anchor.set(0.5, 0);
      subtitle.resolution = 2;
      subtitle.position.set(0, iconH + 6 + labelLineH);
      cell.addChild(subtitle);

      this.gridRoot.addChild(cell);
    });

    void this.hydrateDrinkRecipeThumbnails(thumbMounts, this.drinkThumbHydrateGen);
  }

  private mountDrinkRecipeThumb(mount: DrinkRecipeThumbMount, fullTex: PIXI.Texture): void {
    destroyContainerChildren(mount.thumbRoot);

    const sp = new PIXI.Sprite(fullTex);
    sp.anchor.set(0.5, 0);
    const scale = Math.min(mount.cellW / fullTex.width, mount.iconH / fullTex.height);
    sp.scale.set(scale);
    const drawnH = fullTex.height * scale;
    sp.position.set(0, Math.max(0, (mount.iconH - drawnH) / 2));
    mount.thumbRoot.addChild(sp);
  }

  private async hydrateDrinkRecipeThumbnails(
    mounts: DrinkRecipeThumbMount[],
    hydrateGen: number,
  ): Promise<void> {
    for (let i = 0; i < mounts.length; i += DRINK_THUMB_LOAD_BATCH) {
      if (!this.active || this.activeTab !== 'drink' || hydrateGen !== this.drinkThumbHydrateGen) {
        return;
      }
      const batch = mounts.slice(i, i + DRINK_THUMB_LOAD_BATCH);
      await Promise.all(
        batch.map((mount) => this.loadContentTexture(mount.slot.textureKey, mount.slot.asset)),
      );
      if (!this.active || this.activeTab !== 'drink' || hydrateGen !== this.drinkThumbHydrateGen) {
        return;
      }
      for (const mount of batch) {
        const tex = TextureCache.get(mount.slot.textureKey);
        if (tex) {
          this.mountDrinkRecipeThumb(mount, tex);
        }
      }
    }
  }

  private async showRecipePreview(slot: DrinkRecipeCatalogSlot): Promise<void> {
    await loadDailyRecipesSubpackage();
    const tex = TextureCache.get(slot.textureKey) ?? await this.loadContentTexture(slot.textureKey, slot.asset);
    if (!tex) {
      return;
    }
    if (!this.active) {
      TextureCache.unload(slot.textureKey);
      this.loadedContentTextureKeys.delete(slot.textureKey);
      return;
    }
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    this.destroyRecipePreview();
    const preview = new PIXI.Container();
    this.recipePreview = preview;
    preview.eventMode = 'static';
    preview.cursor = 'pointer';
    const dim = new PIXI.Graphics();
    dim.beginFill(0x080808, 0.74);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    preview.addChild(dim);

    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    const sc = Math.min((W * 0.84) / tex.width, (H * 0.72) / tex.height);
    sp.scale.set(sc);
    sp.position.set(W / 2, H / 2);
    preview.addChild(sp);

    const note = new PIXI.Text('已收入图鉴随时查看', {
      fontSize: 24,
      fill: 0xfff4d6,
      fontWeight: '900',
      stroke: 0x2d1a12,
      strokeThickness: 4,
    });
    note.anchor.set(0.5);
    note.resolution = 2;
    note.position.set(W / 2, Math.min(H * 0.86, H / 2 + (tex.height * sc) / 2 + 34));
    preview.addChild(note);

    const close = new PIXI.Text('点击关闭', {
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: '800',
      stroke: 0x2d1a12,
      strokeThickness: 4,
    });
    close.anchor.set(0.5);
    close.resolution = 2;
    close.position.set(W / 2, H * 0.92);
    preview.addChild(close);
    preview.on('pointertap', () => {
      this.destroyRecipePreview();
    });
    this.container.addChild(preview);
  }

  private destroyRecipePreview(): void {
    if (!this.recipePreview) {
      return;
    }
    if (this.recipePreview.parent) {
      this.recipePreview.parent.removeChild(this.recipePreview);
    }
    this.recipePreview.destroy({ children: true });
    this.recipePreview = null;
  }

  private createCellLabel(text: string, unlocked: boolean, fontSize = 22): PIXI.Text {
    const lb = new PIXI.Text(text, {
      fontSize,
      fill: unlocked ? 0x3d2818 : 0x7a6a5a,
      fontWeight: '800',
    });
    lb.anchor.set(0.5, 0);
    return lb;
  }

  private catalogTextureKey(slot: CatalogSlot, index: number): string {
    return `${slot.textureKey}_${index}`;
  }

  private badgeTextureKey(badge: BowlBadgeDef): string {
    return `catalog_bowl_badge_${badge.levelNumber}`;
  }

  private getCatalogTexture(slot: CatalogSlot): PIXI.Texture | null {
    for (let i = 0; i < slot.assetCandidates.length; i += 1) {
      const tex = TextureCache.get(this.catalogTextureKey(slot, i));
      if (tex) {
        return tex;
      }
    }
    return null;
  }

  private setScrollY(value: number): void {
    this.scrollY = Math.max(0, Math.min(this.maxScrollY, value));
    this.gridRoot.y = this.gridTop - this.scrollY;
  }
}
