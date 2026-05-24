import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { analytics } from '@/analytics';
import { BOWL_LEVEL_COUNT } from '@/config/bowlLevels';
import { getDailyLimitedLevelForDate } from '@/config/dailyLimitedLevels';
import { getBowlLevelIndex, getMaxUnlockedBowlBadgeLevelNumber } from '@/game/BowlProgress';
import { getFruitSliceBestScore } from '@/game/FruitSliceProgress';
import { CoinBar, COIN_ICON_TEXTURE_KEY, COIN_ICON_TEXTURE_PATH } from '@/gameobjects/CoinBar';
import { LoadingOverlay } from '@/gameobjects/LoadingOverlay';
import { GameClubWelfareOverlay } from '@/gameobjects/GameClubWelfareOverlay';
import { SettingsPauseOverlay } from '@/gameobjects/SettingsPauseOverlay';
import { openLeaderboard } from '@/scenes/LeaderboardScene';
import { RANK_BOARD_BOWL } from '@/services/RankService';
import { warmupFriendRankContext } from '@/utils/friendRanking';
import { TextureCache } from '@/utils/TextureCache';

/** 首页图鉴入口：独立图标，不带按钮底框 */
const HOME_CATALOG_ICON_TEXTURE = 'assets/images/home_footer_catalog_btn_v2.png';
/** 首页排行榜入口：与图鉴同风格的独立图标 */
const HOME_LEADERBOARD_ICON_TEXTURE = 'assets/images/home_footer_rank_btn_v2.png';
/** 首页扭蛋入口：与图鉴同风格的独立图标 */
const HOME_GACHA_ICON_TEXTURE = 'assets/images/home_footer_gacha_btn_v2.png';
/** 首页设置入口：音乐 / 音效图形按钮 */
const HOME_SETTINGS_ICON_TEXTURE = 'assets/images/home_footer_settings_audio_btn_v2.png';
/** 首页福利入口：游戏圈每日任务 */
const HOME_WELFARE_ICON_TEXTURE = 'assets/images/home_footer_welfare_btn_v1.png';
/** 首页三玩法入口：按钮、图标、标题、副标题均已烘焙在贴图内 */
const HOME_PLAY_BTN_TEXTURE = 'assets/images/home_mode_btn_level_bowl_v2.png';
const HOME_DAILY_LIMITED_BTN_TEXTURE = 'assets/images/home_mode_btn_daily_iced_drink_v2.png';
const HOME_FRUIT_SLICE_CHALLENGE_BTN_TEXTURE = 'assets/images/home_mode_btn_fruit_slice_v2.png';
/** 游戏字标「别捞水果」 */
const HOME_LOGO_TITLE_TEXTURE = 'assets/images/game_logo_title.png';

/** 关卡药丸贴图目标逻辑宽度（与历史实现一致） */
function homePlayEntryTargetWidth(): number {
  return homeModeEntryTargetWidth();
}

function homeModeEntryTargetWidth(): number {
  return Math.min(600, Game.logicWidth * 0.8);
}

function homeFruitSliceEntryTargetWidth(): number {
  return homeModeEntryTargetWidth();
}

/** 底部图鉴/排行榜内置图标的较长边目标尺寸，保持醒目但弱于主按钮。 */
function homeCatalogIconDisplayTarget(): number {
  return Math.round(Math.min(86, Math.max(72, Game.logicWidth * 0.115)));
}

/** 底部图标入口尺寸：放在统一圆角底栏内，不再绘制独立卡片。 */
const HOME_FOOTER_CARD_W = 156;
const HOME_FOOTER_CARD_H = 168;
const HOME_FOOTER_BAR_H = 150;
const HOME_FOOTER_NAV_CELL_W = 150;
const HOME_FOOTER_NAV_CELL_H = 136;

/**
 * 把 container 的所有子节点 detach 并 destroy，避免热路径反复 removeChildren
 * 留下游离的 PIXI.Text / Sprite 占内存（mode entry tag / footer nav 等高频重画位）。
 */
function destroyContainerChildren(container: PIXI.Container): void {
  const children = container.removeChildren();
  for (const child of children) {
    if (!child.destroyed) {
      child.destroy({ children: true });
    }
  }
}

/** 主页：夏日底图 + 进入关卡 */
export class HomeScene implements Scene {
  readonly name = 'home';
  readonly container = new PIXI.Container();

