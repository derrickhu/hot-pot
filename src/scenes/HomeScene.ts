import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { getBowlLevelIndex } from '@/game/BowlProgress';
import { LoadingOverlay } from '@/gameobjects/LoadingOverlay';
import { SettingsPauseOverlay } from '@/gameobjects/SettingsPauseOverlay';
import { TextureCache } from '@/utils/TextureCache';

/** 首页图鉴入口：独立图标，不带按钮底框 */
const HOME_CATALOG_ICON_TEXTURE = 'assets/images/home_catalog_icon.png';
/** 主按钮：绿色无字药丸 + 边饰（关卡标题由程序叠字） */
const HOME_PLAY_BTN_TEXTURE = 'assets/images/home_play_btn.png';
/** 果切挑战：与关卡按钮同构药丸、暖色；文字与图标已烘焙在贴图内 */
const HOME_FRUIT_SLICE_CHALLENGE_BTN_TEXTURE = 'assets/images/home_fruit_slice_challenge_btn.png';
/** 游戏字标「别捞水果」 */
const HOME_LOGO_TITLE_TEXTURE = 'assets/images/game_logo_title.png';
/** 游戏圈入口：靠底但仍需足够对比与点击区域（与微信原生按钮同尺寸基准） */
const GAME_CLUB_LOGIC_RECT = { width: 140, height: 50 } as const;

/** 关卡药丸贴图目标逻辑宽度（与历史实现一致） */
function homePlayEntryTargetWidth(): number {
  return Math.min(480, Game.logicWidth * 0.62);
}

/**
 * 果切药丸是副玩法入口，需明显小于主关卡药丸（贴图缩放、布局、兜底矢量共用）。
 */
const HOME_FRUIT_SLICE_BTN_DISPLAY_SCALE = 0.68;

function homeFruitSliceEntryTargetWidth(): number {
  return homePlayEntryTargetWidth() * HOME_FRUIT_SLICE_BTN_DISPLAY_SCALE;
}

/** 右侧图鉴图标较长边目标尺寸，保持醒目但弱于主按钮。 */
function homeCatalogIconDisplayTarget(): number {
  return Math.round(Math.min(96, Math.max(76, Game.logicWidth * 0.13)));
}

/** 主页：夏日底图 + 进入关卡 */
export class HomeScene implements Scene {
  readonly name = 'home';
  readonly container = new PIXI.Container();

  private readonly settingsOverlay: SettingsPauseOverlay;
  private readonly homeFooterSlots: PIXI.Container[] = [];
  /** 进入关卡：贴图或紫底兜底 */
  private readonly playEntryRoot = new PIXI.Container();
  private playEntryBg!: PIXI.Graphics;
  private playEntryTitle!: PIXI.Text;
  private playEntrySprite: PIXI.Sprite | null = null;
  /** 果切无尽：暖色药丸贴图（字与图标在贴图内；无贴图时程序叠字兜底） */
  private readonly fruitSliceEntryRoot = new PIXI.Container();
  private fruitSliceEntryBg!: PIXI.Graphics;
  private fruitSliceEntryTitle!: PIXI.Text;
  private fruitSliceEntrySprite: PIXI.Sprite | null = null;
  /** 顶栏与主按钮之间的 Logo 区（有贴图再显示） */
  private readonly homeLogoRoot = new PIXI.Container();
  private readonly homeLogoSprite = new PIXI.Sprite();
  private homeLogoMaxWidth = 0;
  private homeLogoMaxHeight = 0;
  private bgFill!: PIXI.Graphics;
  private gradFill!: PIXI.Graphics;
  private readonly gameClubFallbackRoot = new PIXI.Container();
  private gameClubButton: ReturnType<NonNullable<typeof wx.createGameClubButton>> | null = null;
  private enteringBowl = false;
  private enteringFruitSlice = false;

  constructor() {
    this.settingsOverlay = new SettingsPauseOverlay(Game.logicWidth, Game.logicHeight, {
      onReplay: () => {
        void this.enterBowlWithLoading();
      },
      onHome: () => {},
      onContinue: () => {},
    });
    this.build();
    void this.loadHomeBackdrop(Game.logicWidth, Game.logicHeight);
    void this.loadHomeCatalogIcon();
  }

