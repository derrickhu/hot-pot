import * as PIXI from 'pixi.js';
import { DAILY_LIMITED_LEVELS } from '@/config/dailyLimitedLevels';
import { pickMilkTeaShopClearShareTitle } from '@/config/milkTeaShopShare';
import {
  MILK_TEA_DEMO_PRELOAD_PATHS,
  MILK_TEA_DEMO_TEXTURE_KEYS,
  MILK_TEA_SHOP_CLEAR_SHARE_CARD_PATH,
  milkTeaShopDrinkTextureKey,
} from '@/config/milkTeaTrayAssets';
import { getMilkTeaShopLevelDef, type MilkTeaShopLevelDef } from '@/config/milkTeaShopLevels';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import { Haptics } from '@/core/Haptics';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { analytics } from '@/analytics';
import {
  canClaimMilkTeaShopDailyShareReward,
  claimMilkTeaShopDailyShareReward,
  MILK_TEA_SHOP_DAILY_SHARE_REWARD_COINS,
  readMilkTeaShopProgress,
} from '@/game/MilkTeaShopProgress';
import { settleMilkTeaShopRound, type MilkTeaShopRoundRewardResult } from '@/game/MilkTeaShopRewards';
import { getCoinBalance, spendCoins } from '@/game/Wallet';
import { CoinBar, COIN_ICON_TEXTURE_KEY, COIN_ICON_TEXTURE_PATH, createCoinIcon } from '@/gameobjects/CoinBar';
import {
  BOWL_PAUSE_PANEL_ASSET,
  BOWL_PAUSE_PANEL_TEXTURE_KEY,
  SettingsPauseOverlay,
} from '@/gameobjects/SettingsPauseOverlay';
import { loadBowlSubpackage, loadMilkTeaDemoSubpackage } from '@/utils/loadBowlSubpackage';
import { MILK_TEA_SHOP_REWARDED_AD_UNIT_ID, showRewardedAd, warmupRewardedAd } from '@/utils/rewardedAd';
import { TextureCache } from '@/utils/TextureCache';
import { shareGameForReward } from '@/utils/wechatShare';
import { gameTopBarY, GAME_TOP_BAR_BACK_X, GAME_TOP_BAR_COIN_X } from '@/utils/gameTopBarLayout';
import { isWxDevtoolsSimulator } from '@/utils/wxMinigameEnv';

type DrinkId = string;
type ToolMode = 'removeTray' | 'clearCol';
type MilkTeaToolId = 'removeTray' | 'reshuffle' | 'clearCol';
type CrateSealState = 'full' | 'half';
type CellBlocker =
  | { kind: 'crate'; seal: CrateSealState }
  | { readonly kind: 'coin'; readonly cost: number }
  | { readonly kind: 'ad' };

interface PixiEventsHost {
  domElement?: HTMLElement;
  mapPositionToPoint?: (point: PIXI.Point, x: number, y: number) => void;
}

interface DrinkDef {
  readonly id: DrinkId;
  readonly name: string;
  readonly liquidColor: number;
  readonly toppingColor: number;
  readonly accentColor: number;
  readonly pattern: number;
}

interface Tray {
  readonly id: number;
  drinks: DrinkId[];
}

interface BoardCell {
  readonly index: number;
  readonly row: number;
  readonly col: number;
  tray: Tray | null;
  blocker: CellBlocker | null;
}

interface FlyAnimation {
  readonly node: PIXI.Container;
  readonly fromX: number;
  readonly fromY: number;
  toX: number;
  toY: number;
  readonly baseScaleX: number;
  readonly baseScaleY: number;
  elapsed: number;
  readonly duration: number;
  delay: number;
  started?: boolean;
  readonly onStart?: () => void;
  readonly onLand?: () => void;
  readonly sourceCellIndex?: number;
  readonly targetCellIndex?: number;
  readonly drinkId?: DrinkId;
  readonly sourceSlot?: number;
  readonly flyKind?: 'merge' | 'delivery';
}

interface MergeMove {
  readonly sourceCell: BoardCell;
  readonly targetCell: BoardCell;
  readonly drinkId: DrinkId;
  readonly sourceSlot: number;
  readonly targetSlot: number;
  readonly staggerIndex: number;
}

interface MergeTargetCandidate {
  readonly neighbor: BoardCell;
  readonly sharedDrinkId: DrinkId;
  readonly targetSharedCount: number;
  readonly targetFillCount: number;
  readonly sharedToMoveCount: number;
  readonly otherToMoveCount: number;
}

interface PendingDelivery {
  readonly drinkId: DrinkId;
  readonly orderIndex: number;
}

interface PulseEffect {
  readonly node: PIXI.Container;
  elapsed: number;
  readonly duration: number;
  readonly baseScale: number;
  readonly maxScale: number;
  readonly alphaStart: number;
  readonly onComplete?: () => void;
}

interface DeliveryAnimation {
  readonly node: PIXI.Container;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  elapsed: number;
  readonly duration: number;
  readonly slideOnly?: boolean;
  readonly onUpdate?: (t: number, x: number, y: number) => void;
  readonly onComplete?: () => void;
}

interface DragState {
  readonly tray: Tray;
  readonly pendingIndex: number;
  readonly node: PIXI.Container;
  snap: DragSnapState | null;
  lastLocalX: number;
  lastLocalY: number;
}

interface DragSnapState {
  readonly kind: 'place' | 'cancel';
  readonly cellIndex: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  elapsed: number;
  readonly duration: number;
}

interface MilkTeaRoundConfig {
  readonly shopLevel: number;
  readonly orderBagCount: number;
  readonly ordersPerBag: number[];
  readonly drinkTypeCount: number;
}

const BOARD_COLS = 4;
const BOARD_ROWS = 6;
const TRAY_CAPACITY = 6;
const BOTTOM_TRAY_COUNT = 3;

const BOARD_CELL_W = 156;
const BOARD_CELL_H = 110;
const BOARD_GAP = 10;
const TOOL_FX_GREEN_GLOW = 0x7ae856;
const TOOL_FX_GREEN_FILL = 0x6fdc52;
const BOARD_TRAY_W = 154;
const BOARD_TRAY_H = 108;
const PENDING_TRAY_W = 162;
const PENDING_TRAY_H = 114;
/** 托盘内饮品杯：仅按高度等比缩放，保持贴图原比例 */
const TRAY_CUP_HEIGHT_RATIO = 0.72;
/** 顶部订单区饮品杯高度（不设 maxWidth，避免误触宽度上限） */
const ORDER_CUP_HEIGHT = 70;
const ORDER_BAG_W = 124;
const ORDER_BAG_H = 108;
const ORDER_BAG_X = 112;
const ORDER_BAG_Y = -118;
const ORDER_BAG_EXIT_X = -120;
const SHOP_STATUS_FRAME_TARGET_W = 292;
const SHOP_STATUS_FRAME_TARGET_H = 56;
const SHOP_INFO_PANEL_TARGET_W = 340;

function getOrderCupStep(orderCount: number): number {
  if (orderCount >= 6) {
    return 88;
  }
  if (orderCount >= 5) {
    return 102;
  }
  return 118;
}
const PENDING_TRAY_SLOT_START_X = -210;
const PENDING_TRAY_SLOT_STEP = 210;
const DRAG_LIFT_OFFSET_Y = -12;
const DRAG_SNAP_DURATION = 0.26;
const DROP_SNAP_RADIUS = 92;
const MERGE_FLY_DURATION = 0.42;
const MERGE_FLY_STAGGER = 0.075;
const MERGE_FLY_ARC = 58;
const DELIVERY_CONFIRM_ARC = 36;
const MILK_TEA_BACK_BUTTON_TEXTURE_KEY = 'milk_tea_demo_back_button';
const MILK_TEA_BACK_BUTTON_PATH = 'assets/images/gameplay_back_button.png';

const DRINK_PALETTE = [
  { liquid: 0xffd25f, topping: 0xfff0a6, accent: 0xf58c2b },
  { liquid: 0x8f58c7, topping: 0xd8b4ff, accent: 0x6d3fa3 },
  { liquid: 0xff8fba, topping: 0xffd2e3, accent: 0xd94f84 },
  { liquid: 0x78d47f, topping: 0xd8ffd8, accent: 0x329f54 },
  { liquid: 0xff6f61, topping: 0xffccb8, accent: 0xd94a3d },
  { liquid: 0x4fb1ff, topping: 0xbde8ff, accent: 0x2577bd },
  { liquid: 0xf3bd6b, topping: 0xffedc2, accent: 0xb97024 },
  { liquid: 0xc7654a, topping: 0xf3cfb4, accent: 0x8c3a28 },
  { liquid: 0xffdf8f, topping: 0xffffff, accent: 0xce8e30 },
  { liquid: 0xb5d96b, topping: 0xf3ffd2, accent: 0x789b2f },
] as const;