  private readonly settingsOverlay: SettingsPauseOverlay;
  private readonly gameClubWelfareOverlay: GameClubWelfareOverlay;
  // onEnter 里串好的 welfare layout timer 需在 onExit 取消，
  // 否则离开主页后 wx 原生按钮还会被异步同步一次，盖到下个场景画布上。
  private readonly pendingHomeTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly homeFooterSlots: PIXI.Container[] = [];
  private readonly leaderboardEntryRoot = new PIXI.Container();
  private readonly gachaEntryRoot = new PIXI.Container();
  private readonly welfareEntryRoot = new PIXI.Container();
  private readonly settingsEntryRoot = new PIXI.Container();
  private readonly homeCoinBar = new CoinBar();
  /** 进入关卡：贴图或紫底兜底 */
  private readonly playEntryRoot = new PIXI.Container();
  private playEntryBg!: PIXI.Graphics;
  private playEntryTitle!: PIXI.Text;
  private playEntrySprite: PIXI.Sprite | null = null;
  private readonly playEntryTag = new PIXI.Container();
  /** 果切无尽：暖色药丸贴图（字与图标在贴图内；无贴图时程序叠字兜底） */
  private readonly fruitSliceEntryRoot = new PIXI.Container();
  private fruitSliceEntryBg!: PIXI.Graphics;
  private fruitSliceEntryTitle!: PIXI.Text;
  private fruitSliceEntrySprite: PIXI.Sprite | null = null;
  private readonly fruitSliceEntryTag = new PIXI.Container();
  /** 每日限定玩法：临时程序绘制入口 */
  private readonly dailyLimitedEntryRoot = new PIXI.Container();
  private dailyLimitedEntryBg!: PIXI.Graphics;
  private dailyLimitedEntryTitle!: PIXI.Text;
  private dailyLimitedEntrySprite: PIXI.Sprite | null = null;
  private readonly dailyLimitedEntryTag = new PIXI.Container();
  /** 顶栏与主按钮之间的 Logo 区（有贴图再显示） */
  private readonly homeLogoRoot = new PIXI.Container();
  private readonly homeLogoSprite = new PIXI.Sprite();
  private homeLogoMaxWidth = 0;
  private homeLogoMaxHeight = 0;
  private bgFill!: PIXI.Graphics;
  private gradFill!: PIXI.Graphics;
  private readonly footerNavBg = new PIXI.Graphics();
  private enteringBowl = false;
  private enteringDailyLimited = false;
  private enteringFruitSlice = false;
  private enteringGacha = false;

  constructor() {
    this.settingsOverlay = new SettingsPauseOverlay(Game.logicWidth, Game.logicHeight, {
      onReplay: () => {
        void this.enterBowlWithLoading();
      },
      onHome: () => {},
      onContinue: () => {},
    }, { mode: 'home' });
    this.gameClubWelfareOverlay = new GameClubWelfareOverlay(Game.logicWidth, Game.logicHeight, {
      onClaimed: () => {
        this.homeCoinBar.refresh();
        this.homeCoinBar.bump();
      },
    });
    this.build();
    void this.loadHomeBackdrop(Game.logicWidth, Game.logicHeight);
    void this.loadHomeCatalogIcon();
  }

  onEnter(): void {
    this.refreshPlayEntryTitle();
    this.refreshModeEntryTags();
    this.homeCoinBar.refresh();
    this.refreshModeEntryTags();
    this.layoutHomeMainColumn();
    this.scheduleHomeTimer(() => this.gameClubWelfareOverlay.layout(), 0);
    this.scheduleHomeTimer(() => this.gameClubWelfareOverlay.layout(), 160);
    // 主页空闲时预热好友榜子域沙箱，把 ~100-500ms 的冷启动藏在 home 阶段，
    // 等玩家点开排行榜并切到好友榜 tab 时少等一截。失败完全静默。
    warmupFriendRankContext();
  }

  private scheduleHomeTimer(fn: () => void, delay: number): void {
    const id = setTimeout(() => {
      this.pendingHomeTimers.delete(id);
      fn();
    }, delay);
    this.pendingHomeTimers.add(id);
  }

  private clearAllHomeTimers(): void {
    for (const id of this.pendingHomeTimers) {
      clearTimeout(id);
    }
    this.pendingHomeTimers.clear();
  }

  onExit(): void {
    this.gameClubWelfareOverlay.close();
    this.clearAllHomeTimers();
  }

  private refreshPlayEntryTitle(): void {
    this.playEntryTitle.text = this.isAllBowlLevelsCleared() ? '已通关' : `第${getBowlLevelIndex() + 1}关`;
  }

  private refreshModeEntryTags(): void {
    if (this.isAllBowlLevelsCleared()) {
      this.updateModeEntryTag(this.playEntryTag, [
        { text: '已通关', color: 0xf08a18 },
        { text: ' · 敬请期待', color: 0x2f681b },
      ], 0xf7fff1, 0x4c9e2d);
    } else {
      this.updateModeEntryTag(this.playEntryTag, [
        { text: '第', color: 0x2f681b },
        { text: `${getBowlLevelIndex() + 1}`, color: 0xf08a18 },
        { text: '关', color: 0x2f681b },
      ], 0xf7fff1, 0x4c9e2d);
    }
    this.updateModeEntryTag(
      this.dailyLimitedEntryTag,
      [
        { text: '今日饮品：', color: 0x185a86 },
        { text: getDailyLimitedLevelForDate().drinkName, color: 0xe95b2f },
      ],
      0xf1fbff,
      0x278fd0,
    );
    this.updateModeEntryTag(
      this.fruitSliceEntryTag,
      [
        { text: '当前最高分：', color: 0x8a3d10 },
        { text: `${getFruitSliceBestScore()}`, color: 0xe83324 },
      ],
      0xfff5df,
      0xf08a1b,
    );
  }

  private isAllBowlLevelsCleared(): boolean {
    return getMaxUnlockedBowlBadgeLevelNumber() >= BOWL_LEVEL_COUNT;
  }