  onEnter(): void {
    this.refreshPlayEntryTitle();
    this.layoutHomeMainColumn();
    this.bringGameClubAboveHomeUi();
    this.syncGameClubNativeButton();
    setTimeout(() => this.syncGameClubNativeButton(), 0);
    setTimeout(() => this.syncGameClubNativeButton(), 160);
  }

  /** 保证在底图之上、且盖住同屏其它控件（仍低于设置全屏层） */
  private bringGameClubAboveHomeUi(): void {
    if (!this.gameClubFallbackRoot.parent) {
      return;
    }
    const settings = this.settingsOverlay;
    this.container.removeChild(this.gameClubFallbackRoot);
    const insertAt = Math.max(0, this.container.getChildIndex(settings));
    this.container.addChildAt(this.gameClubFallbackRoot, insertAt);
  }

  onExit(): void {
    this.hideGameClubNativeButton();
  }

  private refreshPlayEntryTitle(): void {
    this.playEntryTitle.text = `第${getBowlLevelIndex() + 1}关`;
  }

  private async loadHomeBackdrop(width: number, height: number): Promise<void> {
    await Promise.all([
      TextureCache.load('__home_bg', 'assets/images/home_bg_summer.jpg'),
      TextureCache.load('home_play_btn', HOME_PLAY_BTN_TEXTURE),
      TextureCache.load('home_fruit_slice_challenge_btn', HOME_FRUIT_SLICE_CHALLENGE_BTN_TEXTURE),
      TextureCache.load('game_logo_title', HOME_LOGO_TITLE_TEXTURE),
    ]);
    const tex = TextureCache.get('__home_bg');
    if (!tex) {
      this.applyPlayEntryArt();
      this.applyFruitSliceEntryArt();
      this.applyHomeLogoTitle();
      this.layoutHomeMainColumn();
      this.bringGameClubAboveHomeUi();
      return;
    }
    const sp = new PIXI.Sprite(tex);
    sp.width = width;
    sp.height = height;
    this.container.addChildAt(sp, 0);
    this.container.removeChild(this.bgFill);
    this.container.removeChild(this.gradFill);
    this.applyPlayEntryArt();
    this.applyFruitSliceEntryArt();
    this.applyHomeLogoTitle();
    this.layoutHomeMainColumn();
    this.bringGameClubAboveHomeUi();
  }

  /** 字标：顶栏下缘与主按钮上缘之间居中，宽约屏 68% */
  private applyHomeLogoTitle(): void {
    const tex = TextureCache.get('game_logo_title');
    if (!tex || this.homeLogoMaxWidth <= 0) {
      this.homeLogoRoot.visible = false;
      return;
    }
    this.homeLogoSprite.texture = tex;
    const sc = Math.min(this.homeLogoMaxWidth / tex.width, this.homeLogoMaxHeight / tex.height, 1.05);
    this.homeLogoSprite.scale.set(sc);
    this.homeLogoRoot.visible = true;
  }

  /** 主按钮：优先绿色无字贴图，失败则紫底 */
  private applyPlayEntryArt(): void {
    const tex = TextureCache.get('home_play_btn');
    if (!tex) {
      this.playEntryTitle.style.fill = 0xfff4c2;
      this.playEntryTitle.style.stroke = 0x5a2a19;
      this.playEntryTitle.style.strokeThickness = 6;
      this.playEntryTitle.style.dropShadow = false;
      this.playEntryTitle.position.set(0, 0);
      this.playEntryRoot.hitArea = new PIXI.Rectangle(-220, -52, 440, 104);
      return;
    }
    this.playEntryTitle.style.fill = 0xfff4c2;
    this.playEntryTitle.style.stroke = 0x1b5965;
    this.playEntryTitle.style.strokeThickness = 6;
    this.playEntryTitle.style.dropShadow = false;
    if (this.playEntryBg.parent) {
      this.playEntryRoot.removeChild(this.playEntryBg);
    }
    if (!this.playEntrySprite) {
      this.playEntrySprite = new PIXI.Sprite();
      this.playEntrySprite.anchor.set(0.5);
      this.playEntryRoot.addChildAt(this.playEntrySprite, 0);
    }
    this.playEntrySprite.texture = tex;
    const targetW = homePlayEntryTargetWidth();
    const s = targetW / tex.width;
    this.playEntrySprite.scale.set(s);
    const halfH = (tex.height * s) / 2;
    /** 文案叠在贴图药丸中心，略上移对齐按钮高光后的视觉中心 */
    this.playEntryTitle.position.set(0, -3);
    const hitPadX = 20;
    const hitPadY = 14;
    this.playEntryRoot.hitArea = new PIXI.Rectangle(
      -targetW / 2 - hitPadX,
      -halfH - hitPadY,
      targetW + hitPadX * 2,
      halfH * 2 + hitPadY * 2,
    );
  }

