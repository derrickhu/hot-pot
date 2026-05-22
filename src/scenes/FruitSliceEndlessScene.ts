import * as PIXI from 'pixi.js';
import {
  FRUIT_SLICE_BASE_SCORE,
  FRUIT_SLICE_COMBO_BONUS_MAX,
  FRUIT_SLICE_COMBO_BONUS_STEP,
  FRUIT_SLICE_COMBO_WINDOW_MS,
  FRUIT_SLICE_MILESTONES,
  FRUIT_SLICE_PHYSICS,
  FRUIT_SLICE_STAGES,
  FRUIT_SLICE_UNLOCKED_BONUS,
  getFruitSliceActiveFruitIds,
  getFruitSliceStageBonus,
  getFruitSliceStageIndex,
} from '@/config/fruitSliceEndless';
import { FRUIT_SLICE_COIN_TIERS, fruitSliceCoinsForScore, nextFruitSliceCoinTier } from '@/config/economy';
import { getUnlockedFruitIds } from '@/config/fruitCatalog';
import { FRUIT_CONFIGS, FRUIT_MAP, type FruitConfig, type FruitId } from '@/config/fruits';
import { fruitSliceWholeTextureKey, FRUIT_SLICE_IDS, FRUIT_SLICE_WHOLE_PATH } from '@/config/fruitSliceWhole';
import { analytics } from '@/analytics';
import { BOWL_IMAGES_ROOT } from '@/config/bowlAssets';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import { Haptics } from '@/core/Haptics';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { BowlTutorialOverlay } from '@/gameobjects/BowlTutorialOverlay';
import { settleFruitSliceCoinReward, type FruitSliceCoinRewardResult } from '@/game/FruitSliceCoinRewards';
import { getFruitSliceBestScore, recordFruitSliceRun } from '@/game/FruitSliceProgress';
import { consumeFruitSliceTool, getFruitSliceToolCount } from '@/game/FruitSliceToolInventory';
import { submitFruitBestRankIfNeeded } from '@/game/RankUpload';
import {
  CoinBar,
  COIN_ICON_TEXTURE_KEY,
  COIN_ICON_TEXTURE_PATH,
  createCoinIcon,
} from '@/gameobjects/CoinBar';
import {
  BOWL_COMMON_MODAL_BUTTON_ASSET,
  BOWL_COMMON_MODAL_BUTTON_TEXTURE_KEY,
} from '@/gameobjects/BowlMechanicIntroOverlay';
import { openLeaderboard } from '@/scenes/LeaderboardScene';
import { RANK_BOARD_FRUIT } from '@/services/RankService';
import { loadBowlSubpackage } from '@/utils/loadBowlSubpackage';
import { TextureCache } from '@/utils/TextureCache';
import { FRUIT_SLICE_REWARDED_AD_UNIT_ID, showRewardedAd, warmupRewardedAd } from '@/utils/rewardedAd';
import { isFruitSliceTutorialDone, markFruitSliceTutorialDone } from '@/utils/tutorialState';
import { shareGame } from '@/utils/wechatShare';
import { sampleEdgeAt, sampleTextureTopEdge, type TextureTopEdge } from '@/utils/textureTopEdge';

type FruitPhysicsState = 'fixed' | 'falling' | 'settled' | 'enteringPipe' | 'pipe';
type FruitSliceToolKind = 'eliminate' | 'shuffle';
type FruitSliceStartChoiceSource = 'entry' | 'retry' | 'checkpoint';
type FruitSliceFailReason = 'pipe_overflow' | 'grid_overflow' | 'pipe_capacity' | 'abandon_revive';
type FruitSliceTutorialStep = 'idle' | 'first' | 'second' | 'waitingMatch' | 'score' | 'done';

type GoalCelebrationJob =
  | { kind: 'milestone'; points: number }
  | { kind: 'newFruits'; stageLabel: string; fruitIds: FruitId[] };

type FruitSliceNode = PIXI.Container & {
  fruitId: FruitId;
  radius: number;
  vx: number;
  vy: number;
  state: FruitPhysicsState;
  stableFrames: number;
  releaseX?: number;
  releaseY?: number;
  __pipeSlot?: { x: number; y: number; rotation: number };
  __slideTo?: number;
};

interface PipeEntry {
  node: FruitSliceNode;
  fruitId: FruitId;
}

interface BoardGeometry {
  leftOuterX: number;
  leftInnerX: number;
  rightInnerX: number;
  rightOuterX: number;
  baseY: number;
  boardW: number;
  boardH: number;
  surfaceOuterY: number;
  surfaceInnerY: number;
}

const FRUIT_SLICE_ID_SET = new Set<FruitId>(FRUIT_SLICE_IDS);
const WALL_PADDING = 8;
const BOARD_ROLL_ACCEL = 920;
const BOARD_ROLL_MAX_SPEED = 720;
const WARNING_OVERFLOW_GRACE_SECONDS = 0.75;
const WARNING_OVERFLOW_TOLERANCE = 18;
const GRID_OVERFLOW_LINE_OFFSET = 132;
const GRID_OVERFLOW_TOLERANCE = 44;
const WARNING_SFX_MAX_COUNT = 3;
const WARNING_SFX_INTERVAL_SECONDS = 0.85;
const FRUIT_SUPPORT_MAX_CENTER_OFFSET = 0.46;
const FRUIT_SUPPORT_MIN_NORMAL_Y = 0.72;
const REFILL_MIN_ACTIVE_FRUITS = 18;
/** 游戏内横幅提示停留时间；不暂停玩法。 */
const GOAL_MILESTONE_AUTO_SECONDS = 1.8;
const GOAL_NEW_FRUIT_AUTO_SECONDS = 2.4;
const REVIVE_PANEL_HIT_LAYOUT = {
  revive: { xRatio: 0.5, yRatio: 0.665, wRatio: 0.74, hRatio: 0.14 },
  abandon: { xRatio: 0.5, yRatio: 0.87, wRatio: 0.46, hRatio: 0.12 },
};
const FRUIT_SLICE_VISUAL_SCALE: Partial<Record<FruitId, number>> = {
  pineapple: 1.08,
  starfruit: 1.12,
};
const FRUIT_SLICE_UI_DIR = 'subpackages/bowl_game/assets/images/fruit_slice';
const UI_PANEL_FREE_BTN_TEXTURE = `${BOWL_IMAGES_ROOT}/ui_panel_free_btn.png`;
const FRUIT_SLICE_TOOL_ROUND_LIMIT = 2;
const FRUIT_SLICE_UI_ASSETS = {
  bg: `${FRUIT_SLICE_UI_DIR}/bg.png`,
  scorePanel: `${FRUIT_SLICE_UI_DIR}/score_panel.png`,
  toolButtons: `${FRUIT_SLICE_UI_DIR}/tool_buttons.png`,
  slantedBoardLeft: `${FRUIT_SLICE_UI_DIR}/slanted_board_left.png`,
  slantedBoardRight: `${FRUIT_SLICE_UI_DIR}/slanted_board_right.png`,
  horizontalKnife: `${FRUIT_SLICE_UI_DIR}/horizontal_knife.png`,
  pipeWoodBlock: `${FRUIT_SLICE_UI_DIR}/pipe_wood_block.png`,
  titleLogo: `${FRUIT_SLICE_UI_DIR}/title_logo.png`,
  backButton: `${FRUIT_SLICE_UI_DIR}/back_button.png`,
  genericPanel: `${FRUIT_SLICE_UI_DIR}/generic_panel.png`,
  failPanel: `${FRUIT_SLICE_UI_DIR}/fail_panel.png`,
  newRecordPanel: `${FRUIT_SLICE_UI_DIR}/new_record_panel.png`,
  revivePanel: `${FRUIT_SLICE_UI_DIR}/revive_panel.png`,
  tutorialHand: `${BOWL_IMAGES_ROOT}/tutorial_hand.png`,
} as const;

/** 案板底边相对原管道锚点的下移量（仅视觉）。 */
const SLANTED_BOARD_BASE_Y_OFFSET = 52;
/** 在上一基础上再整体下移（逻辑像素，与 Game.logicHeight 同坐标系）。 */
const SLANTED_BOARD_DROP_EXTRA = 300;
/**
 * 内侧缝半宽 = 虚拟管道半宽 × 该系数；小于 1 时左右案板更靠拢，接近 1 则中间更宽。
 */
const SLANTED_BOARD_SEAM_HALF_MULT = 1.05;
const BOARD_SURFACE_OUTER_Y_FR = 1.0;
const BOARD_SURFACE_INNER_Y_FR = 0.76;
/** 按钮高度占案板显示高度的比例（再大会挤出屏幕）。 */
const TOOL_ON_BOARD_H_FR = 0.13;
/** 竖直：从案板底边向上的比例，越大越靠近木板上段（与红框示意一致）。 */
const TOOL_ON_BOARD_INSET_Y_FR = 0.56;
/** 横向：0.5 为左右板水平可用区中点；略偏向外侧让按钮更落在木板主体上。 */
const TOOL_ON_BOARD_X_BIAS_FR = 0.38;

/** 无尽果切：固定散点水果 + 轻量重力碰撞 + 管道配对消除。 */
export class FruitSliceEndlessScene implements Scene {
  readonly name = 'fruitSlice';
  readonly container = new PIXI.Container();

  private loaded = false;
  private loadingPromise: Promise<void> | null = null;
  private readonly fruitLayer = new PIXI.Container();
  private readonly pipeStackLayer = new PIXI.Container();
  private readonly effectLayer = new PIXI.Container();
  private readonly textEffectLayer = new PIXI.Container();
  private readonly toolHelpOverlay = new PIXI.Container();
  private readonly toolHelpPanelRoot = new PIXI.Container();
  private readonly toolHelpPanelSprite = new PIXI.Sprite();
  private readonly toolHelpTitle = new PIXI.Text('', {
    fontSize: 34,
    fill: 0x7a3d16,
    fontWeight: '900',
    stroke: 0xfff3d2,
    strokeThickness: 4,
    lineJoin: 'round',
  });
  private readonly toolHelpDesc = new PIXI.Text('', {
    fontSize: 24,
    fill: 0x4b2e20,
    fontWeight: '800',
    align: 'center',
    lineHeight: 34,
    wordWrap: true,
    wordWrapWidth: 320,
  });
  private readonly toolHelpFreeBtn = new PIXI.Sprite();
  private readonly toolHelpActionText = new PIXI.Text('', {
    fontSize: 24,
    fill: 0xffffff,
    fontWeight: '900',
    stroke: 0x7a3d16,
    strokeThickness: 4,
    lineJoin: 'round',
  });
  private readonly toolHelpUsageText = new PIXI.Text('', {
    fontSize: 22,
    fill: 0x7a3d16,
    fontWeight: '900',
    stroke: 0xfff1d0,
    strokeThickness: 3,
    lineJoin: 'round',
  });
  private readonly overlayLayer = new PIXI.Container();
  private readonly goalCelebrateOverlay = new PIXI.Container();
  private readonly goalCelebrateDim = new PIXI.Graphics();
  private readonly goalCelebrateContent = new PIXI.Container();
  private goalCelebrationQueue: GoalCelebrationJob[] = [];
  private goalCelebrateBanner: PIXI.Container | null = null;
  private goalCelebrateAutoTimer: ReturnType<typeof setTimeout> | null = null;
  private goalCelebrateIntroTicker: (() => void) | null = null;
  private readonly bgSprite = new PIXI.Sprite();
  private readonly boardLeftSprite = new PIXI.Sprite();
  private readonly boardRightSprite = new PIXI.Sprite();
  private readonly titleLogoSprite = new PIXI.Sprite();
  private readonly backButtonSprite = new PIXI.Sprite();
  private readonly pipeKnifeSprite = new PIXI.Sprite();
  private readonly pipeWoodBlockSprite = new PIXI.Sprite();
  private readonly pipeWoodBlockSprite2 = new PIXI.Sprite();
  private readonly pipeBlockShade = new PIXI.Graphics();
  private readonly pipeBlockLabel = new PIXI.Text('解锁', {
    fontSize: 22,
    fill: 0xfff4b0,
    fontWeight: '900',
    stroke: 0x7a2d08,
    strokeThickness: 5,
    lineJoin: 'round',
  });
  private readonly toolElimSprite = new PIXI.Sprite();
  private readonly toolShuffleSprite = new PIXI.Sprite();
  private readonly fruitToolInventoryBadges: PIXI.Container[] = [];
  private readonly fruitToolInventoryBadgeTexts: PIXI.Text[] = [];
  private readonly scorePanelSprites: PIXI.Sprite[] = [];
  private readonly coinBar = new CoinBar();
  private readonly fruits: FruitSliceNode[] = [];
  private readonly pipeStack: PipeEntry[] = [];
  private pendingPipeSlots = 0;
  private scoreLabel!: PIXI.Text;
  private displayedScore = 0;
  private scoreLabelPulseT = 0;
  private scoreLabelPulseDur = 0;
  private bestLabel!: PIXI.Text;
  private stageLabel!: PIXI.Text;
  private endOverlay: PIXI.Container | null = null;
  private score = 0;
  private bestScore = 0;
  private combo = 0;
  private lastComboAt = 0;
  private nextMilestoneIndex = 0;
  private currentStageIndex = 0;
  private gameOver = false;
  private reviveUsed = false;
  private reviveAdBusy = false;
  private resumeStartAdBusy = false;
  private pipeBlockRemoved = false;
  private pipeBlockAdBusy = false;
  private pendingToolKind: FruitSliceToolKind | null = null;
  private toolRewardedAdBusy = false;
  private fruitToolUsesThisRound: Record<FruitSliceToolKind, number> = { eliminate: 0, shuffle: 0 };
  private roundStartTs = 0;
  private roundStartSource: FruitSliceStartChoiceSource = 'entry';
  private roundInitialScore = 0;
  private maxComboThisRound = 0;
  private matchCountThisRound = 0;
  private maxMilestoneThisRound = 0;
  private lastCoinReward: FruitSliceCoinRewardResult | null = null;
  private fruitTopY = 0;
  private fruitBottomY = 0;
  private initialFruitTopY = 0;
  private initialFruitBottomY = 0;
  private cliffTopY = 0;
  private cliffBottomY = 0;
  private boardGeometry: BoardGeometry | null = null;
  private boardLeftEdge: TextureTopEdge | null = null;
  private boardRightEdge: TextureTopEdge | null = null;
  private readonly warningLine = new PIXI.Graphics();
  private readonly gridWarningLine = new PIXI.Graphics();
  private warningPulseT = 0;
  private warningOverflowT = 0;
  private gridWarningPulseT = 0;
  private gridWarningOverflowT = 0;
  private gridWarningArmed = false;
  private warningSfxCount = 0;
  private warningSfxCooldown = 0;
  private warningSfxActive = false;
  private readonly fruitRadiusById = new Map<FruitId, number>();
  private readonly tutorialGuideOverlay = new BowlTutorialOverlay(Game.logicWidth, Game.logicHeight);
  private tutorialStep: FruitSliceTutorialStep = 'idle';
  private tutorialTargets: FruitSliceNode[] = [];
  private tutorialTarget: FruitSliceNode | null = null;
  private readonly tutorialTimers: ReturnType<typeof setTimeout>[] = [];
  // 飞行 / 特效 / 计分等所有挂在 Game.ticker 上的短时回调统一登记，
  // 便于 onExit / clearRound 一次摘除，避免离场后回调还在改已销毁节点。
  private readonly transientTickers = new Set<(delta: number) => void>();
  // 短时延迟（金币结算等 setTimeout）也集中追踪，避免切场景后还在调用旧场景方法。
  private readonly transientTimers = new Set<ReturnType<typeof setTimeout>>();
  // 复用同一个分数脉冲 ticker，避免连消时 N 个 ticker 同时改 lbl.scale。
  private scorePulseTicker: ((delta: number) => void) | null = null;
  // 复用 update / collision 用的临时数组，避免每帧 allocate FruitSliceNode[]。
  private readonly updateScratch: FruitSliceNode[] = [];

  constructor() {
    this.build();
  }

  async prepare(): Promise<void> {
    await this.preloadAssets();
  }

  onEnter(): void {
    AudioManager.useFruitSliceBackgroundMusic();
    warmupRewardedAd(FRUIT_SLICE_REWARDED_AD_UNIT_ID);
    void this.preloadAssets().then(() => {
      this.refreshFruitToolInventoryBadges();
      if (this.gameOver || (this.fruits.length === 0 && this.pipeStack.length === 0)) {
        this.showStartChoiceOrStartRound('entry');
      } else {
        this.startTutorialIfNeeded();
      }
    });
  }

  onExit(): void {
    AudioManager.useDefaultBackgroundMusic();
    this.hideEndOverlay();
    this.hideToolHelpPanel();
    this.dismissGoalCelebration(true);
    this.hideTutorialOverlay();
    // 退出时统一摘除所有飞行/特效 ticker、停掉延迟回调，
    // 防止 280ms 金币结算 / 切片爆炸 / pulse 等在新场景里继续乱改 UI。
    this.stopAllTransientTickers();
    this.clearAllTransientTimers();
  }

  private addTransientTicker(tick: (delta: number) => void): void {
    this.transientTickers.add(tick);
    Game.ticker.add(tick);
  }

  private removeTransientTicker(tick: (delta: number) => void): void {
    Game.ticker.remove(tick);
    this.transientTickers.delete(tick);
  }

  private stopAllTransientTickers(): void {
    for (const tick of this.transientTickers) {
      Game.ticker.remove(tick);
    }
    this.transientTickers.clear();
    this.scorePulseTicker = null;
  }

  private trackTimer(timer: ReturnType<typeof setTimeout>): ReturnType<typeof setTimeout> {
    this.transientTimers.add(timer);
    return timer;
  }

  private finishTimer(timer: ReturnType<typeof setTimeout>): void {
    this.transientTimers.delete(timer);
  }

  private clearAllTransientTimers(): void {
    for (const timer of this.transientTimers) {
      clearTimeout(timer);
    }
    this.transientTimers.clear();
  }

  update(dt: number): void {
    if (!this.loaded || this.gameOver || this.toolHelpOverlay.visible) {
      return;
    }
    this.tutorialGuideOverlay.update(dt);
    const clampedDt = Math.min(dt, 1 / 30);
    let changed = false;
    // 复用 scratch 数组装当前帧快照，避免每帧 spread 出新数组（连续 60fps 下显著降低 GC）。
    const snapshot = this.updateScratch;
    snapshot.length = 0;
    for (let i = 0; i < this.fruits.length; i += 1) {
      snapshot.push(this.fruits[i]!);
    }
    for (let i = 0; i < snapshot.length; i += 1) {
      const node = snapshot[i]!;
      if (node.state === 'falling') {
        this.updateFallingFruit(node, clampedDt);
        changed = true;
      } else if ((node.state === 'fixed' || node.state === 'settled') && node.__slideTo !== undefined) {
        this.updateSlidingFruit(node, clampedDt);
        changed = true;
      }
    }
    snapshot.length = 0;
    if (changed) {
      this.refreshFruitDepth();
    }
    this.updateWarningLine(clampedDt);
  }

  private async preloadAssets(): Promise<void> {
    if (this.loaded) {
      return;
    }
    if (this.loadingPromise) {
      await this.loadingPromise;
      return;
    }
    this.loadingPromise = this.doPreloadAssets();
    await this.loadingPromise;
  }