  private async loadHomeBackdrop(width: number, height: number): Promise<void> {
    await Promise.all([
      TextureCache.load('__home_bg', 'assets/images/home_bg_summer.jpg'),
      TextureCache.load('home_play_btn', HOME_PLAY_BTN_TEXTURE),
      TextureCache.load('home_daily_limited_btn', HOME_DAILY_LIMITED_BTN_TEXTURE),
      TextureCache.load('home_fruit_slice_challenge_btn', HOME_FRUIT_SLICE_CHALLENGE_BTN_TEXTURE),
      TextureCache.load('game_logo_title', HOME_LOGO_TITLE_TEXTURE),
      TextureCache.load('home_leaderboard_icon', HOME_LEADERBOARD_ICON_TEXTURE),
      TextureCache.load('home_gacha_icon', HOME_GACHA_ICON_TEXTURE),
      TextureCache.load('home_welfare_icon', HOME_WELFARE_ICON_TEXTURE),
      TextureCache.load('home_settings_icon', HOME_SETTINGS_ICON_TEXTURE),
      TextureCache.load(COIN_ICON_TEXTURE_KEY, COIN_ICON_TEXTURE_PATH),
      GameClubWelfareOverlay.preloadTextures(),
    ]);
    const tex = TextureCache.get('__home_bg');
    if (!tex) {
      this.applyPlayEntryArt();
      this.applyDailyLimitedEntryArt();
      this.applyFruitSliceEntryArt();
      this.applyHomeLogoTitle();
      this.refreshGeneratedFooterIcons();
      this.homeCoinBar.refreshIcon();
      this.refreshModeEntryTags();
      this.layoutHomeMainColumn();
      return;
    }
    const sp = new PIXI.Sprite(tex);
    sp.width = width;
    sp.height = height;
    this.container.addChildAt(sp, 0);
    this.container.removeChild(this.bgFill);
    this.container.removeChild(this.gradFill);
    this.applyPlayEntryArt();
    this.applyDailyLimitedEntryArt();
    this.applyFruitSliceEntryArt();
    this.applyHomeLogoTitle();
    this.refreshGeneratedFooterIcons();
    this.homeCoinBar.refreshIcon();
    this.refreshModeEntryTags();
    this.layoutHomeMainColumn();
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

  private updateModeEntryTag(
    tag: PIXI.Container,
    parts: Array<{ text: string; color: number }>,
    fill: number,
    stroke: number,
  ): void {
    destroyContainerChildren(tag);

    const labelRoot = new PIXI.Container();
    const labelTexts = parts.map((part) => {
      const t = new PIXI.Text(part.text, {
        fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
        fontSize: 20,
        fill: part.color,
        fontWeight: '900',
        stroke: 0xffffff,
        strokeThickness: 3,
        lineJoin: 'round',
      });
      t.anchor.set(0, 0.5);
      t.resolution = 2;
      return t;
    });

    let totalW = 0;
    for (const t of labelTexts) {
      t.position.set(totalW, 0);
      labelRoot.addChild(t);
      totalW += t.width;
    }
    labelRoot.pivot.set(totalW / 2, 0);

    const padX = 14;
    const padY = 6;
    const labelH = Math.max(...labelTexts.map((t) => t.height), 24);
    const bgW = Math.ceil(totalW + padX * 2);
    const bgH = Math.ceil(labelH + padY * 2);

    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x1b4f55, 0.16);
    shadow.drawRoundedRect(-bgW / 2 + 2, -bgH / 2 + 3, bgW, bgH, bgH / 2);
    shadow.endFill();
    tag.addChild(shadow);

    const bg = new PIXI.Graphics();
    bg.beginFill(fill, 0.96);
    bg.lineStyle(3, stroke, 1);
    bg.drawRoundedRect(-bgW / 2, -bgH / 2, bgW, bgH, bgH / 2);
    bg.endFill();
    tag.addChild(bg);
    tag.addChild(labelRoot);
  }

  /** 主按钮：优先使用已烘焙文字贴图，失败则回到程序叠字兜底 */
  private applyPlayEntryArt(): void {
    const tex = TextureCache.get('home_play_btn');
    if (!tex) {
      this.playEntryTitle.visible = true;
      this.playEntryTitle.style.fill = 0xfff4c2;
      this.playEntryTitle.style.stroke = 0x5a2a19;
      this.playEntryTitle.style.strokeThickness = 6;
      this.playEntryTitle.style.dropShadow = false;
      this.playEntryTitle.position.set(0, 0);
      this.playEntryRoot.hitArea = new PIXI.Rectangle(-220, -52, 440, 104);
      return;
    }
    this.playEntryTitle.visible = false;
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
    const hitPadX = 20;
    const hitPadY = 14;
    this.playEntryRoot.hitArea = new PIXI.Rectangle(
      -targetW / 2 - hitPadX,
      -halfH - hitPadY,
      targetW + hitPadX * 2,
      halfH * 2 + hitPadY * 2,
    );
  }

