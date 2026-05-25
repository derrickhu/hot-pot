import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import { Haptics } from '@/core/Haptics';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { BOWL_BADGES, getBowlBadgeDef } from '@/config/bowlBadges';
import { BOWL_LEVEL_COUNT, getBowlLevelDef, getNewFruitsIntroducedInLevel, type BowlLevelDef } from '@/config/bowlLevels';
import {
  BOWL_RIM_ASSETS,
  BOWL_SOUP_ASSETS,
  DEFAULT_BOWL_RIM_KEY,
  DEFAULT_BOWL_SOUP_KEY,
  type BowlSoupKey,
  getBowlRimKeyForLevel,
  getBowlSkinUnlocksInLevel,
  getBowlSoupKeyForLevel,
} from '@/config/bowlSkins';
import {
  BOWL_THEMES,
  DEFAULT_BOWL_THEME_KEY,
  getBowlTheme,
  getBowlThemeKeyForLevel,
  type BowlThemeDef,
} from '@/config/bowlThemes';
import { BOWL_IMAGES_ROOT } from '@/config/bowlAssets';
import { FRUIT_MAP, type FruitId } from '@/config/fruits';
import { getBowlLevelIndex, recordBowlBadgeUnlocked, setBowlLevelIndex } from '@/game/BowlProgress';
import { submitCurrentBowlProgressRank } from '@/game/RankUpload';
import { analytics, EVENT_NAMES } from '@/analytics';
import { LevelPassRateService } from '@/core/LevelPassRateService';
import {
  canClaimDailyShareToolReward,
  claimDailyShareCleanupReward,
  consumeTool,
  getToolCount,
  toolKindForIndex,
  toolLabel,
  type ToolKind,
} from '@/game/ToolInventory';
import {
  loadBowlSubpackage,
  loadBowlCoreSubpackage,
  loadBowlThemesSubpackage,
  loadBowlBadgesSubpackage,
} from '@/utils/loadBowlSubpackage';
import { TextureCache } from '@/utils/TextureCache';
import { isWxDevtoolsSimulator } from '@/utils/wxMinigameEnv';
import { createBadgeShareCard } from '@/utils/badgeShareCard';
import {
  loadSettingsButtonTexture,
  mountPauseEntryButtonSprite,
  PAUSE_ENTRY_BTN_TEXTURE_KEY,
} from '@/utils/settingsButtonSprite';
import { shareGame, shareGameForReward } from '@/utils/wechatShare';
import { showGameplayRewardedAd, warmupRewardedAd } from '@/utils/rewardedAd';
import { FruitItem } from '@/gameobjects/FruitItem';
import { BowlVfxLayer, type BowlTapFeedbackKind } from '@/gameobjects/bowl/BowlVfxLayer';
import { BowlFailSettlementOverlay } from '@/gameobjects/BowlFailSettlementOverlay';
import { BowlBadgeUnlockOverlay } from '@/gameobjects/BowlBadgeUnlockOverlay';
import { mountBowlBadgeIcon } from '@/gameobjects/BowlBadgeIcon';
import {
  BOWL_FAIL_REVIVE_PANEL_ASSET,
  BOWL_FAIL_REVIVE_PANEL_TEXTURE_KEY,
  BowlReviveOverlay,
} from '@/gameobjects/BowlReviveOverlay';
import {
  BOWL_LEVEL_CLEAR_SIDE_ACTION_BUTTON_ASSET,
  BOWL_LEVEL_CLEAR_SIDE_ACTION_BUTTON_TEXTURE_KEY,
  BOWL_LEVEL_CLEAR_HOME_BUTTON_ASSET,
  BOWL_LEVEL_CLEAR_HOME_BUTTON_TEXTURE_KEY,
  BOWL_NEXT_LEVEL_BUTTON_ASSET,
  BOWL_NEXT_LEVEL_BUTTON_TEXTURE_KEY,
  BOWL_UNLOCK_PANEL_ASSET,
  BOWL_UNLOCK_PANEL_TEXTURE_KEY,
  BowlLevelClearOverlay,
  LEVEL_CLEAR_ACTION_ICONS_ASSET,
  LEVEL_CLEAR_ACTION_ICONS_TEXTURE_KEY,
} from '@/gameobjects/BowlLevelClearOverlay';
import {
  BOWL_PAUSE_PANEL_ASSET,
  BOWL_PAUSE_PANEL_TEXTURE_KEY,
  SettingsPauseOverlay,
} from '@/gameobjects/SettingsPauseOverlay';
import {
  BOWL_TUTORIAL_HAND_ASSET,
  BOWL_TUTORIAL_HAND_TEXTURE_KEY,
  BowlTutorialOverlay,
} from '@/gameobjects/BowlTutorialOverlay';
import {
  BOWL_COMMON_MODAL_BUTTON_ASSET,
  BOWL_COMMON_MODAL_BUTTON_TEXTURE_KEY,
  BOWL_COMMON_MODAL_PANEL_ASSET,
  BOWL_COMMON_MODAL_PANEL_TEXTURE_KEY,
  BowlMechanicIntroOverlay,
  buildIntroIcon,
  type BowlMechanicIntroContent,
} from '@/gameobjects/BowlMechanicIntroOverlay';
import {
  isFirstLevelTutorialDone,
  isMechanicIntroSeen,
  isSecondLevelOrderPlatesTutorialDone,
  markFirstLevelTutorialDone,
  markMechanicIntroSeen,
  markSecondLevelOrderPlatesTutorialDone,
  type MechanicIntroKind,
} from '@/utils/tutorialState';

const BOWL_TOOL_SHEET_TEXTURE = `${BOWL_IMAGES_ROOT}/bowl_tool_buttons.png`;
const BOWL_TOOL_PANELS_TEXTURE = `${BOWL_IMAGES_ROOT}/bowl_tool_panels.png`;
const UI_PANEL_FREE_BTN_TEXTURE = `${BOWL_IMAGES_ROOT}/ui_panel_free_btn.png`;
const BOWL_PLATES_TEXTURE = `${BOWL_IMAGES_ROOT}/bowl_plates.png`;
const BOWL_TOOL_REWARD_ICONS_TEXTURE_KEY = 'bowl_tool_reward_icons';
const BOWL_TOOL_REWARD_ICONS_ASSET = `${BOWL_IMAGES_ROOT}/tool_reward_icons.png`;
const BADGE_SHARE_REWARD_BUTTON_TEXTURE_KEY = 'badge_share_reward_button';
const BADGE_SHARE_REWARD_BUTTON_ASSET = `${BOWL_IMAGES_ROOT}/badge_share_reward_button.png`;
const BOWL_BADGE_UNLOCK_TITLE_TEXTURE_KEY = 'bowl_badge_unlock_title';
const BOWL_BADGE_UNLOCK_TITLE_ASSET = `${BOWL_IMAGES_ROOT}/bowl_badge_unlock_title.png`;
const BOWL_ALL_CLEAR_RIBBON_TITLE_TEXTURE_KEY = 'bowl_all_clear_ribbon_title';
const BOWL_ALL_CLEAR_RIBBON_TITLE_ASSET = `${BOWL_IMAGES_ROOT}/bowl_all_clear_ribbon_title.png`;
const ICE_CUBE_ID: FruitId = 'ice_cube';
const NON_ORDER_FRUIT_IDS = new Set<FruitId>([ICE_CUBE_ID]);

/**
 * 冻果倒计时（毫秒）：进入 buffer 后开始递减，归零自动解冻。
 * 与冰块的差异：冰块只能 Remove 工具/复活清除；冻果会自融，但融化时间留出一定压力，
 * 玩家可主动 Shuffle 立即解冻（顺带打乱碗），或 Remove 直接清槽位。
 */
const FROZEN_FRUIT_THAW_MS = 30000;
const SHUFFLE_DEPTH_SWAP_SEC = 1.15;
const SHUFFLE_ICE_RESURFACE_SEC = 22;
const SHUFFLE_ICE_HOLD_SUBMERGED_RATIO = 0.9;
const LEVEL_PASS_RATE_HINT_MS = 2800;

/** 菜碟暂存槽：开局数量与上限（加菜碟工具每次 +1，至多多 2 格） */
const BUFFER_SLOTS_MAX = 7;
const BUFFER_SLOTS_INITIAL = 5;
const BUFFER_SLOT_HEIGHT_RATIO = 60 / 58;
const ORDER_BUBBLE_W = 122;
const ORDER_BUBBLE_H = 56;
const ORDER_BUBBLE_ICON_SIDE = 38;
const ORDER_PLATE_ROW_OFFSET = 162;
const ORDER_BUBBLE_EXTRA_Y = 50;
const ORDER_PLATE_RADIUS = 86;
const ORDER_LOCK_PLATE_RADIUS = 88;
const BUFFER_STRIP_ROW_OFFSET = 208;
const ORDER_PROGRESS_GAP = 14;
const FRUIT_BOB_SPEED = 0.000075;
const FRUIT_ROTATION_SPEED = 0.00048;
const FRUIT_DRIFT_PULSE_SEC = 2.8;
const FRUIT_DRIFT_MAX_X = 16;
const FRUIT_DRIFT_MAX_Y = 11;
const FRUIT_SURFACE_BOB_THRESHOLD = 0.45;
const FRUIT_SUBMERGE_BOB_THRESHOLD = -0.65;
/** 碗面主展示层容量：优先把普通水果留在上层，超过容量的才自然沉到下层。 */
const SURFACE_FILL_TARGET_COUNT = 30;
const SURFACE_FILL_GRID_COLS = 5;
const SURFACE_FILL_GRID_ROWS = 4;
const HIDDEN_RESERVE_REBALANCE_RATIO = 0.35;
const HIDDEN_RESERVE_REBALANCE_MIN_VISIBLE = 36;
const HIDDEN_RESERVE_REBALANCE_MAX_BATCH = 14;
const BOWL_FRUIT_SCALE_MIN = 1.32;
const BOWL_FRUIT_SCALE_MAX = 1.62;
const BOWL_FRUIT_SIZE_MULTIPLIER: Partial<Record<FruitId, number>> = {
  basil_seed: 0.58,
  black_rice: 0.58,
  boba_pearl: 0.58,
  chocolate_chip: 0.58,
  cookie_crumb: 0.58,
  oat_flake: 0.58,
  osmanthus: 0.58,
  pop_boba: 0.58,
  red_bean: 0.58,
  sago: 0.58,

  almond_slice: 0.7,
  bayberry: 0.7,
  blackberry: 0.7,
  blackcurrant: 0.7,
  blueberry: 0.7,
  cherry: 0.7,
  cranberry: 0.7,
  dried_longan: 0.7,
  foxnut: 0.7,
  gooseberry: 0.7,
  grape: 0.7,
  grape_green: 0.7,
  kumquat: 0.7,
  longan: 0.7,
  lotus_seed: 0.7,
  lychee: 0.7,
  mint: 0.7,
  mulberry: 0.7,
  peanut: 0.7,
  raspberry: 0.7,

  chestnut: 0.82,
  cherry_tomato: 0.82,
  coconut_jelly: 0.82,
  crystal_jelly: 0.82,
  grass_jelly: 0.82,
  lily_bulb: 0.82,
  lotus_root: 0.82,
  marshmallow: 0.82,
  mini_mochi: 0.82,
  peach_gum: 0.82,
  plum: 0.82,
  pudding_cube: 0.82,
  pumpkin_cube: 0.82,
  radish_heart: 0.82,
  red_date: 0.82,
  snow_fungus: 0.82,
  sour_plum: 0.82,
  sweet_potato: 0.82,
  taro_ball: 0.82,
  taro_dice: 0.82,
  walnut_piece: 0.82,
  water_chestnut: 0.82,
};

/** 与开局 5 格一致的左右留白与槽间距（用于固定「基准槽宽高」） */
const BUFFER_STRIP_PAD = 10;
const BUFFER_STRIP_GAP_BASE = 6;
const ORDER_PROGRESS_TICK_COUNT = 6;
const ORDER_PROGRESS_TRACK_W = 500;
const ORDER_PROGRESS_BADGE_SIZE = 72;
const ORDER_PROGRESS_BADGE_GAP = 28;

function orderProgressRootX(logicWidth: number): number {
  return Math.round((logicWidth - (ORDER_PROGRESS_TRACK_W + ORDER_PROGRESS_BADGE_GAP + ORDER_PROGRESS_BADGE_SIZE)) / 2);
}

function bufferStripBaseSlotSize(logicWidth: number): { pad: number; slotW: number; slotH: number } {
  const n0 = BUFFER_SLOTS_INITIAL;
  const slotW = Math.floor(
    (logicWidth - 2 * BUFFER_STRIP_PAD - (n0 - 1) * BUFFER_STRIP_GAP_BASE) / n0,
  );
  const slotH = Math.round(slotW * BUFFER_SLOT_HEIGHT_RATIO);
  return { pad: BUFFER_STRIP_PAD, slotW, slotH };
}

/** 菜碟始终排在可用横向空间内；加格时缩短单个盘子，保持正间距，避免互相叠住。 */
function computeBufferStripLayout(activeCount: number, logicWidth: number) {
  const n = Math.max(1, Math.min(activeCount, BUFFER_SLOTS_MAX));
  const { pad, slotW: baseW, slotH: baseH } = bufferStripBaseSlotSize(logicWidth);
  const space = logicWidth - 2 * pad;

  let slotW: number;
  let slotH: number;
  let gap: number;

  if (n <= 1) {
    slotW = Math.min(baseW, space);
    slotH = Math.round(slotW * BUFFER_SLOT_HEIGHT_RATIO);
    gap = 0;
  } else {
    gap = BUFFER_STRIP_GAP_BASE;
    slotW = Math.floor((space - (n - 1) * gap) / n);
    slotH = n <= BUFFER_SLOTS_INITIAL ? baseH : Math.round(slotW * BUFFER_SLOT_HEIGHT_RATIO);
  }

  const totalW = n * slotW + (n - 1) * gap;
  const startX = Math.round((logicWidth - totalW) / 2);
  const cornerR = Math.max(5, Math.round(7 * (slotW / 58)));
  return { n, slotW, slotH, gap, startX, cornerR };
}

type PlateIdx = 0 | 1 | 2 | 3;

type FlowSprite = PIXI.Sprite & {
  flowBaseAlpha?: number;
  flowBaseScale?: number;
  flowSpeed?: number;
  flowFlipX?: number;
  flowFlipY?: number;
};

type SoupSurfaceSprite = PIXI.Sprite & {
  flowBaseRotation?: number;
  flowBaseScaleX?: number;
  flowBaseScaleY?: number;
  flowSpeed?: number;
};

type SoupDisplacementSprite = PIXI.Sprite & {
  flowVX?: number;
  flowVY?: number;
};

type SoupBubble = PIXI.Graphics & {
  baseX?: number;
  baseY?: number;
  radius?: number;
  phase?: number;
  driftX?: number;
  driftY?: number;
  baseAlpha?: number;
};

type SoupRollPatch = PIXI.Graphics & {
  baseX?: number;
  baseY?: number;
  baseRot?: number;
  baseScaleX?: number;
  baseScaleY?: number;
  baseAlpha?: number;
  driftX?: number;
  driftY?: number;
  phase?: number;
  spin?: number;
};

/** 四枚圆盘（左起两单 + 两格解锁）圆心 X，整体在 logicWidth 内居中，避免贴边裁切 */
function computeOrderPlateCenters(logicWidth: number): [number, number, number, number] {
  const radii = [58, 58, 60, 60] as const;
  const gap = 20;
  const xc: number[] = [];
  let c = radii[0];
  xc.push(c);
  for (let i = 1; i < 4; i += 1) {
    c += radii[i - 1] + gap + radii[i];
    xc.push(c);
  }
  const leftEdge = xc[0]! - radii[0];
  const rightEdge = xc[3]! + radii[3];
  const span = rightEdge - leftEdge;
  const offset = (logicWidth - span) / 2 - leftEdge;
  return [
    xc[0]! + offset,
    xc[1]! + offset,
    xc[2]! + offset,
    xc[3]! + offset,
  ];
}

const TOOL_SLOT_XS = [132, 375, 618] as const;
const TOOL_SLOT_Y = () => Game.logicHeight - 118;

/** 碗口整体相对原比例再上移（像素），与底栏三钮拉开 */
const BOWL_CENTER_Y_SHIFT = -80;
const TOOL_LABELS = ['加菜碟', '移除', '打乱'] as const;
const TOOL_FALLBACK_COLORS = [0xd85e4d, 0xde6b3f, 0x73ac4a] as const;

/** 底部三钮较长边在逻辑坐标下的目标长度（曾用 100，与 designWidth 成比便于读与点） */
function toolButtonDisplayTarget(): number {
  return Math.round(Game.logicWidth * 0.22);
}

interface OrderBubbleView {
  container: PIXI.Container;
  iconBg: PIXI.Graphics;
  /** 订单水果缩略图（assets …/<id>_1.png） */
  iconSprite: PIXI.Sprite;
  /** 无下一单 / 未加载时用 */
  iconPlaceholder: PIXI.Text;
  countText: PIXI.Text;
}

