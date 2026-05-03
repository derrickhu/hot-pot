import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { getCatalogSlots, type CatalogSlot } from '@/config/fruitCatalog';
import { BOWL_BADGES, type BowlBadgeDef } from '@/config/bowlBadges';
import { getMaxUnlockedBowlBadgeLevelNumber } from '@/game/BowlProgress';
import { mountBowlBadgeIcon } from '@/gameobjects/BowlBadgeIcon';
import { loadBowlSubpackage } from '@/utils/loadBowlSubpackage';
import { TextureCache } from '@/utils/TextureCache';

type PixiEventsHost = {
  domElement?: HTMLElement;
  mapPositionToPoint?: (point: PIXI.IPointData, x: number, y: number) => void;
};

type CatalogTab = 'fruit' | 'badge';

interface BadgeCatalogSlot {
  badge: BowlBadgeDef;
  textureKey: string;
  unlocked: boolean;
}

/** 图鉴：水果图鉴 / 徽章图鉴 */
export class CatalogScene implements Scene {
  readonly name = 'catalog';
  readonly container = new PIXI.Container();

  private readonly gridRoot = new PIXI.Container();
  private readonly gridMask = new PIXI.Graphics();
  private readonly titleText: PIXI.Text;
  private readonly tabButtons: Record<CatalogTab, PIXI.Container>;
  private readonly loadedTabs = new Set<CatalogTab>();
  /** 透明命中层：仅用 hitArea，避免极低 alpha 的 Graphics 在部分环境下不命中 */
  private readonly scrollHit = new PIXI.Container();
  private activeTab: CatalogTab = 'fruit';
  private loading = false;
  private gridTop = 0;
  private scrollY = 0;
  private maxScrollY = 0;
  private dragging = false;
  /** 当前拖动是否走 DOM 捕获（微信等环境下 Pixi 的 pointermove 可能跟丢） */
  private dragUsesDom = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;
  private domDragCleanup: (() => void) | null = null;

  constructor() {
    const chrome = this.buildChrome();
    this.titleText = chrome.titleText;
    this.tabButtons = chrome.tabButtons;
    this.gridTop = Game.safeTop + 154;
    this.gridRoot.position.set(0, this.gridTop);
    this.gridRoot.eventMode = 'none';
    this.gridRoot.mask = this.gridMask;
    this.container.addChild(this.gridMask);
    this.buildScrollArea();
    this.container.addChild(this.gridRoot);
    this.container.addChild(this.scrollHit);
  }

  onEnter(): void {
    void this.preloadAndBuild(this.activeTab);
  }