  /** 每日限定：优先使用已烘焙文字贴图，失败则回到程序绘制兜底 */
  private applyDailyLimitedEntryArt(): void {
    const tex = TextureCache.get('home_daily_limited_btn');
    if (!tex) {
      this.dailyLimitedEntryTitle.visible = true;
      this.dailyLimitedEntryRoot.hitArea = new PIXI.Rectangle(-176, -52, 352, 104);
      return;
    }
    this.dailyLimitedEntryTitle.visible = false;
    if (this.dailyLimitedEntryBg.parent) {
      this.dailyLimitedEntryRoot.removeChild(this.dailyLimitedEntryBg);
    }
    if (!this.dailyLimitedEntrySprite) {
      this.dailyLimitedEntrySprite = new PIXI.Sprite();
      this.dailyLimitedEntrySprite.anchor.set(0.5);
      this.dailyLimitedEntryRoot.addChildAt(this.dailyLimitedEntrySprite, 0);
    }
    this.dailyLimitedEntrySprite.texture = tex;
    const targetW = homeModeEntryTargetWidth();
    const s = targetW / tex.width;
    this.dailyLimitedEntrySprite.scale.set(s);
    const halfH = (tex.height * s) / 2;
    const hitPadX = 20;
    const hitPadY = 14;
    this.dailyLimitedEntryRoot.hitArea = new PIXI.Rectangle(
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
      const hw = 220;
      const hh = 52;
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

  private positionModeEntryTag(tag: PIXI.Container, targetW: number, halfH: number, xInset: number): void {
    const bounds = tag.getLocalBounds();
    const tagHalfW = bounds.width > 0 ? bounds.width / 2 : 72;
    tag.position.set(
      Math.round(targetW / 2 - tagHalfW - 38 + xInset),
      Math.round(-halfH + 28),
    );
  }

  /** 主按钮柱（关卡 + 果切）与底栏图鉴、游戏圈纵向位置 */
  private layoutHomeMainColumn(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const top = Game.safeTop;
    const contentTop = top + 8;
    const bottomBarTop = H - 100;
    const playY = contentTop + Math.min(520, Math.max(410, (bottomBarTop - contentTop) * 0.31));

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

    let dailyHalf = 44;
    if (
      this.dailyLimitedEntrySprite?.texture
      && this.dailyLimitedEntrySprite.texture !== PIXI.Texture.EMPTY
      && this.dailyLimitedEntrySprite.texture.width > 2
    ) {
      const tw = this.dailyLimitedEntrySprite.texture.width;
      const targetW = homeModeEntryTargetWidth();
      const s = targetW / tw;
      dailyHalf = (this.dailyLimitedEntrySprite.texture.height * s) / 2;
    } else if (this.dailyLimitedEntryBg.parent) {
      dailyHalf = 44;
    }

    const gap = 24;
    this.playEntryRoot.position.set(W / 2, playY);
    this.positionModeEntryTag(this.playEntryTag, homePlayEntryTargetWidth(), playHalf, 0);
    const dailyY = playY + playHalf + gap + dailyHalf;
    this.dailyLimitedEntryRoot.position.set(W / 2, dailyY);
    this.positionModeEntryTag(this.dailyLimitedEntryTag, homeModeEntryTargetWidth(), dailyHalf, -6);
    const fruitY = dailyY + dailyHalf + gap + fruitHalf;
    this.fruitSliceEntryRoot.position.set(W / 2, fruitY);
    this.positionModeEntryTag(this.fruitSliceEntryTag, homeFruitSliceEntryTargetWidth(), fruitHalf, -4);

    /** 底部入口：参考原型图，五个图标放在同一个奶油色圆角底栏内。 */
    const footerBarW = Math.min(650, W - 56);
    const footerBarCenterY = Math.round(fruitY + fruitHalf + 34 + HOME_FOOTER_BAR_H / 2);
    const footerCellGap = footerBarW / 5;
    const footerLeft = W / 2 - footerBarW / 2;
    const footerY = footerBarCenterY;

    this.footerNavBg.clear();
    this.footerNavBg.beginFill(0x3d6c6c, 0.16);
    this.footerNavBg.drawRoundedRect(
      W / 2 - footerBarW / 2 + 5,
      footerY - HOME_FOOTER_BAR_H / 2 + 8,
      footerBarW,
      HOME_FOOTER_BAR_H,
      36,
    );
    this.footerNavBg.endFill();
    this.footerNavBg.beginFill(0xfff5df, 0.96);
    this.footerNavBg.lineStyle(4, 0xe0d1b8, 1);
    this.footerNavBg.drawRoundedRect(
      W / 2 - footerBarW / 2,
      footerY - HOME_FOOTER_BAR_H / 2,
      footerBarW,
      HOME_FOOTER_BAR_H,
      36,
    );
    this.footerNavBg.endFill();
    this.footerNavBg.lineStyle(2, 0xffffff, 0.85);
    this.footerNavBg.drawRoundedRect(
      W / 2 - footerBarW / 2 + 8,
      footerY - HOME_FOOTER_BAR_H / 2 + 8,
      footerBarW - 16,
      HOME_FOOTER_BAR_H - 16,
      30,
    );

    const bookSlot = this.homeFooterSlots[0];
    if (bookSlot) {
      bookSlot.position.set(Math.round(footerLeft + footerCellGap * 3.5), footerY);
    }
    this.leaderboardEntryRoot.position.set(Math.round(footerLeft + footerCellGap * 0.5), footerY);
    this.gachaEntryRoot.position.set(Math.round(footerLeft + footerCellGap * 1.5), footerY);
    this.welfareEntryRoot.position.set(Math.round(footerLeft + footerCellGap * 2.5), footerY);
    this.settingsEntryRoot.position.set(Math.round(footerLeft + footerCellGap * 4.5), footerY);
  }

  /** 图鉴入口：白色卡片底 + 草莓贴图（无贴图时落入 emoji 兜底） */
  private async loadHomeCatalogIcon(): Promise<void> {
    await TextureCache.load('home_catalog_icon', HOME_CATALOG_ICON_TEXTURE);
    for (let i = 0; i < this.homeFooterSlots.length; i += 1) {
      const slot = this.homeFooterSlots[i];
      if (!slot) {
        continue;
      }
      this.mountFooterNavButton(
        slot,
        'home_catalog_icon',
        () => {
          const e = new PIXI.Text('🍓', { fontSize: 70 });
          e.anchor.set(0.5);
          e.resolution = 2;
          return e;
        },
        '图鉴',
        0xa14a0d,
      );

      slot.hitArea = new PIXI.Rectangle(
        -HOME_FOOTER_NAV_CELL_W / 2,
        -HOME_FOOTER_NAV_CELL_H / 2,
        HOME_FOOTER_NAV_CELL_W,
        HOME_FOOTER_NAV_CELL_H,
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

    this.homeCoinBar.position.set(110, top + 28);
    this.container.addChild(this.homeCoinBar);

    /** 无顶栏木条：背景全屏 */
    const contentTop = top + 8;
    const bottomBarTop = H - 100;
    const btnW = 440;
    const btnH = 104;
    const fruitBtnW = btnW;
    const fruitBtnH = btnH;
    const fruitBtnR = 30;
    const playY = contentTop + Math.min(520, Math.max(410, (bottomBarTop - contentTop) * 0.31));
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
    this.playEntryRoot.addChild(this.playEntryTag);
    this.playEntryRoot.hitArea = new PIXI.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH);
    this.playEntryRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      void this.enterBowlWithLoading();
    });
    this.container.addChild(this.playEntryRoot);

    this.dailyLimitedEntryRoot.position.set(W / 2, playY + 108);
    this.dailyLimitedEntryRoot.eventMode = 'static';
    this.dailyLimitedEntryRoot.cursor = 'pointer';
    this.dailyLimitedEntryBg = new PIXI.Graphics();
    this.dailyLimitedEntryBg.beginFill(0x55c8ff);
    this.dailyLimitedEntryBg.lineStyle(4, 0x1f7fab, 1);
    this.dailyLimitedEntryBg.drawRoundedRect(-168, -44, 336, 88, 28);
    this.dailyLimitedEntryBg.endFill();
    this.dailyLimitedEntryRoot.addChild(this.dailyLimitedEntryBg);
    this.dailyLimitedEntryTitle = new PIXI.Text('每日限定', {
      fontSize: 36,
      fill: 0xfff4c2,
      fontWeight: '900',
      stroke: 0x235a7a,
      strokeThickness: 6,
      dropShadow: false,
      lineJoin: 'round',
    });
    this.dailyLimitedEntryTitle.anchor.set(0.5);
    this.dailyLimitedEntryTitle.resolution = 2;
    this.dailyLimitedEntryRoot.addChild(this.dailyLimitedEntryTitle);
    this.dailyLimitedEntryRoot.addChild(this.dailyLimitedEntryTag);
    this.dailyLimitedEntryRoot.hitArea = new PIXI.Rectangle(-176, -52, 352, 104);
    this.dailyLimitedEntryRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      void this.enterDailyLimitedWithLoading();
    });
    this.container.addChild(this.dailyLimitedEntryRoot);

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
    this.fruitSliceEntryRoot.addChild(this.fruitSliceEntryTag);
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