  /** 果切挑战：有贴图则仅显示贴图；无贴图时矢量底 + 程序叠字兜底 */
  private applyFruitSliceEntryArt(): void {
    const tex = TextureCache.get('home_fruit_slice_challenge_btn');
    if (!tex) {
      this.fruitSliceEntryTitle.visible = true;
      this.fruitSliceEntryTitle.style.fill = 0xfff4c2;
      this.fruitSliceEntryTitle.style.stroke = 0x5a2a19;
      this.fruitSliceEntryTitle.style.strokeThickness = 6;
      this.fruitSliceEntryTitle.style.dropShadow = false;
      this.fruitSliceEntryTitle.position.set(0, -3);
      const hw = Math.round(220 * HOME_FRUIT_SLICE_BTN_DISPLAY_SCALE);
      const hh = Math.round(52 * HOME_FRUIT_SLICE_BTN_DISPLAY_SCALE);
      this.fruitSliceEntryRoot.hitArea = new PIXI.Rectangle(-hw, -hh, hw * 2, hh * 2);
      return;
    }
    /** 贴图已含「果切挑战」与图标，避免与程序文字叠影 */
    this.fruitSliceEntryTitle.visible = false;
    if (this.fruitSliceEntryBg.parent) {
      this.fruitSliceEntryRoot.removeChild(this.fruitSliceEntryBg);
    }
    if (!this.fruitSliceEntrySprite) {
      this.fruitSliceEntrySprite = new PIXI.Sprite();
      this.fruitSliceEntrySprite.anchor.set(0.5);
      this.fruitSliceEntryRoot.addChildAt(this.fruitSliceEntrySprite, 0);
    }
    this.fruitSliceEntrySprite.texture = tex;
    const targetW = homeFruitSliceEntryTargetWidth();
    const s = targetW / tex.width;
    this.fruitSliceEntrySprite.scale.set(s);
    const halfH = (tex.height * s) / 2;
    const hitPadX = 20;
    const hitPadY = 14;
    this.fruitSliceEntryRoot.hitArea = new PIXI.Rectangle(
      -targetW / 2 - hitPadX,
      -halfH - hitPadY,
      targetW + hitPadX * 2,
      halfH * 2 + hitPadY * 2,
    );
  }

  /** 主按钮柱（关卡 + 果切）与底栏图鉴、游戏圈纵向位置 */
  private layoutHomeMainColumn(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const top = Game.safeTop;
    const contentTop = top + 8;
    const bottomBarTop = H - 100;
    const playY = contentTop + (bottomBarTop - contentTop) * 0.5;

    let playHalf = 52;
    if (
      this.playEntrySprite?.texture
      && this.playEntrySprite.texture !== PIXI.Texture.EMPTY
      && this.playEntrySprite.texture.width > 2
    ) {
      const tw = this.playEntrySprite.texture.width;
      const targetW = homePlayEntryTargetWidth();
      const s = targetW / tw;
      playHalf = (this.playEntrySprite.texture.height * s) / 2;
    } else if (this.playEntryBg.parent) {
      playHalf = 52;
    }

    let fruitHalf = 52;
    if (
      this.fruitSliceEntrySprite?.texture
      && this.fruitSliceEntrySprite.texture !== PIXI.Texture.EMPTY
      && this.fruitSliceEntrySprite.texture.width > 2
    ) {
      const tw = this.fruitSliceEntrySprite.texture.width;
      const targetW = homeFruitSliceEntryTargetWidth();
      const s = targetW / tw;
      fruitHalf = (this.fruitSliceEntrySprite.texture.height * s) / 2;
    } else if (this.fruitSliceEntryBg.parent) {
      fruitHalf = 52;
    }

    const gap = 16;
    this.playEntryRoot.position.set(W / 2, playY);
    const fruitY = playY + playHalf + gap + fruitHalf;
    this.fruitSliceEntryRoot.position.set(W / 2, fruitY);

    const bookSlot = this.homeFooterSlots[0];
    if (bookSlot) {
      const playW = homePlayEntryTargetWidth();
      const iconTarget = homeCatalogIconDisplayTarget();
      const iconX = Math.min(W - iconTarget * 0.56 - 12, W / 2 + playW / 2 + iconTarget * 0.58);
      bookSlot.position.set(Math.round(iconX), playY - 2);
      const gameClubY = Math.min(H - 48, Math.max(fruitY + fruitHalf + 72, H - 76));
      this.gameClubFallbackRoot.position.set(Math.round(W * 0.5), gameClubY);
    }
  }