  onExit(): void {
    this.stopCatalogDrag();
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
          const slots = getCatalogSlots();
          const loads = slots
            .filter((slot) => slot.unlocked)
            .flatMap((slot) =>
              slot.assetCandidates.map((asset, index) => TextureCache.load(this.catalogTextureKey(slot, index), asset)),
            );
          await Promise.all(loads);
        } else {
          await loadBowlSubpackage();
          await Promise.all(
            BOWL_BADGES.map((badge) => TextureCache.load(this.badgeTextureKey(badge), badge.asset)),
          );
        }
        this.loadedTabs.add(tab);
      }
      if (tab === this.activeTab) {
        this.buildActiveGrid();
      }
    } finally {
      this.loading = false;
    }
  }

  private buildChrome(): { titleText: PIXI.Text; tabButtons: Record<CatalogTab, PIXI.Container> } {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const top = Game.safeTop;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xe8dcc8);
    bg.drawRect(0, 0, W, H);
    bg.endFill();
    this.container.addChild(bg);

    const band = new PIXI.Graphics();
    band.beginFill(0xd4c4a8, 0.45);
    band.drawRect(0, top + 200, W, H - top - 200);
    band.endFill();
    this.container.addChild(band);

    const header = new PIXI.Graphics();
    header.beginFill(0x7a5a3d);
    header.drawRect(0, top, W, 72);
    header.endFill();
    this.container.addChild(header);

    const backBtn = new PIXI.Container();
    backBtn.position.set(44, top + 36);
    backBtn.eventMode = 'static';
    backBtn.cursor = 'pointer';
    const backBg = new PIXI.Graphics();
    backBg.beginFill(0xfff4e0);
    backBg.drawCircle(0, 0, 24);
    backBg.endFill();
    backBtn.addChild(backBg);
    const backTxt = new PIXI.Text('‹', { fontSize: 34, fill: 0x4a3228, fontWeight: '700' });
    backTxt.anchor.set(0.5);
    backBtn.addChild(backTxt);
    backBtn.hitArea = new PIXI.Circle(0, 0, 30);
    backBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('home');
    });
    this.container.addChild(backBtn);

    const title = new PIXI.Text('图鉴', {
      fontSize: 28,
      fill: 0xfff6e8,
      fontWeight: '800',
    });
    title.anchor.set(0.5);
    title.position.set(W / 2, top + 36);
    this.container.addChild(title);

    const tabButtons = {
      fruit: this.createTabButton('水果图鉴', 'fruit'),
      badge: this.createTabButton('徽章图鉴', 'badge'),
    } satisfies Record<CatalogTab, PIXI.Container>;
    tabButtons.fruit.position.set(W / 2 - 124, top + 104);
    tabButtons.badge.position.set(W / 2 + 124, top + 104);
    this.container.addChild(tabButtons.fruit, tabButtons.badge);

    this.refreshTabs(tabButtons);
    return { titleText: title, tabButtons };
  }

  private createTabButton(label: string, tab: CatalogTab): PIXI.Container {
    const btn = new PIXI.Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.RoundedRectangle(-104, -30, 208, 60, 28);
    const bg = new PIXI.Graphics();
    const text = new PIXI.Text(label, {
      fontSize: 23,
      fill: 0xffffff,
      fontWeight: '800',
    });
    text.anchor.set(0.5);
    btn.addChild(bg, text);
    btn.on('pointertap', () => {
      if (this.activeTab === tab) {
        return;
      }
      AudioManager.playButtonSound();
      this.activeTab = tab;
      this.scrollY = 0;
      this.refreshTabs();
      void this.preloadAndBuild(tab);
    });
    return btn;
  }

  private refreshTabs(tabButtons = this.tabButtons): void {
    for (const tab of ['fruit', 'badge'] as const) {
      const btn = tabButtons[tab];
      const bg = btn.getChildAt(0) as PIXI.Graphics;
      const label = btn.getChildAt(1) as PIXI.Text;
      const active = this.activeTab === tab;
      bg.clear();
      bg.lineStyle(3, active ? 0xfff3cf : 0x8d7052, 1);
      bg.beginFill(active ? 0xb87438 : 0x9c8264, 1);
      bg.drawRoundedRect(-104, -30, 208, 60, 28);
      bg.endFill();
      label.style.fill = active ? 0xffffff : 0xffedd2;
      btn.alpha = active ? 1 : 0.88;
    }
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
      this.titleText.text = '图鉴';
      this.buildFruitGrid(getCatalogSlots());
    } else {
      this.titleText.text = '图鉴';
      this.buildBadgeGrid(this.getBadgeSlots());
    }
  }

  private buildFruitGrid(slots: CatalogSlot[]): void {
    this.gridRoot.removeChildren();

    const W = Game.logicWidth;
    const pad = 20;
    const cols = 3;
    const gap = 14;
    const cellW = (W - pad * 2 - gap * (cols - 1)) / cols;
    const iconTarget = Math.min(112, cellW - 16);
    const rowH = iconTarget + 50;
    const rowCount = Math.ceil(slots.length / cols);
    this.maxScrollY = Math.max(0, rowCount * rowH + 20 - (Game.logicHeight - this.gridTop - 24));
    this.setScrollY(Math.min(this.scrollY, this.maxScrollY));

    let i = 0;
    for (const slot of slots) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = pad + col * (cellW + gap);
      const y = 10 + row * rowH;

      const cell = new PIXI.Container();
      cell.position.set(x + cellW / 2, y);

      if (!slot.unlocked) {
        const box = new PIXI.Graphics();
        box.lineStyle(3, 0x8a7a6a, 1);
        box.beginFill(0xc4b8a8);
        box.drawRoundedRect(-iconTarget / 2, 0, iconTarget, iconTarget, 12);
        box.endFill();
        cell.addChild(box);
        const q = new PIXI.Text('?', {
          fontSize: Math.min(56, iconTarget * 0.48),
          fill: 0x6a5a4a,
          fontWeight: '800',
        });
        q.anchor.set(0.5);
        q.position.set(0, iconTarget / 2 - 4);
        cell.addChild(q);
        const lb = new PIXI.Text('未解锁', {
          fontSize: 20,
          fill: 0x7a6a5a,
          fontWeight: '700',
        });
        lb.anchor.set(0.5, 0);
        lb.position.set(0, iconTarget + 8);
        cell.addChild(lb);
      } else {
        const tex = this.getCatalogTexture(slot);
        if (tex) {
          const sp = new PIXI.Sprite(tex);
          sp.anchor.set(0.5);
          const s = iconTarget / Math.max(sp.width, sp.height);
          sp.scale.set(s);
          sp.position.set(0, iconTarget / 2 - 8);
          cell.addChild(sp);
        } else {
          const ph = new PIXI.Graphics();
          ph.beginFill(0xc8b8a0);
          ph.drawRoundedRect(-iconTarget / 2, 0, iconTarget, iconTarget, 12);
          ph.endFill();
          cell.addChild(ph);
        }

        const lb = new PIXI.Text(slot.label, {
          fontSize: 20,
          fill: 0x3d2818,
          fontWeight: '700',
        });
        lb.anchor.set(0.5, 0);
        lb.position.set(0, iconTarget + 8);
        cell.addChild(lb);
      }

      this.gridRoot.addChild(cell);
      i += 1;
    }
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
    this.gridRoot.removeChildren();

    const W = Game.logicWidth;
    const pad = 18;
    const cols = 3;
    const gap = 12;
    const cellW = (W - pad * 2 - gap * (cols - 1)) / cols;
    const iconTarget = Math.min(118, cellW - 16);
    const rowH = iconTarget + 76;
    const rowCount = Math.ceil(slots.length / cols);
    this.maxScrollY = Math.max(0, rowCount * rowH + 20 - (Game.logicHeight - this.gridTop - 24));
    this.setScrollY(Math.min(this.scrollY, this.maxScrollY));

    slots.forEach((slot, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = pad + col * (cellW + gap);
      const y = 10 + row * rowH;
      const cell = new PIXI.Container();
      cell.position.set(x + cellW / 2, y);

      const tex = TextureCache.get(slot.textureKey);
      const badgeMount = new PIXI.Container();
      badgeMount.position.set(-iconTarget / 2, 0);
      mountBowlBadgeIcon(badgeMount, slot.badge, tex, iconTarget, { locked: !slot.unlocked });
      cell.addChild(badgeMount);

      const levelLabel = new PIXI.Text(`第${slot.badge.levelNumber}关`, {
        fontSize: 17,
        fill: slot.unlocked ? 0x3d2818 : 0x7a6a5a,
        fontWeight: '800',
      });
      levelLabel.anchor.set(0.5, 0);
      levelLabel.position.set(0, iconTarget + 4);
      cell.addChild(levelLabel);

      const title = new PIXI.Text(slot.unlocked ? slot.badge.title : '未获得', {
        fontSize: 16,
        fill: slot.unlocked ? 0x5a3720 : 0x8a7a6a,
        fontWeight: '700',
      });
      title.anchor.set(0.5, 0);
      title.position.set(0, iconTarget + 30);
      cell.addChild(title);

      this.gridRoot.addChild(cell);
    });
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
