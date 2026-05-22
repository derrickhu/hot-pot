import * as PIXI from 'pixi.js';
import {
  DAILY_LIMITED_LEVELS,
  DAILY_LIMITED_MIN_STACK_CARDS,
  getDailyLimitedLevelForDate,
  getDailyLimitedPlayableFruitIds,
  getDailyLimitedTargetCount,
  getDailyLimitedTargetFruitIds,
  type DailyThemeLevelDef,
} from '@/config/dailyLimitedLevels';
import { FRUIT_MAP, type FruitId } from '@/config/fruits';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import { Haptics } from '@/core/Haptics';
import { PersistService } from '@/core/PersistService';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { analytics } from '@/analytics';
import { addCoins, spendCoins } from '@/game/Wallet';
import { CoinBar, COIN_ICON_TEXTURE_KEY, COIN_ICON_TEXTURE_PATH, createCoinIcon } from '@/gameobjects/CoinBar';
import { BOWL_COMMON_MODAL_PANEL_ASSET, BOWL_COMMON_MODAL_PANEL_TEXTURE_KEY } from '@/gameobjects/BowlMechanicIntroOverlay';
import { loadBowlSubpackage } from '@/utils/loadBowlSubpackage';
import { showRewardedAd, warmupRewardedAd } from '@/utils/rewardedAd';
import { TextureCache } from '@/utils/TextureCache';
import { shareGame } from '@/utils/wechatShare';
import { isWxDevtoolsSimulator } from '@/utils/wxMinigameEnv';

type DailyToolKind = 'shuffle' | 'undo' | 'lift';
type CardZone = 'stack' | 'lift';
type DailyLimitedEndReason = 'complete' | 'buffer_full' | 'back_home' | 'gm_complete';

interface CardState {
  id: string;
  fruitId: FruitId;
  columnIndex: number;
  depthIndex: number;
  zone: CardZone;
  removed: boolean;
}

interface ClickHistoryEntry {
  cardId: string;
  prevCollected: number;
  prevCollectedByFruit: Partial<Record<FruitId, number>>;
  prevBuffer: FruitId[];
}

interface ToolButtonView {
  root: PIXI.Container;
  bg?: PIXI.Graphics;
  kind: DailyToolKind;
}

interface DailyLimitedRewardState {
  claimedRecipeDateByTheme: Record<string, string>;
}

interface DailyLimitedRuleIntroState {
  seenDateByTheme: Record<string, string>;
}

interface DailyBowlSlot {
  fruitId: FruitId;
  start: number;
  capacity: number;
}

interface IceBowlSlotView {
  root: PIXI.Container;
  fruitsLayer: PIXI.Container;
  countText: PIXI.Text;
  signature: string;
}

const CARD_COLS = 9;
const CARD_W = 70;
const CARD_H = 76;
const CARD_GAP = 8;
const STACK_STEP_Y = 17;
const FLAT_COLS = 9;
const FLAT_ROWS = 3;
const FLAT_CARD_COUNT = FLAT_COLS * FLAT_ROWS;
const ICE_BOWL_COUNT = 5;
const ICE_BOWL_CAPACITY = 3;
const DAILY_LIMITED_CLEAR_REWARD_COINS = 50;
const DAILY_LIMITED_REPEAT_CLEAR_REWARD_COINS = 5;
const DAILY_LIMITED_TOOL_COIN_COST = 10;
const DAILY_LIMITED_REWARD_STATE_KEY = 'hot_pot_daily_limited_reward_v1';
const DAILY_LIMITED_RULE_INTRO_STATE_KEY = 'hot_pot_daily_limited_rule_intro_v1';
const DAILY_TEXTURE_PREFIX = 'daily_limited_fruit_';
const DAILY_BG_VARIANTS = [
  {
    key: 'daily_limited_bg_meadow_picnic',
    path: 'subpackages/bowl_game/assets/images/daily_limited/bg_meadow_picnic_v2.png',
  },
  {
    key: 'daily_limited_bg_tropical_orchard',
    path: 'subpackages/bowl_game/assets/images/daily_limited/bg_tropical_orchard_v2.png',
  },
  {
    key: 'daily_limited_bg_bright_sunny_meadow',
    path: 'subpackages/bowl_game/assets/images/daily_limited/daily_limited_bg_bright_sunny_meadow_v1.jpg',
  },
  {
    key: 'daily_limited_bg_bright_candy_creek',
    path: 'subpackages/bowl_game/assets/images/daily_limited/daily_limited_bg_bright_candy_creek_v1.jpg',
  },
] as const;
const DAILY_BOARD_FRAME_VARIANTS = [
  {
    key: 'daily_limited_frame_wood_material',
    path: 'subpackages/bowl_game/assets/images/daily_limited/frame_wood_material_v4.png',
  },
  {
    key: 'daily_limited_frame_ice_glass_material',
    path: 'subpackages/bowl_game/assets/images/daily_limited/frame_ice_glass_material_v4.png',
  },
] as const;
const DAILY_ICE_BOWL_TEXTURE_KEY = 'daily_limited_ice_bowl_with_ice';
const DAILY_ICE_BOWL_PATH = 'subpackages/bowl_game/assets/images/daily_limited/ice_bowl_with_ice_v1.png';
const DAILY_LIMITED_REWARDED_AD_UNIT_ID = 'adunit-bf1f15914de547fc';
const DAILY_BACK_BUTTON_TEXTURE_KEY = 'daily_limited_back_button';
const DAILY_BACK_BUTTON_PATH = 'subpackages/bowl_game/assets/images/fruit_slice/back_button.png';
const DAILY_TOOL_BUTTONS_TEXTURE_KEY = 'daily_limited_tool_buttons_sheet';
const DAILY_TOOL_BUTTONS_PATH = 'subpackages/bowl_game/assets/images/daily_limited/tool_buttons_sheet_v1.png';
const DAILY_TOOL_PANELS_TEXTURE_KEY = 'daily_limited_tool_panels_sheet';
const DAILY_TOOL_PANELS_PATH = 'subpackages/bowl_game/assets/images/daily_limited/tool_panels_sheet_v1.png';
const DAILY_CLEAR_BANNER_TEXTURE_KEY = 'daily_limited_clear_banner';
const DAILY_CLEAR_BANNER_PATH = 'subpackages/bowl_game/assets/images/daily_limited/daily_limited_clear_banner_v1.png';
const DAILY_SHARE_BUTTON_TEXTURE_KEY = 'daily_limited_badge_share_reward_button';
const DAILY_SHARE_BUTTON_PATH = 'subpackages/bowl_game/assets/images/badge_share_reward_button.png';
const DAILY_TOOL_KINDS: readonly DailyToolKind[] = ['shuffle', 'undo', 'lift'];
const DAILY_TARGET_ENCOURAGEMENTS = [
  '赞',
  '太棒了',
  '完美',
  '果茶制作中',
  '清爽+1',
  '健康+1',
  '凉爽翻倍',
  '活力+1',
  '维C+1',
  '冰凉翻倍',
  '能量+1',
  '继续加油',
] as const;

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const next = items.slice();
  const random = seededRandom(seed);
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function textureKey(fruitId: FruitId): string {
  return `${DAILY_TEXTURE_PREFIX}${fruitId}`;
}

function getLocalDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickDailyVariant<T>(variants: readonly T[], scope: string, themeId: string): T {
  const seed = hashString(`${getLocalDayKey()}|${themeId}|${scope}`);
  return variants[seed % variants.length];
}

function destroyContainerChildren(container: PIXI.Container): void {
  const children = container.removeChildren();
  children.forEach((child) => child.destroy({ children: true }));
}

export class DailyLimitedScene implements Scene {
  readonly name = 'dailyLimited';
  readonly container = new PIXI.Container();

  private level: DailyThemeLevelDef = getDailyLimitedLevelForDate();
  private dailyBackground = pickDailyVariant(DAILY_BG_VARIANTS, 'background', this.level.themeId);
  private dailyBoardFrame = pickDailyVariant(DAILY_BOARD_FRAME_VARIANTS, 'board-frame', this.level.themeId);
  private readonly bgLayer = new PIXI.Container();
  private readonly boardFrameLayer = new PIXI.Container();
  private readonly cardLayer = new PIXI.Container();
  private readonly liftLayer = new PIXI.Container();
  private readonly iceBowlLayer = new PIXI.Container();
  private readonly bufferLayer = new PIXI.Container();
  private readonly toolLayer = new PIXI.Container();
  // 卡片飞向冰碗 / 暂存栏的飞行层。位于游戏内容之上、模态层之下，保证不被
  // overlayLayer 的清理动作误销毁；自身只承载短暂存在的 sprite。
  private readonly flyingLayer = new PIXI.Container();
  private readonly overlayLayer = new PIXI.Container();
  private readonly backButtonSprite = new PIXI.Sprite();
  private readonly coinBar = new CoinBar();
  private readonly titleText = new PIXI.Text('', {
    fontSize: 44,
    fill: 0xfff3b1,
    fontWeight: '900',
    stroke: 0x235a7a,
    strokeThickness: 7,
    lineJoin: 'round',
  });
  private readonly hintText = new PIXI.Text('', {
    fontSize: 24,
    fill: 0x5d3a1a,
    fontWeight: '700',
    align: 'center',
    wordWrap: true,
    wordWrapWidth: Game.logicWidth - 80,
  });
  private readonly toolViews = new Map<DailyToolKind, ToolButtonView>();
  private readonly cards: CardState[] = [];
  private readonly buffer: FruitId[] = [];
  private readonly history: ClickHistoryEntry[] = [];
  // 增量渲染缓存：仅 destroy/重建发生变化的卡片视图，避免每次点击全量重建。
  private readonly mountedStackCardViews = new Map<string, { view: PIXI.Container; key: string }>();
  private readonly mountedLiftCardViews = new Map<string, { view: PIXI.Container; key: string }>();
  // Buffer 静态外框 + 槽位框只画一次，动态内容（水果图标 / 解锁槽）单独管理。
  private bufferStaticView: PIXI.Container | null = null;
  private bufferStaticSignature = '';
  private bufferDynamicLayer: PIXI.Container | null = null;
  private readonly mountedBufferContents = new Map<number, { view: PIXI.Container; key: string }>();
  // 冰碗：碗体（精灵 + 计数图标）保持常驻，水果与计数文字按需更新。
  private readonly iceBowlViews = new Map<number, IceBowlSlotView>();
  private iceBowlsSignature = '';
  // O(1) 目标水果判定，避免 isTargetFruit 每次重新分配数组。
  private targetFruitSet: ReadonlySet<FruitId> = new Set();
  // 列顶卡片缓存，避免每张卡渲染都扫描整个 cards 数组。
  private readonly topStackIdByColumn: Array<string | null> = new Array(CARD_COLS).fill(null);
  // 卡片飞行动画期间，目标位置（暂存槽 / 冰碗）暂时隐藏静态图标，
  // 等飞入 sprite 落位后再露出。计数允许并行点击叠加。
  private readonly bufferIncomingHidden = new Map<number, number>();
  private readonly bowlIncomingHidden = new Map<number, number>();
  // 暂存栏满时的"红色警报"状态：3 声 stinger + 红色光晕呼吸。
  private bufferPanicLayer: PIXI.Container | null = null;
  private bufferPanicTicker: (() => void) | null = null;
  private bufferPanicElapsedMs = 0;
  private bufferPanicSfxPlayed = 0;
  private bufferPanicNextSfxAtMs = 0;
  private toolCounts: Record<DailyToolKind, number> = { shuffle: 0, undo: 0, lift: 0 };
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;
  private collected = 0;
  private collectedByFruit: Partial<Record<FruitId, number>> = {};
  private roundStarted = false;
  private roundEnded = false;
  private clearRewardGranted = false;
  private lastClearRewardCoins = DAILY_LIMITED_CLEAR_REWARD_COINS;
  private lastClearRewardWasFirstToday = true;
  private bufferMatchResolving = false;
  private animatingBufferMatchIndexes: readonly number[] = [];
  private extraBufferSlotUnlocked = false;
  private unlockBufferAdBusy = false;
  private toolRewardedAdBusy = false;
  private nextLiftCardId = 1;
  private bufferMatchTimer: ReturnType<typeof window.setTimeout> | null = null;
  private roundStartTs = 0;
  private cardClicksThisRound = 0;
  private targetHitsThisRound = 0;
  private bufferAddsThisRound = 0;
  private maxBufferSizeThisRound = 0;
  private toolUsesThisRound: Record<DailyToolKind, number> = { shuffle: 0, undo: 0, lift: 0 };
  // 目标卡片的 hint glow 集合：让 ticker 只调一次 alpha 流转，不再修改卡片
  // 本身的 scale / y。
  // 历史教训：hint 不能修改 root.y 或 scale —— stack 区是 17px 步进堆叠，
  // 上下浮动或缩放（即便 1~2px）都会让相邻列"露出条"高度看起来不一致
  // （洗牌后多列同时是目标卡时尤其明显）。改为只让卡片内部的发光圈
  // alpha 微微脉动，卡片本体位置 / 大小完全不变。
  private readonly targetHintRoots = new Set<{ glow: PIXI.Graphics; phase: number }>();
  private targetHintMasterTicker: (() => void) | null = null;
  private readonly transientTickers = new Set<() => void>();
  private readonly loadedTextureKeys = new Set<string>();
  private enterToken = 0;
  private roundDealSeed = 0;

  constructor() {
    this.buildStaticUi();
  }

  async prepare(): Promise<void> {
    if (this.loaded) {
      return;
    }
    if (!this.loadingPromise) {
      this.loadingPromise = this.preloadAssets();
    }
    await this.loadingPromise;
  }

  onEnter(): void {
    const token = this.enterToken + 1;
    this.enterToken = token;
    warmupRewardedAd(DAILY_LIMITED_REWARDED_AD_UNIT_ID);
    void this.syncLevelForToday().then(() => this.prepare()).then(() => {
      if (token !== this.enterToken || !this.container.parent) {
        this.releaseSceneTextures();
        return;
      }
      // CoinBar 是通用组件，但每个 Scene 持有自己的实例；每日限定场景实例
      // 会长期保留，进入时必须重新从 Wallet 读取，否则会显示上次进入时的旧数。
      this.coinBar.refreshIcon();
      this.coinBar.refresh();
      this.applyBackground();
      this.renderMainBoardFrame();
      if (!this.roundStarted || this.roundEnded) {
        this.startRound();
      } else {
        this.renderAll();
      }
      this.showDailyRuleIntroIfNeeded();
    });
  }

