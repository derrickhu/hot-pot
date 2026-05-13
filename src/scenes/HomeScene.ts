import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { getBowlLevelIndex } from '@/game/BowlProgress';
import { LoadingOverlay } from '@/gameobjects/LoadingOverlay';
import { SettingsPauseOverlay } from '@/gameobjects/SettingsPauseOverlay';
import { openLeaderboardWithProfile } from '@/scenes/LeaderboardScene';
import { RANK_BOARD_BOWL } from '@/services/RankService';
import { UserProfileService } from '@/services/UserProfileService';
import { warmupFriendRankContext } from '@/utils/friendRanking';
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

/** 底部图鉴/排行榜内置图标的较长边目标尺寸，保持醒目但弱于主按钮。 */
function homeCatalogIconDisplayTarget(): number {
  return Math.round(Math.min(96, Math.max(76, Game.logicWidth * 0.13)));
}

/** 底部图标卡片（白色圆角背板）尺寸：保持两张卡片并排居中且不与主按钮抢视觉。 */
const HOME_FOOTER_CARD_W = 156;
const HOME_FOOTER_CARD_H = 168;
/** 底部图标卡片两两之间的水平间距 */
const HOME_FOOTER_CARD_GAP = 28;

/** 主页：夏日底图 + 进入关卡 */
export class HomeScene implements Scene {
  readonly name = 'home';
  readonly container = new PIXI.Container();

  private readonly settingsOverlay: SettingsPauseOverlay;
  private readonly homeFooterSlots: PIXI.Container[] = [];
  private readonly leaderboardEntryRoot = new PIXI.Container();
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
  /**
   * 透明 wx.createUserInfoButton，覆盖在「排行榜」卡片上。
   * 玩家点排行榜实际就是点这个原生按钮 → 微信自动连弹「隐私协议 → 用户信息授权」，
   * 拿到 userInfo 后再进入排行榜场景。
   * 已经授权过的玩家 / 非微信环境下不再创建此按钮，由 PIXI pointertap 走兜底路径。
   */
  private rankEntryAuthBtn: ReturnType<NonNullable<typeof wx.createUserInfoButton>> | null = null;
  /** UserProfileService 资料变化时同步透明按钮的取消订阅 */
  private unsubRankProfileChange: (() => void) | null = null;
  /**
   * 上一次写入透明按钮的 CSS 坐标，rect 没变就跳过 Object.assign(style, ...)，
   * 避免基础库 3.15+ 上每次写 style 都刷出 updateTextView:fail SystemError。
   */
  private rankEntryLastCss: { left: number; top: number; width: number; height: number } | null = null;

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
    // 排行榜入口的透明 wx 授权按钮：未授权时挂上，授权完成立即销毁
    this.syncRankEntryAuthBtn();
    if (!this.unsubRankProfileChange) {
      this.unsubRankProfileChange = UserProfileService.onChange(() => this.syncRankEntryAuthBtn());
    }
    // 主页空闲时预热好友榜子域沙箱，把 ~100-500ms 的冷启动藏在 home 阶段，
    // 等玩家点开排行榜并切到好友榜 tab 时少等一截。失败完全静默。
    warmupFriendRankContext();
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
    this.destroyRankEntryAuthBtn();
    if (this.unsubRankProfileChange) {
      this.unsubRankProfileChange();
      this.unsubRankProfileChange = null;
    }
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
    /**
     * 贴图 945×390 中，药丸边框水平中心在源图 ~466.5（几何中心 472.5，左偏 ~6 源像素），
     * 垂直中心在源图 ~208（几何中心 195，下偏 ~13 源像素）。同时左上角柠檬装饰视觉重量
     * 明显大于右下角小草莓，文字置于贴图几何中心会显得偏左偏上。下面先按几何把文字对齐到
     * 药丸真实中心，再叠加视觉补偿：X 方向往右多推一点抵消左上柠檬装饰的视觉重量，
     * Y 方向往上稍稍偏一点匹配药丸顶部高光，让"第N关"看起来稳稳落在按钮正中央。
     */
    const titleOffsetX = Math.round((-6 + 22) * s); // 几何 + 柠檬视觉补偿
    const titleOffsetY = Math.round((13 - 8) * s); // 几何 + 顶部高光视觉补偿
    this.playEntryTitle.position.set(titleOffsetX, titleOffsetY);
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