function shuffle<T>(items: T[]): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export class BowlScene implements Scene {
  readonly name = 'bowl';
  readonly container = new PIXI.Container();

  private readonly failSettlementOverlay = new BowlFailSettlementOverlay(Game.logicWidth, Game.logicHeight);
  private readonly badgeUnlockOverlay = new BowlBadgeUnlockOverlay(Game.logicWidth, Game.logicHeight);
  private readonly reviveOverlay = new BowlReviveOverlay(Game.logicWidth, Game.logicHeight);
  private readonly levelClearOverlay = new BowlLevelClearOverlay(Game.logicWidth, Game.logicHeight);
  private readonly settingsOverlay: SettingsPauseOverlay;
  private readonly tutorialOverlay = new BowlTutorialOverlay(Game.logicWidth, Game.logicHeight);
  private readonly mechanicIntroOverlay = new BowlMechanicIntroOverlay(Game.logicWidth, Game.logicHeight);
  /** 待进游戏前依次弹出的「机制说明」队列（每弹一项确认后弹下一项） */
  private pendingMechanicIntros: MechanicIntroKind[] = [];
  /**
   * 第一关引导：分两个阶段
   * - 'order'：先指首单气泡，告诉玩家任务（点击任意处继续）；
   * - 'fruit'：依次指引点击对应水果，直至本单完成。
   */
  private tutorialActive = false;
  private tutorialStep: 'order' | 'fruit' | 'orderPlates' | null = null;
  private tutorialTargetFruit: FruitItem | null = null;
  /** 引导期间锁定的目标订单盘索引，用于在交付完成时判断是否结束引导 */
  private tutorialPlateIdx: PlateIdx | null = null;
  private readonly bowlCenter = new PIXI.Point(
    Game.logicWidth / 2,
    Game.logicHeight * 0.66 + BOWL_CENTER_Y_SHIFT,
  );
  /** 与贴图横向占满 ~98% logicWidth 后的可视碗口大致一致 */
  private readonly bowlRadiusX = 368;
  private readonly bowlRadiusY = 328;
  private readonly fruitLayer = new PIXI.Container();
  private readonly submergedFruitLayer = new PIXI.Container();
  private readonly surfaceFruitLayer = new PIXI.Container();
  private readonly flyingFruitLayer = new PIXI.Container();
  private readonly bowlVfxLayer = new BowlVfxLayer();
  private readonly uiVfxLayer = new BowlVfxLayer();
  private readonly soupOverlayLayer = new PIXI.Container();
  private readonly soupDetailLayer = new PIXI.Container();
  private readonly soupDepthVeilLayer = new PIXI.Container();
  private readonly soupDepthVeil = new PIXI.Graphics();
  private readonly soupRollLayer = new PIXI.Container();
  private readonly soupEdgeWave = new PIXI.Graphics();
  private readonly soupRippleLayer = new PIXI.Container();
  private readonly soupBubbleLayer = new PIXI.Container();
  private readonly soupEdgeBubbleLayer = new PIXI.Container();
  private readonly soupFlowLayer = new PIXI.Container();
  private readonly soupSurfaceOverlaySprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
  private readonly soupFlowSprites: PIXI.Sprite[] = [];
  private readonly soupRollItems: SoupRollPatch[] = [];
  private readonly soupBubbleItems: SoupBubble[] = [];
  private readonly soupEdgeBubbleItems: SoupBubble[] = [];
  private readonly soupDetailItems: PIXI.Container[] = [];
  private readonly soupDisplacementSprite = new PIXI.Sprite(PIXI.Texture.EMPTY) as SoupDisplacementSprite;
  private soupDisplacementFilter: PIXI.DisplacementFilter | null = null;
  private submergedDisplacementFilter: PIXI.DisplacementFilter | null = null;
  private submergedBlurFilter: PIXI.BlurFilter | null = null;
  private submergedColorFilter: PIXI.ColorMatrixFilter | null = null;
  private readonly bowlContentMask = new PIXI.Graphics();
  private soupRippleTime = 0;
  private soupDisturbanceSec = 0;
  private currentSoupKey: BowlSoupKey = DEFAULT_BOWL_SOUP_KEY;
  /** 碗内叠放顺序（自下而上）：水晶碗沿 → 汤 → 程序兜底汤 */
  private readonly bowlStack = new PIXI.Container();
  private readonly plateOrderRefPoint = new PIXI.Point(98, Game.safeTop + 150);
  private readonly orderProgressRoot = new PIXI.Container();
  private readonly orderProgressTrack = new PIXI.Graphics();
  private readonly orderProgressFill = new PIXI.Graphics();
  private readonly orderProgressTicks: PIXI.Graphics[] = [];
  private readonly orderProgressBadgeRoot = new PIXI.Container();
  private readonly orderProgressText = new PIXI.Text('', {
    fontSize: 18,
    fill: 0x6f533c,
    fontWeight: '800',
  });
  private readonly orderViews: OrderBubbleView[] = [];
  /** 底部暂存槽：子节点 [背景, 水果挂载点] */
  private readonly slotStripHolders: PIXI.Container[] = [];
  /** 与 slotStripHolders 一一对应，水果 parent 到此节点（中心对齐槽） */
  private readonly bufferSlotAnchors: PIXI.Container[] = [];
  /** 暂存槽内的水果；与关卡 bufferSize 等长 */
  private bufferSlots: (FruitItem | null)[] = [];
  /** 水果飞向暂存槽期间先预占槽位，避免快速点击把多颗水果分配到同一槽 */
  private readonly pendingBufferSlotIndexes = new Set<number>();
  private bufferFlightBusy = false;
  /** 订单圆盘：用于贴图替换 */
  private readonly plateVisualHolders: Array<{
    holder: PIXI.Container;
    radius: number;
    locked: boolean;
    iconLayer: PIXI.Container;
  }> = [];
  /** 旧版全局图标层保留为空；盘上图标实际挂在各 plate holder 内，避免新解锁盘被遮挡 */
  private readonly plateIconLayer = new PIXI.Container();
  /** 与 createPlate 圆心 X 一致，用于订单气泡、盘上收集图标；四枚盘整体居中 */
  private orderPlateCenterX: [number, number, number, number] = [0, 0, 0, 0];
  /** 与 createPlate(…, panelTop+118, …) 圆心 Y 一致 */
  private orderPlateRowY = 0;

  /** 底部菜碟行 Y（逻辑坐标） */
  private bufferStripRowY = 0;
  /** 第三只圆盘（原「解锁」位）上的锁提示，复活后隐藏 */
  private thirdPlateLockDecor!: PIXI.Container;
  private fourthPlateLockDecor!: PIXI.Container;

  private fruits: FruitItem[] = [];
  private hiddenReserveFruits: FruitItem[] = [];
  /** 并行订单：广告/复活可逐步解锁更多订单入口 */
  private parallelPlateCount: 2 | 3 | 4 = 2;
  /** 订单盘飞行动画中的预占进度，防止快速点击把同一订单投超 */
  private pendingOrderPlateCounts: [number, number, number, number] = [0, 0, 0, 0];
  private parallelOrders: [
    { fruitId: FruitId; progress: number } | null,
    { fruitId: FruitId; progress: number } | null,
    { fruitId: FruitId; progress: number } | null,
    { fruitId: FruitId; progress: number } | null,
  ] = [null, null, null, null];
  private remainingCounts = {} as Record<FruitId, number>;
  private loaded = false;
  /** 当前关卡：订单目标数、暂存槽位数、可出现水果种类 */
  private levelDef!: BowlLevelDef;
  private levelFruitIds: FruitId[] = [];
  /** 可进入订单的食材；冰块/干扰物只生成在碗里，不进入订单池。 */
  private orderFruitIds: FruitId[] = [];
  /** 每个订单需要的个数（来自关卡 orderTarget） */
  private orderSize = 3;
  /** 当前可用菜碟槽数 5～7 */
  private bufferSize = BUFFER_SLOTS_INITIAL;
  private driftAccumSec = 0;
  /** Shuffle 后短暂锁住上下层互换结果，增强搅拌反馈 */
  private shuffleDepthSwapSec = 0;
  /** Shuffle 后让冰块先沉底，再逐步浮回上层 */
  private shuffleIceResurfaceSec = 0;
  /** 本关仍需完成的订单数（每完成一盘 xN 订单 −1） */
  private ordersRemaining = 0;
  private totalOrdersForProgress = 0;
  private hasShownClearForRound = false;
  /** 本关开始时间戳（毫秒），通关 / 失败时计算时长上报 analytics */
  private roundStartTs = 0;
  private orderTransitionBusy = false;
  private currentTheme: BowlThemeDef = getBowlTheme(DEFAULT_BOWL_THEME_KEY);
  private readonly themeBg = new PIXI.Graphics();
  private readonly themeBackdropSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
  private readonly themeHeaderDecor = new PIXI.Graphics();
  private readonly themeBoard = new PIXI.Graphics();
  private hudPillBg!: PIXI.Graphics;
  private hudLevelText!: PIXI.Text;
  /** 餐盖图标，与参考图一致放在关卡与剩余订单数之间 */
  private hudCloche = new PIXI.Container();
  private hudRemainderText!: PIXI.Text;
  private readonly levelPassRateHintRoot = new PIXI.Container();
  private levelPassRateHintTimer: ReturnType<typeof setTimeout> | null = null;

  /** 底部三工具槽（预加载后可能换为雪碧条贴图） */
  private readonly toolSlots: PIXI.Container[] = [];
  private readonly toolInventoryBadges: PIXI.Container[] = [];
  private readonly toolInventoryBadgeTexts: PIXI.Text[] = [];

  /**
   * 暂存盘全满（占用 === bufferSize）时进入"紧迫态"：
   *   - 每个菜碟槽单独红色圆角描边 + 外圈柔光，整排同步「呼吸」缩放提醒
   *   - 底部"加菜碟 / 移除"按钮自身脉冲 + 救场气泡
   *   - 警告音节奏重播
   * 任意一格变空立即退出。`tutorialActive` 期间一律不触发，避免抢戏。
   */
  private bufferPanicActive = false;
  private bufferPanicElapsedSec = 0;
  private bufferPanicNextSfxAt = 0;
  private bufferPanicSfxCount = 0;
  private readonly bufferPanicFxLayer = new PIXI.Container();
  /** 每槽一组：复制菜碟 sprite 并染红放在原盘后方，用贴图 alpha 轮廓生成真实盘形描边 */
  private readonly bufferPanicSlotRings: Array<{
    root: PIXI.Container;
    glow: PIXI.Sprite;
    edge: PIXI.Sprite;
    plateSprite: PIXI.Sprite | null;
    fruitAnchor: PIXI.Container | null;
    baseScaleX: number;
    baseScaleY: number;
    anchorBaseScaleX: number;
    anchorBaseScaleY: number;
  }> = [];
  /** 与 toolSlots 同长度；仅 0=加菜碟、1=移除 启用，2=打乱保持 null */
  private readonly toolPanicHints: Array<{
    halo: PIXI.Graphics;
    bubble: PIXI.Container;
    bubbleBaseY: number;
    slotBaseScale: number;
  } | null> = [null, null, null];

  /** 底栏三钮说明弹层（剪贴板式面板雪碧图） */
  private readonly toolHelpOverlay = new PIXI.Container();
  private readonly toolHelpPanelRoot = new PIXI.Container();
  private readonly toolHelpSprite = new PIXI.Sprite();
  private readonly toolHelpCloseBtn = new PIXI.Container();
  private readonly toolHelpFreeBtn = new PIXI.Sprite();
  private readonly toolHelpInventoryBtn = new PIXI.Container();
  private readonly toolHelpInventoryText = new PIXI.Text('', {
    fontSize: 36,
    fill: 0x2e5262,
    fontWeight: '900',
    stroke: 0xeaf8ff,
    strokeThickness: 4,
    lineJoin: 'round',
  });
  /** 仅在 Shuffle 面板叠加的「冻果可解冻」补充说明（图片面板已烘焙文案，这里小字补丁） */
  private readonly toolHelpExtraNote = new PIXI.Text('', {
    fontSize: 22,
    fill: 0xfff7d6,
    fontWeight: '700',
    stroke: 0x2a1a08,
    strokeThickness: 4,
    align: 'center',
    wordWrap: true,
    wordWrapWidth: Game.logicWidth * 0.78,
  });
  private pendingToolIndex: number | null = null;
  private rewardedAdBusy = false;

  private readonly settingsBtnRoot = new PIXI.Container();
  private readonly gmClearBtnRoot = new PIXI.Container();

  private readonly soupSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
  private readonly rimSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
  private readonly soupProcedural = new PIXI.Container();
  private bowlShadowLayer!: PIXI.Graphics;
  private bowlOuterLayer!: PIXI.Graphics;
  private texturePreloadPromise: Promise<void> | null = null;

  constructor() {
    this.settingsOverlay = new SettingsPauseOverlay(Game.logicWidth, Game.logicHeight, {
      onReplay: () => {
        this.hideToolHelpPanel();
        this.fruitLayer.eventMode = 'static';
        this.startRound();
      },
      onHome: () => {
        this.hideToolHelpPanel();
        this.fruitLayer.eventMode = 'static';
        SceneManager.switchTo('home');
      },
      onContinue: () => {
        this.hideToolHelpPanel();
        this.fruitLayer.eventMode = 'static';
        this.evaluateBufferPanicState();
      },
    });
    this.buildScene();
    // 构造时的预热失败不致命：onEnter 时还会再 ensureTexturesPreloaded 一次，
    // 这里 warn 即可，避免日志面板被 Error 栈刷爆。
    void this.ensureTexturesPreloaded().catch((err) => {
      console.warn('[BowlScene] preload textures failed (will retry on enter):', err?.errMsg || err);
    });
  }

  /** 需暂停操作与计时的顶层弹层（不含暂停设置内的 continue 状态） */
  private isBowlInteractionBlocked(): boolean {
    return (
      this.failSettlementOverlay.visible ||
      this.badgeUnlockOverlay.visible ||
      this.reviveOverlay.visible ||
      this.levelClearOverlay.visible ||
      this.settingsOverlay.visible ||
      this.mechanicIntroOverlay.visible
    );
  }

  onEnter(): void {
    warmupRewardedAd();
    if (!this.loaded) {
      this.ensureTexturesPreloaded()
        .then(() => {
          this.startRound();
        })
        .catch((err) => {
          console.error('Failed to enter bowl scene', err);
        });
      return;
    }

    this.ensureTexturesForLevel(getBowlLevelIndex())
      .then(() => {
        this.startRound();
      })
      .catch((err) => {
        console.error('Failed to load bowl level textures', err);
      });
  }

  prepare(): Promise<void> {
    return this.ensureTexturesPreloaded();
  }

  private ensureTexturesPreloaded(): Promise<void> {
    if (!this.texturePreloadPromise) {
      this.texturePreloadPromise = this.preloadTextures()
        .then(() => {
          this.loaded = true;
        })
        .catch((err) => {
          this.texturePreloadPromise = null;
          throw err;
        });
    }
    return this.texturePreloadPromise;
  }

  update(dt: number): void {
    if (this.isBowlInteractionBlocked()) {
      return;
    }
    this.driftAccumSec += dt;
    const driftPulse = this.driftAccumSec >= FRUIT_DRIFT_PULSE_SEC;
    if (driftPulse) {
      this.driftAccumSec = 0;
    }
    this.shuffleDepthSwapSec = Math.max(0, this.shuffleDepthSwapSec - dt);
    this.shuffleIceResurfaceSec = Math.max(0, this.shuffleIceResurfaceSec - dt);
    this.updateSoupAnimation(dt);

    const now = Date.now();
    for (const fruit of this.fruits) {
      if (fruit.phase !== 'bowl' || fruit.picked) {
        continue;
      }

      if (fruit.hiddenReserve) {
        const bob = Math.sin(now * FRUIT_BOB_SPEED + fruit.bobSeed);
        fruit.rotation = Math.sin(now * FRUIT_ROTATION_SPEED + fruit.bobSeed) * 0.018;
        fruit.display.y = bob * 1.2;
        fruit.zIndex = Math.round(-10000 + fruit.y + fruit.depthJitter * 1000);
        continue;
      }

      if (driftPulse) {
        fruit.velocityX += this.randomInRange(-3.4, 3.4);
        fruit.velocityY += this.randomInRange(-2.4, 2.4);
        fruit.velocityX = Math.max(-FRUIT_DRIFT_MAX_X, Math.min(FRUIT_DRIFT_MAX_X, fruit.velocityX));
        fruit.velocityY = Math.max(-FRUIT_DRIFT_MAX_Y, Math.min(FRUIT_DRIFT_MAX_Y, fruit.velocityY));
      }

      fruit.x += fruit.velocityX * dt;
      fruit.y += fruit.velocityY * dt;

      const { hx, hy } = this.getFruitSoupHalfExtents();
      this.keepFruitInsideBowlEllipse(fruit, hx, hy);

      const bob = Math.sin(now * FRUIT_BOB_SPEED + fruit.bobSeed);
      fruit.rotation = Math.sin(now * FRUIT_ROTATION_SPEED + fruit.bobSeed) * 0.028;
      fruit.display.y = bob * 3.2;
      if (
        this.tutorialActive &&
        this.tutorialStep === 'fruit' &&
        this.tutorialTargetFruit === fruit
      ) {
        /** 引导目标水果强制贴在 surface 层最上方，不允许下沉被其他水果挡住 */
        if (fruit.parent !== this.surfaceFruitLayer) {
          const world = fruit.toGlobal(new PIXI.Point(0, 0));
          fruit.position.copyFrom(this.surfaceFruitLayer.toLocal(world));
          this.surfaceFruitLayer.addChild(fruit);
          this.applyFruitSoupVisual(fruit);
        }
        fruit.zIndex = 1_000_000;
      } else if (fruit.fruitId === ICE_CUBE_ID) {
        /**
         * 冰块是阻挡道具：默认保留在 surface 层。
         * Shuffle 后例外：先全部沉到 submerged，再按进度分批浮回 surface，让搅拌效果更明显。
         * zIndex 与普通水果（≈ y*10）的范围**有意交叉**，让冰块像「在汤里浮沉」：
         *   - 上档（wobble = +1）：y*10 + 3000，明显压在同位置水果之上
         *   - 下档（wobble = -1）：y*10 - 1000，低于同位置水果，会被前景水果盖住一部分
         *   - 平均：略高于同位置普通水果
         * 不同冰块 bobSeed 错相位 → 任意时刻都有冰块浮在上面、有冰块陷在水果之间。
         */
        if (this.shuffleIceResurfaceSec > 0) {
          this.updateShuffleIceDepth(fruit);
          fruit.zIndex = Math.round(fruit.y * 10 - 3200 + fruit.depthJitter * 300);
          continue;
        }
        if (fruit.parent !== this.surfaceFruitLayer) {
          const world = fruit.toGlobal(new PIXI.Point(0, 0));
          fruit.position.copyFrom(this.surfaceFruitLayer.toLocal(world));
          this.surfaceFruitLayer.addChild(fruit);
          this.applyFruitSoupVisual(fruit);
        }
        const iceWobble = Math.sin(now * 0.0006 + fruit.bobSeed * 1.7);
        fruit.zIndex = Math.round(fruit.y * 10 + 1000 + iceWobble * 2000);
      } else if (this.shuffleDepthSwapSec > 0) {
        /** Shuffle 反馈：短暂锁住「上层/下层互换」的结果，再交还给常规汤面沉浮 */
        this.applyFruitSoupVisual(fruit);
        const swapRatio = this.shuffleDepthSwapSec / SHUFFLE_DEPTH_SWAP_SEC;
        const layerBias = fruit.parent === this.surfaceFruitLayer ? 900 : -900;
        fruit.zIndex = Math.round(fruit.y * 10 + fruit.depthJitter * 1000 + layerBias * swapRatio);
      } else {
        this.updateFruitSoupDepth(fruit, bob);
        fruit.zIndex = Math.round(fruit.y * 10 + fruit.depthJitter * 1000);
      }
    }

    this.rebalanceSurfaceFruitFill();
    this.submergedFruitLayer.sortChildren();
    this.surfaceFruitLayer.sortChildren();
    this.flyingFruitLayer.sortChildren();

    this.advanceFrozenBufferTimers(dt);
    this.updateBufferPanicFrame(dt);

    if (this.tutorialActive) {
      this.refreshTutorialHighlight();
      this.tutorialOverlay.update(dt);
    }
  }

  /**
   * 推进 buffer 内冻果的解冻倒计时；归零的冻果原地解冻、隐藏冰块并
   * 刷新一次匹配（让符合订单的水果立即飞盘）。
   */
  private advanceFrozenBufferTimers(dtSec: number): void {
    if (this.bufferSize <= 0) {
      return;
    }
    const dtMs = dtSec * 1000;
    let anyThawed = false;
    for (let i = 0; i < this.bufferSize; i += 1) {
      const f = this.bufferSlots[i];
      if (!f || !f.frozen || f.frostRemainingMs <= 0) {
        continue;
      }
      f.frostRemainingMs = Math.max(0, f.frostRemainingMs - dtMs);
      if (f.frostRemainingMs <= 0) {
        f.setFrozen(false);
        anyThawed = true;
      } else {
        f.refreshFrostTimerLabel();
      }
    }
    if (anyThawed && !this.isBowlInteractionBlocked()) {
      this.tryConsumeOrderFromBuffer();
    }
  }

  private buildScene(): void {
    const headerHeight = Game.safeTop + 78;
    const panelTop = headerHeight;

    this.container.eventMode = 'static';
    this.container.hitArea = new PIXI.Rectangle(0, 0, Game.logicWidth, Game.logicHeight);
    this.container.on('pointerdown', () => {
      this.hideLevelPassRateHint();
    });

    this.themeBackdropSprite.visible = false;
    this.container.addChild(this.themeBg, this.themeBackdropSprite, this.themeHeaderDecor);
    this.paintSceneTheme(this.currentTheme);

    this.settingsBtnRoot.position.set(58, Game.safeTop + 42);
    this.settingsBtnRoot.eventMode = 'static';
    this.settingsBtnRoot.cursor = 'pointer';
    this.mountGameplaySettingsButton();
    this.settingsBtnRoot.on('pointertap', () => {
      if (
        this.failSettlementOverlay.visible ||
        this.badgeUnlockOverlay.visible ||
        this.reviveOverlay.visible ||
        this.levelClearOverlay.visible
      ) {
        return;
      }
      AudioManager.playButtonSound();
      this.hideToolHelpPanel();
      this.exitBufferPanic();
      this.settingsOverlay.visible = true;
      this.fruitLayer.eventMode = 'none';
    });
    this.container.addChild(this.settingsBtnRoot);

    if (isWxDevtoolsSimulator()) {
      this.mountGmClearButton();
      this.container.addChild(this.gmClearBtnRoot);
    } else {
      this.gmClearBtnRoot.visible = false;
      this.gmClearBtnRoot.eventMode = 'none';
    }

    this.hudPillBg = new PIXI.Graphics();
    this.container.addChild(this.hudPillBg);

    const levelText = new PIXI.Text('第1关', {
      fontSize: 26,
      fill: 0xffe58a,
      fontWeight: '900',
      letterSpacing: 1.2,
      stroke: 0x4b2e19,
      strokeThickness: 3,
      // 真机 Canvas 对 PIXI.Text 阴影合成不稳定，容易把按钮文字染出黑边。
      dropShadow: false,
    });
    levelText.anchor.set(0.5);
    this.container.addChild(levelText);
    this.hudLevelText = levelText;

    this.buildHudClocheIcon();
    this.hudCloche.visible = false;
    this.container.addChild(this.hudCloche);

    const countText = new PIXI.Text('0', {
      fontSize: 24,
      fill: 0xf7f0de,
      fontWeight: '700',
    });
    countText.visible = false;
    this.container.addChild(countText);
    this.hudRemainderText = countText;

    this.container.addChild(this.themeBoard);

    this.orderPlateCenterX = computeOrderPlateCenters(Game.logicWidth);
    const pc = this.orderPlateCenterX;
    const bubbleW = ORDER_BUBBLE_W;
    const bubbleLeft = (i: number) => Math.round(pc[i]! - bubbleW / 2);
    const orderPlateY = panelTop + ORDER_PLATE_ROW_OFFSET;

    /** 气泡主体 + 尾巴贴近订单盘，随盘子位置一起下移 */
    const orderBubbleY = orderPlateY - ORDER_PLATE_RADIUS - ORDER_BUBBLE_H - 17 + ORDER_BUBBLE_EXTRA_Y;

    const orderOne = this.createOrderBubble(bubbleLeft(0), orderBubbleY);
    const orderTwo = this.createOrderBubble(bubbleLeft(1), orderBubbleY);
    const orderThree = this.createOrderBubble(bubbleLeft(2), orderBubbleY);
    const orderFour = this.createOrderBubble(bubbleLeft(3), orderBubbleY);
    orderThree.container.visible = false;
    orderFour.container.visible = false;
    this.orderViews.push(orderOne, orderTwo, orderThree, orderFour);

    this.createPlate(pc[0]!, orderPlateY, ORDER_PLATE_RADIUS, false);
    this.createPlate(pc[1]!, orderPlateY, ORDER_PLATE_RADIUS, false);
    this.orderPlateRowY = orderPlateY;
    this.container.addChild(this.plateIconLayer);

    this.createPlate(pc[2]!, orderPlateY, ORDER_LOCK_PLATE_RADIUS, true);
    this.createPlate(pc[3]!, orderPlateY, ORDER_LOCK_PLATE_RADIUS, true);

    this.thirdPlateLockDecor = new PIXI.Container();
    this.thirdPlateLockDecor.position.set(pc[2]!, orderPlateY);
    const lockText1 = this.createCenterText('解锁', 38, 0xf7edcc);
    lockText1.position.set(0, 0);
    this.thirdPlateLockDecor.addChild(lockText1);
    const lockPlay1 = this.createLockPlayTriangle(0xf7edcc);
    lockPlay1.position.set(-40, 0);
    this.thirdPlateLockDecor.addChild(lockPlay1);
    this.container.addChild(this.thirdPlateLockDecor);

    const lockText2 = this.createCenterText('解锁', 38, 0xf7edcc);
    this.fourthPlateLockDecor = new PIXI.Container();
    this.fourthPlateLockDecor.position.set(pc[3]!, orderPlateY);
    lockText2.position.set(0, 0);
    this.fourthPlateLockDecor.addChild(lockText2);
    const lockPlay2 = this.createLockPlayTriangle(0xf7edcc);
    lockPlay2.position.set(-40, 0);
    this.fourthPlateLockDecor.addChild(lockPlay2);
    this.container.addChild(this.fourthPlateLockDecor);

    /** 订单气泡：排在所有圆盘、盘上水果图标与解锁装饰之上，避免被遮挡 */
    this.container.addChild(orderOne.container, orderTwo.container, orderThree.container, orderFour.container);

    this.bufferStripRowY = panelTop + BUFFER_STRIP_ROW_OFFSET;
    for (let i = 0; i < BUFFER_SLOTS_MAX; i += 1) {
      const holder = new PIXI.Container();
      const slot = new PIXI.Graphics();
      const anchor = new PIXI.Container();
      anchor.sortableChildren = true;
      holder.addChild(slot, anchor);
      this.slotStripHolders.push(holder);
      this.bufferSlotAnchors.push(anchor);
      this.container.addChild(holder);
    }

    const lay0 = computeBufferStripLayout(BUFFER_SLOTS_INITIAL, Game.logicWidth);
    this.mountOrderProgressDisplay();
    this.orderProgressRoot.position.set(orderProgressRootX(Game.logicWidth), this.bufferStripRowY + lay0.slotH + ORDER_PROGRESS_GAP);
    this.container.addChild(this.orderProgressRoot);

    const bowlShadow = new PIXI.Graphics();
    bowlShadow.beginFill(0x553823, 0.18);
    bowlShadow.drawEllipse(
      this.bowlCenter.x,
      this.bowlCenter.y + 24,
      this.bowlRadiusX * 1.04,
      this.bowlRadiusY * 1.04,
    );
    bowlShadow.endFill();
    bowlShadow.visible = false;
    this.bowlShadowLayer = bowlShadow;
    this.container.addChild(bowlShadow);

    const bowlOuter = new PIXI.Graphics();
    bowlOuter.lineStyle(18, 0x4f3425, 1);
    bowlOuter.beginFill(0xeee4da);
    bowlOuter.drawEllipse(
      this.bowlCenter.x,
      this.bowlCenter.y,
      this.bowlRadiusX + 26,
      this.bowlRadiusY + 35,
    );
    bowlOuter.endFill();
    bowlOuter.visible = false;
    this.bowlOuterLayer = bowlOuter;
    this.container.addChild(bowlOuter);

    const soupRed = new PIXI.Graphics();
    soupRed.beginFill(0xb92f17, 0.94);
    soupRed.drawEllipse(
      this.bowlCenter.x,
      this.bowlCenter.y + 16,
      this.bowlRadiusX - 4,
      this.bowlRadiusY - 7,
    );
    soupRed.endFill();

    const soupGlow = new PIXI.Graphics();
    soupGlow.beginFill(0xff7d2d, 0.18);
    soupGlow.drawEllipse(
      this.bowlCenter.x - 30,
      this.bowlCenter.y - 12,
      this.bowlRadiusX * 0.76,
      this.bowlRadiusY * 0.59,
    );
    soupGlow.endFill();

    const bowlGloss = new PIXI.Graphics();
    bowlGloss.beginFill(0xffffff, 0.16);
    bowlGloss.drawEllipse(this.bowlCenter.x - 92, this.bowlCenter.y - 84, 128, 60);
    bowlGloss.endFill();

    this.soupProcedural.addChild(soupRed, soupGlow, bowlGloss);
    this.soupProcedural.visible = false;

    this.fruitLayer.sortableChildren = false;
    this.submergedFruitLayer.sortableChildren = true;
    this.surfaceFruitLayer.sortableChildren = true;
    this.flyingFruitLayer.sortableChildren = true;
    this.soupOverlayLayer.eventMode = 'none';
    this.soupDetailLayer.eventMode = 'none';
    this.soupDepthVeilLayer.eventMode = 'none';
    this.soupDepthVeil.eventMode = 'none';
    this.soupRollLayer.eventMode = 'none';
    this.soupEdgeWave.eventMode = 'none';
    this.soupRippleLayer.eventMode = 'none';
    this.soupBubbleLayer.eventMode = 'none';
    this.soupEdgeBubbleLayer.eventMode = 'none';
    this.soupOverlayLayer.addChild(this.soupRippleLayer);
    this.bowlContentMask.eventMode = 'none';
    this.bowlContentMask.renderable = false;
    this.submergedFruitLayer.mask = this.bowlContentMask;
    this.soupOverlayLayer.mask = this.bowlContentMask;
    this.soupDepthVeilLayer.mask = this.bowlContentMask;
    this.surfaceFruitLayer.mask = this.bowlContentMask;
    this.soupDetailLayer.mask = this.bowlContentMask;
    this.soupEdgeBubbleLayer.mask = this.bowlContentMask;
    this.bowlVfxLayer.mask = this.bowlContentMask;
    this.uiVfxLayer.eventMode = 'none';

    this.rimSprite.anchor.set(0.5);
    this.rimSprite.position.set(this.bowlCenter.x, this.bowlCenter.y);
    this.rimSprite.visible = false;

    this.soupSprite.anchor.set(0.5);
    this.soupSprite.position.set(this.bowlCenter.x, this.bowlCenter.y);
    this.soupSprite.visible = false;
    this.soupFlowLayer.eventMode = 'none';
    this.soupFlowLayer.visible = false;

    this.bowlStack.addChild(this.rimSprite);
    this.bowlStack.addChild(this.soupSprite);
    this.bowlStack.addChild(this.soupFlowLayer);
    this.bowlStack.addChild(this.soupProcedural);
    this.prepareSoupDisplacement();
    this.bowlStack.addChild(this.soupDisplacementSprite);
    this.bowlStack.visible = false;
    this.container.addChild(this.bowlStack);

    this.fruitLayer.addChild(
      this.submergedFruitLayer,
      this.soupOverlayLayer,
      this.soupDepthVeilLayer,
      this.surfaceFruitLayer,
      this.soupDetailLayer,
      this.flyingFruitLayer,
      this.bowlVfxLayer,
      this.soupEdgeBubbleLayer,
    );
    this.fruitLayer.addChild(this.bowlContentMask);
    this.container.addChild(this.fruitLayer);

    this.bufferPanicFxLayer.eventMode = 'none';
    this.bufferPanicFxLayer.visible = false;
    this.container.addChild(this.bufferPanicFxLayer);

    const toolY = TOOL_SLOT_Y();
    for (let i = 0; i < 3; i += 1) {
      const slot = new PIXI.Container();
      slot.position.set(TOOL_SLOT_XS[i], toolY);
      slot.addChild(this.createToolButtonFallback(TOOL_LABELS[i], TOOL_FALLBACK_COLORS[i]));
      const inventoryBadge = this.createToolInventoryBadge();
      inventoryBadge.visible = false;
      this.toolInventoryBadges.push(inventoryBadge);
      this.toolInventoryBadgeTexts.push(inventoryBadge.getChildAt(1) as PIXI.Text);
      slot.visible = false;
      this.toolSlots.push(slot);
      slot.eventMode = 'static';
      slot.cursor = 'pointer';
      const slotIndex = i;
      let helpTimer: ReturnType<typeof setTimeout> | null = null;
      let longHelpShown = false;
      slot.on('pointerdown', () => {
        if (this.isBowlInteractionBlocked()) {
          return;
        }
        longHelpShown = false;
        helpTimer = setTimeout(() => {
          helpTimer = null;
          longHelpShown = true;
          this.showToolHelpPanel(slotIndex);
        }, 480);
      });
      const clearToolTimer = () => {
        if (helpTimer !== null) {
          clearTimeout(helpTimer);
          helpTimer = null;
        }
      };
      /** 微信/部分 WebView 触控常以 pointercancel 结束，仅监听 pointerup 会漏掉短按 */
      const onToolSlotRelease = (): void => {
        if (this.isBowlInteractionBlocked()) {
          clearToolTimer();
          return;
        }
        const wasTimer = helpTimer !== null;
        clearToolTimer();
        if (!longHelpShown && wasTimer) {
          AudioManager.playButtonSound();
          this.showToolHelpPanel(slotIndex);
        }
      };
      slot.on('pointerup', onToolSlotRelease);
      slot.on('pointercancel', onToolSlotRelease);
      slot.on('pointerupoutside', () => {
        clearToolTimer();
      });
      slot.addChild(inventoryBadge);
      this.container.addChild(slot);
    }
    this.container.addChild(this.uiVfxLayer);
    this.container.addChild(this.tutorialOverlay);
    this.container.addChild(this.failSettlementOverlay);
    this.container.addChild(this.badgeUnlockOverlay);
    this.container.addChild(this.reviveOverlay);
    this.container.addChild(this.levelClearOverlay);
    this.buildToolHelpOverlay();
    this.levelPassRateHintRoot.visible = false;
    this.levelPassRateHintRoot.eventMode = 'none';
    this.container.addChild(this.levelPassRateHintRoot);
    this.container.addChild(this.settingsOverlay);
    /** 机制说明面板需要盖住所有玩法层，但低于 settings 暂停面板（暂停优先级最高） */
    this.container.addChild(this.mechanicIntroOverlay);

    this.applyBufferStripLayout();

    const p0 = this.getPlateSlotWorld(0, 0);
    this.plateOrderRefPoint.set(p0.x, p0.y);
  }

  private applySceneThemeForLevel(): void {
    const themeKey = this.levelDef.themeKey ?? getBowlThemeKeyForLevel(this.levelDef.levelNumber);
    this.currentTheme = getBowlTheme(themeKey);
    this.paintSceneTheme(this.currentTheme);
    this.hudLevelText.style.fill = this.currentTheme.hudText;
    this.hudLevelText.style.stroke = this.currentTheme.hudOuter;
    this.hudRemainderText.style.fill = this.currentTheme.hudText;
  }

  private paintSceneTheme(theme: BowlThemeDef): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const headerHeight = Game.safeTop + 78;
    const panelTop = headerHeight;
    const tex = TextureCache.get(`bowl_theme_${theme.key}`);

    this.themeBackdropSprite.visible = false;
    if (tex) {
      this.themeBackdropSprite.texture = tex;
      this.themeBackdropSprite.position.set(0, 0);
      const coverScale = Math.max(W / tex.width, H / tex.height);
      this.themeBackdropSprite.scale.set(coverScale);
      this.themeBackdropSprite.x = Math.round((W - tex.width * coverScale) / 2);
      this.themeBackdropSprite.y = Math.round((H - tex.height * coverScale) / 2);
      this.themeBackdropSprite.visible = true;
      this.themeBg.clear();
      this.themeHeaderDecor.clear();
      this.themeBoard.clear();
      return;
    }

    this.themeBg.clear();
    this.themeBg.beginFill(theme.bgTop);
    this.themeBg.drawRect(0, 0, W, H * 0.48);
    this.themeBg.endFill();
    this.themeBg.beginFill(theme.bgBottom);
    this.themeBg.drawRect(0, H * 0.38, W, H * 0.62);
    this.themeBg.endFill();
    this.themeBg.beginFill(0xffffff, 0.18);
    this.themeBg.drawCircle(W * 0.18, H * 0.31, 92);
    this.themeBg.drawCircle(W * 0.82, H * 0.57, 118);
    this.themeBg.endFill();
    this.themeBg.lineStyle(4, theme.headerAccent, 0.18);
    for (let y = panelTop + 36; y < H - 130; y += 92) {
      this.themeBg.moveTo(-20, y);
      this.themeBg.bezierCurveTo(W * 0.25, y - 20, W * 0.45, y + 24, W + 20, y - 8);
    }

    this.themeHeaderDecor.clear();
    this.themeHeaderDecor.beginFill(theme.header, 0.98);
    this.themeHeaderDecor.drawRect(0, 0, W, headerHeight);
    this.themeHeaderDecor.endFill();
    this.themeHeaderDecor.beginFill(theme.headerAccent, 0.18);
    this.themeHeaderDecor.drawRoundedRect(-24, Game.safeTop + 6, W + 48, 48, 22);
    this.themeHeaderDecor.endFill();
    this.themeHeaderDecor.lineStyle(3, theme.headerAccent, 0.36);
    for (let x = 18; x < W; x += 78) {
      this.themeHeaderDecor.moveTo(x, 0);
      this.themeHeaderDecor.lineTo(x + 18, headerHeight);
    }
    this.themeHeaderDecor.beginFill(0xffffff, 0.22);
    for (let x = 32; x < W; x += 104) {
      this.themeHeaderDecor.drawCircle(x, headerHeight - 18, 8);
    }
    this.themeHeaderDecor.endFill();

    this.themeBoard.clear();
    this.themeBoard.beginFill(theme.board, 0.96);
    this.themeBoard.drawRect(0, panelTop, W, 308);
    this.themeBoard.endFill();
    this.themeBoard.beginFill(theme.boardAccent, 0.2);
    this.themeBoard.drawRoundedRect(18, panelTop + 14, W - 36, 126, 28);
    this.themeBoard.endFill();
    this.themeBoard.lineStyle(4, 0xffffff, 0.24);
    this.themeBoard.moveTo(0, panelTop + 308);
    this.themeBoard.lineTo(W, panelTop + 308);
    this.themeBoard.lineStyle(3, theme.boardAccent, 0.32);
    this.themeBoard.moveTo(0, panelTop + 16);
    this.themeBoard.lineTo(W, panelTop + 16);
  }

  private mountOrderProgressDisplay(): void {
    this.orderProgressRoot.removeChildren();
    this.orderProgressRoot.addChild(this.orderProgressTrack, this.orderProgressFill);
    this.orderProgressTicks.length = 0;

    for (let i = 0; i < ORDER_PROGRESS_TICK_COUNT; i += 1) {
      const tick = new PIXI.Graphics();
      this.orderProgressTicks.push(tick);
      this.orderProgressRoot.addChild(tick);
    }

    this.orderProgressBadgeRoot.position.set(ORDER_PROGRESS_TRACK_W + ORDER_PROGRESS_BADGE_GAP, -7);
    this.orderProgressRoot.addChild(this.orderProgressBadgeRoot, this.orderProgressText);
  }

  private refreshOrderProgressDisplay(): void {
    const total = Math.max(1, this.totalOrdersForProgress);
    const completed = Math.max(0, Math.min(total, total - this.ordersRemaining));
    const ratio = this.totalOrdersForProgress > 0 ? completed / total : this.totalRemainingInLevel() <= 0 ? 1 : 0;
    const trackW = ORDER_PROGRESS_TRACK_W;
    const segmentCount = ORDER_PROGRESS_TICK_COUNT;
    const segmentGap = 16;
    const segmentH = 22;
    const segmentY = 18;
    const segmentW = Math.floor((trackW - segmentGap * (segmentCount - 1)) / segmentCount);
    const activeSegments = completed <= 0 ? 0 : Math.min(segmentCount, Math.ceil(ratio * segmentCount));

    this.orderProgressTrack.clear();
    this.orderProgressFill.clear();

    for (let i = 0; i < segmentCount; i += 1) {
      const tick = this.orderProgressTicks[i]!;
      const x = i * (segmentW + segmentGap);
      const active = i < activeSegments;
      tick.clear();
      tick.lineStyle(0);
      tick.beginFill(active ? 0x69d465 : 0xe5e0d5, 1);
      tick.drawRoundedRect(x, segmentY, segmentW, segmentH, segmentH / 2);
      tick.endFill();
    }

    const badge = getBowlBadgeDef(this.levelDef?.levelNumber ?? 1);
    const tex = TextureCache.get(`bowl_badge_${badge.levelNumber}`);
    mountBowlBadgeIcon(this.orderProgressBadgeRoot, badge, tex, ORDER_PROGRESS_BADGE_SIZE, { locked: true });

    this.orderProgressText.text = `${completed}/${total}`;
    this.orderProgressText.position.set(0, 50);
  }

  private async preloadTextures(): Promise<void> {
    await Promise.all([
      loadBowlSubpackage(),
      loadBowlCoreSubpackage(),
      loadBowlThemesSubpackage(),
      loadBowlBadgesSubpackage(),
    ]);
    const jobs: Promise<unknown>[] = [];
    jobs.push(TextureCache.load('bowl_tool_sheet', BOWL_TOOL_SHEET_TEXTURE));
    jobs.push(TextureCache.load('bowl_tool_panels', BOWL_TOOL_PANELS_TEXTURE));
    jobs.push(TextureCache.load('ui_panel_free_btn', UI_PANEL_FREE_BTN_TEXTURE));
    jobs.push(TextureCache.load('bowl_plates', BOWL_PLATES_TEXTURE));
    jobs.push(TextureCache.load(BOWL_TOOL_REWARD_ICONS_TEXTURE_KEY, BOWL_TOOL_REWARD_ICONS_ASSET));
    jobs.push(TextureCache.load(BADGE_SHARE_REWARD_BUTTON_TEXTURE_KEY, BADGE_SHARE_REWARD_BUTTON_ASSET));
    jobs.push(TextureCache.load(BOWL_BADGE_UNLOCK_TITLE_TEXTURE_KEY, BOWL_BADGE_UNLOCK_TITLE_ASSET));
    jobs.push(TextureCache.load(BOWL_ALL_CLEAR_RIBBON_TITLE_TEXTURE_KEY, BOWL_ALL_CLEAR_RIBBON_TITLE_ASSET));
    jobs.push(TextureCache.load(LEVEL_CLEAR_ACTION_ICONS_TEXTURE_KEY, LEVEL_CLEAR_ACTION_ICONS_ASSET));
    jobs.push(TextureCache.load(BOWL_UNLOCK_PANEL_TEXTURE_KEY, BOWL_UNLOCK_PANEL_ASSET));
    jobs.push(TextureCache.load(BOWL_NEXT_LEVEL_BUTTON_TEXTURE_KEY, BOWL_NEXT_LEVEL_BUTTON_ASSET));
    jobs.push(TextureCache.load(BOWL_LEVEL_CLEAR_HOME_BUTTON_TEXTURE_KEY, BOWL_LEVEL_CLEAR_HOME_BUTTON_ASSET));
    jobs.push(TextureCache.load(BOWL_LEVEL_CLEAR_SIDE_ACTION_BUTTON_TEXTURE_KEY, BOWL_LEVEL_CLEAR_SIDE_ACTION_BUTTON_ASSET));
    jobs.push(TextureCache.load(BOWL_PAUSE_PANEL_TEXTURE_KEY, BOWL_PAUSE_PANEL_ASSET));
    jobs.push(TextureCache.load(BOWL_TUTORIAL_HAND_TEXTURE_KEY, BOWL_TUTORIAL_HAND_ASSET));
    jobs.push(TextureCache.load(BOWL_COMMON_MODAL_PANEL_TEXTURE_KEY, BOWL_COMMON_MODAL_PANEL_ASSET));
    jobs.push(TextureCache.load(BOWL_COMMON_MODAL_BUTTON_TEXTURE_KEY, BOWL_COMMON_MODAL_BUTTON_ASSET));
    jobs.push(TextureCache.load(BOWL_FAIL_REVIVE_PANEL_TEXTURE_KEY, BOWL_FAIL_REVIVE_PANEL_ASSET));
    jobs.push(loadSettingsButtonTexture());
    await Promise.all(jobs);
    await this.ensureTexturesForLevel(getBowlLevelIndex());
    this.mountGameplaySettingsButton();
    this.applyBowlArtTextures();
    this.mountToolButtons();
    this.mountBoardPlateArt();
    this.badgeUnlockOverlay.setTitleTexture(TextureCache.get(BOWL_BADGE_UNLOCK_TITLE_TEXTURE_KEY));
    this.tutorialOverlay.setHandTexture(TextureCache.get(BOWL_TUTORIAL_HAND_TEXTURE_KEY));
    this.levelClearOverlay.setSkinTextures(
      TextureCache.get(BOWL_UNLOCK_PANEL_TEXTURE_KEY),
      TextureCache.get(BOWL_NEXT_LEVEL_BUTTON_TEXTURE_KEY),
      TextureCache.get(BOWL_LEVEL_CLEAR_SIDE_ACTION_BUTTON_TEXTURE_KEY),
      TextureCache.get(BOWL_LEVEL_CLEAR_HOME_BUTTON_TEXTURE_KEY),
      TextureCache.get(BOWL_ALL_CLEAR_RIBBON_TITLE_TEXTURE_KEY),
      TextureCache.get(BADGE_SHARE_REWARD_BUTTON_TEXTURE_KEY),
    );
    this.settingsOverlay.setPanelTexture(TextureCache.get(BOWL_PAUSE_PANEL_TEXTURE_KEY));
    this.reviveOverlay.setPanelTexture(TextureCache.get(BOWL_FAIL_REVIVE_PANEL_TEXTURE_KEY));
    this.mechanicIntroOverlay.setSkinTextures(
      TextureCache.get(BOWL_COMMON_MODAL_PANEL_TEXTURE_KEY),
      TextureCache.get(BOWL_COMMON_MODAL_BUTTON_TEXTURE_KEY),
    );
  }

  private async ensureTexturesForLevel(levelIndex: number): Promise<void> {
    const jobs: Promise<unknown>[] = [];
    const addLevel = (index: number): void => {
      const def = getBowlLevelDef(index);
      const levelNumber = def.levelNumber;
      const soupKey = def.soupKey ?? getBowlSoupKeyForLevel(levelNumber);
      const rimKey = def.bowlKey ?? getBowlRimKeyForLevel(levelNumber);
      const themeKey = def.themeKey ?? getBowlThemeKeyForLevel(levelNumber);
      const theme = BOWL_THEMES[themeKey];
      jobs.push(TextureCache.load(`bowl_soup_${soupKey}`, BOWL_SOUP_ASSETS[soupKey]));
      jobs.push(TextureCache.load(`bowl_rim_${rimKey}`, BOWL_RIM_ASSETS[rimKey]));
      jobs.push(TextureCache.load(`bowl_theme_${theme.key}`, theme.backdropAsset));

      const badge = getBowlBadgeDef(levelNumber);
      jobs.push(TextureCache.load(`bowl_badge_${badge.levelNumber}`, badge.asset));
      for (const unlock of getBowlSkinUnlocksInLevel(levelNumber + 1)) {
        if (unlock.kind === 'soup') {
          const key = unlock.key as BowlSoupKey;
          jobs.push(TextureCache.load(`bowl_soup_${key}`, BOWL_SOUP_ASSETS[key]));
        } else {
          const key = unlock.key;
          jobs.push(TextureCache.load(`bowl_rim_${key}`, BOWL_RIM_ASSETS[key]));
        }
      }

      const fruitIds = new Set<FruitId>([
        ...def.fruitIds,
        ...getNewFruitsIntroducedInLevel(Math.min(index + 1, BOWL_LEVEL_COUNT - 1)),
        ICE_CUBE_ID,
      ]);
      for (const fruitId of fruitIds) {
        const fruit = FRUIT_MAP[fruitId];
        if (!fruit) {
          continue;
        }
        jobs.push(TextureCache.load(fruit.id, fruit.asset));
        jobs.push(TextureCache.load(`${fruit.id}__b2`, fruit.bowlAsset2));
      }
    };

    addLevel(levelIndex);
    if (levelIndex + 1 < BOWL_LEVEL_COUNT) {
      addLevel(levelIndex + 1);
    }
    await Promise.all(jobs);
  }

  private mountGameplaySettingsButton(): void {
    mountPauseEntryButtonSprite(this.settingsBtnRoot, TextureCache.get(PAUSE_ENTRY_BTN_TEXTURE_KEY), 82);
  }

  private applyBowlArtTextures(): void {
    const levelNumber = this.levelDef?.levelNumber ?? 1;
    const soupKey = this.levelDef?.soupKey ?? getBowlSoupKeyForLevel(levelNumber);
    const rimKey = this.levelDef?.bowlKey ?? getBowlRimKeyForLevel(levelNumber);
    this.currentSoupKey = soupKey;
    const soupTex =
      TextureCache.get(`bowl_soup_${soupKey}`) ??
      TextureCache.get(`bowl_soup_${DEFAULT_BOWL_SOUP_KEY}`);
    const rimTex =
      TextureCache.get(`bowl_rim_${rimKey}`) ??
      TextureCache.get(`bowl_rim_${DEFAULT_BOWL_RIM_KEY}`);
    const margin = 1.02;
    const bowlW = this.bowlRadiusX * 2 * margin;
    const bowlH = this.bowlRadiusY * 2 * margin;
    /** 碗沿横向占满；汤为碗沿缩放的固定比例，保证多露一圈边 */
    const rimTargetW = Game.logicWidth * 0.995;
    /** 相对碗沿缩放：汤整体比碗小一圈（约 0.82 = 直径约 82%，露边更明显） */
    const soupToRimScale = 0.82;

    let rimScale = 0;
    if (rimTex) {
      this.rimSprite.texture = rimTex;
      const sx = bowlW / rimTex.width;
      const sy = bowlH / rimTex.height;
      const sFit = Math.min(sx, sy) * 0.99;
      const sWide = rimTargetW / Math.max(rimTex.width, rimTex.height);
      rimScale = Math.max(sFit, sWide);
      this.rimSprite.scale.set(rimScale);
      this.rimSprite.visible = true;
    } else {
      this.rimSprite.visible = false;
    }

    if (soupTex) {
      this.soupSprite.texture = soupTex;
      const sx = bowlW / soupTex.width;
      const sy = bowlH / soupTex.height;
      const sFit = Math.min(sx, sy) * 0.98;
      const soupWide = (Game.logicWidth * 0.88) / Math.max(soupTex.width, soupTex.height);
      let sSoup = Math.max(sFit, soupWide);
      if (rimScale > 0) {
        sSoup = Math.min(sSoup, rimScale * soupToRimScale);
      }
      this.soupSprite.scale.set(sSoup);
      this.soupSprite.visible = true;
      this.mountSoupFlowFrames(soupTex, sSoup);
      this.bowlStack.visible = true;
      this.soupProcedural.visible = false;
      this.bowlOuterLayer.visible = false;
      this.bowlShadowLayer.visible = false;
    } else {
      this.soupSprite.visible = false;
      this.soupFlowLayer.visible = false;
      this.bowlStack.visible = false;
      this.soupProcedural.visible = false;
      this.bowlOuterLayer.visible = false;
      this.bowlShadowLayer.visible = false;
    }
    this.redrawSoupOverlay();
  }

  private mountSoupFlowFrames(texture: PIXI.Texture, baseScale: number): void {
    this.soupFlowLayer.removeChildren();
    this.soupFlowSprites.length = 0;
    const frameDefs = [
      { alpha: 0.24, scale: 1.012, rotation: 0.08, speed: 0.13, flipX: 1, flipY: 1, tint: 0xffffff },
      { alpha: 0.2, scale: 1.028, rotation: -0.42, speed: -0.105, flipX: -1, flipY: 1, tint: 0xffffff },
      { alpha: 0.14, scale: 1.044, rotation: 0.82, speed: 0.076, flipX: 1, flipY: -1, tint: 0xffffff },
    ] as const;
    for (const def of frameDefs) {
      const sp = new PIXI.Sprite(texture);
      sp.anchor.set(0.5);
      sp.position.set(this.bowlCenter.x, this.bowlCenter.y);
      sp.scale.set(baseScale * def.scale * def.flipX, baseScale * def.scale * def.flipY);
      sp.rotation = def.rotation;
      sp.alpha = def.alpha;
      sp.tint = def.tint;
      sp.eventMode = 'none';
      const flowSprite = sp as FlowSprite;
      flowSprite.flowBaseAlpha = def.alpha;
      flowSprite.flowBaseScale = baseScale * def.scale;
      flowSprite.flowSpeed = def.speed;
      flowSprite.flowFlipX = def.flipX;
      flowSprite.flowFlipY = def.flipY;
      this.soupFlowSprites.push(sp);
      this.soupFlowLayer.addChild(sp);
    }
    this.soupFlowLayer.visible = true;
  }

  private prepareSoupDisplacement(): void {
    const texture = this.createSoupDisplacementTexture(192);
    if (!texture) {
      return;
    }
    texture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
    this.soupDisplacementSprite.texture = texture;
    this.soupDisplacementSprite.anchor.set(0.5);
    this.soupDisplacementSprite.position.set(this.bowlCenter.x, this.bowlCenter.y);
    this.soupDisplacementSprite.scale.set(3.2);
    this.soupDisplacementSprite.flowVX = 12;
    this.soupDisplacementSprite.flowVY = 7;
    this.soupDisplacementSprite.eventMode = 'none';
    this.soupDisplacementSprite.renderable = false;

    this.soupDisplacementFilter = new PIXI.DisplacementFilter(this.soupDisplacementSprite, 4);
    this.submergedDisplacementFilter = new PIXI.DisplacementFilter(this.soupDisplacementSprite, 2);
    this.submergedBlurFilter = new PIXI.BlurFilter(0.45, 2, 1);
    this.submergedColorFilter = new PIXI.ColorMatrixFilter();
    this.submergedColorFilter.brightness(0.92, false);
    this.submergedColorFilter.saturate(-0.08, true);
    this.soupSprite.filters = [this.soupDisplacementFilter];
    this.soupFlowLayer.filters = [this.soupDisplacementFilter];
    this.submergedFruitLayer.filters = [
      this.submergedDisplacementFilter,
      this.submergedBlurFilter,
      this.submergedColorFilter,
    ];
  }

  private createSoupDisplacementTexture(size: number): PIXI.Texture | null {
    const api = typeof wx !== 'undefined' ? wx : null;
    const canvas = api?.createCanvas
      ? api.createCanvas()
      : typeof document !== 'undefined'
        ? document.createElement('canvas')
        : null;
    if (!canvas) {
      return null;
    }
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    const image = ctx.createImageData(size, size);
    const data = image.data;
    const rand = (x: number, y: number): number => {
      const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
      return n - Math.floor(n);
    };
    const smooth = (x: number, y: number): number => {
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const xf = x - x0;
      const yf = y - y0;
      const u = xf * xf * (3 - 2 * xf);
      const v = yf * yf * (3 - 2 * yf);
      const a = rand(x0, y0);
      const b = rand(x0 + 1, y0);
      const c = rand(x0, y0 + 1);
      const d = rand(x0 + 1, y0 + 1);
      return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
    };
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const nx = x / size;
        const ny = y / size;
        const swirl = Math.sin((nx * 3.2 + ny * 1.7) * Math.PI * 2) * 0.24;
        const n1 = smooth(nx * 7.5 + swirl, ny * 7.5);
        const n2 = smooth(nx * 14.0 - swirl, ny * 14.0 + 5.3);
        const vx = Math.max(0, Math.min(255, 128 + (n1 - 0.5) * 92 + (n2 - 0.5) * 34));
        const vy = Math.max(0, Math.min(255, 128 + (n2 - 0.5) * 84 - (n1 - 0.5) * 28));
        const i = (y * size + x) * 4;
        data[i] = vx;
        data[i + 1] = vy;
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return new PIXI.Texture(PIXI.BaseTexture.from(canvas as PIXI.ImageSource));
  }

  private redrawSoupOverlay(): void {
    this.soupOverlayLayer.removeChildren();
    this.soupDepthVeilLayer.removeChildren();
    this.soupDepthVeil.clear();
    this.soupRollLayer.removeChildren();
    this.soupRollItems.length = 0;
    this.soupEdgeWave.clear();
    this.soupDetailLayer.removeChildren();
    this.soupBubbleLayer.removeChildren();
    this.soupBubbleItems.length = 0;
    this.soupEdgeBubbleLayer.removeChildren();
    this.soupEdgeBubbleItems.length = 0;
    const { hx, hy } = this.getSoupVisualHalfExtents();
    const overlay = this.getSoupOverlayStyle();
    const soupTexture =
      TextureCache.get(`bowl_soup_${this.currentSoupKey}`) ??
      TextureCache.get(`bowl_soup_${DEFAULT_BOWL_SOUP_KEY}`);

    this.bowlContentMask.clear();
    this.bowlContentMask.beginFill(0xffffff, 1);
    this.bowlContentMask.drawEllipse(this.bowlCenter.x, this.bowlCenter.y, hx * 0.99, hy * 0.99);
    this.bowlContentMask.endFill();

    if (soupTexture) {
      this.soupSurfaceOverlaySprite.texture = soupTexture;
      this.soupSurfaceOverlaySprite.anchor.set(0.5);
      this.soupSurfaceOverlaySprite.position.set(this.bowlCenter.x, this.bowlCenter.y);
      this.soupSurfaceOverlaySprite.width = hx * 2;
      this.soupSurfaceOverlaySprite.height = hy * 2;
      this.soupSurfaceOverlaySprite.alpha = overlay.textureAlpha;
      this.soupSurfaceOverlaySprite.tint = 0xffffff;
      this.soupSurfaceOverlaySprite.eventMode = 'none';
      const overlaySprite = this.soupSurfaceOverlaySprite as SoupSurfaceSprite;
      overlaySprite.flowBaseRotation = -0.12;
      overlaySprite.flowBaseScaleX = this.soupSurfaceOverlaySprite.scale.x;
      overlaySprite.flowBaseScaleY = this.soupSurfaceOverlaySprite.scale.y;
      overlaySprite.flowSpeed = -0.05;
      this.soupOverlayLayer.addChild(this.soupSurfaceOverlaySprite);
    }

    const wash = new PIXI.Graphics();
    wash.beginFill(overlay.washColor, overlay.washAlpha);
    wash.drawEllipse(this.bowlCenter.x, this.bowlCenter.y, hx, hy);
    wash.endFill();
    wash.beginFill(overlay.highlightColor, overlay.highlightAlpha);
    wash.drawEllipse(this.bowlCenter.x - hx * 0.16, this.bowlCenter.y - hy * 0.18, hx * 0.58, hy * 0.28);
    wash.endFill();
    this.soupOverlayLayer.addChild(wash);

    this.redrawSoupDepthVeil(hx, hy, overlay);
    this.soupDepthVeilLayer.addChild(this.soupDepthVeil);

    this.redrawSoupRollPatches(hx, hy, overlay);
    this.soupOverlayLayer.addChild(this.soupRollLayer, this.soupEdgeWave);

    this.redrawSoupBubbles(hx, hy, overlay);
    this.soupOverlayLayer.addChild(this.soupBubbleLayer);
    this.redrawSoupEdgeBubbles(hx, hy, overlay);

    this.soupRippleLayer.removeChildren();
    const rippleDefs = [
      { rx: 0.5, ry: 0.18, y: -0.12, rot: -0.16, alpha: overlay.rippleAlpha },
      { rx: 0.38, ry: 0.14, y: 0.06, rot: 0.24, alpha: overlay.rippleAlpha * 0.66 },
      { rx: 0.62, ry: 0.22, y: 0.2, rot: -0.28, alpha: overlay.rippleAlpha * 0.42 },
    ] as const;
    for (const def of rippleDefs) {
      const g = new PIXI.Graphics();
      g.lineStyle(3, 0xffffff, def.alpha);
      g.drawEllipse(0, 0, hx * def.rx, hy * def.ry);
      g.position.set(this.bowlCenter.x, this.bowlCenter.y + hy * def.y);
      g.rotation = def.rot;
      g.eventMode = 'none';
      this.soupRippleLayer.addChild(g);
    }
    this.soupOverlayLayer.addChild(this.soupRippleLayer);
    this.redrawSoupSurfaceDetails(hx, hy, overlay);
  }

  private redrawSoupDepthVeil(
    hx: number,
    hy: number,
    overlay: ReturnType<BowlScene['getSoupOverlayStyle']>,
  ): void {
    const g = this.soupDepthVeil;
    g.clear();
    g.beginFill(overlay.depthVeilColor, overlay.depthVeilAlpha);
    g.drawEllipse(this.bowlCenter.x, this.bowlCenter.y, hx * 0.98, hy * 0.98);
    g.endFill();
    g.beginFill(overlay.highlightColor, overlay.depthVeilAlpha * 0.34);
    g.drawEllipse(this.bowlCenter.x - hx * 0.18, this.bowlCenter.y - hy * 0.2, hx * 0.48, hy * 0.22);
    g.endFill();
    g.beginFill(0xffffff, overlay.depthVeilAlpha * 0.2);
    g.drawEllipse(this.bowlCenter.x + hx * 0.22, this.bowlCenter.y + hy * 0.12, hx * 0.34, hy * 0.16);
    g.endFill();
  }

  private redrawSoupRollPatches(
    hx: number,
    hy: number,
    overlay: ReturnType<BowlScene['getSoupOverlayStyle']>,
  ): void {
    const defs = [
      { x: -0.24, y: -0.16, rx: 0.34, ry: 0.15, rot: -0.24, alpha: 0.12, tint: 'light' },
      { x: 0.22, y: -0.08, rx: 0.3, ry: 0.13, rot: 0.32, alpha: 0.1, tint: 'dark' },
      { x: -0.03, y: 0.13, rx: 0.44, ry: 0.18, rot: -0.08, alpha: 0.11, tint: 'light' },
      { x: 0.28, y: 0.25, rx: 0.26, ry: 0.12, rot: -0.28, alpha: 0.08, tint: 'dark' },
      { x: -0.34, y: 0.28, rx: 0.24, ry: 0.1, rot: 0.2, alpha: 0.08, tint: 'light' },
    ] as const;

    for (let i = 0; i < defs.length; i += 1) {
      const def = defs[i]!;
      const patch = new PIXI.Graphics() as SoupRollPatch;
      const color = def.tint === 'light' ? overlay.rollLightColor : overlay.rollShadowColor;
      patch.beginFill(color, def.alpha);
      patch.drawEllipse(0, 0, hx * def.rx, hy * def.ry);
      patch.endFill();
      patch.beginFill(0xffffff, def.alpha * 0.35);
      patch.drawEllipse(-hx * def.rx * 0.24, -hy * def.ry * 0.22, hx * def.rx * 0.38, hy * def.ry * 0.34);
      patch.endFill();
      patch.baseX = this.bowlCenter.x + hx * def.x;
      patch.baseY = this.bowlCenter.y + hy * def.y;
      patch.baseRot = def.rot;
      patch.baseScaleX = 1;
      patch.baseScaleY = 1;
      patch.baseAlpha = def.alpha;
      patch.driftX = hx * (0.018 + i * 0.004);
      patch.driftY = hy * (0.014 + i * 0.003);
      patch.phase = i * 1.18;
      patch.spin = i % 2 === 0 ? 0.035 : -0.028;
      patch.position.set(patch.baseX, patch.baseY);
      patch.rotation = def.rot;
      patch.blendMode = def.tint === 'light' ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.MULTIPLY;
      patch.eventMode = 'none';
      this.soupRollLayer.addChild(patch);
      this.soupRollItems.push(patch);
    }
  }

  private drawSoupEdgeWave(hx: number, hy: number, overlay: ReturnType<BowlScene['getSoupOverlayStyle']>): void {
    const g = this.soupEdgeWave;
    g.clear();
    const points = 96;
    const t = this.soupRippleTime;
    const drawLoop = (radiusOffset: number, color: number, alpha: number, lineWidth: number): void => {
      g.lineStyle(lineWidth, color, alpha);
      for (let i = 0; i <= points; i += 1) {
        const a = (i / points) * Math.PI * 2;
        const wave =
          Math.sin(a * 3 + t * 0.8) * 3.6 +
          Math.sin(a * 5.5 - t * 0.55) * 2.2 +
          Math.sin(a * 8.0 + t * 1.1) * 1.1;
        const x = this.bowlCenter.x + Math.cos(a) * (hx + radiusOffset + wave);
        const y = this.bowlCenter.y + Math.sin(a) * (hy + radiusOffset + wave * 0.55);
        if (i === 0) {
          g.moveTo(x, y);
        } else {
          g.lineTo(x, y);
        }
      }
    };
    drawLoop(-7, overlay.rollShadowColor, overlay.edgeWaveAlpha * 0.55, 8);
    drawLoop(-14, overlay.rollLightColor, overlay.edgeWaveAlpha, 5);
  }

  private redrawSoupBubbles(
    hx: number,
    hy: number,
    overlay: ReturnType<BowlScene['getSoupOverlayStyle']>,
  ): void {
    const count = this.currentSoupKey === 'berry_tomato' ? 34 : this.currentSoupKey === 'cocoa' ? 22 : 28;
    const edgeCount = Math.floor(count * 0.45);
    for (let i = 0; i < count; i += 1) {
      const edgeBias = i < edgeCount;
      const angle = (i * 2.399963229728653 + (edgeBias ? 0.7 : 0)) % (Math.PI * 2);
      const radius = edgeBias
        ? 0.72 + ((i * 19) % 18) / 100
        : 0.18 + ((i * 37) % 48) / 100;
      const x = this.bowlCenter.x + Math.cos(angle) * hx * radius;
      const y = this.bowlCenter.y + Math.sin(angle) * hy * radius;
      const r = edgeBias ? 3.2 + (i % 4) * 0.95 : 2.3 + (i % 5) * 0.75;
      const alpha = overlay.bubbleAlpha * (edgeBias ? 1.05 : 0.82 + (i % 3) * 0.14);
      const bubble = new PIXI.Graphics() as SoupBubble;
      bubble.lineStyle(Math.max(1.4, r * 0.36), overlay.bubbleColor, alpha);
      bubble.drawCircle(0, 0, r);
      bubble.beginFill(0xffffff, alpha * 0.24);
      bubble.drawCircle(-r * 0.25, -r * 0.28, Math.max(0.8, r * 0.32));
      bubble.endFill();
      bubble.baseX = x;
      bubble.baseY = y;
      bubble.radius = r;
      bubble.phase = i * 0.91;
      bubble.driftX = hx * (edgeBias ? 0.006 : 0.01);
      bubble.driftY = hy * (edgeBias ? 0.004 : 0.008);
      bubble.baseAlpha = alpha;
      bubble.position.set(x, y);
      bubble.eventMode = 'none';
      this.soupBubbleLayer.addChild(bubble);
      this.soupBubbleItems.push(bubble);
    }

    const clusters = [
      { x: -0.46, y: -0.08, a: -0.2 },
      { x: 0.42, y: 0.12, a: 0.4 },
      { x: -0.18, y: 0.34, a: 1.1 },
    ] as const;
    for (let c = 0; c < clusters.length; c += 1) {
      const cluster = clusters[c]!;
      for (let j = 0; j < 5; j += 1) {
        const localAngle = cluster.a + j * 0.9;
        const r = 1.8 + j * 0.48;
        const bubble = new PIXI.Graphics() as SoupBubble;
        const alpha = overlay.bubbleAlpha * (0.9 - j * 0.07);
        bubble.lineStyle(Math.max(1.2, r * 0.38), overlay.bubbleColor, alpha);
        bubble.drawCircle(0, 0, r);
        bubble.beginFill(0xffffff, alpha * 0.22);
        bubble.drawCircle(-r * 0.22, -r * 0.25, Math.max(0.7, r * 0.3));
        bubble.endFill();
        bubble.baseX = this.bowlCenter.x + hx * cluster.x + Math.cos(localAngle) * (8 + j * 4);
        bubble.baseY = this.bowlCenter.y + hy * cluster.y + Math.sin(localAngle) * (5 + j * 3);
        bubble.radius = r;
        bubble.phase = c * 1.8 + j * 0.6;
        bubble.driftX = hx * 0.006;
        bubble.driftY = hy * 0.006;
        bubble.baseAlpha = alpha;
        bubble.position.set(bubble.baseX, bubble.baseY);
        bubble.eventMode = 'none';
        this.soupBubbleLayer.addChild(bubble);
        this.soupBubbleItems.push(bubble);
      }
    }
  }

  private redrawSoupEdgeBubbles(
    hx: number,
    hy: number,
    overlay: ReturnType<BowlScene['getSoupOverlayStyle']>,
  ): void {
    const count = this.currentSoupKey === 'cocoa' ? 44 : this.currentSoupKey === 'berry_tomato' ? 64 : 54;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.sin(i * 1.7) * 0.08;
      const band = 0.68 + ((i * 23) % 20) / 100;
      const x = this.bowlCenter.x + Math.cos(angle) * hx * band;
      const y = this.bowlCenter.y + Math.sin(angle) * hy * band;
      const r = 3.2 + (i % 5) * 0.9;
      const alpha = Math.min(0.62, overlay.bubbleAlpha * (1.2 + (i % 3) * 0.16));
      const bubble = new PIXI.Graphics() as SoupBubble;
      bubble.lineStyle(Math.max(2, r * 0.55), overlay.rollShadowColor, alpha * 0.18);
      bubble.drawCircle(0, 0, r + 0.8);
      bubble.lineStyle(Math.max(1.6, r * 0.42), overlay.bubbleColor, alpha);
      bubble.drawCircle(0, 0, r);
      bubble.beginFill(0xffffff, alpha * 0.22);
      bubble.drawCircle(-r * 0.22, -r * 0.26, Math.max(0.7, r * 0.28));
      bubble.endFill();
      bubble.baseX = x;
      bubble.baseY = y;
      bubble.radius = r;
      bubble.phase = i * 0.53;
      bubble.driftX = hx * 0.004;
      bubble.driftY = hy * 0.003;
      bubble.baseAlpha = alpha;
      bubble.position.set(x, y);
      bubble.eventMode = 'none';
      this.soupEdgeBubbleLayer.addChild(bubble);
      this.soupEdgeBubbleItems.push(bubble);
    }

    const foamArcs = [
      { from: 0.08, to: 0.22, band: 0.76 },
      { from: 0.34, to: 0.46, band: 0.73 },
      { from: 0.58, to: 0.72, band: 0.78 },
      { from: 0.82, to: 0.92, band: 0.74 },
    ] as const;
    for (let a = 0; a < foamArcs.length; a += 1) {
      const arc = foamArcs[a]!;
      const steps = 8;
      for (let j = 0; j < steps; j += 1) {
        const t = steps <= 1 ? 0 : j / (steps - 1);
        const angle = (arc.from + (arc.to - arc.from) * t) * Math.PI * 2;
        const r = 2.7 + ((a + j) % 4) * 0.75;
        const alpha = Math.min(0.68, overlay.bubbleAlpha * (1.25 - Math.abs(t - 0.5) * 0.3));
        const bubble = new PIXI.Graphics() as SoupBubble;
        bubble.lineStyle(Math.max(1.6, r * 0.45), overlay.rollShadowColor, alpha * 0.16);
        bubble.drawCircle(0, 0, r + 0.6);
        bubble.lineStyle(Math.max(1.4, r * 0.4), overlay.bubbleColor, alpha);
        bubble.drawCircle(0, 0, r);
        bubble.beginFill(0xffffff, alpha * 0.18);
        bubble.drawCircle(-r * 0.22, -r * 0.28, Math.max(0.7, r * 0.28));
        bubble.endFill();
        bubble.baseX = this.bowlCenter.x + Math.cos(angle) * hx * (arc.band + Math.sin(j) * 0.018);
        bubble.baseY = this.bowlCenter.y + Math.sin(angle) * hy * (arc.band + Math.cos(j * 1.3) * 0.014);
        bubble.radius = r;
        bubble.phase = a * 1.3 + j * 0.45;
        bubble.driftX = hx * 0.0035;
        bubble.driftY = hy * 0.003;
        bubble.baseAlpha = alpha;
        bubble.position.set(bubble.baseX, bubble.baseY);
        bubble.eventMode = 'none';
        this.soupEdgeBubbleLayer.addChild(bubble);
        this.soupEdgeBubbleItems.push(bubble);
      }
    }
  }

  private redrawSoupSurfaceDetails(
    hx: number,
    hy: number,
    overlay: ReturnType<BowlScene['getSoupOverlayStyle']>,
  ): void {
    this.soupDetailItems.length = 0;
    const line = overlay.detailColor;
    const detailDefs = [
      { x: -0.34, y: -0.24, rx: 0.22, ry: 0.08, rot: -0.28, alpha: 0.08 },
      { x: 0.28, y: -0.08, rx: 0.18, ry: 0.06, rot: 0.32, alpha: 0.07 },
      { x: -0.08, y: 0.18, rx: 0.3, ry: 0.09, rot: -0.12, alpha: 0.06 },
      { x: 0.18, y: 0.28, rx: 0.16, ry: 0.05, rot: 0.18, alpha: 0.055 },
    ] as const;
    for (const def of detailDefs) {
      const g = new PIXI.Graphics();
      g.lineStyle(3, line, def.alpha);
      g.drawEllipse(0, 0, hx * def.rx, hy * def.ry);
      g.position.set(this.bowlCenter.x + hx * def.x, this.bowlCenter.y + hy * def.y);
      g.rotation = def.rot;
      g.eventMode = 'none';
      const item = g as PIXI.Graphics & { flowSpeed?: number; driftPhase?: number; driftX?: number; driftY?: number };
      item.flowSpeed = def.rot > 0 ? 0.045 : -0.038;
      item.driftPhase = Math.random() * Math.PI * 2;
      item.driftX = hx * 0.01;
      item.driftY = hy * 0.008;
      this.soupDetailLayer.addChild(g);
      this.soupDetailItems.push(g);
    }

    const dotCount = this.currentSoupKey === 'milk' ? 14 : 24;
    for (let i = 0; i < dotCount; i += 1) {
      const t = (i * 2.399963229728653) % (Math.PI * 2);
      const r = 0.18 + ((i * 37) % 57) / 100;
      const x = this.bowlCenter.x + Math.cos(t) * hx * r;
      const y = this.bowlCenter.y + Math.sin(t) * hy * r;
      const dot = new PIXI.Graphics();
      dot.beginFill(line, 0.045 + (i % 3) * 0.016);
      dot.drawCircle(0, 0, 1.4 + (i % 4) * 0.45);
      dot.endFill();
      dot.position.set(x, y);
      dot.eventMode = 'none';
      const item = dot as PIXI.Graphics & { flowSpeed?: number; driftPhase?: number; driftX?: number; driftY?: number };
      item.flowSpeed = i % 2 === 0 ? 0.03 : -0.024;
      item.driftPhase = i * 0.77;
      item.driftX = hx * 0.006;
      item.driftY = hy * 0.005;
      this.soupDetailLayer.addChild(dot);
      this.soupDetailItems.push(dot);
    }
  }

  private getSoupOverlayStyle(): {
    washColor: number;
    washAlpha: number;
    highlightColor: number;
    highlightAlpha: number;
    rippleAlpha: number;
    textureAlpha: number;
    detailColor: number;
    bubbleColor: number;
    bubbleAlpha: number;
    rollLightColor: number;
    rollShadowColor: number;
    edgeWaveAlpha: number;
    depthVeilColor: number;
    depthVeilAlpha: number;
  } {
    switch (this.currentSoupKey) {
      case 'berry_tomato':
        return { washColor: 0xd94d3f, washAlpha: 0.1, highlightColor: 0xffb79c, highlightAlpha: 0.08, rippleAlpha: 0.045, textureAlpha: 0.36, detailColor: 0xffd0b2, bubbleColor: 0xffead8, bubbleAlpha: 0.34, rollLightColor: 0xffd3ac, rollShadowColor: 0xb7362b, edgeWaveAlpha: 0.18, depthVeilColor: 0xdd4a38, depthVeilAlpha: 0.1 };
      case 'matcha':
        return { washColor: 0x9fc763, washAlpha: 0.1, highlightColor: 0xe7f5bd, highlightAlpha: 0.08, rippleAlpha: 0.045, textureAlpha: 0.36, detailColor: 0xf0ffd0, bubbleColor: 0xfbffe4, bubbleAlpha: 0.28, rollLightColor: 0xf4ffd2, rollShadowColor: 0x79a94b, edgeWaveAlpha: 0.16, depthVeilColor: 0xa8c96b, depthVeilAlpha: 0.09 };
      case 'mango_coconut':
        return { washColor: 0xf0a92f, washAlpha: 0.1, highlightColor: 0xffdf89, highlightAlpha: 0.08, rippleAlpha: 0.045, textureAlpha: 0.36, detailColor: 0xfff2bd, bubbleColor: 0xffffdf, bubbleAlpha: 0.29, rollLightColor: 0xffffc0, rollShadowColor: 0xd68b20, edgeWaveAlpha: 0.17, depthVeilColor: 0xf3aa35, depthVeilAlpha: 0.09 };
      case 'taro_purple':
        return { washColor: 0x9b77c8, washAlpha: 0.1, highlightColor: 0xd9bbef, highlightAlpha: 0.08, rippleAlpha: 0.045, textureAlpha: 0.36, detailColor: 0xf0d8ff, bubbleColor: 0xffefff, bubbleAlpha: 0.28, rollLightColor: 0xf3dcff, rollShadowColor: 0x7c59aa, edgeWaveAlpha: 0.16, depthVeilColor: 0xa784d0, depthVeilAlpha: 0.09 };
      case 'cocoa':
        return { washColor: 0x6f4a32, washAlpha: 0.14, highlightColor: 0xb8875d, highlightAlpha: 0.07, rippleAlpha: 0.038, textureAlpha: 0.42, detailColor: 0xd9aa78, bubbleColor: 0xffdcba, bubbleAlpha: 0.22, rollLightColor: 0xd7a06b, rollShadowColor: 0x4f321e, edgeWaveAlpha: 0.13, depthVeilColor: 0x765033, depthVeilAlpha: 0.12 };
      case 'milk':
      default:
        return { washColor: 0xfff1d2, washAlpha: 0.1, highlightColor: 0xffffff, highlightAlpha: 0.1, rippleAlpha: 0.06, textureAlpha: 0.32, detailColor: 0xffffff, bubbleColor: 0xffffff, bubbleAlpha: 0.26, rollLightColor: 0xffffff, rollShadowColor: 0xe1c486, edgeWaveAlpha: 0.15, depthVeilColor: 0xffefd0, depthVeilAlpha: 0.1 };
    }
  }

  private updateSoupAnimation(dt: number): void {
    if (!this.soupOverlayLayer.visible || this.soupRippleLayer.children.length === 0) {
      return;
    }
    this.soupRippleTime += dt;
    const overlaySprite = this.soupSurfaceOverlaySprite as SoupSurfaceSprite;
    if (this.soupSurfaceOverlaySprite.parent) {
      const phase = this.soupRippleTime * 0.62;
      this.soupSurfaceOverlaySprite.rotation =
        (overlaySprite.flowBaseRotation ?? 0) +
        Math.sin(phase) * 0.045 +
        this.soupRippleTime * (overlaySprite.flowSpeed ?? 0);
      const baseX = overlaySprite.flowBaseScaleX ?? this.soupSurfaceOverlaySprite.scale.x;
      const baseY = overlaySprite.flowBaseScaleY ?? this.soupSurfaceOverlaySprite.scale.y;
      this.soupSurfaceOverlaySprite.scale.set(
        baseX * (1 + Math.sin(phase * 1.27) * 0.018),
        baseY * (1 - Math.sin(phase * 0.9) * 0.012),
      );
    }
    if (this.soupDisplacementFilter) {
      this.soupDisturbanceSec = Math.max(0, this.soupDisturbanceSec - dt);
      const phase = this.soupRippleTime * 1.1;
      const tapBoost = this.soupDisturbanceSec > 0 ? (this.soupDisturbanceSec / 0.32) * 3.2 : 0;
      this.soupDisplacementSprite.x += (this.soupDisplacementSprite.flowVX ?? 10) * dt;
      this.soupDisplacementSprite.y += (this.soupDisplacementSprite.flowVY ?? 6) * dt;
      this.soupDisplacementSprite.rotation = Math.sin(phase * 0.45) * 0.08;
      this.soupDisplacementFilter.scale.set(
        3.2 + tapBoost + Math.sin(phase) * 0.8,
        2.2 + tapBoost * 0.72 + Math.cos(phase * 0.8) * 0.55,
      );
      this.submergedDisplacementFilter?.scale.set(
        1.3 + tapBoost * 0.4 + Math.sin(phase + 0.7) * 0.35,
        0.95 + tapBoost * 0.28 + Math.cos(phase * 0.7) * 0.25,
      );
      this.soupDepthVeil.alpha = 0.82 + Math.sin(phase * 0.72) * 0.08;
    }
    for (let i = 0; i < this.soupFlowSprites.length; i += 1) {
      const sp = this.soupFlowSprites[i] as FlowSprite;
      const phase = this.soupRippleTime * (0.72 + i * 0.16) + i * 1.53;
      const baseScale = sp.flowBaseScale ?? sp.scale.x;
      const pulse = 1 + Math.sin(phase) * 0.026;
      const flipX = sp.flowFlipX ?? 1;
      const flipY = sp.flowFlipY ?? 1;
      sp.scale.set(baseScale * pulse * flipX, (baseScale / pulse) * flipY);
      sp.rotation += dt * (sp.flowSpeed ?? 0.03);
      sp.alpha = (sp.flowBaseAlpha ?? 0.12) * (0.66 + Math.sin(phase + 0.6) * 0.26);
    }
    if (this.soupRollItems.length > 0) {
      const { hx, hy } = this.getSoupVisualHalfExtents();
      this.drawSoupEdgeWave(hx, hy, this.getSoupOverlayStyle());
      for (let i = 0; i < this.soupRollItems.length; i += 1) {
        const patch = this.soupRollItems[i]!;
        const phase = this.soupRippleTime * (0.42 + i * 0.04) + (patch.phase ?? 0);
        patch.x = (patch.baseX ?? patch.x) + Math.sin(phase) * (patch.driftX ?? 0);
        patch.y = (patch.baseY ?? patch.y) + Math.cos(phase * 0.82) * (patch.driftY ?? 0);
        patch.rotation = (patch.baseRot ?? 0) + Math.sin(phase * 0.64) * 0.08 + this.soupRippleTime * (patch.spin ?? 0);
        patch.scale.set(
          (patch.baseScaleX ?? 1) * (1 + Math.sin(phase) * 0.08),
          (patch.baseScaleY ?? 1) * (1 + Math.cos(phase * 0.76) * 0.06),
        );
        patch.alpha = (patch.baseAlpha ?? 0.1) * (0.72 + Math.sin(phase + 0.4) * 0.22);
      }
    }
    for (let i = 0; i < this.soupBubbleItems.length; i += 1) {
      const bubble = this.soupBubbleItems[i]!;
      const phase = this.soupRippleTime * (0.58 + i * 0.018) + (bubble.phase ?? 0);
      bubble.x = (bubble.baseX ?? bubble.x) + Math.sin(phase) * (bubble.driftX ?? 0);
      bubble.y = (bubble.baseY ?? bubble.y) + Math.cos(phase * 0.84) * (bubble.driftY ?? 0) - Math.sin(phase * 0.28) * 1.6;
      const pop = 1 + Math.sin(phase * 1.12) * 0.16;
      bubble.scale.set(pop);
      bubble.alpha = (bubble.baseAlpha ?? 0.12) * (0.66 + Math.sin(phase + 0.8) * 0.24);
    }
    for (let i = 0; i < this.soupEdgeBubbleItems.length; i += 1) {
      const bubble = this.soupEdgeBubbleItems[i]!;
      const phase = this.soupRippleTime * (0.46 + i * 0.01) + (bubble.phase ?? 0);
      bubble.x = (bubble.baseX ?? bubble.x) + Math.sin(phase) * (bubble.driftX ?? 0);
      bubble.y = (bubble.baseY ?? bubble.y) + Math.cos(phase * 0.76) * (bubble.driftY ?? 0);
      const pop = 1 + Math.sin(phase * 1.35) * 0.14;
      bubble.scale.set(pop);
      bubble.alpha = (bubble.baseAlpha ?? 0.16) * (0.72 + Math.sin(phase + 0.5) * 0.22);
    }
    for (let i = 0; i < this.soupDetailItems.length; i += 1) {
      const item = this.soupDetailItems[i] as PIXI.Container & {
        flowSpeed?: number;
        driftPhase?: number;
        driftX?: number;
        driftY?: number;
      };
      const phase = this.soupRippleTime * (0.6 + i * 0.012) + (item.driftPhase ?? 0);
      item.rotation += dt * (item.flowSpeed ?? 0.02);
      item.x += Math.sin(phase) * (item.driftX ?? 0.4) * dt;
      item.y += Math.cos(phase * 0.87) * (item.driftY ?? 0.3) * dt;
      item.alpha = 0.75 + Math.sin(phase + 0.3) * 0.16;
    }
    for (let i = 0; i < this.soupRippleLayer.children.length; i += 1) {
      const child = this.soupRippleLayer.children[i] as PIXI.Container;
      const phase = this.soupRippleTime * (0.35 + i * 0.08) + i * 1.7;
      const s = 1 + Math.sin(phase) * 0.025;
      child.scale.set(s, 1 / s);
      child.rotation += dt * (i % 2 === 0 ? 0.035 : -0.028);
      child.alpha = 0.78 + Math.sin(phase + 0.8) * 0.14;
    }
  }

  private mountGmClearButton(): void {
    this.gmClearBtnRoot.position.set(Game.logicWidth - 84, Game.safeTop + 74);
    this.gmClearBtnRoot.eventMode = 'static';
    this.gmClearBtnRoot.cursor = 'pointer';
    this.gmClearBtnRoot.hitArea = new PIXI.Rectangle(-58, -22, 116, 44);
    const bg = new PIXI.Graphics();
    bg.beginFill(0x2f2119, 0.76);
    bg.lineStyle(2, 0xffe4a3, 0.85);
    bg.drawRoundedRect(-58, -22, 116, 44, 16);
    bg.endFill();
    const text = new PIXI.Text('GM通关', {
      fontSize: 20,
      fill: 0xfff1c7,
      fontWeight: '800',
    });
    text.anchor.set(0.5);
    this.gmClearBtnRoot.addChild(bg, text);
    this.gmClearBtnRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.gmClearCurrentLevel();
    });
  }

  private gmClearCurrentLevel(): void {
    if (!this.loaded || this.badgeUnlockOverlay.visible || this.levelClearOverlay.visible) {
      return;
    }
    this.hideToolHelpPanel();
    this.failSettlementOverlay.hide();
    this.reviveOverlay.hide();
    this.orderTransitionBusy = false;
    this.bufferFlightBusy = false;
    for (const id of this.orderFruitIds) {
      this.remainingCounts[id] = 0;
    }
    this.ordersRemaining = 0;
    this.refreshHud();
    this.showWinOverlay();
  }

  /** 雪碧条三列：左加菜碟、中移除、右打乱；失败则保留矢量兜底 */
  private mountToolButtons(): void {
    const sheet = TextureCache.get('bowl_tool_sheet');
    for (let i = 0; i < 3; i += 1) {
      const slot = this.toolSlots[i];
      slot.removeChildren();
      if (sheet) {
        slot.visible = true;
        const colW = Math.floor(sheet.width / 3);
        const x0 = i * colW;
        const w = i === 2 ? sheet.width - colW * 2 : colW;
        const rect = new PIXI.Rectangle(x0, 0, w, sheet.height);
        const sub = new PIXI.Texture(sheet.baseTexture, rect);
        const sp = new PIXI.Sprite(sub);
        sp.eventMode = 'none';
        sp.anchor.set(0.5);
        const target = toolButtonDisplayTarget();
        const sc = target / Math.max(w, sheet.height);
        sp.scale.set(sc);
        slot.addChild(sp);
        const dw = w * sc;
        const dh = sheet.height * sc;
        slot.hitArea = new PIXI.Rectangle(-dw / 2, -dh / 2, dw, dh);
      } else {
        slot.visible = false;
        slot.addChild(this.createToolButtonFallback(TOOL_LABELS[i], TOOL_FALLBACK_COLORS[i]));
        const r = toolButtonDisplayTarget() * 0.58;
        slot.hitArea = new PIXI.Circle(0, 8, r);
      }
      slot.addChild(this.toolInventoryBadges[i]!);
    }
    this.refreshToolInventoryBadges();
  }

  private buildToolHelpOverlay(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const dim = new PIXI.Graphics();
    dim.beginFill(0x1a1510, 0.58);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    dim.eventMode = 'static';
    dim.cursor = 'pointer';
    dim.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.hideToolHelpPanel();
    });
    this.toolHelpOverlay.addChild(dim);

    this.toolHelpPanelRoot.position.set(W / 2, H * 0.46);
    this.toolHelpPanelRoot.eventMode = 'static';
    this.toolHelpSprite.anchor.set(0.5);
    this.toolHelpSprite.eventMode = 'static';
    this.toolHelpSprite.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
    });
    this.toolHelpPanelRoot.addChild(this.toolHelpSprite);

    this.toolHelpCloseBtn.eventMode = 'static';
    this.toolHelpCloseBtn.cursor = 'pointer';
    this.toolHelpCloseBtn.hitArea = new PIXI.Rectangle(-40, -40, 80, 80);
    this.toolHelpCloseBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.playButtonSound();
      this.hideToolHelpPanel();
    });
    this.toolHelpPanelRoot.addChild(this.toolHelpCloseBtn);

    this.toolHelpExtraNote.anchor.set(0.5);
    this.toolHelpExtraNote.visible = false;
    this.toolHelpExtraNote.eventMode = 'none';
    this.toolHelpPanelRoot.addChild(this.toolHelpExtraNote);

    this.toolHelpFreeBtn.anchor.set(0.5);
    this.toolHelpFreeBtn.eventMode = 'static';
    this.toolHelpFreeBtn.cursor = 'pointer';
    this.toolHelpFreeBtn.visible = false;
    this.toolHelpFreeBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.playButtonSound();
      const toolIndex = this.pendingToolIndex;
      if (toolIndex === null) {
        return;
      }
      this.hideToolHelpPanel();
      void this.runRewardedGameplayAction('tool_help_free', () => {
        this.useTool(toolIndex);
      });
    });
    this.toolHelpPanelRoot.addChild(this.toolHelpFreeBtn);

    this.toolHelpInventoryBtn.eventMode = 'static';
    this.toolHelpInventoryBtn.cursor = 'pointer';
    this.toolHelpInventoryBtn.visible = false;
    this.toolHelpInventoryBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.playButtonSound();
      const toolIndex = this.pendingToolIndex;
      if (toolIndex === null) {
        return;
      }
      this.tryUseInventoryTool(toolIndex);
    });
    this.toolHelpInventoryText.anchor.set(0.5);
    this.toolHelpInventoryBtn.addChild(this.createInventoryUseButtonBg(), this.toolHelpInventoryText);
    this.toolHelpPanelRoot.addChild(this.toolHelpInventoryBtn);

    this.toolHelpOverlay.visible = false;
    this.toolHelpOverlay.eventMode = 'static';
    this.toolHelpOverlay.addChild(this.toolHelpPanelRoot);
    this.container.addChild(this.toolHelpOverlay);
  }

  private showToolHelpPanel(panelIndex: number): void {
    if (this.isBowlInteractionBlocked()) {
      return;
    }
    const sheet = TextureCache.get('bowl_tool_panels');
    if (!sheet) {
      return;
    }
    const colW = Math.floor(sheet.width / 3);
    const x0 = panelIndex * colW;
    const w = panelIndex === 2 ? sheet.width - colW * 2 : colW;
    const rect = new PIXI.Rectangle(x0, 0, w, sheet.height);
    this.toolHelpSprite.texture = new PIXI.Texture(sheet.baseTexture, rect);
    this.pendingToolIndex = panelIndex;
    const maxW = Game.logicWidth * 0.88;
    const maxH = Game.logicHeight * 0.76;
    const sc = Math.min(maxW / w, maxH / sheet.height, 1.25);
    this.toolHelpSprite.scale.set(sc);
    this.toolHelpCloseBtn.position.set(w * sc * 0.5 - 74, (-sheet.height * sc) / 2 + 72);

    const freeTex = TextureCache.get('ui_panel_free_btn');
    const panelHalfH = (sheet.height * sc) / 2;
    let extraNoteBottom = panelHalfH;
    /** Shuffle 面板（panelIndex===2）补充冻果说明，贴在「打乱所有食材」主文案下方留白处 */
    if (panelIndex === 2) {
      this.toolHelpExtraNote.text = '立即解冻所有冻果';
      this.toolHelpExtraNote.visible = true;
      this.toolHelpExtraNote.style.fontSize = 26;
      this.toolHelpExtraNote.style.fontWeight = '800';
      this.toolHelpExtraNote.style.fill = 0xff9a38;
      this.toolHelpExtraNote.style.stroke = 0x6b3510;
      this.toolHelpExtraNote.style.strokeThickness = 5;
      const shuffleNoteY = panelHalfH * 0.46 + 80;
      this.toolHelpExtraNote.position.set(0, shuffleNoteY);
      extraNoteBottom = panelHalfH;
    } else {
      this.toolHelpExtraNote.visible = false;
    }
    const toolKind = toolKindForIndex(panelIndex);
    const ownedCount = getToolCount(toolKind);
    if (ownedCount > 0) {
      const panelHalfW = (w * sc) / 2;
      const btnW = Math.min(Game.logicWidth * 0.76, panelHalfW * 1.6);
      const btnH = 104;
      const btnHalfH = btnH / 2;
      const gap = 14;
      this.redrawInventoryUseButtonBg(btnW, btnH);
      this.toolHelpInventoryText.text = `使用 1/${ownedCount}`;
      this.toolHelpInventoryBtn.position.set(0, extraNoteBottom + gap + btnHalfH);
      this.toolHelpInventoryBtn.hitArea = new PIXI.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH);
      this.toolHelpInventoryBtn.visible = true;
      this.toolHelpFreeBtn.visible = false;
    } else if (freeTex) {
      this.toolHelpFreeBtn.texture = freeTex;
      const maxBw = Game.logicWidth * 0.72;
      const targetH = Game.logicHeight * 0.13;
      const bs = Math.min(1, maxBw / freeTex.width, targetH / freeTex.height);
      this.toolHelpFreeBtn.scale.set(bs);
      const gap = 14;
      const btnHalfH = (freeTex.height * bs) / 2;
      this.toolHelpFreeBtn.position.set(0, extraNoteBottom + gap + btnHalfH);
      this.toolHelpFreeBtn.visible = true;
      this.toolHelpInventoryBtn.visible = false;
    } else {
      this.toolHelpFreeBtn.visible = false;
      this.toolHelpInventoryBtn.visible = false;
    }

    this.toolHelpOverlay.visible = true;
    this.fruitLayer.eventMode = 'none';
  }

  private hideToolHelpPanel(): void {
    if (!this.toolHelpOverlay.visible) {
      return;
    }
    this.pendingToolIndex = null;
    this.toolHelpOverlay.visible = false;
    if (!this.isBowlInteractionBlocked()) {
      this.fruitLayer.eventMode = 'static';
    }
  }

  private createInventoryUseButtonBg(): PIXI.Graphics {
    const bg = new PIXI.Graphics();
    bg.name = 'inventoryUseButtonBg';
    return bg;
  }

  private redrawInventoryUseButtonBg(w: number, h: number): void {
    const bg = this.toolHelpInventoryBtn.getChildByName('inventoryUseButtonBg') as PIXI.Graphics | null;
    if (!bg) {
      return;
    }
    const r = h / 2;
    bg.clear();
    bg.beginFill(0x5caed0, 0.28);
    bg.drawRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, r);
    bg.endFill();
    bg.lineStyle(5, 0x2c5970, 1);
    bg.beginFill(0xc9efff, 1);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, r);
    bg.endFill();
    bg.lineStyle(2, 0xffffff, 0.65);
    bg.beginFill(0xeaf8ff, 0.75);
    bg.drawRoundedRect(-w / 2 + 12, -h / 2 + 10, w - 24, h * 0.42, h * 0.21);
    bg.endFill();
  }

  private useTool(slotIndex: number): void {
    if (!this.loaded) {
      return;
    }
    if (this.toolHelpOverlay.visible) {
      this.hideToolHelpPanel();
    }
    if (this.isBowlInteractionBlocked()) {
      return;
    }
    if (slotIndex === 0) {
      this.toolAddDish();
    } else if (slotIndex === 1) {
      this.toolRemoveAllBuffer();
    } else {
      this.toolShuffleBowl();
    }
  }

  private tryUseInventoryTool(slotIndex: number): void {
    if (!this.loaded || this.isBowlInteractionBlocked()) {
      return;
    }
    const kind = toolKindForIndex(slotIndex);
    const available = this.getToolAvailability(slotIndex);
    if (!available.ok) {
      this.toast(available.message);
      return;
    }
    const result = consumeTool(kind);
    if (!result.consumed) {
      this.toast('道具数量不足');
      this.showToolHelpPanel(slotIndex);
      return;
    }
    analytics.track('tool_inventory_use', {
      tool_kind: kind,
      level_id: this.levelDef?.levelNumber,
      count_after: result.count,
      source: 'inventory',
    });
    this.hideToolHelpPanel();
    this.useTool(slotIndex);
    this.refreshToolInventoryBadges();
  }

  private getToolAvailability(slotIndex: number): { ok: boolean; message: string } {
    if (slotIndex === 0) {
      if (!this.levelDef.allowAddDish) {
        return { ok: false, message: '本关不可用' };
      }
      if (this.bufferSize >= BUFFER_SLOTS_MAX) {
        return { ok: false, message: '菜碟已满（最多7个）' };
      }
      return { ok: true, message: '' };
    }
    if (slotIndex === 1) {
      if (!this.levelDef.allowRemove) {
        return { ok: false, message: '本关不可用' };
      }
      const hasBufferFruit = this.bufferSlots.slice(0, this.bufferSize).some(Boolean);
      if (!hasBufferFruit) {
        return { ok: false, message: '暂存区是空的' };
      }
      return { ok: true, message: '' };
    }
    if (!this.levelDef.allowShuffle) {
      return { ok: false, message: '本关不可用' };
    }
    return { ok: true, message: '' };
  }

  private toast(title: string): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    api?.showToast?.({ title, icon: 'none' });
  }

  private showLevelPassRateHint(levelId: number): void {
    const cached = LevelPassRateService.getLevel(levelId);
    if (cached) {
      this.renderLevelPassRateHint(cached);
    }
    void LevelPassRateService.refreshIfNeeded().then(() => {
      if (cached) {
        return;
      }
      const latest = LevelPassRateService.getLevel(levelId);
      if (latest) {
        this.renderLevelPassRateHint(latest);
      }
    });
  }

  private hideLevelPassRateHint(): void {
    if (this.levelPassRateHintTimer) {
      clearTimeout(this.levelPassRateHintTimer);
      this.levelPassRateHintTimer = null;
    }
    this.levelPassRateHintRoot.visible = false;
    this.levelPassRateHintRoot.removeChildren();
  }

  private renderLevelPassRateHint(rate: {
    pass_rate: number;
    start_users: number;
    clear_users: number;
  }): void {
    if (this.levelPassRateHintTimer) {
      clearTimeout(this.levelPassRateHintTimer);
      this.levelPassRateHintTimer = null;
    }
    this.levelPassRateHintRoot.removeChildren();

    const root = this.levelPassRateHintRoot;
    root.visible = true;
    root.alpha = 1;
    root.position.set(190, Game.logicHeight * 0.41);

    const cardW = 250;
    const cardH = 96;
    const bg = new PIXI.Graphics();
    bg.beginFill(0x4d2b18, 0.92);
    bg.lineStyle(4, 0xf3d38a, 0.95);
    bg.drawRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 18);
    bg.endFill();
    bg.beginFill(0x2d170d, 0.22);
    bg.drawRoundedRect(-cardW / 2 + 8, -cardH / 2 + 8, cardW - 16, cardH - 16, 14);
    bg.endFill();
    root.addChild(bg);

    const title = new PIXI.Text('全国通关数据', {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 18,
      fill: 0xfff0b8,
      fontWeight: '900',
      stroke: 0x2b1b12,
      strokeThickness: 3,
      lineJoin: 'round',
    });
    title.anchor.set(0, 0.5);
    title.position.set(-cardW / 2 + 54, -26);
    root.addChild(title);

    const isRareClear = rate.clear_users < 10;
    const percent = Math.max(0, Math.min(100, Math.round(rate.pass_rate * 100)));
    const mainText = isRareClear ? '通关少于10人' : `通关率 ${percent}%`;
    const detailText = isRareClear ? '过去30天' : `${rate.clear_users.toLocaleString()}人通关`;
    const sourceText = '过去30天计算 · 每日更新';

    const icon = new PIXI.Text('🏆', {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 28,
      fill: 0xffd66b,
      stroke: 0x2b1b12,
      strokeThickness: 3,
    });
    icon.anchor.set(0.5);
    icon.position.set(-cardW / 2 + 30, -2);
    root.addChild(icon);

    const main = new PIXI.Text(mainText, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x2b1b12,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    main.anchor.set(0, 0.5);
    main.position.set(-cardW / 2 + 54, 2);
    root.addChild(main);

    const detail = new PIXI.Text(detailText, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 17,
      fill: 0xfff2c8,
      fontWeight: '800',
      stroke: 0x2b1b12,
      strokeThickness: 3,
      lineJoin: 'round',
    });
    detail.anchor.set(0, 0.5);
    detail.position.set(-cardW / 2 + 54, 28);
    root.addChild(detail);

    const source = new PIXI.Text(sourceText, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 13,
      fill: 0xe9cfa0,
      fontWeight: '700',
      stroke: 0x2b1b12,
      strokeThickness: 2,
      lineJoin: 'round',
    });
    source.anchor.set(0, 0.5);
    source.alpha = 0.86;
    source.position.set(-cardW / 2 + 12, 44);
    root.addChild(source);

    this.levelPassRateHintTimer = setTimeout(() => {
      root.visible = false;
      root.removeChildren();
      this.levelPassRateHintTimer = null;
    }, LEVEL_PASS_RATE_HINT_MS);
  }

  private async runRewardedGameplayAction(scene: string, action: () => void): Promise<void> {
    if (this.rewardedAdBusy) {
      this.toast('广告加载中');
      return;
    }
    this.rewardedAdBusy = true;
    try {
      const result = await showGameplayRewardedAd({
        scene,
        levelId: this.levelDef?.levelNumber,
      });
      if (result === 'completed' || result === 'unavailable') {
        this.hideToolHelpPanel();
        action();
      } else if (result === 'skipped') {
        this.toast('看完广告后才能使用');
      } else {
        this.toast('广告暂不可用，请稍后再试');
      }
    } finally {
      this.rewardedAdBusy = false;
    }
  }

  /** 加菜碟：增加 1 个菜碟位（至多 7 个） */
  private toolAddDish(): void {
    if (!this.levelDef.allowAddDish) {
      this.toast('本关不可用');
      return;
    }
    if (this.bufferSize >= BUFFER_SLOTS_MAX) {
      this.toast('菜碟已满（最多7个）');
      return;
    }
    this.bufferSize += 1;
    this.applyBufferStripLayout();
    this.mountBufferStripTextures();
    this.evaluateBufferPanicState();
    this.toast('已增加1个菜碟');
  }

  /** 移除：把暂存区所有水果扫回碗内 */
  private toolRemoveAllBuffer(): void {
    if (!this.levelDef.allowRemove) {
      this.toast('本关不可用');
      return;
    }
    const occupied: number[] = [];
    for (let i = 0; i < this.bufferSize; i += 1) {
      if (this.bufferSlots[i]) {
        occupied.push(i);
      }
    }
    if (occupied.length === 0) {
      this.toast('暂存区是空的');
      return;
    }
    for (let i = 0; i < occupied.length; i += 1) {
      this.returnBufferFruitToBowl(occupied[i]!, i);
    }
    this.toast('已移除暂存区全部水果');
  }

  private returnBufferFruitToBowl(idx: number, scatterIndex = 0): void {
    const fruit = this.bufferSlots[idx];
    if (!fruit) {
      return;
    }
    this.bufferSlots[idx] = null;
    this.evaluateBufferPanicState();
    const anchor = this.bufferSlotAnchors[idx]!;
    const worldStart = anchor.toGlobal(new PIXI.Point(fruit.x, fruit.y));
    anchor.removeChild(fruit);
    const lp = this.fruitLayer.toLocal(worldStart);
    fruit.position.copyFrom(lp);
    fruit.scale.set(this.randomBowlFruitScale(fruit.fruitId));
    this.mountFruitInBowlLayer(fruit, true);
    fruit.phase = 'bowl';
    fruit.bufferSlotIndex = null;
    fruit.picked = false;
    fruit.eventMode = 'static';
    fruit.cursor = 'pointer';
    /** Remove 把冻果送回碗里时一并解冻：避免「碗里还飘着冰块水果」误导玩家 */
    if (fruit.frozen) {
      fruit.setFrozen(false);
    }
    const p = this.randomBowlPoint();
    const duration = 0.26;
    let elapsed = 0;
    const fromX = fruit.x;
    const fromY = fruit.y;
    const arc = 18 + (scatterIndex % 3) * 8;
    const ticker = () => {
      elapsed += Game.ticker.deltaMS / 1000;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      fruit.x = fromX + (p.x - fromX) * eased;
      fruit.y = fromY + (p.y - fromY) * eased - Math.sin(t * Math.PI) * arc;
      if (t >= 1) {
        Game.ticker.remove(ticker);
        fruit.velocityX = this.randomInRange(-10, 10);
        fruit.velocityY = this.randomInRange(-7, 7);
      }
    };
    Game.ticker.add(ticker);
  }

  /** 打乱：先解冻所有冻果，再随机换位并交换上下层 */
  private toolShuffleBowl(): void {
    if (!this.levelDef.allowShuffle) {
      this.toast('本关不可用');
      return;
    }
    this.unfreezeAllFrozenFruits();
    this.shuffleDepthSwapSec = SHUFFLE_DEPTH_SWAP_SEC;
    this.shuffleIceResurfaceSec = SHUFFLE_ICE_RESURFACE_SEC;
    for (const fruit of this.fruits) {
      if (fruit.phase !== 'bowl' || fruit.picked || fruit.hiddenReserve) {
        continue;
      }
      const p = this.randomBowlPoint();
      fruit.position.set(p.x, p.y);
      fruit.velocityX = this.randomInRange(-14, 14);
      fruit.velocityY = this.randomInRange(-9, 9);
      if (fruit.fruitId === ICE_CUBE_ID) {
        this.moveFruitToSoupLayer(fruit, this.submergedFruitLayer);
      } else if (fruit.parent === this.surfaceFruitLayer) {
        this.moveFruitToSoupLayer(fruit, this.submergedFruitLayer);
      } else if (fruit.parent === this.submergedFruitLayer) {
        this.moveFruitToSoupLayer(fruit, this.surfaceFruitLayer);
      }
    }
  }

  private bowlTextureKey(fruitId: FruitId): string {
    return Math.random() < 0.5 ? fruitId : `${fruitId}__b2`;
  }

  private pickInitialVisibleIndexes(ids: FruitId[]): Set<number> {
    const visible = new Set<number>();

    /**
     * 冰块是纯阻挡道具：必须全部可见、强制浮在上层（详见 update 中的 ICE 抬层逻辑）。
     * 藏在底层的冰块无法对玩家形成阻挡，违背设计意图。
     */
    let iceVisibleCount = 0;
    ids.forEach((id, index) => {
      if (id === ICE_CUBE_ID) {
        visible.add(index);
        iceVisibleCount += 1;
      }
    });

    const configured = this.levelDef.initialVisibleCount ?? ids.length;
    /** visibleTarget 是「普通水果」总可见数；冰块独立不挤占该名额 */
    const visibleTarget = Math.min(
      ids.length,
      Math.max(configured, this.parallelPlateCount * this.orderSize + 4) + iceVisibleCount,
    );

    const activeNeeds: Partial<Record<FruitId, number>> = {};
    for (let p = 0; p < this.parallelPlateCount; p += 1) {
      const order = this.parallelOrders[p as PlateIdx];
      if (!order) {
        continue;
      }
      activeNeeds[order.fruitId] = (activeNeeds[order.fruitId] ?? 0) + Math.max(1, this.orderSize - order.progress);
    }

    ids.forEach((id, index) => {
      if (visible.has(index)) {
        return;
      }
      const need = activeNeeds[id] ?? 0;
      if (need <= 0 || visible.size >= visibleTarget) {
        return;
      }
      visible.add(index);
      activeNeeds[id] = need - 1;
    });

    for (const index of shuffle(ids.map((_, i) => i))) {
      if (visible.size >= visibleTarget) {
        break;
      }
      visible.add(index);
    }
    return visible;
  }

  private markFruitAsHiddenReserve(fruit: FruitItem): void {
    fruit.hiddenReserve = true;
    fruit.eventMode = 'none';
    fruit.cursor = 'default';
    fruit.scale.set(fruit.scale.x * 0.68);
    fruit.velocityX = this.randomInRange(-2.4, 2.4);
    fruit.velocityY = this.randomInRange(-1.8, 1.8);
    this.hiddenReserveFruits.push(fruit);
  }

  /**
   * 从本关订单库存里挑 N 颗标记为冻果。
   * 冻果仍然占用订单库存，必须点击进 buffer 并解冻后才能交付，不能作为通关后的多余水果。
   */
  private pickFrozenFruitIndexes(ids: FruitId[]): Set<number> {
    const count = Math.max(0, this.levelDef.frozenCount ?? 0);
    if (count <= 0) {
      return new Set();
    }
    const candidates = ids
      .map((id, index) => ({ id, index }))
      .filter(({ id }) => !NON_ORDER_FRUIT_IDS.has(id));
    return new Set(shuffle(candidates).slice(0, count).map(({ index }) => index));
  }

  /**
   * 解冻本关所有冻果：暂存碟与碗内冻果都清除 frozen 标记并隐藏冰块层。
   * 随后立即触发一次 tryConsumeOrderFromBuffer，让解冻后的暂存水果按常规规则匹配订单飞盘。
   */
  private unfreezeAllFrozenFruits(): void {
    let any = false;
    for (let i = 0; i < this.bufferSize; i += 1) {
      const slot = this.bufferSlots[i];
      if (slot && slot.frozen) {
        slot.setFrozen(false);
        any = true;
      }
    }
    for (const fruit of this.fruits) {
      if (fruit.frozen) {
        fruit.setFrozen(false);
        any = true;
      }
    }
    if (any && !this.isBowlInteractionBlocked()) {
      this.tryConsumeOrderFromBuffer();
    }
  }

  private startRound(): void {
    this.hideToolHelpPanel();
    this.hideLevelPassRateHint();
    this.failSettlementOverlay.hide();
    this.badgeUnlockOverlay.hide();
    this.reviveOverlay.hide();
    this.levelClearOverlay.hide();
    this.bufferFlightBusy = false;
    this.orderTransitionBusy = false;
    this.submergedFruitLayer.removeChildren();
    this.surfaceFruitLayer.removeChildren();
    this.flyingFruitLayer.removeChildren();
    this.fruits = [];
    this.hiddenReserveFruits = [];
    this.pendingBufferSlotIndexes.clear();
    this.pendingOrderPlateCounts = [0, 0, 0, 0];
    this.driftAccumSec = 0;
    this.shuffleDepthSwapSec = 0;
    this.shuffleIceResurfaceSec = 0;

    for (const anchor of this.bufferSlotAnchors) {
      anchor.removeChildren();
    }
    this.exitBufferPanic();

    this.levelDef = getBowlLevelDef(getBowlLevelIndex());
    this.applySceneThemeForLevel();
    this.applyBowlArtTextures();
    this.hasShownClearForRound = false;
    // 关卡进入打点：每次 startRound 都算一次新的尝试（失败重试也会重新打）
    this.roundStartTs = Date.now();
    analytics.track(EVENT_NAMES.LEVEL_START, {
      level_id: getBowlLevelIndex() + 1,
      level_name: this.levelDef.displayName,
    });
    this.showLevelPassRateHint(getBowlLevelIndex() + 1);
    this.levelFruitIds = this.levelDef.fruitIds.slice();
    this.orderFruitIds = this.levelFruitIds.filter((id) => !NON_ORDER_FRUIT_IDS.has(id));
    this.orderSize = this.levelDef.orderTarget;
    this.bufferSize = Math.max(1, Math.min(this.levelDef.bufferSize, BUFFER_SLOTS_MAX));
    this.bufferSlots = Array.from({ length: BUFFER_SLOTS_MAX }, () => null);
    this.resetThirdPlateForRound();

    this.remainingCounts = {} as Record<FruitId, number>;
    for (const id of this.orderFruitIds) {
      this.remainingCounts[id] = this.levelDef.copiesPerFruit;
    }

    this.ordersRemaining = this.getInitialOrderCountForLevel();
    this.totalOrdersForProgress = this.ordersRemaining;
    this.initParallelOrders();

    const ids = shuffle(
      [
        ...this.levelFruitIds.flatMap((id) =>
          Array.from({ length: this.levelDef.copiesPerFruit }, () => id),
        ),
        ...Array.from({ length: this.levelDef.iceCount ?? 0 }, () => ICE_CUBE_ID),
      ],
    );
    const frozenIndexes = this.pickFrozenFruitIndexes(ids);
    const frostTexture = TextureCache.get(`${ICE_CUBE_ID}__b2`) ?? TextureCache.get(ICE_CUBE_ID);
    const visibleIndexes = this.pickInitialVisibleIndexes(ids);

    ids.forEach((fruitId, index) => {
      const config = FRUIT_MAP[fruitId];
      const key = this.bowlTextureKey(fruitId);
      const texture = TextureCache.get(key) ?? TextureCache.get(fruitId);
      const fruit = new FruitItem(config, texture);
      const point = this.randomBowlPoint();
      fruit.position.set(point.x, point.y);
      fruit.scale.set(this.randomBowlFruitScale(fruit.fruitId));
      fruit.velocityX = this.randomInRange(-10, 10);
      fruit.velocityY = this.randomInRange(-7, 7);
      fruit.zIndex = index;
      fruit.phase = 'bowl';
      fruit.bufferSlotIndex = null;
      if (frozenIndexes.has(index)) {
        fruit.setFrostTexture(frostTexture);
        fruit.setFrozen(true);
      }
      fruit.on('pointertap', () => {
        this.pickFruit(fruit);
      });
      this.fruits.push(fruit);
      if (!visibleIndexes.has(index)) {
        this.markFruitAsHiddenReserve(fruit);
      }
      this.mountFruitInBowlLayer(fruit);
    });
    this.revealHiddenReserveForActiveOrders();

    this.hudLevelText.text = this.levelDef.displayName;
    this.applyBufferStripLayout();
    this.mountBufferStripTextures();
    this.refreshHud();
    this.fruitLayer.eventMode = 'static';
    this.refreshToolInventoryBadges();

    this.queueMechanicIntrosForLevel();
    this.runNextMechanicIntroOrTutorial();
  }

  /**
   * 把当前关该解锁的机制名压入队列：
   *   - 关卡含此机制（ice/frozenCount>0）；
   *   - 玩家本机尚未看过对应说明面板。
   * 设计上首关命中点是 BOWL_LEVELS 里第一关含该机制的关卡（默认 ice 在 L3、frozen 在 L5），
   * 但即便玩家跳关或后端重排，只要进到含该机制的关卡而未看过，就会补弹一次。
   */
  private queueMechanicIntrosForLevel(): void {
    this.pendingMechanicIntros = [];
    if (!this.levelDef) {
      return;
    }
    if ((this.levelDef.iceCount ?? 0) > 0 && !isMechanicIntroSeen('ice')) {
      this.pendingMechanicIntros.push('ice');
    }
    if ((this.levelDef.frozenCount ?? 0) > 0 && !isMechanicIntroSeen('frozen')) {
      this.pendingMechanicIntros.push('frozen');
    }
  }

  /**
   * 从队列里弹出下一个机制说明：弹完所有再去触发新手引导。
   * 期间通过 mechanicIntroOverlay 接管点击，玩法层冻结。
   */
  private runNextMechanicIntroOrTutorial(): void {
    const next = this.pendingMechanicIntros.shift();
    if (!next) {
      this.tryStartFirstLevelTutorial();
      this.tryStartSecondLevelOrderPlatesTutorial();
      return;
    }
    const content = this.buildMechanicIntroContent(next);
    if (!content) {
      markMechanicIntroSeen(next);
      this.runNextMechanicIntroOrTutorial();
      return;
    }
    this.fruitLayer.eventMode = 'none';
    this.exitBufferPanic();
    this.mechanicIntroOverlay.show(content, () => {
      markMechanicIntroSeen(next);
      this.fruitLayer.eventMode = 'static';
      this.runNextMechanicIntroOrTutorial();
      this.evaluateBufferPanicState();
    });
  }

  private buildMechanicIntroContent(kind: MechanicIntroKind): BowlMechanicIntroContent | null {
    if (kind === 'ice') {
      const iceTexture =
        TextureCache.get(`${ICE_CUBE_ID}__b2`) ??
        TextureCache.get(ICE_CUBE_ID);
      return {
        title: '新机制：冰块',
        body: '冰块不能交付订单。\n注意不要不小心放入暂存碟哦。',
        iconBuilder: () =>
          buildIntroIcon({ texture: iceTexture, fallbackFill: 0xa9d8ff }),
      };
    }
    if (kind === 'frozen') {
      const sampleFruitId = this.orderFruitIds[0];
      const fruitTexture = sampleFruitId
        ? TextureCache.get(sampleFruitId) ?? null
        : null;
      const frostTexture =
        TextureCache.get(`${ICE_CUBE_ID}__b2`) ??
        TextureCache.get(ICE_CUBE_ID);
      return {
        title: '新机制：冻果',
        body:
          `被冻住的水果叫「冻果」。\n` +
          `需要先放进暂存碟，等解冻后才能交付订单哦。`,
        iconBuilder: () =>
          buildIntroIcon({
            texture: fruitTexture,
            withFrost: true,
            frostTexture,
            fallbackFill: 0xffd1a1,
          }),
      };
    }
    return null;
  }

  /**
   * 第一关：玩家未完成过引导时，分两步引导：
   *   1. 先指订单气泡，提示「需要交付 N 份 X 才能完成订单」；
   *   2. 用户点屏幕任意处进入第二步：依次指引点击对应水果，直到本单完成。
   */
  private tryStartFirstLevelTutorial(): void {
    this.endTutorial();
    if (!this.levelDef || this.levelDef.levelNumber !== 1) {
      return;
    }
    if (isFirstLevelTutorialDone()) {
      return;
    }
    const firstOrder = this.parallelOrders[0];
    if (!firstOrder) {
      return;
    }
    const matchExists = this.fruits.some(
      (f) =>
        f.fruitId === firstOrder.fruitId &&
        f.phase === 'bowl' &&
        !f.picked &&
        !f.hiddenReserve,
    );
    if (!matchExists) {
      return;
    }
    this.tutorialActive = true;
    this.tutorialPlateIdx = 0;
    this.tutorialOverlay.show();
    this.startTutorialOrderStep();
  }

  /**
   * 第二关：首次进关时突出第 3/4 路订单盘。
   * 这一关已默认开 4 路，让玩家马上感受到多订单并行会更快消耗水果、降低卡槽压力。
   */
  private tryStartSecondLevelOrderPlatesTutorial(): void {
    if (this.tutorialActive) {
      return;
    }
    if (!this.levelDef || this.levelDef.levelNumber !== 2) {
      return;
    }
    if (isSecondLevelOrderPlatesTutorialDone()) {
      return;
    }
    if (this.parallelPlateCount < 4) {
      return;
    }

    this.tutorialActive = true;
    this.tutorialStep = 'orderPlates';
    this.tutorialTargetFruit = null;
    this.tutorialPlateIdx = null;
    this.tutorialOverlay.setCaption('解锁多个订单能更快过关');
    this.tutorialOverlay.setHandFacing('up');
    this.tutorialOverlay.enableTapCatcher(() => {
      markSecondLevelOrderPlatesTutorialDone();
      this.endTutorial();
      this.evaluateBufferPanicState();
    });
    this.tutorialOverlay.show();
    this.refreshTutorialHighlight();
  }

  /** 第一步：指订单气泡，文案告诉玩家任务目标 */
  private startTutorialOrderStep(): void {
    if (!this.tutorialActive) {
      return;
    }
    const order = this.parallelOrders[0];
    if (!order) {
      this.endTutorial(true);
      return;
    }
    this.tutorialStep = 'order';
    this.tutorialTargetFruit = null;
    const fruitName = FRUIT_MAP[order.fruitId]?.label ?? '水果';
    this.tutorialOverlay.setCaption(
      `这是第一份订单：交付 ${this.orderSize} 份「${fruitName}」即可完成（点击屏幕继续）`,
    );
    this.tutorialOverlay.setHandFacing('up');
    this.tutorialOverlay.enableTapCatcher(() => this.advanceTutorialToFruitStep());
    this.refreshTutorialHighlight();
  }

  /** 第二步：依次指引点击碗内对应水果 */
  private advanceTutorialToFruitStep(): void {
    if (!this.tutorialActive) {
      return;
    }
    this.tutorialStep = 'fruit';
    this.tutorialOverlay.enableTapCatcher(null);
    this.tutorialOverlay.setHandFacing('down');
    this.tutorialOverlay.setCaption('点击碗内对应水果，加入订单盘');
    this.pickNextTutorialFruitTarget();
  }

  /** 在剩余水果里挑下一个引导目标；找不到则结束引导 */
  private pickNextTutorialFruitTarget(): void {
    if (!this.tutorialActive || this.tutorialStep !== 'fruit') {
      return;
    }
    const order = this.parallelOrders[0];
    if (!order) {
      this.endTutorial(true);
      return;
    }
    const target = this.fruits.find(
      (f) =>
        f.fruitId === order.fruitId &&
        f.phase === 'bowl' &&
        !f.picked &&
        !f.hiddenReserve,
    );
    if (!target) {
      this.endTutorial(true);
      return;
    }
    this.tutorialTargetFruit = target;
    this.refreshTutorialHighlight();
  }

  /** 在 finishOrderCommitForFruit 末尾调用：推进到下一颗或结束引导 */
  private onTutorialFruitDelivered(plateIdx: PlateIdx): void {
    if (!this.tutorialActive || this.tutorialStep !== 'fruit') {
      return;
    }
    if (this.tutorialPlateIdx !== null && plateIdx !== this.tutorialPlateIdx) {
      return;
    }
    /** 当前订单已交付到位（finishOrderCommitForFruit 增量后再触发本回调） */
    const order = this.parallelOrders[plateIdx];
    if (!order || order.progress >= this.orderSize) {
      this.endTutorial(true);
      return;
    }
    this.pickNextTutorialFruitTarget();
  }

  /** 引导结束：清状态 + 隐藏 overlay；可选标记为已完成 */
  private endTutorial(persistDone = false): void {
    if (persistDone) {
      markFirstLevelTutorialDone();
    }
    this.tutorialActive = false;
    this.tutorialStep = null;
    this.tutorialTargetFruit = null;
    this.tutorialPlateIdx = null;
    this.tutorialOverlay.hide();
  }

  /** 把高亮 / 手指同步到当前目标（订单气泡或目标水果） */
  private refreshTutorialHighlight(): void {
    if (!this.tutorialActive) {
      return;
    }
    if (this.tutorialStep === 'order') {
      const view = this.orderViews[0];
      if (!view) {
        return;
      }
      const local = this.container.toLocal(
        view.container.toGlobal(new PIXI.Point(ORDER_BUBBLE_W / 2, ORDER_BUBBLE_H / 2)),
      );
      this.tutorialOverlay.setHighlight({
        kind: 'rect',
        cx: local.x,
        cy: local.y,
        w: ORDER_BUBBLE_W + 22,
        h: ORDER_BUBBLE_H + 22,
        cornerR: 22,
      });
      return;
    }
    if (this.tutorialStep === 'fruit') {
      const target = this.tutorialTargetFruit;
      if (!target || !target.parent || target.picked || target.phase !== 'bowl') {
        this.pickNextTutorialFruitTarget();
        return;
      }
      const world = target.toGlobal(new PIXI.Point(0, 0));
      const local = this.container.toLocal(world);
      const radius = Math.max(56, Math.min(96, 48 * Math.max(target.scale.x, 0.9)));
      this.tutorialOverlay.setHighlight({
        kind: 'circle',
        cx: local.x,
        cy: local.y,
        r: radius,
      });
      return;
    }
    if (this.tutorialStep === 'orderPlates') {
      const left = this.orderPlateCenterX[2] ?? Game.logicWidth * 0.62;
      const right = this.orderPlateCenterX[3] ?? Game.logicWidth * 0.82;
      const cx = (left + right) / 2;
      /** 第二关只框住后两个订单盘本体，避免把上方订单气泡也纳入高亮范围。 */
      const plateR = ORDER_LOCK_PLATE_RADIUS * 0.82;
      const w = Math.abs(right - left) + plateR * 2 + 14;
      this.tutorialOverlay.setHighlight({
        kind: 'rect',
        cx,
        cy: this.orderPlateRowY + 2,
        w,
        h: plateR * 2 + 16,
        cornerR: 24,
      });
    }
  }

  private applyBufferStripLayout(): void {
    const lay = computeBufferStripLayout(this.bufferSize, Game.logicWidth);
    const hasPlateSheet = !!TextureCache.get('bowl_plates');
    for (let i = 0; i < BUFFER_SLOTS_MAX; i += 1) {
      const holder = this.slotStripHolders[i]!;
      if (i >= this.bufferSize || !hasPlateSheet) {
        holder.visible = false;
        continue;
      }
      holder.visible = true;
      holder.position.set(lay.startX + i * (lay.slotW + lay.gap), this.bufferStripRowY);
      const first = holder.getChildAt(0);
      if (first instanceof PIXI.Graphics) {
        first.clear();
        first.lineStyle(4, 0xffffff, 0.92);
        first.beginFill(this.currentTheme.slotTint, 0.96);
        first.drawRoundedRect(0, 0, lay.slotW, lay.slotH, lay.cornerR);
        first.endFill();
      }
      const anchor = this.bufferSlotAnchors[i]!;
      anchor.position.set(lay.slotW / 2, lay.slotH / 2);
    }
    this.orderProgressRoot.position.set(orderProgressRootX(Game.logicWidth), this.bufferStripRowY + lay.slotH + ORDER_PROGRESS_GAP);
  }

  private refreshBufferStripLayout(): void {
    this.applyBufferStripLayout();
    this.mountBufferStripTextures();
  }

  private findFirstEmptyBufferSlot(): number {
    for (let i = 0; i < this.bufferSize; i += 1) {
      if (
        (this.bufferSlots[i] === null || this.bufferSlots[i] === undefined) &&
        !this.pendingBufferSlotIndexes.has(i)
      ) {
        return i;
      }
    }
    return -1;
  }

  private findLeftmostBufferPlateMatch(): { bufIdx: number; plateIdx: PlateIdx } | null {
    for (let i = 0; i < this.bufferSize; i += 1) {
      const f = this.bufferSlots[i];
      if (!f || f.frozen) {
        continue;
      }
      const plateIdx = this.resolvePlateForFruitId(f.fruitId);
      if (plateIdx !== null) {
        return { bufIdx: i, plateIdx };
      }
    }
    return null;
  }

  private findRightmostBufferOccupied(): number {
    for (let i = this.bufferSize - 1; i >= 0; i -= 1) {
      if (this.bufferSlots[i]) {
        return i;
      }
    }
    return -1;
  }

  private getOrderReservedProgress(plateIdx: PlateIdx): number {
    const order = this.parallelOrders[plateIdx];
    return (order?.progress ?? 0) + this.pendingOrderPlateCounts[plateIdx];
  }

  private totalRemainingInLevel(): number {
    return this.orderFruitIds.reduce((sum, id) => sum + (this.remainingCounts[id] ?? 0), 0);
  }

  private getInitialOrderCountForLevel(): number {
    const totalPieces = this.totalRemainingInLevel();
    if (totalPieces % this.orderSize !== 0) {
      console.error(
        `[BowlScene] 关卡配置错误：${this.levelDef.displayName} 的订单水果总数 ${totalPieces} ` +
          `不能被 orderTarget=${this.orderSize} 整除。请把每种水果数量配置成 ${this.orderSize} 的倍数。`,
      );
    }
    return Math.floor(totalPieces / this.orderSize);
  }

  private checkLevelClear(): void {
    if (this.totalRemainingInLevel() <= 0) {
      this.showWinOverlay();
    }
  }

  /** 新盘订单：尽量与其它并行盘种类不同（仍有库存时） */
  private pickFruitIdForPlateSlot(plateIdx: PlateIdx): FruitId | null {
    if (!this.hasCapacityForNewOrder(plateIdx)) {
      return null;
    }
    const reserved: Partial<Record<FruitId, number>> = {};
    for (let p = 0; p < this.parallelPlateCount; p += 1) {
      if (p === plateIdx) {
        continue;
      }
      const order = this.parallelOrders[p as PlateIdx];
      if (!order) {
        continue;
      }
      reserved[order.fruitId] = (reserved[order.fruitId] ?? 0) + Math.max(0, this.orderSize - order.progress);
    }

    const pool = this.orderFruitIds.filter(
      (id) => (this.remainingCounts[id] ?? 0) - (reserved[id] ?? 0) >= this.orderSize,
    );
    if (pool.length === 0) {
      return null;
    }
    const busyOthers = new Set<FruitId>();
    for (let p = 0; p < this.parallelPlateCount; p += 1) {
      if (p === plateIdx) {
        continue;
      }
      const o = this.parallelOrders[p as PlateIdx];
      if (o && o.progress < this.orderSize) {
        busyOthers.add(o.fruitId);
      }
    }
    let cand = pool.filter((id) => !busyOthers.has(id));
    if (cand.length === 0) {
      cand = pool.slice();
    }
    const picked = shuffle(cand)[0];
    return picked ?? null;
  }

  private hasCapacityForNewOrder(plateIdx: PlateIdx): boolean {
    const reserved: Partial<Record<FruitId, number>> = {};
    for (let p = 0; p < this.parallelPlateCount; p += 1) {
      if (p === plateIdx) {
        continue;
      }
      const order = this.parallelOrders[p as PlateIdx];
      if (!order) {
        continue;
      }
      reserved[order.fruitId] = (reserved[order.fruitId] ?? 0) + Math.max(0, this.orderSize - order.progress);
    }
    return this.orderFruitIds.some((id) => (this.remainingCounts[id] ?? 0) - (reserved[id] ?? 0) >= this.orderSize);
  }

  private assignOrderToPlate(plateIdx: PlateIdx): void {
    const id = this.pickFruitIdForPlateSlot(plateIdx);
    if (!id) {
      this.parallelOrders[plateIdx] = null;
      return;
    }
    this.parallelOrders[plateIdx] = { fruitId: id, progress: 0 };
  }

  private initParallelOrders(): void {
    const totalLeft = this.totalRemainingInLevel();
    if (totalLeft <= 0) {
      this.showWinOverlay();
      return;
    }
    const hasAny = this.orderFruitIds.some((id) => (this.remainingCounts[id] ?? 0) >= this.orderSize);
    if (!hasAny) {
      console.error(
        `[BowlScene] 关卡配置错误：${this.levelDef.displayName} 仍剩 ${totalLeft} 个订单水果，` +
          `但没有任何水果数量达到 orderTarget=${this.orderSize}。`,
      );
      return;
    }
    this.parallelOrders = [null, null, null, null];
    for (let p = 0; p < this.parallelPlateCount; p += 1) {
      this.assignOrderToPlate(p as PlateIdx);
    }
    for (let p = this.parallelPlateCount; p < 4; p += 1) {
      this.parallelOrders[p as PlateIdx] = null;
    }
    this.renderOrders();
    this.refreshHud();
    this.tryConsumeOrderFromBuffer();
  }

  /** 可接收该水果的盘子；多盘同单时优先进度少的盘（再比左） */
  private resolvePlateForFruitId(fruitId: FruitId): PlateIdx | null {
    const candidates: PlateIdx[] = [];
    for (let p = 0; p < this.parallelPlateCount; p += 1) {
      const plateIdx = p as PlateIdx;
      const o = this.parallelOrders[plateIdx];
      if (o && o.fruitId === fruitId && this.getOrderReservedProgress(plateIdx) < this.orderSize) {
        candidates.push(plateIdx);
      }
    }
    if (candidates.length === 0) {
      return null;
    }
    if (candidates.length === 1) {
      return candidates[0]!;
    }
    candidates.sort((a, b) => {
      const pa = this.getOrderReservedProgress(a);
      const pb = this.getOrderReservedProgress(b);
      if (pa !== pb) {
        return pa - pb;
      }
      return a - b;
    });
    return candidates[0]!;
  }

  private resetThirdPlateForRound(): void {
    /**
     * 关卡可在 levelDef.plateLanesInitial 配置初始解锁的订单盘数（2/3/4），
     * 默认 2。L8+ 用 3 路开局，让中阶节奏更紧。
     */
    const desired = this.levelDef.plateLanesInitial ?? 2;
    const initial = Math.max(2, Math.min(4, desired)) as 2 | 3 | 4;
    this.parallelPlateCount = initial;
    this.parallelOrders[2] = null;
    this.parallelOrders[3] = null;
    const lock3 = initial < 3;
    const lock4 = initial < 4;
    this.thirdPlateLockDecor.visible = lock3;
    this.thirdPlateLockDecor.position.set(this.orderPlateCenterX[2]!, this.orderPlateRowY);
    this.fourthPlateLockDecor.visible = lock4;
    this.fourthPlateLockDecor.position.set(this.orderPlateCenterX[3]!, this.orderPlateRowY);
    this.orderViews[2]!.container.visible = !lock3;
    this.orderViews[3]!.container.visible = !lock4;
    for (const plateIdx of [2, 3] as const) {
      const pv = this.plateVisualHolders[plateIdx];
      if (pv) {
        pv.locked = plateIdx === 2 ? lock3 : lock4;
        this.remountPlateDisc(pv);
      }
    }
  }

  private unlockNextParallelPlateForRound(): boolean {
    if (this.parallelPlateCount >= 4) {
      return false;
    }
    const plateIdx = this.parallelPlateCount as PlateIdx;
    this.parallelPlateCount = (this.parallelPlateCount + 1) as 3 | 4;
    this.parallelOrders[plateIdx] = null;
    if (plateIdx === 2) {
      this.thirdPlateLockDecor.visible = false;
    } else {
      this.fourthPlateLockDecor.visible = false;
    }
    this.orderViews[plateIdx]!.container.visible = true;
    const pv = this.plateVisualHolders[plateIdx];
    if (pv) {
      pv.locked = false;
      this.remountPlateDisc(pv);
    }
    this.assignOrderToPlate(plateIdx);
    this.revealHiddenReserveForActiveOrders();
    this.renderOrders();
    this.refreshHud();
    this.tryConsumeOrderFromBuffer();
    return true;
  }

  private unlockNextOrderPlateReward(): void {
    if (this.unlockNextParallelPlateForRound()) {
      this.toast('已解锁1路订单盘');
      return;
    }
    this.toast('订单盘已解锁');
  }

  private remountPlateDisc(pv: (typeof this.plateVisualHolders)[number]): void {
    const sheet = TextureCache.get('bowl_plates');
    if (!sheet) {
      return;
    }
    const colW = Math.floor(sheet.width / 2);
    const discRect = new PIXI.Rectangle(0, 0, colW, sheet.height);
    pv.holder.removeChildren();
    const sub = new PIXI.Texture(sheet.baseTexture, discRect);
    const sp = new PIXI.Sprite(sub);
    sp.anchor.set(0.5);
    const diam = pv.radius * 2;
    const sc = diam / Math.max(colW, sheet.height);
    sp.scale.set(sc);
    if (pv.locked) {
      sp.tint = 0x9a9590;
    }
    pv.holder.addChild(sp, pv.iconLayer);
    pv.holder.visible = true;
  }

  private mountBufferStripTextures(): void {
    const sheet = TextureCache.get('bowl_plates');
    if (!sheet) {
      return;
    }
    const colW = Math.floor(sheet.width / 2);
    const wRight = sheet.width - colW;
    const slotRect = new PIXI.Rectangle(colW, 0, wRight, sheet.height);
    const lay = computeBufferStripLayout(this.bufferSize, Game.logicWidth);
    for (let i = 0; i < BUFFER_SLOTS_MAX; i += 1) {
      const holder = this.slotStripHolders[i]!;
      const anchor = this.bufferSlotAnchors[i]!;
      if (i >= this.bufferSize) {
        holder.removeChildren();
        holder.addChild(anchor);
        continue;
      }
      holder.removeChildren();
      const sub = new PIXI.Texture(sheet.baseTexture, slotRect);
      const sp = new PIXI.Sprite(sub);
      sp.anchor.set(0.5);
      sp.position.set(lay.slotW / 2, lay.slotH / 2);
      sp.width = lay.slotW;
      sp.height = lay.slotH;
      holder.addChild(sp, anchor);
    }
    if (this.bufferPanicActive) {
      this.rebuildBufferPanicSlotRings();
    }
  }

  private getToolRewardIconTexture(kind: ToolKind): PIXI.Texture | null {
    const sheet = TextureCache.get(BOWL_TOOL_REWARD_ICONS_TEXTURE_KEY);
    if (!sheet || sheet.width <= 0 || sheet.height <= 0) {
      return null;
    }
    const index = kind === 'addDish' ? 0 : kind === 'remove' ? 1 : 2;
    const cellW = Math.floor(sheet.width / 3);
    const x = cellW * index;
    const w = index === 2 ? sheet.width - cellW * 2 : cellW;
    return new PIXI.Texture(sheet.baseTexture, new PIXI.Rectangle(x, 0, w, sheet.height));
  }

  private releaseBufferSlotToBowl(bufIdx: number): void {
    const fruit = this.bufferSlots[bufIdx];
    if (!fruit) {
      return;
    }
    this.bufferSlots[bufIdx] = null;
    this.evaluateBufferPanicState();
    const anchor = this.bufferSlotAnchors[bufIdx]!;
    const worldStart = anchor.toGlobal(new PIXI.Point(fruit.x, fruit.y));
    anchor.removeChild(fruit);
    const lp = this.fruitLayer.toLocal(worldStart);
    fruit.position.copyFrom(lp);
    fruit.scale.set(this.randomBowlFruitScale(fruit.fruitId));
    this.mountFruitInBowlLayer(fruit, true);
    fruit.phase = 'bowl';
    fruit.bufferSlotIndex = null;
    fruit.picked = false;
    fruit.eventMode = 'static';
    fruit.cursor = 'pointer';
    /** 复活清空 buffer 时也一并解冻冻果，回到碗里就是普通水果 */
    if (fruit.frozen) {
      fruit.setFrozen(false);
    }
    const p = this.randomBowlPoint();
    fruit.position.set(p.x, p.y);
    fruit.velocityX = this.randomInRange(-10, 10);
    fruit.velocityY = this.randomInRange(-7, 7);
  }

  private performRevive(): void {
    for (let i = 0; i < this.bufferSize; i += 1) {
      if (this.bufferSlots[i]) {
        this.releaseBufferSlotToBowl(i);
      }
    }
    const unlocked = this.unlockNextParallelPlateForRound();
    this.toast(unlocked ? '已清空菜碟并解锁订单盘' : '已清空菜碟');
    this.renderOrders();
    this.refreshHud();
    this.tryConsumeOrderFromBuffer();
  }

  private showLoseGiveUpOverlay(): void {
    this.hideToolHelpPanel();
    this.exitBufferPanic();
    this.fruitLayer.eventMode = 'none';
    // 关卡失败打点：玩家主动放弃这一关，记下还剩多少订单未完成 + 本关耗时
    analytics.track(EVENT_NAMES.LEVEL_FAIL, {
      level_id: getBowlLevelIndex() + 1,
      level_name: this.levelDef.displayName,
      orders_remaining: this.ordersRemaining,
      duration_ms: this.roundStartTs > 0 ? Date.now() - this.roundStartTs : 0,
      reason: 'give_up',
    });
    this.failSettlementOverlay.show({
      levelLabel: this.levelDef.displayName,
      ordersRemaining: this.ordersRemaining,
      onRetry: () => {
        this.failSettlementOverlay.hide();
        this.fruitLayer.eventMode = 'static';
        this.startRound();
      },
      onHome: () => {
        this.failSettlementOverlay.hide();
        this.fruitLayer.eventMode = 'static';
        SceneManager.switchTo('home');
      },
    });
  }

  private refillPlateAfterComplete(plateIdx: PlateIdx): void {
    this.ordersRemaining = Math.max(0, this.ordersRemaining - 1);
    AudioManager.playOrderCompleteSound();
    this.playOrderCompleteFeedback(plateIdx);
    this.playOrderPlateCompleteTransition(plateIdx, () => {
      this.assignOrderToPlate(plateIdx);
      this.revealHiddenReserveForActiveOrders();
      this.revealHiddenReserveBatch(this.levelDef.revealPerOrderComplete ?? 0);
      this.rebalanceHiddenReserveVisibility();
      this.renderOrders();
      this.refreshHud();
      this.checkLevelClear();
      if (!this.isBowlInteractionBlocked()) {
        this.tryConsumeOrderFromBuffer();
      }
    });
  }

  private playOrderPlateCompleteTransition(plateIdx: PlateIdx, onDone: () => void): void {
    if (this.orderTransitionBusy) {
      onDone();
      return;
    }
    this.orderTransitionBusy = true;

    const pv = this.plateVisualHolders[plateIdx];
    const bubble = this.orderViews[plateIdx]?.container;
    const icons = this.collectPlateIconSprites(plateIdx);
    const targets: PIXI.Container[] = [pv?.holder, bubble, ...icons].filter((v): v is PIXI.Container => !!v);
    const original = targets.map((node) => ({
      node,
      x: node.x,
      y: node.y,
      alpha: node.alpha,
      scaleX: node.scale.x,
      scaleY: node.scale.y,
    }));
    const flash = this.createOrderCompleteFlash(plateIdx);
    this.container.addChild(flash);

    let elapsed = 0;
    let assigned = false;
    const outDuration = 0.42;
    const inDuration = 0.42;
    const gap = 0.16;
    const total = outDuration + gap + inDuration;
    const flyOutX = -240;
    const flyInStartX = Game.logicWidth + 220;

    const ticker = () => {
      elapsed += Game.ticker.deltaMS / 1000;
      if (elapsed <= outDuration) {
        const t = this.easeOutCubic(elapsed / outDuration);
        flash.alpha = 1 - t;
        flash.scale.set(1 + t * 0.5);
        for (const item of original) {
          item.node.x = item.x + (flyOutX - item.x) * t;
          item.node.alpha = item.alpha * (1 - t);
          item.node.scale.set(item.scaleX * (1 + t * 0.12), item.scaleY * (1 + t * 0.12));
        }
        return;
      }

      if (!assigned) {
        flash.removeFromParent();
        flash.destroy({ children: true });
        onDone();
        for (const item of original) {
          item.node.x = flyInStartX;
          item.node.y = item.y;
          item.node.alpha = 0;
          item.node.scale.set(item.scaleX, item.scaleY);
        }
        assigned = true;
      }

      const inElapsed = elapsed - outDuration - gap;
      if (inElapsed < 0) {
        return;
      }
      const t = this.easeOutCubic(Math.min(inElapsed / inDuration, 1));
      for (const item of original) {
        item.node.x = flyInStartX + (item.x - flyInStartX) * t;
        item.node.y = item.y;
        item.node.alpha = item.alpha * t;
        const pop = 1 + Math.sin(t * Math.PI) * 0.08;
        item.node.scale.set(item.scaleX * pop, item.scaleY * pop);
      }

      if (elapsed >= total) {
        Game.ticker.remove(ticker);
        for (const item of original) {
          item.node.x = item.x;
          item.node.y = item.y;
          item.node.alpha = item.alpha;
          item.node.scale.set(item.scaleX, item.scaleY);
        }
        this.orderTransitionBusy = false;
        if (!this.isBowlInteractionBlocked()) {
          this.tryConsumeOrderFromBuffer();
        }
      }
    };

    Game.ticker.add(ticker);
  }

  private createOrderCompleteFlash(plateIdx: PlateIdx): PIXI.Container {
    const root = new PIXI.Container();
    const cx = this.orderPlateCenterX[plateIdx] ?? Game.logicWidth * 0.5;
    const cy = this.orderPlateRowY;
    root.position.set(cx, cy);
    const ring = new PIXI.Graphics();
    ring.lineStyle(8, 0xfff2a8, 0.9);
    ring.beginFill(0xffffff, 0.14);
    ring.drawCircle(0, 0, 64);
    ring.endFill();
    root.addChild(ring);
    const text = new PIXI.Text('完成', {
      fontSize: 28,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0xc25b16,
      strokeThickness: 4,
    });
    text.anchor.set(0.5);
    root.addChild(text);
    return root;
  }

  private collectPlateIconSprites(plateIdx: PlateIdx): PIXI.Container[] {
    const layer = this.plateVisualHolders[plateIdx]?.iconLayer;
    return layer ? (layer.children.filter((child) => child instanceof PIXI.Container) as PIXI.Container[]) : [];
  }

  private playFruitTapFeedback(fruit: FruitItem, kind: BowlTapFeedbackKind): void {
    fruit.playTapPop(kind === 'frozen' ? 'frozen' : kind === 'order' ? 'order' : 'buffer');
    this.bowlVfxLayer.playTapRipple(fruit.x, fruit.y + 10, kind);
    this.soupDisturbanceSec = Math.max(this.soupDisturbanceSec, kind === 'order' ? 0.32 : 0.22);
    if (kind === 'order') {
      Haptics.medium();
    } else {
      Haptics.light();
    }
  }

  private playBufferSlotLandFeedback(slotIndex: number): void {
    const holder = this.slotStripHolders[slotIndex];
    if (!holder) {
      return;
    }
    const lay = computeBufferStripLayout(this.bufferSize, Game.logicWidth);
    const world = holder.toGlobal(new PIXI.Point(lay.slotW / 2, lay.slotH / 2));
    const local = this.uiVfxLayer.toLocal(world);
    this.uiVfxLayer.playBufferLand(local.x, local.y);
  }

  private playOrderPlateHitFeedback(plateIdx: PlateIdx, slotIndex: number): void {
    const target = this.getPlateSlotWorld(plateIdx, slotIndex);
    this.uiVfxLayer.playPlateHit(target.x, target.y);
    const view = this.orderViews[plateIdx]?.container;
    if (view) {
      this.pulseContainer(view, 0.12, 0.18);
    }
  }

  private playOrderCompleteFeedback(plateIdx: PlateIdx): void {
    const cx = this.orderPlateCenterX[plateIdx] ?? Game.logicWidth * 0.5;
    const cy = this.orderPlateRowY;
    this.uiVfxLayer.playOrderCompleteBurst(cx, cy);
    Haptics.medium();
  }

  private pulseContainer(node: PIXI.Container, amount: number, durationSec: number): void {
    const baseX = node.scale.x;
    const baseY = node.scale.y;
    let elapsed = 0;
    const ticker = () => {
      elapsed += Game.ticker.deltaMS / 1000;
      const t = Math.min(1, elapsed / durationSec);
      const pop = 1 + Math.sin(t * Math.PI) * amount;
      node.scale.set(baseX * pop, baseY * pop);
      if (t >= 1) {
        Game.ticker.remove(ticker);
        node.scale.set(baseX, baseY);
      }
    };
    Game.ticker.add(ticker);
  }

  private easeOutCubic(t: number): number {
    const x = Math.max(0, Math.min(1, t));
    return 1 - (1 - x) * (1 - x) * (1 - x);
  }

  private showWinOverlay(): void {
    if (this.hasShownClearForRound) {
      return;
    }
    this.hasShownClearForRound = true;
    this.hideToolHelpPanel();
    this.exitBufferPanic();
    this.fruitLayer.eventMode = 'none';
    const idx = getBowlLevelIndex();
    // 关卡通关打点：在解锁徽章 / 切下一关之前先把成功事件上报
    analytics.track(EVENT_NAMES.LEVEL_CLEAR, {
      level_id: idx + 1,
      level_name: this.levelDef.displayName,
      duration_ms: this.roundStartTs > 0 ? Date.now() - this.roundStartTs : 0,
    });
    const isLast = idx >= BOWL_LEVEL_COUNT - 1;
    const introduced = isLast ? [] : getNewFruitsIntroducedInLevel(idx + 1);
    const skinUnlocks = isLast ? [] : getBowlSkinUnlocksInLevel(idx + 2);
    const passRate = LevelPassRateService.getLevel(idx + 1);
    const showLevelClear = (): void => {
      this.levelClearOverlay.show({
        newFruitIds: introduced,
        newSkinUnlocks: skinUnlocks,
        passRate,
        isLastLevel: isLast,
        isAllClear: isLast,
        onHome: () => {
          this.levelClearOverlay.hide();
          SceneManager.switchTo('home');
        },
        onNextLevel: () => {
          this.levelClearOverlay.hide();
          if (!isLast) {
            setBowlLevelIndex(idx + 1);
          }
          void this.ensureTexturesForLevel(getBowlLevelIndex())
            .then(() => {
              this.startRound();
            })
            .catch((err) => {
              console.error('Failed to load next bowl level textures', err);
            });
        },
        onShare: () => {
          if (shareGame({
            title: '40关全清！我把这碗水果捞满分通关了',
            query: 'from=share&entry=bowl_all_clear',
          })) {
            this.toast('转发成功');
          } else {
            this.toast('转发请在微信小游戏中使用');
          }
        },
      });
    };
    const badge = getBowlBadgeDef(this.levelDef.levelNumber);
    if (!isLast) {
      setBowlLevelIndex(idx + 1);
    }
    recordBowlBadgeUnlocked(badge.levelNumber);
    // 通关一次就上报最新进度；服务端按 (level, badgeLevel) 去重，已存在更高进度则会自动跳过
    submitCurrentBowlProgressRank();
    this.badgeUnlockOverlay.show({
      badge,
      texture: TextureCache.get(`bowl_badge_${badge.levelNumber}`),
      shareReward: {
        toolKind: 'remove',
        iconTexture: this.getToolRewardIconTexture('remove'),
        buttonTexture: TextureCache.get(BADGE_SHARE_REWARD_BUTTON_TEXTURE_KEY),
        canClaim: canClaimDailyShareToolReward(),
        ownedCount: getToolCount('remove'),
        onShare: async () => {
          const cardImageUrl = await createBadgeShareCard({ badge });
          const shareResult = await shareGameForReward({
            title: `我刚解锁「${badge.title}」徽章！来挑战一下`,
            imageUrl: cardImageUrl ?? undefined,
          });
          if (shareResult === 'unavailable') {
            return { status: 'unavailable' };
          }
          if (shareResult === 'failed') {
            return { status: 'failed' };
          }
          const reward = claimDailyShareCleanupReward();
          if (!reward) {
            return { status: 'already_claimed', count: getToolCount('remove') };
          }
          analytics.track('tool_reward_claim', {
            level_id: this.levelDef?.levelNumber,
            tool_kind: reward.kind,
            count_after: reward.count,
            source: 'daily_share',
          });
          this.refreshToolInventoryBadges();
          return { status: 'claimed', count: reward.count };
        },
      },
      onClose: showLevelClear,
    });
  }

  private showLoseOverlay(): void {
    this.hideToolHelpPanel();
    this.exitBufferPanic();
    this.fruitLayer.eventMode = 'none';
    this.reviveOverlay.show({
      totalOrders: this.totalOrdersForProgress,
      ordersRemaining: this.ordersRemaining,
      onRevive: () => {
        void this.runRewardedGameplayAction('level_fail_revive', () => {
          this.performRevive();
          this.reviveOverlay.hide();
          this.fruitLayer.eventMode = 'static';
        });
      },
      onRetry: () => {
        this.reviveOverlay.hide();
        this.fruitLayer.eventMode = 'static';
        this.startRound();
      },
      onHome: () => {
        this.reviveOverlay.hide();
        this.fruitLayer.eventMode = 'static';
        SceneManager.switchTo('home');
      },
    });
  }

  private pickFruit(fruit: FruitItem): void {
    if (
      fruit.picked ||
      fruit.hiddenReserve ||
      fruit.phase !== 'bowl' ||
      this.orderTransitionBusy ||
      this.isBowlInteractionBlocked()
    ) {
      return;
    }
    /** 新手引导期间，订单步阶段忽略所有水果点击；水果步仅放行当前高亮目标 */
    if (this.tutorialActive) {
      if (this.tutorialStep !== 'fruit') {
        return;
      }
      if (fruit !== this.tutorialTargetFruit) {
        return;
      }
    }

    /** 冻果：跳过订单飞盘路径，强制走 buffer。解冻完成后才按普通水果交付 */
    const plateIdx = !fruit.frozen ? this.resolvePlateForFruitId(fruit.fruitId) : null;
    if (plateIdx !== null) {
      const slot = this.parallelOrders[plateIdx];
      if (!slot) {
        return;
      }
      this.playFruitTapFeedback(fruit, 'order');
      AudioManager.playScoopSound();
      fruit.picked = true;
      fruit.phase = 'flying';
      fruit.eventMode = 'none';
      this.liftFruitToFlyingLayer(fruit);
      const fromX = fruit.x;
      const fromY = fruit.y;
      const reservedProgress = this.getOrderReservedProgress(plateIdx);
      this.pendingOrderPlateCounts[plateIdx] += 1;
      const world = this.getPlateSlotWorld(plateIdx, reservedProgress);
      this.runFlightToPlate(fruit, fromX, fromY, world.x, world.y, () => {
        this.pendingOrderPlateCounts[plateIdx] = Math.max(0, this.pendingOrderPlateCounts[plateIdx] - 1);
        this.finishOrderCommitForFruit(fruit, plateIdx);
      });
      return;
    }

    const emptyIdx = this.findFirstEmptyBufferSlot();
    if (emptyIdx < 0) {
      fruit.playInvalidShake();
      this.bowlVfxLayer.playTapRipple(fruit.x, fruit.y, 'invalid');
      Haptics.heavy();
      this.showLoseOverlay();
      return;
    }

    fruit.picked = true;
    this.playFruitTapFeedback(fruit, fruit.frozen ? 'frozen' : 'buffer');
    AudioManager.playScoopSound();
    fruit.phase = 'flying';
    fruit.eventMode = 'none';
    this.pendingBufferSlotIndexes.add(emptyIdx);

    const holder = this.slotStripHolders[emptyIdx]!;
    const lay = computeBufferStripLayout(this.bufferSize, Game.logicWidth);
    const endGlobal = holder.toGlobal(new PIXI.Point(lay.slotW / 2, lay.slotH / 2));
    const parent = fruit.parent!;
    const endLocal = parent.toLocal(endGlobal);
    const fromX = fruit.x;
    const fromY = fruit.y;
    const duration = 0.28;
    let elapsed = 0;

    const ticker = () => {
      elapsed += Game.ticker.deltaMS / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      fruit.x = fromX + (endLocal.x - fromX) * eased;
      fruit.y = fromY + (endLocal.y - fromY) * eased - Math.sin(progress * Math.PI) * 28;
      fruit.scale.set(Math.max(0.72, fruit.scale.x * 0.985));

      if (progress >= 1) {
        Game.ticker.remove(ticker);
        const anchor = this.bufferSlotAnchors[emptyIdx]!;
        this.pendingBufferSlotIndexes.delete(emptyIdx);
        fruit.picked = false;
        fruit.phase = 'buffer';
        fruit.bufferSlotIndex = emptyIdx;
        parent.removeChild(fruit);
        fruit.position.set(0, 0);
        fruit.scale.set(0.88);
        this.resetFruitStandaloneVisual(fruit);
        anchor.addChild(fruit);
        this.bufferSlots[emptyIdx] = fruit;
        this.playBufferSlotLandFeedback(emptyIdx);
        if (fruit.frozen) {
          /** 冻果落槽即启动倒计时；归零后由 BowlScene.update 自动解冻 */
          fruit.frostRemainingMs = FROZEN_FRUIT_THAW_MS;
          fruit.refreshFrostTimerLabel();
        }
        this.tryConsumeOrderFromBuffer();
        /**
         * tryConsumeOrderFromBuffer 命中即时清空槽位 + 自评 panic；
         * 没命中时走这里兜底再评一次，保证"全占满 + 没匹配"必然进入危险态。
         */
        this.evaluateBufferPanicState();
      }
    };

    Game.ticker.add(ticker);
  }

  private runFlightToPlate(
    fruit: FruitItem,
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    onDone: () => void,
  ): void {
    const duration = 0.24;
    let elapsed = 0;
    const ticker = () => {
      elapsed += Game.ticker.deltaMS / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      fruit.x = fromX + (targetX - fromX) * eased;
      fruit.y = fromY + (targetY - fromY) * eased - Math.sin(progress * Math.PI) * 36;
      fruit.scale.set(Math.max(0.65, fruit.scale.x - 0.02));

      if (progress >= 1) {
        Game.ticker.remove(ticker);
        onDone();
      }
    };
    Game.ticker.add(ticker);
  }

  private tryConsumeOrderFromBuffer(): void {
    if (this.isBowlInteractionBlocked()) {
      return;
    }
    if (this.bufferFlightBusy || this.orderTransitionBusy) {
      return;
    }

    const match = this.findLeftmostBufferPlateMatch();
    if (!match) {
      return;
    }

    const { bufIdx, plateIdx } = match;
    const slotState = this.parallelOrders[plateIdx];
    if (!slotState || this.getOrderReservedProgress(plateIdx) >= this.orderSize) {
      return;
    }

    const fruit = this.bufferSlots[bufIdx];
    if (!fruit || fruit.fruitId !== slotState.fruitId) {
      return;
    }

    this.bufferFlightBusy = true;
    this.bufferSlots[bufIdx] = null;
    this.evaluateBufferPanicState();
    AudioManager.playScoopSound();
    Haptics.light();

    const anchor = this.bufferSlotAnchors[bufIdx]!;
    const worldStart = anchor.toGlobal(new PIXI.Point(fruit.x, fruit.y));
    anchor.removeChild(fruit);
    const lp = this.fruitLayer.toLocal(worldStart);
    fruit.position.copyFrom(lp);
    fruit.scale.set(this.randomInRange(1.24, 1.46));
    this.resetFruitStandaloneVisual(fruit);
    this.flyingFruitLayer.addChild(fruit);
    fruit.phase = 'flying';
    fruit.picked = true;
    fruit.eventMode = 'none';
    fruit.bufferSlotIndex = null;

    const reservedProgress = this.getOrderReservedProgress(plateIdx);
    this.pendingOrderPlateCounts[plateIdx] += 1;
    const world = this.getPlateSlotWorld(plateIdx, reservedProgress);
    const fromX = fruit.x;
    const fromY = fruit.y;
    this.runFlightToPlate(fruit, fromX, fromY, world.x, world.y, () => {
      this.pendingOrderPlateCounts[plateIdx] = Math.max(0, this.pendingOrderPlateCounts[plateIdx] - 1);
      this.bufferFlightBusy = false;
      this.finishOrderCommitForFruit(fruit, plateIdx);
    });
  }

  private finishOrderCommitForFruit(fruit: FruitItem, plateIdx: PlateIdx): void {
    const slot = this.parallelOrders[plateIdx];
    if (!slot || slot.fruitId !== fruit.fruitId || slot.progress >= this.orderSize) {
      console.error(
        `[BowlScene] 订单提交异常：${fruit.fruitId} 无法提交到盘 ${plateIdx}。` +
          `当前盘=${slot ? `${slot.fruitId} ${slot.progress}/${this.orderSize}` : 'empty'}`,
      );
      fruit.removeFromParent();
      const fi = this.fruits.indexOf(fruit);
      if (fi >= 0) {
        this.fruits.splice(fi, 1);
      }
      fruit.destroy({ children: true });
      this.renderOrders();
      this.refreshHud();
      this.checkLevelClear();
      if (!this.isBowlInteractionBlocked()) {
        this.tryConsumeOrderFromBuffer();
      }
      return;
    }

    this.remainingCounts[fruit.fruitId] = Math.max(0, (this.remainingCounts[fruit.fruitId] ?? 0) - 1);
    const committedSlotIndex = slot.progress;
    slot.progress += 1;
    fruit.removeFromParent();
    const fi = this.fruits.indexOf(fruit);
    if (fi >= 0) {
      this.fruits.splice(fi, 1);
    }
    fruit.destroy({ children: true });
    this.renderOrders();
    this.playOrderPlateHitFeedback(plateIdx, committedSlotIndex);
    this.refreshHud();
    this.rebalanceHiddenReserveVisibility();

    const order = this.parallelOrders[plateIdx];
    /** 先让引导决定下一步（结束 or 指下一颗），再走通用补盘 / 关卡判定 */
    this.onTutorialFruitDelivered(plateIdx);
    if (order && order.progress >= this.orderSize) {
      this.refillPlateAfterComplete(plateIdx);
    } else {
      this.checkLevelClear();
      if (!this.isBowlInteractionBlocked()) {
        this.tryConsumeOrderFromBuffer();
      }
    }
  }

  private renderOrders(): void {
    for (let i = 0; i < 4; i += 1) {
      const view = this.orderViews[i]!;
      if (i >= this.parallelPlateCount) {
        view.container.visible = false;
        continue;
      }
      view.container.visible = true;
      const o = this.parallelOrders[i as PlateIdx];
      if (o) {
        this.paintOrderBubble(view, o.fruitId, `x${this.orderSize}`);
        view.container.alpha = 1;
      } else {
        this.paintOrderBubble(view, null, '—');
        view.container.alpha = 0.55;
      }
    }
    this.refreshOrderPlateIcons();
  }

  /**
   * `plateIndex` 对应四枚圆盘圆心；`slotIndex` 为盘上三角槽位。
   */
  private getPlateSlotWorld(plateIndex: PlateIdx, slotIndex: number): PIXI.Point {
    const raw = this.orderPlateCenterX[plateIndex];
    const cx = raw > 0 ? raw : Game.logicWidth * (plateIndex === 0 ? 0.22 : plateIndex === 1 ? 0.5 : 0.78);
    const cy = this.orderPlateRowY;
    const R = 26;
    const n = Math.max(1, Math.min(this.orderSize, 8));
    const idx = Math.min(Math.max(0, slotIndex), n - 1);
    const step = (Math.PI * 2) / n;
    const offset = -Math.PI / 2;
    const a = offset + idx * step;
    return new PIXI.Point(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  }

  /** 解锁盘上已收集的订单水果 */
  private refreshOrderPlateIcons(): void {
    this.plateIconLayer.removeChildren();
    for (const pv of this.plateVisualHolders) {
      pv.iconLayer.removeChildren();
    }
    if (this.orderPlateRowY <= 0) {
      return;
    }
    const side = 40;
    for (let plateIdx = 0; plateIdx < this.parallelPlateCount; plateIdx += 1) {
      const o = this.parallelOrders[plateIdx as PlateIdx];
      if (!o) {
        continue;
      }
      const tex = TextureCache.get(o.fruitId);
      if (!tex) {
        continue;
      }
      for (let i = 0; i < o.progress; i += 1) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const tw = tex.width;
        const th = tex.height;
        if (tw > 0 && th > 0) {
          if (tw >= th) {
            sp.width = side;
            sp.height = (th / tw) * side;
          } else {
            sp.height = side;
            sp.width = (tw / th) * side;
          }
        }
        const p = this.getPlateSlotWorld(plateIdx as PlateIdx, i);
        const pv = this.plateVisualHolders[plateIdx];
        if (!pv) {
          continue;
        }
        sp.position.set(p.x - pv.holder.x, p.y - pv.holder.y);
        pv.iconLayer.addChild(sp);
      }
    }
  }

  private refreshHud(): void {
    const totalLeft = this.orderFruitIds.reduce((sum, id) => sum + (this.remainingCounts[id] ?? 0), 0);
    if (totalLeft <= 0) {
      this.ordersRemaining = 0;
    }
    this.hudRemainderText.text = String(this.ordersRemaining);
    this.refreshOrderProgressDisplay();
    this.layoutHudHeaderPill();
  }

  private layoutHudHeaderPill(): void {
    const pillTop = Game.safeTop + 19;
    const pillH = 52;
    const pillCenterX = Game.logicWidth / 2 - 118;
    const pillCenterY = pillTop + pillH / 2;
    const maxTextW = Game.logicWidth - 310;
    this.hudCloche.visible = false;
    this.hudRemainderText.visible = false;

    this.hudLevelText.scale.set(1);
    if (this.hudLevelText.width > maxTextW) {
      this.hudLevelText.scale.set(maxTextW / this.hudLevelText.width);
    }
    this.hudLevelText.position.set(pillCenterX, pillCenterY - 1);

    const pillW = Math.max(320, Math.min(Game.logicWidth - 250, this.hudLevelText.width + 90));
    const pillLeft = Math.round(pillCenterX - pillW / 2);
    this.hudPillBg.clear();
    this.hudPillBg.beginFill(this.currentTheme.hudOuter, 0.22);
    this.hudPillBg.drawRoundedRect(pillLeft + 3, pillTop + 5, pillW, pillH, 22);
    this.hudPillBg.endFill();
    this.hudPillBg.beginFill(this.currentTheme.hudOuter, 0.96);
    this.hudPillBg.drawRoundedRect(pillLeft, pillTop, pillW, pillH, 22);
    this.hudPillBg.endFill();
    this.hudPillBg.beginFill(this.currentTheme.hudInner, 0.92);
    this.hudPillBg.drawRoundedRect(pillLeft + 5, pillTop + 5, pillW - 10, pillH - 10, 17);
    this.hudPillBg.endFill();
    this.hudPillBg.lineStyle(2.5, this.currentTheme.hudStroke, 0.95);
    this.hudPillBg.drawRoundedRect(pillLeft + 2, pillTop + 2, pillW - 4, pillH - 4, 20);
    this.hudPillBg.lineStyle(1.5, this.currentTheme.hudStroke, 0.42);
    this.hudPillBg.moveTo(pillLeft + 34, pillTop + 12);
    this.hudPillBg.lineTo(pillLeft + pillW - 34, pillTop + 12);
    this.hudPillBg.lineStyle(0);
    this.hudPillBg.beginFill(this.currentTheme.hudStroke, 0.9);
    this.hudPillBg.drawCircle(pillLeft + 24, pillCenterY, 4);
    this.hudPillBg.drawCircle(pillLeft + pillW - 24, pillCenterY, 4);
    this.hudPillBg.endFill();
  }

  private buildHudClocheIcon(): void {
    this.hudCloche.removeChildren();
    const g = new PIXI.Graphics();
    const gold = 0xf5dc73;
    g.lineStyle(2.2, gold, 1);
    g.beginFill(0xfffef8, 0.24);
    g.moveTo(-8, 6);
    g.quadraticCurveTo(-8, -6, 0, -8);
    g.quadraticCurveTo(8, -6, 8, 6);
    g.lineTo(8, 9);
    g.lineTo(-8, 9);
    g.closePath();
    g.endFill();
    g.lineStyle(2, gold, 0.92);
    g.beginFill(0xfffef8, 0.14);
    g.drawEllipse(0, 11.5, 9.5, 3.2);
    g.endFill();
    this.hudCloche.addChild(g);
  }

  private paintOrderBubble(view: OrderBubbleView, fruitId: FruitId | null, count: string): void {
    view.iconBg.clear();
    view.iconBg.beginFill(this.currentTheme.orderBubble);
    view.iconBg.lineStyle(4, this.currentTheme.orderBubbleStroke, 1);
    view.iconBg.drawRoundedRect(0, 0, ORDER_BUBBLE_W, ORDER_BUBBLE_H, 18);
    view.iconBg.endFill();
    view.iconBg.removeChildren();

    if (fruitId) {
      const tex = TextureCache.get(fruitId);
      if (tex) {
        view.iconSprite.texture = tex;
        view.iconSprite.visible = true;
        view.iconPlaceholder.visible = false;
        const side = ORDER_BUBBLE_ICON_SIDE;
        const tw = tex.width;
        const th = tex.height;
        if (tw > 0 && th > 0) {
          if (tw >= th) {
            view.iconSprite.width = side;
            view.iconSprite.height = (th / tw) * side;
          } else {
            view.iconSprite.height = side;
            view.iconSprite.width = (tw / th) * side;
          }
        }
      } else {
        view.iconSprite.visible = false;
        view.iconPlaceholder.visible = true;
        view.iconPlaceholder.text = '…';
      }
    } else {
      view.iconSprite.visible = false;
      view.iconPlaceholder.visible = true;
      view.iconPlaceholder.text = '—';
    }

    view.countText.text = count;
  }

  private createOrderBubble(x: number, y: number): OrderBubbleView {
    const container = new PIXI.Container();
    container.position.set(x, y);

    const bubble = new PIXI.Graphics();
    bubble.beginFill(0xfffdf7);
    bubble.lineStyle(4, 0x6d4c34, 1);
    bubble.drawRoundedRect(0, 0, ORDER_BUBBLE_W, ORDER_BUBBLE_H, 18);
    bubble.endFill();
    container.addChild(bubble);

    const tail = new PIXI.Graphics();
    tail.beginFill(0xfffdf7);
    tail.lineStyle(4, 0x6d4c34, 1);
    tail.moveTo(42, ORDER_BUBBLE_H);
    tail.lineTo(58, ORDER_BUBBLE_H + 13);
    tail.lineTo(70, ORDER_BUBBLE_H);
    tail.closePath();
    tail.endFill();
    container.addChild(tail);

    const iconSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    iconSprite.anchor.set(0.5);
    iconSprite.position.set(34, ORDER_BUBBLE_H / 2);
    container.addChild(iconSprite);

    const iconPlaceholder = new PIXI.Text('?', {
      fontSize: 18,
      fill: 0x5a3d2b,
      fontWeight: '700',
    });
    iconPlaceholder.anchor.set(0.5);
    iconPlaceholder.position.set(34, ORDER_BUBBLE_H / 2);
    iconPlaceholder.visible = false;
    container.addChild(iconPlaceholder);

    const countText = new PIXI.Text('', {
      fontSize: 28,
      fill: 0x4b2e20,
      fontWeight: '700',
    });
    countText.position.set(66, 14);
    container.addChild(countText);

    return {
      container,
      iconBg: bubble,
      iconSprite,
      iconPlaceholder,
      countText,
    };
  }

  private createPlate(x: number, y: number, radius: number, locked: boolean): void {
    const holder = new PIXI.Container();
    const plateIndex = this.plateVisualHolders.length;
    holder.position.set(x, y);
    holder.visible = false;
    if (locked) {
      holder.eventMode = 'static';
      holder.cursor = 'pointer';
      holder.hitArea = new PIXI.Circle(0, 0, radius);
      holder.on('pointertap', () => {
        if (this.isBowlInteractionBlocked() || !this.plateVisualHolders[plateIndex]?.locked) {
          return;
        }
        AudioManager.playButtonSound();
        void this.runRewardedGameplayAction('unlock_next_order_plate', () => {
          this.unlockNextOrderPlateReward();
        });
      });
    }
    const iconLayer = new PIXI.Container();
    const plate = new PIXI.Graphics();
    plate.lineStyle(6, locked ? 0x4f433b : 0x6a4c34, 0.95);
    plate.beginFill(locked ? 0x504843 : 0xfffaf2);
    plate.drawCircle(0, 0, radius);
    plate.endFill();
    holder.addChild(plate);

    const plateInner = new PIXI.Graphics();
    plateInner.beginFill(locked ? 0x66615a : 0xfffdfa, locked ? 0.35 : 0.95);
    plateInner.drawCircle(0, 0, radius - 11);
    plateInner.endFill();
    holder.addChild(plateInner);
    holder.addChild(iconLayer);
    this.container.addChild(holder);
    this.plateVisualHolders.push({ holder, radius, locked, iconLayer });
  }

  /** 雪碧左列圆盘、右列横槽替换矢量 */
  private mountBoardPlateArt(): void {
    for (const pv of this.plateVisualHolders) {
      this.remountPlateDisc(pv);
    }
    this.mountBufferStripTextures();
  }

  private randomInRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private randomBowlFruitScale(fruitId: FruitId): number {
    const multiplier = BOWL_FRUIT_SIZE_MULTIPLIER[fruitId] ?? 1;
    return this.randomInRange(BOWL_FRUIT_SCALE_MIN, BOWL_FRUIT_SCALE_MAX) * multiplier;
  }

  private shouldSubmergeFruit(fruit: FruitItem): boolean {
    if (fruit.hiddenReserve) {
      return true;
    }
    return Math.sin(Date.now() * FRUIT_BOB_SPEED + fruit.bobSeed) < FRUIT_SURFACE_BOB_THRESHOLD;
  }

  private moveFruitToSoupLayer(fruit: FruitItem, target: PIXI.Container): void {
    if (fruit.parent === target) {
      this.applyFruitSoupVisual(fruit);
      return;
    }
    const parent = fruit.parent;
    if (parent) {
      const world = parent.toGlobal(new PIXI.Point(fruit.x, fruit.y));
      parent.removeChild(fruit);
      fruit.position.copyFrom(target.toLocal(world));
    }
    target.addChild(fruit);
    this.applyFruitSoupVisual(fruit);
  }

  private mountFruitInBowlLayer(fruit: FruitItem, rerollDepth = false): void {
    if (rerollDepth) {
      fruit.bobSeed = Math.random() * Math.PI * 2;
    }
    const target = this.shouldSubmergeFruit(fruit) ? this.submergedFruitLayer : this.surfaceFruitLayer;
    target.addChild(fruit);
    this.applyFruitSoupVisual(fruit);
  }

  private updateShuffleIceDepth(fruit: FruitItem): void {
    const progress = 1 - this.shuffleIceResurfaceSec / SHUFFLE_ICE_RESURFACE_SEC;
    const stagger = ((Math.sin(fruit.bobSeed * 1.37) + 1) / 2) * 0.42;
    const shouldFloat = progress >= SHUFFLE_ICE_HOLD_SUBMERGED_RATIO + stagger;
    this.moveFruitToSoupLayer(fruit, shouldFloat ? this.surfaceFruitLayer : this.submergedFruitLayer);
  }

  private updateFruitSoupDepth(fruit: FruitItem, bob: number): void {
    const target =
      fruit.parent === this.surfaceFruitLayer
        ? bob < FRUIT_SUBMERGE_BOB_THRESHOLD
          ? this.submergedFruitLayer
          : this.surfaceFruitLayer
        : bob > FRUIT_SURFACE_BOB_THRESHOLD
          ? this.surfaceFruitLayer
          : this.submergedFruitLayer;
    if (fruit.parent === target) {
      return;
    }
    const parent = fruit.parent;
    if (!parent) {
      target.addChild(fruit);
      this.applyFruitSoupVisual(fruit);
      return;
    }
    const world = parent.toGlobal(new PIXI.Point(fruit.x, fruit.y));
    parent.removeChild(fruit);
    fruit.position.copyFrom(target.toLocal(world));
    target.addChild(fruit);
    this.applyFruitSoupVisual(fruit);
  }

  private rebalanceSurfaceFruitFill(): void {
    const visibleFruits = this.fruits.filter(
      (fruit) =>
        fruit.phase === 'bowl' &&
        !fruit.picked &&
        !fruit.hiddenReserve &&
        !NON_ORDER_FRUIT_IDS.has(fruit.fruitId),
    );
    if (visibleFruits.length <= 0) {
      return;
    }

    const targetSurfaceCount = Math.min(visibleFruits.length, SURFACE_FILL_TARGET_COUNT);
    const { hx, hy } = this.getFruitSoupHalfExtents();
    const buckets: FruitItem[][] = Array.from(
      { length: SURFACE_FILL_GRID_COLS * SURFACE_FILL_GRID_ROWS },
      () => [],
    );

    const cellIndexFor = (fruit: FruitItem): number => {
      const nx = Math.max(0, Math.min(0.999, (fruit.x - this.bowlCenter.x + hx) / (hx * 2)));
      const ny = Math.max(0, Math.min(0.999, (fruit.y - this.bowlCenter.y + hy) / (hy * 2)));
      const col = Math.floor(nx * SURFACE_FILL_GRID_COLS);
      const row = Math.floor(ny * SURFACE_FILL_GRID_ROWS);
      return row * SURFACE_FILL_GRID_COLS + col;
    };

    for (const fruit of visibleFruits) {
      buckets[cellIndexFor(fruit)]!.push(fruit);
    }

    const selected = new Set<FruitItem>();
    const sortBySurfaceStability = (a: FruitItem, b: FruitItem): number => {
      if (a === this.tutorialTargetFruit) return -1;
      if (b === this.tutorialTargetFruit) return 1;
      const aSurface = a.parent === this.surfaceFruitLayer ? 0 : 1;
      const bSurface = b.parent === this.surfaceFruitLayer ? 0 : 1;
      return aSurface - bSurface || a.y - b.y || a.depthJitter - b.depthJitter;
    };

    // 第一轮：每个有水果的区域至少挑一颗在上层，避免局部空洞下面却有半透明水果。
    for (const bucket of buckets) {
      if (bucket.length <= 0 || selected.size >= targetSurfaceCount) {
        continue;
      }
      bucket.sort(sortBySurfaceStability);
      selected.add(bucket[0]!);
    }

    // 第二轮：剩余上层名额按区域轮询补齐，让密集区域也能有足够的上层水果但不集中爆堆。
    let progressed = true;
    while (selected.size < targetSurfaceCount && progressed) {
      progressed = false;
      for (const bucket of buckets) {
        if (selected.size >= targetSurfaceCount) {
          break;
        }
        const next = bucket.find((fruit) => !selected.has(fruit));
        if (next) {
          selected.add(next);
          progressed = true;
        }
      }
    }

    for (const fruit of visibleFruits) {
      const targetLayer = selected.has(fruit) ? this.surfaceFruitLayer : this.submergedFruitLayer;
      if (fruit.parent !== targetLayer) {
        this.moveFruitToSoupLayer(fruit, targetLayer);
      } else {
        this.applyFruitSoupVisual(fruit);
      }
    }
  }

  private applyFruitSoupVisual(fruit: FruitItem): void {
    const display = fruit.display as PIXI.DisplayObject & { tint?: number };
    if (fruit.hiddenReserve) {
      fruit.alpha = 0.08;
      fruit.setSoupDepthVisual('hidden');
      if (typeof display.tint === 'number') {
        display.tint = this.getSubmergedFruitTint();
      }
      return;
    }
    if (fruit.parent === this.submergedFruitLayer) {
      fruit.alpha = 0.72;
      fruit.setSoupDepthVisual('submerged');
      if (typeof display.tint === 'number') {
        display.tint = this.getSubmergedFruitTint();
      }
      return;
    }
    if (fruit.parent === this.surfaceFruitLayer) {
      fruit.alpha = 1;
      fruit.setSoupDepthVisual('surface');
      if (typeof display.tint === 'number') {
        display.tint = 0xffffff;
      }
      return;
    }
    fruit.alpha = 1;
    fruit.setSoupDepthVisual('standalone');
    if (typeof display.tint === 'number') {
      display.tint = 0xffffff;
    }
  }

  private resetFruitStandaloneVisual(fruit: FruitItem): void {
    const display = fruit.display as PIXI.DisplayObject & { tint?: number };
    fruit.alpha = 1;
    fruit.setSoupDepthVisual('standalone');
    if (typeof display.tint === 'number') {
      display.tint = 0xffffff;
    }
  }

  private countVisibleOrderPieces(fruitId: FruitId): number {
    let count = 0;
    for (const fruit of this.fruits) {
      if (fruit.fruitId === fruitId && fruit.phase === 'bowl' && !fruit.picked && !fruit.hiddenReserve) {
        count += 1;
      }
    }
    for (let i = 0; i < this.bufferSize; i += 1) {
      if (this.bufferSlots[i]?.fruitId === fruitId) {
        count += 1;
      }
    }
    return count;
  }

  private revealHiddenReserveForActiveOrders(): void {
    const needs: Partial<Record<FruitId, number>> = {};
    for (let p = 0; p < this.parallelPlateCount; p += 1) {
      const order = this.parallelOrders[p as PlateIdx];
      if (!order) {
        continue;
      }
      const need = Math.max(0, this.orderSize - order.progress - this.countVisibleOrderPieces(order.fruitId));
      if (need > 0) {
        needs[order.fruitId] = (needs[order.fruitId] ?? 0) + need;
      }
    }

    for (const [fruitId, need] of Object.entries(needs) as Array<[FruitId, number]>) {
      const candidates = this.hiddenReserveFruits.filter((fruit) => fruit.fruitId === fruitId);
      for (const fruit of candidates.slice(0, need)) {
        this.revealHiddenReserveFruit(fruit);
      }
    }
  }

  private revealHiddenReserveBatch(count: number): void {
    if (count <= 0 || this.hiddenReserveFruits.length === 0) {
      return;
    }
    const batch = shuffle(this.hiddenReserveFruits.slice()).slice(0, count);
    batch.forEach((fruit, index) => {
      this.revealHiddenReserveFruit(fruit, index);
    });
  }

  private countVisibleOrderPiecesInBowl(): number {
    let count = 0;
    for (const fruit of this.fruits) {
      if (
        fruit.phase === 'bowl' &&
        !fruit.picked &&
        !fruit.hiddenReserve &&
        !NON_ORDER_FRUIT_IDS.has(fruit.fruitId)
      ) {
        count += 1;
      }
    }
    return count;
  }

  private rebalanceHiddenReserveVisibility(): void {
    if (this.hiddenReserveFruits.length === 0) {
      return;
    }
    const remainingOrderPieces = this.totalRemainingInLevel();
    if (remainingOrderPieces <= 0) {
      return;
    }
    const visibleOrderPieces = this.countVisibleOrderPiecesInBowl();
    const targetVisible = Math.min(
      remainingOrderPieces,
      Math.max(
        HIDDEN_RESERVE_REBALANCE_MIN_VISIBLE,
        Math.ceil(remainingOrderPieces * HIDDEN_RESERVE_REBALANCE_RATIO),
      ),
    );
    const need = Math.min(
      HIDDEN_RESERVE_REBALANCE_MAX_BATCH,
      targetVisible - visibleOrderPieces,
    );
    if (need <= 0) {
      return;
    }
    this.revealHiddenReserveBatch(need);
  }

  private revealHiddenReserveFruit(fruit: FruitItem, scatterIndex = 0): void {
    if (!fruit.hiddenReserve || fruit.phase !== 'bowl') {
      return;
    }
    this.hiddenReserveFruits = this.hiddenReserveFruits.filter((item) => item !== fruit);
    fruit.hiddenReserve = false;
    fruit.eventMode = 'static';
    fruit.cursor = 'pointer';

    const parent = fruit.parent;
    if (parent && parent !== this.surfaceFruitLayer) {
      const world = parent.toGlobal(new PIXI.Point(fruit.x, fruit.y));
      parent.removeChild(fruit);
      fruit.position.copyFrom(this.surfaceFruitLayer.toLocal(world));
      this.surfaceFruitLayer.addChild(fruit);
    } else if (!parent) {
      this.surfaceFruitLayer.addChild(fruit);
    }

    const target = this.randomBowlPoint();
    const fromX = fruit.x;
    const fromY = fruit.y;
    const fromScale = fruit.scale.x;
    const toScale = this.randomBowlFruitScale(fruit.fruitId);
    const duration = 0.42 + (scatterIndex % 3) * 0.05;
    let elapsed = 0;
    this.resetFruitStandaloneVisual(fruit);
    fruit.alpha = 0.08;

    const ticker = () => {
      elapsed += Game.ticker.deltaMS / 1000;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      fruit.x = fromX + (target.x - fromX) * eased;
      fruit.y = fromY + (target.y - fromY) * eased - Math.sin(t * Math.PI) * 16;
      fruit.alpha = 0.08 + 0.92 * eased;
      fruit.scale.set(fromScale + (toScale - fromScale) * eased);
      if (t >= 1) {
        Game.ticker.remove(ticker);
        fruit.velocityX = this.randomInRange(-8, 8);
        fruit.velocityY = this.randomInRange(-5, 5);
        this.mountFruitInBowlLayer(fruit, true);
      }
    };
    Game.ticker.add(ticker);
  }

  private getSubmergedFruitTint(): number {
    switch (this.currentSoupKey) {
      case 'berry_tomato':
        return 0xffd2c2;
      case 'matcha':
        return 0xe7f2c5;
      case 'mango_coconut':
        return 0xffe2ad;
      case 'taro_purple':
        return 0xe4d0ef;
      case 'cocoa':
        return 0xcaa17a;
      case 'milk':
      default:
        return 0xfff2df;
    }
  }

  private liftFruitToFlyingLayer(fruit: FruitItem): void {
    const parent = fruit.parent;
    if (!parent || parent === this.flyingFruitLayer) {
      this.resetFruitStandaloneVisual(fruit);
      this.flyingFruitLayer.addChild(fruit);
      return;
    }
    const world = parent.toGlobal(new PIXI.Point(fruit.x, fruit.y));
    parent.removeChild(fruit);
    const local = this.flyingFruitLayer.toLocal(world);
    fruit.position.copyFrom(local);
    this.resetFruitStandaloneVisual(fruit);
    this.flyingFruitLayer.addChild(fruit);
  }

  private randomBowlPoint(): PIXI.IPointData {
    const { hx, hy } = this.getFruitSoupHalfExtents();
    const rMax = 0.92;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * rMax;
    return {
      x: this.bowlCenter.x + Math.cos(angle) * r * hx,
      y: this.bowlCenter.y + Math.sin(angle) * r * hy,
    };
  }

  private keepFruitInsideBowlEllipse(fruit: FruitItem, hx: number, hy: number): void {
    const dx = fruit.x - this.bowlCenter.x;
    const dy = fruit.y - this.bowlCenter.y;
    const nx = dx / hx;
    const ny = dy / hy;
    const d2 = nx * nx + ny * ny;
    if (d2 <= 1) {
      return;
    }

    const d = Math.sqrt(d2);
    const safe = 0.998 / d;
    fruit.x = this.bowlCenter.x + dx * safe;
    fruit.y = this.bowlCenter.y + dy * safe;

    // 沿椭圆法线反射速度，避免下一帧继续冲出碗口。
    const normalX = dx / (hx * hx);
    const normalY = dy / (hy * hy);
    const nl = Math.hypot(normalX, normalY) || 1;
    const ux = normalX / nl;
    const uy = normalY / nl;
    const dot = fruit.velocityX * ux + fruit.velocityY * uy;
    if (dot > 0) {
      fruit.velocityX -= 2 * dot * ux;
      fruit.velocityY -= 2 * dot * uy;
    }
  }

  /**
   * 水果活动范围：不超出当前汤贴图（soupSprite）显示边缘；无贴图时退回旧椭圆参数。
   */
  private getFruitSoupHalfExtents(): { hx: number; hy: number } {
    if (this.soupSprite.visible && this.soupSprite.width > 16 && this.soupSprite.height > 16) {
      const padX = 72;
      const padY = 66;
      return {
        hx: Math.max(36, this.soupSprite.width / 2 - padX),
        hy: Math.max(32, this.soupSprite.height / 2 - padY),
      };
    }
    return { hx: this.bowlRadiusX - 30, hy: this.bowlRadiusY - 24 };
  }

  /** 汤面遮罩范围：与汤贴图显示尺寸一致，避免靠边水果半截露出。 */
  private getSoupVisualHalfExtents(): { hx: number; hy: number } {
    if (this.soupSprite.visible && this.soupSprite.width > 16 && this.soupSprite.height > 16) {
      return {
        hx: this.soupSprite.width / 2,
        hy: this.soupSprite.height / 2,
      };
    }
    return { hx: this.bowlRadiusX - 4, hy: this.bowlRadiusY - 7 };
  }

  /** 贴图未加载时的矢量圆钮（子节点置于槽位 0,0） */
  private createToolButtonFallback(label: string, color: number): PIXI.Container {
    const container = new PIXI.Container();
    container.eventMode = 'none';

    const outer = new PIXI.Graphics();
    outer.beginFill(0x3f3026);
    outer.drawCircle(0, 0, 48);
    outer.endFill();
    container.addChild(outer);

    const icon = new PIXI.Graphics();
    icon.beginFill(color);
    icon.drawCircle(0, -8, 20);
    icon.endFill();
    container.addChild(icon);

    const text = new PIXI.Text(label, {
      fontSize: 22,
      fill: 0xf6ead0,
      fontWeight: '700',
    });
    text.anchor.set(0.5);
    text.position.set(0, 30);
    container.addChild(text);

    const legacyTarget = 100;
    container.scale.set(toolButtonDisplayTarget() / legacyTarget);
    return container;
  }

  private createToolInventoryBadge(): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'none';
    root.position.set(38, -48);
    const bg = new PIXI.Graphics();
    bg.beginFill(0xff4f43, 1);
    bg.lineStyle(3, 0xffffff, 1);
    bg.drawCircle(0, 0, 19);
    bg.endFill();
    const text = new PIXI.Text('', {
      fontSize: 18,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x8b241e,
      strokeThickness: 3,
    });
    text.anchor.set(0.5);
    root.addChild(bg, text);
    return root;
  }

  private refreshToolInventoryBadges(): void {
    for (let i = 0; i < this.toolInventoryBadges.length; i += 1) {
      const kind = toolKindForIndex(i);
      const count = getToolCount(kind);
      const badge = this.toolInventoryBadges[i]!;
      const text = this.toolInventoryBadgeTexts[i]!;
      badge.visible = count > 0;
      text.text = count > 9 ? '9+' : String(count);
    }
  }

  private createCenterText(text: string, fontSize: number, fill: number): PIXI.Text {
    const node = new PIXI.Text(text, {
      fontSize,
      fill,
      fontWeight: '700',
    });
    node.anchor.set(0.5);
    return node;
  }

  /**
   * 解锁按钮左侧小三角。勿用 Unicode「▶」(U+25B6)：真机系统字体会把它画成彩色 emoji，
   * 与模拟器上的几何字形不一致。
   */
  private createLockPlayTriangle(fill: number): PIXI.Graphics {
    const g = new PIXI.Graphics();
    const halfH = 8;
    const halfW = 6;
    const tipX = 10;
    g.beginFill(fill);
    g.drawPolygon(-halfW, -halfH, tipX, 0, -halfW, halfH);
    g.endFill();
    const cx = (tipX - 2 * halfW) / 3;
    g.pivot.set(cx, 0);
    return g;
  }

  // ===========================================================================
  // 暂存盘紧迫态（Buffer Panic）
  // ===========================================================================

  /**
   * 检查并切换 panic 态。占位 === bufferSize 即触发；任意一格变空即退出。
   * 教学引导期间一律不触发，避免抢戏；本关 bufferSize <= 0 也跳过。
   */
  private evaluateBufferPanicState(): void {
    if (this.tutorialActive || this.bufferSize <= 0) {
      if (this.bufferPanicActive) {
        this.exitBufferPanic();
      }
      return;
    }
    let occupied = 0;
    for (let i = 0; i < this.bufferSize; i += 1) {
      if (this.bufferSlots[i] || this.pendingBufferSlotIndexes.has(i)) {
        occupied += 1;
      }
    }
    const isFull = occupied >= this.bufferSize;
    if (isFull && !this.bufferPanicActive) {
      this.enterBufferPanic();
    } else if (!isFull && this.bufferPanicActive) {
      this.exitBufferPanic();
    }
  }

  private enterBufferPanic(): void {
    if (this.bufferPanicActive) {
      return;
    }
    this.bufferPanicActive = true;
    this.bufferPanicElapsedSec = 0;
    this.bufferPanicNextSfxAt = 0;
    this.bufferPanicSfxCount = 0;

    this.rebuildBufferPanicSlotRings();
    this.mountToolPanicHints();

    this.bufferPanicFxLayer.visible = true;
  }

  private exitBufferPanic(): void {
    if (!this.bufferPanicActive && this.bufferPanicSlotRings.length === 0 && !this.toolPanicHints.some((h) => h !== null)) {
      this.bufferPanicFxLayer.visible = false;
      return;
    }
    this.bufferPanicActive = false;
    this.bufferPanicElapsedSec = 0;
    this.bufferPanicNextSfxAt = 0;
    this.bufferPanicSfxCount = 0;

    for (const ring of this.bufferPanicSlotRings) {
      if (ring.plateSprite) {
        ring.plateSprite.scale.set(ring.baseScaleX, ring.baseScaleY);
      }
      if (ring.fruitAnchor) {
        ring.fruitAnchor.scale.set(ring.anchorBaseScaleX, ring.anchorBaseScaleY);
      }
      ring.root.removeFromParent();
      ring.root.destroy({ children: true });
    }
    this.bufferPanicSlotRings.length = 0;

    this.unmountToolPanicHints();

    this.bufferPanicFxLayer.visible = false;
  }

  /** 按当前 buffer 布局为每个菜碟复制一层红色贴图轮廓，红边严格跟随盘子 alpha 形状。 */
  private rebuildBufferPanicSlotRings(): void {
    for (const ring of this.bufferPanicSlotRings) {
      if (ring.plateSprite) {
        ring.plateSprite.scale.set(ring.baseScaleX, ring.baseScaleY);
      }
      if (ring.fruitAnchor) {
        ring.fruitAnchor.scale.set(ring.anchorBaseScaleX, ring.anchorBaseScaleY);
      }
      ring.root.removeFromParent();
      ring.root.destroy({ children: true });
    }
    this.bufferPanicSlotRings.length = 0;
    if (this.bufferSize <= 0) {
      return;
    }
    const lay = computeBufferStripLayout(this.bufferSize, Game.logicWidth);
    for (let i = 0; i < this.bufferSize; i += 1) {
      const holder = this.slotStripHolders[i];
      if (!holder || !holder.visible) {
        continue;
      }
      const plateSprite = holder.children.find((child): child is PIXI.Sprite => child instanceof PIXI.Sprite) ?? null;
      if (!plateSprite) {
        continue;
      }
      const root = new PIXI.Container();
      root.position.set(lay.slotW / 2, lay.slotH / 2);
      root.eventMode = 'none';

      const glow = new PIXI.Sprite(plateSprite.texture);
      glow.anchor.set(0.5);
      glow.width = lay.slotW * 1.12;
      glow.height = lay.slotH * 1.12;
      glow.tint = 0xff3a26;
      glow.alpha = 0.42;
      glow.eventMode = 'none';

      const edge = new PIXI.Sprite(plateSprite.texture);
      edge.anchor.set(0.5);
      edge.width = lay.slotW * 1.055;
      edge.height = lay.slotH * 1.055;
      edge.tint = 0xff210c;
      edge.alpha = 0.9;
      edge.eventMode = 'none';

      root.addChild(glow, edge);
      this.bufferPanicSlotRings.push({
        root,
        glow,
        edge,
        plateSprite,
        fruitAnchor: this.bufferSlotAnchors[i] ?? null,
        baseScaleX: plateSprite?.scale.x ?? 1,
        baseScaleY: plateSprite?.scale.y ?? 1,
        anchorBaseScaleX: this.bufferSlotAnchors[i]?.scale.x ?? 1,
        anchorBaseScaleY: this.bufferSlotAnchors[i]?.scale.y ?? 1,
      });
      const plateIndex = holder.getChildIndex(plateSprite);
      holder.addChildAt(root, Math.max(0, plateIndex));
    }
  }

  /** 在底部加菜碟 / 移除按钮上挂"用我救场"高亮气泡，遵循本关 allowAddDish/allowRemove */
  private mountToolPanicHints(): void {
    const labels: Record<number, string> = { 0: '加菜碟！', 1: '点这里救场！' };
    const allows: Record<number, boolean> = {
      0: !!this.levelDef?.allowAddDish && this.bufferSize < BUFFER_SLOTS_MAX,
      1: !!this.levelDef?.allowRemove,
    };
    for (const idx of [0, 1] as const) {
      if (!allows[idx]) {
        continue;
      }
      const slot = this.toolSlots[idx];
      if (!slot || !slot.visible) {
        continue;
      }
      const haloRadius = toolButtonDisplayTarget() * 0.56;
      const halo = new PIXI.Graphics();
      halo.beginFill(0xfff1a0, 0.55);
      halo.drawCircle(0, 0, haloRadius);
      halo.endFill();
      halo.lineStyle(3, 0xff8c1a, 0.85);
      halo.drawCircle(0, 0, haloRadius);
      halo.eventMode = 'none';
      slot.addChildAt(halo, 0);

      const bubble = new PIXI.Container();
      const text = new PIXI.Text(labels[idx]!, {
        fontSize: 20,
        fill: 0xa64a17,
        fontWeight: '900',
        stroke: 0xfff7d6,
        strokeThickness: 3,
      });
      text.anchor.set(0.5);
      const padX = 14;
      const padY = 8;
      const bgW = Math.ceil(text.width) + padX * 2;
      const bgH = Math.ceil(text.height) + padY * 2;
      const bg = new PIXI.Graphics();
      bg.lineStyle(2, 0xb55b1e, 1);
      bg.beginFill(0xfff1c7, 1);
      bg.drawRoundedRect(-bgW / 2, -bgH / 2, bgW, bgH, 14);
      bg.endFill();
      bg.beginFill(0xfff1c7, 1);
      bg.lineStyle(2, 0xb55b1e, 1);
      bg.moveTo(-9, bgH / 2);
      bg.lineTo(9, bgH / 2);
      bg.lineTo(0, bgH / 2 + 10);
      bg.lineTo(-9, bgH / 2);
      bg.endFill();
      bubble.addChild(bg, text);
      const bubbleBaseY = -toolButtonDisplayTarget() * 0.52 - bgH / 2 - 4;
      bubble.position.set(0, bubbleBaseY);
      bubble.eventMode = 'none';
      slot.addChild(bubble);

      this.toolPanicHints[idx] = {
        halo,
        bubble,
        bubbleBaseY,
        slotBaseScale: slot.scale.x,
      };
    }
  }

  private unmountToolPanicHints(): void {
    for (let i = 0; i < this.toolPanicHints.length; i += 1) {
      const hint = this.toolPanicHints[i];
      if (!hint) {
        continue;
      }
      const slot = this.toolSlots[i];
      if (slot) {
        slot.scale.set(hint.slotBaseScale);
      }
      hint.halo.removeFromParent();
      hint.halo.destroy();
      hint.bubble.removeFromParent();
      hint.bubble.destroy({ children: true });
      this.toolPanicHints[i] = null;
    }
  }

  /** 由 update(dt) 每帧驱动：菜碟贴图和红色盘形描边一起呼吸 + 工具钮提示 + 警告音 */
  private updateBufferPanicFrame(dt: number): void {
    if (!this.bufferPanicActive) {
      return;
    }
    this.bufferPanicElapsedSec += dt;

    const period = 1.15;
    const breath = Math.sin((this.bufferPanicElapsedSec * Math.PI * 2) / period) * 0.5 + 0.5;
    const scale = 0.965 + breath * 0.07;

    for (const {
      root,
      glow,
      edge,
      plateSprite,
      fruitAnchor,
      baseScaleX,
      baseScaleY,
      anchorBaseScaleX,
      anchorBaseScaleY,
    } of this.bufferPanicSlotRings) {
      root.scale.set(scale);
      if (plateSprite) {
        plateSprite.scale.set(baseScaleX * scale, baseScaleY * scale);
      }
      if (fruitAnchor) {
        fruitAnchor.scale.set(anchorBaseScaleX * scale, anchorBaseScaleY * scale);
      }
      edge.alpha = 0.68 + breath * 0.32;
      glow.alpha = 0.42 + breath * 0.38;
    }

    const heartbeat = breath;
    for (let i = 0; i < this.toolPanicHints.length; i += 1) {
      const hint = this.toolPanicHints[i];
      if (!hint) {
        continue;
      }
      const slot = this.toolSlots[i];
      if (slot) {
        slot.scale.set(hint.slotBaseScale * (1 + heartbeat * 0.06));
      }
      hint.halo.scale.set(1 + heartbeat * 0.18);
      hint.halo.alpha = 0.32 + heartbeat * 0.5;
      hint.bubble.position.y = hint.bubbleBaseY + Math.sin((this.bufferPanicElapsedSec * Math.PI * 2) / period) * 3;
      hint.bubble.alpha = 0.85 + heartbeat * 0.15;
    }

    if (this.bufferPanicSfxCount < 3 && this.bufferPanicElapsedSec >= this.bufferPanicNextSfxAt) {
      AudioManager.playBufferPanicSound();
      this.bufferPanicSfxCount += 1;
      this.bufferPanicNextSfxAt = this.bufferPanicElapsedSec + 0.72;
    }
  }
}
