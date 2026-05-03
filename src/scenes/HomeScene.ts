import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { getBowlLevelIndex } from '@/game/BowlProgress';
import { SettingsPauseOverlay } from '@/gameobjects/SettingsPauseOverlay';
import { TextureCache } from '@/utils/TextureCache';
import {
  loadSettingsButtonTexture,
  mountSettingsButtonSprite,
  SETTINGS_BTN_TEXTURE_KEY,
} from '@/utils/settingsButtonSprite';

/** 底栏雪碧图：左图鉴、右果切（进包路径；未放入时回退矢量） */
const HOME_FOOTER_SHEET = 'assets/images/home_footer_buttons.png';
/** 首页主按钮：绿色无字药丸 + 边饰（关卡标题由程序叠在下方） */
const HOME_PLAY_BTN_TEXTURE = 'assets/images/home_play_btn.png';
/** 游戏字标「别捞水果」 */
const HOME_LOGO_TITLE_TEXTURE = 'assets/images/game_logo_title.png';
/** 游戏圈入口：靠底但仍需足够对比与点击区域（与微信原生按钮同尺寸基准） */
const GAME_CLUB_LOGIC_RECT = { width: 140, height: 50 } as const;

/** 底侧「图鉴 / 果切」贴图较长边目标尺寸（与主按钮区拉开、略放大） */
function homeFooterDisplayTarget(): number {
  return Math.round(Game.logicWidth * 0.2);
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
  /** 顶栏与主按钮之间的 Logo 区（有贴图再显示） */
  private readonly homeLogoRoot = new PIXI.Container();
  private readonly homeLogoSprite = new PIXI.Sprite();
  private homeLogoMaxWidth = 0;
  private homeLogoMaxHeight = 0;
  private bgFill!: PIXI.Graphics;
  private gradFill!: PIXI.Graphics;
  private readonly gearBtnRoot = new PIXI.Container();
  private readonly gameClubFallbackRoot = new PIXI.Container();
  private gameClubButton: ReturnType<NonNullable<typeof wx.createGameClubButton>> | null = null;

  constructor() {
    this.settingsOverlay = new SettingsPauseOverlay(Game.logicWidth, Game.logicHeight, {
      onReplay: () => {
        SceneManager.switchTo('bowl');
      },
      onHome: () => {},
      onContinue: () => {},
    });
    this.build();
    void this.loadHomeBackdrop(Game.logicWidth, Game.logicHeight);
    void this.loadHomeFooterSheet();
  }

  onEnter(): void {
    this.refreshPlayEntryTitle();
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
      TextureCache.load('game_logo_title', HOME_LOGO_TITLE_TEXTURE),
      loadSettingsButtonTexture(),
    ]);
    mountSettingsButtonSprite(this.gearBtnRoot, TextureCache.get(SETTINGS_BTN_TEXTURE_KEY), 48);
    const tex = TextureCache.get('__home_bg');
    if (!tex) {
      this.applyPlayEntryArt();
      this.applyHomeLogoTitle();
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
    this.applyHomeLogoTitle();
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
      this.playEntryTitle.style.fill = 0xfff8ff;
      this.playEntryTitle.style.dropShadowColor = 0x3d2818;
      this.playEntryTitle.style.dropShadowBlur = 2;
      this.playEntryTitle.style.dropShadowDistance = 1;
      this.playEntryTitle.position.set(0, 0);
      this.playEntryRoot.hitArea = new PIXI.Rectangle(-220, -52, 440, 104);
      return;
    }
    this.playEntryTitle.style.fill = 0x2a4f63;
    this.playEntryTitle.style.dropShadowColor = 0xf5fdff;
    this.playEntryTitle.style.dropShadowBlur = 3;
    this.playEntryTitle.style.dropShadowDistance = 0;
    if (this.playEntryBg.parent) {
      this.playEntryRoot.removeChild(this.playEntryBg);
    }
    if (!this.playEntrySprite) {
      this.playEntrySprite = new PIXI.Sprite();
      this.playEntrySprite.anchor.set(0.5);
      this.playEntryRoot.addChildAt(this.playEntrySprite, 0);
    }
    this.playEntrySprite.texture = tex;
    const targetW = Math.min(480, Game.logicWidth * 0.62);
    const s = targetW / tex.width;
    this.playEntrySprite.scale.set(s);
    const halfH = (tex.height * s) / 2;
    /** 文案叠在贴图药丸中心（略上移 2px 对齐视觉中心） */
    this.playEntryTitle.position.set(0, -2);
    const hitPadX = 20;
    const hitPadY = 14;
    this.playEntryRoot.hitArea = new PIXI.Rectangle(
      -targetW / 2 - hitPadX,
      -halfH - hitPadY,
      targetW + hitPadX * 2,
      halfH * 2 + hitPadY * 2,
    );
  }

  /** 两列雪碧：图鉴 | 果切；无贴图时保持 build 中的兜底 */
  private async loadHomeFooterSheet(): Promise<void> {
    await TextureCache.load('home_footer_sheet', HOME_FOOTER_SHEET);
    const sheet = TextureCache.get('home_footer_sheet');
    for (let i = 0; i < 2; i += 1) {
      const slot = this.homeFooterSlots[i];
      slot.removeChildren();
      if (sheet) {
        const colW = Math.floor(sheet.width / 2);
        const x0 = i * colW;
        const w = i === 1 ? sheet.width - colW : colW;
        const rect = new PIXI.Rectangle(x0, 0, w, sheet.height);
        const sub = new PIXI.Texture(sheet.baseTexture, rect);
        const sp = new PIXI.Sprite(sub);
        sp.anchor.set(0.5);
        const target = homeFooterDisplayTarget();
        const sc = target / Math.max(w, sheet.height);
        sp.scale.set(sc);
        slot.addChild(sp);
        const dw = w * sc;
        const dh = sheet.height * sc;
        slot.hitArea = new PIXI.Rectangle(-dw / 2, -dh / 2, dw, dh);
      } else {
        const fb =
          i === 0
            ? this.createHomeFooterFallback('图鉴', '📖')
            : this.createHomeFooterFallback('果切', '🍉');
        slot.addChild(fb);
        slot.hitArea = new PIXI.Rectangle(-75, -50, 150, 100);
      }
    }
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

    /** 无顶栏木条：背景全屏，仅保留左上角设置 */
    const contentTop = top + 8;
    const bottomBarTop = H - 100;
    const btnW = 440;
    const btnH = 104;
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
      fontSize: 38,
      fill: 0xfff8ff,
      fontWeight: '800',
      dropShadow: true,
      dropShadowColor: 0x3d2818,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    });
    this.playEntryTitle.anchor.set(0.5);
    this.playEntryTitle.position.set(0, 0);
    this.playEntryRoot.addChild(this.playEntryTitle);
    this.playEntryRoot.hitArea = new PIXI.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH);
    this.playEntryRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('bowl');
    });
    this.container.addChild(this.playEntryRoot);

    /** 主按钮下方、底装饰之上；窄屏时夹在 play 与底边之间 */
    const sideBtnY = Math.max(playY + 192, Math.min(playY + 232, H - 32));
    const bookSlot = new PIXI.Container();
    bookSlot.position.set(Math.round(W * 0.12), sideBtnY);
    bookSlot.eventMode = 'static';
    bookSlot.cursor = 'pointer';
    bookSlot.hitArea = new PIXI.Rectangle(-75, -50, 150, 100);
    bookSlot.addChild(this.createHomeFooterFallback('图鉴', '📖'));
    bookSlot.on('pointertap', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('catalog');
    });

    const fruitSlot = new PIXI.Container();
    fruitSlot.position.set(Math.round(W * 0.88), sideBtnY);
    fruitSlot.eventMode = 'static';
    fruitSlot.cursor = 'pointer';
    fruitSlot.hitArea = new PIXI.Rectangle(-75, -50, 150, 100);
    fruitSlot.addChild(this.createHomeFooterFallback('果切', '🍉'));
    fruitSlot.on('pointertap', () => {
      AudioManager.playButtonSound();
      const api = typeof wx !== 'undefined' ? wx : null;
      api?.showToast?.({ title: '暂未开放', icon: 'none' });
    });

    this.homeFooterSlots.push(bookSlot, fruitSlot);
    this.container.addChild(bookSlot, fruitSlot);

    /** 游戏圈：靠下装饰带，略抬高避免贴底被手势条/误触；矮屏仍低于图鉴/果切一行 */
    const gameClubY = Math.min(H - 48, Math.max(sideBtnY + 72, H - 76));
    this.mountGameClubFallback(Math.round(W * 0.5), gameClubY);

    this.gearBtnRoot.position.set(40, top + 36);
    this.gearBtnRoot.eventMode = 'static';
    this.gearBtnRoot.cursor = 'pointer';
    mountSettingsButtonSprite(this.gearBtnRoot, null, 48);
    this.gearBtnRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.settingsOverlay.visible = true;
    });
    this.container.addChild(this.gearBtnRoot);

    this.container.addChild(this.settingsOverlay);
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
    const base = new PIXI.Graphics();
    base.lineStyle(2, 0xb0d4ea, 1);
    base.beginFill(0xd6f0fc);
    base.drawRoundedRect(-48, -32, 96, 64, 16);
    base.endFill();
    c.addChild(base);
    const e = new PIXI.Text(emoji, { fontSize: 28, fill: 0x3a5f78 });
    e.anchor.set(0.5);
    e.position.set(0, -10);
    c.addChild(e);
    const t = new PIXI.Text(label, {
      fontSize: 18,
      fill: 0x2a4f63,
      fontWeight: '700',
    });
    t.anchor.set(0.5);
    t.position.set(0, 18);
    c.addChild(t);
    c.scale.set(1.55);
    return c;
  }
}