  private async doPreloadAssets(): Promise<void> {
    try {
      await loadBowlSubpackage();
      const sliceIds = FRUIT_CONFIGS.filter((fruit) => FRUIT_SLICE_ID_SET.has(fruit.id));
      await Promise.all([
        TextureCache.load('fruit_slice_ui_bg', FRUIT_SLICE_UI_ASSETS.bg),
        TextureCache.load('fruit_slice_ui_score_panel', FRUIT_SLICE_UI_ASSETS.scorePanel),
        TextureCache.load('fruit_slice_ui_tool_buttons', FRUIT_SLICE_UI_ASSETS.toolButtons),
        TextureCache.load('fruit_slice_ui_slanted_board_left', FRUIT_SLICE_UI_ASSETS.slantedBoardLeft),
        TextureCache.load('fruit_slice_ui_slanted_board_right', FRUIT_SLICE_UI_ASSETS.slantedBoardRight),
        TextureCache.load('fruit_slice_ui_horizontal_knife', FRUIT_SLICE_UI_ASSETS.horizontalKnife),
        TextureCache.load('fruit_slice_ui_pipe_wood_block', FRUIT_SLICE_UI_ASSETS.pipeWoodBlock),
        TextureCache.load('fruit_slice_ui_title_logo', FRUIT_SLICE_UI_ASSETS.titleLogo),
        TextureCache.load('fruit_slice_ui_back_button', FRUIT_SLICE_UI_ASSETS.backButton),
        TextureCache.load('fruit_slice_ui_generic_panel', FRUIT_SLICE_UI_ASSETS.genericPanel),
        TextureCache.load('fruit_slice_ui_fail_panel', FRUIT_SLICE_UI_ASSETS.failPanel),
        TextureCache.load('fruit_slice_ui_new_record_panel', FRUIT_SLICE_UI_ASSETS.newRecordPanel),
        TextureCache.load('fruit_slice_ui_revive_panel', FRUIT_SLICE_UI_ASSETS.revivePanel),
        TextureCache.load('fruit_slice_ui_tutorial_hand', FRUIT_SLICE_UI_ASSETS.tutorialHand),
        TextureCache.load('ui_panel_free_btn', UI_PANEL_FREE_BTN_TEXTURE),
        TextureCache.load(BOWL_COMMON_MODAL_BUTTON_TEXTURE_KEY, BOWL_COMMON_MODAL_BUTTON_ASSET),
        TextureCache.load(COIN_ICON_TEXTURE_KEY, COIN_ICON_TEXTURE_PATH),
        ...FRUIT_SLICE_IDS.map((id) =>
          TextureCache.load(fruitSliceWholeTextureKey(id), FRUIT_SLICE_WHOLE_PATH[id]),
        ),
        ...sliceIds.flatMap((fruit) => [
          TextureCache.load(fruit.id, fruit.asset),
          TextureCache.load(`${fruit.id}__b2`, fruit.bowlAsset2),
        ]),
      ]);
    } catch (error) {
      console.warn('[FruitSliceEndlessScene] preload failed', error);
    } finally {
      this.loaded = true;
      this.applyUiTextures();
    }
  }

  private applyUiTextures(): void {
    const bg = TextureCache.get('fruit_slice_ui_bg');
    if (bg) {
      this.bgSprite.texture = bg;
    }
    const boardLeft = TextureCache.get('fruit_slice_ui_slanted_board_left');
    if (boardLeft) {
      this.boardLeftSprite.texture = boardLeft;
      this.boardLeftEdge = sampleTextureTopEdge(boardLeft);
    }
    const boardRight = TextureCache.get('fruit_slice_ui_slanted_board_right');
    if (boardRight) {
      this.boardRightSprite.texture = boardRight;
      this.boardRightEdge = sampleTextureTopEdge(boardRight);
    }
    const toolSheet = TextureCache.get('fruit_slice_ui_tool_buttons');
    if (toolSheet && toolSheet.width > 4) {
      const tw = toolSheet.width;
      const th = toolSheet.height;
      const half = Math.floor(tw / 2);
      this.toolElimSprite.texture = new PIXI.Texture(
        toolSheet.baseTexture,
        new PIXI.Rectangle(0, 0, half, th),
      );
      this.toolShuffleSprite.texture = new PIXI.Texture(
        toolSheet.baseTexture,
        new PIXI.Rectangle(half, 0, tw - half, th),
      );
    }
    const scorePanel = TextureCache.get('fruit_slice_ui_score_panel');
    if (scorePanel) {
      for (const sprite of this.scorePanelSprites) {
        sprite.texture = scorePanel;
      }
    }
    const knife = TextureCache.get('fruit_slice_ui_horizontal_knife');
    if (knife) {
      this.pipeKnifeSprite.texture = knife;
    }
    const woodBlock = TextureCache.get('fruit_slice_ui_pipe_wood_block');
    if (woodBlock) {
      this.pipeWoodBlockSprite.texture = woodBlock;
      this.pipeWoodBlockSprite2.texture = woodBlock;
    }
    const titleLogo = TextureCache.get('fruit_slice_ui_title_logo');
    if (titleLogo) {
      this.titleLogoSprite.texture = titleLogo;
      this.layoutTitleLogo();
    }
    const backButton = TextureCache.get('fruit_slice_ui_back_button');
    if (backButton) {
      this.backButtonSprite.texture = backButton;
      this.layoutBackButton();
    }
    this.tutorialGuideOverlay.setHandTexture(TextureCache.get('fruit_slice_ui_tutorial_hand'));
    const genericPanel = TextureCache.get('fruit_slice_ui_generic_panel');
    if (genericPanel) {
      this.toolHelpPanelSprite.texture = genericPanel;
      this.layoutToolHelpPanelSprite();
    }
    this.applyToolHelpFreeButtonTexture();
    this.coinBar.refreshIcon();
    this.coinBar.refresh();
    this.refreshSlantedBoardLayout();
  }

  private mountUiBackground(W: number, H: number): void {
    this.bgSprite.width = W;
    this.bgSprite.height = H;
    this.container.addChild(this.bgSprite);
  }

  private mountSlantedBoards(_W: number, _H: number): void {
    void _W;
    void _H;
    this.boardLeftSprite.anchor.set(1, 1);
    this.boardRightSprite.anchor.set(0, 1);
    this.container.addChild(this.boardLeftSprite, this.boardRightSprite);
  }

  private mountPipeProps(): void {
    this.pipeKnifeSprite.anchor.set(0.5);
    this.pipeKnifeSprite.alpha = 0.98;
    for (const sp of [this.pipeWoodBlockSprite, this.pipeWoodBlockSprite2]) {
      sp.anchor.set(0.5);
      sp.eventMode = 'static';
      sp.cursor = 'pointer';
      sp.on('pointertap', () => {
        void this.tryRemovePipeBlockByAd();
      });
    }
    this.pipeBlockShade.eventMode = 'static';
    this.pipeBlockShade.cursor = 'pointer';
    this.pipeBlockShade.on('pointertap', () => {
      void this.tryRemovePipeBlockByAd();
    });
    this.pipeBlockLabel.anchor.set(0.5);
    this.pipeBlockLabel.eventMode = 'static';
    this.pipeBlockLabel.cursor = 'pointer';
    this.pipeBlockLabel.on('pointertap', () => {
      void this.tryRemovePipeBlockByAd();
    });
    this.container.addChild(
      this.pipeKnifeSprite,
      this.pipeWoodBlockSprite,
      this.pipeWoodBlockSprite2,
      this.pipeBlockShade,
      this.pipeBlockLabel,
    );
    this.layoutPipeProps();
  }

  private pipeBlockLayout(): {
    knifeY: number;
    knifeW: number;
    blockW: number;
    blockH: number;
    blockTotalH: number;
    blockTop: number;
  } {
    const geometry = this.boardGeometry;
    const channelW = geometry ? Math.max(86, geometry.rightInnerX - geometry.leftInnerX) : 104;
    const knifeW = Math.min(channelW * 1.06, 132);
    const knifeH = knifeW * 0.22;
    const knifeY = Game.logicHeight - 36;
    const blockW = Math.min(channelW * 0.98, 118);
    const blockH = blockW * 0.48;
    const blockTotalH = blockH * 2;
    const knifeTop = knifeY - knifeH * 0.5;
    const blockTop = knifeTop - blockTotalH - 2;
    return { knifeY, knifeW, blockW, blockH, blockTotalH, blockTop };
  }

  private layoutPipeProps(): void {
    const geometry = this.boardGeometry;
    if (!geometry) {
      return;
    }
    const centerX = this.pipeStackCenterX();
    const layout = this.pipeBlockLayout();

    if (this.pipeKnifeSprite.texture !== PIXI.Texture.EMPTY) {
      const ar = this.pipeKnifeSprite.texture.width / Math.max(1, this.pipeKnifeSprite.texture.height);
      this.pipeKnifeSprite.width = layout.knifeW;
      this.pipeKnifeSprite.height = layout.knifeW / Math.max(0.1, ar);
      // 生成图的刀刃方向与需求相反，这里垂直翻转，保持刀刃朝上。
      this.pipeKnifeSprite.scale.y = -Math.abs(this.pipeKnifeSprite.scale.y);
    }
    this.pipeKnifeSprite.position.set(centerX, layout.knifeY);

    if (this.pipeWoodBlockSprite.texture !== PIXI.Texture.EMPTY && this.pipeWoodBlockSprite2.texture !== PIXI.Texture.EMPTY) {
      const ar = this.pipeWoodBlockSprite.texture.width / Math.max(1, this.pipeWoodBlockSprite.texture.height);
      const scaleH = layout.blockH;
      const scaleW = Math.min(layout.blockW, scaleH * ar);
      for (const [idx, sp] of [this.pipeWoodBlockSprite, this.pipeWoodBlockSprite2].entries()) {
        sp.width = scaleW;
        sp.height = scaleH;
        sp.position.set(centerX, idx === 0 ? layout.blockTop + scaleH * 0.5 : layout.blockTop + scaleH * 1.5);
        const texW = Math.max(1, sp.texture.width);
        const texH = Math.max(1, sp.texture.height);
        const padX = 10 / Math.max(0.01, sp.scale.x);
        const padY = 10 / Math.max(0.01, sp.scale.y);
        sp.hitArea = new PIXI.Rectangle(
          -texW * 0.5 - padX,
          -texH * 0.5 - padY,
          texW + padX * 2,
          texH + padY * 2,
        );
        sp.visible = !this.pipeBlockRemoved;
      }
    }
    this.pipeBlockShade.clear();
    this.pipeBlockShade.beginFill(0x2b1405, 0.34);
    this.pipeBlockShade.drawRoundedRect(
      centerX - layout.blockW * 0.5,
      layout.blockTop,
      layout.blockW,
      layout.blockTotalH,
      14,
    );
    this.pipeBlockShade.endFill();
    this.pipeBlockShade.hitArea = new PIXI.Rectangle(
      centerX - layout.blockW * 0.5,
      layout.blockTop,
      layout.blockW,
      layout.blockTotalH,
    );
    this.pipeBlockShade.visible = !this.pipeBlockRemoved;
    this.pipeBlockLabel.position.set(centerX, layout.blockTop + layout.blockTotalH * 0.5);
    this.pipeBlockLabel.visible = !this.pipeBlockRemoved;
  }

  private async tryRemovePipeBlockByAd(): Promise<void> {
    if (this.gameOver || this.pipeBlockRemoved || this.pipeBlockAdBusy) {
      return;
    }
    this.pipeBlockAdBusy = true;
    this.spawnCenterBanner('看广告移除木板');
    try {
      const result = await showRewardedAd({
        scene: 'fruit_slice_remove_pipe_block',
        extra: { score: this.score },
      }, FRUIT_SLICE_REWARDED_AD_UNIT_ID);
      if (result === 'completed' || result === 'unavailable') {
        this.pipeBlockRemoved = true;
        this.pipeWoodBlockSprite.visible = false;
        this.pipeWoodBlockSprite2.visible = false;
        this.pipeBlockShade.visible = false;
        this.pipeBlockLabel.visible = false;
        this.relayoutPipeStackAfterBlockChange();
        this.spawnCenterBanner('木板已移除');
      } else {
        this.spawnCenterBanner('广告未完成');
      }
    } finally {
      this.pipeBlockAdBusy = false;
    }
  }

  private relayoutPipeStackAfterBlockChange(): void {
    for (let i = 0; i < this.pipeStack.length; i += 1) {
      const entry = this.pipeStack[i]!;
      const old = entry.node.__pipeSlot;
      const y = this.pipeStackY(i);
      entry.node.y = y;
      entry.node.__pipeSlot = {
        x: old?.x ?? entry.node.x,
        y,
        rotation: old?.rotation ?? entry.node.rotation,
      };
    }
  }

  /** 管道在场景中的显示高度与宽度（与 mountPipe 一致，供案板贴边对齐）。 */
  private getPipeDisplaySize(): { h: number; w: number } {
    const H = Game.logicHeight;
    const h = Math.max(210, H * 0.25);
    return { h, w: h * 0.28 };
  }

  /**
   * 左右案板：强制同宽同高；底边 Y 与内侧通道宽度由这里统一产出，物理也读取同一份几何。
   */
  private refreshSlantedBoardLayout(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const cx = W / 2;
    const { w: pipeW } = this.getPipeDisplaySize();
    const pipeHalf = pipeW * 0.5;
    const seamHalf = pipeHalf * SLANTED_BOARD_SEAM_HALF_MULT;
    const baseY = this.cliffBottomY + 46 + SLANTED_BOARD_BASE_Y_OFFSET + SLANTED_BOARD_DROP_EXTRA;
    const targetH = H * 0.47;

    const tl = this.boardLeftSprite.texture;
    const tr = this.boardRightSprite.texture;
    if (!tl || tl.width < 2 || !tr || tr.width < 2) {
      return;
    }
    const arL = tl.width / tl.height;
    const arR = tr.width / tr.height;
    const unifiedAr = (arL + arR) / 2;
    const boardW = targetH * unifiedAr;

    this.boardLeftSprite.width = boardW;
    this.boardLeftSprite.height = targetH;
    this.boardRightSprite.width = boardW;
    this.boardRightSprite.height = targetH;

    this.boardLeftSprite.position.set(cx - seamHalf, baseY);
    this.boardRightSprite.position.set(cx + seamHalf, baseY);

    const fallbackOuter = baseY - targetH * BOARD_SURFACE_OUTER_Y_FR;
    const fallbackInner = baseY - targetH * BOARD_SURFACE_INNER_Y_FR;
    const surfaceOuterY = this.computeEdgeWorldY('left', 0, targetH, baseY) ?? fallbackOuter;
    const innerLeft = this.computeEdgeWorldY('left', 1, targetH, baseY);
    const innerRight = this.computeEdgeWorldY('right', 0, targetH, baseY);
    let surfaceInnerY = fallbackInner;
    if (innerLeft !== null && innerRight !== null) {
      surfaceInnerY = Math.min(innerLeft, innerRight);
    } else if (innerLeft !== null) {
      surfaceInnerY = innerLeft;
    } else if (innerRight !== null) {
      surfaceInnerY = innerRight;
    }

    this.boardGeometry = {
      leftOuterX: this.boardLeftSprite.x - boardW,
      leftInnerX: this.boardLeftSprite.x,
      rightInnerX: this.boardRightSprite.x,
      rightOuterX: this.boardRightSprite.x + boardW,
      baseY,
      boardW,
      boardH: targetH,
      surfaceOuterY,
      surfaceInnerY,
    };
    this.layoutToolButtonsOnBoards();
    this.layoutPipeProps();
    this.redrawWarningLine();
  }

  /** 预警线：只覆盖中央管道宽度，接近危险时才闪烁显示。 */
  private redrawWarningLine(): void {
    const geometry = this.boardGeometry;
    if (!geometry) {
      return;
    }
    const lineY = this.warningLineY();
    const x0 = geometry.leftInnerX - 10;
    const x1 = geometry.rightInnerX + 10;
    const w = Math.max(36, x1 - x0);
    const g = this.warningLine;
    g.clear();
    g.beginFill(0xff3a3a, 0.22);
    g.drawRoundedRect(x0, lineY - 7, w, 14, 7);
    g.endFill();
    g.beginFill(0xff3a3a, 1);
    g.drawRoundedRect(x0, lineY - 2, w, 4, 2);
    g.endFill();
    let x = x0 + 6;
    while (x + 10 < x1 - 6) {
      g.beginFill(0xffffff, 0.85);
      g.drawRoundedRect(x, lineY - 1.5, 10, 3, 1.5);
      g.endFill();
      x += 18;
    }
    g.alpha = 0;
  }

  private warningLineY(): number {
    const geometry = this.boardGeometry;
    if (!geometry) {
      return 0;
    }
    return Math.max(40, geometry.surfaceInnerY - 18);
  }

  private updateWarningLine(dt: number): void {
    const gridActive = this.updateGridWarningLine(dt);
    const pipeActive = this.updatePipeWarningLine(dt, gridActive);
    this.updateWarningSfx(dt, gridActive || pipeActive);
  }

  private updatePipeWarningLine(dt: number, suppressApproach = false): boolean {
    const geometry = this.boardGeometry;
    if (!geometry || this.gameOver) {
      return false;
    }
    const lineY = this.warningLineY();
    let pipeTop = Infinity;
    for (const entry of this.pipeStack) {
      const top = entry.node.y - entry.node.radius;
      if (top < pipeTop) {
        pipeTop = top;
      }
    }
    const distPipe = pipeTop - lineY;
    const pipeOverflow = pipeTop <= lineY - WARNING_OVERFLOW_TOLERANCE;
    const approachStart = 80;
    if (pipeOverflow) {
      this.warningLine.alpha = 1;
      this.warningOverflowT += dt;
      if (this.warningOverflowT >= WARNING_OVERFLOW_GRACE_SECONDS) {
        this.failByOverflow('pipe');
      }
      return true;
    }
    this.warningOverflowT = 0;
    if (suppressApproach || !Number.isFinite(distPipe) || distPipe >= approachStart) {
      this.warningLine.alpha = 0;
      this.warningPulseT = 0;
      return false;
    }
    const intensity = 1 - distPipe / approachStart;
    this.warningPulseT += dt * (5 + intensity * 8);
    const pulse = 0.5 + 0.5 * Math.sin(this.warningPulseT);
    this.warningLine.alpha = Math.min(1, 0.35 + intensity * 0.65) * (0.35 + 0.65 * pulse);
    return true;
  }

  private gridWarningLineY(): number {
    const geometry = this.boardGeometry;
    const maxY = geometry ? geometry.surfaceInnerY - 26 : this.cliffTopY + 120;
    return Math.min(maxY, this.fruitBottomY + GRID_OVERFLOW_LINE_OFFSET);
  }

  private redrawGridWarningLine(): void {
    const y = this.gridWarningLineY();
    const x0 = 34;
    const x1 = Game.logicWidth - 34;
    const w = Math.max(36, x1 - x0);
    const g = this.gridWarningLine;
    g.clear();
    g.beginFill(0xff3a3a, 0.18);
    g.drawRoundedRect(x0, y - 7, w, 14, 7);
    g.endFill();
    g.beginFill(0xff3a3a, 0.95);
    g.drawRoundedRect(x0, y - 2, w, 4, 2);
    g.endFill();
    g.alpha = 0;
  }

  private updateGridWarningLine(dt: number): boolean {
    if (this.gameOver) {
      return false;
    }
    if (!this.gridWarningArmed) {
      this.gridWarningLine.alpha = 0;
      this.gridWarningPulseT = 0;
      this.gridWarningOverflowT = 0;
      return false;
    }
    const lineY = this.gridWarningLineY();
    let visualBottom = -Infinity;
    let targetBottom = -Infinity;
    for (const node of this.fruits) {
      if (node.state !== 'fixed' && node.state !== 'settled') {
        continue;
      }
      const bottom = node.y + node.radius;
      const projectedBottom = (node.__slideTo ?? node.y) + node.radius;
      if (bottom > visualBottom) {
        visualBottom = bottom;
      }
      if (projectedBottom > targetBottom) {
        targetBottom = projectedBottom;
      }
    }
    if (!Number.isFinite(visualBottom)) {
      this.gridWarningLine.alpha = 0;
      this.gridWarningOverflowT = 0;
      return false;
    }
    const dist = lineY - Math.max(visualBottom, targetBottom);
    const overflow = visualBottom >= lineY + GRID_OVERFLOW_TOLERANCE;
    const approachStart = 80;
    if (overflow) {
      this.gridWarningLine.alpha = 1;
      this.gridWarningOverflowT += dt;
      if (this.gridWarningOverflowT >= WARNING_OVERFLOW_GRACE_SECONDS) {
        this.failByOverflow('grid');
      }
      return true;
    }
    this.gridWarningOverflowT = 0;
    if (dist >= approachStart) {
      this.gridWarningLine.alpha = 0;
      this.gridWarningPulseT = 0;
      return false;
    }
    const intensity = 1 - Math.max(0, dist) / approachStart;
    this.gridWarningPulseT += dt * (5 + intensity * 8);
    const pulse = 0.5 + 0.5 * Math.sin(this.gridWarningPulseT);
    this.gridWarningLine.alpha = Math.min(1, 0.35 + intensity * 0.65) * (0.35 + 0.65 * pulse);
    return true;
  }

  private updateWarningSfx(dt: number, active: boolean): void {
    if (!active) {
      this.warningSfxActive = false;
      this.warningSfxCount = 0;
      this.warningSfxCooldown = 0;
      return;
    }
    if (!this.warningSfxActive) {
      this.warningSfxActive = true;
      this.warningSfxCount = 0;
      this.warningSfxCooldown = 0;
    }
    if (this.warningSfxCount >= WARNING_SFX_MAX_COUNT) {
      return;
    }
    this.warningSfxCooldown -= dt;
    if (this.warningSfxCooldown > 0) {
      return;
    }
    AudioManager.playBufferPanicSound();
    this.warningSfxCount += 1;
    this.warningSfxCooldown = WARNING_SFX_INTERVAL_SECONDS;
  }