function destroyContainerChildren(container: PIXI.Container): void {
  const children = container.removeChildren();
  for (const child of children) {
    if (!child.destroyed) {
      child.destroy({ children: true });
    }
  }
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeDrinkDefs(): DrinkDef[] {
  return DAILY_LIMITED_LEVELS.map((level, index) => {
    const hash = hashString(level.themeId);
    const palette = DRINK_PALETTE[(hash + index) % DRINK_PALETTE.length];
    return {
      id: level.themeId,
      name: level.drinkName,
      liquidColor: palette.liquid,
      toppingColor: palette.topping,
      accentColor: palette.accent,
      pattern: hash % 4,
    };
  });
}

function seededNext(seed: number): number {
  return (Math.imul(1664525, seed >>> 0) + 1013904223) >>> 0;
}

export class MilkTeaTrayDemoScene implements Scene {
  readonly name = 'milkTeaTrayDemo';
  readonly container = new PIXI.Container();

  private readonly bg = new PIXI.Graphics();
  private bgSprite: PIXI.Sprite | null = null;
  private readonly toolsRoot = new PIXI.Container();
  private readonly orderRoot = new PIXI.Container();
  private readonly boardRoot = new PIXI.Container();
  private readonly boardToolHighlightRoot = new PIXI.Container();
  private readonly trayRoot = new PIXI.Container();
  private readonly hudRoot = new PIXI.Container();
  private readonly shopStatusRoot = new PIXI.Container();
  private readonly roundProgressRoot = new PIXI.Container();
  private readonly overlayRoot = new PIXI.Container();
  private readonly backButtonSprite = new PIXI.Sprite();
  private readonly pauseOverlay: SettingsPauseOverlay;
  private readonly coinBar = new CoinBar();
  private readonly drinkDefs = makeDrinkDefs();
  private readonly drinkMap = new Map<DrinkId, DrinkDef>(this.drinkDefs.map((drink) => [drink.id, drink]));

  private activeDrinks: DrinkDef[] = [];
  private board: BoardCell[] = [];
  private pendingTrays: Tray[] = [];
  private orders: DrinkId[] = [];
  private orderCompleted: boolean[] = [];
  private currentRound: MilkTeaRoundConfig = {
    shopLevel: 1,
    orderBagCount: 1,
    ordersPerBag: [3],
    drinkTypeCount: 3,
  };
  private selectedTrayIndex = 0;
  private delivered = 0;
  private nextTrayId = 1;
  private randomState = 20260526;
  private messageText!: PIXI.Text;
  private roundSettled = false;
  private orderBagExiting = false;
  private orderBagEntering = false;
  private roundStartBannerOpen = false;
  private roundStartBannerNode: PIXI.Container | null = null;
  private roundStartBannerTicker: (() => void) | null = null;
  private shopInfoPopupRoot: PIXI.Container | null = null;
  private failOverlayOpen = false;
  private deliveryAnimations: DeliveryAnimation[] = [];
  private flyAnimations: FlyAnimation[] = [];
  private pulseEffects: PulseEffect[] = [];
  private dragState: DragState | null = null;
  private dragCancelMessage = '';
  private dragListenerCleanup: (() => void) | null = null;
  private dragUsesDom = false;
  private activeToolMode: ToolMode | null = null;
  private toolFxPhase = 0;
  private toolActiveHighlight: PIXI.Container | null = null;
  private boardToolHighlightNodes: PIXI.Container[] = [];
  private dropHighlightIndex = -1;
  private blockedDropIndex = -1;
  private rewardedAdBusy = false;
  /** 饮品飞完后再收起的空格（cell index） */
  private pendingEmptyTrayCells = new Set<number>();
  /** 满盘订单：杯子飞完后再提交托盘（cell index → 饮品） */
  private pendingDeliveries = new Map<number, PendingDelivery>();
  private submittingDeliveryCells = new Set<number>();
  private vanishingEmptyTrayCells = new Set<number>();
  private dragWobblePhase = 0;
  private texturesReady = false;

  constructor() {
    this.pauseOverlay = new SettingsPauseOverlay(Game.logicWidth, Game.logicHeight, {
      onReplay: () => {
        this.endDrag(false);
        this.startRound();
      },
      onHome: () => {
        this.endDrag(false);
        SceneManager.switchTo('home');
      },
      onContinue: () => {},
    });
    this.build();
  }

  async prepare(): Promise<void> {
    if (this.texturesReady) {
      return;
    }
    await Promise.all([
      loadMilkTeaDemoSubpackage(),
      loadBowlSubpackage(),
    ]);
    await Promise.all(
      [
        ...MILK_TEA_DEMO_PRELOAD_PATHS,
        { key: COIN_ICON_TEXTURE_KEY, path: COIN_ICON_TEXTURE_PATH },
        { key: MILK_TEA_BACK_BUTTON_TEXTURE_KEY, path: MILK_TEA_BACK_BUTTON_PATH },
        { key: BOWL_PAUSE_PANEL_TEXTURE_KEY, path: BOWL_PAUSE_PANEL_ASSET },
      ].map(({ key, path }) => TextureCache.load(key, path)),
    );
    this.texturesReady = true;
    const backTexture = TextureCache.get(MILK_TEA_BACK_BUTTON_TEXTURE_KEY);
    if (backTexture) {
      this.backButtonSprite.texture = backTexture;
      this.layoutBackButton();
    }
    this.coinBar.refreshIcon();
    this.coinBar.refresh();
    this.pauseOverlay.setPanelTexture(TextureCache.get(BOWL_PAUSE_PANEL_TEXTURE_KEY));
    this.applyPageBackground();
  }

  onEnter(): void {
    AudioManager.useMilkTeaShopBackgroundMusic();
    warmupRewardedAd(MILK_TEA_SHOP_REWARDED_AD_UNIT_ID);
    this.applyPageBackground();
    this.coinBar.refresh();
    this.startRound();
  }

  onExit(): void {
    this.dismissRoundStartBanner();
    this.hideShopInfoPopup();
    AudioManager.useDefaultBackgroundMusic();
  }

  update(dt: number): void {
    this.updateFlyAnimations(dt);
    this.updatePulseEffects(dt);
    this.updateDeliveryAnimations(dt);
    this.updateDragSnap(dt);
    if (this.activeToolMode || this.toolActiveHighlight) {
      this.updateToolFxPulse(dt);
    }
    if (this.dragState && !this.dragState.snap) {
      this.dragWobblePhase += dt;
      this.dragState.node.rotation = Math.sin(this.dragWobblePhase * 8) * 0.04;
      this.dragState.node.scale.set(1.08 + Math.sin(this.dragWobblePhase * 10) * 0.02);
    }
  }

  private build(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const top = Game.safeTop;

    this.container.eventMode = 'static';
    this.container.hitArea = new PIXI.Rectangle(0, 0, W, H);
    this.container.sortableChildren = true;

    this.bg.beginFill(0xffefd4);
    this.bg.drawRect(0, 0, W, H);
    this.bg.endFill();
    this.bg.beginFill(0xf7c982, 0.42);
    this.bg.drawRoundedRect(28, top + 96, W - 56, H - top - 190, 36);
    this.bg.endFill();
    this.container.addChild(this.bg);

    this.backButtonSprite.anchor.set(0.5);
    this.backButtonSprite.eventMode = 'static';
    this.backButtonSprite.cursor = 'pointer';
    this.layoutBackButton();
    this.backButtonSprite.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.pauseOverlay.visible = true;
    });
    this.container.addChild(this.backButtonSprite);
    this.coinBar.position.set(GAME_TOP_BAR_COIN_X, gameTopBarY(top));
    this.container.addChild(this.coinBar);
    this.shopStatusRoot.position.set(W / 2 + 20, top + 40);
    this.shopStatusRoot.zIndex = 4;
    this.container.addChild(this.shopStatusRoot);
    this.roundProgressRoot.position.set(86, top + 148);
    this.roundProgressRoot.zIndex = 4;
    this.container.addChild(this.roundProgressRoot);

    if (isWxDevtoolsSimulator()) {
      const gmButton = this.createPillButton('GM', 72, 40, 0xfff8e8, 0xb97a30, 20);
      gmButton.position.set(W - 64, top + 104);
      gmButton.on('pointertap', () => {
        AudioManager.playButtonSound();
        this.completeRoundByGm();
      });
      this.container.addChild(gmButton);
    }

    this.messageText = new PIXI.Text('', {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 18,
      fill: 0x7b4b23,
      fontWeight: '900',
      align: 'center',
      wordWrap: true,
      wordWrapWidth: W - 88,
    });
    this.messageText.anchor.set(0.5);
    this.messageText.resolution = 2;
    this.messageText.visible = false;
    this.messageText.position.set(W / 2, top + 92);

    this.orderRoot.position.set(W / 2, top + 260);
    this.boardRoot.position.set(W / 2, top + 725);
    this.boardToolHighlightRoot.position.set(W / 2, top + 725);
    this.trayRoot.position.set(W / 2, H - 270);
    this.hudRoot.position.set(W / 2, H - 94);
    this.toolsRoot.position.set(W / 2, H - 104);
    this.overlayRoot.zIndex = 10000;
    this.container.addChild(
      this.orderRoot,
      this.boardRoot,
      this.boardToolHighlightRoot,
      this.trayRoot,
      this.toolsRoot,
      this.hudRoot,
      this.overlayRoot,
    );
    this.pauseOverlay.zIndex = 20000;
    this.container.addChild(this.pauseOverlay);
  }

  private applyPageBackground(): void {
    const tex = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.pageBg);
    if (!tex) {
      return;
    }
    if (!this.bgSprite) {
      this.bgSprite = new PIXI.Sprite(tex);
      this.container.addChildAt(this.bgSprite, 0);
      if (this.bg.parent) {
        this.container.removeChild(this.bg);
      }
    } else {
      this.bgSprite.texture = tex;
    }
    this.bgSprite.width = Game.logicWidth;
    this.bgSprite.height = Game.logicHeight;
  }

  private layoutBackButton(): void {
    const tex = this.backButtonSprite.texture;
    if (!tex || tex === PIXI.Texture.EMPTY) {
      this.backButtonSprite.position.set(GAME_TOP_BAR_BACK_X, gameTopBarY());
      this.backButtonSprite.hitArea = new PIXI.Circle(0, 0, 38);
      return;
    }
    const target = 54;
    const scale = target / Math.max(1, Math.max(tex.width, tex.height));
    this.backButtonSprite.scale.set(scale);
    this.backButtonSprite.position.set(GAME_TOP_BAR_BACK_X, gameTopBarY());
    this.backButtonSprite.hitArea = new PIXI.Circle(0, 0, 38 / Math.max(0.01, scale));
  }

  private startRound(): void {
    this.dismissRoundStartBanner();
    this.hideShopInfoPopup();
    const todayIndex = Math.max(0, new Date().getDate() - 1);
    const progress = readMilkTeaShopProgress();
    const levelDef = getMilkTeaShopLevelDef(progress.shopLevel);
    this.randomState = 20260526 + todayIndex * 97 + progress.totalClears * 131 + progress.shopLevel * 997;
    this.currentRound = this.createRoundConfig(levelDef);
    this.nextTrayId = 1;
    this.delivered = 0;
    this.roundSettled = false;
    this.orderBagExiting = false;
    this.orderBagEntering = false;
    this.failOverlayOpen = false;
    this.selectedTrayIndex = 0;
    this.activeDrinks = this.pickRoundDrinks(levelDef, this.currentRound.drinkTypeCount);

    this.board = [];
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        this.board.push({
          index: row * BOARD_COLS + col,
          row,
          col,
          tray: null,
          blocker: this.createInitialCellBlocker(levelDef, row, col),
        });
      }
    }

    this.refreshOrderBatch();
    this.refillPendingBatch();
    this.endDrag(false);
    this.clearOverlayAnimations();
    this.pendingEmptyTrayCells.clear();
    this.pendingDeliveries.clear();
    this.submittingDeliveryCells.clear();
    this.vanishingEmptyTrayCells.clear();
    this.activeToolMode = null;
    this.dropHighlightIndex = -1;
    this.blockedDropIndex = -1;
    this.setMessage(`果茶店 Lv.${progress.shopLevel}：本局 ${this.currentRound.orderBagCount} 个订单袋，出现 ${this.currentRound.drinkTypeCount} 种果茶。`);
    this.renderShopStatus();
    this.renderRoundProgress();
    this.renderBoard();
    this.renderPendingTrays();
    this.renderTools();
    this.renderHud();
    this.showRoundStartBanner(() => {
      this.spawnOrderBagEnterEffect();
    });
    analytics.track('milk_tea_shop_start', {
      shop_level: this.currentRound.shopLevel,
      order_bag_count: this.currentRound.orderBagCount,
      drink_type_count: this.currentRound.drinkTypeCount,
      total_clears: progress.totalClears,
    });
  }

  private getOrderBagWorldPos(): { x: number; y: number } {
    return {
      x: this.orderRoot.x + ORDER_BAG_X,
      y: this.orderRoot.y + ORDER_BAG_Y,
    };
  }

  private createRoundConfig(levelDef: MilkTeaShopLevelDef): MilkTeaRoundConfig {
    const orderBagCount = Math.max(1, Math.floor(Number(levelDef.orderBagCount) || 1));
    const drinkTypeCount = this.randomInRange(levelDef.roundDrinkTypeRange);
    const ordersPerBag: number[] = [];
    for (let i = 0; i < orderBagCount; i += 1) {
      ordersPerBag.push(this.randomInRange(levelDef.ordersPerBagRange));
    }
    return {
      shopLevel: levelDef.level,
      orderBagCount,
      ordersPerBag,
      drinkTypeCount,
    };
  }

  private randomInRange(range: readonly [number, number]): number {
    const min = Math.min(range[0], range[1]);
    const max = Math.max(range[0], range[1]);
    return min + (this.nextRandom() % (max - min + 1));
  }

  private pickRoundDrinks(levelDef: MilkTeaShopLevelDef, drinkTypeCount: number): DrinkDef[] {
    const unlockedCount = Math.min(levelDef.unlockedDrinkCount, this.drinkDefs.length);
    const targetCount = Math.min(Math.max(1, drinkTypeCount), unlockedCount);
    const previousUnlockedCount = levelDef.level <= 1
      ? unlockedCount
      : Math.min(getMilkTeaShopLevelDef(levelDef.level - 1).unlockedDrinkCount, unlockedCount);
    const previousPool = this.drinkDefs.slice(0, previousUnlockedCount);
    const currentLevelUnlocks = levelDef.level <= 1
      ? []
      : this.drinkDefs.slice(previousUnlockedCount, unlockedCount);
    const guaranteed = this.shuffleDrinkDefs(currentLevelUnlocks).slice(0, targetCount);
    const guaranteedIds = new Set(guaranteed.map((drink) => drink.id));
    const fillPool = (levelDef.level <= 1 ? this.drinkDefs.slice(0, unlockedCount) : previousPool)
      .filter((drink) => !guaranteedIds.has(drink.id));
    const fillers = this.shuffleDrinkDefs(fillPool).slice(0, Math.max(0, targetCount - guaranteed.length));
    return this.shuffleDrinkDefs([...guaranteed, ...fillers]);
  }

  private shuffleDrinkDefs(drinks: readonly DrinkDef[]): DrinkDef[] {
    const result = [...drinks];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = this.nextRandom() % (i + 1);
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  private createNextTray(): Tray {
    const openOrders = this.orders.filter((_, index) => !this.orderCompleted[index]);
    const orderPool = openOrders.length > 0 ? openOrders : this.activeDrinks.map((drink) => drink.id);
    const primary = orderPool[(this.nextTrayId - 1) % orderPool.length];
    const shouldMixTray = this.currentRound.shopLevel >= 2 && this.activeDrinks.length > 1;
    const secondary = shouldMixTray ? this.pickDifferentDrinkId(primary) : this.pickDrinkId();
    const tertiary = shouldMixTray ? this.pickDifferentDrinkId(secondary) : this.pickDrinkId();
    const fillCount = shouldMixTray ? 3 + (this.nextRandom() % 3) : 2 + (this.nextRandom() % 4);
    const drinks: DrinkId[] = [];

    for (let i = 0; i < fillCount; i += 1) {
      if (i < 2) {
        drinks.push(primary);
      } else if (i % 2 === 0) {
        drinks.push(secondary);
      } else {
        drinks.push(tertiary);
      }
    }

    return {
      id: this.nextTrayId++,
      drinks: this.shuffleDrinks(drinks),
    };
  }

  private nextRandom(): number {
    this.randomState = seededNext(this.randomState);
    return this.randomState;
  }

  private pickDrinkId(): DrinkId {
    return this.activeDrinks[this.nextRandom() % this.activeDrinks.length].id;
  }

  private pickDifferentDrinkId(excluded: DrinkId): DrinkId {
    if (this.activeDrinks.length <= 1) {
      return excluded;
    }
    for (let i = 0; i < this.activeDrinks.length * 2; i += 1) {
      const drinkId = this.pickDrinkId();
      if (drinkId !== excluded) {
        return drinkId;
      }
    }
    return this.activeDrinks.find((drink) => drink.id !== excluded)?.id ?? excluded;
  }

  private shuffleDrinks(drinks: DrinkId[]): DrinkId[] {
    const result = [...drinks];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = this.nextRandom() % (i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  private createInitialCellBlocker(levelDef: MilkTeaShopLevelDef, row: number, col: number): CellBlocker | null {
    const unlock = levelDef.unlockCells.find((cell) => cell.row === row && cell.col === col);
    if (unlock?.kind === 'coin') {
      return { kind: 'coin', cost: unlock.cost ?? 20 };
    }
    if (unlock?.kind === 'ad') {
      return { kind: 'ad' };
    }
    const def = levelDef.blockers.find((blocker) => blocker.row === row && blocker.col === col);
    if (!def) {
      return null;
    }
    if (def.kind === 'crate') {
      return { kind: 'crate', seal: def.seal ?? 'full' };
    }
    return null;
  }

  private renderAll(): void {
    this.renderShopStatus();
    this.renderRoundProgress();
    this.renderOrders();
    this.renderBoard();
    this.renderPendingTrays();
    this.renderTools();
    this.renderHud();
    this.syncToolModeInputLock();
  }

  private syncToolModeInputLock(): void {
    const locked = this.activeToolMode != null;
    this.toolsRoot.eventMode = locked ? 'none' : 'passive';
  }

  private cancelActiveToolMode(): void {
    if (!this.activeToolMode) {
      return;
    }
    this.activeToolMode = null;
    this.setMessage('已取消道具选择。');
    this.renderAll();
  }

  private renderShopStatus(): void {
    destroyContainerChildren(this.shopStatusRoot);
    const progress = readMilkTeaShopProgress();
    const rootW = SHOP_STATUS_FRAME_TARGET_W;
    const rootH = SHOP_STATUS_FRAME_TARGET_H;
    const frameTex = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.shopStatusFrame);
    if (frameTex) {
      const frame = new PIXI.Sprite(frameTex);
      frame.anchor.set(0.5);
      frame.scale.set(rootW / frameTex.width);
      this.shopStatusRoot.addChild(frame);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(0xfff6df, 0.92);
      bg.lineStyle(3, 0xe09a42, 0.9);
      bg.drawRoundedRect(-rootW / 2, -rootH / 2, rootW, rootH, 20);
      bg.endFill();
      this.shopStatusRoot.addChild(bg);
    }

    this.shopStatusRoot.eventMode = 'static';
    this.shopStatusRoot.cursor = 'pointer';
    this.shopStatusRoot.hitArea = new PIXI.RoundedRectangle(-rootW / 2, -rootH / 2, rootW, rootH, 20);
    this.shopStatusRoot.removeAllListeners('pointertap');
    this.shopStatusRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.showShopInfoPopup();
    });

    const label = new PIXI.Text(`果茶店 Lv.${progress.shopLevel}`, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 21,
      fill: 0x8a4217,
      fontWeight: '900',
      stroke: 0xffffff,
      strokeThickness: 4,
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    label.position.set(0, 0);
    this.shopStatusRoot.addChild(label);
  }

  private showShopInfoPopup(): void {
    this.hideShopInfoPopup();

    const progress = readMilkTeaShopProgress();
    const levelDef = getMilkTeaShopLevelDef(progress.shopLevel);
    const clearsToNext = Math.max(0, levelDef.clearsToNext);
    const done = Math.min(progress.clearsInLevel, Math.max(0, clearsToNext - 1));
    const remaining = Math.max(0, clearsToNext - progress.clearsInLevel);
    const isMaxLevel = clearsToNext <= 0;

    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.hitArea = new PIXI.Rectangle(0, 0, Game.logicWidth, Game.logicHeight);
    root.on('pointertap', () => this.hideShopInfoPopup());

    const panelTex = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.shopLevelInfoPanel);
    const cardW = SHOP_INFO_PANEL_TARGET_W;
    let cardH = 196;
    const card = new PIXI.Container();
    card.eventMode = 'static';
    if (panelTex) {
      const bg = new PIXI.Sprite(panelTex);
      bg.anchor.set(0.5);
      const scale = cardW / panelTex.width;
      bg.scale.set(scale);
      cardH = panelTex.height * scale;
      card.addChild(bg);
      card.hitArea = new PIXI.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH);
    } else {
      card.hitArea = new PIXI.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH);
      const bg = new PIXI.Graphics();
      bg.beginFill(0xfff7df, 0.98);
      bg.lineStyle(3, 0xe4a34a, 1);
      bg.drawRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 24);
      bg.endFill();
      card.addChild(bg);
    }
    card.on('pointertap', (event) => event.stopPropagation());
    card.position.set(
      Math.min(Game.logicWidth - cardW / 2 - 24, Math.max(cardW / 2 + 24, this.shopStatusRoot.x)),
      this.shopStatusRoot.y + 116,
    );
    root.addChild(card);

    const upgradeText = new PIXI.Text(
      isMaxLevel ? '当前已满级' : `再通关 ${remaining} 次升级`,
      {
        fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
        fontSize: 22,
        fill: 0x8f4b1e,
        fontWeight: '900',
        stroke: 0xfff1c9,
        strokeThickness: 3,
        lineJoin: 'round',
      },
    );
    upgradeText.anchor.set(0.5);
    upgradeText.resolution = 2;
    upgradeText.position.set(0, -cardH * 0.24);
    card.addChild(upgradeText);

    this.mountShopInfoProgress(card, done, clearsToNext, isMaxLevel, cardH);
    this.mountShopInfoReward(card, levelDef.roundCoins, cardH);

    this.overlayRoot.addChild(root);
    this.shopInfoPopupRoot = root;
  }

  private mountShopInfoProgress(
    card: PIXI.Container,
    done: number,
    total: number,
    isMaxLevel: boolean,
    cardH: number,
  ): void {
    const barW = cardH * 1.18;
    const barH = 16;
    const progress = isMaxLevel || total <= 0 ? 1 : Math.min(1, Math.max(0, done / total));
    const bar = new PIXI.Graphics();
    bar.beginFill(0x8f5a2a, 0.14);
    bar.drawRoundedRect(-barW / 2, -barH / 2, barW, barH, barH / 2);
    bar.endFill();
    bar.beginFill(0xffcf5a, 1);
    bar.drawRoundedRect(-barW / 2, -barH / 2, barW * progress, barH, barH / 2);
    bar.endFill();
    bar.lineStyle(2, 0xffffff, 0.72);
    bar.drawRoundedRect(-barW / 2, -barH / 2, barW, barH, barH / 2);
    bar.position.set(0, -cardH * 0.02);
    card.addChild(bar);

    const label = new PIXI.Text(isMaxLevel ? '满级' : `${done}/${total}`, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 13,
      fill: 0x7b3612,
      fontWeight: '900',
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    label.position.set(0, -cardH * 0.02);
    card.addChild(label);
  }

  private mountShopInfoReward(card: PIXI.Container, coins: number, cardH: number): void {
    const row = new PIXI.Container();
    row.position.set(0, cardH * 0.22);
    card.addChild(row);

    const coin = createCoinIcon(16);
    coin.position.set(-52, 0);
    row.addChild(coin);

    const reward = new PIXI.Text(`本级奖励  +${coins}`, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 18,
      fill: 0x7b4b23,
      fontWeight: '900',
      stroke: 0xffffff,
      strokeThickness: 3,
      lineJoin: 'round',
    });
    reward.anchor.set(0, 0.5);
    reward.resolution = 2;
    reward.position.set(-28, 0);
    row.addChild(reward);
  }

  private hideShopInfoPopup(): void {
    if (!this.shopInfoPopupRoot) {
      return;
    }
    if (this.shopInfoPopupRoot.parent) {
      this.shopInfoPopupRoot.parent.removeChild(this.shopInfoPopupRoot);
    }
    this.shopInfoPopupRoot.destroy({ children: true });
    this.shopInfoPopupRoot = null;
  }

  private renderRoundProgress(): void {
    destroyContainerChildren(this.roundProgressRoot);
    const bag = this.createOrderBagVisual(48, 42);
    bag.position.set(0, 0);
    this.roundProgressRoot.addChild(bag);

    const done = Math.min(this.delivered, this.currentRound.orderBagCount);
    const total = Math.max(1, this.currentRound.orderBagCount);
    const label = new PIXI.Text(`${done}/${total}`, {
      fontSize: 22,
      fill: 0x7b4b23,
      fontWeight: '900',
      stroke: 0xffffff,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    label.anchor.set(0, 0.5);
    label.resolution = 2;
    label.position.set(30, 3);
    this.roundProgressRoot.addChild(label);
  }

  private renderOrders(): void {
    destroyContainerChildren(this.orderRoot);
    if (!this.orderBagEntering) {
      const panelTex = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.orderPanel);
      if (panelTex) {
        const panel = new PIXI.Sprite(panelTex);
        panel.anchor.set(0.5);
        const targetW = Math.min(610, Game.logicWidth - 88);
        panel.scale.set(targetW / panelTex.width);
        panel.position.set(0, 0);
        this.orderRoot.addChild(panel);
      } else {
        const panel = new PIXI.Graphics();
        panel.beginFill(0xd66f5d, 0.88);
        panel.lineStyle(4, 0xb9503f, 1);
        panel.drawRoundedRect(-315, -58, 630, 116, 26);
        panel.endFill();
        this.orderRoot.addChild(panel);
      }

      const orderCount = Math.max(1, this.orders.length);
      const step = getOrderCupStep(orderCount);
      const startX = -((orderCount - 1) * step) / 2;
      this.orders.forEach((drinkId, index) => {
        const root = new PIXI.Container();
        root.position.set(startX + index * step, 3);
        root.addChild(this.createDrinkVisual(drinkId, ORDER_CUP_HEIGHT));
        if (this.orderCompleted[index]) {
          root.alpha = 0.82;
          const check = this.createOrderCheckVisual(48);
          check.position.set(18, 12);
          root.addChild(check);
        }
        this.orderRoot.addChild(root);
      });
    }

    if (!this.orderBagEntering && !this.orderBagExiting) {
      this.renderOrderProgressBox();
    }
  }

  private renderOrderProgressBox(): void {
    if (this.orderBagExiting) {
      return;
    }
    const done = this.countCompletedOrderSlots();
    const total = Math.max(1, this.orders.length);
    const x = ORDER_BAG_X;
    const y = ORDER_BAG_Y;
    const box = this.createOrderBagVisual(ORDER_BAG_W, ORDER_BAG_H);
    box.position.set(x, y);
    this.orderRoot.addChild(box);

    const label = new PIXI.Text(`${done}/${total}`, {
      fontSize: 20,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x8f5a2a,
      strokeThickness: 4,
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    label.position.set(x, y + 14);
    this.orderRoot.addChild(label);

    const barW = 96;
    const bar = new PIXI.Graphics();
    bar.beginFill(0x7b4b23, 0.28);
    bar.drawRoundedRect(-barW / 2, 0, barW, 12, 6);
    bar.endFill();
    bar.beginFill(0xffe072, 1);
    bar.drawRoundedRect(-barW / 2, 0, barW * (done / total), 12, 6);
    bar.endFill();
    bar.position.set(x, y + 36);
    this.orderRoot.addChild(bar);
  }

  private createOrderCheckVisual(targetW: number): PIXI.Container {
    const tex = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.orderCheck);
    if (tex) {
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.scale.set(targetW / tex.width);
      return sprite;
    }
    const check = new PIXI.Graphics();
    check.lineStyle(7, 0x4fc65a, 1);
    check.moveTo(-22, 12);
    check.lineTo(-7, 27);
    check.lineTo(26, -16);
    return check;
  }

  private createOrderBagVisual(targetW: number, targetH: number): PIXI.Container {
    const tex = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.orderBag);
    if (tex) {
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.scale.set(Math.min(targetW / tex.width, targetH / tex.height));
      return sprite;
    }
    const box = new PIXI.Graphics();
    box.beginFill(0xd89145, 0.98);
    box.lineStyle(4, 0x8f5a2a, 1);
    box.drawRoundedRect(-44, -42, 88, 84, 10);
    box.endFill();
    box.beginFill(0xf1b25d, 1);
    box.drawRoundedRect(-24, -30, 48, 12, 4);
    box.endFill();
    return box;
  }

  private renderBoard(): void {
    destroyContainerChildren(this.boardRoot);
    const boardW = BOARD_COLS * BOARD_CELL_W + (BOARD_COLS - 1) * BOARD_GAP;
    const boardH = BOARD_ROWS * BOARD_CELL_H + (BOARD_ROWS - 1) * BOARD_GAP;

    for (const cell of this.board) {
      const local = this.getCellLocalCenter(cell);
      const cellRoot = new PIXI.Container();
      cellRoot.position.set(local.x, local.y);
      cellRoot.hitArea = new PIXI.Rectangle(-BOARD_CELL_W / 2, -BOARD_CELL_H / 2, BOARD_CELL_W, BOARD_CELL_H);
      const toolMode = this.activeToolMode;
      if (toolMode === 'removeTray' && cell.tray && !this.isCellLocked(cell.index)) {
        cellRoot.eventMode = 'static';
        cellRoot.cursor = 'pointer';
        cellRoot.on('pointertap', () => this.applyRemoveToolToCell(cell.index));
      } else if (toolMode === 'clearCol' && cell.tray && !this.isColumnLocked(cell.col)) {
        cellRoot.eventMode = 'static';
        cellRoot.cursor = 'pointer';
        cellRoot.on('pointertap', () => this.applyClearColumnTool(cell.col));
      } else if (toolMode != null) {
        cellRoot.eventMode = 'static';
        cellRoot.on('pointertap', () => this.cancelActiveToolMode());
      } else if (cell.blocker && cell.blocker.kind !== 'crate' && !this.isCellLocked(cell.index)) {
        cellRoot.eventMode = 'static';
        cellRoot.cursor = 'pointer';
        cellRoot.on('pointertap', () => this.unlockPaidCell(cell.index));
      }

      if (!cell.tray) {
        const isDropTarget = this.dragState && cell.index === this.dropHighlightIndex;
        const slot = new PIXI.Graphics();
        slot.beginFill(isDropTarget ? 0xfff2b8 : 0x8a6d4c, cell.blocker ? 0.18 : isDropTarget ? 0.42 : 0.24);
        slot.lineStyle(isDropTarget ? 3 : 0, isDropTarget ? 0xffd86a : 0, isDropTarget ? 0.9 : 0);
        slot.drawRoundedRect(-BOARD_CELL_W / 2, -BOARD_CELL_H / 2, BOARD_CELL_W, BOARD_CELL_H, 16);
        slot.endFill();
        cellRoot.addChild(slot);
        if (isDropTarget) {
          const glow = new PIXI.Graphics();
          glow.beginFill(0xfff8c8, 0.18);
          glow.drawRoundedRect(-BOARD_CELL_W / 2 - 6, -BOARD_CELL_H / 2 - 6, BOARD_CELL_W + 12, BOARD_CELL_H + 12, 20);
          glow.endFill();
          cellRoot.addChildAt(glow, 0);
        }
        if (cell.blocker) {
          cellRoot.addChild(this.createCellBlockerVisual(cell.blocker));
        }
      }

      if (cell.tray && !this.submittingDeliveryCells.has(cell.index)) {
        const isBlockedTarget = this.dragState && cell.index === this.blockedDropIndex;
        const drinkSlots = this.getDisplayDrinkSlots(cell);
        const trayNode = this.createTrayVisual(cell.tray, BOARD_TRAY_W, BOARD_TRAY_H, false, drinkSlots);
        if (isBlockedTarget) {
          trayNode.x = Math.sin(this.dragWobblePhase * 18) * 3;
        }
        cellRoot.addChild(trayNode);
        if (isBlockedTarget) {
          const warn = new PIXI.Graphics();
          warn.lineStyle(4, 0xff5a4f, 0.82);
          warn.drawRoundedRect(-BOARD_CELL_W / 2 + 3, -BOARD_CELL_H / 2 + 3, BOARD_CELL_W - 6, BOARD_CELL_H - 6, 18);
          cellRoot.addChild(warn);
        }
      }
      this.boardRoot.addChild(cellRoot);
    }
    this.renderToolBoardHighlights();
  }

  private renderPendingTrays(): void {
    destroyContainerChildren(this.trayRoot);
    this.pendingTrays.forEach((tray, index) => {
      const slotX = PENDING_TRAY_SLOT_START_X + index * PENDING_TRAY_SLOT_STEP;
      if (this.dragState?.pendingIndex === index) {
        const placeholder = this.createPendingSlotPlaceholder();
        placeholder.position.set(slotX, 0);
        this.trayRoot.addChild(placeholder);
        return;
      }
      const root = new PIXI.Container();
      root.position.set(slotX, 0);
      root.eventMode = this.canDragPendingTrays() ? 'static' : 'none';
      root.cursor = 'grab';
      root.alpha = this.canDragPendingTrays() ? 1 : 0.72;
      root.hitArea = new PIXI.Rectangle(-95, -72, 190, 132);
      root.on('pointerdown', (event) => this.startDragTray(event, index));
      root.addChild(this.createTrayVisual(tray, PENDING_TRAY_W, PENDING_TRAY_H, false));
      this.trayRoot.addChild(root);
    });
  }

  private createPendingSlotPlaceholder(): PIXI.Container {
    const root = new PIXI.Container();
    const slot = new PIXI.Graphics();
    slot.lineStyle(2, 0xc8782f, 0.32);
    slot.beginFill(0xfff0d0, 0.18);
    slot.drawRoundedRect(-PENDING_TRAY_W / 2, -PENDING_TRAY_H / 2, PENDING_TRAY_W, PENDING_TRAY_H, 14);
    slot.endFill();
    root.addChild(slot);
    root.eventMode = 'none';
    return root;
  }

  private createCellBlockerVisual(blocker: CellBlocker): PIXI.Container {
    const root = new PIXI.Container();
    if (blocker.kind === 'crate') {
      const stateTex = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.boardCrateStates);
      const tex = stateTex ? this.createSheetFrameTexture(stateTex, blocker.seal === 'full' ? 0 : 1, 2) : TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.boardCrate);
      if (tex) {
        const sprite = new PIXI.Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.scale.set(Math.min(120 / tex.width, 84 / tex.height));
        root.addChild(sprite);
        return root;
      }
      const box = new PIXI.Graphics();
      box.beginFill(0xc88745, 0.96);
      box.lineStyle(4, 0x8a5a2c, 1);
      box.drawRoundedRect(-58, -39, 116, 78, 8);
      box.endFill();
      box.beginFill(0xe3a765, 0.9);
      box.drawRoundedRect(-52, -34, 104, 18, 5);
      box.endFill();
      box.lineStyle(5, 0xd8a06c, 0.72);
      box.moveTo(-22, -12);
      box.lineTo(22, 26);
      box.moveTo(22, -12);
      box.lineTo(-22, 26);
      root.addChild(box);
      return root;
    }

    const unlockSheet = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.unlockButtonSheet);
    const unlockTex = unlockSheet ? this.createSheetFrameTexture(unlockSheet, blocker.kind === 'coin' ? 1 : 0, 2) : TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.unlockButton);
    if (unlockTex) {
      const button = new PIXI.Sprite(unlockTex);
      button.anchor.set(0.5);
      button.scale.set(Math.min(124 / unlockTex.width, 68 / unlockTex.height));
      root.addChild(button);
      if (blocker.kind === 'coin') {
        this.mountCoinUnlockLabel(root, blocker.cost);
      }
      return root;
    }

    const bg = new PIXI.Graphics();
    bg.beginFill(0x756e73, 0.94);
    bg.lineStyle(4, 0xffffff, 0.5);
    bg.drawRoundedRect(-62, -34, 124, 68, 14);
    bg.endFill();
    root.addChild(bg);

    if (blocker.kind === 'coin') {
      this.mountCoinUnlockLabel(root, blocker.cost);
    } else {
      const camera = new PIXI.Graphics();
      camera.beginFill(0xffffff, 0.95);
      camera.drawRoundedRect(-38, -14, 36, 28, 6);
      camera.endFill();
      camera.beginFill(0x65be4a, 1);
      camera.drawPolygon([0, -12, 24, 0, 0, 12]);
      camera.endFill();
      root.addChild(camera);
      const text = this.createSmallLabel('解锁', 22, 0xffffff, 0x4f4a50);
      text.position.set(24, 0);
      root.addChild(text);
    }
    return root;
  }

  private createSheetFrameTexture(texture: PIXI.Texture, frameIndex: number, frameCount: number): PIXI.Texture {
    const frameW = texture.width / frameCount;
    const frameH = texture.height;
    return new PIXI.Texture(
      texture.baseTexture,
      new PIXI.Rectangle(frameW * frameIndex, 0, frameW, frameH),
    );
  }

  private mountCoinUnlockLabel(root: PIXI.Container, cost: number): void {
    const icon = createCoinIcon(14);
    icon.position.set(-22, 0);
    root.addChild(icon);
    const text = this.createSmallLabel(`${cost}`, 23, 0xffffff, 0x4f4a50);
    text.anchor.set(0, 0.5);
    text.position.set(-4, 0);
    root.addChild(text);
  }

  private renderTools(): void {
    destroyContainerChildren(this.toolsRoot);
    this.toolActiveHighlight = null;
    const specs = [
      { id: 'removeTray' as const, key: MILK_TEA_DEMO_TEXTURE_KEYS.toolRemove, x: -200 },
      { id: 'reshuffle' as const, key: MILK_TEA_DEMO_TEXTURE_KEYS.toolReshuffle, x: 0 },
      { id: 'clearCol' as const, key: MILK_TEA_DEMO_TEXTURE_KEYS.toolClearRow, x: 200 },
    ];
    for (const spec of specs) {
      const slot = new PIXI.Container();
      const target = 88;
      slot.position.set(spec.x, 0);
      const canTapTool = this.canUseTools() && this.activeToolMode == null;
      slot.eventMode = canTapTool ? 'static' : 'none';
      slot.cursor = 'pointer';
      slot.alpha = canTapTool ? 1 : 0.55;
      slot.hitArea = new PIXI.Rectangle(-target / 2, -target / 2, target, target);

      const tex = TextureCache.get(spec.key);
      const btn = tex
        ? new PIXI.Sprite(tex)
        : this.createToolFallbackButton(spec.key === MILK_TEA_DEMO_TEXTURE_KEYS.toolRemove
          ? '移'
          : spec.key === MILK_TEA_DEMO_TEXTURE_KEYS.toolReshuffle
            ? '乱'
            : '清');
      if (tex) {
        (btn as PIXI.Sprite).anchor.set(0.5);
        btn.scale.set(target / Math.max(tex.width, tex.height));
      }
      btn.eventMode = 'none';
      slot.addChild(btn);
      const isActiveTool = (spec.key === MILK_TEA_DEMO_TEXTURE_KEYS.toolRemove && this.activeToolMode === 'removeTray')
        || (spec.key === MILK_TEA_DEMO_TEXTURE_KEYS.toolClearRow && this.activeToolMode === 'clearCol');
      if (isActiveTool) {
        const active = this.createGreenToolButtonHighlight(target * 0.58);
        slot.addChildAt(active, 0);
        this.toolActiveHighlight = active;
      }
      slot.on('pointertap', () => {
        if (!canTapTool) {
          return;
        }
        AudioManager.playButtonSound();
        this.showToolIntroOverlay(spec.id);
      });
      this.toolsRoot.addChild(slot);
    }
  }

  private renderToolBoardHighlights(): void {
    destroyContainerChildren(this.boardToolHighlightRoot);
    this.boardToolHighlightNodes = [];
    if (!this.activeToolMode) {
      return;
    }
    for (const cell of this.board) {
      if (this.activeToolMode === 'removeTray' && cell.tray && !this.isCellLocked(cell.index)) {
        const local = this.getCellLocalCenter(cell);
        const highlight = this.createGreenBoardTrayHighlight();
        highlight.position.set(local.x, local.y);
        this.boardToolHighlightRoot.addChild(highlight);
        this.boardToolHighlightNodes.push(highlight);
      } else if (this.activeToolMode === 'clearCol' && cell.tray && !this.isColumnLocked(cell.col)) {
        const local = this.getCellLocalCenter(cell);
        const highlight = this.createGreenBoardColumnHighlight();
        highlight.position.set(local.x, local.y);
        this.boardToolHighlightRoot.addChild(highlight);
        this.boardToolHighlightNodes.push(highlight);
      }
    }
  }

  private createGreenToolButtonHighlight(radius: number): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'none';

    const glow = new PIXI.Graphics();
    glow.beginFill(TOOL_FX_GREEN_GLOW, 0.24);
    glow.drawCircle(0, 0, radius * 1.08);
    glow.endFill();
    root.addChild(glow);

    const fill = new PIXI.Graphics();
    fill.beginFill(TOOL_FX_GREEN_FILL, 0.18);
    fill.drawCircle(0, 0, radius * 0.92);
    fill.endFill();
    root.addChild(fill);

    return root;
  }

  private createGreenBoardTrayHighlight(): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'none';
    const hw = BOARD_CELL_W / 2 - 4;
    const hh = BOARD_CELL_H / 2 - 4;
    const cr = 17;

    const outerGlow = new PIXI.Graphics();
    outerGlow.beginFill(TOOL_FX_GREEN_GLOW, 0.14);
    outerGlow.drawRoundedRect(-hw - 8, -hh - 8, (hw + 8) * 2, (hh + 8) * 2, cr + 4);
    outerGlow.endFill();
    root.addChild(outerGlow);

    const fill = new PIXI.Graphics();
    fill.beginFill(TOOL_FX_GREEN_FILL, 0.2);
    fill.drawRoundedRect(-hw + 2, -hh + 2, (hw - 2) * 2, (hh - 2) * 2, cr - 1);
    fill.endFill();
    root.addChild(fill);

    return root;
  }

  private createGreenBoardColumnHighlight(): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'none';
    const hw = BOARD_CELL_W / 2 - 3;
    const hh = BOARD_CELL_H / 2 - 3;
    const cr = 16;

    const glow = new PIXI.Graphics();
    glow.beginFill(TOOL_FX_GREEN_GLOW, 0.12);
    glow.drawRoundedRect(-hw - 6, -hh - 6, (hw + 6) * 2, (hh + 6) * 2, cr + 3);
    glow.endFill();
    root.addChild(glow);

    const fill = new PIXI.Graphics();
    fill.beginFill(TOOL_FX_GREEN_FILL, 0.24);
    fill.drawRoundedRect(-hw, -hh, hw * 2, hh * 2, cr);
    fill.endFill();
    root.addChild(fill);

    return root;
  }

  private updateToolFxPulse(dt: number): void {
    this.toolFxPhase += dt;
    const breath = 0.5 + 0.5 * Math.sin(this.toolFxPhase * 5.5);
    const buttonScale = 0.96 + breath * 0.06;
    const buttonAlpha = 0.78 + breath * 0.22;
    const boardScale = 0.98 + breath * 0.04;
    const boardAlpha = 0.84 + breath * 0.16;

    if (this.toolActiveHighlight) {
      this.toolActiveHighlight.scale.set(buttonScale);
      this.toolActiveHighlight.alpha = buttonAlpha;
    }
    for (const node of this.boardToolHighlightNodes) {
      node.scale.set(boardScale);
      node.alpha = boardAlpha;
    }
  }

  private createToolFallbackButton(label: string): PIXI.Container {
    const root = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(0xffb04a, 0.96);
    bg.lineStyle(3, 0xc8782f, 1);
    bg.drawCircle(0, 0, 40);
    bg.endFill();
    root.addChild(bg);
    const text = new PIXI.Text(label, {
      fontSize: 28,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0xc8782f,
      strokeThickness: 4,
    });
    text.anchor.set(0.5);
    text.resolution = 2;
    root.addChild(text);
    return root;
  }

  private createSmallLabel(label: string, fontSize: number, fill: number, stroke: number): PIXI.Text {
    const text = new PIXI.Text(label, {
      fontSize,
      fill,
      fontWeight: '900',
      stroke,
      strokeThickness: 4,
    });
    text.anchor.set(0.5);
    text.resolution = 2;
    return text;
  }

  private renderHud(): void {
    destroyContainerChildren(this.hudRoot);
  }

  private canUseTools(): boolean {
    return !this.dragState
      && !this.hasActiveBoardMotion()
      && !this.isRoundComplete()
      && !this.roundStartBannerOpen;
  }

  private canDragPendingTrays(): boolean {
    return this.canUseTools() && this.activeToolMode == null;
  }

  private hasActiveBoardMotion(): boolean {
    return this.flyAnimations.length > 0
      || this.deliveryAnimations.length > 0
      || this.pendingEmptyTrayCells.size > 0
      || this.pendingDeliveries.size > 0
      || this.submittingDeliveryCells.size > 0
      || this.vanishingEmptyTrayCells.size > 0;
  }

  private isCellLocked(cellIndex: number): boolean {
    return this.pendingEmptyTrayCells.has(cellIndex)
      || this.pendingDeliveries.has(cellIndex)
      || this.submittingDeliveryCells.has(cellIndex)
      || this.vanishingEmptyTrayCells.has(cellIndex)
      || this.flyAnimations.some(
        (anim) => anim.sourceCellIndex === cellIndex || anim.targetCellIndex === cellIndex,
      )
      || this.deliveryAnimations.some((anim) => {
        const cell = this.board[cellIndex];
        if (!cell) {
          return false;
        }
        const local = this.getCellLocalCenter(cell);
        return Math.abs(anim.fromX - (this.boardRoot.x + local.x)) < 1
          && Math.abs(anim.fromY - (this.boardRoot.y + local.y)) < 1;
      });
  }

  private isColumnLocked(col: number): boolean {
    return this.board.some((cell) => cell.col === col && this.isCellLocked(cell.index));
  }

  private columnHasTray(col: number): boolean {
    return this.board.some((cell) => cell.col === col && cell.tray);
  }

  private unlockPaidCell(cellIndex: number): void {
    if (this.activeToolMode || this.roundStartBannerOpen || this.hasActiveBoardMotion()) {
      return;
    }
    const cell = this.board[cellIndex];
    if (!cell?.blocker || cell.blocker.kind === 'crate') {
      return;
    }
    if (cell.blocker.kind === 'ad') {
      void this.unlockAdCellByRewardedVideo(cellIndex);
      return;
    }
    if (cell.blocker.kind === 'coin') {
      const cost = cell.blocker.cost;
      const balance = getCoinBalance();
      if (balance < cost) {
        this.showToolToast(`金币不足，还差 ${cost - balance} 金币`);
        return;
      }
      const spent = spendCoins(cost);
      if (!spent.ok) {
        this.showToolToast(`金币不足，还差 ${cost - getCoinBalance()} 金币`);
        return;
      }
      this.coinBar.refresh();
      this.applyCellUnlock(cellIndex, `已花费 ${cell.blocker.cost} 金币解锁格子。`);
    }
  }

  private applyCellUnlock(cellIndex: number, message: string): void {
    const cell = this.board[cellIndex];
    if (!cell?.blocker) {
      return;
    }
    this.spawnCellUnlockEffect(cell);
    cell.blocker = null;
    this.setMessage(message);
    this.renderBoard();
  }

  private async unlockAdCellByRewardedVideo(cellIndex: number): Promise<void> {
    if (this.activeToolMode || this.roundStartBannerOpen || this.hasActiveBoardMotion()) {
      return;
    }
    const cell = this.board[cellIndex];
    if (!cell?.blocker || cell.blocker.kind !== 'ad') {
      return;
    }
    if (this.rewardedAdBusy) {
      this.showToolToast('广告加载中');
      return;
    }
    this.rewardedAdBusy = true;
    try {
      const result = await showRewardedAd({
        scene: 'milk_tea_cell_unlock_ad',
        extra: { cell_index: cellIndex, shop_level: this.currentRound.shopLevel },
      }, MILK_TEA_SHOP_REWARDED_AD_UNIT_ID);
      if (result === 'completed' || result === 'unavailable') {
        this.applyCellUnlock(cellIndex, '已观看广告，格子解锁。');
        analytics.track('milk_tea_shop_cell_unlock_ad', {
          cell_index: cellIndex,
          shop_level: this.currentRound.shopLevel,
          ad_result: result,
        });
        return;
      }
      if (result === 'skipped') {
        this.showToolToast('看完广告后才能解锁');
        return;
      }
      this.showToolToast('广告暂不可用，请稍后再试');
    } finally {
      this.rewardedAdBusy = false;
    }
  }

  private isRoundComplete(): boolean {
    return this.delivered >= this.currentRound.orderBagCount;
  }

  private completeRoundByGm(): void {
    if (this.roundSettled) {
      return;
    }
    this.endDrag(false);
    this.clearOverlayAnimations();
    this.pendingEmptyTrayCells.clear();
    this.pendingDeliveries.clear();
    this.submittingDeliveryCells.clear();
    this.vanishingEmptyTrayCells.clear();
    this.orderBagExiting = false;
    this.orderBagEntering = false;
    this.delivered = this.currentRound.orderBagCount;
    this.orderCompleted = this.orderCompleted.map(() => true);
    this.activeToolMode = null;
    this.dropHighlightIndex = -1;
    this.blockedDropIndex = -1;
    this.setMessage('GM：已完成本局订单，直接进入结算。');
    this.renderRoundProgress();
    this.renderOrders();
    this.renderBoard();
    this.renderTools();
    this.renderPendingTrays();
    this.settleRoundIfNeeded();
  }

  private showToolIntroOverlay(toolId: MilkTeaToolId): void {
    const availability = this.getToolAvailability(toolId);
    if (!availability.ok) {
      this.showToolToast(availability.message);
      return;
    }

    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.hitArea = new PIXI.Rectangle(0, 0, W, H);

    const dim = new PIXI.Graphics();
    dim.beginFill(0x2b160c, 0.48);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    dim.eventMode = 'static';
    dim.cursor = 'pointer';
    dim.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.dismissOverlay(root);
    });
    root.addChild(dim);

    const card = new PIXI.Container();
    card.position.set(W / 2, H * 0.43);
    card.eventMode = 'static';
    card.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());

    const panelInfo = this.mountToolHelpPanelSprite(card, toolId);

    const adBtn = this.createToolFreeButton();
    adBtn.position.set(0, panelInfo.height / 2 + 56);
    adBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.playButtonSound();
      void this.runToolRewardedAction(toolId, root);
    });
    card.addChild(adBtn);

    const close = this.createCloseButton();
    close.position.set(panelInfo.width / 2 - 24, -panelInfo.height / 2 + 26);
    close.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.playButtonSound();
      this.dismissOverlay(root);
    });
    card.addChild(close);

    root.addChild(card);
    this.overlayRoot.addChild(root);
  }

  private mountToolHelpPanelSprite(root: PIXI.Container, toolId: MilkTeaToolId): { width: number; height: number } {
    const sheet = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.toolHelpPanels);
    const index = toolId === 'removeTray' ? 0 : toolId === 'reshuffle' ? 1 : 2;
    if (!sheet) {
      const width = 420;
      const height = 520;
      const bg = new PIXI.Graphics();
      bg.beginFill(0xfff5df, 0.98);
      bg.lineStyle(5, 0xd88a38, 1);
      bg.drawRoundedRect(-width / 2, -height / 2, width, height, 24);
      bg.endFill();
      root.addChild(bg);
      return { width, height };
    }

    const frameW = sheet.width / 3;
    const frame = new PIXI.Texture(
      sheet.baseTexture,
      new PIXI.Rectangle(frameW * index, 0, frameW, sheet.height),
    );
    const sprite = new PIXI.Sprite(frame);
    sprite.anchor.set(0.5);
    const scale = Math.min(
      (Game.logicWidth * 0.72) / frameW,
      (Game.logicHeight * 0.52) / sheet.height,
      1.05,
    );
    sprite.scale.set(scale);
    root.addChild(sprite);
    return { width: frameW * scale, height: sheet.height * scale };
  }

  private createToolFreeButton(): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    const tex = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.toolFreeButton);
    if (tex) {
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      const scale = Math.min((Game.logicWidth * 0.72) / tex.width, 120 / tex.height, 1);
      sprite.scale.set(scale);
      root.addChild(sprite);
      root.hitArea = new PIXI.Rectangle(
        -(tex.width * scale) / 2,
        -(tex.height * scale) / 2,
        tex.width * scale,
        tex.height * scale,
      );
      return root;
    }
    const fallback = this.createPillButton('免费获取', 280, 72, 0xcff3ff, 0x7eb7cf, 30);
    fallback.eventMode = 'none';
    root.addChild(fallback);
    root.hitArea = new PIXI.Rectangle(-140, -36, 280, 72);
    return root;
  }

  private createCloseButton(): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Circle(0, 0, 34);
    const bg = new PIXI.Graphics();
    bg.beginFill(0xf3635d, 1);
    bg.lineStyle(4, 0xb13d36, 1);
    bg.drawCircle(0, 0, 26);
    bg.endFill();
    root.addChild(bg);
    const mark = new PIXI.Text('×', {
      fontSize: 34,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0xb13d36,
      strokeThickness: 2,
    });
    mark.anchor.set(0.5);
    mark.position.set(0, -2);
    mark.resolution = 2;
    root.addChild(mark);
    return root;
  }

  private getToolAvailability(toolId: MilkTeaToolId): { ok: boolean; message: string } {
    if (!this.canUseTools()) {
      return { ok: false, message: '当前还不能使用道具' };
    }
    if (toolId === 'removeTray' && !this.board.some((cell) => cell.tray && !this.isCellLocked(cell.index))) {
      return { ok: false, message: '棋盘上还没有托盘可移除' };
    }
    if (toolId === 'clearCol' && !this.board.some((cell) => this.columnHasTray(cell.col) && !this.isColumnLocked(cell.col))) {
      return { ok: false, message: '棋盘上没有可消除的列' };
    }
    return { ok: true, message: '' };
  }

  private async runToolRewardedAction(toolId: MilkTeaToolId, panelRoot: PIXI.Container): Promise<void> {
    if (this.rewardedAdBusy) {
      this.showToolToast('广告加载中');
      return;
    }
    this.rewardedAdBusy = true;
    try {
      const result = await showRewardedAd({
        scene: 'milk_tea_tool_use',
        extra: { tool_id: toolId, shop_level: this.currentRound.shopLevel },
      }, MILK_TEA_SHOP_REWARDED_AD_UNIT_ID);
      if (result === 'completed' || result === 'unavailable') {
        this.dismissOverlay(panelRoot);
        this.activateToolAfterReward(toolId);
        analytics.track('milk_tea_shop_tool_use', {
          tool_id: toolId,
          shop_level: this.currentRound.shopLevel,
          ad_result: result,
        });
        return;
      }
      if (result === 'skipped') {
        this.showToolToast('看完广告后才能使用');
        return;
      }
      this.showToolToast('广告暂不可用，请稍后再试');
    } finally {
      this.rewardedAdBusy = false;
    }
  }

  private activateToolAfterReward(toolId: MilkTeaToolId): void {
    if (toolId === 'removeTray') {
      this.useToolRemove();
      return;
    }
    if (toolId === 'reshuffle') {
      this.useToolReshuffle();
      return;
    }
    this.useToolClearRow();
  }

  private showToolToast(message: string): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    api?.showToast?.({ title: message, icon: 'none' });
    this.setMessage(message);
  }

  private useToolRemove(): void {
    if (!this.canUseTools()) {
      return;
    }
    if (!this.board.some((cell) => cell.tray && !this.isCellLocked(cell.index))) {
      this.setMessage('棋盘上还没有托盘可移除。');
      return;
    }
    this.activeToolMode = this.activeToolMode === 'removeTray' ? null : 'removeTray';
    this.setMessage(this.activeToolMode === 'removeTray'
      ? '请选择棋盘上的一个托盘，直接消除。'
      : '已取消移除道具。');
    this.renderAll();
  }

  private useToolReshuffle(): void {
    if (!this.canUseTools()) {
      return;
    }
    this.activeToolMode = null;
    this.refillPendingBatch();
    this.selectedTrayIndex = 0;
    this.setMessage('已重新发放底部 3 个待放托盘。');
    this.renderAll();
  }

  private useToolClearRow(): void {
    if (!this.canUseTools()) {
      return;
    }
    for (let col = 0; col < BOARD_COLS; col += 1) {
      if (this.columnHasTray(col) && !this.isColumnLocked(col)) {
        this.activeToolMode = this.activeToolMode === 'clearCol' ? null : 'clearCol';
        this.setMessage(this.activeToolMode === 'clearCol'
          ? '请选择棋盘上的一列，整列托盘都会消除。'
          : '已取消消除一列道具。');
        this.renderAll();
      return;
      }
    }
    this.setMessage('棋盘上没有可消除的列。');
  }

  private applyRemoveToolToCell(cellIndex: number): void {
    if (this.activeToolMode !== 'removeTray' || !this.canUseTools()) {
      return;
    }
    const cell = this.board[cellIndex];
    if (!cell?.tray || this.isCellLocked(cellIndex)) {
      return;
    }
    this.activeToolMode = null;
    this.spawnTrayRemoveEffect(cell);
    cell.tray = null;
    this.setMessage('已消除选中的托盘。');
    this.checkRoundState();
    this.renderAll();
  }

  private applyClearColumnTool(col: number): void {
    if (this.activeToolMode !== 'clearCol' || !this.canUseTools()) {
      return;
    }
    if (this.isColumnLocked(col)) {
      return;
    }
    const cells = this.board.filter((cell) => cell.col === col && cell.tray);
    if (cells.length === 0) {
      this.setMessage('这一列没有可消除的托盘。');
      return;
    }
    this.activeToolMode = null;
    for (const cell of cells) {
      this.spawnTrayRemoveEffect(cell);
      cell.tray = null;
    }
    this.setMessage(`已消除第 ${col + 1} 列的托盘。`);
    this.checkRoundState();
    this.renderAll();
  }

  private placeSelectedTray(cellIndex: number): void {
    this.placePendingTrayAtCell(this.selectedTrayIndex, cellIndex);
  }

  private placePendingTrayAtCell(pendingIndex: number, cellIndex: number): boolean {
    if (this.hasActiveBoardMotion()) {
      this.setMessage('饮品还在移动，等动画结束后再放下托盘。');
      return false;
    }
    if (this.isRoundComplete()) {
      this.setMessage('本局已完成，继续营业会开启下一局。');
      return false;
    }
    const cell = this.board[cellIndex];
    const tray = this.pendingTrays[pendingIndex];
    if (!tray) {
      this.setMessage('没有可放置的托盘了。');
      return false;
    }
    if (!cell || cell.tray) {
      this.setMessage('中间区域只能放到空格里。');
      return false;
    }
    if (cell.blocker) {
      this.setMessage('这个格子还没解锁，先解锁后才能放托盘。');
      return false;
    }

    cell.tray = tray;
    this.pendingTrays.splice(pendingIndex, 1);
    this.selectedTrayIndex = Math.min(pendingIndex, Math.max(0, this.pendingTrays.length - 1));
    if (this.pendingTrays.length === 0) {
      this.refillPendingBatch();
    }

    this.spawnPlaceEffect(cell);

    const moved = this.mergeFromPlacedTray(cellIndex);
    if (moved > 0) {
      AudioManager.playMilkTeaTraySwapSound();
    } else {
      AudioManager.playScoopSound();
    }
    Haptics.light();
    const willEmptyTray = this.pendingEmptyTrayCells.has(cellIndex);
    const delivering = this.tryDeliverCompletedTrays();
    if (delivering > 0) {
      this.setMessage(`同色满盘！${delivering} 盘饮品准备提交，随后整盘飞向订单栏。`);
    } else if (moved > 0 && willEmptyTray) {
      this.setMessage('相邻托盘正在交换整理同色饮品，飞完后空盘会收起。');
    } else if (moved > 0) {
      this.setMessage('相邻托盘已交换整理：同色集中到已有托盘，其它饮品换回新托盘。');
    } else {
      this.setMessage('已放下托盘。继续让同款饮品相邻，凑满 6 杯后交付订单。');
    }
    this.checkRoundState();
    this.renderAll();
    return true;
  }

  private startDragTray(event: PIXI.FederatedPointerEvent, pendingIndex: number): void {
    if (!this.canDragPendingTrays()) {
      return;
    }
    const tray = this.pendingTrays[pendingIndex];
    if (!tray) {
      return;
    }
    AudioManager.playButtonSound();
    this.selectedTrayIndex = pendingIndex;
    this.endDrag(false);
    const node = this.createTrayVisual(tray, PENDING_TRAY_W, PENDING_TRAY_H, false);
    node.alpha = 0.96;
    node.scale.set(1.08);
    node.eventMode = 'none';
    this.overlayRoot.addChild(node);
    this.dragState = { tray, pendingIndex, node, snap: null, lastLocalX: 0, lastLocalY: 0 };
    const local = event.getLocalPosition(this.container);
    this.updateDragAtLocal(local.x, local.y);
    this.dropHighlightIndex = -1;
    this.blockedDropIndex = -1;
    this.attachDragPointerBridge();
    this.renderPendingTrays();
    this.renderBoard();
  }

  private getPixiEvents(): PixiEventsHost | null {
    try {
      const renderer = Game.app?.renderer as PIXI.Renderer & { events?: PixiEventsHost };
      return renderer?.events ?? null;
    } catch {
      return null;
    }
  }

  private mapClientToGlobal(clientX: number, clientY: number): PIXI.Point {
    const point = new PIXI.Point();
    const events = this.getPixiEvents();
    if (events?.mapPositionToPoint) {
      events.mapPositionToPoint(point, clientX, clientY);
    }
    return point;
  }

  /** 微信等环境下 Pixi 小块命中区跟丢 pointermove，需 global + DOM 双通道跟踪 */
  private attachDragPointerBridge(): void {
    this.detachDragPointerBridge();

    const onMove = (event: PIXI.FederatedPointerEvent) => {
      if (this.dragUsesDom || !this.dragState || this.dragState.snap) {
        return;
      }
      const local = event.getLocalPosition(this.container);
      this.updateDragAtLocal(local.x, local.y);
    };

    const onUp = (event: PIXI.FederatedPointerEvent) => {
      if (!this.dragState || this.dragState.snap) {
        return;
      }
      const local = event.getLocalPosition(this.container);
      this.releaseDragAtLocal(local.x, local.y);
    };

    this.container.on('globalpointermove', onMove);
    this.container.on('pointerup', onUp);
    this.container.on('pointerupoutside', onUp);
    this.container.on('pointercancel', onUp);

    const cleanups: Array<() => void> = [
      () => this.container.off('globalpointermove', onMove),
      () => this.container.off('pointerup', onUp),
      () => this.container.off('pointerupoutside', onUp),
      () => this.container.off('pointercancel', onUp),
    ];

    const el = this.getPixiEvents()?.domElement;
    if (el?.addEventListener) {
      const onDomMove = (ev: PointerEvent | TouchEvent) => {
        if (!this.dragState || this.dragState.snap) {
          return;
        }
        let clientX = 0;
        let clientY = 0;
        if (ev.type === 'touchmove' && 'touches' in ev) {
          if (ev.touches.length === 0) {
            return;
          }
          clientX = ev.touches[0]!.clientX;
          clientY = ev.touches[0]!.clientY;
        } else if ('clientY' in ev) {
          clientX = (ev as PointerEvent).clientX;
          clientY = (ev as PointerEvent).clientY;
        } else {
          return;
        }
        const global = this.mapClientToGlobal(clientX, clientY);
        const local = this.container.toLocal(global);
        this.updateDragAtLocal(local.x, local.y);
        if (ev.type === 'touchmove') {
          (ev as TouchEvent).preventDefault();
        }
      };

      const onDomEnd = () => {
        if (!this.dragState || this.dragState.snap) {
          return;
        }
        this.releaseDragAtLocal(this.dragState.lastLocalX, this.dragState.lastLocalY);
      };

      el.addEventListener('pointermove', onDomMove as EventListener, true);
      el.addEventListener('touchmove', onDomMove as EventListener, { capture: true, passive: false });
      el.addEventListener('pointerup', onDomEnd, true);
      el.addEventListener('pointercancel', onDomEnd, true);
      el.addEventListener('touchend', onDomEnd, true);
      el.addEventListener('touchcancel', onDomEnd, true);
      cleanups.push(() => {
        el.removeEventListener('pointermove', onDomMove as EventListener, true);
        el.removeEventListener('touchmove', onDomMove as EventListener, { capture: true } as AddEventListenerOptions);
        el.removeEventListener('pointerup', onDomEnd, true);
        el.removeEventListener('pointercancel', onDomEnd, true);
        el.removeEventListener('touchend', onDomEnd, true);
        el.removeEventListener('touchcancel', onDomEnd, true);
      });
      this.dragUsesDom = true;
    }

    this.trayRoot.eventMode = 'none';
    this.toolsRoot.eventMode = 'none';

    this.dragListenerCleanup = () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
      this.trayRoot.eventMode = 'passive';
      this.toolsRoot.eventMode = 'passive';
      this.dragUsesDom = false;
    };
  }

  private detachDragPointerBridge(): void {
    this.dragListenerCleanup?.();
    this.dragListenerCleanup = null;
    this.dragUsesDom = false;
  }

  private updateDragAtLocal(localX: number, localY: number): void {
    if (!this.dragState || this.dragState.snap) {
      return;
    }
    this.dragState.lastLocalX = localX;
    this.dragState.lastLocalY = localY;
    this.dragState.node.position.set(localX, localY + DRAG_LIFT_OFFSET_Y);
    const nextHighlight = this.resolveDropCellIndex(localX, localY);
    const hoveredCell = this.getAnyBoardCellIndexAt(localX, localY);
    const nextBlocked = nextHighlight < 0
      && hoveredCell >= 0
      && (this.board[hoveredCell]?.tray || this.board[hoveredCell]?.blocker)
      && !this.isCellLocked(hoveredCell)
      ? hoveredCell
      : -1;
    if (nextHighlight !== this.dropHighlightIndex || nextBlocked !== this.blockedDropIndex) {
      this.dropHighlightIndex = nextHighlight;
      this.blockedDropIndex = nextBlocked;
      this.renderBoard();
    }
  }

  private releaseDragAtLocal(localX: number, localY: number): void {
    if (!this.dragState || this.dragState.snap) {
      return;
    }
    this.detachDragPointerBridge();
    const cellIndex = this.resolveDropCellIndex(localX, localY);
    if (cellIndex >= 0) {
      this.dragCancelMessage = '';
      this.startDragSnap('place', cellIndex, this.getBoardCellWorldPos(cellIndex));
      return;
    }
    const direct = this.getAnyBoardCellIndexAt(localX, localY);
    if (direct >= 0 && (this.board[direct]?.tray || this.board[direct]?.blocker)) {
      this.spawnInvalidDropEffect(direct);
    }
    this.dragCancelMessage = direct >= 0 && this.board[direct]?.blocker
      ? '这个格子还没解锁，不能放托盘。'
      : direct >= 0 && this.board[direct]?.tray
        ? '这里已经有托盘了，只能放到空格里。'
      : '拖到中间阴影格里再松手放置。';
    this.startDragSnap('cancel', -1, this.getPendingTrayWorldPos(this.dragState.pendingIndex));
  }

  private getPendingTrayWorldPos(index: number): { x: number; y: number } {
    return {
      x: this.trayRoot.x + PENDING_TRAY_SLOT_START_X + index * PENDING_TRAY_SLOT_STEP,
      y: this.trayRoot.y,
    };
  }

  private getBoardCellWorldPos(cellIndex: number): { x: number; y: number } {
    const cell = this.board[cellIndex];
    if (!cell) {
      return { x: this.boardRoot.x, y: this.boardRoot.y };
    }
    const local = this.getCellLocalCenter(cell);
    return {
      x: this.boardRoot.x + local.x,
      y: this.boardRoot.y + local.y,
    };
  }

  private resolveDropCellIndex(stageX: number, stageY: number): number {
    const direct = this.getBoardCellIndexAt(stageX, stageY);
    if (direct >= 0 && !this.board[direct]?.tray) {
      return direct;
    }
    let best = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const cell of this.board) {
      if (cell.tray || cell.blocker || this.isCellLocked(cell.index)) {
        continue;
      }
      const world = this.getBoardCellWorldPos(cell.index);
      const dist = Math.hypot(stageX - world.x, stageY - world.y);
      if (dist <= DROP_SNAP_RADIUS && dist < bestDist) {
        bestDist = dist;
        best = cell.index;
      }
    }
    return best;
  }

  private startDragSnap(
    kind: 'place' | 'cancel',
    cellIndex: number,
    target: { x: number; y: number },
  ): void {
    if (!this.dragState) {
      return;
    }
    const node = this.dragState.node;
    this.dragState.snap = {
      kind,
      cellIndex,
      fromX: node.x,
      fromY: node.y,
      toX: target.x,
      toY: target.y,
      elapsed: 0,
      duration: DRAG_SNAP_DURATION,
    };
    node.rotation = 0;
    this.dropHighlightIndex = kind === 'place' ? cellIndex : -1;
    this.blockedDropIndex = -1;
    this.renderBoard();
  }

  private updateDragSnap(dt: number): void {
    if (!this.dragState?.snap) {
      return;
    }
    const snap = this.dragState.snap;
    snap.elapsed += dt;
    const t = Math.min(1, snap.elapsed / snap.duration);
    const eased = 1 - (1 - t) ** 3;
    const node = this.dragState.node;
    node.position.set(
      snap.fromX + (snap.toX - snap.fromX) * eased,
      snap.fromY + (snap.toY - snap.fromY) * eased,
    );
    if (snap.kind === 'place') {
      const lift = DRAG_LIFT_OFFSET_Y * (1 - eased);
      node.position.y += lift;
      node.scale.set(1.08 - 0.08 * eased);
    } else {
      node.scale.set(1.08 - 0.04 * eased);
    }
    if (t >= 1) {
      this.finishDragSnap();
    }
  }

  private finishDragSnap(): void {
    if (!this.dragState?.snap) {
      return;
    }
    const { kind, cellIndex } = this.dragState.snap;
    const pendingIndex = this.dragState.pendingIndex;
    if (kind === 'place' && cellIndex >= 0) {
      this.placePendingTrayAtCell(pendingIndex, cellIndex);
    } else if (this.dragCancelMessage) {
      this.setMessage(this.dragCancelMessage);
      this.dragCancelMessage = '';
    }
    this.endDrag(false);
    this.dropHighlightIndex = -1;
    this.blockedDropIndex = -1;
    this.renderAll();
  }

  private endDrag(render = true): void {
    this.detachDragPointerBridge();
    if (!this.dragState) {
      return;
    }
    if (this.dragState.node.parent) {
      this.dragState.node.parent.removeChild(this.dragState.node);
    }
    this.dragState.node.destroy({ children: true });
    this.dragState = null;
    this.dragCancelMessage = '';
    this.dropHighlightIndex = -1;
    this.blockedDropIndex = -1;
    if (render) {
      this.renderAll();
    }
  }

  private getBoardCellIndexAt(stageX: number, stageY: number): number {
    const index = this.getAnyBoardCellIndexAt(stageX, stageY);
    if (index >= 0 && !this.board[index]?.tray && !this.board[index]?.blocker && !this.isCellLocked(index)) {
      return index;
    }
    return -1;
  }

  private getAnyBoardCellIndexAt(stageX: number, stageY: number): number {
    const x = stageX - this.boardRoot.x;
    const y = stageY - this.boardRoot.y;
    for (const cell of this.board) {
      const local = this.getCellLocalCenter(cell);
      if (
        x >= local.x - BOARD_CELL_W / 2
        && x <= local.x + BOARD_CELL_W / 2
        && y >= local.y - BOARD_CELL_H / 2
        && y <= local.y + BOARD_CELL_H / 2
      ) {
        return cell.index;
      }
    }
    return -1;
  }

  /** 新放下的托盘与相邻已有托盘交换整理：共有饮品集中到已有托盘，其它饮品换回新托盘 */
  private mergeFromPlacedTray(placedCellIndex: number): number {
    const placedCell = this.board[placedCellIndex];
    const placedTray = placedCell?.tray;
    if (!placedTray) {
      return 0;
    }

    const moves = this.buildMergeMoves(placedCell);
    for (const move of moves) {
      this.spawnDrinkFlyAnimation(
        move.sourceCell,
        move.targetCell,
        move.drinkId,
        move.sourceSlot,
        move.targetSlot,
        move.staggerIndex,
      );
    }

    const outgoingFromPlaced = moves.filter((move) => move.sourceCell.index === placedCellIndex).length;
    const incomingToPlaced = moves.filter((move) => move.targetCell.index === placedCellIndex).length;
    const willEmptyPlacedTray = moves.length > 0
      && placedTray.drinks.length - outgoingFromPlaced + incomingToPlaced <= 0;
    if (willEmptyPlacedTray) {
      this.pendingEmptyTrayCells.add(placedCellIndex);
    }

    return moves.length;
  }

  private buildMergeMoves(placedCell: BoardCell): MergeMove[] {
    const placedTray = placedCell.tray;
    if (!placedTray) {
      return [];
    }

    const moves: MergeMove[] = [];
    let stagger = 0;
    const simulatedPlaced = [...placedTray.drinks];
    const neighbors = this.getNeighbors(placedCell).filter((neighbor) => neighbor.tray);
    const simulatedTargets = new Map<number, DrinkId[]>();
    for (const neighbor of neighbors) {
      if (neighbor.tray) {
        simulatedTargets.set(neighbor.index, [...neighbor.tray.drinks]);
      }
    }

    const pendingNeighborIndexes = new Set(neighbors.map((neighbor) => neighbor.index));
    while (pendingNeighborIndexes.size > 0) {
      const candidate = this.pickBestMergeTargetCandidate(
        simulatedPlaced,
        neighbors.filter((neighbor) => pendingNeighborIndexes.has(neighbor.index)),
        simulatedTargets,
      );
      if (!candidate || simulatedPlaced.length === 0) {
        break;
      }
      pendingNeighborIndexes.delete(candidate.neighbor.index);

      const neighbor = candidate.neighbor;
      const targetDrinks = simulatedTargets.get(neighbor.index);
      if (!targetDrinks) {
        continue;
      }
      const sharedDrinkId = candidate.sharedDrinkId;

      const placedSharedSlots = this.getDrinkSlots(simulatedPlaced, sharedDrinkId);
      const targetOtherSlots = targetDrinks
        .map((drinkId, index) => ({ drinkId, index }))
        .filter((entry) => entry.drinkId !== sharedDrinkId);

      const targetSharedCount = this.countDrinkIds(targetDrinks, sharedDrinkId);
      const maxSharedToTarget = Math.max(0, TRAY_CAPACITY - targetSharedCount);
      const sharedToMove = placedSharedSlots.slice(0, maxSharedToTarget);
      const placedCapacityAfterSharedLeaves = TRAY_CAPACITY - (simulatedPlaced.length - sharedToMove.length);
      const otherToMove = targetOtherSlots.slice(0, Math.max(0, placedCapacityAfterSharedLeaves));

      for (let i = otherToMove.length - 1; i >= 0; i -= 1) {
        const entry = otherToMove[i]!;
        moves.push({
          sourceCell: neighbor,
          targetCell: placedCell,
          drinkId: entry.drinkId,
          sourceSlot: entry.index,
          targetSlot: simulatedPlaced.length - sharedToMove.length + (otherToMove.length - 1 - i),
          staggerIndex: stagger,
        });
        stagger += 1;
      }

      for (let i = sharedToMove.length - 1; i >= 0; i -= 1) {
        const sourceSlot = sharedToMove[i]!;
        moves.push({
          sourceCell: placedCell,
          targetCell: neighbor,
          drinkId: sharedDrinkId,
          sourceSlot,
          targetSlot: targetSharedCount + (sharedToMove.length - 1 - i),
          staggerIndex: stagger,
        });
        stagger += 1;
      }

      for (let i = sharedToMove.length - 1; i >= 0; i -= 1) {
        simulatedPlaced.splice(sharedToMove[i]!, 1);
      }
      for (let i = otherToMove.length - 1; i >= 0; i -= 1) {
        targetDrinks.splice(otherToMove[i]!.index, 1);
      }
      simulatedPlaced.push(...otherToMove.map((entry) => entry.drinkId));
      targetDrinks.push(...sharedToMove.map(() => sharedDrinkId));
      targetDrinks.splice(0, targetDrinks.length, ...this.compactDrinkIds(targetDrinks, sharedDrinkId));
    }

    return moves;
  }

  private pickBestMergeTargetCandidate(
    placedDrinks: DrinkId[],
    neighbors: BoardCell[],
    simulatedTargets: Map<number, DrinkId[]>,
  ): MergeTargetCandidate | null {
    let best: MergeTargetCandidate | null = null;
    for (const neighbor of neighbors) {
      const targetDrinks = simulatedTargets.get(neighbor.index);
      if (!targetDrinks) {
        continue;
      }
      const candidate = this.createMergeTargetCandidate(placedDrinks, neighbor, targetDrinks);
      if (!candidate) {
        continue;
      }
      if (!best || this.compareMergeTargetCandidate(candidate, best) < 0) {
        best = candidate;
      }
    }
    return best;
  }

  private createMergeTargetCandidate(
    placedDrinks: DrinkId[],
    neighbor: BoardCell,
    targetDrinks: DrinkId[],
  ): MergeTargetCandidate | null {
    let bestDrinkId: DrinkId | null = null;
    let bestSharedCount = 0;
    let bestSharedToMoveCount = 0;
    let bestOtherToMoveCount = 0;
    for (const drinkId of new Set(placedDrinks)) {
      const targetSharedCount = this.countDrinkIds(targetDrinks, drinkId);
      if (targetSharedCount <= 0) {
        continue;
      }
      const placedSharedCount = this.countDrinkIds(placedDrinks, drinkId);
      const sharedToMoveCount = Math.min(placedSharedCount, Math.max(0, TRAY_CAPACITY - targetSharedCount));
      if (sharedToMoveCount <= 0) {
        continue;
      }
      const targetOtherCount = targetDrinks.length - targetSharedCount;
      const placedCapacityAfterSharedLeaves = TRAY_CAPACITY - (placedDrinks.length - sharedToMoveCount);
      const otherToMoveCount = Math.min(targetOtherCount, Math.max(0, placedCapacityAfterSharedLeaves));
      if (
        !bestDrinkId
        || targetSharedCount > bestSharedCount
        || (targetSharedCount === bestSharedCount && sharedToMoveCount > bestSharedToMoveCount)
        || (targetSharedCount === bestSharedCount
          && sharedToMoveCount === bestSharedToMoveCount
          && otherToMoveCount > bestOtherToMoveCount)
      ) {
        bestDrinkId = drinkId;
        bestSharedCount = targetSharedCount;
        bestSharedToMoveCount = sharedToMoveCount;
        bestOtherToMoveCount = otherToMoveCount;
      }
    }
    if (!bestDrinkId) {
      return null;
    }
    return {
      neighbor,
      sharedDrinkId: bestDrinkId,
      targetSharedCount: bestSharedCount,
      targetFillCount: targetDrinks.length,
      sharedToMoveCount: bestSharedToMoveCount,
      otherToMoveCount: bestOtherToMoveCount,
    };
  }

  private compareMergeTargetCandidate(a: MergeTargetCandidate, b: MergeTargetCandidate): number {
    const aMissingForFullColor = TRAY_CAPACITY - a.targetSharedCount;
    const bMissingForFullColor = TRAY_CAPACITY - b.targetSharedCount;
    if (aMissingForFullColor !== bMissingForFullColor) {
      return aMissingForFullColor - bMissingForFullColor;
    }
    if (a.targetFillCount !== b.targetFillCount) {
      return b.targetFillCount - a.targetFillCount;
    }
    if (a.sharedToMoveCount !== b.sharedToMoveCount) {
      return b.sharedToMoveCount - a.sharedToMoveCount;
    }
    if (a.otherToMoveCount !== b.otherToMoveCount) {
      return b.otherToMoveCount - a.otherToMoveCount;
    }
    return a.neighbor.index - b.neighbor.index;
  }

  private getDrinkSlots(drinks: DrinkId[], drinkId: DrinkId): number[] {
    const slots: number[] = [];
    drinks.forEach((id, index) => {
      if (id === drinkId) {
        slots.push(index);
      }
    });
    return slots;
  }

  private findLastDrinkSlot(tray: Tray, drinkId: DrinkId): number {
    return this.findLastDrinkSlotInList(tray.drinks, drinkId);
  }

  private findLastDrinkSlotInList(drinks: DrinkId[], drinkId: DrinkId): number {
    for (let i = drinks.length - 1; i >= 0; i -= 1) {
      if (drinks[i] === drinkId) {
        return i;
      }
    }
    return Math.max(0, drinks.length - 1);
  }

  private refillPendingBatch(): void {
    this.pendingTrays = [];
    for (let i = 0; i < BOTTOM_TRAY_COUNT; i += 1) {
      this.pendingTrays.push(this.createNextTray());
    }
  }

  private refreshOrderBatch(): void {
    const pool = this.activeDrinks.map((drink) => drink.id);
    this.orders = [];
    const orderCount = this.currentRound.ordersPerBag[this.delivered] ?? this.currentRound.ordersPerBag[0] ?? 3;
    for (let i = 0; i < orderCount; i += 1) {
      this.orders.push(pool[this.nextRandom() % pool.length]!);
    }
    this.orderCompleted = Array.from({ length: orderCount }, () => false);
  }

  private countCompletedOrderSlots(): number {
    return this.orderCompleted.reduce((count, done) => count + (done ? 1 : 0), 0);
  }

  private findOpenOrderIndex(drinkId: DrinkId): number {
    return this.orders.findIndex((id, index) => id === drinkId && !this.orderCompleted[index]);
  }

  private countDrink(tray: Tray, drinkId: DrinkId): number {
    return this.countDrinkIds(tray.drinks, drinkId);
  }

  private countDrinkIds(drinks: DrinkId[], drinkId: DrinkId): number {
    return drinks.reduce((count, id) => count + (id === drinkId ? 1 : 0), 0);
  }

  private removeDrinkAtSlot(tray: Tray | null, drinkId: DrinkId, slot: number): void {
    if (!tray) {
      return;
    }
    if (tray.drinks[slot] === drinkId) {
      tray.drinks.splice(slot, 1);
      return;
    }
    const fallback = this.findLastDrinkSlot(tray, drinkId);
    if (tray.drinks[fallback] === drinkId) {
      tray.drinks.splice(fallback, 1);
    }
  }

  private compactDrinkInTray(tray: Tray, drinkId: DrinkId): void {
    tray.drinks = this.compactDrinkIds(tray.drinks, drinkId);
  }

  private compactDrinkIds(drinks: DrinkId[], drinkId: DrinkId): DrinkId[] {
    const same = drinks.filter((id) => id === drinkId);
    const other = drinks.filter((id) => id !== drinkId);
    return [...same, ...other];
  }

  private getNeighbors(cell: BoardCell): BoardCell[] {
    const result: BoardCell[] = [];
    const offsets = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
    ];
    for (const offset of offsets) {
      const row = cell.row + offset.row;
      const col = cell.col + offset.col;
      if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
        continue;
      }
      result.push(this.board[row * BOARD_COLS + col]);
    }
    return result;
  }

  private weakenAdjacentCrates(cell: BoardCell): { weakened: number; opened: number } {
    let weakened = 0;
    let opened = 0;
    for (const neighbor of this.getNeighbors(cell)) {
      if (neighbor.blocker?.kind !== 'crate') {
        continue;
      }
      if (neighbor.blocker.seal === 'full') {
        neighbor.blocker.seal = 'half';
        weakened += 1;
        this.spawnCellUnlockEffect(neighbor);
        continue;
      }
      neighbor.blocker = null;
      this.spawnCellUnlockEffect(neighbor);
      opened += 1;
    }
    return { weakened, opened };
  }

  private formatCrateChangeMessage(change: { weakened: number; opened: number }): string {
    const parts: string[] = [];
    if (change.opened > 0) {
      parts.push(`${change.opened} 个木板已打开`);
    }
    if (change.weakened > 0) {
      parts.push(`${change.weakened} 个木板已变半封`);
    }
    return parts.length > 0 ? `旁边 ${parts.join('，')}。` : '';
  }

  private tryDeliverCompletedTrays(): number {
    let scheduled = 0;
    for (const cell of this.board) {
      if (!cell.tray || this.pendingDeliveries.has(cell.index) || this.isCellLocked(cell.index)) {
        continue;
      }
      const drinkId = this.getCompleteTrayDrink(cell.tray);
      if (!drinkId) {
        continue;
      }
      const orderIndex = this.findOpenOrderIndex(drinkId);
      if (orderIndex < 0) {
        this.spawnOverflowTrayExit(cell, drinkId);
        scheduled += 1;
        continue;
      }
      this.pendingDeliveries.set(cell.index, { drinkId, orderIndex });
      this.spawnDeliveryReadyEffect(cell);
      Haptics.light();
      this.spawnOrderDeliveryCupFlights(cell, drinkId);
      scheduled += 1;
    }
    if (scheduled > 0) {
      this.renderBoard();
    }
    return scheduled;
  }

  private getCompleteTrayDrink(tray: Tray): DrinkId | null {
    if (tray.drinks.length !== TRAY_CAPACITY) {
      return null;
    }
    const drinkId = tray.drinks[0];
    return drinkId && tray.drinks.every((id) => id === drinkId) ? drinkId : null;
  }

  private nextOrderDrinkId(): DrinkId {
    const openOrder = this.orders.find((_, index) => !this.orderCompleted[index]);
    if (openOrder) {
      return openOrder;
    }
    return this.activeDrinks[this.nextRandom() % this.activeDrinks.length].id;
  }

  private checkRoundState(): void {
    if (this.isRoundComplete()) {
      this.setMessage('本局订单全部完成，可以继续下一局。');
      return;
    }
    const hasEmptyCell = this.board.some((cell) => !cell.tray && !cell.blocker);
    if (!hasEmptyCell && !this.hasActiveBoardMotion()) {
      const scheduled = this.tryDeliverCompletedTrays();
      if (scheduled > 0 || this.hasActiveBoardMotion()) {
        return;
      }
      this.showRoundFailOverlay();
    }
  }

  private settleRoundIfNeeded(): void {
    if (this.roundSettled) {
      return;
    }
    this.roundSettled = true;
    const fiveOrderBagCount = this.currentRound.ordersPerBag.filter((count) => count >= 5).length;
    const result = settleMilkTeaShopRound({
      shopLevel: this.currentRound.shopLevel,
      orderBagCount: this.currentRound.orderBagCount,
      fiveOrderBagCount,
      drinkTypeCount: this.currentRound.drinkTypeCount,
    });
    this.coinBar.refresh();
    this.coinBar.bump();
    this.renderShopStatus();
    analytics.track('milk_tea_shop_end', {
      result: 'clear',
      shop_level: this.currentRound.shopLevel,
      order_bag_count: this.currentRound.orderBagCount,
      drink_type_count: this.currentRound.drinkTypeCount,
      coins: result.coins,
      level_ups: result.levelUps,
      total_clears: result.state.totalClears,
      next_shop_level: result.state.shopLevel,
    });
    this.showRoundClearOverlay(result);
  }

  private playOrderBagBatchCompleteFeedback(isFinalBag: boolean): void {
    if (isFinalBag) {
      Haptics.medium();
    } else {
      Haptics.light();
    }
    AudioManager.playOrderCompleteSound();
  }

  private spawnOrderBagExitEffect(onComplete?: () => void): void {
    const { x: fromX, y: fromY } = this.getOrderBagWorldPos();
    this.orderBagExiting = true;
    this.renderOrders();
    this.spawnOrderBagCompleteBurst(fromX, fromY);
    const bag = this.createOrderBagVisual(ORDER_BAG_W, ORDER_BAG_H);
    bag.position.set(fromX, fromY);
    this.overlayRoot.addChild(bag);
    let nextTrailAt = 0.08;
    this.deliveryAnimations.push({
      node: bag,
      fromX,
      fromY,
      toX: ORDER_BAG_EXIT_X,
      toY: fromY,
      elapsed: 0,
      duration: 0.46,
      slideOnly: true,
      onUpdate: (t, x, y) => {
        if (t >= nextTrailAt) {
          this.spawnOrderBagTrailSpark(x + 18, y - 10 + Math.sin(t * Math.PI * 5) * 18);
          nextTrailAt += 0.11;
        }
      },
      onComplete: () => {
        this.orderBagExiting = false;
        onComplete?.();
      },
    });
  }

  private clearRoundStartBannerTicker(): void {
    if (this.roundStartBannerTicker) {
      Game.ticker.remove(this.roundStartBannerTicker);
      this.roundStartBannerTicker = null;
    }
  }

  private dismissRoundStartBanner(): void {
    this.clearRoundStartBannerTicker();
    if (this.roundStartBannerNode) {
      if (this.roundStartBannerNode.parent) {
        this.roundStartBannerNode.parent.removeChild(this.roundStartBannerNode);
      }
      this.roundStartBannerNode.destroy({ children: true });
      this.roundStartBannerNode = null;
    }
    this.roundStartBannerOpen = false;
  }

  private showRoundStartBanner(onComplete: () => void): void {
    this.dismissRoundStartBanner();
    this.roundStartBannerOpen = true;
    this.renderTools();
    this.renderPendingTrays();

    const W = Game.logicWidth;
    const bannerY = Game.safeTop + 725;
    const bannerTex = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.roundStartBanner);
    const root = new PIXI.Container();
    root.eventMode = 'none';

    let finalScale = 1;
    if (bannerTex) {
      const banner = new PIXI.Sprite(bannerTex);
      banner.anchor.set(0.5);
      finalScale = Math.min((W * 0.88) / bannerTex.width, 190 / bannerTex.height);
      root.addChild(banner);
    } else {
      const title = new PIXI.Text('开始营业', {
        fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
        fontSize: 52,
        fill: 0xfff05a,
        fontWeight: '900',
        stroke: 0x7b2a10,
        strokeThickness: 8,
        dropShadow: true,
        dropShadowBlur: 4,
        dropShadowDistance: 2,
        dropShadowColor: 0x4a2410,
        align: 'center',
      });
      title.anchor.set(0.5);
      root.addChild(title);
    }

    const startX = W + 240;
    const targetX = W / 2;
    root.position.set(startX, bannerY);
    root.alpha = 0;
    root.scale.set(finalScale * 0.72);
    this.overlayRoot.addChild(root);
    this.roundStartBannerNode = root;

    let phase: 'in' | 'hold' | 'out' = 'in';
    let t = 0;
    const inDur = 0.46;
    const holdDur = 0.85;
    const outDur = 0.42;

    this.roundStartBannerTicker = (): void => {
      const banner = this.roundStartBannerNode;
      if (!banner || banner.destroyed) {
        this.clearRoundStartBannerTicker();
        return;
      }
      t += Game.ticker.deltaMS / 1000;
      if (phase === 'in') {
        const p = Math.min(t / inDur, 1);
        const e = 1 - (1 - p) ** 3;
        banner.alpha = Math.min(1, p * 1.15);
        banner.x = startX + (targetX - startX) * e;
        const bounce = 1 + 0.04 * Math.sin(p * Math.PI);
        const s = (finalScale * 0.72 + (finalScale - finalScale * 0.72) * e) * (p < 1 ? bounce : 1);
        banner.scale.set(s, s);
        if (p >= 1) {
          banner.alpha = 1;
          banner.x = targetX;
          banner.scale.set(finalScale, finalScale);
          phase = 'hold';
          t = 0;
        }
        return;
      }
      if (phase === 'hold') {
        if (t >= holdDur) {
          phase = 'out';
          t = 0;
        }
        return;
      }
      const p = Math.min(t / outDur, 1);
      const e = p * p;
      banner.x = targetX + (-240 - targetX) * e;
      banner.alpha = 1 - Math.max(0, p - 0.55) / 0.45;
      if (p >= 1) {
        this.clearRoundStartBannerTicker();
        this.dismissRoundStartBanner();
        this.renderTools();
        this.renderPendingTrays();
        onComplete();
      }
    };
    Game.ticker.add(this.roundStartBannerTicker);
  }

  private spawnOrderBagEnterEffect(onComplete?: () => void): void {
    const { x: toX, y: toY } = this.getOrderBagWorldPos();
    this.orderBagEntering = true;
    this.renderOrders();
    const fromX = Game.logicWidth + 100;
    const bag = this.createOrderBagVisual(ORDER_BAG_W, ORDER_BAG_H);
    bag.position.set(fromX, toY);
    this.overlayRoot.addChild(bag);
    this.deliveryAnimations.push({
      node: bag,
      fromX,
      fromY: toY,
      toX,
      toY,
      elapsed: 0,
      duration: 0.38,
      slideOnly: true,
      onComplete: () => {
        this.orderBagEntering = false;
        this.renderOrders();
        onComplete?.();
      },
    });
  }

  private showRoundClearOverlay(result: MilkTeaShopRoundRewardResult): void {
    AudioManager.playBadgeUnlockSound();
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.hitArea = new PIXI.Rectangle(0, 0, W, H);

    const dim = new PIXI.Graphics();
    dim.beginFill(0x3a2416, 0.38);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    root.addChild(dim);

    const card = new PIXI.Container();
    const panelInfo = this.mountResultPanelSprite(
      card,
      result.levelUps > 0
        ? MILK_TEA_DEMO_TEXTURE_KEYS.resultPanelLevelUp
        : MILK_TEA_DEMO_TEXTURE_KEYS.resultPanelClear,
      result.levelUps > 0 ? 520 : 500,
    );
    card.position.set(W / 2, H / 2 - 52);

    if (result.levelUps > 0) {
      this.mountLevelUpResultContent(card, result);
    } else {
      this.mountClearResultContent(card, result);
    }

    const nextButton = new PIXI.Container();
    nextButton.eventMode = 'static';
    nextButton.cursor = 'pointer';
    nextButton.hitArea = new PIXI.Rectangle(-150, -44, 300, 88);
    nextButton.position.set(0, panelInfo.height / 2 - 78);
    nextButton.on('pointertap', () => {
      AudioManager.playButtonSound();
      if (root.parent) {
        root.parent.removeChild(root);
      }
      root.destroy({ children: true });
      this.startRound();
    });
    card.addChild(nextButton);
    root.addChild(card);
    this.mountClearShareReward(root, W / 2, card.position.y + panelInfo.height / 2 + 58, result);
    this.overlayRoot.addChild(root);
  }

  private mountClearShareReward(
    root: PIXI.Container,
    centerX: number,
    centerY: number,
    result: MilkTeaShopRoundRewardResult,
  ): void {
    let canClaim = canClaimMilkTeaShopDailyShareReward();
    let busy = false;

    const shareButton = this.createShareRewardButton();
    shareButton.position.set(centerX, centerY);
    root.addChild(shareButton);

    const rewardRow = new PIXI.Container();
    rewardRow.position.set(centerX, centerY + 62);
    root.addChild(rewardRow);

    const coinIcon = createCoinIcon(14);
    coinIcon.position.set(-58, 0);
    rewardRow.addChild(coinIcon);

    const rewardHint = new PIXI.Text('', {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x3b2316,
      strokeThickness: 4,
      lineJoin: 'round',
    });
    rewardHint.anchor.set(0, 0.5);
    rewardHint.resolution = 2;
    rewardHint.position.set(-38, 0);
    rewardRow.addChild(rewardHint);

    const refresh = (): void => {
      const showRewardHint = canClaim;
      rewardRow.visible = showRewardHint;
      if (showRewardHint) {
        rewardHint.text = `+${MILK_TEA_SHOP_DAILY_SHARE_REWARD_COINS}（今日0/1）`;
      }
      shareButton.alpha = 1;
      shareButton.eventMode = !busy ? 'static' : 'none';
      shareButton.cursor = !busy ? 'pointer' : 'default';
    };
    refresh();

    shareButton.on('pointertap', () => {
      if (busy) {
        return;
      }
      if (!canClaim) {
        AudioManager.playButtonSound();
        void shareGameForReward({
          title: pickMilkTeaShopClearShareTitle(result.levelUps),
          imageUrl: MILK_TEA_SHOP_CLEAR_SHARE_CARD_PATH,
          query: 'from=share&entry=milk_tea_shop_clear',
        });
        return;
      }
      busy = true;
      refresh();
      AudioManager.playButtonSound();
      void (async () => {
        const shareResult = await shareGameForReward({
          title: pickMilkTeaShopClearShareTitle(result.levelUps),
          imageUrl: MILK_TEA_SHOP_CLEAR_SHARE_CARD_PATH,
          query: 'from=share&entry=milk_tea_shop_clear',
        });
        if (shareResult === 'unavailable') {
          this.showToolToast('请在微信小游戏中分享');
        } else if (shareResult === 'failed') {
          this.showToolToast('分享未完成，请稍后再试');
        } else {
          const coins = claimMilkTeaShopDailyShareReward();
          if (coins) {
            canClaim = false;
            this.coinBar.refresh();
            this.coinBar.bump();
            this.showToolToast(`分享成功，金币 +${coins}`);
            analytics.track('milk_tea_shop_clear_share', {
              shop_level: this.currentRound.shopLevel,
              coins,
              claimed: true,
            });
          } else {
            canClaim = false;
            this.showToolToast('今日分享奖励已领取');
          }
        }
        busy = false;
        refresh();
      })();
    });
  }

  private createShareRewardButton(): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    const tex = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.shareRewardButton);
    if (tex) {
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      const scale = Math.min(1, 300 / tex.width, 88 / tex.height);
      sprite.scale.set(scale);
      root.hitArea = new PIXI.Rectangle(
        (-tex.width * scale) / 2,
        (-tex.height * scale) / 2,
        tex.width * scale,
        tex.height * scale,
      );
      root.addChild(sprite);
      return root;
    }
    return this.createPillButton('分享', 230, 70, 0x9be45c, 0x6c7a19);
  }

  private mountClearResultContent(card: PIXI.Container, result: MilkTeaShopRoundRewardResult): void {
    const coinIcon = createCoinIcon(42);
    coinIcon.position.set(-112, 16);
    card.addChild(coinIcon);
    const coinText = this.createResultText(`金币 +${result.coins}`, 34, 0xd06a10);
    coinText.anchor.set(0, 0.5);
    coinText.position.set(-62, 16);
    card.addChild(coinText);

    const nextLevelDef = getMilkTeaShopLevelDef(result.state.shopLevel);
    if (nextLevelDef.clearsToNext > 0) {
      const remaining = Math.max(0, nextLevelDef.clearsToNext - result.state.clearsInLevel);
      const targetLevel = getMilkTeaShopLevelDef(result.state.shopLevel + 1).level;
      const hint = this.createEmphasizedResultLine([
        { text: '再完成', fontSize: 27, fill: 0x7a421d },
        { text: `${remaining}`, fontSize: 36, fill: 0xd06a10 },
        { text: '局，果茶店可升级到', fontSize: 27, fill: 0x7a421d },
        { text: `${targetLevel}`, fontSize: 36, fill: 0xd06a10 },
        { text: '级', fontSize: 27, fill: 0x7a421d },
      ]);
      hint.position.set(0, 92);
      card.addChild(hint);
    } else {
      const hintText = this.createResultText('已达到最高等级', 30, 0x7a421d);
      hintText.position.set(0, 92);
      card.addChild(hintText);
    }
  }

  private mountLevelUpResultContent(card: PIXI.Container, result: MilkTeaShopRoundRewardResult): void {
    const levelText = this.createResultText(`Lv.${result.previousLevel} → Lv.${result.state.shopLevel}`, 32, 0x8a4217);
    levelText.position.set(0, -56);
    card.addChild(levelText);

    const coinIcon = createCoinIcon(34);
    coinIcon.position.set(-96, 8);
    card.addChild(coinIcon);
    const coinText = this.createResultText(`金币 +${result.coins}`, 28, 0xd06a10);
    coinText.anchor.set(0, 0.5);
    coinText.position.set(-52, 8);
    card.addChild(coinText);

    const previousDef = getMilkTeaShopLevelDef(result.previousLevel);
    const currentDef = getMilkTeaShopLevelDef(result.state.shopLevel);
    const unlocked = this.drinkDefs.slice(previousDef.unlockedDrinkCount, currentDef.unlockedDrinkCount).slice(0, 2);
    const shown = unlocked.length > 0 ? unlocked : this.activeDrinks.slice(0, 1);
    if (shown.length > 0) {
      this.mountLevelUpUnlockSection(card, shown, 64);
    }
  }

  private mountLevelUpUnlockSection(card: PIXI.Container, drinks: DrinkDef[], topY: number): void {
    const section = new PIXI.Container();
    section.position.set(0, topY);

    const cupHeight = 96;
    const columnStep = drinks.length > 1 ? 108 : 0;

    const prefix = this.createResultText('新饮品解锁：', 22, 0xa35c23, 3);
    prefix.anchor.set(0, 0);
    prefix.position.set(-156, 6);
    section.addChild(prefix);

    const drinksWrap = new PIXI.Container();
    drinks.forEach((drink, index) => {
      const column = this.createUnlockDrinkColumn(drink, cupHeight);
      column.position.set(index * columnStep, 0);
      drinksWrap.addChild(column);
    });
    drinksWrap.position.set(72, 30);
    section.addChild(drinksWrap);
    card.addChild(section);
  }

  private createUnlockDrinkColumn(drink: DrinkDef, cupHeight: number): PIXI.Container {
    const root = new PIXI.Container();
    const maxWidth = 92;
    const nameGap = 2;

    const cup = this.createDrinkVisual(drink.id, cupHeight, maxWidth);
    cup.position.set(0, 0);
    root.addChild(cup);

    const name = this.createResultText(drink.name, 21, 0x7a421d, 2);
    name.anchor.set(0.5, 0);
    name.position.set(0, cupHeight * 0.5 + nameGap);
    root.addChild(name);

    return root;
  }

  private showRoundFailOverlay(): void {
    if (this.failOverlayOpen || this.roundSettled || this.isRoundComplete()) {
      return;
    }
    this.failOverlayOpen = true;
    analytics.track('milk_tea_shop_end', {
      result: 'fail',
      shop_level: this.currentRound.shopLevel,
      delivered: this.delivered,
      order_bag_count: this.currentRound.orderBagCount,
      drink_type_count: this.currentRound.drinkTypeCount,
    });
    this.endDrag(false);
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.hitArea = new PIXI.Rectangle(0, 0, W, H);

    const dim = new PIXI.Graphics();
    dim.beginFill(0x3a2416, 0.38);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    root.addChild(dim);

    const card = new PIXI.Container();
    const panelInfo = this.mountResultPanelSprite(card, MILK_TEA_DEMO_TEXTURE_KEYS.resultPanelFail, 500);
    card.position.set(W / 2, H / 2 - 8);

    const retryButton = new PIXI.Container();
    retryButton.eventMode = 'static';
    retryButton.cursor = 'pointer';
    retryButton.hitArea = new PIXI.Rectangle(-90, -42, 180, 84);
    retryButton.position.set(-104, panelInfo.height / 2 - 166);
    retryButton.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.dismissOverlay(root);
      this.failOverlayOpen = false;
      this.startRound();
    });
    card.addChild(retryButton);

    const reviveButton = new PIXI.Container();
    reviveButton.eventMode = 'static';
    reviveButton.cursor = 'pointer';
    reviveButton.hitArea = new PIXI.Rectangle(-112, -42, 224, 84);
    reviveButton.position.set(110, panelInfo.height / 2 - 166);
    reviveButton.on('pointertap', () => {
      AudioManager.playButtonSound();
      void this.runReviveRewardedAction(root);
    });
    card.addChild(reviveButton);

    root.addChild(card);
    this.overlayRoot.addChild(root);
  }

  private async runReviveRewardedAction(panelRoot: PIXI.Container): Promise<void> {
    if (this.rewardedAdBusy) {
      this.showToolToast('广告加载中');
      return;
    }
    this.rewardedAdBusy = true;
    try {
      const result = await showRewardedAd({
        scene: 'milk_tea_fail_revive',
        extra: {
          shop_level: this.currentRound.shopLevel,
          delivered: this.delivered,
        },
      }, MILK_TEA_SHOP_REWARDED_AD_UNIT_ID);
      if (result === 'completed' || result === 'unavailable') {
        this.dismissOverlay(panelRoot);
        this.reviveByClearingBoard();
        analytics.track('milk_tea_shop_fail_revive', {
          shop_level: this.currentRound.shopLevel,
          delivered: this.delivered,
          ad_result: result,
        });
        return;
      }
      if (result === 'skipped') {
        this.showToolToast('看完广告后才能复活');
        return;
      }
      this.showToolToast('广告暂不可用，请稍后再试');
    } finally {
      this.rewardedAdBusy = false;
    }
  }

  private reviveByClearingBoard(): void {
    this.failOverlayOpen = false;
    for (const cell of this.board) {
      if (!cell.blocker) {
        cell.tray = null;
      }
    }
    this.pendingEmptyTrayCells.clear();
    this.pendingDeliveries.clear();
    this.submittingDeliveryCells.clear();
    this.vanishingEmptyTrayCells.clear();
    this.activeToolMode = null;
    this.dropHighlightIndex = -1;
    this.blockedDropIndex = -1;
    this.refillPendingBatch();
    this.setMessage('已清空棋盘托盘，继续完成本局订单。');
    this.renderAll();
  }

  private mountResultPanelSprite(root: PIXI.Container, textureKey: string, targetW: number): { width: number; height: number } {
    const tex = TextureCache.get(textureKey);
    if (!tex) {
      const fallbackH = targetW * 1.18;
      const bg = new PIXI.Graphics();
      bg.beginFill(0xfff5df, 0.98);
      bg.lineStyle(5, 0xd88a38, 1);
      bg.drawRoundedRect(-targetW / 2, -fallbackH / 2, targetW, fallbackH, 30);
      bg.endFill();
      root.addChild(bg);
      return { width: targetW, height: fallbackH };
    }
    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5);
    const scale = targetW / tex.width;
    sprite.scale.set(scale);
    root.addChild(sprite);
    return { width: targetW, height: tex.height * scale };
  }

  private createResultText(label: string, fontSize: number, fill: number, strokeThickness = 4): PIXI.Text {
    const text = new PIXI.Text(label, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize,
      fill,
      fontWeight: '900',
      stroke: 0xffffff,
      strokeThickness,
      lineJoin: 'round',
    });
    text.anchor.set(0.5);
    text.resolution = 2;
    return text;
  }

  private createEmphasizedResultLine(parts: Array<{ text: string; fontSize: number; fill: number }>): PIXI.Container {
    const root = new PIXI.Container();
    let cursorX = 0;
    const nodes = parts.map((part) => {
      const text = this.createResultText(part.text, part.fontSize, part.fill, 4);
      text.anchor.set(0, 0.5);
      text.position.set(cursorX, 0);
      cursorX += text.width;
      root.addChild(text);
      return text;
    });
    const totalW = nodes.reduce((width, node) => width + node.width, 0);
    root.pivot.set(totalW / 2, 0);
    return root;
  }

  private dismissOverlay(root: PIXI.Container): void {
    if (root.parent) {
      root.parent.removeChild(root);
    }
    root.destroy({ children: true });
  }

  private getBoardCupHeight(): number {
    return BOARD_TRAY_H * TRAY_CUP_HEIGHT_RATIO;
  }

  /** 合并 / 交付飞行期间：源盘保留飞出中的杯子，目标盘暂不显示未落地的杯子 */
  private getDisplayDrinkSlots(cell: BoardCell): Array<DrinkId | null> {
    const slots: Array<DrinkId | null> = Array.from({ length: TRAY_CAPACITY }, () => null);
    if (!cell.tray) {
      return slots;
    }
    if (this.pendingDeliveries.has(cell.index)) {
      cell.tray.drinks.slice(0, TRAY_CAPACITY).forEach((drinkId, index) => {
        slots[index] = drinkId;
      });
      for (const anim of this.flyAnimations) {
        if (
          anim.flyKind === 'delivery'
          && anim.sourceCellIndex === cell.index
          && anim.sourceSlot != null
          && anim.started
        ) {
          slots[anim.sourceSlot] = null;
        }
      }
      return slots;
    }
    cell.tray.drinks.slice(0, TRAY_CAPACITY).forEach((drinkId, index) => {
      slots[index] = drinkId;
    });
    return slots;
  }

  /** 容器本地坐标（与拖拽、托盘 snap 同一空间，勿用 toGlobal） */
  private getDrinkWorldPos(cell: BoardCell, slotIndex: number): { x: number; y: number } {
    const local = this.getCellLocalCenter(cell);
    const holes = this.trayHolePositions(BOARD_TRAY_W, BOARD_TRAY_H);
    const hole = holes[Math.min(slotIndex, holes.length - 1)] ?? { x: 0, y: 0 };
    const cupAnchorY = hole.y + BOARD_TRAY_H * 0.04;
    return {
      x: this.boardRoot.x + local.x + hole.x,
      y: this.boardRoot.y + local.y + cupAnchorY,
    };
  }

  private spawnDrinkFlyAnimation(
    sourceCell: BoardCell,
    targetCell: BoardCell,
    drinkId: DrinkId,
    sourceSlot: number,
    targetSlot: number,
    staggerIndex = 0,
  ): void {
    const from = this.getDrinkWorldPos(sourceCell, sourceSlot);
    const to = this.getDrinkWorldPos(targetCell, targetSlot);
    const cupHeight = this.getBoardCupHeight();
    const cup = this.createDrinkVisual(drinkId, cupHeight, undefined, 0.94);
    cup.position.set(from.x, from.y);
    cup.visible = false;
    this.overlayRoot.addChild(cup);
    this.flyAnimations.push({
      node: cup,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      baseScaleX: cup.scale.x,
      baseScaleY: cup.scale.y,
      elapsed: 0,
      duration: MERGE_FLY_DURATION,
      delay: staggerIndex * MERGE_FLY_STAGGER,
      sourceCellIndex: sourceCell.index,
      targetCellIndex: targetCell.index,
      drinkId,
      sourceSlot,
      flyKind: 'merge',
      onStart: () => {
        this.removeDrinkAtSlot(sourceCell.tray, drinkId, sourceSlot);
        this.spawnMergeLaunchSpark(from.x, from.y);
        this.renderBoard();
      },
      onLand: () => {
        if (targetCell.tray) {
          targetCell.tray.drinks.push(drinkId);
          this.compactDrinkInTray(targetCell.tray, drinkId);
        }
        this.spawnLandingSpark(to.x, to.y);
        this.spawnTraySettleEffect(targetCell);
        this.renderBoard();
      },
    });
  }

  private getOrderCupWorldPos(orderIndex: number): { x: number; y: number } {
    const orderCount = Math.max(1, this.orders.length);
    const step = getOrderCupStep(orderCount);
    const orderLocalX = -((orderCount - 1) * step) / 2 + orderIndex * step;
    return {
      x: this.orderRoot.x + orderLocalX,
      y: this.orderRoot.y + 4,
    };
  }

  private spawnOrderDeliveryCupFlights(cell: BoardCell, drinkId: DrinkId): void {
    for (let slot = 0; slot < TRAY_CAPACITY; slot += 1) {
      this.spawnOrderDeliveryCupHop(cell, drinkId, slot, slot);
    }
  }

  private spawnOverflowTrayExit(cell: BoardCell, drinkId: DrinkId): void {
    const cellLocal = this.getCellLocalCenter(cell);
    const fromX = this.boardRoot.x + cellLocal.x;
    const fromY = this.boardRoot.y + cellLocal.y;
    const ghost = this.createTrayVisual(
      { id: -1, drinks: Array.from({ length: TRAY_CAPACITY }, () => drinkId) },
      BOARD_TRAY_W,
      BOARD_TRAY_H,
      false,
    );
    ghost.position.set(fromX, fromY);
    this.overlayRoot.addChild(ghost);
    cell.tray = null;
    const crateChangeMessage = this.formatCrateChangeMessage(this.weakenAdjacentCrates(cell));
    this.deliveryAnimations.push({
      node: ghost,
      fromX,
      fromY,
      toX: -140,
      toY: fromY,
      elapsed: 0,
      duration: 0.36,
      onComplete: () => {
        this.renderTools();
        this.renderPendingTrays();
      },
    });
    this.setMessage(`这盘果茶当前没有订单需要，已从左侧出餐口送走。${crateChangeMessage}`);
    this.renderBoard();
  }

  /** 交付前：杯子在盘上依次起跳，全部落地后再整盘带杯飞向订单 */
  private spawnOrderDeliveryCupHop(
    sourceCell: BoardCell,
    drinkId: DrinkId,
    sourceSlot: number,
    staggerIndex: number,
  ): void {
    const from = this.getDrinkWorldPos(sourceCell, sourceSlot);
    const cupHeight = this.getBoardCupHeight();
    const cup = this.createDrinkVisual(drinkId, cupHeight, undefined, 0.94);
    cup.position.set(from.x, from.y);
    cup.visible = false;
    this.overlayRoot.addChild(cup);
    this.flyAnimations.push({
      node: cup,
      fromX: from.x,
      fromY: from.y,
      toX: from.x,
      toY: from.y,
      baseScaleX: cup.scale.x,
      baseScaleY: cup.scale.y,
      elapsed: 0,
      duration: MERGE_FLY_DURATION,
      delay: staggerIndex * MERGE_FLY_STAGGER,
      sourceCellIndex: sourceCell.index,
      drinkId,
      sourceSlot,
      flyKind: 'delivery',
      onStart: () => {
        this.spawnMergeLaunchSpark(from.x, from.y);
        this.renderBoard();
      },
      onLand: () => {
        this.spawnLandingSpark(from.x, from.y);
        this.renderBoard();
      },
    });
  }

  private hasActiveMergeFlightsFrom(cellIndex: number): boolean {
    return this.flyAnimations.some(
      (anim) => anim.sourceCellIndex === cellIndex && anim.flyKind !== 'delivery',
    );
  }

  private hasActiveDeliveryFlightsFrom(cellIndex: number): boolean {
    return this.flyAnimations.some(
      (anim) => anim.flyKind === 'delivery' && anim.sourceCellIndex === cellIndex,
    );
  }

  private tryCompletePendingDelivery(cellIndex: number): void {
    if (!this.pendingDeliveries.has(cellIndex)) {
      return;
    }
    if (this.hasActiveDeliveryFlightsFrom(cellIndex)) {
      return;
    }
    const pending = this.pendingDeliveries.get(cellIndex)!;
    const cell = this.board[cellIndex];
    if (!cell?.tray) {
      this.pendingDeliveries.delete(cellIndex);
      return;
    }
    this.submittingDeliveryCells.add(cellIndex);
    this.spawnDeliveryTraySubmitAnimation(cell, pending.drinkId, () => {
      this.pendingDeliveries.delete(cellIndex);
      this.submittingDeliveryCells.delete(cellIndex);
      cell.tray = null;
      const crateChangeMessage = this.formatCrateChangeMessage(this.weakenAdjacentCrates(cell));
      if (this.orders[pending.orderIndex] === pending.drinkId) {
        this.orderCompleted[pending.orderIndex] = true;
      }
      const orderFinished = this.orderCompleted.every(Boolean);
      if (orderFinished) {
        this.delivered += 1;
        this.renderRoundProgress();
        const isFinalBag = this.isRoundComplete();
        this.playOrderBagBatchCompleteFeedback(isFinalBag);
        if (isFinalBag) {
          this.spawnOrderBagExitEffect(() => this.settleRoundIfNeeded());
          this.setMessage(`最后一个订单袋完成！${crateChangeMessage}准备结算。`);
        } else {
          this.spawnOrderBagExitEffect(() => {
            this.refreshOrderBatch();
            this.spawnOrderBagEnterEffect(() => {
              this.renderTools();
              this.renderPendingTrays();
            });
          });
          this.setMessage(
            `完整订单袋完成！${crateChangeMessage}进度 ${this.delivered}/${this.currentRound.orderBagCount}，已换下一袋订单。`,
          );
        }
      } else {
        this.setMessage(
          `订单杯已完成 ${this.countCompletedOrderSlots()}/${this.orders.length}，继续完成这一袋订单。${crateChangeMessage}`,
        );
        this.renderOrders();
      }
      this.renderBoard();
      this.renderHud();
      this.renderTools();
      this.renderPendingTrays();
      this.checkRoundState();
    });
  }

  private tryRemovePendingEmptyTray(cellIndex: number): void {
    if (!this.pendingEmptyTrayCells.has(cellIndex)) {
      return;
    }
    if (this.hasActiveMergeFlightsFrom(cellIndex)) {
      return;
    }
    const cell = this.board[cellIndex];
    if (!cell?.tray) {
      this.pendingEmptyTrayCells.delete(cellIndex);
      return;
    }
    this.pendingEmptyTrayCells.delete(cellIndex);
    this.spawnEmptyTrayVanishEffect(cell);
    cell.tray = null;
    this.renderBoard();
    this.checkRoundState();
  }

  private spawnEmptyTrayVanishEffect(cell: BoardCell): void {
    const local = this.getCellLocalCenter(cell);
    const x = this.boardRoot.x + local.x;
    const y = this.boardRoot.y + local.y;
    this.vanishingEmptyTrayCells.add(cell.index);
    this.spawnPulseRing(x, y, 0.32, 1.15, 0.55);
    const ghost = this.createTrayVisual({ id: -1, drinks: [] }, BOARD_TRAY_W, BOARD_TRAY_H, false);
    ghost.position.set(x, y - 6);
    this.overlayRoot.addChild(ghost);
    this.pulseEffects.push({
      node: ghost,
      elapsed: 0,
      duration: 0.34,
      baseScale: 1,
      maxScale: 0.46,
      alphaStart: 0.96,
      onComplete: () => {
        this.vanishingEmptyTrayCells.delete(cell.index);
        this.renderTools();
        this.renderPendingTrays();
        this.renderBoard();
      },
    });
  }

  private spawnTrayRemoveEffect(cell: BoardCell): void {
    if (!cell.tray) {
      return;
    }
    const local = this.getCellLocalCenter(cell);
    const x = this.boardRoot.x + local.x;
    const y = this.boardRoot.y + local.y;
    this.vanishingEmptyTrayCells.add(cell.index);
    this.spawnPulseRing(x, y, 0.32, 1.18, 0.72);
    const ghost = this.createTrayVisual(cell.tray, BOARD_TRAY_W, BOARD_TRAY_H, false);
    ghost.position.set(x, y);
    this.overlayRoot.addChild(ghost);
    this.pulseEffects.push({
      node: ghost,
      elapsed: 0,
      duration: 0.28,
      baseScale: 1,
      maxScale: 0.58,
      alphaStart: 0.96,
      onComplete: () => {
        this.vanishingEmptyTrayCells.delete(cell.index);
        this.renderTools();
        this.renderPendingTrays();
        this.renderBoard();
      },
    });
  }

  private spawnCellUnlockEffect(cell: BoardCell): void {
    const local = this.getCellLocalCenter(cell);
    const x = this.boardRoot.x + local.x;
    const y = this.boardRoot.y + local.y;
    this.spawnPulseRing(x, y, 0.42, 1.35, 0.85);
    const burst = new PIXI.Graphics();
    burst.lineStyle(5, 0xfff0a0, 0.95);
    burst.drawRoundedRect(-BOARD_CELL_W / 2 + 8, -BOARD_CELL_H / 2 + 8, BOARD_CELL_W - 16, BOARD_CELL_H - 16, 18);
    burst.position.set(x, y);
    this.overlayRoot.addChild(burst);
    this.pulseEffects.push({
      node: burst,
      elapsed: 0,
      duration: 0.36,
      baseScale: 0.92,
      maxScale: 1.12,
      alphaStart: 0.95,
    });
  }

  private spawnMergeLaunchSpark(x: number, y: number): void {
    this.spawnPulseRing(x, y, 0.22, 0.82, 0.72);
    const dot = new PIXI.Graphics();
    dot.beginFill(0xfff2a8, 0.9);
    dot.drawCircle(0, 0, 5);
    dot.endFill();
    dot.position.set(x, y - 10);
    this.overlayRoot.addChild(dot);
    this.pulseEffects.push({
      node: dot,
      elapsed: 0,
      duration: 0.2,
      baseScale: 0.6,
      maxScale: 1.35,
      alphaStart: 0.9,
    });
  }

  private spawnPlaceEffect(cell: BoardCell): void {
    const local = this.getCellLocalCenter(cell);
    const x = this.boardRoot.x + local.x;
    const y = this.boardRoot.y + local.y;
    this.spawnPulseRing(x, y, 0.55, 1.65, 0.75);
    this.spawnPulseRing(x, y, 0.7, 1.35, 0.55);
    const trayBurst = this.createTrayVisual(cell.tray!, BOARD_TRAY_W, BOARD_TRAY_H, false);
    trayBurst.position.set(x, y);
    trayBurst.scale.set(0.88);
    trayBurst.alpha = 0.92;
    this.overlayRoot.addChild(trayBurst);
    this.pulseEffects.push({
      node: trayBurst,
      elapsed: 0,
      duration: 0.24,
      baseScale: 0.88,
      maxScale: 1.05,
      alphaStart: 0.92,
    });
  }

  private spawnTraySettleEffect(cell: BoardCell): void {
    if (!cell.tray) {
      return;
    }
    const local = this.getCellLocalCenter(cell);
    const x = this.boardRoot.x + local.x;
    const y = this.boardRoot.y + local.y;
    const ghost = this.createTrayVisual(cell.tray, BOARD_TRAY_W, BOARD_TRAY_H, false);
    ghost.position.set(x, y);
    ghost.alpha = 0.42;
    this.overlayRoot.addChild(ghost);
    this.pulseEffects.push({
      node: ghost,
      elapsed: 0,
      duration: 0.18,
      baseScale: 1.02,
      maxScale: 0.96,
      alphaStart: 0.42,
    });
  }

  private spawnDeliveryReadyEffect(cell: BoardCell): void {
    const local = this.getCellLocalCenter(cell);
    const x = this.boardRoot.x + local.x;
    const y = this.boardRoot.y + local.y;
    this.spawnPulseRing(x, y, 0.46, 1.42, 0.78);
    this.spawnPulseRing(x, y, 0.62, 1.18, 0.5);
  }

  private spawnInvalidDropEffect(cellIndex: number): void {
    const cell = this.board[cellIndex];
    if (!cell) {
      return;
    }
    const local = this.getCellLocalCenter(cell);
    const x = this.boardRoot.x + local.x;
    const y = this.boardRoot.y + local.y;
    const warn = new PIXI.Graphics();
    warn.lineStyle(5, 0xff5a4f, 0.9);
    warn.drawRoundedRect(-BOARD_CELL_W / 2 + 3, -BOARD_CELL_H / 2 + 3, BOARD_CELL_W - 6, BOARD_CELL_H - 6, 18);
    warn.position.set(x, y);
    this.overlayRoot.addChild(warn);
    this.pulseEffects.push({
      node: warn,
      elapsed: 0,
      duration: 0.28,
      baseScale: 0.96,
      maxScale: 1.08,
      alphaStart: 0.9,
    });
  }

  private spawnLandingSpark(x: number, y: number): void {
    this.spawnPulseRing(x, y, 0.28, 0.95, 0.85);
    const star = new PIXI.Graphics();
    star.beginFill(0xfff6b0, 0.95);
    this.drawSparkStar(star, 0, 0, 4, 10, 4);
    star.endFill();
    star.position.set(x, y);
    star.scale.set(0.4);
    this.overlayRoot.addChild(star);
    this.pulseEffects.push({
      node: star,
      elapsed: 0,
      duration: 0.26,
      baseScale: 0.4,
      maxScale: 1.1,
      alphaStart: 0.95,
    });
  }

  private drawSparkStar(g: PIXI.Graphics, x: number, y: number, n: number, outer: number, inner: number): void {
    const step = Math.PI / n;
    let rot = -Math.PI / 2;
    g.moveTo(x + Math.cos(rot) * outer, y + Math.sin(rot) * outer);
    for (let i = 0; i < n; i += 1) {
      rot += step;
      g.lineTo(x + Math.cos(rot) * inner, y + Math.sin(rot) * inner);
      rot += step;
      g.lineTo(x + Math.cos(rot) * outer, y + Math.sin(rot) * outer);
    }
    g.closePath();
  }

  private spawnOrderBagCompleteBurst(x: number, y: number): void {
    this.spawnPulseRing(x, y, 0.48, 1.55, 0.9);
    this.spawnPulseRing(x, y, 0.64, 1.95, 0.62);

    const glow = new PIXI.Graphics();
    glow.beginFill(0xfff0a0, 0.35);
    glow.drawCircle(0, 0, 72);
    glow.endFill();
    glow.position.set(x, y);
    this.overlayRoot.addChild(glow);
    this.pulseEffects.push({
      node: glow,
      elapsed: 0,
      duration: 0.42,
      baseScale: 0.42,
      maxScale: 1.35,
      alphaStart: 0.85,
    });

    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
      const radius = i % 2 === 0 ? 76 : 56;
      const star = new PIXI.Graphics();
      star.beginFill(i % 2 === 0 ? 0xfff5a8 : 0xffffff, 0.96);
      this.drawSparkStar(star, 0, 0, 4, i % 2 === 0 ? 13 : 9, i % 2 === 0 ? 5 : 4);
      star.endFill();
      star.position.set(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
      star.rotation = angle;
      this.overlayRoot.addChild(star);
      this.pulseEffects.push({
        node: star,
        elapsed: 0,
        duration: 0.42 + (i % 3) * 0.05,
        baseScale: 0.32,
        maxScale: 1.18,
        alphaStart: 0.95,
      });
    }

    const label = new PIXI.Text('订单完成!', {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 30,
      fill: 0xfff36b,
      fontWeight: '900',
      stroke: 0x7c3818,
      strokeThickness: 6,
      dropShadow: true,
      dropShadowBlur: 3,
      dropShadowDistance: 2,
      dropShadowColor: 0x6b3218,
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    label.position.set(x, y - ORDER_BAG_H * 0.78);
    this.overlayRoot.addChild(label);
    this.pulseEffects.push({
      node: label,
      elapsed: 0,
      duration: 0.62,
      baseScale: 0.72,
      maxScale: 1.12,
      alphaStart: 1,
    });
  }

  private spawnOrderBagTrailSpark(x: number, y: number): void {
    const spark = new PIXI.Graphics();
    spark.beginFill(0xfff4a8, 0.95);
    this.drawSparkStar(spark, 0, 0, 4, 9, 4);
    spark.endFill();
    spark.position.set(x, y);
    spark.rotation = -0.25;
    this.overlayRoot.addChild(spark);
    this.pulseEffects.push({
      node: spark,
      elapsed: 0,
      duration: 0.28,
      baseScale: 0.28,
      maxScale: 0.9,
      alphaStart: 0.9,
    });
  }

  private spawnPulseRing(
    x: number,
    y: number,
    duration: number,
    maxScale: number,
    alphaStart: number,
  ): void {
    const ring = new PIXI.Graphics();
    ring.lineStyle(4, 0xfff0a0, alphaStart);
    ring.drawCircle(0, 0, 28);
    ring.position.set(x, y);
    this.overlayRoot.addChild(ring);
    this.pulseEffects.push({
      node: ring,
      elapsed: 0,
      duration,
      baseScale: 0.55,
      maxScale,
      alphaStart,
    });
  }

  private spawnOrderSlotBurst(orderIndex: number): void {
    const pos = this.getOrderCupWorldPos(orderIndex);
    const x = pos.x;
    const y = pos.y;
    this.spawnPulseRing(x, y, 0.5, 1.45, 0.9);
    const check = new PIXI.Graphics();
    check.lineStyle(5, 0x5ec45e, 1);
    check.moveTo(-14, 0);
    check.lineTo(-4, 10);
    check.lineTo(16, -12);
    check.position.set(x, y);
    this.overlayRoot.addChild(check);
    this.pulseEffects.push({
      node: check,
      elapsed: 0,
      duration: 0.38,
      baseScale: 0.7,
      maxScale: 1.15,
      alphaStart: 1,
    });
  }

  private spawnDeliveryTraySubmitAnimation(
    cell: BoardCell,
    drinkId: DrinkId,
    onComplete: () => void,
  ): void {
    const cellLocal = this.getCellLocalCenter(cell);
    const fromX = this.boardRoot.x + cellLocal.x;
    const fromY = this.boardRoot.y + cellLocal.y;
    const orderIndex = this.findOpenOrderIndex(drinkId);
    const orderPos = orderIndex >= 0 ? this.getOrderCupWorldPos(orderIndex) : { x: fromX, y: fromY - 120 };
    const node = this.createTrayVisual(
      { id: -1, drinks: Array.from({ length: TRAY_CAPACITY }, () => drinkId) },
      BOARD_TRAY_W,
      BOARD_TRAY_H,
      false,
    );
    node.position.set(fromX, fromY);
    this.overlayRoot.addChild(node);
    this.spawnPulseRing(fromX, fromY, 0.45, 1.5, 0.8);
    this.renderBoard();
    this.deliveryAnimations.push({
      node,
      fromX,
      fromY,
      toX: orderPos.x,
      toY: orderPos.y,
      elapsed: 0,
      duration: 0.58,
      onComplete: () => {
        AudioManager.playOrderCompleteSound();
        const burstIndex = this.orderCompleted[orderIndex] ? orderIndex : this.findOpenOrderIndex(drinkId);
        if (burstIndex >= 0) {
          this.spawnOrderSlotBurst(burstIndex);
        }
        onComplete();
      },
    });
  }

  private updateFlyAnimations(dt: number): void {
    for (let i = this.flyAnimations.length - 1; i >= 0; i -= 1) {
      const anim = this.flyAnimations[i];
      if (!anim.started && anim.delay > 0) {
        anim.delay -= dt;
        if (anim.delay <= 0) {
          anim.delay = 0;
        } else {
          continue;
        }
      }
      if (!anim.started) {
        anim.started = true;
        anim.node.visible = true;
        anim.onStart?.();
      }
      anim.elapsed += dt;
      const t = Math.min(1, anim.elapsed / anim.duration);
      const isDeliveryConfirm = anim.flyKind === 'delivery';
      const eased = isDeliveryConfirm ? 1 - (1 - t) ** 3 : t * t * (3 - 2 * t);
      const arc = isDeliveryConfirm ? Math.sin(t * Math.PI) * DELIVERY_CONFIRM_ARC : 0;
      const toX = anim.toX;
      const toY = anim.toY;
      anim.node.position.set(
        anim.fromX + (toX - anim.fromX) * eased,
        anim.fromY + (toY - anim.fromY) * eased - arc,
      );
      if (isDeliveryConfirm) {
        const pop = 1 + 0.22 * Math.sin(t * Math.PI);
        anim.node.scale.set(anim.baseScaleX * pop, anim.baseScaleY * pop);
        anim.node.rotation = Math.sin(t * Math.PI) * 0.12 * (anim.fromX < anim.toX ? 1 : -1);
      } else {
        anim.node.scale.set(anim.baseScaleX, anim.baseScaleY);
        anim.node.rotation = 0;
      }
      if (t >= 1) {
        const sourceCellIndex = anim.sourceCellIndex;
        if (anim.node.parent) {
          anim.node.parent.removeChild(anim.node);
        }
        anim.node.destroy({ children: true });
        this.flyAnimations.splice(i, 1);
        anim.onLand?.();
        if (sourceCellIndex != null) {
          this.tryRemovePendingEmptyTray(sourceCellIndex);
          this.tryCompletePendingDelivery(sourceCellIndex);
        }
        if (anim.targetCellIndex != null) {
          this.tryDeliverCompletedTrays();
        }
        if (!this.hasActiveBoardMotion()) {
          this.renderTools();
          this.renderPendingTrays();
          this.checkRoundState();
        }
      }
    }
  }

  private updatePulseEffects(dt: number): void {
    for (let i = this.pulseEffects.length - 1; i >= 0; i -= 1) {
      const effect = this.pulseEffects[i];
      effect.elapsed += dt;
      const t = Math.min(1, effect.elapsed / effect.duration);
      const scale = effect.baseScale + (effect.maxScale - effect.baseScale) * t;
      effect.node.scale.set(scale);
      effect.node.alpha = effect.alphaStart * (1 - t);
      if (t >= 1) {
        if (effect.node.parent) {
          effect.node.parent.removeChild(effect.node);
        }
        effect.node.destroy({ children: true });
        this.pulseEffects.splice(i, 1);
        effect.onComplete?.();
        if (!this.hasActiveBoardMotion()) {
          this.checkRoundState();
        }
      }
    }
  }

  private getCellLocalCenter(cell: BoardCell): { x: number; y: number } {
    const boardW = BOARD_COLS * BOARD_CELL_W + (BOARD_COLS - 1) * BOARD_GAP;
    const boardH = BOARD_ROWS * BOARD_CELL_H + (BOARD_ROWS - 1) * BOARD_GAP;
    return {
      x: -boardW / 2 + cell.col * (BOARD_CELL_W + BOARD_GAP) + BOARD_CELL_W / 2,
      y: -boardH / 2 + cell.row * (BOARD_CELL_H + BOARD_GAP) + BOARD_CELL_H / 2,
    };
  }

  private updateDeliveryAnimations(dt: number): void {
    for (let i = this.deliveryAnimations.length - 1; i >= 0; i -= 1) {
      const anim = this.deliveryAnimations[i];
      anim.elapsed += dt;
      const t = Math.min(1, anim.elapsed / anim.duration);
      const eased = 1 - (1 - t) * (1 - t);
      const arc = anim.slideOnly ? 0 : Math.sin(t * Math.PI) * 56;
      anim.node.position.set(
        anim.fromX + (anim.toX - anim.fromX) * eased,
        anim.fromY + (anim.toY - anim.fromY) * eased - arc,
      );
      anim.onUpdate?.(t, anim.node.x, anim.node.y);
      if (!anim.slideOnly) {
        const spin = 1 + 0.22 * Math.sin(t * Math.PI);
        anim.node.scale.set(spin * (1 - t * 0.35));
        anim.node.rotation = (1 - t) * 0.12;
        anim.node.alpha = 1 - Math.max(0, t - 0.68) / 0.32;
      }
      if (t >= 1) {
        this.overlayRoot.removeChild(anim.node);
        anim.node.destroy({ children: true });
        this.deliveryAnimations.splice(i, 1);
        anim.onComplete?.();
        if (!this.hasActiveBoardMotion()) {
          this.checkRoundState();
        }
      }
    }
  }

  private clearOverlayAnimations(): void {
    this.dismissRoundStartBanner();
    for (const anim of this.deliveryAnimations) {
      if (anim.node.parent) {
        anim.node.parent.removeChild(anim.node);
      }
      anim.node.destroy({ children: true });
    }
    this.deliveryAnimations = [];
    for (const anim of this.flyAnimations) {
      if (anim.node.parent) {
        anim.node.parent.removeChild(anim.node);
      }
      anim.node.destroy({ children: true });
    }
    this.flyAnimations = [];
    for (const effect of this.pulseEffects) {
      if (effect.node.parent) {
        effect.node.parent.removeChild(effect.node);
      }
      effect.node.destroy({ children: true });
    }
    this.pulseEffects = [];
    destroyContainerChildren(this.overlayRoot);
    this.shopInfoPopupRoot = null;
  }

  private setMessage(message: string): void {
    if (this.messageText) {
      this.messageText.text = message;
      this.messageText.visible = false;
    }
  }

  private createTrayVisual(
    tray: Tray,
    width: number,
    height: number,
    showId: boolean,
    drinkSlots?: Array<DrinkId | null>,
  ): PIXI.Container {
    const root = new PIXI.Container();
    const holes = this.trayHolePositions(width, height);
    const trayTex = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.emptyTray);
    if (trayTex) {
      const traySprite = new PIXI.Sprite(trayTex);
      traySprite.anchor.set(0.5);
      const scale = Math.min(width / trayTex.width, height / trayTex.height);
      traySprite.scale.set(scale);
      root.addChild(traySprite);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(0xfff5df, 1);
      bg.lineStyle(3, 0xb88b5a, 1);
      bg.drawRoundedRect(-width / 2, -height / 2, width, height, 14);
      bg.endFill();
      root.addChild(bg);
    }

    holes.forEach((pos, index) => {
      const drinkId = drinkSlots?.[index] ?? tray.drinks[index];
      if (!drinkId) {
        return;
      }
      const cupHeight = height * TRAY_CUP_HEIGHT_RATIO;
      const cup = this.createDrinkVisual(drinkId, cupHeight, undefined, 0.94);
      cup.position.set(pos.x, pos.y + height * 0.04);
      root.addChild(cup);
    });

    if (showId) {
      const label = new PIXI.Text(`${tray.drinks.length}/6`, {
        fontSize: 17,
        fill: 0x8b5b2b,
        fontWeight: '900',
        stroke: 0xffffff,
        strokeThickness: 3,
      });
      label.anchor.set(1, 1);
      label.resolution = 2;
      label.position.set(width / 2 - 8, height / 2 - 7);
      root.addChild(label);
    }
    return root;
  }

  private trayHolePositions(width: number, height: number): Array<{ x: number; y: number }> {
    const xs = [-0.28, 0, 0.28].map((n) => n * width);
    const ys = [-0.18, 0.18].map((n) => n * height);
    return [
      { x: xs[0], y: ys[0] },
      { x: xs[1], y: ys[0] },
      { x: xs[2], y: ys[0] },
      { x: xs[0], y: ys[1] },
      { x: xs[1], y: ys[1] },
      { x: xs[2], y: ys[1] },
    ];
  }

  private createDrinkVisual(
    drinkId: DrinkId,
    targetHeight: number,
    maxWidth?: number,
    anchorY = 0.5,
  ): PIXI.Container {
    const tex = TextureCache.get(milkTeaShopDrinkTextureKey(drinkId));
    if (tex && tex.height > 2) {
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5, anchorY);
      const scale = this.uniformDrinkScale(tex, targetHeight, maxWidth);
      sprite.scale.set(scale);
      return sprite;
    }
    const drink = this.drinkMap.get(drinkId);
    if (!drink) {
      return new PIXI.Container();
    }
    return this.createDrinkCup(drink, targetHeight * 0.55, targetHeight);
  }

  /** 等比缩放：先按目标高度，仅在超出 maxWidth 时整体缩小，不单独压扁宽/高 */
  private uniformDrinkScale(tex: PIXI.Texture, targetHeight: number, maxWidth?: number): number {
    let scale = targetHeight / tex.height;
    if (maxWidth != null && tex.width * scale > maxWidth) {
      scale = maxWidth / tex.width;
    }
    return scale;
  }

  private createPillButton(label: string, width: number, height: number, fill: number, stroke: number, fontSize: number): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-width / 2, -height / 2, width, height);
    const bg = new PIXI.Graphics();
    bg.beginFill(fill, 0.96);
    bg.lineStyle(4, stroke, 1);
    bg.drawRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    bg.endFill();
    root.addChild(bg);
    const text = new PIXI.Text(label, {
      fontSize,
      fill: 0x7a421d,
      fontWeight: '900',
    });
    text.anchor.set(0.5);
    text.resolution = 2;
    root.addChild(text);
    return root;
  }

  private createDrinkCup(drink: DrinkDef, width: number, height: number): PIXI.Container {
    const root = new PIXI.Container();
    const g = new PIXI.Graphics();
    const topW = width * 0.86;
    const bottomW = width * 0.62;
    const bodyH = height * 0.7;
    const topY = -height * 0.28;
    const bottomY = topY + bodyH;

    g.lineStyle(3, 0x7d4c2a, 0.9);
    g.beginFill(0xffffff, 0.86);
    g.drawRoundedRect(-topW / 2, topY - 10, topW, 14, 7);
    g.endFill();
    g.beginFill(drink.toppingColor, 1);
    g.drawEllipse(0, topY + 2, topW / 2, 9);
    g.endFill();
    g.beginFill(drink.liquidColor, 0.95);
    g.moveTo(-topW / 2 + 4, topY + 4);
    g.lineTo(topW / 2 - 4, topY + 4);
    g.lineTo(bottomW / 2, bottomY);
    g.lineTo(-bottomW / 2, bottomY);
    g.closePath();
    g.endFill();
    g.lineStyle(2, 0xffffff, 0.65);
    g.moveTo(-topW * 0.24, topY + 7);
    g.lineTo(-bottomW * 0.18, bottomY - 4);
    g.moveTo(topW * 0.25, topY + 7);
    g.lineTo(bottomW * 0.18, bottomY - 4);
    g.lineStyle(3, drink.accentColor, 0.95);
    g.moveTo(width * 0.2, topY - 20);
    g.lineTo(width * 0.32, topY + 8);

    if (drink.pattern === 0) {
      g.lineStyle(3, 0xffffff, 0.7);
      g.moveTo(-bottomW * 0.36, bottomY - 14);
      g.lineTo(bottomW * 0.36, bottomY - 14);
    } else if (drink.pattern === 1) {
      g.beginFill(0xffffff, 0.65);
      g.drawCircle(-width * 0.13, topY + bodyH * 0.52, 4);
      g.drawCircle(width * 0.11, topY + bodyH * 0.62, 3);
      g.endFill();
    } else if (drink.pattern === 2) {
      g.lineStyle(3, drink.accentColor, 0.75);
      g.moveTo(-bottomW * 0.22, topY + bodyH * 0.48);
      g.lineTo(bottomW * 0.22, topY + bodyH * 0.34);
    } else {
      g.beginFill(0xffffff, 0.72);
      g.drawRoundedRect(-width * 0.18, topY + bodyH * 0.42, width * 0.36, 10, 5);
      g.endFill();
    }

    g.beginFill(0x6a3d24, 0.28);
    g.drawEllipse(0, bottomY + 5, bottomW / 2, 5);
    g.endFill();
    root.addChild(g);
    return root;
  }
}