    /** 底部两张卡片并排：左排行榜 / 右图鉴；居中对齐主按钮柱 */
    const cardCenterY = Math.round(fruitY + fruitHalf + 24 + HOME_FOOTER_CARD_H / 2);
    const cardLeftX = Math.round(W / 2 - (HOME_FOOTER_CARD_W + HOME_FOOTER_CARD_GAP) / 2);
    const cardRightX = Math.round(W / 2 + (HOME_FOOTER_CARD_W + HOME_FOOTER_CARD_GAP) / 2);

    const bookSlot = this.homeFooterSlots[0];
    if (bookSlot) {
      bookSlot.position.set(cardRightX, cardCenterY);
    }
    this.leaderboardEntryRoot.position.set(cardLeftX, cardCenterY);

    /** 游戏圈紧贴屏幕底部，并与图标卡片留出足够呼吸感 */
    const gameClubMinY = cardCenterY + HOME_FOOTER_CARD_H / 2 + 36;
    const gameClubY = Math.min(H - 48, Math.max(gameClubMinY, H - 76));
    this.gameClubFallbackRoot.position.set(Math.round(W * 0.5), gameClubY);

    // 排行榜入口位置变化后，同步上面的透明 wx 原生按钮坐标
    this.syncRankEntryAuthBtn();
  }

  /** 图鉴入口：白色卡片底 + 草莓贴图（无贴图时落入 emoji 兜底） */
  private async loadHomeCatalogIcon(): Promise<void> {
    await TextureCache.load('home_catalog_icon', HOME_CATALOG_ICON_TEXTURE);
    const tex = TextureCache.get('home_catalog_icon');
    for (let i = 0; i < this.homeFooterSlots.length; i += 1) {
      const slot = this.homeFooterSlots[i];
      if (!slot) {
        continue;
      }
      slot.removeChildren();
      slot.addChild(this.createFooterCardBackdrop());

      const iconArea = new PIXI.Container();
      iconArea.position.set(0, -HOME_FOOTER_CARD_H / 2 + 70);
      slot.addChild(iconArea);

      if (tex) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const target = Math.min(82, homeCatalogIconDisplayTarget());
        const sc = target / Math.max(tex.width, tex.height);
        sp.scale.set(sc);
        iconArea.addChild(sp);
      } else {
        const e = new PIXI.Text('🍓', { fontSize: 70 });
        e.anchor.set(0.5);
        e.resolution = 2;
        iconArea.addChild(e);
      }

      const label = this.createFooterCardLabel('图鉴', 0xa14a0d);
      label.position.set(0, HOME_FOOTER_CARD_H / 2 - 28);
      slot.addChild(label);

      slot.hitArea = new PIXI.Rectangle(
        -HOME_FOOTER_CARD_W / 2 - 6,
        -HOME_FOOTER_CARD_H / 2 - 6,
        HOME_FOOTER_CARD_W + 12,
        HOME_FOOTER_CARD_H + 12,
      );
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

    /** 底部两张卡片入口：左排行榜 / 右图鉴；与「果切挑战」上下相接 */
    const bookSlot = new PIXI.Container();
    bookSlot.position.set(Math.round(W * 0.62), Math.max(playY + 220, H - 200));
    bookSlot.eventMode = 'static';
    bookSlot.cursor = 'pointer';
    bookSlot.hitArea = new PIXI.Rectangle(
      -HOME_FOOTER_CARD_W / 2 - 6,
      -HOME_FOOTER_CARD_H / 2 - 6,
      HOME_FOOTER_CARD_W + 12,
      HOME_FOOTER_CARD_H + 12,
    );
    bookSlot.addChild(this.createFooterCardBackdrop());
    const bookFallbackIcon = new PIXI.Text('🍓', { fontSize: 70 });
    bookFallbackIcon.anchor.set(0.5);
    bookFallbackIcon.resolution = 2;
    bookFallbackIcon.position.set(0, -HOME_FOOTER_CARD_H / 2 + 70);
    bookSlot.addChild(bookFallbackIcon);
    const bookLabel = this.createFooterCardLabel('图鉴', 0xa14a0d);
    bookLabel.position.set(0, HOME_FOOTER_CARD_H / 2 - 28);
    bookSlot.addChild(bookLabel);
    bookSlot.on('pointertap', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('catalog');
    });

    this.homeFooterSlots.push(bookSlot);
    this.container.addChild(bookSlot);

    this.leaderboardEntryRoot.position.set(Math.round(W * 0.38), Math.max(playY + 220, H - 200));
    this.leaderboardEntryRoot.eventMode = 'static';
    this.leaderboardEntryRoot.cursor = 'pointer';
    this.leaderboardEntryRoot.hitArea = new PIXI.Rectangle(
      -HOME_FOOTER_CARD_W / 2 - 6,
      -HOME_FOOTER_CARD_H / 2 - 6,
      HOME_FOOTER_CARD_W + 12,
      HOME_FOOTER_CARD_H + 12,
    );
    this.leaderboardEntryRoot.addChild(this.createFooterCardBackdrop());
    const rankIcon = this.createLeaderboardCardIcon();
    rankIcon.position.set(0, -HOME_FOOTER_CARD_H / 2 + 72);
    this.leaderboardEntryRoot.addChild(rankIcon);
    const rankLabel = this.createFooterCardLabel('排行榜', 0x275f2d);
    rankLabel.position.set(0, HOME_FOOTER_CARD_H / 2 - 28);
    this.leaderboardEntryRoot.addChild(rankLabel);
    /**
     * 仅在「没有原生 wx 授权按钮覆盖」时才会真正触发：
     *   - 玩家已授权过本机资料 → 不创建覆盖按钮，PIXI 这一路直接进入排行榜
     *   - 非微信小游戏（开发环境 / 抖音端等） → 同上
     * 微信小游戏未授权状态下，玩家点击的是上面盖着的透明 createUserInfoButton，
     * 其 onTap → handleRankEntryAuthTap → openLeaderboardWithProfile 才是主路径。
     */
    this.leaderboardEntryRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.hideGameClubNativeButton();
      openLeaderboardWithProfile(RANK_BOARD_BOWL);
    });
    this.container.addChild(this.leaderboardEntryRoot);

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

  /**
   * 同步「排行榜」卡片上方的透明 wx.createUserInfoButton。
   * - 未授权 + 微信端：创建/更新一个完全透明的原生按钮覆盖在卡片上
   * - 已授权 / 非微信：销毁按钮，让 PIXI pointertap 走兜底路径
   */
  private syncRankEntryAuthBtn(): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    if (!api?.createUserInfoButton) {
      this.destroyRankEntryAuthBtn();
      return;
    }
    // 已经拿到真实昵称头像，就不需要再卡这一层授权按钮
    if (UserProfileService.hasRealProfile()) {
      this.destroyRankEntryAuthBtn();
      return;
    }

    const rect = this.computeRankEntryCssRect();
    if (!rect) {
      this.destroyRankEntryAuthBtn();
      return;
    }

    if (!this.rankEntryAuthBtn) {
      try {
        // 注：text 必须非空、fontSize 最低 12，部分基础库下 text='' 或 fontSize<12
        // 按钮不会被渲染（也就不会触发 onTap），用空格 + color 透明能避开这条坑。
        const btn = api.createUserInfoButton({
          type: 'text',
          text: ' ',
          style: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            backgroundColor: 'rgba(0,0,0,0)',
            borderColor: 'rgba(0,0,0,0)',
            borderWidth: 0,
            borderRadius: 24,
            color: 'rgba(0,0,0,0)',
            fontSize: 12,
            lineHeight: rect.height,
          },
          withCredentials: false,
        });
        if (btn) {
          this.rankEntryAuthBtn = btn;
          this.rankEntryLastCss = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
          btn.onTap?.((res) => this.handleRankEntryAuthTap(res));
          btn.show?.();
          console.log(
            `[HomeScene] rank entry wx btn created css(left=${rect.left} top=${rect.top}` +
              ` w=${rect.width} h=${rect.height})`,
          );
        } else {
          console.warn('[HomeScene] createUserInfoButton returned falsy');
        }
      } catch (error) {
        console.warn('[HomeScene] create rank entry userInfo button failed', error);
      }
      return;
    }

    const last = this.rankEntryLastCss;
    if (last && last.left === rect.left && last.top === rect.top && last.width === rect.width && last.height === rect.height) {
      // 坐标无变化，跳过 style 写入，避免 updateTextView 噪音
      return;
    }
    try {
      this.rankEntryLastCss = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      if (this.rankEntryAuthBtn.style) {
        Object.assign(this.rankEntryAuthBtn.style, {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        });
      }
      this.rankEntryAuthBtn.show?.();
    } catch (error) {
      console.warn('[HomeScene] sync rank entry userInfo button failed', error);
    }
  }

  private destroyRankEntryAuthBtn(): void {
    this.rankEntryLastCss = null;
    if (!this.rankEntryAuthBtn) {
      return;
    }
    try {
      this.rankEntryAuthBtn.hide?.();
    } catch {
      // 隐藏失败不影响后续 destroy
    }
    try {
      this.rankEntryAuthBtn.destroy?.();
    } catch {
      // 部分基础库 destroy 后会抛错，忽略
    }
    this.rankEntryAuthBtn = null;
  }

  /**
   * 把「排行榜」卡片的设计像素中心点 → CSS 像素左上角矩形。
   * 必须等 layoutHomeMainColumn 把 leaderboardEntryRoot 摆好后再算。
   */
  private computeRankEntryCssRect(): { left: number; top: number; width: number; height: number } | null {
    const designW = Game.designWidth || 750;
    if (!designW) {
      return null;
    }
    const cx = this.leaderboardEntryRoot.x;
    const cy = this.leaderboardEntryRoot.y;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
      return null;
    }
    // 设计像素 → 物理像素（含 letterbox 偏移）→ CSS 像素（÷ dpr）
    // iPhone 上 stageOffset 为 0，等价于旧的 `* (screenWidth/designWidth)`；
    // iPad 等需要 letterbox 时，stageOffsetX/Y 让按钮跟着舞台居中后的真实位置走。
    const dpr = Math.max(1, Game.dpr || 1);
    const scale = Math.max(0.0001, Game.scale || 1);
    const designLeft = cx - HOME_FOOTER_CARD_W / 2;
    const designTop = cy - HOME_FOOTER_CARD_H / 2;
    const cssLeft = Math.round((Game.stageOffsetX + designLeft * scale) / dpr);
    const cssTop = Math.round((Game.stageOffsetY + designTop * scale) / dpr);
    const cssW = Math.max(1, Math.round((HOME_FOOTER_CARD_W * scale) / dpr));
    const cssH = Math.max(1, Math.round((HOME_FOOTER_CARD_H * scale) / dpr));
    return { left: cssLeft, top: cssTop, width: cssW, height: cssH };
  }

  /**
   * 透明 wx.createUserInfoButton 的 onTap 回调：
   * - 拿到 userInfo（真实昵称头像）→ 写入 UserProfileService → 进排行榜
   * - 玩家拒绝授权 / 隐私协议未配置 / 任何异常 → 也进排行榜，由榜内 CTA 兑底
   */
  private handleRankEntryAuthTap(res: any): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    AudioManager.playButtonSound();
    this.hideGameClubNativeButton();

    const errMsg: string = (res?.errMsg as string) || '';
    const errCode = res?.err_code;
    // 排错关键日志：把微信回调的核心字段全部打印（避免 stringify 整个 res 导致超长）
    console.log(
      `[HomeScene] rank entry userInfo onTap:` +
        ` hasUserInfo=${!!res?.userInfo}` +
        ` nick="${res?.userInfo?.nickName || ''}"` +
        ` avatarUrl=${res?.userInfo?.avatarUrl ? String(res.userInfo.avatarUrl).slice(0, 64) + '...' : '(empty)'}` +
        ` errMsg="${errMsg}"` +
        ` errCode=${errCode}`,
    );

    // -12034：开发者侧没在小程序后台配置「用户隐私保护指引」
    const privacyNotConfigured = errCode === -12034 || errMsg.includes('no privacy api permission');

    if (res?.userInfo) {
      // 这里 applyFromWeChat 会同步触发 RankUpload 主动 flush，
      // 不再依赖之后的 LeaderboardScene.onEnter 才上报新资料。
      const applied = UserProfileService.applyFromWeChat(res.userInfo);
      if (applied) {
        try {
          api?.showToast?.({ title: '已带微信昵称上榜', icon: 'success', duration: 1200 });
        } catch {
          // 部分宿主无 showToast，安静失败
        }
      }
    } else if (privacyNotConfigured) {
      try {
        api?.showToast?.({ title: '隐私协议未配置', icon: 'none', duration: 1500 });
      } catch {
        // 同上
      }
    }
    // 不管授权结果如何，都进入排行榜：
    //   - 同意了：榜单立即显示真实头像昵称
    //   - 拒绝了 / 隐私未配置：榜内仍有「使用微信昵称头像上榜」CTA 兜底
    openLeaderboardWithProfile(RANK_BOARD_BOWL);
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

  /** 底部图标卡片的白色圆角背板（带阴影 + 卡片描边，所有底部入口共用） */
  private createFooterCardBackdrop(): PIXI.Container {
    const root = new PIXI.Container();
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x274a4f, 0.18);
    shadow.drawRoundedRect(
      -HOME_FOOTER_CARD_W / 2 + 4,
      -HOME_FOOTER_CARD_H / 2 + 8,
      HOME_FOOTER_CARD_W,
      HOME_FOOTER_CARD_H,
      26,
    );
    shadow.endFill();
    root.addChild(shadow);

    const card = new PIXI.Graphics();
    card.beginFill(0xffffff);
    card.lineStyle(3, 0xc7e4d6, 1);
    card.drawRoundedRect(
      -HOME_FOOTER_CARD_W / 2,
      -HOME_FOOTER_CARD_H / 2,
      HOME_FOOTER_CARD_W,
      HOME_FOOTER_CARD_H,
      26,
    );
    card.endFill();
    // 内侧次级描边，模拟参考 UI 的双层圆角
    card.lineStyle(2, 0xeef9f1, 1);
    card.drawRoundedRect(
      -HOME_FOOTER_CARD_W / 2 + 5,
      -HOME_FOOTER_CARD_H / 2 + 5,
      HOME_FOOTER_CARD_W - 10,
      HOME_FOOTER_CARD_H - 10,
      22,
    );
    root.addChild(card);
    return root;
  }

  /** 底部卡片下方居中的彩色标签文字 */
  private createFooterCardLabel(text: string, color: number): PIXI.Text {
    const label = new PIXI.Text(text, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 26,
      fill: color,
      fontWeight: '900',
      stroke: 0xffffff,
      strokeThickness: 4,
      lineJoin: 'round',
      letterSpacing: 2,
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    return label;
  }

  /** 排行榜卡片图标：绿色柱状图 + 顶部金色奖杯小角标 */
  private createLeaderboardCardIcon(): PIXI.Container {
    const root = new PIXI.Container();

    // 底座阴影
    const base = new PIXI.Graphics();
    base.beginFill(0xd8ebd1, 0.6);
    base.drawRoundedRect(-44, 30, 88, 12, 6);
    base.endFill();
    root.addChild(base);

    // 三根高度递增的柱子（从左到右）
    const bars = new PIXI.Graphics();
    const cols: Array<{ x: number; h: number; fill: number; stroke: number }> = [
      { x: -32, h: 30, fill: 0x9adba2, stroke: 0x3d8b4d },
      { x: 0, h: 50, fill: 0x67c47b, stroke: 0x2c6f37 },
      { x: 32, h: 70, fill: 0x3d8b4d, stroke: 0x205a2b },
    ];
    for (const col of cols) {
      bars.beginFill(col.fill);
      bars.lineStyle(3, col.stroke, 1);
      bars.drawRoundedRect(col.x - 14, 28 - col.h, 28, col.h, 8);
      bars.endFill();
    }
    root.addChild(bars);

    // 顶部小奖杯（点缀）
    const star = new PIXI.Graphics();
    star.beginFill(0xf7c64a);
    star.lineStyle(2, 0xc88517, 1);
    this.drawTinyStar(star, 32, 28 - 70 - 12, 5, 9, 4);
    star.endFill();
    root.addChild(star);

    return root;
  }

  /** 排行榜图标顶部的小五角星（点缀） */
  private drawTinyStar(g: PIXI.Graphics, x: number, y: number, n: number, outer: number, inner: number): void {
    const step = Math.PI / n;
    const pts: number[] = [];
    for (let i = 0; i < n * 2; i += 1) {
      const r = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + i * step;
      pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.drawPolygon(pts);
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