  onExit(): void {
    this.enterToken += 1;
    this.exitBufferPanic();
    this.stopTransientAnimations();
    destroyContainerChildren(this.cardLayer);
    destroyContainerChildren(this.liftLayer);
    destroyContainerChildren(this.iceBowlLayer);
    destroyContainerChildren(this.bufferLayer);
    destroyContainerChildren(this.toolLayer);
    destroyContainerChildren(this.flyingLayer);
    destroyContainerChildren(this.overlayLayer);
    this.toolViews.clear();
    this.bufferIncomingHidden.clear();
    this.bowlIncomingHidden.clear();
    this.clearAllRenderCaches();
    this.backButtonSprite.texture = PIXI.Texture.EMPTY;
    this.releaseSceneTextures();
  }

  private stopTransientAnimations(): void {
    if (this.bufferMatchTimer !== null) {
      window.clearTimeout(this.bufferMatchTimer);
      this.bufferMatchTimer = null;
    }
    if (this.targetHintMasterTicker) {
      PIXI.Ticker.shared.remove(this.targetHintMasterTicker);
      this.targetHintMasterTicker = null;
    }
    this.targetHintRoots.clear();
    this.transientTickers.forEach((tick) => PIXI.Ticker.shared.remove(tick));
    this.transientTickers.clear();
    this.animatingBufferMatchIndexes = [];
    this.bufferMatchResolving = false;
  }

  private addTransientTicker(tick: () => void): void {
    this.transientTickers.add(tick);
    PIXI.Ticker.shared.add(tick);
  }

  private removeTransientTicker(tick: () => void): void {
    PIXI.Ticker.shared.remove(tick);
    this.transientTickers.delete(tick);
  }

  private async loadSceneTexture(key: string, path: string): Promise<PIXI.Texture | null> {
    const texture = await TextureCache.load(key, path);
    if (texture) {
      this.loadedTextureKeys.add(key);
    }
    return texture;
  }

  private releaseSceneTextures(): void {
    TextureCache.unloadMany(this.loadedTextureKeys);
    this.loadedTextureKeys.clear();
    this.loaded = false;
    this.loadingPromise = null;
  }

  private async syncLevelForToday(): Promise<void> {
    const todayLevel = getDailyLimitedLevelForDate();
    if (todayLevel.themeId === this.level.themeId) {
      return;
    }

    this.level = todayLevel;
    this.roundStarted = false;
    this.roundEnded = false;
    // 跨主题切换时清掉缓存的目标集合，下次 refreshGameStateCaches 会重建。
    this.targetFruitSet = new Set();
    destroyContainerChildren(this.overlayLayer);
    this.titleText.text = todayLevel.themeName;
    this.hintText.text = todayLevel.positioningText;

    if (this.loaded) {
      await this.loadThemeAssets(todayLevel);
      this.applyBackground();
      this.renderMainBoardFrame();
    } else {
      this.dailyBackground = pickDailyVariant(DAILY_BG_VARIANTS, 'background', todayLevel.themeId);
      this.dailyBoardFrame = pickDailyVariant(DAILY_BOARD_FRAME_VARIANTS, 'board-frame', todayLevel.themeId);
    }
  }

  private async preloadAssets(): Promise<void> {
    await loadBowlSubpackage();
    await Promise.all([
      this.loadSceneTexture(this.dailyBackground.key, this.dailyBackground.path),
      this.loadSceneTexture(this.dailyBoardFrame.key, this.dailyBoardFrame.path),
      this.loadSceneTexture(DAILY_ICE_BOWL_TEXTURE_KEY, DAILY_ICE_BOWL_PATH),
      this.loadSceneTexture(DAILY_BACK_BUTTON_TEXTURE_KEY, DAILY_BACK_BUTTON_PATH),
      this.loadSceneTexture(DAILY_TOOL_BUTTONS_TEXTURE_KEY, DAILY_TOOL_BUTTONS_PATH),
      this.loadSceneTexture(DAILY_TOOL_PANELS_TEXTURE_KEY, DAILY_TOOL_PANELS_PATH),
      this.loadSceneTexture(this.level.recipeCard.textureKey, this.level.recipeCard.path),
      this.loadSceneTexture(DAILY_CLEAR_BANNER_TEXTURE_KEY, DAILY_CLEAR_BANNER_PATH),
      this.loadSceneTexture(DAILY_SHARE_BUTTON_TEXTURE_KEY, DAILY_SHARE_BUTTON_PATH),
      TextureCache.load(BOWL_COMMON_MODAL_PANEL_TEXTURE_KEY, BOWL_COMMON_MODAL_PANEL_ASSET),
      TextureCache.load(COIN_ICON_TEXTURE_KEY, COIN_ICON_TEXTURE_PATH),
      ...getDailyLimitedPlayableFruitIds(this.level).map((fruitId) => {
        const fruit = FRUIT_MAP[fruitId];
        return this.loadSceneTexture(textureKey(fruitId), fruit.asset);
      }),
    ]);
    this.loaded = true;
    this.applyBackground();
    this.renderMainBoardFrame();
    this.applyBackButtonTexture();
    this.coinBar.refreshIcon();
    this.mountToolButtons();
  }

  private async loadThemeAssets(level: DailyThemeLevelDef): Promise<void> {
    this.dailyBackground = pickDailyVariant(DAILY_BG_VARIANTS, 'background', level.themeId);
    this.dailyBoardFrame = pickDailyVariant(DAILY_BOARD_FRAME_VARIANTS, 'board-frame', level.themeId);
    await Promise.all([
      this.loadSceneTexture(this.dailyBackground.key, this.dailyBackground.path),
      this.loadSceneTexture(this.dailyBoardFrame.key, this.dailyBoardFrame.path),
      this.loadSceneTexture(level.recipeCard.textureKey, level.recipeCard.path),
      ...getDailyLimitedPlayableFruitIds(level).map((fruitId) => this.loadSceneTexture(textureKey(fruitId), FRUIT_MAP[fruitId].asset)),
    ]);
  }

  private async switchThemeByGm(level: DailyThemeLevelDef): Promise<void> {
    this.level = level;
    await this.loadThemeAssets(level);
    this.titleText.text = level.themeName;
    this.hintText.text = level.positioningText;
    this.applyBackground();
    this.renderMainBoardFrame();
    destroyContainerChildren(this.overlayLayer);
    this.startRound();
  }

  private readDailyRuleIntroState(): DailyLimitedRuleIntroState {
    const stored = PersistService.readJSON<Partial<DailyLimitedRuleIntroState>>(DAILY_LIMITED_RULE_INTRO_STATE_KEY);
    return {
      seenDateByTheme: {
        ...(stored?.seenDateByTheme ?? {}),
      },
    };
  }

  private writeDailyRuleIntroState(state: DailyLimitedRuleIntroState): void {
    PersistService.writeJSON(DAILY_LIMITED_RULE_INTRO_STATE_KEY, {
      seenDateByTheme: { ...state.seenDateByTheme },
    });
  }

  private hasSeenDailyRuleIntroToday(): boolean {
    const state = this.readDailyRuleIntroState();
    return state.seenDateByTheme[this.level.themeId] === getLocalDayKey();
  }

  private markDailyRuleIntroSeenToday(): void {
    const state = this.readDailyRuleIntroState();
    state.seenDateByTheme[this.level.themeId] = getLocalDayKey();
    this.writeDailyRuleIntroState(state);
  }

  private buildStaticUi(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const top = Game.safeTop;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xb7edff);
    bg.drawRect(0, 0, W, H);
    bg.endFill();
    bg.beginFill(0x7ed957, 0.55);
    bg.drawEllipse(W * 0.5, H + 120, W * 0.75, H * 0.42);
    bg.endFill();
    this.bgLayer.addChild(bg);
    this.container.addChild(this.bgLayer);

    this.backButtonSprite.anchor.set(0.5);
    this.backButtonSprite.eventMode = 'static';
    this.backButtonSprite.cursor = 'pointer';
    this.layoutBackButton();
    this.backButtonSprite.on('pointertap', () => {
      AudioManager.playButtonSound();
      if (this.roundStarted && !this.roundEnded) {
        this.trackDailyLimitedEnd(false, 'back_home');
      }
      SceneManager.switchTo('home');
    });
    this.container.addChild(this.backButtonSprite);

    this.coinBar.position.set(110, top + 28);
    this.container.addChild(this.coinBar);
    this.coinBar.refresh();

    if (isWxDevtoolsSimulator()) {
      const gmClear = this.createPillButton('GM测试', 132, 48, 0xff7f50, 0x9d3b20);
      gmClear.position.set(W - 94, top + 104);
      gmClear.on('pointertap', () => {
        AudioManager.playButtonSound();
        this.showGmPanel();
      });
      this.container.addChild(gmClear);
    }

    this.titleText.text = this.level.themeName;
    this.titleText.anchor.set(0.5);
    this.titleText.resolution = 2;
    this.titleText.position.set(W / 2, top + 72);
    this.container.addChild(this.titleText);

    this.hintText.text = this.level.positioningText;
    this.hintText.anchor.set(0.5);
    this.hintText.resolution = 2;
    this.hintText.position.set(W / 2, top + 122);
    this.container.addChild(this.hintText);

    const boardTop = this.boardTop();
    const boardH = this.boardHeight();
    this.container.addChild(this.boardFrameLayer);
    this.renderMainBoardFrame();

    this.container.addChild(this.cardLayer);
    this.container.addChild(this.iceBowlLayer);
    this.container.addChild(this.liftLayer);
    this.container.addChild(this.bufferLayer);
    this.container.addChild(this.toolLayer);
    this.flyingLayer.eventMode = 'none';
    this.container.addChild(this.flyingLayer);
    this.container.addChild(this.overlayLayer);