  /** 图鉴入口：独立图标；无贴图时保持 build 中的兜底 */
  private async loadHomeCatalogIcon(): Promise<void> {
    await TextureCache.load('home_catalog_icon', HOME_CATALOG_ICON_TEXTURE);
    const tex = TextureCache.get('home_catalog_icon');
    for (let i = 0; i < this.homeFooterSlots.length; i += 1) {
      const slot = this.homeFooterSlots[i];
      if (!slot) {
        continue;
      }
      slot.removeChildren();
      if (tex) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const target = homeCatalogIconDisplayTarget();
        const sc = target / Math.max(tex.width, tex.height);
        sp.scale.set(sc);
        sp.position.set(0, -8);
        slot.addChild(sp);
        const dw = tex.width * sc;
        const dh = tex.height * sc;
        const label = this.createCatalogIconLabel();
        label.position.set(0, dh / 2 + 8);
        slot.addChild(label);
        slot.hitArea = new PIXI.Rectangle(-dw / 2 - 12, -dh / 2 - 20, dw + 24, dh + 48);
      } else {
        const fb = this.createHomeFooterFallback('图鉴', '📖');
        slot.addChild(fb);
        slot.hitArea = new PIXI.Rectangle(-75, -50, 150, 100);
      }
    }
    this.layoutHomeMainColumn();
  }

  private build(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const top = Game.safeTop;

    this.bgFill = new PIXI.Graphics();
    this.bgFill.beginFill(0xe6dcc8);
    this.bgFill.drawRect(0, 0, W, H);
    this.bgFill.endFill();
    this.gradFill = new PIXI.Graphics();
    this.gradFill.beginFill(0xd8c8ae, 0.55);
    this.gradFill.drawRect(0, top + 200, W, H - top - 200);
    this.gradFill.endFill();
    this.container.addChild(this.bgFill, this.gradFill);

    /** 无顶栏木条：背景全屏 */
    const contentTop = top + 8;
    const bottomBarTop = H - 100;
    const btnW = 440;
    const btnH = 104;
    const fruitBtnW = Math.round(btnW * HOME_FRUIT_SLICE_BTN_DISPLAY_SCALE);
    const fruitBtnH = Math.round(btnH * HOME_FRUIT_SLICE_BTN_DISPLAY_SCALE);
    const fruitBtnR = Math.max(18, Math.round(30 * HOME_FRUIT_SLICE_BTN_DISPLAY_SCALE));
    const playY = contentTop + (bottomBarTop - contentTop) * 0.5;
    const logoBandTop = contentTop + 40;
    const logoBandBottom = playY - btnH / 2 - 20;
    this.homeLogoMaxWidth = Math.round(W * 0.68);
    this.homeLogoMaxHeight = Math.max(72, Math.round(logoBandBottom - logoBandTop));
    this.homeLogoRoot.position.set(W / 2, (logoBandTop + logoBandBottom) / 2);
    this.homeLogoSprite.anchor.set(0.5);
    this.homeLogoRoot.addChild(this.homeLogoSprite);
    this.homeLogoRoot.visible = false;
    this.container.addChild(this.homeLogoRoot);

    this.playEntryRoot.position.set(W / 2, playY);
    this.playEntryRoot.eventMode = 'static';
    this.playEntryRoot.cursor = 'pointer';
    this.playEntryBg = new PIXI.Graphics();
    this.playEntryBg.beginFill(0x7e57c2);
    this.playEntryBg.lineStyle(4, 0x5a3d8a, 0.35);
    this.playEntryBg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 30);
    this.playEntryBg.endFill();
    this.playEntryRoot.addChild(this.playEntryBg);
    this.playEntryTitle = new PIXI.Text('第1关', {
      fontSize: 42,
      fill: 0xfff4c2,
      fontWeight: '900',
      stroke: 0x5a2a19,
      strokeThickness: 6,
      dropShadow: false,
      lineJoin: 'round',
    });
    this.playEntryTitle.anchor.set(0.5);
    this.playEntryTitle.resolution = 2;
    this.playEntryTitle.position.set(0, 0);
    this.playEntryRoot.addChild(this.playEntryTitle);
    this.playEntryRoot.hitArea = new PIXI.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH);
    this.playEntryRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      void this.enterBowlWithLoading();
    });
    this.container.addChild(this.playEntryRoot);

    this.fruitSliceEntryRoot.position.set(W / 2, playY + 120);
    this.fruitSliceEntryRoot.eventMode = 'static';
    this.fruitSliceEntryRoot.cursor = 'pointer';
    this.fruitSliceEntryBg = new PIXI.Graphics();
    this.fruitSliceEntryBg.beginFill(0xffb47a);
    this.fruitSliceEntryBg.lineStyle(4, 0xb86a28, 1);
    this.fruitSliceEntryBg.drawRoundedRect(-fruitBtnW / 2, -fruitBtnH / 2, fruitBtnW, fruitBtnH, fruitBtnR);
    this.fruitSliceEntryBg.endFill();
    this.fruitSliceEntryRoot.addChild(this.fruitSliceEntryBg);
    this.fruitSliceEntryTitle = new PIXI.Text('果切挑战', {
      fontSize: 38,
      fill: 0xfff4c2,
      fontWeight: '900',
      stroke: 0x5a2a19,
      strokeThickness: 6,
      dropShadow: false,
      lineJoin: 'round',
    });
    this.fruitSliceEntryTitle.anchor.set(0.5);
    this.fruitSliceEntryTitle.resolution = 2;
    this.fruitSliceEntryTitle.position.set(0, -3);
    this.fruitSliceEntryTitle.visible = false;
    this.fruitSliceEntryRoot.addChild(this.fruitSliceEntryTitle);
    this.fruitSliceEntryRoot.hitArea = new PIXI.Rectangle(
      -fruitBtnW / 2,
      -fruitBtnH / 2,
      fruitBtnW,
      fruitBtnH,
    );
    this.fruitSliceEntryRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      void this.enterFruitSliceWithLoading();
    });
    this.container.addChild(this.fruitSliceEntryRoot);

    /** 主按钮下方：仅图鉴；果切已并入主按钮柱 */
    const bookSlot = new PIXI.Container();
    bookSlot.position.set(Math.round(W * 0.12), Math.max(playY + 220, H - 160));
    bookSlot.eventMode = 'static';
    bookSlot.cursor = 'pointer';
    bookSlot.hitArea = new PIXI.Rectangle(-75, -50, 150, 100);
    bookSlot.addChild(this.createHomeFooterFallback('图鉴', '📖'));
    bookSlot.on('pointertap', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('catalog');
    });

    this.homeFooterSlots.push(bookSlot);
    this.container.addChild(bookSlot);

    /** 游戏圈：靠下装饰带，略抬高避免贴底被手势条/误触 */
    const provisionalSideY = Math.max(playY + 220, H - 160);
    const gameClubY = Math.min(H - 48, Math.max(provisionalSideY + 72, H - 76));
    this.mountGameClubFallback(Math.round(W * 0.5), gameClubY);

    this.layoutHomeMainColumn();

    this.container.addChild(this.settingsOverlay);
  }

  private async enterBowlWithLoading(): Promise<void> {
    if (this.enteringBowl) {
      return;
    }
    this.enteringBowl = true;
    this.hideGameClubNativeButton();
    const loadingOverlay = new LoadingOverlay(Game.logicWidth, Game.logicHeight, Game.safeTop);
    Game.stage.addChild(loadingOverlay.container);
    try {
      loadingOverlay.setProgress(0.12);
      await loadingOverlay.loadAssets();
      loadingOverlay.setProgress(0.42);
      await SceneManager.prepare('bowl');
      loadingOverlay.setProgress(1);
      SceneManager.switchTo('bowl');
    } catch (error) {
      console.error('[HomeScene] enter bowl failed', error);
      const api = typeof wx !== 'undefined' ? wx : null;
      api?.showToast?.({ title: '加载失败，请重试', icon: 'none' });
    } finally {
      if (loadingOverlay.container.parent) {
        loadingOverlay.container.parent.removeChild(loadingOverlay.container);
      }
      loadingOverlay.destroy();
      this.enteringBowl = false;
    }
  }

  private async enterFruitSliceWithLoading(): Promise<void> {
    if (this.enteringFruitSlice) {
      return;
    }
    this.enteringFruitSlice = true;
    this.hideGameClubNativeButton();
    const loadingOverlay = new LoadingOverlay(Game.logicWidth, Game.logicHeight, Game.safeTop);
    Game.stage.addChild(loadingOverlay.container);
    try {
      loadingOverlay.setProgress(0.16);
      await loadingOverlay.loadAssets();
      loadingOverlay.setProgress(0.46);
      await SceneManager.prepare('fruitSlice');
      loadingOverlay.setProgress(1);
      SceneManager.switchTo('fruitSlice');
    } catch (error) {
      console.error('[HomeScene] enter fruit slice failed', error);
      const api = typeof wx !== 'undefined' ? wx : null;
      api?.showToast?.({ title: '加载失败，请重试', icon: 'none' });
    } finally {
      if (loadingOverlay.container.parent) {
        loadingOverlay.container.parent.removeChild(loadingOverlay.container);
      }
      loadingOverlay.destroy();
      this.enteringFruitSlice = false;
    }
  }

  private mountGameClubFallback(x: number, y: number): void {
    const rect = this.getGameClubLogicRect(x, y);
    this.gameClubFallbackRoot.position.set(x, y);
    this.gameClubFallbackRoot.eventMode = 'static';
    this.gameClubFallbackRoot.cursor = 'pointer';
    this.gameClubFallbackRoot.hitArea = new PIXI.Rectangle(-rect.width / 2, -rect.height / 2, rect.width, rect.height);
    this.gameClubFallbackRoot.visible = true;

    const bg = new PIXI.Graphics();
    bg.lineStyle(2, 0x4a9d8e, 0.95);
    bg.beginFill(0xe6fff8, 0.92);
    bg.drawRoundedRect(-rect.width / 2, -rect.height / 2, rect.width, rect.height, 14);
    bg.endFill();
    this.gameClubFallbackRoot.addChild(bg);

    const text = new PIXI.Text('游戏圈', {
      fontSize: 23,
      fill: 0x144a40,
      fontWeight: '800',
      dropShadow: true,
      dropShadowColor: 0xfafffe,
      dropShadowBlur: 2,
      dropShadowDistance: 0,
    });
    text.anchor.set(0.5);
    this.gameClubFallbackRoot.addChild(text);
    this.gameClubFallbackRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      const api = typeof wx !== 'undefined' ? wx : null;
      if (api?.createGameClubButton) {
        this.syncGameClubNativeButton();
        api.showToast?.({ title: '请再点一次进入游戏圈', icon: 'none' });
        return;
      }
      api?.showToast?.({ title: '游戏圈仅微信内可用', icon: 'none' });
    });
    this.container.addChild(this.gameClubFallbackRoot);
  }

  private syncGameClubCanvasButtonInteractivity(nativeVisible: boolean): void {
    const isWechat = typeof wx !== 'undefined' && !!wx.createGameClubButton;
    this.gameClubFallbackRoot.eventMode = isWechat && nativeVisible ? 'none' : 'static';
    this.gameClubFallbackRoot.cursor = isWechat && nativeVisible ? 'default' : 'pointer';
  }

  private getGameClubNativeRectPx(): { left: number; top: number; width: number; height: number } | null {
    const bounds = this.gameClubFallbackRoot.getLocalBounds();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }
    const topLeft = this.gameClubFallbackRoot.toGlobal(new PIXI.Point(bounds.x, bounds.y));
    const bottomRight = this.gameClubFallbackRoot.toGlobal(
      new PIXI.Point(bounds.x + bounds.width, bounds.y + bounds.height),
    );
    const left = topLeft.x / Game.dpr;
    const top = topLeft.y / Game.dpr;
    const width = (bottomRight.x - topLeft.x) / Game.dpr;
    const height = (bottomRight.y - topLeft.y) / Game.dpr;
    return {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };
  }

  private ensureGameClubNativeButton(): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    if (this.gameClubButton || !api?.createGameClubButton) {
      return;
    }
    const rect = this.getGameClubNativeRectPx();
    if (!rect) {
      return;
    }
    try {
      this.gameClubButton = api.createGameClubButton({
        type: 'text',
        text: '',
        style: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          backgroundColor: 'rgba(0,0,0,0.01)',
          borderColor: 'rgba(0,0,0,0)',
          borderWidth: 0,
          borderRadius: Math.round(rect.height / 2),
          color: 'rgba(0,0,0,0)',
          textAlign: 'center',
          fontSize: 1,
          lineHeight: rect.height,
        },
      });
      this.gameClubButton.hide?.();
    } catch (error) {
      console.warn('[HomeScene] createGameClubButton failed', error);
    }
  }

  private hideGameClubNativeButton(): void {
    if (!this.gameClubButton) {
      return;
    }
    try {
      this.gameClubButton.hide?.();
    } catch {
      // 原生按钮隐藏失败不影响页面切换。
    }
    this.syncGameClubCanvasButtonInteractivity(false);
  }

  private syncGameClubNativeButton(): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    if (!api?.createGameClubButton) {
      this.gameClubFallbackRoot.visible = true;
      this.syncGameClubCanvasButtonInteractivity(false);
      return;
    }
    this.ensureGameClubNativeButton();
    if (!this.gameClubButton) {
      this.syncGameClubCanvasButtonInteractivity(false);
      return;
    }
    const rect = this.getGameClubNativeRectPx();
    if (!rect) {
      this.hideGameClubNativeButton();
      return;
    }
    try {
      if (this.gameClubButton.style) {
        Object.assign(this.gameClubButton.style, {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          borderRadius: Math.round(rect.height / 2),
          lineHeight: rect.height,
        });
      }
      this.gameClubButton.show?.();
      this.syncGameClubCanvasButtonInteractivity(true);
    } catch (error) {
      console.warn('[HomeScene] sync game club button failed', error);
      this.syncGameClubCanvasButtonInteractivity(false);
    }
  }

  private getGameClubLogicRect(centerX = Game.logicWidth * 0.5, centerY = 0): { x: number; y: number; width: number; height: number } {
    const y = centerY > 0 ? centerY : this.gameClubFallbackRoot.y;
    return {
      x: centerX - GAME_CLUB_LOGIC_RECT.width / 2,
      y: y - GAME_CLUB_LOGIC_RECT.height / 2,
      width: GAME_CLUB_LOGIC_RECT.width,
      height: GAME_CLUB_LOGIC_RECT.height,
    };
  }

  private createHomeFooterFallback(label: string, emoji: string): PIXI.Container {
    const c = new PIXI.Container();
    const e = new PIXI.Text(emoji, {
      fontSize: 42,
      fill: 0x3a5f78,
      stroke: 0xffffff,
      strokeThickness: 4,
    });
    e.anchor.set(0.5);
    e.position.set(0, -10);
    c.addChild(e);
    const t = this.createCatalogIconLabel(label);
    t.position.set(0, 32);
    c.addChild(t);
    return c;
  }

  private createCatalogIconLabel(text = '图鉴'): PIXI.Text {
    const label = new PIXI.Text(text, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 23,
      fill: 0x275f2d,
      fontWeight: '900',
      stroke: 0xffffff,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    return label;
  }
}