    this.container.addChild(this.footerNavBg);

    /** 底部入口：排行榜 / 扭蛋 / 福利 / 图鉴 / 设置，参考原型图统一放入底栏 */
    const bookSlot = new PIXI.Container();
    bookSlot.position.set(Math.round(W * 0.62), Math.max(playY + 220, H - 200));
    bookSlot.eventMode = 'static';
    bookSlot.cursor = 'pointer';
    bookSlot.hitArea = new PIXI.Rectangle(
      -HOME_FOOTER_NAV_CELL_W / 2,
      -HOME_FOOTER_NAV_CELL_H / 2,
      HOME_FOOTER_NAV_CELL_W,
      HOME_FOOTER_NAV_CELL_H,
    );
    this.mountFooterNavButton(
      bookSlot,
      'home_catalog_icon',
      () => {
        const e = new PIXI.Text('🍓', { fontSize: 70 });
        e.anchor.set(0.5);
        e.resolution = 2;
        return e;
      },
      '图鉴',
      0xa14a0d,
    );
    bookSlot.on('pointertap', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('catalog');
    });

    this.homeFooterSlots.push(bookSlot);
    this.container.addChild(bookSlot);

    this.gachaEntryRoot.position.set(Math.round(W * 0.5), Math.max(playY + 220, H - 200));
    this.gachaEntryRoot.eventMode = 'static';
    this.gachaEntryRoot.cursor = 'pointer';
    this.gachaEntryRoot.hitArea = new PIXI.Rectangle(
      -HOME_FOOTER_NAV_CELL_W / 2,
      -HOME_FOOTER_NAV_CELL_H / 2,
      HOME_FOOTER_NAV_CELL_W,
      HOME_FOOTER_NAV_CELL_H,
    );
    this.mountFooterNavButton(
      this.gachaEntryRoot,
      'home_gacha_icon',
      () => this.createGachaCardIcon(),
      '扭蛋',
      0xb94a12,
    );
    this.gachaEntryRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      void this.enterGachaWithLoading();
    });
    this.container.addChild(this.gachaEntryRoot);

    this.welfareEntryRoot.position.set(Math.round(W * 0.5), Math.max(playY + 220, H - 200));
    this.welfareEntryRoot.eventMode = 'static';
    this.welfareEntryRoot.cursor = 'pointer';
    this.welfareEntryRoot.hitArea = new PIXI.Rectangle(
      -HOME_FOOTER_NAV_CELL_W / 2,
      -HOME_FOOTER_NAV_CELL_H / 2,
      HOME_FOOTER_NAV_CELL_W,
      HOME_FOOTER_NAV_CELL_H,
    );
    this.mountFooterNavButton(
      this.welfareEntryRoot,
      'home_welfare_icon',
      () => this.createWelfareCardIcon(),
      '福利',
      0xc43a2f,
    );
    this.welfareEntryRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.gameClubWelfareOverlay.open();
    });
    this.container.addChild(this.welfareEntryRoot);

    this.leaderboardEntryRoot.position.set(Math.round(W * 0.38), Math.max(playY + 220, H - 200));
    this.leaderboardEntryRoot.eventMode = 'static';
    this.leaderboardEntryRoot.cursor = 'pointer';
    this.leaderboardEntryRoot.hitArea = new PIXI.Rectangle(
      -HOME_FOOTER_NAV_CELL_W / 2,
      -HOME_FOOTER_NAV_CELL_H / 2,
      HOME_FOOTER_NAV_CELL_W,
      HOME_FOOTER_NAV_CELL_H,
    );
    this.mountFooterNavButton(
      this.leaderboardEntryRoot,
      'home_leaderboard_icon',
      () => this.createLeaderboardCardIcon(),
      '排行榜',
      0x275f2d,
    );
    /** 只在玩家主动点排行榜时触发隐私授权；首页不预创建微信授权按钮。 */
    this.leaderboardEntryRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.gameClubWelfareOverlay.close();
      openLeaderboard(RANK_BOARD_BOWL);
    });
    this.container.addChild(this.leaderboardEntryRoot);

    this.settingsEntryRoot.position.set(Math.round(W * 0.76), Math.max(playY + 220, H - 200));
    this.settingsEntryRoot.eventMode = 'static';
    this.settingsEntryRoot.cursor = 'pointer';
    this.settingsEntryRoot.hitArea = new PIXI.Rectangle(
      -HOME_FOOTER_NAV_CELL_W / 2,
      -HOME_FOOTER_NAV_CELL_H / 2,
      HOME_FOOTER_NAV_CELL_W,
      HOME_FOOTER_NAV_CELL_H,
    );
    this.mountFooterNavButton(
      this.settingsEntryRoot,
      'home_settings_icon',
      () => this.createSettingsCardIcon(),
      '设置',
      0x6f4b28,
    );
    this.settingsEntryRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.gameClubWelfareOverlay.close();
      this.settingsOverlay.visible = true;
    });
    this.container.addChild(this.settingsEntryRoot);

    this.layoutHomeMainColumn();

    this.container.addChild(this.settingsOverlay, this.gameClubWelfareOverlay);
  }

  private async enterBowlWithLoading(): Promise<void> {
    if (this.enteringBowl) {
      return;
    }
    if (this.isAllBowlLevelsCleared()) {
      const api = typeof wx !== 'undefined' ? wx : null;
      api?.showToast?.({ title: '已通关，请期待后续关卡', icon: 'none' });
      return;
    }
    this.enteringBowl = true;
    this.gameClubWelfareOverlay.close();
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
    this.gameClubWelfareOverlay.close();
    const loadingOverlay = new LoadingOverlay(Game.logicWidth, Game.logicHeight, Game.safeTop);
    Game.stage.addChild(loadingOverlay.container);
    try {
      loadingOverlay.setProgress(0.16);
      await loadingOverlay.loadAssets();
      loadingOverlay.setProgress(0.46);
      await SceneManager.prepare('fruitSlice');
      loadingOverlay.setProgress(1);
      analytics.track('gameplay_mode_enter', {
        mode: 'fruit_slice',
        source: 'home',
        best_score: getFruitSliceBestScore(),
      });
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

  private async enterDailyLimitedWithLoading(): Promise<void> {
    if (this.enteringDailyLimited) {
      return;
    }
    this.enteringDailyLimited = true;
    this.gameClubWelfareOverlay.close();
    const loadingOverlay = new LoadingOverlay(Game.logicWidth, Game.logicHeight, Game.safeTop);
    Game.stage.addChild(loadingOverlay.container);
    try {
      loadingOverlay.setProgress(0.16);
      await loadingOverlay.loadAssets();
      loadingOverlay.setProgress(0.46);
      await SceneManager.prepare('dailyLimited');
      loadingOverlay.setProgress(1);
      const dailyLevel = getDailyLimitedLevelForDate();
      analytics.track('gameplay_mode_enter', {
        mode: 'daily_limited',
        source: 'home',
        level_id: dailyLevel.dayOfMonth,
        drink_name: dailyLevel.drinkName,
      });
      SceneManager.switchTo('dailyLimited');
    } catch (error) {
      console.error('[HomeScene] enter daily limited failed', error);
      const api = typeof wx !== 'undefined' ? wx : null;
      api?.showToast?.({ title: '加载失败，请重试', icon: 'none' });
    } finally {
      if (loadingOverlay.container.parent) {
        loadingOverlay.container.parent.removeChild(loadingOverlay.container);
      }
      loadingOverlay.destroy();
      this.enteringDailyLimited = false;
    }
  }

  private async enterGachaWithLoading(): Promise<void> {
    if (this.enteringGacha) {
      return;
    }
    this.enteringGacha = true;
    this.gameClubWelfareOverlay.close();
    const loadingOverlay = new LoadingOverlay(Game.logicWidth, Game.logicHeight, Game.safeTop);
    Game.stage.addChild(loadingOverlay.container);
    try {
      loadingOverlay.setProgress(0.16);
      await loadingOverlay.loadAssets();
      loadingOverlay.setProgress(0.46);
      await SceneManager.prepare('gacha');
      loadingOverlay.setProgress(1);
      SceneManager.switchTo('gacha');
    } catch (error) {
      console.error('[HomeScene] enter gacha failed', error);
      const api = typeof wx !== 'undefined' ? wx : null;
      api?.showToast?.({ title: '加载失败，请重试', icon: 'none' });
    } finally {
      if (loadingOverlay.container.parent) {
        loadingOverlay.container.parent.removeChild(loadingOverlay.container);
      }
      loadingOverlay.destroy();
      this.enteringGacha = false;
    }
  }

  /** 底部图标卡片的白色圆角背板（带阴影 + 卡片描边，所有底部入口共用） */
  private createFooterCardBackdrop(): PIXI.Container {
    // 占位层：底部入口现在共用一整条圆角底栏，单个入口不再绘制独立白卡。
    return new PIXI.Container();
  }

  /** 底部卡片下方居中的彩色标签文字 */
  private createFooterCardLabel(text: string, color: number): PIXI.Text {
    const label = new PIXI.Text(text, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 28,
      fill: color,
      fontWeight: '900',
      stroke: 0xfff4d8,
      strokeThickness: 5,
      lineJoin: 'round',
      letterSpacing: 1,
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    return label;
  }

  private mountFooterNavButton(
    root: PIXI.Container,
    textureKey: string,
    fallbackIcon: () => PIXI.Container,
    fallbackLabel: string,
    fallbackColor: number,
  ): void {
    destroyContainerChildren(root);
    root.addChild(this.createFooterCardBackdrop());

    const textureButton = this.createFooterCardTextureIcon(textureKey);
    if (textureButton) {
      textureButton.position.set(0, -30);
      root.addChild(textureButton);
    } else {
      const icon = fallbackIcon();
      icon.position.set(0, -30);
      root.addChild(icon);
    }

    const label = this.createFooterCardLabel(fallbackLabel, fallbackColor);
    label.position.set(0, 45);
    root.addChild(label);
  }

  private refreshGeneratedFooterIcons(): void {
    this.mountFooterNavButton(
      this.gachaEntryRoot,
      'home_gacha_icon',
      () => this.createGachaCardIcon(),
      '扭蛋',
      0xb94a12,
    );
    this.mountFooterNavButton(
      this.welfareEntryRoot,
      'home_welfare_icon',
      () => this.createWelfareCardIcon(),
      '福利',
      0xc43a2f,
    );
    this.mountFooterNavButton(
      this.leaderboardEntryRoot,
      'home_leaderboard_icon',
      () => this.createLeaderboardCardIcon(),
      '排行榜',
      0x275f2d,
    );
    this.mountFooterNavButton(
      this.settingsEntryRoot,
      'home_settings_icon',
      () => this.createSettingsCardIcon(),
      '设置',
      0x6f4b28,
    );
  }

  /** 福利入口图标：礼盒 + 金币，保持无需贴图即可显示。 */
  private createWelfareCardIcon(): PIXI.Container {
    const icon = this.createFooterCardTextureIcon('home_welfare_icon');
    if (icon) {
      return icon;
    }

    const root = new PIXI.Container();
    const base = new PIXI.Graphics();
    base.beginFill(0xffd86a, 0.45);
    base.drawRoundedRect(-46, 30, 92, 12, 6);
    base.endFill();
    root.addChild(base);

    const box = new PIXI.Graphics();
    box.beginFill(0xf04b4b);
    box.lineStyle(4, 0x8f2a2a, 1);
    box.drawRoundedRect(-34, -18, 68, 54, 12);
    box.endFill();
    box.beginFill(0xffd34d);
    box.drawRoundedRect(-34, -4, 68, 10, 4);
    box.endFill();
    box.beginFill(0xffd34d);
    box.drawRoundedRect(-8, -28, 16, 64, 6);
    box.endFill();
    root.addChild(box);

    const coin = new PIXI.Graphics();
    coin.beginFill(0xffd34d);
    coin.lineStyle(3, 0xc47a10, 1);
    coin.drawCircle(28, 8, 18);
    coin.endFill();
    root.addChild(coin);

    const sparkle = new PIXI.Graphics();
    sparkle.beginFill(0xffffff);
    this.drawTinyStar(sparkle, -28, -34, 5, 8, 3);
    sparkle.endFill();
    root.addChild(sparkle);
    return root;
  }

  /** 扭蛋入口图标：金币和胶囊球，保持无需贴图即可显示。 */
  private createGachaCardIcon(): PIXI.Container {
    const icon = this.createFooterCardTextureIcon('home_gacha_icon');
    if (icon) {
      return icon;
    }

    const root = new PIXI.Container();
    const base = new PIXI.Graphics();
    base.beginFill(0xffd86a, 0.45);
    base.drawRoundedRect(-46, 30, 92, 12, 6);
    base.endFill();
    root.addChild(base);

    const coin = new PIXI.Graphics();
    coin.beginFill(0xffd34d);
    coin.lineStyle(4, 0xc47a10, 1);
    coin.drawCircle(-24, -2, 32);
    coin.endFill();
    coin.beginFill(0xfff1a8);
    coin.drawCircle(-24, -2, 20);
    coin.endFill();
    root.addChild(coin);

    const capsule = new PIXI.Graphics();
    capsule.lineStyle(4, 0xffffff, 0.9);
    capsule.beginFill(0xff6f8a);
    capsule.drawRoundedRect(-4, -36, 58, 70, 28);
    capsule.endFill();
    capsule.beginFill(0x86d9ff);
    capsule.drawRoundedRect(-4, -2, 58, 36, 18);
    capsule.endFill();
    root.addChild(capsule);

    const sparkle = new PIXI.Graphics();
    sparkle.beginFill(0xffffff);
    this.drawTinyStar(sparkle, 30, -44, 5, 10, 4);
    this.drawTinyStar(sparkle, -52, -34, 5, 7, 3);
    sparkle.endFill();
    root.addChild(sparkle);
    return this.withGachaPromoTag(root);
  }

  private withGachaPromoTag(icon: PIXI.Container): PIXI.Container {
    const root = new PIXI.Container();
    root.addChild(icon);
    const tag = new PIXI.Container();
    tag.position.set(-46, -50);

    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x4d2b16, 0.16);
    shadow.drawRoundedRect(-45, -16, 90, 32, 13);
    shadow.endFill();
    shadow.position.set(2, 3);
    tag.addChild(shadow);

    const bg = new PIXI.Graphics();
    bg.beginFill(0xffef9a, 1);
    bg.lineStyle(3, 0xd0641a, 1);
    bg.drawRoundedRect(-45, -16, 90, 32, 13);
    bg.endFill();
    tag.addChild(bg);

    const label = new PIXI.Text('金币抽奖', {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 18,
      fill: 0xb94a12,
      fontWeight: '900',
      stroke: 0xffffff,
      strokeThickness: 3,
      lineJoin: 'round',
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    tag.addChild(label);

    root.addChild(tag);
    return root;
  }

  /** 设置入口图标：优先复用现有齿轮贴图。 */
  private createSettingsCardIcon(): PIXI.Container {
    const icon = this.createFooterCardTextureIcon('home_settings_icon');
    if (icon) {
      return icon;
    }

    const root = new PIXI.Container();
    const gear = new PIXI.Graphics();
    gear.beginFill(0xf2bf66);
    gear.lineStyle(4, 0x6f4b28, 1);
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8;
      const x = Math.cos(a) * 34;
      const y = Math.sin(a) * 34;
      gear.drawRoundedRect(x - 8, y - 8, 16, 16, 4);
    }
    gear.drawCircle(0, 0, 34);
    gear.endFill();
    gear.beginFill(0xfff7df);
    gear.drawCircle(0, 0, 13);
    gear.endFill();
    root.addChild(gear);
    return root;
  }

  /** 排行榜卡片图标：绿色柱状图 + 顶部金色奖杯小角标 */
  private createLeaderboardCardIcon(): PIXI.Container {
    const icon = this.createFooterCardTextureIcon('home_leaderboard_icon');
    if (icon) {
      return icon;
    }

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

  private createFooterCardTextureIcon(textureKey: string): PIXI.Container | null {
    const tex = TextureCache.get(textureKey);
    if (!tex) {
      return null;
    }
    const root = new PIXI.Container();
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    const target = homeCatalogIconDisplayTarget();
    const sc = Math.min(
      target / Math.max(tex.width, tex.height),
      (HOME_FOOTER_NAV_CELL_W - 8) / tex.width,
      (HOME_FOOTER_NAV_CELL_H - 8) / tex.height,
    );
    sp.scale.set(sc);
    root.addChild(sp);
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