    this.mountToolButtons();
  }

  private applyBackground(): void {
    const tex = TextureCache.get(this.dailyBackground.key);
    if (!tex) {
      return;
    }

    const W = Game.logicWidth;
    const H = Game.logicHeight;
    destroyContainerChildren(this.bgLayer);
    const sp = new PIXI.Sprite(tex);
    const scale = Math.max(W / tex.width, H / tex.height);
    sp.scale.set(scale);
    sp.position.set((W - tex.width * scale) / 2, (H - tex.height * scale) / 2);
    this.bgLayer.addChild(sp);
  }

  private applyBackButtonTexture(): void {
    const tex = TextureCache.get(DAILY_BACK_BUTTON_TEXTURE_KEY);
    if (!tex) {
      return;
    }
    this.backButtonSprite.texture = tex;
    this.layoutBackButton();
  }

  private layoutBackButton(): void {
    const tex = this.backButtonSprite.texture;
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return;
    }
    const target = 54;
    const scale = target / Math.max(1, Math.max(tex.width, tex.height));
    this.backButtonSprite.scale.set(scale);
    this.backButtonSprite.position.set(58, Game.safeTop + 28);
    this.backButtonSprite.hitArea = new PIXI.Circle(0, 0, 38 / Math.max(0.01, scale));
  }

  private renderMainBoardFrame(): void {
    destroyContainerChildren(this.boardFrameLayer);
    const frame = this.createBoardFrameView(-2, this.boardTop() - 4, Game.logicWidth + 4, this.boardHeight() + 8);
    this.boardFrameLayer.addChild(frame);
  }

  private createBoardFrameView(x: number, y: number, width: number, height: number): PIXI.DisplayObject {
    const tex = TextureCache.get(this.dailyBoardFrame.key);
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.position.set(x, y);
      sp.width = width;
      sp.height = height;
      return sp;
    }

    const board = new PIXI.Graphics();
    board.beginFill(0x83dd5f);
    board.lineStyle(8, 0x3ea43f, 1);
    board.drawRoundedRect(x, y, width, height, 28);
    board.endFill();
    board.beginFill(0xf6ffe6, 0.88);
    board.lineStyle(3, 0x4d8f34, 0.9);
    board.drawRoundedRect(x + 18, y + 24, width - 36, height - 48, 18);
    board.endFill();
    return board;
  }

  private startRound(): void {
    this.roundStarted = true;
    this.roundEnded = false;
    this.clearRewardGranted = false;
    this.lastClearRewardCoins = DAILY_LIMITED_CLEAR_REWARD_COINS;
    this.lastClearRewardWasFirstToday = true;
    this.collected = 0;
    this.collectedByFruit = {};
    this.nextLiftCardId = 1;
    this.bufferMatchResolving = false;
    this.animatingBufferMatchIndexes = [];
    this.extraBufferSlotUnlocked = false;
    this.unlockBufferAdBusy = false;
    this.toolRewardedAdBusy = false;
    this.roundStartTs = Date.now();
    this.cardClicksThisRound = 0;
    this.targetHitsThisRound = 0;
    this.bufferAddsThisRound = 0;
    this.maxBufferSizeThisRound = 0;
    this.toolUsesThisRound = { shuffle: 0, undo: 0, lift: 0 };
    this.cards.length = 0;
    this.buffer.length = 0;
    this.history.length = 0;
    this.roundDealSeed = hashString(`${this.level.themeId}|${Date.now()}|${Math.random()}`);
    destroyContainerChildren(this.overlayLayer);
    // 一局开始时彻底清掉旧视图，确保增量渲染缓存与场景层一致。
    this.exitBufferPanic();
    destroyContainerChildren(this.cardLayer);
    destroyContainerChildren(this.liftLayer);
    destroyContainerChildren(this.bufferLayer);
    destroyContainerChildren(this.iceBowlLayer);
    destroyContainerChildren(this.flyingLayer);
    this.bufferIncomingHidden.clear();
    this.bowlIncomingHidden.clear();
    this.clearAllRenderCaches();
    this.toolCounts = {
      shuffle: this.level.toolCounts.shuffle,
      undo: this.level.toolCounts.undo,
      lift: this.level.toolCounts.lift,
    };

    const deal = this.generateCardDeal();
    const allCards = [
      ...deal.flat.map((fruitId) => ({ fruitId, zone: 'lift' as const })),
      ...deal.stack.map((fruitId) => ({ fruitId, zone: 'stack' as const })),
    ];
    allCards.forEach((entry, index) => {
      const isFlatCard = entry.zone === 'lift';
      const localIndex = isFlatCard ? index : index - deal.flat.length;
      const cols = isFlatCard ? FLAT_COLS : CARD_COLS;
      const columnIndex = localIndex % cols;
      const depthIndex = Math.floor(localIndex / cols);
      this.cards.push({
        id: `${isFlatCard ? 'flat' : 'stack'}_${index}`,
        fruitId: entry.fruitId,
        columnIndex,
        depthIndex,
        zone: entry.zone,
        removed: false,
      });
    });

    this.renderAll();
    analytics.track('daily_limited_start', {
      mode: 'daily_limited',
      level_id: this.level.dayOfMonth,
      theme_id: this.level.themeId,
      drink_name: this.level.drinkName,
      target_count: this.targetCount(),
      buffer_size: this.activeBufferSize(),
    });
  }

  private generateCardDeal(): { flat: FruitId[]; stack: FruitId[] } {
    const targetSet = new Set<FruitId>(this.targetFruitIds());
    const playableFruitIds = getDailyLimitedPlayableFruitIds(this.level);
    const distractors = playableFruitIds.filter((fruitId) => !targetSet.has(fruitId));
    const flatPool: FruitId[] = [];
    const stackCards: FruitId[] = [];

    for (const target of this.level.targets) {
      for (let i = 0; i < target.cardCopies; i += 1) {
        stackCards.push(target.fruitId);
      }
    }

    for (const fruitId of distractors) {
      flatPool.push(fruitId, fruitId, fruitId);
    }

    const minStackCards = Math.max(
      DAILY_LIMITED_MIN_STACK_CARDS,
      stackCards.length,
      this.level.totalStackCards ?? DAILY_LIMITED_MIN_STACK_CARDS,
    );
    const targetCardCount = stackCards.length;
    // 非目标水果必须成 3 的倍数进入牌堆，否则会出现无法三消的落单牌。
    // 目标水果允许不是 3 的倍数：配置里 requiredCount 之外最多额外 3 张，
    // 用作目标收集容错，不参与 buffer 三消约束。
    const desiredDistractorCards = Math.ceil(Math.max(0, minStackCards - targetCardCount) / 3) * 3;
    let distractorIndex = 0;
    while (stackCards.length - targetCardCount < desiredDistractorCards && distractors.length > 0) {
      const fruitId = distractors[distractorIndex % distractors.length]!;
      stackCards.push(fruitId, fruitId, fruitId);
      distractorIndex += 1;
    }

    while (flatPool.length < FLAT_CARD_COUNT && distractors.length > 0) {
      const fruitId = distractors[distractorIndex % distractors.length]!;
      flatPool.push(fruitId, fruitId, fruitId);
      distractorIndex += 1;
    }

    return {
      flat: shuffleWithSeed(flatPool, this.roundDealSeed + 17).slice(0, FLAT_CARD_COUNT),
      stack: shuffleWithSeed(stackCards, this.roundDealSeed + 31),
    };
  }

  private renderAll(): void {
    this.refreshGameStateCaches();
    this.renderCards();
    this.renderLiftCards();
    this.renderIceBowls();
    this.renderBuffer();
    this.updateToolButtons();
  }

  private refreshGameStateCaches(): void {
    // 目标水果集合在一局内固定，仅当 level 变化时需要重建。
    if (this.targetFruitSet.size !== this.level.targets.length) {
      this.targetFruitSet = new Set(this.level.targets.map((target) => target.fruitId));
    }

    // 重新扫描各列顶部卡片：一局内只在卡片移动 / 移除时需要更新。
    if (this.topStackIdByColumn.length !== CARD_COLS) {
      this.topStackIdByColumn.length = CARD_COLS;
    }
    for (let col = 0; col < CARD_COLS; col += 1) {
      this.topStackIdByColumn[col] = null;
    }
    const topDepth: number[] = new Array(CARD_COLS).fill(-1);
    for (const card of this.cards) {
      if (card.zone !== 'stack' || card.removed) {
        continue;
      }
      const col = card.columnIndex;
      if (col < 0 || col >= CARD_COLS) {
        continue;
      }
      if (card.depthIndex > topDepth[col]!) {
        topDepth[col] = card.depthIndex;
        this.topStackIdByColumn[col] = card.id;
      }
    }
  }

  private clearStackRenderCache(): void {
    this.mountedStackCardViews.clear();
  }

  private clearLiftRenderCache(): void {
    this.mountedLiftCardViews.clear();
  }

  private clearBufferRenderCache(): void {
    this.bufferStaticView = null;
    this.bufferStaticSignature = '';
    this.bufferDynamicLayer = null;
    this.mountedBufferContents.clear();
  }

  private clearIceBowlRenderCache(): void {
    this.iceBowlViews.clear();
    this.iceBowlsSignature = '';
  }

  private clearAllRenderCaches(): void {
    this.clearStackRenderCache();
    this.clearLiftRenderCache();
    this.clearBufferRenderCache();
    this.clearIceBowlRenderCache();
  }

  private evaluateBufferPanic(): void {
    if (this.roundEnded) {
      this.exitBufferPanic();
      return;
    }
    const isFull = this.buffer.length > 0 && this.buffer.length >= this.activeBufferSize();
    if (isFull && !this.bufferPanicLayer) {
      this.enterBufferPanic();
    } else if (!isFull && this.bufferPanicLayer) {
      this.exitBufferPanic();
    }
  }

  private enterBufferPanic(): void {
    if (this.bufferPanicLayer) {
      return;
    }
    const layer = new PIXI.Container();
    layer.eventMode = 'none';
    this.bufferPanicLayer = layer;
    this.bufferPanicElapsedMs = 0;
    this.bufferPanicSfxPlayed = 0;
    this.bufferPanicNextSfxAtMs = 0;

    // 简化版预警：只把已占用的暂存槽底色染成静态红色，
    // 外框不闪、内部也不呼吸；提示责任完全交给那 3 声警报音。
    const W = Game.logicWidth;
    const slotSize = 76;
    const gap = 8;
    const totalSlots = this.level.bufferSize + 1;
    const totalW = totalSlots * slotSize + (totalSlots - 1) * gap;
    const startX = Math.round((W - totalW) / 2);
    const y = this.bufferY();

    const activeSize = this.activeBufferSize();
    for (let i = 0; i < Math.min(activeSize, this.buffer.length); i += 1) {
      const x = startX + i * (slotSize + gap);
      const g = new PIXI.Graphics();
      // 半透明红色填充：盖在水果图标下方做底色，不遮挡水果可见性。
      g.beginFill(0xff3a3a, 0.42);
      g.drawRoundedRect(x, y, slotSize, slotSize, 12);
      g.endFill();
      layer.addChild(g);
    }

    this.bufferLayer.addChild(layer);

    // ticker 只用来播 3 次警报音 + 兜底退出，UI 不再做任何脉动。
    const tick = () => {
      if (!this.bufferPanicLayer || layer.destroyed || !this.container.parent) {
        this.removeTransientTicker(tick);
        return;
      }
      this.bufferPanicElapsedMs += PIXI.Ticker.shared.deltaMS;
      if (this.bufferPanicSfxPlayed < 3 && this.bufferPanicElapsedMs >= this.bufferPanicNextSfxAtMs) {
        AudioManager.playBufferPanicSound();
        this.bufferPanicSfxPlayed += 1;
        this.bufferPanicNextSfxAtMs = this.bufferPanicElapsedMs + 720;
      }
      // 警报放完后 ticker 自然退出，但红色底色保留直到 evaluateBufferPanic 显式 exit。
      if (this.bufferPanicSfxPlayed >= 3) {
        this.removeTransientTicker(tick);
        this.bufferPanicTicker = null;
      }
    };
    this.bufferPanicTicker = tick;
    this.addTransientTicker(tick);
  }

  private exitBufferPanic(): void {
    if (this.bufferPanicTicker) {
      this.removeTransientTicker(this.bufferPanicTicker);
      this.bufferPanicTicker = null;
    }
    if (this.bufferPanicLayer) {
      if (!this.bufferPanicLayer.destroyed) {
        if (this.bufferPanicLayer.parent) {
          this.bufferPanicLayer.parent.removeChild(this.bufferPanicLayer);
        }
        this.bufferPanicLayer.destroy({ children: true });
      }
      this.bufferPanicLayer = null;
    }
    this.bufferPanicElapsedMs = 0;
    this.bufferPanicSfxPlayed = 0;
    this.bufferPanicNextSfxAtMs = 0;
  }

  private renderCards(): void {
    const boardTop = this.boardTop();
    const startX = Math.round((Game.logicWidth - (CARD_COLS * CARD_W + (CARD_COLS - 1) * CARD_GAP)) / 2);
    const visibleIds = new Set<string>();

    for (let col = 0; col < CARD_COLS; col += 1) {
      const topCardId = this.topStackIdByColumn[col] ?? null;
      const x = startX + col * (CARD_W + CARD_GAP);
      for (const card of this.cards) {
        if (card.zone !== 'stack' || card.removed || card.columnIndex !== col) {
          continue;
        }
        const y = boardTop + 42 + card.depthIndex * STACK_STEP_Y;
        const clickable = topCardId === card.id;
        const shouldHint = clickable && this.isTargetFruit(card.fruitId);
        // key 包含外观相关的所有维度：只要这些不变，就可以保留旧视图。
        const key = `${card.fruitId}|${clickable ? 1 : 0}|${shouldHint ? 1 : 0}`;
        visibleIds.add(card.id);
        const existing = this.mountedStackCardViews.get(card.id);
        if (existing && existing.key === key && !existing.view.destroyed) {
          existing.view.position.set(x, y);
          continue;
        }
        if (existing) {
          existing.view.destroy({ children: true });
        }
        const view = this.createCardView(card, clickable);
        view.position.set(x, y);
        this.cardLayer.addChild(view);
        this.mountedStackCardViews.set(card.id, { view, key });
      }
    }

    // 清理已不再可见的卡片视图（比如刚被点掉的那一张）。
    for (const [cardId, entry] of this.mountedStackCardViews) {
      if (visibleIds.has(cardId)) {
        continue;
      }
      if (!entry.view.destroyed) {
        entry.view.destroy({ children: true });
      }
      this.mountedStackCardViews.delete(cardId);
    }
  }

  private renderLiftCards(): void {
    const y = this.flatAreaY();
    const panelW = FLAT_COLS * CARD_W + (FLAT_COLS - 1) * CARD_GAP + 30;
    const panelH = FLAT_ROWS * CARD_H + (FLAT_ROWS - 1) * 8 + 30;
    const panelX = (Game.logicWidth - panelW) / 2;
    const panelY = y - 15;
    const totalW = FLAT_COLS * CARD_W + (FLAT_COLS - 1) * CARD_GAP;
    const startX = Math.round((Game.logicWidth - totalW) / 2);

    // 静态面板只画一次：除非被 onExit / 重置缓存清掉，否则不再重建。
    if (this.liftLayer.children.length === 0) {
      const panel = new PIXI.Graphics();
      panel.beginFill(0xfffdf3, 0.58);
      panel.lineStyle(2, 0x9ec872, 0.85);
      panel.drawRoundedRect(panelX, panelY, panelW, panelH, 16);
      panel.endFill();
      this.liftLayer.addChild(panel);
    }

    const visibleIds = new Set<string>();
    for (const card of this.cards) {
      if (card.zone !== 'lift' || card.removed) {
        continue;
      }
      const x = startX + card.columnIndex * (CARD_W + CARD_GAP);
      const yPos = y + card.depthIndex * (CARD_H + 8);
      const shouldHint = this.isTargetFruit(card.fruitId);
      const key = `${card.fruitId}|1|${shouldHint ? 1 : 0}`;
      visibleIds.add(card.id);
      const existing = this.mountedLiftCardViews.get(card.id);
      if (existing && existing.key === key && !existing.view.destroyed) {
        existing.view.position.set(x, yPos);
        continue;
      }
      if (existing) {
        existing.view.destroy({ children: true });
      }
      const view = this.createCardView(card, true);
      view.position.set(x, yPos);
      this.liftLayer.addChild(view);
      this.mountedLiftCardViews.set(card.id, { view, key });
    }

    for (const [cardId, entry] of this.mountedLiftCardViews) {
      if (visibleIds.has(cardId)) {
        continue;
      }
      if (!entry.view.destroyed) {
        entry.view.destroy({ children: true });
      }
      this.mountedLiftCardViews.delete(cardId);
    }
  }

  private renderBuffer(): void {
    const W = Game.logicWidth;
    const slotSize = 76;
    const gap = 8;
    const totalSlots = this.level.bufferSize + 1;
    const totalW = totalSlots * slotSize + (totalSlots - 1) * gap;
    const startX = Math.round((W - totalW) / 2);
    const y = this.bufferY();
    const activeSize = this.activeBufferSize();

    // 外框 + 槽位框：只与 totalSlots/activeSize 有关，发生变化时才重画。
    const staticSig = `${totalSlots}|${activeSize}`;
    if (this.bufferStaticSignature !== staticSig || !this.bufferStaticView) {
      if (this.bufferStaticView) {
        this.bufferStaticView.destroy({ children: true });
        this.bufferStaticView = null;
      }
      const staticRoot = new PIXI.Container();
      const strip = new PIXI.Graphics();
      strip.beginFill(0x7a4e42, 0.95);
      strip.drawRoundedRect(startX - 18, y - 18, totalW + 36, slotSize + 36, 28);
      strip.endFill();
      staticRoot.addChild(strip);
      for (let i = 0; i < totalSlots; i += 1) {
        const x = startX + i * (slotSize + gap);
        const locked = i >= activeSize;
        const slot = new PIXI.Graphics();
        slot.beginFill(locked ? 0xd8c4b0 : 0xf6dfc6, locked ? 0.82 : 0.96);
        slot.lineStyle(3, 0xfaf0df, locked ? 0.55 : 0.82);
        slot.drawRoundedRect(x, y, slotSize, slotSize, 12);
        slot.endFill();
        staticRoot.addChild(slot);
      }
      this.bufferLayer.addChildAt(staticRoot, 0);
      this.bufferStaticView = staticRoot;
      this.bufferStaticSignature = staticSig;
    }

    if (!this.bufferDynamicLayer || this.bufferDynamicLayer.destroyed) {
      const dyn = new PIXI.Container();
      this.bufferLayer.addChild(dyn);
      this.bufferDynamicLayer = dyn;
      this.mountedBufferContents.clear();
    } else {
      // 保证动态层位于静态层之上。
      this.bufferLayer.setChildIndex(this.bufferDynamicLayer, this.bufferLayer.children.length - 1);
    }

    const dynamic = this.bufferDynamicLayer;
    const validSlotIndexes = new Set<number>();
    for (let i = 0; i < totalSlots; i += 1) {
      const x = startX + i * (slotSize + gap);
      const locked = i >= activeSize;
      const fruitId = this.buffer[i];
      const isMatching = this.animatingBufferMatchIndexes.includes(i);
      const isIncoming = (this.bufferIncomingHidden.get(i) ?? 0) > 0;
      const showFruit = !!fruitId && !isMatching && !isIncoming;
      // key 标识当前槽要显示的内容；变化时才重建。
      let key: string;
      if (locked) {
        key = `lock|${this.unlockBufferAdBusy ? 1 : 0}`;
      } else if (showFruit) {
        key = `fruit|${fruitId}`;
      } else {
        key = 'empty';
      }
      validSlotIndexes.add(i);
      const existing = this.mountedBufferContents.get(i);
      if (existing && existing.key === key && !existing.view.destroyed) {
        continue;
      }
      if (existing) {
        existing.view.destroy({ children: true });
      }
      let view: PIXI.Container;
      if (locked) {
        view = this.createLockedBufferSlot(x, y, slotSize);
      } else if (showFruit && fruitId) {
        view = this.createFruitIcon(fruitId, 56);
        view.position.set(x + slotSize / 2, y + slotSize / 2);
      } else {
        view = new PIXI.Container();
      }
      dynamic.addChild(view);
      this.mountedBufferContents.set(i, { view, key });
    }

    for (const [slotIndex, entry] of this.mountedBufferContents) {
      if (validSlotIndexes.has(slotIndex)) {
        continue;
      }
      if (!entry.view.destroyed) {
        entry.view.destroy({ children: true });
      }
      this.mountedBufferContents.delete(slotIndex);
    }
  }

  private createLockedBufferSlot(x: number, y: number, size: number): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = this.unlockBufferAdBusy ? 'none' : 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(x, y, size, size);
    root.on('pointertap', () => {
      AudioManager.playButtonSound();
      void this.unlockExtraBufferSlotByAd();
    });

    const mask = new PIXI.Graphics();
    mask.beginFill(0x4b3428, 0.48);
    mask.drawRoundedRect(x, y, size, size, 12);
    mask.endFill();
    root.addChild(mask);

    const label = new PIXI.Text(this.unlockBufferAdBusy ? '广告中' : '解锁', {
      fontSize: 20,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x5a351f,
      strokeThickness: 4,
      align: 'center',
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    label.position.set(x + size / 2, y + size / 2 - 10);
    root.addChild(label);

    const video = new PIXI.Text('▶', {
      fontSize: 20,
      fill: 0xfff2a7,
      fontWeight: '900',
      stroke: 0x5a351f,
      strokeThickness: 3,
    });
    video.anchor.set(0.5);
    video.resolution = 2;
    video.position.set(x + size / 2, y + size / 2 + 18);
    root.addChild(video);
    return root;
  }

  private cardWorldCenter(card: CardState): { x: number; y: number } {
    if (card.zone === 'stack') {
      const startX = Math.round(
        (Game.logicWidth - (CARD_COLS * CARD_W + (CARD_COLS - 1) * CARD_GAP)) / 2,
      );
      return {
        x: startX + card.columnIndex * (CARD_W + CARD_GAP) + CARD_W / 2,
        y: this.boardTop() + 42 + card.depthIndex * STACK_STEP_Y + CARD_H / 2,
      };
    }
    const totalW = FLAT_COLS * CARD_W + (FLAT_COLS - 1) * CARD_GAP;
    const startX = Math.round((Game.logicWidth - totalW) / 2);
    return {
      x: startX + card.columnIndex * (CARD_W + CARD_GAP) + CARD_W / 2,
      y: this.flatAreaY() + card.depthIndex * (CARD_H + 8) + CARD_H / 2,
    };
  }

  private findBowlSlotIndexForCollected(fruitId: FruitId, collectedForFruit: number): number {
    const bowlSlots = this.getBowlSlots();
    const collectedIndex = Math.max(0, collectedForFruit - 1);
    const idx = bowlSlots.findIndex(
      (slot) => slot.fruitId === fruitId
        && collectedIndex >= slot.start
        && collectedIndex < slot.start + slot.capacity,
    );
    return idx >= 0 ? idx : 0;
  }

  private findLastBowlSlotIndexForFruit(fruitId: FruitId): number {
    const bowlSlots = this.getBowlSlots();
    for (let i = bowlSlots.length - 1; i >= 0; i -= 1) {
      if (bowlSlots[i]?.fruitId === fruitId) {
        return i;
      }
    }
    return 0;
  }

  private bowlSlotCenterByIndex(slotIndex: number): { x: number; y: number } {
    const bowlSlots = this.getBowlSlots();
    const bowlW = 118;
    const gap = 12;
    const totalW = bowlSlots.length * bowlW + (bowlSlots.length - 1) * gap;
    const startX = Math.round((Game.logicWidth - totalW) / 2);
    return {
      x: startX + slotIndex * (bowlW + gap) + bowlW / 2,
      y: this.bowlY() + 14,
    };
  }

  private flyFruitTo(
    fruitId: FruitId,
    from: { x: number; y: number },
    to: { x: number; y: number },
    onLand: () => void,
  ): void {
    if (!this.container.parent) {
      onLand();
      return;
    }
    const sprite = this.createFruitIcon(fruitId, 56);
    sprite.position.set(from.x, from.y);
    this.flyingLayer.addChild(sprite);

    const start = performance.now();
    // 加速：原 280ms 抛物线 + 弹跳缩放看起来偏慢，
    // 改成 170ms 直线（带轻微抛物线提示运动方向），点击节奏跟得上。
    const duration = 170;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    // 轻微抛物线提示运动方向，幅度比原来小一半左右，避免视觉拖沓。
    const arcHeight = Math.min(56, Math.max(18, Math.sqrt(dx * dx + dy * dy) * 0.08));

    let landed = false;
    const tick = () => {
      if (sprite.destroyed || !this.container.parent) {
        this.removeTransientTicker(tick);
        if (!sprite.destroyed && sprite.parent) {
          sprite.parent.removeChild(sprite);
          sprite.destroy({ children: true });
        }
        if (!landed) {
          landed = true;
          onLand();
        }
        return;
      }
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic：起步快、后段顺滑落入目标。
      const ease = 1 - (1 - t) * (1 - t) * (1 - t);
      sprite.position.x = from.x + dx * ease;
      sprite.position.y = from.y + dy * ease - Math.sin(t * Math.PI) * arcHeight;
      // 不再做缩放弹跳，避免视觉上"吸进去"再"弹出来"的拉扯感。
      if (t >= 1) {
        this.removeTransientTicker(tick);
        if (sprite.parent) {
          sprite.parent.removeChild(sprite);
        }
        sprite.destroy({ children: true });
        if (!landed) {
          landed = true;
          onLand();
        }
      }
    };
    this.addTransientTicker(tick);
  }

  private flyFruitToBuffer(fruitId: FruitId, from: { x: number; y: number }, slotIndex: number, onLand: () => void): void {
    const target = this.bufferSlotCenter(slotIndex);
    this.flyFruitTo(fruitId, from, target, onLand);
  }

  private flyFruitToBowl(fruitId: FruitId, from: { x: number; y: number }, bowlSlotIndex: number, onLand: () => void): void {
    const target = this.bowlSlotCenterByIndex(bowlSlotIndex);
    this.flyFruitTo(fruitId, from, target, onLand);
  }

  private bufferSlotCenter(index: number): { x: number; y: number } {
    const W = Game.logicWidth;
    const slotSize = 76;
    const gap = 8;
    const totalSlots = this.level.bufferSize + 1;
    const totalW = totalSlots * slotSize + (totalSlots - 1) * gap;
    const startX = Math.round((W - totalW) / 2);
    const y = this.bufferY();
    return {
      x: startX + index * (slotSize + gap) + slotSize / 2,
      y: y + slotSize / 2,
    };
  }

  private createCardView(card: CardState, clickable: boolean): PIXI.Container {
    const root = new PIXI.Container();
    const shouldHintTarget = clickable && this.isTargetFruit(card.fruitId);

    const lift = new PIXI.Graphics();
    lift.beginFill(shouldHintTarget ? 0x63d85f : 0x31551d, shouldHintTarget ? 0.42 : 0.18);
    lift.drawRoundedRect(1.5, 2.5, CARD_W - 1, CARD_H - 1, 8);
    lift.endFill();
    root.addChild(lift);

    const cardBg = new PIXI.Graphics();
    cardBg.beginFill(shouldHintTarget ? 0xdfff9f : 0xfff8df, 1);
    cardBg.lineStyle(shouldHintTarget ? 4 : 2, shouldHintTarget ? 0x2f9a35 : 0x4f8c2e, 1);
    cardBg.drawRoundedRect(0.5, 0.5, CARD_W - 2, CARD_H - 2, 8);
    cardBg.endFill();
    cardBg.lineStyle(1, shouldHintTarget ? 0xf2ffe6 : 0xffffff, 0.75);
    cardBg.moveTo(8, 6);
    cardBg.lineTo(CARD_W - 8, 6);
    cardBg.lineStyle(1, shouldHintTarget ? 0x7bcf51 : 0xd9d49b, 0.6);
    cardBg.moveTo(8, CARD_H - 7);
    cardBg.lineTo(CARD_W - 8, CARD_H - 7);
    root.addChild(cardBg);

    let hintGlow: PIXI.Graphics | null = null;
    if (shouldHintTarget) {
      const glow = new PIXI.Graphics();
      glow.lineStyle(3, 0xa6ff64, 0.96);
      glow.drawRoundedRect(2.5, 2.5, CARD_W - 6, CARD_H - 6, 8);
      root.addChild(glow);
      hintGlow = glow;
    }

    const icon = this.createFruitIcon(card.fruitId, 55);
    icon.position.set(CARD_W / 2, CARD_H / 2 + 1);
    root.addChild(icon);

    if (clickable) {
      root.eventMode = 'static';
      root.cursor = 'pointer';
      root.hitArea = new PIXI.Rectangle(0, 0, CARD_W, CARD_H);
      root.on('pointertap', () => {
        AudioManager.playButtonSound();
        this.onCardTap(card.id);
      });
    }
    if (shouldHintTarget && hintGlow) {
      this.attachTargetCardHint(hintGlow);
    }
    return root;
  }

  private attachTargetCardHint(glow: PIXI.Graphics): void {
    // 把所有目标卡的发光圈节奏交给一个共享 ticker：每帧只算一次 sin，
    // 应用到 glow.alpha。卡片本体（root）不动 scale / y，堆叠对齐稳定。
    // phase 让不同卡片错相，整组目标卡不会"齐刷刷"地一起亮。
    const entry = { glow, phase: this.targetHintRoots.size * 0.55 };
    this.targetHintRoots.add(entry);
    if (this.targetHintMasterTicker) {
      return;
    }
    const startedAt = performance.now();
    const tick = () => {
      if (!this.container.parent) {
        if (this.targetHintMasterTicker === tick) {
          PIXI.Ticker.shared.remove(tick);
          this.targetHintMasterTicker = null;
        }
        this.targetHintRoots.clear();
        return;
      }
      const elapsed = performance.now() - startedAt;
      const baseTime = elapsed / 220;
      let toRemove: typeof entry[] | null = null;
      for (const item of this.targetHintRoots) {
        const g = item.glow;
        if (g.destroyed || !g.parent) {
          (toRemove ??= []).push(item);
          continue;
        }
        // alpha 在 0.55 ~ 1.0 之间脉动，肉眼能看到亮度变化但卡片本体
        // 大小 / 位置完全不动。
        const wave = (Math.sin(baseTime + item.phase) + 1) * 0.5; // 0..1
        g.alpha = 0.55 + wave * 0.45;
      }
      if (toRemove) {
        for (const item of toRemove) {
          this.targetHintRoots.delete(item);
        }
      }
      if (this.targetHintRoots.size === 0) {
        if (this.targetHintMasterTicker === tick) {
          PIXI.Ticker.shared.remove(tick);
          this.targetHintMasterTicker = null;
        }
      }
    };
    this.targetHintMasterTicker = tick;
    PIXI.Ticker.shared.add(tick);
  }

  private createFruitIcon(fruitId: FruitId, size: number): PIXI.Container {
    const root = new PIXI.Container();
    const tex = TextureCache.get(textureKey(fruitId));
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.scale.set(size / Math.max(tex.width, tex.height));
      root.addChild(sp);
      return root;
    }

    const fallback = new PIXI.Graphics();
    fallback.beginFill(FRUIT_MAP[fruitId].color);
    fallback.drawCircle(0, 0, size / 2);
    fallback.endFill();
    root.addChild(fallback);
    const label = new PIXI.Text(FRUIT_MAP[fruitId].label.slice(0, 1), {
      fontSize: Math.round(size * 0.42),
      fill: 0xffffff,
      fontWeight: '900',
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    root.addChild(label);
    return root;
  }

  private onCardTap(cardId: string): void {
    if (this.roundEnded || this.bufferMatchResolving) {
      return;
    }
    const card = this.cards.find((item) => item.id === cardId);
    if (!card || card.removed) {
      return;
    }
    if (card.zone === 'stack' && this.topStackCard(card.columnIndex)?.id !== card.id) {
      return;
    }

    Haptics.light();
    // 在标记 removed 之前先记录卡片当前位置，作为飞入动画的起点。
    this.cardClicksThisRound += 1;
    const fromPos = this.cardWorldCenter(card);
    const fruitId = card.fruitId;

    this.history.push({
      cardId,
      prevCollected: this.collected,
      prevCollectedByFruit: { ...this.collectedByFruit },
      prevBuffer: this.buffer.slice(),
    });
    card.removed = true;

    if (this.isTargetFruit(fruitId)) {
      this.targetHitsThisRound += 1;
      const requiredForFruit = this.targetRequiredCount(fruitId);
      const prevCollectedForFruit = this.collectedByFruit[fruitId] ?? 0;
      const canCountForGoal = prevCollectedForFruit < requiredForFruit;
      const collectedForFruit = canCountForGoal
        ? prevCollectedForFruit + 1
        : Math.max(1, requiredForFruit);
      if (canCountForGoal) {
        this.collected += 1;
        this.collectedByFruit[fruitId] = collectedForFruit;
      }
      const bowlSlotIndex = canCountForGoal
        ? this.findBowlSlotIndexForCollected(fruitId, collectedForFruit)
        : this.findLastBowlSlotIndexForFruit(fruitId);
      if (canCountForGoal) {
        this.bowlIncomingHidden.set(
          bowlSlotIndex,
          (this.bowlIncomingHidden.get(bowlSlotIndex) ?? 0) + 1,
        );
      }
      // 命中目标的同步刷新：只更新被点击区域所在的卡片层 + 冰碗占位状态。
      // 缓存的 buffer / 工具栏不会改变，跳过避免无谓的 PIXI Graphics / Sprite
      // 重建（这是点击卡顿的主要来源之一）。
      this.refreshGameStateCaches();
      if (card.zone === 'lift') {
        this.renderLiftCards();
      } else {
        this.renderCards();
      }
      this.renderIceBowls();
      this.updateToolButtons();

      const reachedGoal = this.hasMetAllTargetCounts();
      this.flyFruitToBowl(fruitId, fromPos, bowlSlotIndex, () => {
        if (canCountForGoal) {
          const cur = this.bowlIncomingHidden.get(bowlSlotIndex) ?? 0;
          if (cur <= 1) {
            this.bowlIncomingHidden.delete(bowlSlotIndex);
          } else {
            this.bowlIncomingHidden.set(bowlSlotIndex, cur - 1);
          }
        }
        if (this.roundEnded && !reachedGoal) {
          // 场景已结束（其他流程触发），跳过后续状态更新。
          return;
        }
        AudioManager.playScoopSound();
        if (canCountForGoal) {
          this.showTargetCollectEncouragement(fruitId, collectedForFruit);
        }
        this.renderIceBowls();
        if (reachedGoal && !this.roundEnded) {
          this.finishRound(true);
        }
      });
      return;
    }

    if (this.buffer.length >= this.activeBufferSize()) {
      this.finishRound(false, 'buffer_full');
      return;
    }
    this.buffer.push(fruitId);
    this.bufferAddsThisRound += 1;
    this.maxBufferSizeThisRound = Math.max(this.maxBufferSizeThisRound, this.buffer.length);
    const bufferIndex = this.buffer.length - 1;
    this.bufferIncomingHidden.set(
      bufferIndex,
      (this.bufferIncomingHidden.get(bufferIndex) ?? 0) + 1,
    );
    const matchIndexes = this.findBufferMatchIndexes();
    // 同步刷新只更新被点的卡片层 + buffer：另一卡片层 / 冰碗 / 工具栏没变化。
    this.refreshGameStateCaches();
    if (card.zone === 'lift') {
      this.renderLiftCards();
    } else {
      this.renderCards();
    }
    this.renderBuffer();
    this.updateToolButtons();

    this.flyFruitToBuffer(fruitId, fromPos, bufferIndex, () => {
      const cur = this.bufferIncomingHidden.get(bufferIndex) ?? 0;
      if (cur <= 1) {
        this.bufferIncomingHidden.delete(bufferIndex);
      } else {
        this.bufferIncomingHidden.set(bufferIndex, cur - 1);
      }
      if (this.roundEnded) {
        return;
      }
      this.renderBuffer();
      if (matchIndexes) {
        this.scheduleBufferMatchResolve(matchIndexes);
      } else {
        this.evaluateBufferPanic();
      }
    });
  }

  private findBufferMatchIndexes(): number[] | null {
    const counts = new Map<FruitId, number>();
    for (const fruitId of this.buffer) {
      counts.set(fruitId, (counts.get(fruitId) ?? 0) + 1);
    }
    for (const [fruitId, count] of counts) {
      if (count >= 3) {
        const indexes: number[] = [];
        for (let i = this.buffer.length - 1; i >= 0; i -= 1) {
          if (this.buffer[i] === fruitId) {
            indexes.push(i);
          }
          if (indexes.length >= 3) {
            break;
          }
        }
        return indexes;
      }
    }
    return null;
  }

  private scheduleBufferMatchResolve(matchIndexes: readonly number[]): void {
    this.bufferMatchResolving = true;
    // 之前 220ms 的"看一眼第三张水果到位"延迟过长，叠加 540ms 动画后玩家
    // 等接近 1 秒才看到消除完成。压到 60ms 给一个最小视觉缓冲，立刻进消除
    // 动画，避免节奏被拖慢。
    this.bufferMatchTimer = window.setTimeout(() => {
      this.bufferMatchTimer = null;
      this.playBufferMatchAnimation(matchIndexes);
    }, 60);
  }

  private playBufferMatchAnimation(matchIndexes: readonly number[]): void {
    this.animatingBufferMatchIndexes = matchIndexes;
    this.renderBuffer();

    const fxLayer = new PIXI.Container();
    this.overlayLayer.addChild(fxLayer);

    const starOffsets: ReadonlyArray<readonly [number, number]> = [
      [-28, -24],
      [26, -20],
      [4, 28],
    ];

    const items = matchIndexes.map((bufferIndex) => {
      const center = this.bufferSlotCenter(bufferIndex);
      const fruitId = this.buffer[bufferIndex];
      const iconHolder = new PIXI.Container();
      iconHolder.position.set(center.x, center.y);
      const icon = fruitId ? this.createFruitIcon(fruitId, 56) : null;
      if (icon) {
        iconHolder.addChild(icon);
      }
      fxLayer.addChild(iconHolder);

      const stars = starOffsets.map(([dx, dy]) => {
        const star = new PIXI.Text('✦', {
          fontSize: 32,
          fill: 0xfff8c7,
          fontWeight: '900',
          stroke: 0xb56a18,
          strokeThickness: 3,
        });
        star.anchor.set(0.5);
        star.resolution = 2;
        star.position.set(center.x + dx, center.y + dy);
        star.scale.set(0.4);
        star.alpha = 0;
        fxLayer.addChild(star);
        return { sprite: star, dx, dy, baseX: center.x, baseY: center.y };
      });

      return { iconHolder, stars };
    });

    AudioManager.playBufferMatchSound();

    // 540ms 改 320ms：把"icon 放大 + 星星迸发 + 消失"压紧，
    // 视觉节奏明显加快，玩家不再有"卡了一下"的等待感。
    const duration = 320;
    const start = performance.now();

    const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

    const tick = () => {
      if (!this.container.parent) {
        this.removeTransientTicker(tick);
        if (fxLayer.parent) {
          fxLayer.parent.removeChild(fxLayer);
        }
        fxLayer.destroy({ children: true });
        this.animatingBufferMatchIndexes = [];
        this.bufferMatchResolving = false;
        return;
      }

      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / duration);

      const growT = Math.min(progress / 0.3, 1);
      const fadeT = Math.max(0, (progress - 0.3) / 0.7);
      const iconScale = 1 + easeOut(growT) * 0.55;
      const iconAlpha = 1 - fadeT;

      const starInT = Math.min(progress / 0.18, 1);
      const starOutT = Math.max(0, (progress - 0.4) / 0.6);
      const starScale = 0.5 + easeOut(starInT) * 0.7;
      const starAlpha = Math.max(0, Math.min(1, starInT) - starOutT);
      const starSpread = 1 + easeOut(progress) * 0.7;

      for (const item of items) {
        item.iconHolder.scale.set(iconScale);
        item.iconHolder.alpha = iconAlpha;
        for (const star of item.stars) {
          star.sprite.position.set(star.baseX + star.dx * starSpread, star.baseY + star.dy * starSpread);
          star.sprite.scale.set(starScale);
          star.sprite.alpha = starAlpha;
          star.sprite.rotation += 0.06;
        }
      }

      if (progress >= 1) {
        this.removeTransientTicker(tick);
        if (fxLayer.parent) {
          fxLayer.parent.removeChild(fxLayer);
        }
        fxLayer.destroy({ children: true });

        const sortedIndexes = [...matchIndexes].sort((a, b) => b - a);
        for (const index of sortedIndexes) {
          if (index >= 0 && index < this.buffer.length) {
            this.buffer.splice(index, 1);
          }
        }
        this.animatingBufferMatchIndexes = [];
        this.bufferMatchResolving = false;
        this.renderAll();
        this.evaluateBufferPanic();
      }
    };

    this.addTransientTicker(tick);
  }

  private finishRound(success: boolean, reason: DailyLimitedEndReason = success ? 'complete' : 'buffer_full'): void {
    this.roundEnded = true;
    this.exitBufferPanic();
    if (success) {
      if (!this.clearRewardGranted) {
        this.clearRewardGranted = true;
        const firstToday = this.claimDailyFirstClearRewardIfNeeded();
        const rewardCoins = firstToday ? DAILY_LIMITED_CLEAR_REWARD_COINS : DAILY_LIMITED_REPEAT_CLEAR_REWARD_COINS;
        this.lastClearRewardWasFirstToday = firstToday;
        this.lastClearRewardCoins = rewardCoins;
        addCoins(rewardCoins);
        this.coinBar.refresh();
        this.coinBar.bump();
      }
      AudioManager.playBadgeUnlockSound();
    } else {
      AudioManager.playBufferPanicSound();
    }
    this.trackDailyLimitedEnd(success, reason);
    this.showResultOverlay(success);
  }

  private trackDailyLimitedEnd(success: boolean, reason: DailyLimitedEndReason): void {
    analytics.track('daily_limited_end', {
      mode: 'daily_limited',
      level_id: this.level.dayOfMonth,
      theme_id: this.level.themeId,
      drink_name: this.level.drinkName,
      success,
      end_reason: reason,
      duration_ms: this.roundStartTs > 0 ? Date.now() - this.roundStartTs : 0,
      collected_count: this.collected,
      target_count: this.targetCount(),
      card_clicks: this.cardClicksThisRound,
      target_hits: this.targetHitsThisRound,
      buffer_adds: this.bufferAddsThisRound,
      max_buffer_size: this.maxBufferSizeThisRound,
      extra_buffer_unlocked: this.extraBufferSlotUnlocked,
      shuffle_tool_count: this.toolUsesThisRound.shuffle,
      undo_tool_count: this.toolUsesThisRound.undo,
      lift_tool_count: this.toolUsesThisRound.lift,
      reward_coins: success ? this.lastClearRewardCoins : 0,
      first_clear_today: success ? this.lastClearRewardWasFirstToday : false,
    });
  }

  private readDailyRewardState(): DailyLimitedRewardState {
    const stored = PersistService.readJSON<Partial<DailyLimitedRewardState>>(DAILY_LIMITED_REWARD_STATE_KEY);
    return {
      claimedRecipeDateByTheme: {
        ...(stored?.claimedRecipeDateByTheme ?? {}),
      },
    };
  }

  private writeDailyRewardState(state: DailyLimitedRewardState): void {
    PersistService.writeJSON(DAILY_LIMITED_REWARD_STATE_KEY, {
      claimedRecipeDateByTheme: { ...state.claimedRecipeDateByTheme },
    });
  }

  private claimDailyFirstClearRewardIfNeeded(): boolean {
    const today = getLocalDayKey();
    const state = this.readDailyRewardState();
    if (state.claimedRecipeDateByTheme[this.level.themeId] === today) {
      return false;
    }
    state.claimedRecipeDateByTheme[this.level.themeId] = today;
    this.writeDailyRewardState(state);
    return true;
  }

  private completeRoundByGm(): void {
    if (this.roundEnded) {
      return;
    }
    this.bufferMatchResolving = false;
    this.animatingBufferMatchIndexes = [];
    this.collected = this.targetCount();
    this.collectedByFruit = {};
    this.level.targets.forEach((target) => {
      this.collectedByFruit[target.fruitId] = target.requiredCount;
    });
    this.renderAll();
    this.finishRound(true, 'gm_complete');
  }

  private showGmPanel(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    destroyContainerChildren(this.overlayLayer);

    const dim = new PIXI.Graphics();
    dim.beginFill(0x0d0b08, 0.58);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    dim.eventMode = 'static';
    dim.on('pointertap', () => {
      destroyContainerChildren(this.overlayLayer);
    });
    this.overlayLayer.addChild(dim);

    const panelW = Math.min(620, W - 70);
    const panelH = Math.min(720, 220 + DAILY_LIMITED_LEVELS.length * 76);
    const panelX = (W - panelW) / 2;
    const panelY = (H - panelH) / 2;
    const panel = new PIXI.Graphics();
    panel.beginFill(0xfff7e6, 1);
    panel.lineStyle(6, 0xc27c38, 1);
    panel.drawRoundedRect(panelX, panelY, panelW, panelH, 28);
    panel.endFill();
    this.overlayLayer.addChild(panel);

    const title = new PIXI.Text('GM测试', {
      fontSize: 36,
      fill: 0x5a2c15,
      fontWeight: '900',
    });
    title.anchor.set(0.5);
    title.resolution = 2;
    title.position.set(W / 2, panelY + 46);
    this.overlayLayer.addChild(title);

    const clear = this.createPillButton('一键通关', 210, 60, 0xff7f50, 0x9d3b20);
    clear.position.set(W / 2, panelY + 112);
    clear.on('pointertap', (event: PIXI.FederatedPointerEvent) => {
      event.stopPropagation();
      AudioManager.playButtonSound();
      destroyContainerChildren(this.overlayLayer);
      this.completeRoundByGm();
    });
    this.overlayLayer.addChild(clear);

    DAILY_LIMITED_LEVELS.forEach((level, index) => {
      const y = panelY + 188 + index * 70;
      if (y > panelY + panelH - 48) {
        return;
      }
      const selected = level.themeId === this.level.themeId;
      const btn = this.createPillButton(
        `${level.dayOfMonth}日 ${level.drinkName}${selected ? ' 当前' : ''}`,
        panelW - 92,
        54,
        selected ? 0x80c96d : 0x72b7e8,
        selected ? 0x31722e : 0x226a9c,
      );
      btn.position.set(W / 2, y);
      btn.on('pointertap', (event: PIXI.FederatedPointerEvent) => {
        event.stopPropagation();
        AudioManager.playButtonSound();
        void this.switchThemeByGm(level);
      });
      this.overlayLayer.addChild(btn);
    });
  }

  private showDailyRuleIntroIfNeeded(): void {
    if (this.roundEnded || this.hasSeenDailyRuleIntroToday()) {
      return;
    }
    this.showDailyRuleIntroPanel();
  }

  private showDailyRuleIntroPanel(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    destroyContainerChildren(this.overlayLayer);

    const dim = new PIXI.Graphics();
    dim.beginFill(0x1a130c, 0.62);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    dim.eventMode = 'static';
    this.overlayLayer.addChild(dim);

    const panelW = Math.min(660, W - 54);
    const panelH = 610;
    const panelX = (W - panelW) / 2;
    const panelY = (H - panelH) / 2;
    const panel = this.createCommonModalPanel(panelW, panelH);
    panel.position.set(panelX, panelY);
    this.overlayLayer.addChild(panel);

    const title = new PIXI.Text('今日限定规则', {
      fontSize: 42,
      fill: 0xfff0c4,
      fontWeight: '900',
      stroke: 0x7a2d18,
      strokeThickness: 6,
      lineJoin: 'round',
    });
    title.anchor.set(0.5);
    title.resolution = 2;
    title.position.set(W / 2, panelY + 76);
    this.overlayLayer.addChild(title);

    const introLine1 = new PIXI.Container();
    const introPrefix = new PIXI.Text('为了做出 ', {
      fontSize: 28,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x5a3218,
      strokeThickness: 4,
    });
    introPrefix.anchor.set(0, 0.5);
    introPrefix.resolution = 2;
    const introDrink = new PIXI.Text(`「${this.level.drinkName}」`, {
      fontSize: 30,
      fill: 0xfff06a,
      fontWeight: '900',
      stroke: 0x7a2d18,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    introDrink.anchor.set(0, 0.5);
    introDrink.resolution = 2;
    const introLine1W = introPrefix.width + introDrink.width;
    introPrefix.position.set(-introLine1W / 2, 0);
    introDrink.position.set(introPrefix.x + introPrefix.width, 0);
    introLine1.addChild(introPrefix, introDrink);
    introLine1.position.set(W / 2, panelY + 156);
    this.overlayLayer.addChild(introLine1);

    const introLine2 = new PIXI.Text('找出下方目标水果，放入冰碗', {
      fontSize: 28,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x5a3218,
      strokeThickness: 4,
      align: 'center',
    });
    introLine2.anchor.set(0.5);
    introLine2.resolution = 2;
    introLine2.position.set(W / 2, panelY + 205);
    this.overlayLayer.addChild(introLine2);

    const targetsTitle = new PIXI.Text('目标水果', {
      fontSize: 28,
      fill: 0xfff5d0,
      fontWeight: '900',
      stroke: 0x7a2d18,
      strokeThickness: 5,
    });
    targetsTitle.anchor.set(0.5);
    targetsTitle.resolution = 2;
    targetsTitle.position.set(W / 2, panelY + 270);
    this.overlayLayer.addChild(targetsTitle);

    const targetRow = this.createRuleTargetFruitRow(panelW - 96);
    targetRow.position.set(W / 2, panelY + 360);
    this.overlayLayer.addChild(targetRow);

    const tip = new PIXI.Text('非目标水果会先进暂存栏\n同水果集满 3 个会自动消除', {
      fontSize: 21,
      fill: 0xffefd0,
      fontWeight: '900',
      stroke: 0x5a3218,
      strokeThickness: 4,
      align: 'center',
      lineHeight: 32,
      wordWrap: true,
      wordWrapWidth: panelW - 88,
    });
    tip.anchor.set(0.5);
    tip.resolution = 2;
    tip.position.set(W / 2, panelY + 466);
    this.overlayLayer.addChild(tip);

    const start = this.createPillButton('开始挑战', 230, 70, 0x79d64b, 0x2f7a26);
    start.position.set(W / 2, panelY + panelH - 76);
    start.on('pointertap', (event: PIXI.FederatedPointerEvent) => {
      event.stopPropagation();
      AudioManager.playButtonSound();
      this.markDailyRuleIntroSeenToday();
      destroyContainerChildren(this.overlayLayer);
    });
    this.overlayLayer.addChild(start);
  }

  private createRuleTargetFruitRow(maxWidth: number): PIXI.Container {
    const root = new PIXI.Container();
    const cardW = Math.min(150, Math.max(116, (maxWidth - (this.level.targets.length - 1) * 18) / this.level.targets.length));
    const cardH = 128;
    const gap = 18;
    const totalW = this.level.targets.length * cardW + (this.level.targets.length - 1) * gap;
    const startX = -totalW / 2;

    this.level.targets.forEach((target, index) => {
      const fruit = FRUIT_MAP[target.fruitId];
      const card = new PIXI.Container();
      card.position.set(startX + index * (cardW + gap), -cardH / 2);

      const bg = new PIXI.Graphics();
      bg.beginFill(0xfff6df, 0.96);
      bg.lineStyle(4, 0xf0c36f, 1);
      bg.drawRoundedRect(0, 0, cardW, cardH, 20);
      bg.endFill();
      card.addChild(bg);

      const icon = this.createFruitIcon(target.fruitId, 70);
      icon.position.set(cardW / 2, 42);
      card.addChild(icon);

      const label = new PIXI.Text(fruit.label, {
        fontSize: 22,
        fill: 0x5b3218,
        fontWeight: '900',
        align: 'center',
        stroke: 0xffffff,
        strokeThickness: 3,
      });
      label.anchor.set(0.5);
      label.resolution = 2;
      label.position.set(cardW / 2, 86);
      card.addChild(label);

      const count = new PIXI.Text(`收集 ${target.requiredCount}`, {
        fontSize: 20,
        fill: 0x8b4b20,
        fontWeight: '900',
        align: 'center',
      });
      count.anchor.set(0.5);
      count.resolution = 2;
      count.position.set(cardW / 2, 112);
      card.addChild(count);

      root.addChild(card);
    });

    return root;
  }

  private topStackCard(columnIndex: number): CardState | null {
    let top: CardState | null = null;
    for (const card of this.cards) {
      if (card.zone !== 'stack' || card.columnIndex !== columnIndex || card.removed) {
        continue;
      }
      if (!top || card.depthIndex > top.depthIndex) {
        top = card;
      }
    }
    return top;
  }

  private isTargetFruit(fruitId: FruitId): boolean {
    if (this.targetFruitSet.size === 0) {
      this.refreshGameStateCaches();
    }
    return this.targetFruitSet.has(fruitId);
  }

  private targetFruitIds(): readonly FruitId[] {
    return getDailyLimitedTargetFruitIds(this.level);
  }

  private targetCount(): number {
    return getDailyLimitedTargetCount(this.level);
  }

  private targetRequiredCount(fruitId: FruitId): number {
    return this.level.targets.find((target) => target.fruitId === fruitId)?.requiredCount ?? 0;
  }

  private hasMetAllTargetCounts(): boolean {
    return this.level.targets.every((target) => (
      (this.collectedByFruit[target.fruitId] ?? 0) >= target.requiredCount
    ));
  }

  private activeBufferSize(): number {
    return this.level.bufferSize + (this.extraBufferSlotUnlocked ? 1 : 0);
  }

  private async unlockExtraBufferSlotByAd(): Promise<void> {
    if (this.extraBufferSlotUnlocked || this.unlockBufferAdBusy) {
      return;
    }
    this.unlockBufferAdBusy = true;
    this.renderBuffer();
    try {
      const result = await showRewardedAd({
        scene: 'daily_limited_unlock_buffer_slot',
        levelId: this.level.themeId,
      }, DAILY_LIMITED_REWARDED_AD_UNIT_ID);
      if (result === 'completed' || result === 'unavailable') {
        this.extraBufferSlotUnlocked = true;
        analytics.track('daily_limited_buffer_unlock', {
          mode: 'daily_limited',
          level_id: this.level.dayOfMonth,
          theme_id: this.level.themeId,
          result,
          collected_count: this.collected,
          buffer_size: this.buffer.length,
        });
        this.toast(result === 'completed' ? '已解锁额外格子' : '广告不可用，已临时解锁');
      } else if (result === 'skipped') {
        this.toast('看完广告才能解锁');
      } else {
        this.toast('广告加载失败，请稍后再试');
      }
    } finally {
      this.unlockBufferAdBusy = false;
      this.renderBuffer();
      // 解锁额外格子后空间从 7 满变成 7/8，需要立刻退出红色预警。
      this.evaluateBufferPanic();
    }
  }

  private useTool(kind: DailyToolKind): void {
    if (this.roundEnded || this.bufferMatchResolving || this.toolCounts[kind] <= 0 || this.toolRewardedAdBusy) {
      if (this.toolCounts[kind] <= 0) {
        this.toast('本局使用次数已用完');
      }
      return;
    }
    const unavailableReason = this.getToolUnavailableReason(kind);
    if (unavailableReason) {
      this.toast(unavailableReason);
      return;
    }
    this.showToolHelpPanel(kind);
  }

  private async useToolWithRewardedAd(kind: DailyToolKind): Promise<void> {
    if (this.roundEnded || this.bufferMatchResolving || this.toolCounts[kind] <= 0 || this.toolRewardedAdBusy) {
      return;
    }
    const unavailableReason = this.getToolUnavailableReason(kind);
    if (unavailableReason) {
      this.toast(unavailableReason);
      return;
    }
    this.toolRewardedAdBusy = true;
    try {
      const result = await showRewardedAd({
        scene: `daily_limited_tool_${kind}`,
        levelId: this.level.themeId,
      }, DAILY_LIMITED_REWARDED_AD_UNIT_ID);
      if (result !== 'completed' && result !== 'unavailable') {
        this.toast(result === 'skipped' ? '看完广告才能使用道具' : '广告加载失败，请稍后再试');
        return;
      }
      this.executeTool(kind, 'ad');
    } finally {
      this.toolRewardedAdBusy = false;
    }
  }

  private useToolWithCoins(kind: DailyToolKind): boolean {
    if (this.roundEnded || this.bufferMatchResolving || this.toolCounts[kind] <= 0 || this.toolRewardedAdBusy) {
      if (this.toolCounts[kind] <= 0) {
        this.toast('本局使用次数已用完');
      }
      return false;
    }
    const unavailableReason = this.getToolUnavailableReason(kind);
    if (unavailableReason) {
      this.toast(unavailableReason);
      return false;
    }
    const paid = spendCoins(DAILY_LIMITED_TOOL_COIN_COST);
    if (!paid.ok) {
      this.toast(`金币不足，需要${DAILY_LIMITED_TOOL_COIN_COST}金币`);
      return false;
    }
    this.coinBar.refresh();
    this.coinBar.bump();
    this.executeTool(kind, 'coin');
    return true;
  }

  private executeTool(kind: DailyToolKind, source: 'coin' | 'ad'): void {
    if (kind === 'shuffle') {
      this.shuffleRemainingCards();
    } else if (kind === 'undo') {
      this.undoLastClick();
    } else {
      this.liftBufferCards();
    }
    this.toolUsesThisRound[kind] += 1;
    analytics.track('daily_limited_tool_use', {
      mode: 'daily_limited',
      level_id: this.level.dayOfMonth,
      theme_id: this.level.themeId,
      tool_kind: kind,
      source,
      remaining_count: this.toolCounts[kind],
      collected_count: this.collected,
      buffer_size: this.buffer.length,
    });
  }

  private showToolHelpPanel(kind: DailyToolKind): void {
    const sheet = TextureCache.get(DAILY_TOOL_PANELS_TEXTURE_KEY);
    if (!sheet) {
      void this.useToolWithRewardedAd(kind);
      return;
    }

    const panelIndex = DAILY_TOOL_KINDS.indexOf(kind);
    if (panelIndex < 0) {
      return;
    }

    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const overlay = new PIXI.Container();
    overlay.eventMode = 'static';

    const dim = new PIXI.Graphics();
    dim.beginFill(0x1a1510, 0.56);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    dim.eventMode = 'static';
    dim.cursor = 'pointer';
    dim.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.overlayLayer.removeChild(overlay);
      overlay.destroy({ children: true });
    });
    overlay.addChild(dim);

    const colW = Math.floor(sheet.width / 3);
    const x0 = panelIndex * colW;
    const frameW = panelIndex === 2 ? sheet.width - colW * 2 : colW;
    const frame = new PIXI.Texture(sheet.baseTexture, new PIXI.Rectangle(x0, 0, frameW, sheet.height));
    const panel = new PIXI.Container();
    panel.position.set(W / 2, H * 0.46);
    panel.eventMode = 'static';
    panel.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    overlay.addChild(panel);

    const sprite = new PIXI.Sprite(frame);
    sprite.anchor.set(0.5);
    const sc = Math.min((W * 0.88) / frameW, (H * 0.66) / sheet.height, 1.25);
    sprite.scale.set(sc);
    panel.addChild(sprite);

    const panelHalfH = (sheet.height * sc) / 2;
    const coinAction = this.createToolCoinActionButton();
    coinAction.position.set(0, panelHalfH - 174);
    coinAction.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.playButtonSound();
      const used = this.useToolWithCoins(kind);
      if (used) {
        this.overlayLayer.removeChild(overlay);
        overlay.destroy({ children: true });
      }
    });
    panel.addChild(coinAction);

    const adAction = this.createToolAdActionButton();
    adAction.position.set(0, panelHalfH - 96);
    adAction.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.playButtonSound();
      this.overlayLayer.removeChild(overlay);
      overlay.destroy({ children: true });
      void this.useToolWithRewardedAd(kind);
    });
    panel.addChild(adAction);

    const limit = this.level.toolCounts[kind];
    const used = Math.max(0, limit - this.toolCounts[kind]);
    const usageText = new PIXI.Text(`每局限使用${limit}次，当前${used}/${limit}`, {
      fontSize: 24,
      fill: used >= limit ? 0xd94b33 : 0x7a3d16,
      fontWeight: '800',
      stroke: 0xfffff2,
      strokeThickness: 4,
    });
    usageText.anchor.set(0.5);
    usageText.resolution = 2;
    usageText.position.set(0, panelHalfH + 38);
    panel.addChild(usageText);

    this.overlayLayer.addChild(overlay);
  }

  private createToolCoinActionButton(): PIXI.Container {
    const root = this.createToolActionButtonBase(226, 60, 0xffc65a, 0xa86720);
    /** 金币图标右缘到数字左缘 */
    const iconToNumberGap = 14;
    /** 数字与「金币购买」紧挨成一组 */
    const numberToLabelGap = 3;

    const coin = createCoinIcon(28);
    const count = new PIXI.Text(String(DAILY_LIMITED_TOOL_COIN_COST), {
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x6b3a14,
      strokeThickness: 4,
    });
    count.anchor.set(0, 0.5);
    count.resolution = 2;

    const label = new PIXI.Text('金币购买', {
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x6b3a14,
      strokeThickness: 4,
    });
    label.anchor.set(0, 0.5);
    label.resolution = 2;

    const row = new PIXI.Container();
    row.addChild(coin, count, label);

    const coinBounds = coin.getLocalBounds();
    const coinHalfW = Math.max(coinBounds.width * 0.5, 14);
    let x = 0;
    coin.position.set(x + coinHalfW, 0);
    x += coinHalfW * 2 + iconToNumberGap;
    count.position.set(x, 0);
    x += count.width + numberToLabelGap;
    label.position.set(x, 0);

    const rowBounds = row.getBounds();
    row.pivot.set(rowBounds.x + rowBounds.width / 2, rowBounds.y + rowBounds.height / 2);
    root.addChild(row);
    return root;
  }

  private createToolAdActionButton(): PIXI.Container {
    const root = this.createToolActionButtonBase(226, 60, 0x65c7f7, 0x2d6f9f);
    const label = new PIXI.Text('看广告获得', {
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x5a351f,
      strokeThickness: 4,
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    root.addChild(label);
    return root;
  }

  private createToolActionButtonBase(width: number, height: number, fill: number, stroke: number): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-width / 2, -height / 2, width, height);
    const bg = new PIXI.Graphics();
    bg.beginFill(fill);
    bg.lineStyle(4, stroke, 1);
    bg.drawRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    bg.endFill();
    root.addChild(bg);
    return root;
  }

  private shuffleRemainingCards(): void {
    const remaining = this.cards.filter((card) => !card.removed);
    if (remaining.length < 2) {
      return;
    }
    const fruitIds = shuffleWithSeed(
      remaining.map((card) => card.fruitId),
      Date.now() % 100000,
    );
    remaining.forEach((card, index) => {
      card.fruitId = fruitIds[index];
    });
    this.compactRemainingStackCards();
    this.toolCounts.shuffle -= 1;
    AudioManager.playOrderCompleteSound();
    destroyContainerChildren(this.cardLayer);
    this.clearStackRenderCache();
    this.renderAll();
  }

  private compactRemainingStackCards(): void {
    const stackCards = this.cards
      .filter((card) => card.zone === 'stack' && !card.removed)
      .sort((a, b) => (a.depthIndex - b.depthIndex) || (a.columnIndex - b.columnIndex));
    stackCards.forEach((card, index) => {
      // 洗牌后必须把剩余堆叠卡重新压紧。之前只换 fruitId，不改原来的
      // column/depth，已经被点掉的位置会留下空洞，所以看起来像“间距不齐”。
      card.columnIndex = index % CARD_COLS;
      card.depthIndex = Math.floor(index / CARD_COLS);
    });
  }

  private undoLastClick(): void {
    const last = this.history.pop();
    if (!last) {
      return;
    }
    const card = this.cards.find((item) => item.id === last.cardId);
    if (!card) {
      return;
    }
    card.removed = false;
    this.collected = last.prevCollected;
    this.collectedByFruit = { ...last.prevCollectedByFruit };
    this.buffer.splice(0, this.buffer.length, ...last.prevBuffer);
    this.toolCounts.undo -= 1;
    this.roundEnded = false;
    AudioManager.playOrderCompleteSound();
    this.renderAll();
    this.evaluateBufferPanic();
  }

  private liftBufferCards(): void {
    if (this.buffer.length <= 0) {
      return;
    }
    const emptySlots = this.findFlatEmptySlots();
    if (emptySlots.length <= 0) {
      return;
    }
    const liftCount = Math.min(3, this.buffer.length, emptySlots.length);
    const lifted = this.buffer.splice(this.buffer.length - liftCount);
    lifted.forEach((fruitId, index) => {
      const slot = emptySlots[index]!;
      this.cards.push({
        id: `lift_${this.nextLiftCardId}`,
        fruitId,
        columnIndex: slot.columnIndex,
        depthIndex: slot.depthIndex,
        zone: 'lift',
        removed: false,
      });
      this.nextLiftCardId += 1;
    });
    this.toolCounts.lift -= 1;
    AudioManager.playOrderCompleteSound();
    this.renderAll();
    this.evaluateBufferPanic();
  }

  private getToolUnavailableReason(kind: DailyToolKind): string | null {
    if (kind === 'undo') {
      return this.history.length <= 0 ? '还没有可撤销的操作' : null;
    }
    if (kind === 'lift') {
      if (this.buffer.length <= 0) {
        return '暂存栏没有水果可上移';
      }
      if (this.findFlatEmptySlots().length <= 0) {
        return '上方区域已满，不能上移';
      }
      return null;
    }
    const remaining = this.cards.filter((card) => !card.removed);
    return remaining.length < 2 ? '当前没有可洗牌的卡片' : null;
  }

  private findFlatEmptySlots(): Array<{ columnIndex: number; depthIndex: number }> {
    const occupied = new Set(
      this.cards
        .filter((card) => card.zone === 'lift' && !card.removed)
        .map((card) => `${card.depthIndex}:${card.columnIndex}`),
    );
    const slots: Array<{ columnIndex: number; depthIndex: number }> = [];
    for (let row = 0; row < FLAT_ROWS; row += 1) {
      for (let col = 0; col < FLAT_COLS; col += 1) {
        const key = `${row}:${col}`;
        if (!occupied.has(key)) {
          slots.push({ columnIndex: col, depthIndex: row });
        }
      }
    }
    return slots;
  }

  private mountToolButtons(): void {
    destroyContainerChildren(this.toolLayer);
    this.toolViews.clear();
    const buttons: Array<{ kind: DailyToolKind; label: string; icon: string }> = [
      { kind: 'shuffle', label: '洗牌', icon: '↻' },
      { kind: 'undo', label: '撤销', icon: '↶' },
      { kind: 'lift', label: '上移', icon: '↑' },
    ];
    const sheet = TextureCache.get(DAILY_TOOL_BUTTONS_TEXTURE_KEY);
    const totalW = buttons.length * 150 + (buttons.length - 1) * 36;
    const startX = Math.round((Game.logicWidth - totalW) / 2);
    buttons.forEach((button, index) => {
      const root = new PIXI.Container();
      root.position.set(startX + index * 186 + 75, Game.logicHeight - 94);
      root.eventMode = 'static';
      root.cursor = 'pointer';
      root.hitArea = new PIXI.Rectangle(-75, -62, 150, 124);
      root.on('pointertap', () => {
        AudioManager.playButtonSound();
        this.useTool(button.kind);
      });

      let bg: PIXI.Graphics | undefined;
      if (sheet) {
        const colW = Math.floor(sheet.width / 3);
        const x0 = index * colW;
        const w = index === 2 ? sheet.width - colW * 2 : colW;
        const sub = new PIXI.Texture(sheet.baseTexture, new PIXI.Rectangle(x0, 0, w, sheet.height));
        const sp = new PIXI.Sprite(sub);
        sp.anchor.set(0.5);
        const sc = 142 / Math.max(w, sheet.height);
        sp.scale.set(sc);
        root.addChild(sp);
      } else {
        bg = new PIXI.Graphics();
        root.addChild(bg);
        const icon = new PIXI.Text(button.icon, {
          fontSize: 48,
          fill: 0x7be33a,
          fontWeight: '900',
          stroke: 0x2d6b1f,
          strokeThickness: 5,
        });
        icon.anchor.set(0.5);
        icon.resolution = 2;
        icon.position.set(0, -14);
        root.addChild(icon);
        const label = new PIXI.Text(button.label, {
          fontSize: 26,
          fill: 0xffffff,
          fontWeight: '900',
          stroke: 0x5a351f,
          strokeThickness: 5,
        });
        label.anchor.set(0.5);
        label.resolution = 2;
        label.position.set(0, 38);
        root.addChild(label);
      }
      this.toolViews.set(button.kind, { root, bg, kind: button.kind });
      this.toolLayer.addChild(root);
    });
    this.updateToolButtons();
  }

  private updateToolButtons(): void {
    for (const view of this.toolViews.values()) {
      const count = this.toolCounts[view.kind];
      const available = count > 0 && !this.getToolUnavailableReason(view.kind);
      if (view.bg) {
        view.bg.clear();
        view.bg.beginFill(available ? 0xb77a3a : 0x7b6658, 1);
        view.bg.lineStyle(5, available ? 0xf8d28b : 0xbca995, 1);
        view.bg.drawCircle(0, 0, 58);
        view.bg.endFill();
      }
      view.root.alpha = available ? 1 : 0.55;
    }
  }

  private renderIceBowls(): void {
    const W = Game.logicWidth;
    const y = this.bowlY();
    const bowlW = 118;
    const gap = 12;
    const bowlSlots = this.getBowlSlots();
    const totalW = bowlSlots.length * bowlW + (bowlSlots.length - 1) * gap;
    const startX = Math.round((W - totalW) / 2);

    // 碗体布局只与 slot 数量 / 槽水果有关，结构变化时才整体重建。
    const layoutSig = bowlSlots.map((s) => `${s.fruitId}|${s.start}|${s.capacity}`).join(',');
    if (this.iceBowlsSignature !== layoutSig) {
      destroyContainerChildren(this.iceBowlLayer);
      this.iceBowlViews.clear();
      this.iceBowlsSignature = layoutSig;
    }

    for (let i = 0; i < bowlSlots.length; i += 1) {
      const slot = bowlSlots[i]!;
      const x = startX + i * (bowlW + gap) + bowlW / 2;
      const targetCollected = this.collectedByFruit[slot.fruitId] ?? 0;
      const filled = Math.max(0, Math.min(slot.capacity, targetCollected - slot.start));
      // 飞行动画期间，先暂时按"飞入数量"扣减显示数，等 sprite 落位后再补上。
      const hiding = this.bowlIncomingHidden.get(i) ?? 0;
      const visibleFilled = Math.max(0, filled - hiding);
      const fillSig = `${visibleFilled}/${slot.capacity}`;
      let view = this.iceBowlViews.get(i);
      if (!view) {
        view = this.buildIceBowlSlotView(x, y, bowlW, slot);
        this.iceBowlLayer.addChild(view.root);
        this.iceBowlViews.set(i, view);
      }
      if (view.signature !== fillSig) {
        this.updateIceBowlFruits(view, slot, visibleFilled, x, y);
        view.countText.text = `${visibleFilled}/${ICE_BOWL_CAPACITY}`;
        view.signature = fillSig;
      }
    }
  }

  private buildIceBowlSlotView(x: number, y: number, width: number, slot: DailyBowlSlot): IceBowlSlotView {
    const root = new PIXI.Container();
    const tex = TextureCache.get(DAILY_ICE_BOWL_TEXTURE_KEY);
    if (tex) {
      const bowl = new PIXI.Sprite(tex);
      bowl.anchor.set(0.5);
      bowl.scale.set(width / tex.width);
      bowl.position.set(x, y + 24);
      root.addChild(bowl);
    } else {
      const g = new PIXI.Graphics();
      g.beginFill(0xffffff, 0.28);
      g.drawEllipse(x + 8, y + 40, width * 0.48, 16);
      g.endFill();
      g.beginFill(0xbef7ff, 0.36);
      g.lineStyle(3, 0xffffff, 0.84);
      g.moveTo(x - width * 0.44, y - 12);
      g.lineTo(x + width * 0.44, y - 12);
      g.lineTo(x + width * 0.30, y + 42);
      g.quadraticCurveTo(x, y + 58, x - width * 0.30, y + 42);
      g.closePath();
      g.endFill();
      g.beginFill(0xe9ffff, 0.6);
      g.drawEllipse(x, y - 12, width * 0.45, 18);
      g.endFill();
      g.beginFill(0xffffff, 0.42);
      g.drawEllipse(x - 12, y + 60, width * 0.22, 10);
      g.endFill();
      root.addChild(g);
    }

    const fruitsLayer = new PIXI.Container();
    root.addChild(fruitsLayer);

    const countIcon = this.createFruitIcon(slot.fruitId, 30);
    countIcon.position.set(x - 26, y + 88);
    root.addChild(countIcon);

    const countText = new PIXI.Text(`0/${ICE_BOWL_CAPACITY}`, {
      fontSize: 24,
      fill: 0x20718a,
      fontWeight: '900',
      stroke: 0xffffff,
      strokeThickness: 4,
    });
    countText.anchor.set(0.5);
    countText.resolution = 2;
    countText.position.set(x + 17, y + 88);
    root.addChild(countText);

    return { root, fruitsLayer, countText, signature: '' };
  }

  private updateIceBowlFruits(
    view: IceBowlSlotView,
    slot: DailyBowlSlot,
    filled: number,
    x: number,
    y: number,
  ): void {
    destroyContainerChildren(view.fruitsLayer);
    const positions = [
      { x: x - 22, y: y - 2 },
      { x, y: y - 10 },
      { x: x + 22, y: y - 1 },
    ];
    const count = Math.min(filled, positions.length);
    for (let i = 0; i < count; i += 1) {
      const pos = positions[i]!;
      const icon = this.createFruitIcon(slot.fruitId, 42);
      icon.position.set(pos.x, pos.y);
      icon.alpha = 0.92;
      view.fruitsLayer.addChild(icon);
    }
  }

  private getBowlSlots(): DailyBowlSlot[] {
    const slots: DailyBowlSlot[] = [];
    for (const target of this.level.targets) {
      for (let start = 0; start < target.requiredCount; start += ICE_BOWL_CAPACITY) {
        slots.push({
          fruitId: target.fruitId,
          start,
          capacity: ICE_BOWL_CAPACITY,
        });
      }
    }
    return slots;
  }

  private showTargetCollectEncouragement(fruitId: FruitId, collectedForFruit: number): void {
    const center = this.bowlSlotCenterForFruit(fruitId, collectedForFruit);
    const randomIndex = Math.floor(Math.random() * DAILY_TARGET_ENCOURAGEMENTS.length);
    const text = new PIXI.Text(DAILY_TARGET_ENCOURAGEMENTS[randomIndex]!, {
      fontSize: 30,
      fill: 0xfff6a3,
      fontWeight: '900',
      stroke: 0x7a3d16,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    text.anchor.set(0.5);
    text.resolution = 2;
    text.position.set(center.x + (Math.random() - 0.5) * 42, center.y - 42);
    text.scale.set(0.82);
    this.overlayLayer.addChild(text);

    const duration = 780;
    const start = performance.now();
    const startY = text.y;
    const tick = () => {
      if (!this.container.parent || text.destroyed) {
        this.removeTransientTicker(tick);
        if (!text.destroyed) {
          if (text.parent) {
            text.parent.removeChild(text);
          }
          text.destroy();
        }
        return;
      }
      const progress = Math.min(1, (performance.now() - start) / duration);
      const easeOut = 1 - (1 - progress) * (1 - progress);
      text.y = startY - easeOut * 58;
      text.scale.set(0.82 + Math.sin(Math.min(1, progress / 0.28) * Math.PI) * 0.18);
      text.alpha = progress < 0.58 ? 1 : Math.max(0, 1 - (progress - 0.58) / 0.42);
      if (progress >= 1) {
        this.removeTransientTicker(tick);
        if (text.parent) {
          text.parent.removeChild(text);
        }
        text.destroy();
      }
    };
    this.addTransientTicker(tick);
  }

  private bowlSlotCenterForFruit(fruitId: FruitId, collectedForFruit: number): { x: number; y: number } {
    const bowlW = 118;
    const gap = 12;
    const bowlSlots = this.getBowlSlots();
    const totalW = bowlSlots.length * bowlW + (bowlSlots.length - 1) * gap;
    const startX = Math.round((Game.logicWidth - totalW) / 2);
    const collectedIndex = Math.max(0, collectedForFruit - 1);
    const slotIndex = Math.max(
      0,
      bowlSlots.findIndex((slot) => (
        slot.fruitId === fruitId
        && collectedIndex >= slot.start
        && collectedIndex < slot.start + slot.capacity
      )),
    );
    return {
      x: startX + slotIndex * (bowlW + gap) + bowlW / 2,
      y: this.bowlY() + 24,
    };
  }

  private showResultOverlay(success: boolean): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    destroyContainerChildren(this.overlayLayer);

    const dim = new PIXI.Graphics();
    dim.beginFill(0x1b260f, 0.62);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    this.overlayLayer.addChild(dim);

    if (success) {
      dim.eventMode = 'static';
      dim.cursor = 'pointer';
      dim.on('pointertap', () => {
        SceneManager.switchTo('home');
      });
      if (this.lastClearRewardWasFirstToday) {
        this.showDailyClearRewardOverlay(W, H);
      } else {
        this.showDailyRepeatClearOverlay(W, H);
      }
      return;
    }

    const panelW = Math.min(660, W - 56);
    const panelH = 420;
    const panelX = (W - panelW) / 2;
    const panelY = (H - panelH) / 2;
    const panel = this.createCommonModalPanel(panelW, panelH);
    panel.position.set(panelX, panelY);
    this.overlayLayer.addChild(panel);

    const title = new PIXI.Text('挑战失败', {
      fontSize: 42,
      fill: 0xfff0c4,
      fontWeight: '900',
      stroke: 0x7a2d18,
      strokeThickness: 6,
    });
    title.anchor.set(0.5);
    title.resolution = 2;
    title.position.set(W / 2, panelY + 72);
    this.overlayLayer.addChild(title);

    const body = new PIXI.Text(
      '底部格子已经放满了\n继续收集目标水果片再试一次吧',
      {
        fontSize: 28,
        fill: 0xffffff,
        fontWeight: '800',
        stroke: 0x5a3218,
        strokeThickness: 4,
        align: 'center',
        lineHeight: 46,
      },
    );
    body.anchor.set(0.5);
    body.resolution = 2;
    body.position.set(W / 2, panelY + 190);
    this.overlayLayer.addChild(body);

    const retry = this.createPillButton('再来一局', 190, 68, 0x79d64b, 0x2f7a26);
    retry.position.set(W / 2 - 112, panelY + panelH - 76);
    retry.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.startRound();
    });
    this.overlayLayer.addChild(retry);

    const home = this.createPillButton('回首页', 170, 68, 0xffc65a, 0xa86720);
    home.position.set(W / 2 + 128, panelY + panelH - 76);
    home.on('pointertap', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('home');
    });
    this.overlayLayer.addChild(home);
  }

  private createCommonModalPanel(width: number, height: number): PIXI.Container {
    const root = new PIXI.Container();
    const tex = TextureCache.get(BOWL_COMMON_MODAL_PANEL_TEXTURE_KEY);
    if (tex) {
      const panel = new PIXI.NineSlicePlane(tex, 200, 110, 200, 110);
      panel.width = width;
      panel.height = height;
      root.addChild(panel);
    }
    return root;
  }

  private showDailyClearRewardOverlay(W: number, H: number): void {
    const centerX = W / 2;
    const bannerY = H * 0.24;
    const bannerTex = TextureCache.get(DAILY_CLEAR_BANNER_TEXTURE_KEY);
    if (bannerTex) {
      const banner = new PIXI.Sprite(bannerTex);
      banner.anchor.set(0.5);
      banner.scale.set(Math.min((W * 0.9) / bannerTex.width, 190 / bannerTex.height));
      banner.position.set(centerX, bannerY);
      this.overlayLayer.addChild(banner);
    } else {
      const title = new PIXI.Text('恭喜通关每日限定关卡', {
        fontSize: 42,
        fill: 0xfff05a,
        fontWeight: '900',
        stroke: 0x7b2a10,
        strokeThickness: 8,
        dropShadow: true,
        dropShadowBlur: 4,
        dropShadowDistance: 3,
        dropShadowColor: 0x2c1208,
        lineJoin: 'round',
      });
      title.anchor.set(0.5);
      title.resolution = 2;
      title.position.set(centerX, bannerY);
      this.overlayLayer.addChild(title);
    }

    this.overlayLayer.addChild(this.createFloatingReward(centerX - 104, H * 0.45, '金币', `+${DAILY_LIMITED_CLEAR_REWARD_COINS}`, createCoinIcon(56)));
    this.overlayLayer.addChild(this.createRecipeFloatingReward(centerX + 118, H * 0.45));

    const share = this.createShareRewardButton();
    share.position.set(centerX, H * 0.615);
    share.on('pointertap', () => {
      AudioManager.playButtonSound();
      const ok = shareGame({
        title: this.level.recipeCard.shareTitle,
        imageUrl: this.level.recipeCard.path,
        query: `from=share&entry=daily_limited_recipe&theme=${this.level.themeId}`,
      });
      analytics.track('daily_limited_recipe_share', {
        mode: 'daily_limited',
        level_id: this.level.dayOfMonth,
        theme_id: this.level.themeId,
        drink_name: this.level.drinkName,
        ok,
      });
      if (!ok) {
        this.toast('请在微信小游戏中分享');
      }
    });
    this.overlayLayer.addChild(share);

    const shareTip = new PIXI.Text('把制作方法分享给亲友，共享美味吧', {
      fontSize: 22,
      fill: 0xfff4d6,
      fontWeight: '800',
      stroke: 0x4c2a15,
      strokeThickness: 4,
    });
    shareTip.anchor.set(0.5);
    shareTip.resolution = 2;
    shareTip.position.set(centerX, H * 0.67);
    this.overlayLayer.addChild(shareTip);

    const hint = new PIXI.Text('点击空白处返回首页', {
      fontSize: 22,
      fill: 0xffffff,
      fontWeight: '800',
      stroke: 0x2d1a12,
      strokeThickness: 4,
    });
    hint.anchor.set(0.5);
    hint.resolution = 2;
    hint.position.set(centerX, H * 0.9);
    this.overlayLayer.addChild(hint);
  }

  private showDailyRepeatClearOverlay(W: number, H: number): void {
    const centerX = W / 2;
    const bannerY = H * 0.26;
    const bannerTex = TextureCache.get(DAILY_CLEAR_BANNER_TEXTURE_KEY);
    if (bannerTex) {
      const banner = new PIXI.Sprite(bannerTex);
      banner.anchor.set(0.5);
      banner.scale.set(Math.min((W * 0.86) / bannerTex.width, 178 / bannerTex.height));
      banner.position.set(centerX, bannerY);
      this.overlayLayer.addChild(banner);
    }

    this.overlayLayer.addChild(this.createFloatingReward(centerX, H * 0.43, '金币', `+${this.lastClearRewardCoins}`, createCoinIcon(58)));

    const message = new PIXI.Text('今日制作方法已解锁\n明日再来有新惊喜', {
      fontSize: 30,
      fill: 0xfff4d6,
      fontWeight: '900',
      align: 'center',
      lineHeight: 42,
      stroke: 0x4c2a15,
      strokeThickness: 6,
    });
    message.anchor.set(0.5);
    message.resolution = 2;
    message.position.set(centerX, H * 0.62);
    this.overlayLayer.addChild(message);

    const hint = new PIXI.Text('点击空白处返回首页', {
      fontSize: 22,
      fill: 0xffffff,
      fontWeight: '800',
      stroke: 0x2d1a12,
      strokeThickness: 4,
    });
    hint.anchor.set(0.5);
    hint.resolution = 2;
    hint.position.set(centerX, H * 0.84);
    this.overlayLayer.addChild(hint);
  }

  private createFloatingReward(x: number, y: number, title: string, subtitle: string, icon: PIXI.Container): PIXI.Container {
    const root = new PIXI.Container();
    root.position.set(x, y);

    root.addChild(this.createUnlockRewardFx(0, -24));

    icon.position.set(0, -28);
    root.addChild(icon);
    const titleText = new PIXI.Text(title, {
      fontSize: 28,
      fill: 0xfff4d6,
      fontWeight: '900',
      stroke: 0x4c2a15,
      strokeThickness: 5,
    });
    titleText.anchor.set(0.5);
    titleText.resolution = 2;
    titleText.position.set(0, 56);
    root.addChild(titleText);
    const subText = new PIXI.Text(subtitle, {
      fontSize: 26,
      fill: 0xffd463,
      fontWeight: '900',
      stroke: 0x5a2c15,
      strokeThickness: 5,
    });
    subText.anchor.set(0.5);
    subText.resolution = 2;
    subText.position.set(0, 88);
    root.addChild(subText);
    return root;
  }

  private createUnlockRewardFx(x: number, y: number): PIXI.Container {
    const root = new PIXI.Container();
    root.position.set(x, y);

    const glow = new PIXI.Graphics();
    glow.beginFill(0xfff0a6, 0.1);
    glow.drawCircle(0, 0, 86);
    glow.endFill();
    glow.beginFill(0xffffff, 0.12);
    glow.drawCircle(0, 0, 54);
    glow.endFill();
    glow.lineStyle(3, 0xfff7c5, 0.36);
    glow.drawCircle(0, 0, 76);
    root.addChild(glow);

    const rays = new PIXI.Graphics();
    rays.lineStyle(5, 0xfff2a6, 0.62);
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      const inner = 62;
      const outer = i % 2 === 0 ? 108 : 94;
      rays.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      rays.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    }
    root.addChild(rays);

    const diamond = (dx: number, dy: number, size: number, alpha: number) => {
      const g = new PIXI.Graphics();
      g.beginFill(0xfff6c6, alpha);
      g.moveTo(0, -size);
      g.lineTo(size, 0);
      g.lineTo(0, size);
      g.lineTo(-size, 0);
      g.closePath();
      g.endFill();
      g.position.set(dx, dy);
      root.addChild(g);
    };
    diamond(-82, -54, 10, 0.9);
    diamond(82, -50, 9, 0.86);
    diamond(-72, 54, 8, 0.78);
    diamond(74, 46, 9, 0.82);
    diamond(0, -106, 7, 0.76);
    diamond(0, 98, 6, 0.68);

    return root;
  }

  private createRecipeFloatingReward(x: number, y: number): PIXI.Container {
    const icon = new PIXI.Container();
    const tex = TextureCache.get(this.level.recipeCard.textureKey);
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.scale.set(118 / Math.max(tex.width, tex.height));
      icon.addChild(sp);
    } else {
      const fallback = this.createFruitIcon(this.level.targets[0]?.fruitId ?? 'pineapple', 72);
      icon.addChild(fallback);
    }
    const root = this.createFloatingReward(x, y, '制作方法', this.level.drinkName, icon);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-86, -112, 172, 220);
    root.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.playButtonSound();
      this.showRecipeCardPreview();
    });

    const hint = new PIXI.Text('点击查看大图', {
      fontSize: 20,
      fill: 0xfff4d6,
      fontWeight: '800',
      stroke: 0x4c2a15,
      strokeThickness: 4,
    });
    hint.anchor.set(0.5);
    hint.resolution = 2;
    hint.position.set(0, 122);
    root.addChild(hint);
    return root;
  }

  private showRecipeCardPreview(): void {
    const tex = TextureCache.get(this.level.recipeCard.textureKey);
    if (!tex) {
      return;
    }
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const preview = new PIXI.Container();
    preview.eventMode = 'static';
    preview.cursor = 'pointer';
    const dim = new PIXI.Graphics();
    dim.beginFill(0x080808, 0.72);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    preview.addChild(dim);
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    const sc = Math.min((W * 0.84) / tex.width, (H * 0.72) / tex.height);
    sp.scale.set(sc);
    sp.position.set(W / 2, H / 2);
    preview.addChild(sp);
    const catalogNote = new PIXI.Text('已收入图鉴随时查看', {
      fontSize: 24,
      fill: 0xfff4d6,
      fontWeight: '900',
      stroke: 0x2d1a12,
      strokeThickness: 4,
    });
    catalogNote.anchor.set(0.5);
    catalogNote.resolution = 2;
    catalogNote.position.set(W / 2, Math.min(H * 0.86, H / 2 + (tex.height * sc) / 2 + 34));
    preview.addChild(catalogNote);
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
      this.overlayLayer.removeChild(preview);
      preview.destroy({ children: true });
    });
    this.overlayLayer.addChild(preview);
  }

  private createShareRewardButton(): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    const tex = TextureCache.get(DAILY_SHARE_BUTTON_TEXTURE_KEY);
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const sc = Math.min(1, 300 / tex.width, 88 / tex.height);
      sp.scale.set(sc);
      root.hitArea = new PIXI.Rectangle((-tex.width * sc) / 2, (-tex.height * sc) / 2, tex.width * sc, tex.height * sc);
      root.addChild(sp);
      return root;
    }
    return this.createPillButton('分享', 230, 70, 0x9be45c, 0x6c7a19);
  }

  private createPillButton(label: string, width: number, height: number, fill: number, stroke: number): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-width / 2, -height / 2, width, height);
    const bg = new PIXI.Graphics();
    bg.beginFill(fill);
    bg.lineStyle(4, stroke, 1);
    bg.drawRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    bg.endFill();
    root.addChild(bg);
    const text = new PIXI.Text(label, {
      fontSize: Math.round(height * 0.42),
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x5a351f,
      strokeThickness: 4,
    });
    text.anchor.set(0.5);
    text.resolution = 2;
    root.addChild(text);
    return root;
  }

  private toast(title: string): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    api?.showToast?.({ title, icon: 'none', duration: 1200 });
  }

  private boardTop(): number {
    return Game.safeTop + 150;
  }

  private boardHeight(): number {
    return Math.min(580, Game.logicHeight * 0.34);
  }

  private bowlY(): number {
    // 冰碗下方有每个目标水果的关键计数，必须优先保证不被暂存栏遮挡。
    // 因此碗区以底部暂存栏反推定位，而不是继续跟随上方两个水果区累计
    // 下推；真机高屏上能稳定留出计数区。
    return this.bufferY() - 176;
  }

  private flatAreaY(): number {
    return this.boardTop() + this.boardHeight() + 18;
  }

  private bufferY(): number {
    return Game.logicHeight - 258;
  }
}