  private failByOverflow(source: 'pipe' | 'grid' = 'pipe'): void {
    if (this.gameOver) {
      return;
    }
    this.warningLine.alpha = source === 'pipe' ? 1 : 0;
    this.gridWarningLine.alpha = source === 'grid' ? 1 : 0;
    this.finishRound(source === 'grid' ? 'grid_overflow' : 'pipe_overflow');
  }

  /** 网格行高：与初始 8 行布局保持一致，避免补料后密度突变。 */
  private gridRowStep(): number {
    const rows = 8;
    const padY = 10;
    const span = this.fruitBottomY - this.fruitTopY - padY * 2;
    return Math.max(34, span / Math.max(1, rows - 1));
  }

  private gridFruitX(
    col: number,
    row: number,
    cols: number,
    padX: number,
    cellW: number,
    W: number,
    jitter = 24,
  ): number {
    const rowStagger = row % 2 === 0 ? 0 : cellW * 0.36;
    const minX = padX + 10;
    const maxX = W - padX - 10;
    if (col === 0) {
      return Math.min(maxX, padX + cellW * (0.14 + Math.random() * 0.62));
    }
    if (col === cols - 1) {
      return Math.max(minX, W - padX - cellW * (0.14 + Math.random() * 0.62));
    }
    const base = padX + col * cellW + rowStagger;
    return Math.min(maxX, Math.max(minX, base + (Math.random() - 0.5) * jitter));
  }

  private isFruitGridSpotFree(x: number, y: number, radius: number, placed: FruitSliceNode[]): boolean {
    for (const other of [...this.fruits, ...placed]) {
      if (other.state !== 'fixed' && other.state !== 'settled') {
        continue;
      }
      const otherY = other.__slideTo ?? other.y;
      const dx = x - other.x;
      const dy = y - otherY;
      const need = (radius + other.radius) * 0.98;
      if (dx * dx + dy * dy < need * need) {
        return false;
      }
    }
    return true;
  }

  private findFruitGridSpot(
    col: number,
    row: number,
    cols: number,
    padX: number,
    cellW: number,
    W: number,
    baseY: number,
    radius: number,
    placed: FruitSliceNode[],
  ): { x: number; y: number } | null {
    for (let i = 0; i < 24; i += 1) {
      const edgeLooseY = col === 0 || col === cols - 1 ? (Math.random() - 0.5) * 26 : 0;
      const candidate = {
        x: this.gridFruitX(col, row, cols, padX, cellW, W, col === 0 || col === cols - 1 ? 18 : 24),
        y: baseY + (Math.random() - 0.5) * 16 + edgeLooseY,
      };
      if (this.isFruitGridSpotFree(candidate.x, candidate.y, radius, placed)) {
        return candidate;
      }
    }
    return null;
  }

  /** 整张静态网格保持相对位置统一下移。低库存时至少压下一行，让底部水果能进入斜面区。 */
  private compactFruitsDownByRows(minRows = 0): number {
    if (this.fruits.length === 0) {
      return 0;
    }
    let lowestBottom = -Infinity;
    for (const node of this.fruits) {
      if (node.state !== 'fixed' && node.state !== 'settled') {
        continue;
      }
      const targetY = node.__slideTo ?? node.y;
      const bottom = targetY + node.radius;
      if (bottom > lowestBottom) {
        lowestBottom = bottom;
      }
    }
    if (lowestBottom === -Infinity) {
      return 0;
    }
    const rowStep = this.gridRowStep();
    const roomRows = Math.max(0, Math.floor((this.fruitBottomY - lowestBottom) / rowStep));
    const rows = Math.max(roomRows, minRows);
    if (rows <= 0) {
      return 0;
    }
    const shift = rows * rowStep;
    for (const node of this.fruits) {
      if (node.state !== 'fixed' && node.state !== 'settled') {
        continue;
      }
      const cur = node.__slideTo ?? node.y;
      node.__slideTo = cur + shift;
    }
    return rows;
  }

  private updateSlidingFruit(node: FruitSliceNode, dt: number): void {
    const target = node.__slideTo;
    if (target === undefined) {
      return;
    }
    const dy = target - node.y;
    if (Math.abs(dy) < 0.6) {
      node.y = target;
      node.__slideTo = undefined;
      return;
    }
    const k = Math.min(1, dt * 8.5);
    node.y += dy * k;
  }

  /** 把指定侧的纹理列在某个归一化位置 t in [0,1] 转为世界 Y。t=0 取最外列，t=1 取最内列。 */
  private computeEdgeWorldY(
    side: 'left' | 'right',
    t: number,
    boardH: number,
    baseY: number,
  ): number | null {
    const edge = side === 'left' ? this.boardLeftEdge : this.boardRightEdge;
    if (!edge) {
      return null;
    }
    // 左板：纹理列 0=外缘，列 texW-1=内缘 → t 直接对应 t。
    // 右板：纹理列 0=内缘，列 texW-1=外缘 → 内侧用 t=0，外侧用 t=1，传入语义保持"t=0外、t=1内"，所以反一下。
    const sampleT = side === 'left' ? t : 1 - t;
    const texY = sampleEdgeAt(edge, sampleT);
    return baseY - boardH + (texY * boardH) / Math.max(1, edge.texH);
  }

  private build(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const top = Game.safeTop;
    const headerH = top + 72;
    const cliffTop = H * 0.58;
    const cliffBottom = H * 0.82;
    this.cliffTopY = cliffTop;
    this.cliffBottomY = cliffBottom;
    this.fruitTopY = top + 186;
    this.fruitBottomY = cliffTop - 8;
    this.initialFruitTopY = this.fruitTopY;
    this.initialFruitBottomY = this.fruitBottomY;

    this.mountUiBackground(W, H);
    this.fruitLayer.sortableChildren = true;
    this.pipeStackLayer.sortableChildren = true;
    this.container.addChild(this.fruitLayer);
    this.mountSlantedBoards(W, H);
    this.refreshSlantedBoardLayout();
    this.mountPipeProps();
    this.container.addChild(this.pipeStackLayer, this.effectLayer);
    this.container.addChild(this.warningLine);
    this.redrawGridWarningLine();
    this.container.addChild(this.gridWarningLine);
    this.drawHud(W, H, top, headerH, cliffTop, cliffBottom);
    this.coinBar.position.set(110, top + 28);
    this.container.addChild(this.coinBar);
    this.coinBar.refresh();
    this.mountToolButtons();
    this.container.addChild(this.textEffectLayer);
    this.buildToolHelpOverlay();
    this.buildGoalCelebrateOverlay();
    this.container.addChild(this.overlayLayer);
    this.overlayLayer.addChild(this.tutorialGuideOverlay);
  }

  private drawHud(W: number, _H: number, top: number, headerH: number, cliffTop: number, _cliffBottom: number): void {
    const leftPill = this.createInfoPill(W * 0.28, top + 100, '分数');
    this.scoreLabel = leftPill.value;
    this.container.addChild(leftPill.root);

    const rightPill = this.createInfoPill(W * 0.72, top + 100, '最高');
    this.bestLabel = rightPill.value;
    this.container.addChild(rightPill.root);

    this.backButtonSprite.anchor.set(0.5);
    this.backButtonSprite.eventMode = 'static';
    this.backButtonSprite.cursor = 'pointer';
    this.layoutBackButton();
    this.backButtonSprite.on('pointertap', () => {
      if (this.endOverlay) {
        return;
      }
      if (this.isTutorialActive()) {
        this.pulseTutorialTarget();
        return;
      }
      AudioManager.playButtonSound();
      SceneManager.switchTo('home');
    });
    this.container.addChild(this.backButtonSprite);

    this.titleLogoSprite.anchor.set(0.5);
    this.layoutTitleLogo();
    this.container.addChild(this.titleLogoSprite);

    this.stageLabel = new PIXI.Text('', {
      fontSize: 21,
      fill: 0xfff2ba,
      fontWeight: '900',
      dropShadow: true,
      dropShadowColor: 0x163442,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
      stroke: 0x315a6d,
      strokeThickness: 3,
      lineJoin: 'round',
    });
    this.stageLabel.anchor.set(0.5);
    this.stageLabel.position.set(W / 2, top + 66);
    this.container.addChild(this.stageLabel);
  }

  private layoutTitleLogo(): void {
    const tex = this.titleLogoSprite.texture;
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return;
    }
    const targetW = 170;
    const scale = targetW / Math.max(1, tex.width);
    this.titleLogoSprite.scale.set(scale);
    this.titleLogoSprite.position.set(Game.logicWidth / 2, Game.safeTop + 28);
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
    // hitArea 使用精灵本地坐标；按钮被缩放后要反向放大命中半径。
    this.backButtonSprite.hitArea = new PIXI.Circle(0, 0, 38 / Math.max(0.01, scale));
  }

  private buildToolHelpOverlay(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    this.toolHelpOverlay.visible = false;
    this.toolHelpOverlay.eventMode = 'static';

    const dim = new PIXI.Graphics();
    dim.beginFill(0x1f160f, 0.46);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    dim.eventMode = 'static';
    dim.cursor = 'pointer';
    dim.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.hideToolHelpPanel();
    });
    this.toolHelpOverlay.addChild(dim);

    const panel = this.toolHelpPanelRoot;
    panel.position.set(W / 2, H * 0.46);
    panel.eventMode = 'static';
    panel.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.toolHelpOverlay.addChild(panel);

    this.toolHelpPanelSprite.anchor.set(0.5);
    this.layoutToolHelpPanelSprite();
    panel.addChild(this.toolHelpPanelSprite);

    this.toolHelpTitle.anchor.set(0.5);
    this.toolHelpTitle.position.set(0, -206);
    panel.addChild(this.toolHelpTitle);

    this.toolHelpDesc.anchor.set(0.5);
    this.toolHelpDesc.position.set(0, -76);
    panel.addChild(this.toolHelpDesc);

    const freeTex = TextureCache.get('ui_panel_free_btn');
    if (freeTex) {
      this.toolHelpFreeBtn.texture = freeTex;
      this.toolHelpFreeBtn.anchor.set(0.5);
      const maxW = 300;
      const maxH = 96;
      const s = Math.min(1, maxW / freeTex.width, maxH / freeTex.height);
      this.toolHelpFreeBtn.scale.set(s);
    } else {
      this.toolHelpFreeBtn.texture = PIXI.Texture.WHITE;
      this.toolHelpFreeBtn.tint = 0xf0c84a;
      this.toolHelpFreeBtn.width = 280;
      this.toolHelpFreeBtn.height = 76;
      this.toolHelpFreeBtn.anchor.set(0.5);
    }
    this.toolHelpFreeBtn.position.set(0, 110);
    this.toolHelpFreeBtn.eventMode = 'static';
    this.toolHelpFreeBtn.cursor = 'pointer';
    this.toolHelpFreeBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.playButtonSound();
      void this.confirmToolByAd();
    });
    panel.addChild(this.toolHelpFreeBtn);

    this.toolHelpActionText.anchor.set(0.5);
    this.toolHelpActionText.position.set(0, 110);
    this.toolHelpActionText.eventMode = 'none';
    panel.addChild(this.toolHelpActionText);

    this.toolHelpUsageText.anchor.set(0.5);
    this.toolHelpUsageText.position.set(0, 166);
    this.toolHelpUsageText.eventMode = 'none';
    panel.addChild(this.toolHelpUsageText);

    const close = new PIXI.Container();
    close.position.set(184, -164);
    close.eventMode = 'static';
    close.cursor = 'pointer';
    close.hitArea = new PIXI.Circle(0, 0, 28);
    const closeBg = new PIXI.Graphics();
    closeBg.beginFill(0xd94b4b);
    closeBg.drawCircle(0, 0, 22);
    closeBg.endFill();
    close.addChild(closeBg);
    const closeTxt = new PIXI.Text('×', { fontSize: 28, fill: 0xffffff, fontWeight: '900' });
    closeTxt.anchor.set(0.5);
    closeTxt.position.set(0, -1);
    close.addChild(closeTxt);
    close.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.playButtonSound();
      this.hideToolHelpPanel();
    });
    panel.addChild(close);

    this.container.addChild(this.toolHelpOverlay);
  }

  private buildGoalCelebrateOverlay(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    this.goalCelebrateOverlay.visible = false;
    this.goalCelebrateOverlay.eventMode = 'static';
    this.goalCelebrateOverlay.sortableChildren = true;

    this.goalCelebrateDim.clear();
    this.goalCelebrateDim.beginFill(0x120a06, 0.68);
    this.goalCelebrateDim.drawRect(0, 0, W, H);
    this.goalCelebrateDim.endFill();
    this.goalCelebrateDim.eventMode = 'static';
    this.goalCelebrateDim.cursor = 'pointer';
    this.goalCelebrateDim.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.dismissGoalCelebration();
    });
    this.goalCelebrateOverlay.addChild(this.goalCelebrateDim);

    this.goalCelebrateContent.position.set(W / 2, H * 0.46);
    this.goalCelebrateContent.eventMode = 'static';
    this.goalCelebrateContent.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.goalCelebrateOverlay.addChild(this.goalCelebrateContent);

    this.container.addChild(this.goalCelebrateOverlay);
  }

  private layoutToolHelpPanelSprite(): void {
    const tex = this.toolHelpPanelSprite.texture;
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return;
    }
    const targetW = Math.min(Game.logicWidth * 0.82, 430);
    const targetH = Game.logicHeight * 0.44;
    const s = Math.min(targetW / tex.width, targetH / tex.height);
    this.toolHelpPanelSprite.scale.set(s);
  }

  private applyToolHelpFreeButtonTexture(): void {
    const freeTex = TextureCache.get('ui_panel_free_btn');
    if (!freeTex) {
      return;
    }
    this.toolHelpFreeBtn.tint = 0xffffff;
    this.toolHelpFreeBtn.texture = freeTex;
    this.toolHelpFreeBtn.anchor.set(0.5);
    const maxW = 300;
    const maxH = 96;
    const s = Math.min(1, maxW / freeTex.width, maxH / freeTex.height);
    this.toolHelpFreeBtn.scale.set(s);
    this.toolHelpFreeBtn.width = freeTex.width * s;
    this.toolHelpFreeBtn.height = freeTex.height * s;
  }

  private applyToolHelpActionButtonTexture(useInventoryButton: boolean): void {
    const tex = useInventoryButton
      ? TextureCache.get(BOWL_COMMON_MODAL_BUTTON_TEXTURE_KEY)
      : TextureCache.get('ui_panel_free_btn');
    if (!tex) {
      return;
    }
    this.toolHelpFreeBtn.tint = 0xffffff;
    this.toolHelpFreeBtn.texture = tex;
    this.toolHelpFreeBtn.anchor.set(0.5);
    const maxW = 300;
    const maxH = 96;
    const s = Math.min(1, maxW / tex.width, maxH / tex.height);
    this.toolHelpFreeBtn.scale.set(s);
    this.toolHelpFreeBtn.width = tex.width * s;
    this.toolHelpFreeBtn.height = tex.height * s;
  }

  private showToolHelpPanel(kind: FruitSliceToolKind): void {
    if (this.gameOver || this.toolRewardedAdBusy || this.goalCelebrateOverlay.visible) {
      return;
    }
    this.pendingToolKind = kind;
    if (kind === 'eliminate') {
      this.toolHelpTitle.text = '消除道具';
      this.toolHelpDesc.text = '消除管道最上方水果。\n若上方有同类水果，会一起消除。\n本次不获得分数。';
    } else {
      this.toolHelpTitle.text = '打乱道具';
      this.toolHelpDesc.text = '重新随机排列上方水果，\n帮你找到新的下落选择。';
    }
    const ownedCount = getFruitSliceToolCount(kind);
    this.applyToolHelpActionButtonTexture(ownedCount > 0);
    const limitReached = this.isFruitSliceToolLimitReached(kind);
    this.toolHelpActionText.text = limitReached ? '已达上限' : ownedCount > 0 ? `使用 1/${ownedCount}` : '';
    this.toolHelpActionText.visible = limitReached || ownedCount > 0;
    this.toolHelpFreeBtn.alpha = limitReached ? 0.72 : 1;
    this.toolHelpFreeBtn.visible = true;
    this.refreshToolHelpUsageText(kind);
    this.toolHelpOverlay.visible = true;
    this.fruitLayer.eventMode = 'none';
  }

  private hideToolHelpPanel(): void {
    this.pendingToolKind = null;
    this.toolHelpOverlay.visible = false;
    this.fruitLayer.eventMode = 'static';
  }

  private getFruitSliceToolUseCount(kind: FruitSliceToolKind): number {
    return this.fruitToolUsesThisRound[kind] ?? 0;
  }

  private isFruitSliceToolLimitReached(kind: FruitSliceToolKind): boolean {
    return this.getFruitSliceToolUseCount(kind) >= FRUIT_SLICE_TOOL_ROUND_LIMIT;
  }

  private refreshToolHelpUsageText(kind: FruitSliceToolKind): void {
    const used = Math.min(this.getFruitSliceToolUseCount(kind), FRUIT_SLICE_TOOL_ROUND_LIMIT);
    this.toolHelpUsageText.text = `每局限使用${FRUIT_SLICE_TOOL_ROUND_LIMIT}次，当前${used}/${FRUIT_SLICE_TOOL_ROUND_LIMIT}`;
    this.toolHelpUsageText.style.fill = used >= FRUIT_SLICE_TOOL_ROUND_LIMIT ? 0xd94b33 : 0x7a3d16;
  }

  private showFruitSliceToolLimitReached(kind: FruitSliceToolKind): void {
    this.refreshToolHelpUsageText(kind);
    this.spawnCenterBanner(`本局${kind === 'eliminate' ? '消除' : '打乱'}道具已用完`);
  }

  private enqueueGoalCelebration(job: GoalCelebrationJob): void {
    this.goalCelebrationQueue.push(job);
    this.pumpGoalCelebrationQueue();
  }

  private pumpGoalCelebrationQueue(): void {
    if (this.goalCelebrateBanner || this.goalCelebrationQueue.length === 0) {
      return;
    }
    const job = this.goalCelebrationQueue.shift()!;
    if (job.kind === 'milestone') {
      this.presentMilestoneGoalCelebration(job.points);
    } else {
      this.presentNewFruitsGoalCelebration(job.stageLabel, job.fruitIds);
    }
  }

  private dismissGoalCelebration(clearQueue = false): void {
    if (this.goalCelebrateAutoTimer !== null) {
      clearTimeout(this.goalCelebrateAutoTimer);
      this.goalCelebrateAutoTimer = null;
    }
    if (this.goalCelebrateIntroTicker) {
      Game.ticker.remove(this.goalCelebrateIntroTicker);
      this.goalCelebrateIntroTicker = null;
    }
    const wasOpen = !!this.goalCelebrateBanner;
    if (wasOpen) {
      this.goalCelebrateBanner?.parent?.removeChild(this.goalCelebrateBanner);
      this.goalCelebrateBanner?.destroy({ children: true });
      this.goalCelebrateBanner = null;
    }
    if (clearQueue) {
      this.goalCelebrationQueue.length = 0;
    } else if (wasOpen) {
      this.pumpGoalCelebrationQueue();
    }
  }

  private scheduleGoalCelebrateAutoClose(seconds: number): void {
    if (this.goalCelebrateAutoTimer !== null) {
      clearTimeout(this.goalCelebrateAutoTimer);
    }
    this.goalCelebrateAutoTimer = setTimeout(() => {
      this.goalCelebrateAutoTimer = null;
      this.animateGoalBannerOut();
    }, Math.round(seconds * 1000));
  }

  private presentMilestoneGoalCelebration(points: number): void {
    const banner = this.createGoalBanner();
    const title = new PIXI.Text('目标达成', {
      fontSize: 25,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x9a3d08,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    title.anchor.set(0, 0.5);
    title.position.set(-150, 0);
    banner.addChild(title);

    const score = new PIXI.Text(`${points}分`, {
      fontSize: 42,
      fill: 0xffe24a,
      fontWeight: '900',
      stroke: 0xb84a08,
      strokeThickness: 7,
      lineJoin: 'round',
    });
    score.anchor.set(0, 0.5);
    score.position.set(-38, 1);
    banner.addChild(score);

    this.showGoalBanner(banner, 1);
    this.scheduleGoalCelebrateAutoClose(GOAL_MILESTONE_AUTO_SECONDS);
  }

  private presentNewFruitsGoalCelebration(stageLabel: string, fruitIds: FruitId[]): void {
    const id = fruitIds[0];
    if (!id) {
      this.presentMilestoneGoalCelebration(0);
      return;
    }
    const inCatalog = getUnlockedFruitIds().has(id);
    const banner = this.createGoalBanner();
    const texKey = fruitSliceWholeTextureKey(id);
    let tex = TextureCache.get(texKey);
    if (!tex || tex === PIXI.Texture.EMPTY) {
      tex = TextureCache.get(id);
    }
    const icon = new PIXI.Sprite(tex && tex !== PIXI.Texture.EMPTY ? tex : PIXI.Texture.WHITE);
    icon.anchor.set(0.5);
    const target = 56;
    icon.scale.set(Math.min(target / Math.max(1, icon.texture.width), target / Math.max(1, icon.texture.height), 1.3));
    if (!tex || tex === PIXI.Texture.EMPTY) {
      icon.tint = 0xffd46a;
    }
    icon.position.set(-146, 0);
    banner.addChild(icon);

    const label = FRUIT_MAP[id]?.label ?? id;
    const name = new PIXI.Text(label, {
      fontSize: 31,
      fill: 0xfff4c2,
      fontWeight: '900',
      stroke: 0x8a3511,
      strokeThickness: 6,
      lineJoin: 'round',
    });
    name.anchor.set(0, 0.5);
    name.position.set(-96, -10);
    banner.addChild(name);

    const tag = new PIXI.Text(stageLabel, {
      fontSize: 17,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x2b6a34,
      strokeThickness: 4,
      lineJoin: 'round',
    });
    tag.anchor.set(0, 0.5);
    tag.position.set(-96, 21);
    banner.addChild(tag);

    const catalogTagBg = new PIXI.Graphics();
    const catalogTagW = inCatalog ? 90 : 104;
    catalogTagBg.beginFill(inCatalog ? 0x2f8f3a : 0x6a6258, 0.84);
    catalogTagBg.drawRoundedRect(0, 0, catalogTagW, 24, 12);
    catalogTagBg.endFill();
    catalogTagBg.position.set(14, 9);
    banner.addChild(catalogTagBg);
    const catalogTag = new PIXI.Text(inCatalog ? '图鉴已解锁' : '图鉴未解锁', {
      fontSize: 15,
      fill: 0xfffef2,
      fontWeight: '900',
    });
    catalogTag.anchor.set(0.5);
    catalogTag.position.set(14 + catalogTagW / 2, 21);
    banner.addChild(catalogTag);

    const score = FRUIT_SLICE_BASE_SCORE
      + getFruitSliceStageBonus(id, this.score)
      + (inCatalog ? FRUIT_SLICE_UNLOCKED_BONUS : 0);
    const scoreText = new PIXI.Text(`+${score}分`, {
      fontSize: 25,
      fill: 0xffe24a,
      fontWeight: '900',
      stroke: 0x8a3511,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    scoreText.anchor.set(1, 0.5);
    scoreText.position.set(154, 0);
    banner.addChild(scoreText);

    this.showGoalBanner(banner, 1);
    AudioManager.playBadgeUnlockSound();
    this.scheduleGoalCelebrateAutoClose(GOAL_NEW_FRUIT_AUTO_SECONDS);
  }

  private createGoalBanner(): PIXI.Container {
    const root = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(0x21160f, 0.72);
    bg.drawRoundedRect(-196, -43, 392, 86, 24);
    bg.endFill();
    root.addChild(bg);
    return root;
  }

  private showGoalBanner(banner: PIXI.Container, finalScale: number): void {
    banner.position.set(Game.logicWidth + 240, Game.logicHeight * 0.26);
    banner.eventMode = 'none';
    this.textEffectLayer.addChild(banner);
    this.goalCelebrateBanner = banner;
    this.runGoalCelebrateIntroPulse(finalScale);
  }

  private runGoalCelebrateIntroPulse(finalScale: number): void {
    if (this.goalCelebrateIntroTicker) {
      Game.ticker.remove(this.goalCelebrateIntroTicker);
    }
    const root = this.goalCelebrateBanner;
    if (!root) {
      return;
    }
    root.alpha = 0;
    const startScale = finalScale * 0.72;
    const startX = root.x;
    const targetX = Game.logicWidth / 2;
    root.scale.set(startScale);
    let t = 0;
    const dur = 0.46;
    this.goalCelebrateIntroTicker = (): void => {
      t += Game.ticker.deltaMS / 1000;
      const p = Math.min(t / dur, 1);
      const e = 1 - (1 - p) ** 3;
      root.alpha = Math.min(1, p * 1.15);
      root.x = startX + (targetX - startX) * e;
      const bounce = 1 + 0.04 * Math.sin(p * Math.PI);
      const s = (startScale + (finalScale - startScale) * e) * (p < 1 ? bounce : 1);
      root.scale.set(s, s);
      if (p >= 1) {
        root.alpha = 1;
        root.x = targetX;
        root.scale.set(finalScale, finalScale);
        if (this.goalCelebrateIntroTicker) {
          Game.ticker.remove(this.goalCelebrateIntroTicker);
          this.goalCelebrateIntroTicker = null;
        }
      }
    };
    Game.ticker.add(this.goalCelebrateIntroTicker);
  }

  private animateGoalBannerOut(): void {
    if (this.goalCelebrateIntroTicker) {
      Game.ticker.remove(this.goalCelebrateIntroTicker);
      this.goalCelebrateIntroTicker = null;
    }
    const root = this.goalCelebrateBanner;
    if (!root) {
      this.pumpGoalCelebrationQueue();
      return;
    }
    const startX = root.x;
    const targetX = -240;
    let t = 0;
    const dur = 0.42;
    this.goalCelebrateIntroTicker = (): void => {
      t += Game.ticker.deltaMS / 1000;
      const p = Math.min(t / dur, 1);
      const e = p * p;
      root.x = startX + (targetX - startX) * e;
      root.alpha = 1 - Math.max(0, p - 0.55) / 0.45;
      if (p >= 1) {
        if (this.goalCelebrateIntroTicker) {
          Game.ticker.remove(this.goalCelebrateIntroTicker);
          this.goalCelebrateIntroTicker = null;
        }
        this.dismissGoalCelebration();
      }
    };
    Game.ticker.add(this.goalCelebrateIntroTicker);
  }

  private async confirmToolByAd(): Promise<void> {
    const kind = this.pendingToolKind;
    if (!kind || this.toolRewardedAdBusy) {
      return;
    }
    if (this.isFruitSliceToolLimitReached(kind)) {
      this.showFruitSliceToolLimitReached(kind);
      return;
    }
    if (!this.canApplyFruitSliceTool(kind)) {
      return;
    }
    const ownedCount = getFruitSliceToolCount(kind);
    if (ownedCount > 0) {
      const result = consumeFruitSliceTool(kind);
      if (!result.consumed) {
        this.spawnCenterBanner('道具数量不足');
        return;
      }
      this.hideToolHelpPanel();
      this.refreshFruitToolInventoryBadges();
      this.applyFruitSliceTool(kind);
      return;
    }
    this.toolRewardedAdBusy = true;
    try {
      const result = await showRewardedAd({
        scene: `fruit_slice_tool_${kind}`,
        extra: { score: this.score },
      }, FRUIT_SLICE_REWARDED_AD_UNIT_ID);
      if (result === 'completed' || result === 'unavailable') {
        if (this.isFruitSliceToolLimitReached(kind)) {
          this.showFruitSliceToolLimitReached(kind);
          return;
        }
        if (!this.canApplyFruitSliceTool(kind)) {
          return;
        }
        this.hideToolHelpPanel();
        this.applyFruitSliceTool(kind);
      } else if (result === 'skipped') {
        this.spawnCenterBanner('看完广告后才能使用');
      } else {
        this.spawnCenterBanner('广告暂不可用');
      }
    } finally {
      this.toolRewardedAdBusy = false;
    }
  }

  private canApplyFruitSliceTool(kind: FruitSliceToolKind): boolean {
    if (this.gameOver) {
      return false;
    }
    if (kind === 'eliminate') {
      if (this.pipeStack.length === 0) {
        this.spawnCenterBanner('管道为空');
        return false;
      }
      return true;
    }
    const hasShuffleTargets = this.fruits.some((node) => node.state === 'fixed' || node.state === 'settled');
    if (!hasShuffleTargets) {
      this.spawnCenterBanner('暂无可打乱水果');
      return false;
    }
    return true;
  }

  private applyFruitSliceTool(kind: FruitSliceToolKind): void {
    if (kind === 'eliminate') {
      this.eliminatePipeTopPair();
    } else {
      this.shuffleFruits();
    }
    this.fruitToolUsesThisRound[kind] = this.getFruitSliceToolUseCount(kind) + 1;
    analytics.track('fruit_slice_tool_use', {
      mode: 'fruit_slice',
      tool_kind: kind,
      score: this.score,
      round_used_count: this.getFruitSliceToolUseCount(kind),
      pipe_count: this.pipeStack.length,
    });
  }

  private createInfoPill(x: number, y: number, label: string): { root: PIXI.Container; value: PIXI.Text } {
    const root = new PIXI.Container();
    root.position.set(x, y);
    const bg = new PIXI.Sprite();
    bg.anchor.set(0.5);
    bg.width = 220;
    bg.height = 62;
    this.scorePanelSprites.push(bg);
    root.addChild(bg);
    const title = new PIXI.Text(label, {
      fontSize: 22,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x2c6a28,
      strokeThickness: 4,
      lineJoin: 'round',
    });
    title.anchor.set(0.5);
    title.position.set(-56, -1);
    root.addChild(title);
    const value = new PIXI.Text('0', {
      fontSize: 24,
      fill: 0xfffef0,
      fontWeight: '900',
      stroke: 0x31551d,
      strokeThickness: 3,
      lineJoin: 'round',
    });
    value.anchor.set(0.5);
    value.position.set(54, -1);
    root.addChild(value);
    return { root, value };
  }

  private getBestResumeCheckpoint(): number | null {
    const best = getFruitSliceBestScore();
    let checkpoint = 0;
    for (const tier of FRUIT_SLICE_COIN_TIERS) {
      if (best >= tier.minScore && tier.minScore > checkpoint) {
        checkpoint = tier.minScore;
      }
    }
    return checkpoint > 0 ? checkpoint : null;
  }

  private showStartChoiceOrStartRound(source: FruitSliceStartChoiceSource): void {
    const checkpoint = this.getBestResumeCheckpoint();
    if (!checkpoint) {
      this.startRound(0, source);
      return;
    }
    this.showFruitSliceStartChoiceOverlay(checkpoint, source);
  }

  private getFruitSliceStageLabelForScore(score: number): string {
    const stageIndex = getFruitSliceStageIndex(score);
    return FRUIT_SLICE_STAGES[stageIndex]?.label ?? FRUIT_SLICE_STAGES[0]!.label;
  }

  private showFruitSliceStartChoiceOverlay(checkpoint: number, source: FruitSliceStartChoiceSource): void {
    this.hideEndOverlay();
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const best = getFruitSliceBestScore();
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.hitArea = new PIXI.Rectangle(0, 0, W, H);

    const dim = new PIXI.Graphics();
    dim.beginFill(0x10202a, 0.62);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    root.addChild(dim);

    const panelTex = TextureCache.get('fruit_slice_ui_generic_panel');
    if (panelTex) {
      const panel = new PIXI.Sprite(panelTex);
      panel.anchor.set(0.5);
      const targetW = Math.min(W * 0.82, 430);
      const targetH = H * 0.44;
      const s = Math.min(targetW / panelTex.width, targetH / panelTex.height);
      panel.scale.set(s);
      panel.position.set(W / 2, H / 2);
      root.addChild(panel);
    } else {
      const panel = new PIXI.Graphics();
      panel.beginFill(0xfff4cf, 0.98);
      panel.lineStyle(5, 0x8d5a2b, 1);
      panel.drawRoundedRect(-224, -180, 448, 360, 30);
      panel.endFill();
      panel.position.set(W / 2, H / 2);
      root.addChild(panel);
    }

    const title = new PIXI.Text('从哪个分数开始？', {
      fontSize: 33,
      fill: 0x8a3a20,
      fontWeight: '900',
      stroke: 0xfff3d2,
      strokeThickness: 4,
      lineJoin: 'round',
    });
    title.anchor.set(0.5);
    title.position.set(W / 2, H / 2 - 209);
    root.addChild(title);

    const checkpointStageLabel = this.getFruitSliceStageLabelForScore(checkpoint);
    const bestRow = new PIXI.Container();
    bestRow.position.set(W / 2, H / 2 - 92);
    root.addChild(bestRow);
    const bestPrefix = this.createStartChoiceInlineText('历史最高 ', 0x4b2e20, 24);
    const bestValue = this.createStartChoiceInlineText(`${best}`, 0xe45a22, 28);
    const bestSuffix = this.createStartChoiceInlineText(' 分', 0x4b2e20, 24);
    this.layoutCenteredInlineRow(bestRow, [bestPrefix, bestValue, bestSuffix], 2);

    const stageRow = new PIXI.Container();
    stageRow.position.set(W / 2, H / 2 - 58);
    root.addChild(stageRow);
    const stagePrefix = this.createStartChoiceInlineText('已解锁 ', 0x4b2e20, 24);
    const stageValue = this.createStartChoiceInlineText(checkpointStageLabel, 0xe45a22, 28);
    const stageSuffix = this.createStartChoiceInlineText(' 阶段', 0x4b2e20, 24);
    this.layoutCenteredInlineRow(stageRow, [stagePrefix, stageValue, stageSuffix], 2);

    const checkpointText = new PIXI.Text(`可从 ${checkpoint} 分继续挑战`, {
      fontSize: 31,
      fill: 0xe45a22,
      fontWeight: '900',
      align: 'center',
      stroke: 0xfff4cf,
      strokeThickness: 4,
      lineJoin: 'round',
    });
    checkpointText.anchor.set(0.5);
    checkpointText.position.set(W / 2, H / 2 - 22);
    root.addChild(checkpointText);

    root.addChild(this.createOverlayImageTextButton(W / 2, H / 2 + 58, 318, 58, '从头开始', () => {
      if (this.resumeStartAdBusy) {
        return;
      }
      AudioManager.playButtonSound();
      this.startRound(0, source);
    }));

    root.addChild(this.createOverlayImageTextButton(W / 2, H / 2 + 126, 318, 58, `从${checkpoint}分开始`, () => {
      AudioManager.playButtonSound();
      void this.startRoundFromCheckpointByAd(checkpoint, source);
    }, true));

    root.addChild(this.createOverlayImageTextButton(W / 2, H / 2 + 192, 238, 50, '回首页', () => {
      if (this.resumeStartAdBusy) {
        return;
      }
      AudioManager.playButtonSound();
      this.hideEndOverlay();
      SceneManager.switchTo('home');
    }));

    this.overlayLayer.addChild(root);
    this.endOverlay = root;
  }

  private async startRoundFromCheckpointByAd(checkpoint: number, source: FruitSliceStartChoiceSource): Promise<void> {
    if (this.resumeStartAdBusy) {
      return;
    }
    this.resumeStartAdBusy = true;
    const best = getFruitSliceBestScore();
    try {
      const result = await showRewardedAd({
        scene: 'fruit_slice_checkpoint_start',
        extra: { checkpoint, bestScore: best, source },
      }, FRUIT_SLICE_REWARDED_AD_UNIT_ID);
      if (result === 'completed') {
        analytics.track('fruit_slice_checkpoint_start', {
          mode: 'fruit_slice',
          checkpoint,
          best_score: best,
          source,
        });
        this.startRound(checkpoint, 'checkpoint');
        this.spawnCenterBanner(`已从${checkpoint}分开始`);
        return;
      }
      this.spawnCenterBanner(result === 'skipped' ? '看完广告后才能从档位开始' : '广告暂不可用，请从头开始');
    } finally {
      this.resumeStartAdBusy = false;
    }
  }

  private createStartChoiceInlineText(text: string, fill: number, fontSize: number): PIXI.Text {
    const node = new PIXI.Text(text, {
      fontSize,
      fill,
      fontWeight: '900',
      stroke: 0xfff4cf,
      strokeThickness: 3,
      lineJoin: 'round',
    });
    node.anchor.set(0, 0.5);
    node.resolution = 2;
    return node;
  }

  private layoutCenteredInlineRow(row: PIXI.Container, nodes: PIXI.Text[], gap: number): void {
    let totalW = Math.max(0, (nodes.length - 1) * gap);
    for (const node of nodes) {
      totalW += node.width;
    }
    let x = -totalW / 2;
    for (const node of nodes) {
      node.position.set(x, 0);
      row.addChild(node);
      x += node.width + gap;
    }
  }

  private startRound(initialScore = 0, source: FruitSliceStartChoiceSource = 'entry'): void {
    const normalizedInitialScore = Number.isFinite(initialScore) ? Math.max(0, Math.floor(initialScore)) : 0;
    this.dismissGoalCelebration(true);
    this.clearRound();
    this.resetFruitSpawnBounds();
    this.score = normalizedInitialScore;
    this.lastCoinReward = null;
    this.combo = 0;
    this.lastComboAt = 0;
    this.nextMilestoneIndex = 0;
    while (
      this.nextMilestoneIndex < FRUIT_SLICE_MILESTONES.length
      && normalizedInitialScore >= FRUIT_SLICE_MILESTONES[this.nextMilestoneIndex]!
    ) {
      this.nextMilestoneIndex += 1;
    }
    this.currentStageIndex = getFruitSliceStageIndex(normalizedInitialScore);
    this.gameOver = false;
    this.reviveUsed = false;
    this.reviveAdBusy = false;
    this.resumeStartAdBusy = false;
    this.fruitToolUsesThisRound = { eliminate: 0, shuffle: 0 };
    this.roundStartTs = Date.now();
    this.roundStartSource = source;
    this.roundInitialScore = normalizedInitialScore;
    this.maxComboThisRound = 0;
    this.matchCountThisRound = 0;
    this.maxMilestoneThisRound = normalizedInitialScore;
    this.pipeBlockRemoved = false;
    this.pipeWoodBlockSprite.visible = true;
    this.pipeWoodBlockSprite2.visible = true;
    this.pipeBlockShade.visible = true;
    this.pipeBlockLabel.visible = true;
    this.layoutPipeProps();
    this.warningLine.alpha = 0;
    this.gridWarningLine.alpha = 0;
    this.warningPulseT = 0;
    this.warningOverflowT = 0;
    this.gridWarningPulseT = 0;
    this.gridWarningOverflowT = 0;
    this.gridWarningArmed = false;
    this.warningSfxCount = 0;
    this.warningSfxCooldown = 0;
    this.warningSfxActive = false;
    this.displayedScore = normalizedInitialScore;
    this.scoreLabelPulseT = 0;
    this.scoreLabelPulseDur = 0;
    this.scoreLabel.scale.set(1);
    this.bestScore = getFruitSliceBestScore();
    this.generateInitialFruits();
    this.updateHud();
    if (normalizedInitialScore <= 0) {
      this.startTutorialIfNeeded();
    }
    analytics.track('fruit_slice_start', {
      mode: 'fruit_slice',
      start_source: source,
      initial_score: normalizedInitialScore,
      best_score: this.bestScore,
    });
  }

  private resetFruitSpawnBounds(): void {
    this.fruitTopY = this.initialFruitTopY;
    this.fruitBottomY = this.initialFruitBottomY;
    this.redrawGridWarningLine();
  }

  private clearRound(): void {
    for (const node of this.fruits) {
      node.parent?.removeChild(node);
      node.destroy({ children: true });
    }
    this.fruits.length = 0;
    for (const entry of this.pipeStack) {
      entry.node.parent?.removeChild(entry.node);
      entry.node.destroy({ children: true });
    }
    this.pipeStack.length = 0;
    this.pendingPipeSlots = 0;
    this.effectLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.textEffectLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.hideToolHelpPanel();
    this.hideEndOverlay();
    this.hideTutorialOverlay();
  }

  private generateInitialFruits(): void {
    const W = Game.logicWidth;
    const rows = 8;
    const cols = 7;
    const padX = 34;
    const padY = 10;
    const cellW = (W - padX * 2) / Math.max(1, cols - 1);
    const cellH = (this.fruitBottomY - this.fruitTopY - padY * 2) / Math.max(1, rows - 1);
    const activeIds = getFruitSliceActiveFruitIds(this.score);
    let created = 0;
    const placed: FruitSliceNode[] = [];

    for (let r = 0; r < rows && created < FRUIT_SLICE_PHYSICS.fruitCount; r += 1) {
      for (let c = 0; c < cols && created < FRUIT_SLICE_PHYSICS.fruitCount; c += 1) {
        const fruitId = activeIds[Math.floor(Math.random() * activeIds.length)]!;
        const radius = this.getFruitRadius(fruitId);
        const baseY = this.fruitTopY + padY + r * cellH;
        const spot = this.findFruitGridSpot(c, r, cols, padX, cellW, W, baseY, radius, placed);
        if (!spot) {
          continue;
        }
        const node = this.createFruitNode(fruitId, radius);
        const { x, y } = spot;
        node.position.set(x, y);
        node.rotation = (Math.random() - 0.5) * 0.35;
        this.fruitLayer.addChild(node);
        this.fruits.push(node);
        placed.push(node);
        created += 1;
      }
    }
    this.refreshFruitDepth();
  }

  private createFruitNode(fruitId: FruitId, radius: number): FruitSliceNode {
    const fruit = FRUIT_MAP[fruitId];
    const wrap = new PIXI.Container() as FruitSliceNode;
    wrap.fruitId = fruitId;
    wrap.radius = radius;
    wrap.vx = 0;
    wrap.vy = 0;
    wrap.state = 'fixed';
    wrap.stableFrames = 0;
    wrap.releaseX = undefined;
    wrap.releaseY = undefined;
    const tex = TextureCache.get(fruitSliceWholeTextureKey(fruitId));
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const s = this.getFruitSpriteScale(fruitId, radius, tex);
      sp.scale.set(s);
      wrap.addChild(sp);
    } else {
      const g = new PIXI.Graphics();
      g.beginFill(fruit?.color ?? 0xffcc66);
      g.drawCircle(0, 0, radius);
      g.endFill();
      wrap.addChild(g);
    }
    wrap.eventMode = 'static';
    wrap.cursor = 'pointer';
    wrap.hitArea = new PIXI.Circle(0, 0, radius * 1.12);
    wrap.on('pointertap', () => this.onFruitTap(wrap));
    return wrap;
  }

  private onFruitTap(node: FruitSliceNode): void {
    if (this.gameOver || node.state === 'enteringPipe' || node.state === 'pipe') {
      return;
    }
    if (this.isTutorialActive()) {
      this.handleTutorialFruitTap(node);
      return;
    }
    Haptics.light();
    AudioManager.playScoopSound();
    node.releaseX = node.x;
    node.releaseY = node.y;
    this.releaseFruit(node, (Math.random() - 0.5) * 70);
  }

  private isTutorialActive(): boolean {
    return this.tutorialStep !== 'idle' && this.tutorialStep !== 'done';
  }

  private handleTutorialFruitTap(node: FruitSliceNode): void {
    if (node !== this.tutorialTarget || (this.tutorialStep !== 'first' && this.tutorialStep !== 'second')) {
      this.pulseTutorialTarget();
      return;
    }
    Haptics.light();
    AudioManager.playScoopSound();
    node.releaseX = node.x;
    node.releaseY = node.y;
    this.releaseFruit(node, (Math.random() - 0.5) * 70);
    if (this.tutorialStep === 'first') {
      this.tutorialStep = 'second';
      this.tutorialTarget = this.tutorialTargets[1] ?? null;
      this.scheduleTutorial(() => {
        if (this.tutorialStep === 'second' && this.tutorialTarget) {
          this.showTutorialFruitStep(this.tutorialTarget, '再点一个相同水果，落到通道顶部就会消除');
        }
      }, 420);
      return;
    }
    this.tutorialStep = 'waitingMatch';
    this.tutorialTarget = null;
    this.showTutorialMessage('相同水果相遇后会消除，不同水果会留在通道里');
  }

  private startTutorialIfNeeded(): void {
    if (this.isTutorialActive() || this.tutorialStep === 'done') {
      return;
    }
    if (isFruitSliceTutorialDone()) {
      return;
    }
    const pair = this.findTutorialPair();
    if (!pair) {
      return;
    }
    this.tutorialTargets = pair;
    this.tutorialStep = 'first';
    this.tutorialTarget = pair[0];
    this.showTutorialFruitStep(pair[0], '先点最下面的水果，让它滚到下方通道里');
  }

  private findTutorialPair(): [FruitSliceNode, FruitSliceNode] | null {
    const fixedFruits = this.fruits
      .filter((node) => node.state === 'fixed')
      .sort((a, b) => b.y - a.y);
    if (fixedFruits.length < 2) {
      return null;
    }

    const bottomY = fixedFruits[0]!.y;
    const bottomRow = fixedFruits.filter((node) => node.y >= bottomY - 86);
    const pairInBottomRow = this.findSameFruitPair(bottomRow);
    if (pairInBottomRow) {
      return pairInBottomRow;
    }

    const nearbyPair = this.findSameFruitPair(fixedFruits.slice(0, Math.min(14, fixedFruits.length)));
    if (nearbyPair) {
      return nearbyPair;
    }

    const fallback: [FruitSliceNode, FruitSliceNode] = [fixedFruits[0]!, fixedFruits[1]!];
    this.setFruitNodeId(fallback[1], fallback[0].fruitId);
    return fallback;
  }

  private findSameFruitPair(nodes: FruitSliceNode[]): [FruitSliceNode, FruitSliceNode] | null {
    const groups = new Map<FruitId, FruitSliceNode[]>();
    for (const node of nodes) {
      const group = groups.get(node.fruitId) || [];
      group.push(node);
      groups.set(node.fruitId, group);
    }
    const candidates = [...groups.values()]
      .filter((group) => group.length >= 2)
      .map((group) => group.sort((a, b) => b.y - a.y).slice(0, 2) as [FruitSliceNode, FruitSliceNode])
      .sort((a, b) => b[0].y + b[1].y - (a[0].y + a[1].y));
    return candidates[0] || null;
  }

  private setFruitNodeId(node: FruitSliceNode, fruitId: FruitId): void {
    node.fruitId = fruitId;
    const tex = TextureCache.get(fruitSliceWholeTextureKey(fruitId));
    if (!tex) {
      return;
    }
    const existingSprite = node.children.find((child): child is PIXI.Sprite => child instanceof PIXI.Sprite);
    if (existingSprite) {
      existingSprite.texture = tex;
      existingSprite.scale.set(this.getFruitSpriteScale(fruitId, node.radius, tex));
      return;
    }
    node.removeChildren().forEach((child) => child.destroy({ children: true }));
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    sp.scale.set(this.getFruitSpriteScale(fruitId, node.radius, tex));
    node.addChild(sp);
  }

  private setFruitNodeVisual(node: FruitSliceNode, fruitId: FruitId): void {
    node.radius = this.getFruitRadius(fruitId);
    this.setFruitNodeId(node, fruitId);
    node.hitArea = new PIXI.Circle(0, 0, node.radius * 1.12);
  }

  private ensureTutorialOverlay(): void {
    this.tutorialGuideOverlay.setHandTexture(TextureCache.get('fruit_slice_ui_tutorial_hand'));
    this.tutorialGuideOverlay.show();
  }

  private showTutorialFruitStep(target: FruitSliceNode, message: string): void {
    if (target.destroyed || !target.parent) {
      return;
    }
    this.tutorialTarget = target;
    this.tutorialGuideOverlay.setCaption(message);
    this.tutorialGuideOverlay.setHandFacing('down');
    this.tutorialGuideOverlay.enableTapCatcher(null);
    this.tutorialGuideOverlay.setHighlight({
      kind: 'circle',
      cx: target.x,
      cy: target.y,
      r: target.radius + 14,
    });
    this.ensureTutorialOverlay();
  }

  private showTutorialMessage(message: string, x = Game.logicWidth / 2, y = Game.logicHeight * 0.45): void {
    const safeX = Math.min(Game.logicWidth - 180, Math.max(180, x));
    const safeY = Math.min(Game.logicHeight - 120, Math.max(120, y));
    this.tutorialGuideOverlay.setCaption(message);
    this.tutorialGuideOverlay.setHandFacing(safeY < Game.logicHeight * 0.34 ? 'up' : 'down');
    this.tutorialGuideOverlay.enableTapCatcher(null);
    this.tutorialGuideOverlay.setHighlight({
      kind: 'rect',
      cx: safeX,
      cy: safeY,
      w: Math.min(360, Game.logicWidth - 92),
      h: 86,
      cornerR: 30,
    });
    this.ensureTutorialOverlay();
  }

  private drawTutorialRing(x: number, y: number, radius: number): void {
    this.tutorialGuideOverlay.setHighlight({ kind: 'circle', cx: x, cy: y, r: radius });
  }

  private pulseTutorialTarget(): void {
    const target = this.tutorialTarget;
    if (!target) {
      return;
    }
    this.showTutorialFruitStep(target, this.tutorialStep === 'second'
      ? '请点击高亮的相同水果'
      : '先点击高亮的底部水果');
  }

  private hideTutorialHand(): void {
    this.tutorialGuideOverlay.setCaption('');
  }

  private onTutorialScoreAdded(): void {
    if (this.tutorialStep !== 'waitingMatch') {
      return;
    }
    this.tutorialStep = 'score';
    this.tutorialTarget = null;
    this.hideTutorialHand();
    this.showTutorialScoreStep('消除会获得分数，连击更高，已解锁图鉴的水果还有图鉴加成');
    this.scheduleTutorial(() => {
      if (this.tutorialStep !== 'score') {
        return;
      }
      this.showTutorialMessage('水果堆到红色警戒线就会失败，尽量连续消除冲高分', Game.logicWidth / 2, this.gridWarningLineY());
    }, 2400);
    this.scheduleTutorial(() => this.completeTutorial(), 5000);
  }

  private showTutorialScoreStep(message: string): void {
    const scoreGlobal = this.scoreLabel.parent
      ? this.scoreLabel.parent.toGlobal(this.scoreLabel.position)
      : new PIXI.Point(Game.logicWidth * 0.28, Game.safeTop + 100);
    const scoreLocal = this.overlayLayer.toLocal(scoreGlobal);
    this.showTutorialMessage(message, scoreLocal.x, scoreLocal.y);
  }

  private completeTutorial(): void {
    if (this.tutorialStep === 'done' || this.tutorialStep === 'idle') {
      return;
    }
    markFruitSliceTutorialDone();
    this.tutorialStep = 'done';
    this.tutorialTargets = [];
    this.tutorialTarget = null;
    this.hideTutorialOverlay();
  }

  private scheduleTutorial(callback: () => void, delayMs: number): void {
    const timer = setTimeout(() => {
      const index = this.tutorialTimers.indexOf(timer);
      if (index >= 0) {
        this.tutorialTimers.splice(index, 1);
      }
      callback();
    }, delayMs);
    this.tutorialTimers.push(timer);
  }

  private clearTutorialTimers(): void {
    while (this.tutorialTimers.length > 0) {
      const timer = this.tutorialTimers.pop();
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  private hideTutorialOverlay(): void {
    this.clearTutorialTimers();
    this.tutorialGuideOverlay.hide();
    this.tutorialTargets = [];
    this.tutorialTarget = null;
    if (this.tutorialStep !== 'done') {
      this.tutorialStep = 'idle';
    }
  }

  private releaseFruit(node: FruitSliceNode, vx = 0): void {
    node.state = 'falling';
    node.vx = vx;
    node.vy = Math.max(node.vy, 80);
    node.stableFrames = 0;
    node.eventMode = 'none';
    node.cursor = 'default';
    node.zIndex = 100000 + Math.round(node.y);
  }

  private updateFallingFruit(node: FruitSliceNode, dt: number): void {
    node.vy = Math.min(FRUIT_SLICE_PHYSICS.maxFallSpeed, node.vy + FRUIT_SLICE_PHYSICS.gravity * dt);
    node.x += node.vx * dt;
    node.y += node.vy * dt;
    node.rotation += (node.vx * 0.001 + 0.9) * dt;

    const minX = WALL_PADDING + node.radius;
    const maxX = Game.logicWidth - WALL_PADDING - node.radius;
    if (node.x < minX) {
      node.x = minX;
      node.vx = Math.abs(node.vx) * FRUIT_SLICE_PHYSICS.bounce;
    } else if (node.x > maxX) {
      node.x = maxX;
      node.vx = -Math.abs(node.vx) * FRUIT_SLICE_PHYSICS.bounce;
    }

    if (this.tryEnterPipe(node)) {
      return;
    }

    if (this.resolveFruitCollisions(node)) {
      this.settleFruit(node);
      return;
    }

    if (this.resolveBoardRoll(node, dt)) {
      return;
    }

    const geometry = this.boardGeometry;
    const fallThroughY = geometry ? geometry.surfaceInnerY + node.radius * 2 : this.cliffBottomY + 80;
    if (node.y + node.radius >= fallThroughY) {
      node.y = this.boardSurfaceYAt(node.x) ?? ((geometry?.surfaceInnerY ?? this.cliffTopY) - node.radius);
      this.releaseFruit(node, node.x < this.pipeStackCenterX() ? BOARD_ROLL_MAX_SPEED : -BOARD_ROLL_MAX_SPEED);
    }
  }

  private resolveBoardRoll(node: FruitSliceNode, dt: number): boolean {
    const surfaceY = this.boardSurfaceYAt(node.x);
    if (surfaceY === null || node.y + node.radius < surfaceY) {
      return false;
    }
    const centerX = this.pipeStackCenterX();
    const dir = node.x < centerX ? 1 : -1;
    node.y = surfaceY - node.radius;
    node.vy = Math.max(0, Math.min(90, node.vy * FRUIT_SLICE_PHYSICS.bounce));
    node.vx = Math.max(
      -BOARD_ROLL_MAX_SPEED,
      Math.min(BOARD_ROLL_MAX_SPEED, node.vx + dir * BOARD_ROLL_ACCEL * dt),
    );
    node.rotation += dir * Math.max(0.06, Math.abs(node.vx) * 0.003) * dt * 60;
    return true;
  }

  private resolveFruitCollisions(node: FruitSliceNode): boolean {
    let supported = false;
    // 直接 for 遍历 + 过滤，避免每帧每颗 falling 水果分配一份 blockers 数组。
    for (let i = 0; i < this.fruits.length; i += 1) {
      const other = this.fruits[i]!;
      if (other === node) continue;
      if (other.state !== 'fixed' && other.state !== 'settled') continue;
      const dx = node.x - other.x;
      const dy = node.y - other.y;
      const minDist = node.radius + other.radius - 4;
      const distSq = dx * dx + dy * dy;
      if (distSq <= 0 || distSq >= minDist * minDist) {
        continue;
      }
      const dist = Math.sqrt(distSq);
      const overlap = minDist - dist;
      const nx = dx / dist;
      const ny = dy / dist;
      node.x += nx * overlap;
      node.y += ny * overlap;
      const centerOffsetLimit = Math.min(node.radius, other.radius) * FRUIT_SUPPORT_MAX_CENTER_OFFSET;
      const hasStableSupport =
        node.y < other.y
        && Math.abs(dx) <= centerOffsetLimit
        && ny <= -FRUIT_SUPPORT_MIN_NORMAL_Y;
      if (hasStableSupport) {
        supported = true;
        node.vx *= 0.35;
        node.vy = -Math.abs(node.vy) * FRUIT_SLICE_PHYSICS.bounce;
      } else {
        node.vx += nx * 92;
        if (node.y < other.y) {
          node.vy = Math.max(node.vy, 160);
        }
      }
    }
    return supported;
  }

  private tryEnterPipe(node: FruitSliceNode): boolean {
    const geometry = this.boardGeometry;
    if (!geometry) {
      return false;
    }
    const enterPad = node.radius * 0.35;
    const withinGap = node.x > geometry.leftInnerX - enterPad && node.x < geometry.rightInnerX + enterPad;
    if (!withinGap || node.y + node.radius < geometry.surfaceInnerY - node.radius * 0.25) {
      return false;
    }
    this.animateFruitIntoPipe(node, () => {
      this.onFruitLandedInPipe(node, node.fruitId);
    });
    return true;
  }

  private settleFruit(node: FruitSliceNode): void {
    node.state = 'settled';
    node.vx = 0;
    node.vy = 0;
    node.stableFrames += 1;
    node.eventMode = 'static';
    node.cursor = 'pointer';
    node.zIndex = Math.round(node.y);
  }

  private animateFruitIntoPipe(node: FruitSliceNode, done: () => void): void {
    node.state = 'enteringPipe';
    node.eventMode = 'none';
    node.cursor = 'default';
    const idx = this.fruits.indexOf(node);
    if (idx >= 0) {
      this.fruits.splice(idx, 1);
    }
    const startX = node.x;
    const startY = node.y;
    const slotIndex = this.pipeStack.length + this.pendingPipeSlots;
    this.pendingPipeSlots += 1;
    const slot = this.pipeSlot(slotIndex, node);
    node.__pipeSlot = slot;
    const targetX = slot.x;
    const targetY = slot.y;
    const startRot = node.rotation;
    let elapsed = 0;
    const duration = 0.26;
    node.zIndex = 200000;
    const tick = (): void => {
      elapsed += Game.ticker.deltaMS / 1000;
      const p = Math.min(elapsed / duration, 1);
      const e = 1 - (1 - p) * (1 - p);
      node.x = startX + (targetX - startX) * e;
      node.y = startY + (targetY - startY) * e + Math.sin(p * Math.PI) * 18;
      node.rotation = startRot + (slot.rotation - startRot) * e + Math.sin(p * Math.PI) * 0.32;
      if (p >= 1) {
        this.removeTransientTicker(tick);
        this.pendingPipeSlots = Math.max(0, this.pendingPipeSlots - 1);
        done();
      }
    };
    this.addTransientTicker(tick);
  }

  private onFruitLandedInPipe(node: FruitSliceNode, fruitId: FruitId): void {
    node.parent?.removeChild(node);
    const top = this.pipeStack.length > 0 ? this.pipeStack[this.pipeStack.length - 1] : null;
    if (top && top.fruitId === fruitId) {
      this.pipeStack.pop();
      top.node.parent?.removeChild(top.node);
      this.spawnSliceBurst(fruitId, this.pipeStackCenterX(), this.pipeStackY(this.pipeStack.length));
      top.node.destroy({ children: true });
      node.destroy({ children: true });
      this.addScore(fruitId);
      AudioManager.playOrderCompleteSound();
      this.refillIfNeeded();
      this.updateHud();
      return;
    }

    this.pipeStackLayer.addChild(node);
    node.state = 'pipe';
    const stackIndex = this.pipeStack.length;
    const slot = this.pipeSlot(stackIndex, node);
    node.position.set(slot.x, slot.y);
    node.rotation = slot.rotation;
    node.__pipeSlot = slot;
    node.zIndex = 10000 + stackIndex;
    this.pipeStack.push({ node, fruitId });
    this.updateHud();
    if (this.pipeStack.length >= FRUIT_SLICE_PHYSICS.pipeCapacity) {
      this.finishRound('pipe_capacity');
    } else {
      this.refillIfNeeded();
    }
  }

  private addScore(fruitId: FruitId): void {
    const now = Date.now();
    if (now - this.lastComboAt <= FRUIT_SLICE_COMBO_WINDOW_MS) {
      this.combo += 1;
    } else {
      this.combo = 1;
    }
    this.lastComboAt = now;
    this.matchCountThisRound += 1;
    this.maxComboThisRound = Math.max(this.maxComboThisRound, this.combo);
    const unlocked = getUnlockedFruitIds().has(fruitId);
    const comboBonus = Math.min(
      FRUIT_SLICE_COMBO_BONUS_MAX,
      Math.max(0, this.combo - 1) * FRUIT_SLICE_COMBO_BONUS_STEP,
    );
    const gain = FRUIT_SLICE_BASE_SCORE
      + (unlocked ? FRUIT_SLICE_UNLOCKED_BONUS : 0)
      + getFruitSliceStageBonus(fruitId, this.score)
      + comboBonus;
    this.score += gain;
    const popupX = this.pipeStackCenterX();
    const popupY = this.pipeStackY(Math.max(0, this.pipeStack.length)) - 38;
    this.spawnScoreGain(gain, popupX, popupY, unlocked);
    if (this.combo >= 2) {
      const comboX = Math.min(Game.logicWidth - 130, popupX + 142);
      this.spawnComboBanner(this.combo, comboX, popupY - 66);
    }
    this.checkStageChange();
    this.checkMilestones();
    this.onTutorialScoreAdded();
  }

  private checkStageChange(): void {
    const nextStage = getFruitSliceStageIndex(this.score);
    if (nextStage > this.currentStageIndex) {
      const prevIndex = this.currentStageIndex;
      this.currentStageIndex = nextStage;
      const stage = FRUIT_SLICE_STAGES[nextStage]!;
      const prevUnion = new Set(
        FRUIT_SLICE_STAGES.slice(0, prevIndex + 1).flatMap((s) => s.fruitIds),
      );
      const newFruitIds = stage.fruitIds.filter((id) => !prevUnion.has(id));
      this.enqueueGoalCelebration({ kind: 'newFruits', stageLabel: stage.label, fruitIds: newFruitIds });
      this.refillIfNeeded(true);
    }
  }

  private checkMilestones(): void {
    while (
      this.nextMilestoneIndex < FRUIT_SLICE_MILESTONES.length
      && this.score >= FRUIT_SLICE_MILESTONES[this.nextMilestoneIndex]!
    ) {
      const milestone = FRUIT_SLICE_MILESTONES[this.nextMilestoneIndex]!;
      this.nextMilestoneIndex += 1;
      this.maxMilestoneThisRound = Math.max(this.maxMilestoneThisRound, milestone);
      analytics.track('fruit_slice_milestone', {
        mode: 'fruit_slice',
        milestone_score: milestone,
        score: this.score,
        duration_ms: this.roundStartTs > 0 ? Date.now() - this.roundStartTs : 0,
      });
      this.enqueueGoalCelebration({ kind: 'milestone', points: milestone });
      AudioManager.playBadgeUnlockSound();
    }
  }

  private refillIfNeeded(force = false): void {
    const activeCount = this.fruits.filter((node) => node.state === 'fixed' || node.state === 'settled').length;
    if (!force && activeCount > FRUIT_SLICE_PHYSICS.fruitCount * 0.72) {
      return;
    }
    const shouldForceDrop = activeCount < REFILL_MIN_ACTIVE_FRUITS;
    const rowsCompacted = this.compactFruitsDownByRows(shouldForceDrop ? 1 : 0);
    if (rowsCompacted > 0) {
      this.gridWarningArmed = true;
    }
    const W = Game.logicWidth;
    const cols = 7;
    const padX = 34;
    const cellW = (W - padX * 2) / Math.max(1, cols - 1);
    const rowStep = this.gridRowStep();

    let topMostY = Infinity;
    for (const node of this.fruits) {
      if (node.state !== 'fixed' && node.state !== 'settled') {
        continue;
      }
      const y = node.__slideTo ?? node.y;
      if (y < topMostY) {
        topMostY = y;
      }
    }
    if (!Number.isFinite(topMostY)) {
      topMostY = this.fruitBottomY;
    }

    const remainingCapacity = Math.max(0, FRUIT_SLICE_PHYSICS.fruitCount - this.fruits.length);
    const lowStockNeed = shouldForceDrop
      ? REFILL_MIN_ACTIVE_FRUITS - activeCount
      : 0;
    let need = force
      ? Math.min(remainingCapacity, Math.max(rowsCompacted, 1) * cols)
      : Math.min(remainingCapacity, Math.max(rowsCompacted * cols, lowStockNeed));
    if (need <= 0) {
      return;
    }

    const activeIds = getFruitSliceActiveFruitIds(this.score);
    let placed = 0;
    const placedNodes: FruitSliceNode[] = [];
    let row = 0;
    while (placed < need && row < 12) {
      const yBase = lowStockNeed > 0 && rowsCompacted === 0
        ? this.fruitTopY + 12 + row * rowStep
        : topMostY - (row + 1) * rowStep;
      if (yBase < this.fruitTopY - rowStep * 0.4 || yBase > this.fruitBottomY - rowStep * 0.35) {
        break;
      }
      const rowStaggerSign = row % 2 === 0 ? 1 : -1;
      for (let c = 0; c < cols && placed < need; c += 1) {
        const fruitId = activeIds[Math.floor(Math.random() * activeIds.length)]!;
        const radius = this.getFruitRadius(fruitId);
        const baseY = yBase + rowStaggerSign * (c % 2 === 0 ? 0 : 6);
        const spot = this.findFruitGridSpot(c, row, cols, padX, cellW, W, baseY, radius, placedNodes);
        if (!spot) {
          continue;
        }
        const node = this.createFruitNode(fruitId, radius);
        const { x, y } = spot;
        node.position.set(x, y);
        node.rotation = (Math.random() - 0.5) * 0.5;
        this.fruitLayer.addChild(node);
        this.fruits.push(node);
        placedNodes.push(node);
        placed += 1;
      }
      row += 1;
    }
    this.refreshFruitDepth();
  }

  private getFruitRadius(fruitId: FruitId): number {
    const cached = this.fruitRadiusById.get(fruitId);
    if (cached !== undefined) {
      return cached;
    }
    let hash = 0;
    for (let i = 0; i < fruitId.length; i += 1) {
      hash = (hash * 31 + fruitId.charCodeAt(i)) >>> 0;
    }
    const span = FRUIT_SLICE_PHYSICS.maxRadius - FRUIT_SLICE_PHYSICS.minRadius;
    const radius = FRUIT_SLICE_PHYSICS.minRadius + (hash % Math.max(1, span + 1));
    this.fruitRadiusById.set(fruitId, radius);
    return radius;
  }

  private getFruitSpriteScale(fruitId: FruitId, radius: number, tex: PIXI.Texture): number {
    const base = (radius * 2) / Math.max(tex.width, tex.height);
    return base * (FRUIT_SLICE_VISUAL_SCALE[fruitId] ?? 1);
  }

  private finishRound(failReason: FruitSliceFailReason): void {
    if (this.gameOver) {
      return;
    }
    this.dismissGoalCelebration(true);
    this.gameOver = true;
    this.displayedScore = this.score;
    this.updateHud();
    if (!this.reviveUsed) {
      this.showReviveChoiceOverlay();
      return;
    }
    this.showFinalEndOverlay(false, failReason);
  }

  private showFinalEndOverlay(markReviveUnavailable = false, failReason: FruitSliceFailReason = 'pipe_capacity'): void {
    if (markReviveUnavailable) {
      this.reviveUsed = true;
      failReason = 'abandon_revive';
    }
    this.lastCoinReward = settleFruitSliceCoinReward(this.score);
    const isNewBest = this.score > 0 ? recordFruitSliceRun(this.score) : false;
    this.bestScore = getFruitSliceBestScore();
    this.updateHud();
    analytics.track('fruit_slice_end', {
      mode: 'fruit_slice',
      score: this.score,
      duration_ms: this.roundStartTs > 0 ? Date.now() - this.roundStartTs : 0,
      fail_reason: failReason,
      start_source: this.roundStartSource,
      initial_score: this.roundInitialScore,
      match_count: this.matchCountThisRound,
      max_combo: this.maxComboThisRound,
      revive_used: this.reviveUsed,
      eliminate_tool_count: this.fruitToolUsesThisRound.eliminate,
      shuffle_tool_count: this.fruitToolUsesThisRound.shuffle,
      max_milestone_score: this.maxMilestoneThisRound,
      coin_reward: this.lastCoinReward.totalCoins,
      is_new_best: isNewBest,
    });
    // 只有刷新最高分时才上报，避免无意义的 update；后端也会按"非更优记录"二次拦截
    submitFruitBestRankIfNeeded(isNewBest);
    if (this.lastCoinReward.totalCoins > 0) {
      this.showCoinRewardOverlay(this.lastCoinReward, isNewBest);
      return;
    }
    this.showEndOverlay(isNewBest);
  }

  private showReviveChoiceOverlay(): void {
    this.hideEndOverlay();
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const root = new PIXI.Container();
    const dim = new PIXI.Graphics();
    dim.beginFill(0x10202a, 0.58);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    root.addChild(dim);

    const panelTex = TextureCache.get('fruit_slice_ui_revive_panel');
    let panelW = 400;
    let panelH = 300;
    let panelScale = 1;
    if (panelTex) {
      const panel = new PIXI.Sprite(panelTex);
      panel.anchor.set(0.5);
      const targetW = Math.min(W * 0.82, 470);
      const targetH = H * 0.42;
      const s = Math.min(targetW / panelTex.width, targetH / panelTex.height);
      panel.scale.set(s);
      panel.position.set(W / 2, H / 2);
      root.addChild(panel);
      panelW = panelTex.width;
      panelH = panelTex.height;
      panelScale = s;
    } else {
      const panel = new PIXI.Graphics();
      panel.beginFill(0xfff4cf, 0.98);
      panel.lineStyle(4, 0x8d5a2b, 1);
      panel.drawRoundedRect(-200, -150, 400, 300, 28);
      panel.endFill();
      panel.position.set(W / 2, H / 2);
      root.addChild(panel);
    }

    const scoreTitle = new PIXI.Text(`本局分数  ${this.score}`, {
      fontSize: 34,
      fill: 0x6a3a18,
      fontWeight: '900',
      stroke: 0xfff4d0,
      strokeThickness: 4,
      lineJoin: 'round',
    });
    scoreTitle.anchor.set(0.5);
    scoreTitle.position.set(W / 2, H / 2 - 54);
    root.addChild(scoreTitle);

    const coinHint = new PIXI.Text(this.getFruitSliceCoinProgressHint(this.score), {
      fontSize: 25,
      fill: 0xff8a1f,
      fontWeight: '900',
      stroke: 0xfff6df,
      strokeThickness: 4,
      lineJoin: 'round',
      align: 'center',
      wordWrap: true,
      wordWrapWidth: Math.min(360, W * 0.72),
    });
    coinHint.anchor.set(0.5);
    coinHint.position.set(W / 2, H / 2 - 2);
    root.addChild(coinHint);

    const panelPoint = (xRatio: number, yRatio: number) => ({
      x: W / 2 + (xRatio - 0.5) * panelW * panelScale,
      y: H / 2 + (yRatio - 0.5) * panelH * panelScale,
    });
    const panelSize = (wRatio: number, hRatio: number) => ({
      w: panelW * panelScale * wRatio,
      h: panelH * panelScale * hRatio,
    });
    const reviveHit = panelPoint(REVIVE_PANEL_HIT_LAYOUT.revive.xRatio, REVIVE_PANEL_HIT_LAYOUT.revive.yRatio);
    const reviveSize = panelSize(REVIVE_PANEL_HIT_LAYOUT.revive.wRatio, REVIVE_PANEL_HIT_LAYOUT.revive.hRatio);
    const abandonHit = panelPoint(REVIVE_PANEL_HIT_LAYOUT.abandon.xRatio, REVIVE_PANEL_HIT_LAYOUT.abandon.yRatio);
    const abandonSize = panelSize(REVIVE_PANEL_HIT_LAYOUT.abandon.wRatio, REVIVE_PANEL_HIT_LAYOUT.abandon.hRatio);

    root.addChild(this.createOverlayHitButton(reviveHit.x, reviveHit.y, reviveSize.w, reviveSize.h, () => {
      AudioManager.playButtonSound();
      void this.reviveFromFailByAd();
    }));
    root.addChild(this.createOverlayHitButton(abandonHit.x, abandonHit.y, abandonSize.w, abandonSize.h, () => {
      AudioManager.playButtonSound();
      this.showFinalEndOverlay(true);
    }));

    this.overlayLayer.addChild(root);
    this.endOverlay = root;
  }

  private showEndOverlay(isNewBest: boolean): void {
    this.hideEndOverlay();
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const root = new PIXI.Container();
    const dim = new PIXI.Graphics();
    dim.beginFill(0x10202a, 0.58);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    root.addChild(dim);
    const panelTex = TextureCache.get(isNewBest ? 'fruit_slice_ui_new_record_panel' : 'fruit_slice_ui_fail_panel');
    if (panelTex) {
      const panel = new PIXI.Sprite(panelTex);
      panel.anchor.set(0.5);
      const targetW = Math.min(W * 0.82, isNewBest ? 520 : 470);
      const targetH = isNewBest ? H * 0.48 : H * 0.42;
      const s = Math.min(targetW / panelTex.width, targetH / panelTex.height);
      panel.scale.set(s);
      panel.position.set(W / 2, H / 2);
      root.addChild(panel);
    } else {
      const panel = new PIXI.Graphics();
      panel.beginFill(0xfff4cf, 0.98);
      panel.lineStyle(4, 0x8d5a2b, 1);
      panel.drawRoundedRect(-200, -170, 400, 340, 28);
      panel.endFill();
      panel.position.set(W / 2, H / 2);
      root.addChild(panel);
    }

    if (isNewBest) {
      const score = new PIXI.Text(`获得 ${this.score} 分`, {
        fontSize: 32,
        fill: 0xa13b10,
        fontWeight: '900',
        align: 'center',
        stroke: 0xfff2c7,
        strokeThickness: 3,
        lineJoin: 'round',
      });
      score.anchor.set(0.5);
      score.position.set(W / 2, H / 2 - 20);
      root.addChild(score);
    } else {
      this.addFailScoreRows(root, W / 2, H / 2 - 36);
    }

    if (isNewBest) {
      root.addChild(this.createOverlayHitButton(W / 2 - 140, H / 2 + 112, 120, 62, () => {
        AudioManager.playButtonSound();
        SceneManager.switchTo('home');
      }));
      root.addChild(this.createOverlayHitButton(W / 2, H / 2 + 112, 120, 62, () => {
        AudioManager.playButtonSound();
        this.showStartChoiceOrStartRound('retry');
      }));
      root.addChild(this.createOverlayHitButton(W / 2 + 140, H / 2 + 112, 120, 62, () => {
        AudioManager.playButtonSound();
        if (!shareGame({
          title: '果切无尽新记录，来挑战你的眼力！',
          imageUrl: 'assets/images/fruit_slice_share_card.jpg',
          query: 'from=share&entry=fruit_slice_record',
        })) {
          this.spawnCenterBanner('请在微信中分享');
        }
      }));
    } else {
      const btnY = H / 2 + 116;
      root.addChild(this.createOverlayHitButton(W / 2 - 104, btnY, 154, 60, () => {
        AudioManager.playButtonSound();
        SceneManager.switchTo('home');
      }));
      root.addChild(this.createOverlayHitButton(W / 2 + 104, btnY, 154, 60, () => {
        AudioManager.playButtonSound();
        this.showStartChoiceOrStartRound('retry');
      }));
    }
    root.addChild(this.createOverlayTextButton(W / 2, H / 2 + 178, 168, 50, '排行榜', () => {
      AudioManager.playButtonSound();
      this.hideEndOverlay();
      openLeaderboard(RANK_BOARD_FRUIT);
    }));
    this.overlayLayer.addChild(root);
    this.endOverlay = root;
  }

  private showCoinRewardOverlay(reward: FruitSliceCoinRewardResult, isNewBest: boolean): void {
    this.hideEndOverlay();
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const centerX = W / 2;
    const centerY = H * 0.42;

    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(0, 0, W, H);

    const dim = new PIXI.Graphics();
    dim.beginFill(0x06121b, 0.74);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    dim.eventMode = 'static';
    root.addChild(dim);

    const burstRoot = new PIXI.Container();
    burstRoot.position.set(centerX, centerY);
    root.addChild(burstRoot);

    const rays = this.buildRewardRays(20, 84, 220, 0xffe27a, 0.42);
    burstRoot.addChild(rays);
    const ringRays = this.buildRewardRays(14, 110, 178, 0xffffff, 0.22);
    ringRays.rotation = Math.PI / 14;
    burstRoot.addChild(ringRays);

    const sparkles = this.buildRewardSparkles(burstRoot);

    const title = new PIXI.Text('获得金币', {
      fontSize: 52,
      fill: 0xfff06a,
      fontWeight: '900',
      stroke: 0x6d2a10,
      strokeThickness: 9,
      dropShadow: true,
      dropShadowBlur: 4,
      dropShadowDistance: 3,
      dropShadowColor: 0x2c1208,
      lineJoin: 'round',
    });
    title.anchor.set(0.5);
    title.position.set(centerX, centerY - 200);
    title.resolution = 2;
    root.addChild(title);

    const coin = createCoinIcon(96);
    coin.position.set(centerX, centerY);
    root.addChild(coin);

    const amount = new PIXI.Text(`+${reward.totalCoins}`, {
      fontSize: 76,
      fill: 0xffd84a,
      fontWeight: '900',
      stroke: 0x6d2a10,
      strokeThickness: 10,
      dropShadow: true,
      dropShadowBlur: 4,
      dropShadowDistance: 3,
      dropShadowColor: 0x2c1208,
      lineJoin: 'round',
    });
    amount.anchor.set(0.5);
    amount.position.set(centerX, centerY + 138);
    amount.resolution = 2;
    root.addChild(amount);

    const detailLines: string[] = [];
    if (reward.firstRunCoins > 0) {
      detailLines.push(`每日首局挑战 +${reward.firstRunCoins}`);
    }
    if (reward.scoreCoins > 0) {
      detailLines.push(`达到${reward.scoreTierMinScore}积分奖励 +${reward.scoreCoins}`);
    }
    if (detailLines.length === 0) {
      detailLines.push('挑战奖励');
    }
    const detail = new PIXI.Text(detailLines.join('\n'), {
      fontSize: 24,
      fill: 0xfff1d0,
      fontWeight: '900',
      stroke: 0x3b2316,
      strokeThickness: 4,
      align: 'center',
      lineHeight: 34,
    });
    detail.anchor.set(0.5);
    detail.position.set(centerX, centerY + 210);
    detail.resolution = 2;
    root.addChild(detail);

    const closeHint = new PIXI.Text('点击任意处入账', {
      fontSize: 24,
      fill: 0xfdf1d4,
      fontWeight: '800',
      stroke: 0x3b2316,
      strokeThickness: 4,
    });
    closeHint.anchor.set(0.5);
    closeHint.position.set(centerX, H * 0.78);
    closeHint.resolution = 2;
    root.addChild(closeHint);

    let elapsed = 0;
    let closing = false;
    coin.scale.set(0);
    amount.alpha = 0;
    detail.alpha = 0;
    title.alpha = 0;
    title.y -= 16;
    const tick = (delta: number): void => {
      if (closing || root.destroyed) {
        this.removeTransientTicker(tick);
        return;
      }
      elapsed += delta / 60;
      const t = elapsed;
      rays.rotation += delta * 0.012;
      ringRays.rotation -= delta * 0.0065;
      const scale = Math.min(1, t * 4);
      const settle = 1 - Math.pow(1 - scale, 3);
      coin.scale.set(0.7 * settle + Math.sin(t * 4.6) * 0.05 * settle);
      coin.rotation = Math.sin(t * 3.6) * 0.06;
      const titleSettle = Math.min(1, Math.max(0, (t - 0.05) * 5));
      title.alpha = titleSettle;
      title.y = (centerY - 200) - 16 + titleSettle * 16;
      amount.alpha = Math.min(1, Math.max(0, (t - 0.18) * 6));
      detail.alpha = Math.min(1, Math.max(0, (t - 0.32) * 5));
      closeHint.alpha = 0.6 + Math.sin(t * 4.2) * 0.4;
      for (const sp of sparkles) {
        const pulse = (Math.sin(t * 5 + sp.phase) + 1) / 2;
        sp.node.alpha = (0.28 + pulse * 0.72) * Math.min(1, t * 4);
        sp.node.scale.set(0.65 + pulse * 0.55);
        sp.node.rotation += delta * 0.018;
      }
    };
    this.addTransientTicker(tick);

    root.on('pointertap', () => {
      if (closing) {
        return;
      }
      closing = true;
      Game.ticker.remove(tick);
      AudioManager.playButtonSound();
      title.visible = false;
      amount.visible = false;
      detail.visible = false;
      closeHint.visible = false;
      burstRoot.visible = false;
      coin.visible = false;
      this.playCoinDepositEffect(centerX, centerY, () => {
        this.hideEndOverlay();
        this.showEndOverlay(isNewBest);
      });
    });

    this.overlayLayer.addChild(root);
    this.endOverlay = root;
  }

  /** 金光放射线（参考 BowlBadgeUnlockOverlay 的视觉，颜色叠加到遮罩上）。 */
  private buildRewardRays(
    count: number,
    innerR: number,
    outerR: number,
    color: number,
    alpha: number,
  ): PIXI.Container {
    const root = new PIXI.Container();
    const g = new PIXI.Graphics();
    for (let i = 0; i < count; i += 1) {
      const a = (Math.PI * 2 * i) / count;
      const spread = i % 2 === 0 ? 0.06 : 0.036;
      const out = i % 2 === 0 ? outerR : outerR * 0.78;
      g.beginFill(color, i % 2 === 0 ? alpha : alpha * 0.6);
      g.moveTo(Math.cos(a - spread) * innerR, Math.sin(a - spread) * innerR);
      g.lineTo(Math.cos(a) * out, Math.sin(a) * out);
      g.lineTo(Math.cos(a + spread) * innerR, Math.sin(a + spread) * innerR);
      g.closePath();
      g.endFill();
    }
    g.blendMode = PIXI.BLEND_MODES.ADD;
    root.addChild(g);
    return root;
  }

  /** 围绕金币的闪烁小星，与放射线一起构成「获得新内容」的高光效果。 */
  private buildRewardSparkles(parent: PIXI.Container): Array<{ node: PIXI.Graphics; phase: number }> {
    const points = [
      [-150, -36, 0],
      [-110, 96, 0.8],
      [120, -86, 1.5],
      [144, 64, 2.2],
      [-30, -148, 2.8],
      [56, 138, 3.4],
    ] as const;
    const list: Array<{ node: PIXI.Graphics; phase: number }> = [];
    for (const [x, y, phase] of points) {
      const star = new PIXI.Graphics();
      star.beginFill(0xffffff, 0.95);
      star.moveTo(0, -10);
      star.lineTo(3.6, -3.6);
      star.lineTo(10, 0);
      star.lineTo(3.6, 3.6);
      star.lineTo(0, 10);
      star.lineTo(-3.6, 3.6);
      star.lineTo(-10, 0);
      star.lineTo(-3.6, -3.6);
      star.closePath();
      star.endFill();
      star.beginFill(0xfff0a2, 0.75);
      star.drawCircle(0, 0, 2.8);
      star.endFill();
      star.position.set(x, y);
      star.blendMode = PIXI.BLEND_MODES.ADD;
      parent.addChild(star);
      list.push({ node: star, phase });
    }
    return list;
  }


  private getFruitSliceCoinProgressHint(score: number): string {
    const current = fruitSliceCoinsForScore(score);
    const next = nextFruitSliceCoinTier(score);
    if (!current && next) {
      return `${next.minScore}分可得${next.coins}金币`;
    }
    if (current && next) {
      return `已得${current.coins}金币  ${next.minScore}分可得${next.coins}金币`;
    }
    if (current) {
      return `已得${current.coins}金币  最高档奖励到手`;
    }
    return '1000分起有金币奖励';
  }

  private playCoinDepositEffect(fromX: number, fromY: number, done: () => void): void {
    const targetX = this.coinBar.x + 4;
    const targetY = this.coinBar.y;
    const coin = createCoinIcon(28);
    coin.position.set(fromX, fromY);
    coin.scale.set(1.45);
    this.overlayLayer.addChild(coin);

    let elapsed = 0;
    const duration = 0.72;
    const tick = (): void => {
      if (coin.destroyed) {
        this.removeTransientTicker(tick);
        return;
      }
      elapsed += Game.ticker.deltaMS / 1000;
      const p = Math.min(elapsed / duration, 1);
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      coin.position.x = fromX + (targetX - fromX) * ease;
      coin.position.y = fromY + (targetY - fromY) * ease - Math.sin(p * Math.PI) * 90;
      coin.scale.set(1.45 - 0.75 * p);
      coin.rotation += 0.18;
      if (p >= 1) {
        this.removeTransientTicker(tick);
        coin.parent?.removeChild(coin);
        coin.destroy({ children: true });
        this.coinBar.refresh();
        this.coinBar.bump();
        this.spawnCenterBanner('金币已入账');
        const t = this.trackTimer(setTimeout(() => {
          this.finishTimer(t);
          done();
        }, 280));
      }
    };
    this.addTransientTicker(tick);
  }

  private createOverlayHitButton(
    x: number,
    y: number,
    w: number,
    h: number,
    onTap: () => void,
  ): PIXI.Container {
    const root = new PIXI.Container();
    root.position.set(x, y);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-w * 0.5, -h * 0.5, w, h);
    root.on('pointertap', onTap);
    return root;
  }

  private createOverlayTextButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onTap: () => void,
  ): PIXI.Container {
    const root = this.createOverlayHitButton(x, y, w, h, onTap);
    const bg = new PIXI.Graphics();
    bg.beginFill(0xff8a3d, 0.98);
    bg.lineStyle(3, 0xffffff, 0.75);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.endFill();
    root.addChild(bg);
    const text = new PIXI.Text(label, {
      fontSize: 23,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x8b3a12,
      strokeThickness: 3,
    });
    text.anchor.set(0.5);
    text.resolution = 2;
    root.addChild(text);
    return root;
  }

  private createOverlayImageTextButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onTap: () => void,
    showAdIcon = false,
  ): PIXI.Container {
    const tex = TextureCache.get(BOWL_COMMON_MODAL_BUTTON_TEXTURE_KEY);
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return this.createOverlayTextButton(x, y, w, h, label, onTap);
    }
    const root = this.createOverlayHitButton(x, y, w, h, onTap);
    const bg = new PIXI.Sprite(tex);
    bg.anchor.set(0.5);
    bg.width = w;
    bg.height = h;
    root.addChild(bg);
    if (showAdIcon) {
      const icon = this.createAdVideoIcon();
      icon.position.set(-w * 0.32, 0);
      root.addChild(icon);
    }
    const text = new PIXI.Text(label, {
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x8b3a12,
      strokeThickness: 4,
      lineJoin: 'round',
    });
    text.anchor.set(0.5);
    if (showAdIcon) {
      text.position.x = 18;
    }
    text.resolution = 2;
    root.addChild(text);
    return root;
  }

  private createAdVideoIcon(): PIXI.Container {
    const root = new PIXI.Container();
    const body = new PIXI.Graphics();
    body.beginFill(0xffffff, 0.94);
    body.lineStyle(3, 0x8b3a12, 0.92);
    body.drawRoundedRect(-16, -12, 25, 24, 5);
    body.endFill();
    body.beginFill(0xffb24a, 0.9);
    body.moveTo(12, -7);
    body.lineTo(24, -13);
    body.lineTo(24, 13);
    body.lineTo(12, 7);
    body.closePath();
    body.endFill();
    root.addChild(body);

    const play = new PIXI.Graphics();
    play.beginFill(0x8b3a12, 0.9);
    play.moveTo(-6, -6);
    play.lineTo(4, 0);
    play.lineTo(-6, 6);
    play.closePath();
    play.endFill();
    root.addChild(play);
    return root;
  }

  private addDisabledReviveMask(root: PIXI.Container, cx: number, cy: number): void {
    const mask = new PIXI.Graphics();
    mask.beginFill(0x2b271d, 0.56);
    mask.drawRoundedRect(-164, -36, 328, 72, 24);
    mask.endFill();
    mask.lineStyle(4, 0xffffff, 0.2);
    mask.moveTo(-124, 24);
    mask.lineTo(124, -24);
    mask.position.set(cx, cy);
    mask.eventMode = 'none';
    root.addChild(mask);
  }

  private addFailScoreRows(root: PIXI.Container, cx: number, cy: number): void {
    const best = Math.max(this.bestScore, this.score);
    const makeLabel = (text: string, x: number, y: number) => {
      const t = new PIXI.Text(text, {
        fontSize: 25,
        fill: 0x6a3a18,
        fontWeight: '900',
      });
      t.anchor.set(1, 0.5);
      t.position.set(x, y);
      root.addChild(t);
    };
    const makeValue = (text: string, x: number, y: number, color: number) => {
      const t = new PIXI.Text(text, {
        fontSize: 28,
        fill: color,
        fontWeight: '900',
        stroke: 0xfff4d0,
        strokeThickness: 3,
        lineJoin: 'round',
      });
      t.anchor.set(0, 0.5);
      t.position.set(x, y);
      root.addChild(t);
    };
    makeLabel('本局分数', cx - 12, cy - 20);
    makeValue(String(this.score), cx + 12, cy - 20, 0xe45a22);
    makeLabel('历史最高', cx - 12, cy + 26);
    makeValue(String(best), cx + 12, cy + 26, 0x2f8fdd);
  }

  private recordCurrentRunIfNeeded(): void {
    if (this.score <= 0) {
      return;
    }
    recordFruitSliceRun(this.score);
    this.bestScore = getFruitSliceBestScore();
  }

  private async reviveFromFailByAd(): Promise<void> {
    if (this.reviveUsed) {
      this.spawnCenterBanner('一局只能复活一次');
      return;
    }
    if (this.reviveAdBusy) {
      return;
    }
    this.reviveAdBusy = true;
    try {
      const result = await showRewardedAd({
        scene: 'fruit_slice_revive',
        extra: { score: this.score },
      }, FRUIT_SLICE_REWARDED_AD_UNIT_ID);
      if (result !== 'completed' && result !== 'unavailable') {
        this.spawnCenterBanner(result === 'skipped' ? '看完广告后才能复活' : '广告暂不可用');
        return;
      }
      analytics.track('fruit_slice_revive', {
        mode: 'fruit_slice',
        score: this.score,
        result,
      });
      this.reviveUsed = true;
      this.gameOver = false;
      this.warningLine.alpha = 0;
      this.gridWarningLine.alpha = 0;
      this.warningOverflowT = 0;
      this.gridWarningOverflowT = 0;
      this.hideEndOverlay();
      this.clearPipeStackForRevive();
      this.clearGridOverflowFruitsForRevive();
      this.updateHud();
      this.spawnCenterBanner('复活成功');
    } finally {
      this.reviveAdBusy = false;
    }
  }

  private clearPipeStackForRevive(): void {
    for (const entry of this.pipeStack) {
      this.spawnSliceBurst(entry.fruitId, entry.node.x, entry.node.y);
      entry.node.parent?.removeChild(entry.node);
      entry.node.destroy({ children: true });
    }
    this.pipeStack.length = 0;
  }

  private clearGridOverflowFruitsForRevive(): void {
    const lineY = this.gridWarningLineY();
    const overflowNodes = this.fruits.filter((node) => {
      if (node.state !== 'fixed' && node.state !== 'settled') {
        return false;
      }
      const currentBottom = node.y + node.radius;
      const projectedBottom = (node.__slideTo ?? node.y) + node.radius;
      return Math.max(currentBottom, projectedBottom) >= lineY;
    });

    if (overflowNodes.length === 0) {
      return;
    }

    for (const node of overflowNodes) {
      const idx = this.fruits.indexOf(node);
      if (idx >= 0) {
        this.fruits.splice(idx, 1);
      }
      this.spawnSliceBurst(node.fruitId, node.x, node.y);
      node.parent?.removeChild(node);
      node.destroy({ children: true });
    }
    this.refreshFruitDepth();
  }

  private hideEndOverlay(): void {
    if (!this.endOverlay) {
      return;
    }
    this.endOverlay.parent?.removeChild(this.endOverlay);
    this.endOverlay.destroy({ children: true });
    this.endOverlay = null;
  }

  private spawnSliceBurst(fruitId: FruitId, x: number, y: number): void {
    const fruitColor = FRUIT_MAP[fruitId]?.color ?? 0xffcc66;
    this.spawnShockwave(x, y, 0xffffff, 26, 136, 0.58);
    this.spawnShockwave(x, y, fruitColor, 18, 112, 0.74);
    this.spawnFlashDisk(x, y, 0xfff8c4, 62, 0.34);

    const keys = [fruitId, `${fruitId}__b2`];
    const pieceCount = 10;
    for (let i = 0; i < pieceCount; i += 1) {
      const tex = TextureCache.get(keys[i % keys.length]!);
      const piece = new PIXI.Container();
      if (tex) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const sizeBase = 42 + Math.random() * 18;
        const scale = sizeBase / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        piece.addChild(sp);
      } else {
        const g = new PIXI.Graphics();
        g.beginFill(fruitColor);
        g.drawCircle(0, 0, 14);
        g.endFill();
        piece.addChild(g);
      }
      piece.position.set(x, y);
      this.effectLayer.addChild(piece);
      const angle = -Math.PI / 2 + ((i / pieceCount) - 0.5) * Math.PI * 1.6 + (Math.random() - 0.5) * 0.35;
      const speed = 135 + Math.random() * 82;
      const dx = Math.cos(angle) * speed * 0.95;
      const dy = Math.sin(angle) * speed * 1.05 - 60;
      this.animateEffect(piece, dx, dy, 0.95 + Math.random() * 0.25, 0.18);
    }

    for (let i = 0; i < 18; i += 1) {
      const drop = new PIXI.Graphics();
      drop.beginFill(fruitColor, 0.9);
      const rx = 4 + Math.random() * 4;
      const ry = 7 + Math.random() * 5;
      drop.drawEllipse(0, 0, rx, ry);
      drop.endFill();
      drop.position.set(x, y);
      drop.rotation = Math.random() * Math.PI * 2;
      this.effectLayer.addChild(drop);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
      const speed = 105 + Math.random() * 105;
      this.animateEffect(drop, Math.cos(angle) * speed, Math.sin(angle) * speed - 40, 0.7 + Math.random() * 0.2, 0.32);
    }

    const slash = new PIXI.Graphics();
    slash.lineStyle(9, 0xffffff, 0.95);
    slash.moveTo(x - 78, y + 30);
    slash.lineTo(x + 84, y - 38);
    this.effectLayer.addChild(slash);
    this.animateEffect(slash, 0, -20, 0.42, 0);

    for (let i = 0; i < 8; i += 1) {
      const star = new PIXI.Graphics();
      const rad = 10 + Math.random() * 7;
      star.lineStyle(3, 0xffffaa, 1);
      star.moveTo(-rad, 0);
      star.lineTo(rad, 0);
      star.moveTo(0, -rad);
      star.lineTo(0, rad);
      const sx = x + (Math.random() - 0.5) * 140;
      const sy = y + (Math.random() - 0.5) * 104 - 10;
      star.position.set(sx, sy);
      star.rotation = Math.random() * Math.PI;
      this.effectLayer.addChild(star);
      this.animateEffect(star, 0, -12, 0.55 + Math.random() * 0.18, 0);
    }
  }

  /** 扩散环：从中心向外膨胀的圆环。 */
  private spawnShockwave(x: number, y: number, color: number, startRadius: number, endRadius: number, duration: number): void {
    const ring = new PIXI.Graphics();
    ring.lineStyle(4, color, 1);
    ring.drawCircle(0, 0, startRadius);
    ring.position.set(x, y);
    this.effectLayer.addChild(ring);
    let elapsed = 0;
    const tick = (): void => {
      elapsed += Game.ticker.deltaMS / 1000;
      const p = Math.min(1, elapsed / duration);
      const r = startRadius + (endRadius - startRadius) * p;
      ring.scale.set(r / Math.max(1, startRadius));
      ring.alpha = 1 - p;
      if (p >= 1) {
        this.removeTransientTicker(tick);
        ring.parent?.removeChild(ring);
        ring.destroy();
      }
    };
    this.addTransientTicker(tick);
  }

  /** 闪光圆盘：撞击瞬间一抹高亮。 */
  private spawnFlashDisk(x: number, y: number, color: number, radius: number, duration: number): void {
    const flash = new PIXI.Graphics();
    flash.beginFill(color, 1);
    flash.drawCircle(0, 0, radius);
    flash.endFill();
    flash.position.set(x, y);
    flash.blendMode = PIXI.BLEND_MODES.ADD;
    this.effectLayer.addChild(flash);
    let elapsed = 0;
    const tick = (): void => {
      elapsed += Game.ticker.deltaMS / 1000;
      const p = Math.min(1, elapsed / duration);
      flash.scale.set(1 + p * 0.7);
      flash.alpha = 1 - p;
      if (p >= 1) {
        this.removeTransientTicker(tick);
        flash.parent?.removeChild(flash);
        flash.destroy();
      }
    };
    this.addTransientTicker(tick);
  }

  /** 大号 +XX 偏侧弹出，副标变小；停留后飞向计分板，落点触发计分。 */
  private spawnScoreGain(gain: number, x: number, y: number, special: boolean): void {
    const root = new PIXI.Container();
    const scoreX = Math.min(Game.logicWidth - 138, Math.max(138, x + 150));
    const scoreY = y - 20;

    const glow = new PIXI.Graphics();
    glow.beginFill(0x21160f, 0.34);
    glow.drawRoundedRect(-86, -35, 172, special ? 78 : 62, 22);
    glow.endFill();
    root.addChild(glow);

    const main = new PIXI.Text(`+${gain}`, {
      fontSize: 58,
      fill: [0xffffff, 0xfff178, 0xff8a00],
      fontWeight: '900',
      stroke: 0x8b2107,
      strokeThickness: 9,
      lineJoin: 'round',
      dropShadow: true,
      dropShadowColor: 0x3a1202,
      dropShadowDistance: 4,
      dropShadowAlpha: 0.72,
      dropShadowAngle: Math.PI * 0.5,
    });
    main.anchor.set(0.5);
    main.position.set(0, special ? -10 : 0);
    root.addChild(main);

    if (special) {
      const badge = new PIXI.Container();
      const badgeBg = new PIXI.Graphics();
      badgeBg.beginFill(0x21160f, 0.68);
      badgeBg.drawRoundedRect(-54, -14, 108, 28, 14);
      badgeBg.endFill();
      badge.addChild(badgeBg);
      const bonus = new PIXI.Text('图鉴加成', {
        fontSize: 20,
        fill: 0xfff4c2,
        fontWeight: '900',
        stroke: 0x2b6a34,
        strokeThickness: 3,
        lineJoin: 'round',
      });
      bonus.anchor.set(0.5);
      badge.addChild(bonus);
      badge.position.set(20, 30);
      badge.rotation = -0.08;
      root.addChild(badge);
    }

    root.position.set(scoreX, scoreY);
    root.scale.set(0);
    this.textEffectLayer.addChild(root);

    const targetGlobal = this.scoreLabel.parent?.toGlobal(this.scoreLabel.position)
      ?? new PIXI.Point(0, 0);
    const targetLocal = this.textEffectLayer.toLocal(targetGlobal);

    const popDur = 0.42;
    const holdDur = 0.55;
    const flyDur = 0.6;
    const total = popDur + holdDur + flyDur;
    const peakY = scoreY - 34;
    let elapsed = 0;
    let scored = false;
    const tick = (): void => {
      if (root.destroyed) {
        this.removeTransientTicker(tick);
        if (!scored) {
          this.applyDisplayedScoreGain(gain);
        }
        return;
      }
      elapsed += Game.ticker.deltaMS / 1000;
      if (elapsed < popDur) {
        const p = elapsed / popDur;
        const s = p < 0.6 ? (p / 0.6) * 1.65 : 1.65 - ((p - 0.6) / 0.4) * 0.5;
        root.scale.set(s);
        root.alpha = Math.min(1, p * 2.8);
        root.position.set(scoreX, scoreY - 34 * (p * p));
        root.rotation = (1 - p) * -0.12;
      } else if (elapsed < popDur + holdDur) {
        const p = (elapsed - popDur) / holdDur;
        root.scale.set(1.15 + Math.sin(p * Math.PI) * 0.07);
        root.alpha = 1;
        root.position.set(scoreX, peakY - Math.sin(p * Math.PI) * 6);
        root.rotation = -0.04 + Math.sin(p * Math.PI * 2) * 0.025;
      } else {
        const fp = Math.min(1, (elapsed - popDur - holdDur) / flyDur);
        const ep = fp * fp;
        root.position.x = scoreX + (targetLocal.x - scoreX) * ep;
        root.position.y = peakY + (targetLocal.y - peakY) * ep;
        root.scale.set(1.15 - 1.0 * fp);
        root.alpha = 1 - 0.6 * fp;
        root.rotation = -0.04 * (1 - fp);
        if (!scored && fp >= 0.92) {
          scored = true;
          this.applyDisplayedScoreGain(gain);
        }
      }
      if (elapsed >= total) {
        this.removeTransientTicker(tick);
        root.parent?.removeChild(root);
        root.destroy({ children: true });
        if (!scored) {
          this.applyDisplayedScoreGain(gain);
        }
      }
    };
    this.addTransientTicker(tick);
  }

  private applyDisplayedScoreGain(gain: number): void {
    this.displayedScore = Math.min(this.score, this.displayedScore + gain);
    this.updateHud();
    this.pulseScoreLabel();
  }

  /** 计分板放大→回弹脉冲。 */
  private pulseScoreLabel(): void {
    // 连消时帧内多次触发：每次只重置进度，复用同一个 ticker，
    // 避免 N 个 ticker 互相覆盖 lbl.scale 出现"打架"。
    this.scoreLabelPulseT = 0;
    this.scoreLabelPulseDur = 0.55;
    const lbl = this.scoreLabel;
    if (this.scorePulseTicker) {
      return;
    }
    const tick = (): void => {
      this.scoreLabelPulseT += Game.ticker.deltaMS / 1000;
      const p = Math.min(1, this.scoreLabelPulseT / this.scoreLabelPulseDur);
      const s = p < 0.4
        ? 1 + (p / 0.4) * 0.55
        : 1.55 - ((p - 0.4) / 0.6) * 0.55;
      lbl.scale.set(s);
      if (p >= 1) {
        lbl.scale.set(1);
        this.removeTransientTicker(tick);
        this.scorePulseTicker = null;
      }
    };
    this.scorePulseTicker = tick;
    this.addTransientTicker(tick);
  }

  /** 连击横幅：x2 / x3... 带颜色升级、弹跳与抖动。 */
  private spawnComboBanner(combo: number, x: number, y: number): void {
    const colors = [0xff6f3a, 0xff8b1a, 0xffd000, 0x36c8ff, 0xb867ff, 0xff3aa3];
    const tier = Math.min(colors.length - 1, combo - 2);
    const fillColor = colors[Math.max(0, tier)] ?? colors[0]!;
    const text = combo >= 5 ? `x${combo} 完美连击!` : `x${combo} 连击!`;
    const label = new PIXI.Text(text, {
      fontSize: combo >= 5 ? 40 : 34,
      fill: fillColor,
      fontWeight: '900',
      stroke: 0xffffff,
      strokeThickness: 7,
      lineJoin: 'round',
      dropShadow: true,
      dropShadowColor: 0x3a1106,
      dropShadowDistance: 3,
      dropShadowAlpha: 0.55,
      dropShadowAngle: Math.PI * 0.5,
    });
    label.anchor.set(0.5);
    label.position.set(x, y);
    label.scale.set(0);
    this.textEffectLayer.addChild(label);
    const popDur = 0.4;
    const holdDur = 0.95;
    const fadeDur = 0.55;
    const total = popDur + holdDur + fadeDur;
    let elapsed = 0;
    const tick = (): void => {
      if (label.destroyed) {
        this.removeTransientTicker(tick);
        return;
      }
      elapsed += Game.ticker.deltaMS / 1000;
      if (elapsed < popDur) {
        const p = elapsed / popDur;
        const s = p < 0.65 ? (p / 0.65) * 1.5 : 1.5 - ((p - 0.65) / 0.35) * 0.25;
        label.scale.set(s);
        label.rotation = Math.sin(p * Math.PI * 6) * 0.08;
        label.alpha = 1;
      } else if (elapsed < popDur + holdDur) {
        const p = (elapsed - popDur) / holdDur;
        label.scale.set(1.25 + Math.sin(p * Math.PI * 2) * 0.08);
        label.rotation = Math.sin(p * Math.PI * 4) * 0.04;
        label.alpha = 1;
      } else {
        const p = (elapsed - popDur - holdDur) / fadeDur;
        label.scale.set(1.25 + p * 0.6);
        label.position.set(x, y - 36 * p);
        label.alpha = 1 - p;
      }
      if (elapsed >= total) {
        this.removeTransientTicker(tick);
        label.parent?.removeChild(label);
        label.destroy();
      }
    };
    this.addTransientTicker(tick);
  }

  private spawnCenterBanner(text: string): void {
    const root = new PIXI.Container();
    root.position.set(Game.logicWidth / 2, Game.logicHeight * 0.17);
    root.scale.set(0.72);
    this.textEffectLayer.addChild(root);

    const bg = new PIXI.Graphics();
    bg.beginFill(0x3b1f13, 0.72);
    bg.lineStyle(4, 0xffd76a, 0.95);
    bg.drawRoundedRect(-205, -34, 410, 68, 24);
    bg.endFill();
    root.addChild(bg);

    const label = new PIXI.Text(text, {
      fontSize: 32,
      fill: 0xffffd6,
      fontWeight: '900',
      stroke: 0x8a2f12,
      strokeThickness: 6,
      lineJoin: 'round',
    });
    label.anchor.set(0.5);
    root.addChild(label);
    let elapsed = 0;
    const duration = 1.8;
    const tick = (): void => {
      if (root.destroyed) {
        this.removeTransientTicker(tick);
        return;
      }
      elapsed += Game.ticker.deltaMS / 1000;
      const p = Math.min(elapsed / duration, 1);
      root.alpha = p < 0.78 ? 1 : 1 - (p - 0.78) / 0.22;
      const s = 0.72 + Math.sin(Math.min(1, p * 3) * Math.PI * 0.5) * 0.28;
      root.scale.set(s);
      if (p >= 1) {
        this.removeTransientTicker(tick);
        root.parent?.removeChild(root);
        root.destroy({ children: true });
      }
    };
    this.addTransientTicker(tick);
  }

  private animateEffect(
    node: PIXI.DisplayObject,
    dx: number,
    dy: number,
    duration: number,
    spinSpeed = 0.16,
  ): void {
    const startX = node.x;
    const startY = node.y;
    let elapsed = 0;
    const tick = (): void => {
      elapsed += Game.ticker.deltaMS / 1000;
      const p = Math.min(elapsed / duration, 1);
      node.x = startX + dx * p;
      node.y = startY + dy * p + 160 * p * p;
      node.alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      if ('rotation' in node && spinSpeed !== 0) {
        node.rotation += spinSpeed;
      }
      if (p >= 1) {
        this.removeTransientTicker(tick);
        node.parent?.removeChild(node);
        node.destroy();
      }
    };
    this.addTransientTicker(tick);
  }

  private updateHud(): void {
    this.scoreLabel.text = String(this.displayedScore);
    this.bestLabel.text = String(Math.max(this.bestScore, this.displayedScore));
    const stage = FRUIT_SLICE_STAGES[this.currentStageIndex] ?? FRUIT_SLICE_STAGES[0]!;
    this.stageLabel.text = stage.label;
  }

  private refreshFruitDepth(): void {
    for (const node of this.fruits) {
      node.zIndex = node.state === 'falling' ? 100000 + Math.round(node.y) : Math.round(node.y);
    }
  }

  private pipeStackCenterX(): number {
    return Game.logicWidth / 2;
  }

  private pipeStackBaseY(): number {
    const geometry = this.boardGeometry;
    return geometry
      ? Math.min(Game.logicHeight - 96, geometry.baseY - geometry.boardH * 0.25)
      : this.cliffBottomY - 48;
  }

  private pipeStackY(stackIndex: number): number {
    const maxRadius = this.fruits.reduce((max, node) => Math.max(max, node.radius), 32);
    const step = Math.max(38, maxRadius * 1.32);
    const base = this.pipeBlockRemoved
      ? this.pipeStackBaseY()
      : this.pipeBlockLayout().blockTop - maxRadius - 2;
    return base - stackIndex * step;
  }

  /** 通道堆叠槽位：交替倾斜 + 小幅水平/竖直抖动，看起来更像“歪倒”而非笔直叠塔。 */
  private pipeSlot(
    stackIndex: number,
    node: FruitSliceNode,
  ): { x: number; y: number; rotation: number } {
    const r = node.radius;
    const altSign = stackIndex % 2 === 0 ? 1 : -1;
    const lateral = altSign * r * 0.16 + (Math.random() - 0.5) * r * 0.18;
    const rotation = altSign * 0.22 + (Math.random() - 0.5) * 0.18;
    return {
      x: this.pipeStackCenterX() + lateral,
      y: this.pipeStackY(stackIndex) + (Math.random() - 0.5) * 4,
      rotation,
    };
  }

  private boardOuterY(): number {
    return this.boardGeometry?.surfaceOuterY ?? this.cliffTopY;
  }

  private boardInnerY(): number {
    return this.boardGeometry?.surfaceInnerY ?? this.cliffTopY;
  }

  private boardSurfaceYAt(x: number): number | null {
    const geometry = this.boardGeometry;
    if (!geometry) {
      return null;
    }
    if (x < geometry.leftOuterX || x > geometry.rightOuterX) {
      return null;
    }
    if (x > geometry.leftInnerX && x < geometry.rightInnerX) {
      return null;
    }
    if (x <= geometry.leftInnerX) {
      const tWorld = (x - geometry.leftOuterX) / Math.max(1, geometry.boardW);
      const tClamped = Math.max(0, Math.min(1, tWorld));
      const fromEdge = this.computeEdgeWorldY('left', tClamped, geometry.boardH, geometry.baseY);
      if (fromEdge !== null) {
        return fromEdge;
      }
      return geometry.surfaceOuterY + (geometry.surfaceInnerY - geometry.surfaceOuterY) * tClamped;
    }
    const tWorld = (geometry.rightOuterX - x) / Math.max(1, geometry.boardW);
    const tClamped = Math.max(0, Math.min(1, tWorld));
    const fromEdge = this.computeEdgeWorldY('right', tClamped, geometry.boardH, geometry.baseY);
    if (fromEdge !== null) {
      return fromEdge;
    }
    return geometry.surfaceOuterY + (geometry.surfaceInnerY - geometry.surfaceOuterY) * tClamped;
  }

  private drawSky(W: number, H: number, headerH: number): void {
    const bands = [
      { y: 0, h: H * 0.22, c: 0x6ec8ff },
      { y: H * 0.22, h: H * 0.18, c: 0x8ed4ff },
      { y: H * 0.4, h: H * 0.35, c: 0xa8dfff },
      { y: H * 0.75, h: H * 0.25, c: 0xc8e8ff },
    ];
    for (const b of bands) {
      const g = new PIXI.Graphics();
      g.beginFill(b.c);
      g.drawRect(0, b.y, W, b.h + 2);
      g.endFill();
      this.container.addChild(g);
    }
    for (let i = 0; i < 5; i += 1) {
      const c = new PIXI.Graphics();
      c.beginFill(0xffffff, 0.88);
      c.drawEllipse(80 + i * 140, headerH + 20 + (i % 3) * 18, 36 + i * 4, 18);
      c.endFill();
      this.container.addChild(c);
    }
  }

  private drawCliffs(W: number, cliffTop: number, cliffBottom: number, gapHalf: number): void {
    const cx = W / 2;
    const outerY = this.boardOuterY();
    const innerY = this.boardInnerY();
    const left = new PIXI.Graphics();
    left.beginFill(0x8b603a);
    left.drawPolygon([0, outerY, cx - gapHalf, innerY, cx - gapHalf - 8, cliffBottom, 0, cliffBottom]);
    left.endFill();
    const leftGrass = new PIXI.Graphics();
    leftGrass.beginFill(0x52ad3a);
    leftGrass.drawPolygon([0, outerY - 14, cx - gapHalf - 2, innerY - 4, cx - gapHalf, innerY + 6, 0, outerY + 8]);
    leftGrass.endFill();
    const leftGrain = new PIXI.Graphics();
    leftGrain.lineStyle(2, 0x6e4728, 0.3);
    for (let i = 0; i < 5; i += 1) {
      const y = outerY + 36 + i * 32;
      leftGrain.moveTo(18, y);
      leftGrain.lineTo(cx - gapHalf - 22, y + 16);
    }
    this.container.addChild(left, leftGrass, leftGrain);

    const right = new PIXI.Graphics();
    right.beginFill(0x8b603a);
    right.drawPolygon([W, outerY, cx + gapHalf, innerY, cx + gapHalf + 8, cliffBottom, W, cliffBottom]);
    right.endFill();
    const rightGrass = new PIXI.Graphics();
    rightGrass.beginFill(0x52ad3a);
    rightGrass.drawPolygon([W, outerY - 14, cx + gapHalf + 2, innerY - 4, cx + gapHalf, innerY + 6, W, outerY + 8]);
    rightGrass.endFill();
    const rightGrain = new PIXI.Graphics();
    rightGrain.lineStyle(2, 0x6e4728, 0.3);
    for (let i = 0; i < 5; i += 1) {
      const y = outerY + 36 + i * 32;
      rightGrain.moveTo(W - 18, y);
      rightGrain.lineTo(cx + gapHalf + 22, y + 16);
    }
    this.container.addChild(right, rightGrass, rightGrain);
  }

  private drawBottomDecor(W: number, H: number): void {
    const leaf = new PIXI.Graphics();
    leaf.beginFill(0x3d8c40, 0.9);
    leaf.drawEllipse(40, H - 28, 48, 18);
    leaf.drawEllipse(90, H - 22, 40, 14);
    leaf.endFill();
    this.container.addChild(leaf);
    const mush = new PIXI.Graphics();
    mush.beginFill(0xe53935);
    mush.drawEllipse(W - 48, H - 36, 12, 10);
    mush.endFill();
    mush.beginFill(0xfff8e1);
    mush.drawRect(W - 50, H - 32, 4, 18);
    mush.endFill();
    this.container.addChild(mush);
  }

  /** 消除 / 打乱：半宽雪碧 + 置于左右案板面、随案板布局刷新。 */
  private mountToolButtons(): void {
    for (const sp of [this.toolElimSprite, this.toolShuffleSprite]) {
      sp.anchor.set(0.5, 0.5);
      sp.eventMode = 'static';
      sp.cursor = 'pointer';
    }
    if (this.fruitToolInventoryBadges.length === 0) {
      for (let i = 0; i < 2; i += 1) {
        const badge = this.createFruitToolInventoryBadge();
        badge.visible = false;
        this.fruitToolInventoryBadges.push(badge);
        this.fruitToolInventoryBadgeTexts.push(badge.getChildAt(1) as PIXI.Text);
      }
    }
    this.toolElimSprite.on('pointertap', () => {
      if (this.isTutorialActive()) {
        this.pulseTutorialTarget();
        return;
      }
      AudioManager.playButtonSound();
      this.showToolHelpPanel('eliminate');
    });
    this.toolShuffleSprite.on('pointertap', () => {
      if (this.isTutorialActive()) {
        this.pulseTutorialTarget();
        return;
      }
      AudioManager.playButtonSound();
      this.showToolHelpPanel('shuffle');
    });
    this.container.addChild(
      this.toolElimSprite,
      this.toolShuffleSprite,
      this.fruitToolInventoryBadges[0]!,
      this.fruitToolInventoryBadges[1]!,
    );
    this.layoutToolButtonsOnBoards();
    this.refreshFruitToolInventoryBadges();
  }

  private layoutToolButtonsOnBoards(): void {
    const W = Game.logicWidth;
    const edgePad = 14;
    const gapPad = 10;
    const left = this.boardLeftSprite;
    const right = this.boardRightSprite;
    const te = this.toolElimSprite;
    const ts = this.toolShuffleSprite;
    if (left.width < 2 || right.width < 2 || !te.texture?.width || !ts.texture?.width) {
      return;
    }
    const boardW = left.width;
    const targetH = left.height;
    const baseY = left.position.y;
    const arL = te.texture.width / te.texture.height;
    const arR = ts.texture.width / ts.texture.height;

    const leftInner = left.position.x;
    const leftOuter = leftInner - boardW;
    const lLo = Math.max(edgePad, leftOuter);
    const lHi = leftInner - gapPad;

    const rightInner = right.position.x;
    const rightOuter = rightInner + boardW;
    const rLo = rightInner + gapPad;
    const rHi = Math.min(W - edgePad, rightOuter);

    if (lHi - lLo < 24 || rHi - rLo < 24) {
      return;
    }

    const bL = TOOL_ON_BOARD_X_BIAS_FR;
    const bR = 1 - TOOL_ON_BOARD_X_BIAS_FR;
    const xlTarget = lLo + (lHi - lLo) * bL;
    const xrTarget = rLo + (rHi - rLo) * bR;
    const cy = baseY - targetH * TOOL_ON_BOARD_INSET_Y_FR;

    const maxBtnW =
      Math.min(lHi - lLo, rHi - rLo, boardW * 0.42, (W - edgePad * 2) * 0.24) * 0.9;

    let btnH = Math.max(22, targetH * TOOL_ON_BOARD_H_FR);
    btnH = Math.min(btnH, maxBtnW / Math.max(arL, arR));
    const wL = btnH * arL;
    const wR = btnH * arR;

    const xl = Math.min(Math.max(xlTarget, lLo + wL * 0.5), lHi - wL * 0.5);
    const xr = Math.min(Math.max(xrTarget, rLo + wR * 0.5), rHi - wR * 0.5);

    const place = (sp: PIXI.Sprite, cx: number, w: number, h: number) => {
      sp.width = w;
      sp.height = h;
      sp.position.set(cx, cy);
      const texW = Math.max(1, sp.texture.width);
      const texH = Math.max(1, sp.texture.height);
      const padX = 18 / Math.max(0.01, sp.scale.x);
      const padY = 18 / Math.max(0.01, sp.scale.y);
      sp.hitArea = new PIXI.Rectangle(
        -texW * 0.5 - padX,
        -texH * 0.5 - padY,
        texW + padX * 2,
        texH + padY * 2,
      );
    };
    place(te, xl, wL, btnH);
    place(ts, xr, wR, btnH);
    this.layoutFruitToolInventoryBadges();
  }

  private createFruitToolInventoryBadge(): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'none';
    const bg = new PIXI.Graphics();
    bg.beginFill(0xff4f43, 1);
    bg.lineStyle(3, 0xffffff, 1);
    bg.drawCircle(0, 0, 18);
    bg.endFill();
    const text = new PIXI.Text('', {
      fontSize: 17,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x8b241e,
      strokeThickness: 3,
    });
    text.anchor.set(0.5);
    text.resolution = 2;
    root.addChild(bg, text);
    return root;
  }

  private layoutFruitToolInventoryBadges(): void {
    const data = [
      { sprite: this.toolElimSprite, badge: this.fruitToolInventoryBadges[0] },
      { sprite: this.toolShuffleSprite, badge: this.fruitToolInventoryBadges[1] },
    ] as const;
    for (const item of data) {
      if (!item.badge) {
        continue;
      }
      item.badge.position.set(
        item.sprite.x + item.sprite.width * 0.42,
        item.sprite.y - item.sprite.height * 0.36,
      );
    }
  }

  private refreshFruitToolInventoryBadges(): void {
    const kinds: FruitSliceToolKind[] = ['eliminate', 'shuffle'];
    for (let i = 0; i < kinds.length; i += 1) {
      const badge = this.fruitToolInventoryBadges[i];
      const text = this.fruitToolInventoryBadgeTexts[i];
      if (!badge || !text) {
        continue;
      }
      const count = getFruitSliceToolCount(kinds[i]!);
      badge.visible = count > 0;
      text.text = count > 9 ? '9+' : String(count);
    }
  }

  private shuffleFruits(): void {
    if (this.gameOver) {
      return;
    }
    const activeIds = getFruitSliceActiveFruitIds(this.score);
    const shuffleTargets = this.fruits.filter((node) => node.state === 'fixed' || node.state === 'settled');
    for (const node of shuffleTargets) {
      const fruitId = activeIds[Math.floor(Math.random() * activeIds.length)]!;
      this.setFruitNodeVisual(node, fruitId);
      node.rotation = (Math.random() - 0.5) * 0.35;
    }

    const pipeTop = this.pipeStack[this.pipeStack.length - 1];
    if (pipeTop && shuffleTargets.length > 0) {
      const bottomRow = this.getBottomFruitRow(shuffleTargets);
      if (bottomRow.length > 0 && !bottomRow.some((node) => node.fruitId === pipeTop.fruitId)) {
        const target = bottomRow[Math.floor(Math.random() * bottomRow.length)]!;
        this.setFruitNodeVisual(target, pipeTop.fruitId);
      }
    }
  }

  private getBottomFruitRow(nodes: FruitSliceNode[]): FruitSliceNode[] {
    let bottomY = -Infinity;
    for (const node of nodes) {
      const y = node.__slideTo ?? node.y;
      if (y > bottomY) {
        bottomY = y;
      }
    }
    if (!Number.isFinite(bottomY)) {
      return [];
    }
    const rowThreshold = Math.max(42, this.gridRowStep() * 0.6);
    return nodes.filter((node) => bottomY - (node.__slideTo ?? node.y) <= rowThreshold);
  }

  private eliminatePipeTopPair(): void {
    if (this.gameOver) {
      return;
    }
    const top = this.pipeStack[this.pipeStack.length - 1];
    if (!top) {
      this.spawnCenterBanner('管道为空');
      return;
    }
    const candidates = this.fruits.filter((node) =>
      (node.state === 'fixed' || node.state === 'settled') && node.fruitId === top.fruitId);
    const fruitId = top.fruitId;
    const pipeX = top.node.x;
    const pipeY = top.node.y;

    this.pipeStack.pop();
    top.node.parent?.removeChild(top.node);
    top.node.destroy({ children: true });

    this.spawnSliceBurst(fruitId, pipeX, pipeY);
    if (candidates.length > 0) {
      const node = candidates[Math.floor(Math.random() * candidates.length)]!;
      const boardX = node.x;
      const boardY = node.y;
      const idx = this.fruits.indexOf(node);
      if (idx >= 0) {
        this.fruits.splice(idx, 1);
      }
      node.parent?.removeChild(node);
      node.destroy({ children: true });
      this.spawnSliceBurst(fruitId, boardX, boardY);
    }
    this.spawnCenterBanner('道具消除');
    AudioManager.playOrderCompleteSound();
    this.refillIfNeeded();
    this.updateHud();
  }
}
