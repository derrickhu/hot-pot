import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
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
import { FRUIT_CONFIGS, FRUIT_MAP, type FruitId } from '@/config/fruits';
import { getBowlLevelIndex, recordBowlBadgeUnlocked, setBowlLevelIndex } from '@/game/BowlProgress';
import { loadBowlSubpackage } from '@/utils/loadBowlSubpackage';
import { TextureCache } from '@/utils/TextureCache';
import { FruitItem } from '@/gameobjects/FruitItem';
import { BowlFailSettlementOverlay } from '@/gameobjects/BowlFailSettlementOverlay';
import { BowlBadgeUnlockOverlay } from '@/gameobjects/BowlBadgeUnlockOverlay';
import { mountBowlBadgeIcon } from '@/gameobjects/BowlBadgeIcon';
import { BowlReviveOverlay } from '@/gameobjects/BowlReviveOverlay';
import {
  BowlLevelClearOverlay,
  LEVEL_CLEAR_ACTION_ICONS_ASSET,
  LEVEL_CLEAR_ACTION_ICONS_TEXTURE_KEY,
} from '@/gameobjects/BowlLevelClearOverlay';
import { SettingsPauseOverlay } from '@/gameobjects/SettingsPauseOverlay';

const BOWL_TOOL_SHEET_TEXTURE = `${BOWL_IMAGES_ROOT}/bowl_tool_buttons.png`;
const BOWL_TOOL_PANELS_TEXTURE = `${BOWL_IMAGES_ROOT}/bowl_tool_panels.png`;
const UI_PANEL_FREE_BTN_TEXTURE = `${BOWL_IMAGES_ROOT}/ui_panel_free_btn.png`;
const BOWL_PLATES_TEXTURE = `${BOWL_IMAGES_ROOT}/bowl_plates.png`;
const ICE_CUBE_ID: FruitId = 'ice_cube';
const NON_ORDER_FRUIT_IDS = new Set<FruitId>([ICE_CUBE_ID, 'crystal_jelly']);

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
const FRUIT_BOB_SPEED = 0.00022;
const FRUIT_ROTATION_SPEED = 0.00075;
const FRUIT_DRIFT_PULSE_SEC = 2.8;
const FRUIT_DRIFT_MAX_X = 16;
const FRUIT_DRIFT_MAX_Y = 11;
const FRUIT_SURFACE_BOB_THRESHOLD = 0.86;
const FRUIT_SUBMERGE_BOB_THRESHOLD = 0.18;
const BOWL_FRUIT_SCALE_MIN = 1.08;
const BOWL_FRUIT_SCALE_MAX = 1.32;

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

type PlateIdx = 0 | 1 | 2;

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
  private readonly soupOverlayLayer = new PIXI.Container();
  private readonly soupDetailLayer = new PIXI.Container();
  private readonly soupRippleLayer = new PIXI.Container();
  private readonly soupFlowLayer = new PIXI.Container();
  private readonly soupSurfaceOverlaySprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
  private readonly soupFlowSprites: PIXI.Sprite[] = [];
  private readonly soupDetailItems: PIXI.Container[] = [];
  private readonly bowlContentMask = new PIXI.Graphics();
  private soupRippleTime = 0;
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

  private fruits: FruitItem[] = [];
  /** 并行订单：前两盘常态；复活后第三盘激活 */
  private parallelPlateCount: 2 | 3 = 2;
  private parallelOrders: [
    { fruitId: FruitId; progress: number } | null,
    { fruitId: FruitId; progress: number } | null,
    { fruitId: FruitId; progress: number } | null,
  ] = [null, null, null];
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
  /** 本关仍需完成的订单数（每完成一盘 xN 订单 −1） */
  private ordersRemaining = 0;
  private totalOrdersForProgress = 0;
  private hasShownClearForRound = false;
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

  /** 底部三工具槽（预加载后可能换为雪碧条贴图） */
  private readonly toolSlots: PIXI.Container[] = [];

  /** 底栏三钮说明弹层（剪贴板式面板雪碧图） */
  private readonly toolHelpOverlay = new PIXI.Container();
  private readonly toolHelpPanelRoot = new PIXI.Container();
  private readonly toolHelpSprite = new PIXI.Sprite();
  private readonly toolHelpCloseBtn = new PIXI.Container();
  private readonly toolHelpFreeBtn = new PIXI.Sprite();
  private pendingToolIndex: number | null = null;

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
      },
    });
    this.buildScene();
    void this.ensureTexturesPreloaded().catch((err) => {
      console.error('Failed to preload bowl textures', err);
    });
  }

  /** 需暂停操作与计时的顶层弹层（不含暂停设置内的 continue 状态） */
  private isBowlInteractionBlocked(): boolean {
    return (
      this.failSettlementOverlay.visible ||
      this.badgeUnlockOverlay.visible ||
      this.reviveOverlay.visible ||
      this.levelClearOverlay.visible ||
      this.settingsOverlay.visible
    );
  }

  onEnter(): void {
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

    this.startRound();
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
    this.updateSoupAnimation(dt);

    const now = Date.now();
    for (const fruit of this.fruits) {
      if (fruit.phase !== 'bowl' || fruit.picked) {
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
      fruit.display.y = bob * 5;
      this.updateFruitSoupDepth(fruit, bob);
      fruit.zIndex = Math.round(fruit.y * 10 + fruit.depthJitter * 1000);
    }

    this.submergedFruitLayer.sortChildren();
    this.surfaceFruitLayer.sortChildren();
    this.flyingFruitLayer.sortChildren();
  }

  private buildScene(): void {
    const headerHeight = Game.safeTop + 78;
    const panelTop = headerHeight;

    this.themeBackdropSprite.visible = false;
    this.container.addChild(this.themeBg, this.themeBackdropSprite, this.themeHeaderDecor);
    this.paintSceneTheme(this.currentTheme);

    this.settingsBtnRoot.position.set(44, Game.safeTop + 34);
    this.settingsBtnRoot.eventMode = 'static';
    this.settingsBtnRoot.cursor = 'pointer';
    this.mountTropicalSettingsButton();
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
      this.settingsOverlay.visible = true;
      this.fruitLayer.eventMode = 'none';
    });
    this.container.addChild(this.settingsBtnRoot);

    this.mountGmClearButton();
    this.container.addChild(this.gmClearBtnRoot);

    this.hudPillBg = new PIXI.Graphics();
    this.container.addChild(this.hudPillBg);

    const levelText = new PIXI.Text('第1关', {
      fontSize: 26,
      fill: 0xffe58a,
      fontWeight: '900',
      letterSpacing: 1.2,
      stroke: 0x4b2e19,
      strokeThickness: 3,
      dropShadow: true,
      dropShadowColor: 0x2b1a12,
      dropShadowAlpha: 0.35,
      dropShadowBlur: 2,
      dropShadowDistance: 2,
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
    orderThree.container.visible = false;
    this.orderViews.push(orderOne, orderTwo, orderThree);

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
    const lockPlay1 = this.createCenterText('▶', 22, 0xf7edcc);
    lockPlay1.position.set(-40, 0);
    this.thirdPlateLockDecor.addChild(lockPlay1);
    this.container.addChild(this.thirdPlateLockDecor);

    const lockText2 = this.createCenterText('解锁', 38, 0xf7edcc);
    lockText2.position.set(pc[3]!, orderPlateY);
    this.container.addChild(lockText2);
    const lockPlay2 = this.createCenterText('▶', 22, 0xf7edcc);
    lockPlay2.position.set(pc[3]! - 40, orderPlateY);
    this.container.addChild(lockPlay2);

    /** 订单气泡：排在所有圆盘、盘上水果图标与解锁装饰之上，避免被遮挡 */
    this.container.addChild(orderOne.container, orderTwo.container, orderThree.container);

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
    this.soupRippleLayer.eventMode = 'none';
    this.soupOverlayLayer.addChild(this.soupRippleLayer);
    this.bowlContentMask.eventMode = 'none';
    this.bowlContentMask.renderable = false;
    this.submergedFruitLayer.mask = this.bowlContentMask;
    this.soupOverlayLayer.mask = this.bowlContentMask;
    this.surfaceFruitLayer.mask = this.bowlContentMask;
    this.soupDetailLayer.mask = this.bowlContentMask;

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
    this.bowlStack.visible = false;
    this.container.addChild(this.bowlStack);

    this.fruitLayer.addChild(
      this.submergedFruitLayer,
      this.soupOverlayLayer,
      this.surfaceFruitLayer,
      this.soupDetailLayer,
      this.flyingFruitLayer,
    );
    this.fruitLayer.addChild(this.bowlContentMask);
    this.container.addChild(this.fruitLayer);
    const toolY = TOOL_SLOT_Y();
    for (let i = 0; i < 3; i += 1) {
      const slot = new PIXI.Container();
      slot.position.set(TOOL_SLOT_XS[i], toolY);
      slot.addChild(this.createToolButtonFallback(TOOL_LABELS[i], TOOL_FALLBACK_COLORS[i]));
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
      this.container.addChild(slot);
    }
    this.container.addChild(this.failSettlementOverlay);
    this.container.addChild(this.badgeUnlockOverlay);
    this.container.addChild(this.reviveOverlay);
    this.container.addChild(this.levelClearOverlay);
    this.buildToolHelpOverlay();
    this.container.addChild(this.settingsOverlay);

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
    this.hudLevelText.style.dropShadowColor = this.currentTheme.hudOuter;
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
    await loadBowlSubpackage();
    const jobs: Promise<unknown>[] = [];
    for (const [key, asset] of Object.entries(BOWL_SOUP_ASSETS)) {
      jobs.push(TextureCache.load(`bowl_soup_${key}`, asset));
    }
    for (const [key, asset] of Object.entries(BOWL_RIM_ASSETS)) {
      jobs.push(TextureCache.load(`bowl_rim_${key}`, asset));
    }
    for (const theme of Object.values(BOWL_THEMES)) {
      jobs.push(TextureCache.load(`bowl_theme_${theme.key}`, theme.backdropAsset));
    }
    jobs.push(TextureCache.load('bowl_tool_sheet', BOWL_TOOL_SHEET_TEXTURE));
    jobs.push(TextureCache.load('bowl_tool_panels', BOWL_TOOL_PANELS_TEXTURE));
    jobs.push(TextureCache.load('ui_panel_free_btn', UI_PANEL_FREE_BTN_TEXTURE));
    jobs.push(TextureCache.load('bowl_plates', BOWL_PLATES_TEXTURE));
    for (const badge of BOWL_BADGES) {
      jobs.push(TextureCache.load(`bowl_badge_${badge.levelNumber}`, badge.asset));
    }
    jobs.push(TextureCache.load(LEVEL_CLEAR_ACTION_ICONS_TEXTURE_KEY, LEVEL_CLEAR_ACTION_ICONS_ASSET));
    for (const fruit of FRUIT_CONFIGS) {
      jobs.push(TextureCache.load(fruit.id, fruit.asset));
      jobs.push(TextureCache.load(`${fruit.id}__b2`, fruit.bowlAsset2));
    }
    await Promise.all(jobs);
    this.mountTropicalSettingsButton();
    this.applyBowlArtTextures();
    this.mountToolButtons();
    this.mountBoardPlateArt();
  }

  private mountTropicalSettingsButton(): void {
    this.settingsBtnRoot.removeChildren();
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x17313c, 0.36);
    shadow.drawCircle(4, 7, 38);
    shadow.endFill();
    this.settingsBtnRoot.addChild(shadow);

    const bg = new PIXI.Graphics();
    bg.lineStyle(6, 0x6c47ff, 1);
    bg.beginFill(0x18d5e8, 1);
    bg.drawCircle(0, 0, 36);
    bg.endFill();
    bg.lineStyle(3, 0xffffff, 0.9);
    bg.drawCircle(0, 0, 29);
    bg.lineStyle(0);
    bg.beginFill(0xb7fff5, 0.58);
    bg.drawEllipse(-10, -14, 17, 8);
    bg.endFill();
    this.settingsBtnRoot.addChild(bg);

    const gear = new PIXI.Graphics();
    gear.lineStyle(4, 0x5b351e, 1);
    gear.beginFill(0xffd33f, 1);
    const teeth = 10;
    const points: number[] = [];
    for (let i = 0; i < teeth * 2; i += 1) {
      const r = i % 2 === 0 ? 19 : 14;
      const a = -Math.PI / 2 + (i / (teeth * 2)) * Math.PI * 2;
      points.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    gear.drawPolygon(points);
    gear.endFill();
    gear.lineStyle(3, 0x5b351e, 1);
    gear.beginFill(0xfff4c8, 1);
    gear.drawCircle(0, 0, 6);
    gear.endFill();
    this.settingsBtnRoot.addChild(gear);
    this.settingsBtnRoot.hitArea = new PIXI.Circle(0, 0, 42);
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
      const flowSprite = sp as PIXI.Sprite & {
        flowBaseAlpha?: number;
        flowBaseScale?: number;
        flowSpeed?: number;
        flowFlipX?: number;
        flowFlipY?: number;
      };
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

  private redrawSoupOverlay(): void {
    this.soupOverlayLayer.removeChildren();
    this.soupDetailLayer.removeChildren();
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
      const overlaySprite = this.soupSurfaceOverlaySprite as PIXI.Sprite & { flowBaseRotation?: number; flowSpeed?: number };
      overlaySprite.flowBaseRotation = -0.12;
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

    this.soupRippleLayer.removeChildren();
    const rippleDefs = [
      { rx: 0.5, ry: 0.18, y: -0.12, rot: -0.16, alpha: overlay.rippleAlpha },
      { rx: 0.38, ry: 0.14, y: 0.06, rot: 0.24, alpha: overlay.rippleAlpha * 0.82 },
      { rx: 0.62, ry: 0.22, y: 0.2, rot: -0.28, alpha: overlay.rippleAlpha * 0.62 },
    ] as const;
    for (const def of rippleDefs) {
      const g = new PIXI.Graphics();
      g.lineStyle(7, 0xffffff, def.alpha);
      g.drawEllipse(0, 0, hx * def.rx, hy * def.ry);
      g.position.set(this.bowlCenter.x, this.bowlCenter.y + hy * def.y);
      g.rotation = def.rot;
      g.eventMode = 'none';
      this.soupRippleLayer.addChild(g);
    }
    this.soupOverlayLayer.addChild(this.soupRippleLayer);
    this.redrawSoupSurfaceDetails(hx, hy, overlay);
  }

  private redrawSoupSurfaceDetails(
    hx: number,
    hy: number,
    overlay: ReturnType<BowlScene['getSoupOverlayStyle']>,
  ): void {
    this.soupDetailItems.length = 0;
    const line = overlay.detailColor;
    const detailDefs = [
      { x: -0.34, y: -0.24, rx: 0.22, ry: 0.08, rot: -0.28, alpha: 0.2 },
      { x: 0.28, y: -0.08, rx: 0.18, ry: 0.06, rot: 0.32, alpha: 0.18 },
      { x: -0.08, y: 0.18, rx: 0.3, ry: 0.09, rot: -0.12, alpha: 0.14 },
      { x: 0.18, y: 0.28, rx: 0.16, ry: 0.05, rot: 0.18, alpha: 0.13 },
    ] as const;
    for (const def of detailDefs) {
      const g = new PIXI.Graphics();
      g.lineStyle(5, line, def.alpha);
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
      dot.beginFill(line, 0.1 + (i % 3) * 0.025);
      dot.drawCircle(0, 0, 2 + (i % 4) * 0.6);
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
  } {
    switch (this.currentSoupKey) {
      case 'berry_tomato':
        return { washColor: 0xd94d3f, washAlpha: 0.1, highlightColor: 0xffb79c, highlightAlpha: 0.08, rippleAlpha: 0.12, textureAlpha: 0.36, detailColor: 0xffd0b2 };
      case 'matcha':
        return { washColor: 0x9fc763, washAlpha: 0.1, highlightColor: 0xe7f5bd, highlightAlpha: 0.08, rippleAlpha: 0.12, textureAlpha: 0.36, detailColor: 0xf0ffd0 };
      case 'mango_coconut':
        return { washColor: 0xf0a92f, washAlpha: 0.1, highlightColor: 0xffdf89, highlightAlpha: 0.08, rippleAlpha: 0.12, textureAlpha: 0.36, detailColor: 0xfff2bd };
      case 'taro_purple':
        return { washColor: 0x9b77c8, washAlpha: 0.1, highlightColor: 0xd9bbef, highlightAlpha: 0.08, rippleAlpha: 0.12, textureAlpha: 0.36, detailColor: 0xf0d8ff };
      case 'cocoa':
        return { washColor: 0x6f4a32, washAlpha: 0.14, highlightColor: 0xb8875d, highlightAlpha: 0.07, rippleAlpha: 0.1, textureAlpha: 0.42, detailColor: 0xd9aa78 };
      case 'milk':
      default:
        return { washColor: 0xfff1d2, washAlpha: 0.1, highlightColor: 0xffffff, highlightAlpha: 0.1, rippleAlpha: 0.16, textureAlpha: 0.32, detailColor: 0xffffff };
    }
  }

  private updateSoupAnimation(dt: number): void {
    if (!this.soupOverlayLayer.visible || this.soupRippleLayer.children.length === 0) {
      return;
    }
    this.soupRippleTime += dt;
    const overlaySprite = this.soupSurfaceOverlaySprite as PIXI.Sprite & { flowBaseRotation?: number; flowSpeed?: number };
    if (this.soupSurfaceOverlaySprite.parent) {
      const phase = this.soupRippleTime * 0.62;
      this.soupSurfaceOverlaySprite.rotation =
        (overlaySprite.flowBaseRotation ?? 0) +
        Math.sin(phase) * 0.045 +
        this.soupRippleTime * (overlaySprite.flowSpeed ?? 0);
      this.soupSurfaceOverlaySprite.scale.set(1 + Math.sin(phase * 1.27) * 0.018, 1 - Math.sin(phase * 0.9) * 0.012);
    }
    for (let i = 0; i < this.soupFlowSprites.length; i += 1) {
      const sp = this.soupFlowSprites[i] as PIXI.Sprite & {
        flowBaseAlpha?: number;
        flowBaseScale?: number;
        flowSpeed?: number;
        flowFlipX?: number;
        flowFlipY?: number;
      };
      const phase = this.soupRippleTime * (0.72 + i * 0.16) + i * 1.53;
      const baseScale = sp.flowBaseScale ?? sp.scale.x;
      const pulse = 1 + Math.sin(phase) * 0.026;
      const flipX = sp.flowFlipX ?? 1;
      const flipY = sp.flowFlipY ?? 1;
      sp.scale.set(baseScale * pulse * flipX, (baseScale / pulse) * flipY);
      sp.rotation += dt * (sp.flowSpeed ?? 0.03);
      sp.alpha = (sp.flowBaseAlpha ?? 0.12) * (0.66 + Math.sin(phase + 0.6) * 0.26);
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

  /** 雪碧条三列：左加菜牌、中移除、右打乱；失败则保留矢量兜底 */
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
    }
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
    const cb = new PIXI.Graphics();
    cb.beginFill(0xd84c4c);
    cb.drawRoundedRect(-18, -18, 36, 36, 8);
    cb.endFill();
    this.toolHelpCloseBtn.addChild(cb);
    const cx = new PIXI.Text('×', { fontSize: 26, fill: 0xffffff, fontWeight: '800' });
    cx.anchor.set(0.5);
    this.toolHelpCloseBtn.addChild(cx);
    this.toolHelpCloseBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.playButtonSound();
      this.hideToolHelpPanel();
    });
    this.toolHelpPanelRoot.addChild(this.toolHelpCloseBtn);

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
      this.useTool(toolIndex);
    });
    this.toolHelpPanelRoot.addChild(this.toolHelpFreeBtn);

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
    this.toolHelpCloseBtn.position.set(w * sc * 0.5 - 22, (-sheet.height * sc) / 2 + 22);

    const freeTex = TextureCache.get('ui_panel_free_btn');
    if (freeTex) {
      this.toolHelpFreeBtn.texture = freeTex;
      const maxBw = Game.logicWidth * 0.72;
      const targetH = Game.logicHeight * 0.13;
      const bs = Math.min(1, maxBw / freeTex.width, targetH / freeTex.height);
      this.toolHelpFreeBtn.scale.set(bs);
      const gap = 14;
      const panelHalfH = (sheet.height * sc) / 2;
      const btnHalfH = (freeTex.height * bs) / 2;
      this.toolHelpFreeBtn.position.set(0, panelHalfH + gap + btnHalfH);
      this.toolHelpFreeBtn.visible = true;
    } else {
      this.toolHelpFreeBtn.visible = false;
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

  private useTool(slotIndex: number): void {
    if (!this.loaded || this.isBowlInteractionBlocked()) {
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

  private toast(title: string): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    api?.showToast?.({ title, icon: 'none' });
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
    const anchor = this.bufferSlotAnchors[idx]!;
    const worldStart = anchor.toGlobal(new PIXI.Point(fruit.x, fruit.y));
    anchor.removeChild(fruit);
    const lp = this.fruitLayer.toLocal(worldStart);
    fruit.position.copyFrom(lp);
    fruit.scale.set(this.randomInRange(BOWL_FRUIT_SCALE_MIN, BOWL_FRUIT_SCALE_MAX));
    this.mountFruitInBowlLayer(fruit, true);
    fruit.phase = 'bowl';
    fruit.bufferSlotIndex = null;
    fruit.picked = false;
    fruit.eventMode = 'static';
    fruit.cursor = 'pointer';
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

  /** 打乱：碗内水果随机换位与速度 */
  private toolShuffleBowl(): void {
    if (!this.levelDef.allowShuffle) {
      this.toast('本关不可用');
      return;
    }
    for (const fruit of this.fruits) {
      if (fruit.phase !== 'bowl' || fruit.picked) {
        continue;
      }
      const p = this.randomBowlPoint();
      fruit.position.set(p.x, p.y);
      fruit.velocityX = this.randomInRange(-14, 14);
      fruit.velocityY = this.randomInRange(-9, 9);
    }
  }

  private bowlTextureKey(fruitId: FruitId): string {
    return Math.random() < 0.5 ? fruitId : `${fruitId}__b2`;
  }

  private startRound(): void {
    this.hideToolHelpPanel();
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
    this.driftAccumSec = 0;

    for (const anchor of this.bufferSlotAnchors) {
      anchor.removeChildren();
    }

    this.levelDef = getBowlLevelDef(getBowlLevelIndex());
    this.applySceneThemeForLevel();
    this.applyBowlArtTextures();
    this.hasShownClearForRound = false;
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

    const totalPieces = this.orderFruitIds.length * this.levelDef.copiesPerFruit;
    this.ordersRemaining = Math.max(0, Math.floor(totalPieces / this.orderSize));
    this.totalOrdersForProgress = this.ordersRemaining;

    const ids = shuffle(
      [
        ...this.levelFruitIds.flatMap((id) =>
          Array.from({ length: this.levelDef.copiesPerFruit }, () => id),
        ),
        ...Array.from({ length: this.levelDef.iceCount ?? 0 }, () => ICE_CUBE_ID),
      ],
    );

    ids.forEach((fruitId, index) => {
      const config = FRUIT_MAP[fruitId];
      const key = this.bowlTextureKey(fruitId);
      const texture = TextureCache.get(key) ?? TextureCache.get(fruitId);
      const fruit = new FruitItem(config, texture);
      const point = this.randomBowlPoint();
      fruit.position.set(point.x, point.y);
      fruit.scale.set(this.randomInRange(BOWL_FRUIT_SCALE_MIN, BOWL_FRUIT_SCALE_MAX));
      fruit.velocityX = this.randomInRange(-10, 10);
      fruit.velocityY = this.randomInRange(-7, 7);
      fruit.zIndex = index;
      fruit.phase = 'bowl';
      fruit.bufferSlotIndex = null;
      fruit.on('pointertap', () => {
        this.pickFruit(fruit);
      });
      this.fruits.push(fruit);
      this.mountFruitInBowlLayer(fruit);
    });

    this.hudLevelText.text = this.levelDef.displayName;
    this.applyBufferStripLayout();
    this.mountBufferStripTextures();
    this.initParallelOrders();
    this.refreshHud();
    this.fruitLayer.eventMode = 'static';
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
      if (this.bufferSlots[i] === null || this.bufferSlots[i] === undefined) {
        return i;
      }
    }
    return -1;
  }

  private findLeftmostBufferPlateMatch(): { bufIdx: number; plateIdx: PlateIdx } | null {
    for (let i = 0; i < this.bufferSize; i += 1) {
      const f = this.bufferSlots[i];
      if (!f) {
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

  private totalRemainingInLevel(): number {
    return this.orderFruitIds.reduce((sum, id) => sum + (this.remainingCounts[id] ?? 0), 0);
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
    const pool = this.orderFruitIds.filter((id) => (this.remainingCounts[id] ?? 0) > 0);
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
    const hasAny = this.orderFruitIds.some((id) => (this.remainingCounts[id] ?? 0) > 0);
    if (!hasAny) {
      this.showWinOverlay();
      return;
    }
    this.parallelOrders = [null, null, null];
    for (let p = 0; p < this.parallelPlateCount; p += 1) {
      this.assignOrderToPlate(p as PlateIdx);
    }
    for (let p = this.parallelPlateCount; p < 3; p += 1) {
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
      if (o && o.fruitId === fruitId && o.progress < this.orderSize) {
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
      const pa = this.parallelOrders[a]!.progress;
      const pb = this.parallelOrders[b]!.progress;
      if (pa !== pb) {
        return pa - pb;
      }
      return a - b;
    });
    return candidates[0]!;
  }

  private resetThirdPlateForRound(): void {
    this.parallelPlateCount = 2;
    this.parallelOrders[2] = null;
    this.thirdPlateLockDecor.visible = true;
    this.thirdPlateLockDecor.position.set(this.orderPlateCenterX[2]!, this.orderPlateRowY);
    this.orderViews[2]!.container.visible = false;
    const pv = this.plateVisualHolders[2];
    if (pv) {
      pv.locked = true;
      this.remountPlateDisc(pv);
    }
  }

  private enableThirdParallelPlateForRound(): void {
    this.parallelPlateCount = 3;
    this.parallelOrders[2] = null;
    this.thirdPlateLockDecor.visible = false;
    this.orderViews[2]!.container.visible = true;
    const pv = this.plateVisualHolders[2];
    if (pv) {
      pv.locked = false;
      this.remountPlateDisc(pv);
    }
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
      sp.anchor.set(0, 0);
      sp.width = lay.slotW;
      sp.height = lay.slotH;
      holder.addChild(sp, anchor);
    }
  }

  private releaseBufferSlotToBowl(bufIdx: number): void {
    const fruit = this.bufferSlots[bufIdx];
    if (!fruit) {
      return;
    }
    this.bufferSlots[bufIdx] = null;
    const anchor = this.bufferSlotAnchors[bufIdx]!;
    const worldStart = anchor.toGlobal(new PIXI.Point(fruit.x, fruit.y));
    anchor.removeChild(fruit);
    const lp = this.fruitLayer.toLocal(worldStart);
    fruit.position.copyFrom(lp);
    fruit.scale.set(this.randomInRange(BOWL_FRUIT_SCALE_MIN, BOWL_FRUIT_SCALE_MAX));
    this.mountFruitInBowlLayer(fruit, true);
    fruit.phase = 'bowl';
    fruit.bufferSlotIndex = null;
    fruit.picked = false;
    fruit.eventMode = 'static';
    fruit.cursor = 'pointer';
    const p = this.randomBowlPoint();
    fruit.position.set(p.x, p.y);
    fruit.velocityX = this.randomInRange(-10, 10);
    fruit.velocityY = this.randomInRange(-7, 7);
  }

  private unlockThirdParallelPlateAfterRevive(): void {
    if (this.parallelPlateCount >= 3) {
      return;
    }
    this.parallelPlateCount = 3;
    this.thirdPlateLockDecor.visible = false;
    this.orderViews[2]!.container.visible = true;
    const pv = this.plateVisualHolders[2];
    if (pv) {
      pv.locked = false;
      this.remountPlateDisc(pv);
    }
    this.assignOrderToPlate(2);
  }

  private performRevive(): void {
    const willUnlockPlate = this.parallelPlateCount < 3;
    for (let i = 0; i < this.bufferSize; i += 1) {
      if (this.bufferSlots[i]) {
        this.releaseBufferSlotToBowl(i);
      }
    }
    this.unlockThirdParallelPlateAfterRevive();
    if (willUnlockPlate && this.parallelPlateCount >= 3) {
      this.toast('已解锁第3路订单盘');
    }
    this.renderOrders();
    this.refreshHud();
    this.tryConsumeOrderFromBuffer();
  }

  private showLoseGiveUpOverlay(): void {
    this.hideToolHelpPanel();
    this.fruitLayer.eventMode = 'none';
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
    this.playOrderPlateCompleteTransition(plateIdx, () => {
      this.assignOrderToPlate(plateIdx);
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
    this.fruitLayer.eventMode = 'none';
    const idx = getBowlLevelIndex();
    const isLast = idx >= BOWL_LEVEL_COUNT - 1;
    const introduced = isLast ? [] : getNewFruitsIntroducedInLevel(idx + 1);
    const skinUnlocks = isLast ? [] : getBowlSkinUnlocksInLevel(idx + 2);
    const showLevelClear = (): void => {
      this.levelClearOverlay.show({
        newFruitIds: introduced,
        newSkinUnlocks: skinUnlocks,
        isLastLevel: isLast,
        onHome: () => {
          this.levelClearOverlay.hide();
          SceneManager.switchTo('home');
        },
        onNextLevel: () => {
          this.levelClearOverlay.hide();
          if (isLast) {
            setBowlLevelIndex(0);
          } else {
            setBowlLevelIndex(idx + 1);
          }
          this.startRound();
        },
        onShare: () => {
          const api = typeof wx !== 'undefined' ? wx : null;
          if (api?.shareAppMessage) {
            api.shareAppMessage({ title: '火锅碗里捞一捞，来挑战！' });
            this.toast('转发成功');
          } else {
            this.toast('转发请在微信小游戏中使用');
          }
        },
      });
    };
    const badge = getBowlBadgeDef(this.levelDef.levelNumber);
    recordBowlBadgeUnlocked(badge.levelNumber);
    this.badgeUnlockOverlay.show({
      badge,
      texture: TextureCache.get(`bowl_badge_${badge.levelNumber}`),
      onClose: showLevelClear,
    });
  }

  private showLoseOverlay(): void {
    this.hideToolHelpPanel();
    this.fruitLayer.eventMode = 'none';
    this.reviveOverlay.show({
      onRevive: () => {
        this.performRevive();
        this.reviveOverlay.hide();
        this.fruitLayer.eventMode = 'static';
      },
      onGiveUp: () => {
        this.reviveOverlay.hide();
        this.showLoseGiveUpOverlay();
      },
    });
  }

  private pickFruit(fruit: FruitItem): void {
    if (fruit.picked || fruit.phase !== 'bowl' || this.orderTransitionBusy || this.isBowlInteractionBlocked()) {
      return;
    }

    const plateIdx = this.resolvePlateForFruitId(fruit.fruitId);
    if (plateIdx !== null) {
      const slot = this.parallelOrders[plateIdx];
      if (!slot) {
        return;
      }
      AudioManager.playScoopSound();
      fruit.picked = true;
      fruit.phase = 'flying';
      fruit.eventMode = 'none';
      this.liftFruitToFlyingLayer(fruit);
      const fromX = fruit.x;
      const fromY = fruit.y;
      const world = this.getPlateSlotWorld(plateIdx, slot.progress);
      this.runFlightToPlate(fruit, fromX, fromY, world.x, world.y, () => {
        this.finishOrderCommitForFruit(fruit, plateIdx);
      });
      return;
    }

    const emptyIdx = this.findFirstEmptyBufferSlot();
    if (emptyIdx < 0) {
      this.showLoseOverlay();
      return;
    }

    fruit.picked = true;
    AudioManager.playScoopSound();
    fruit.phase = 'flying';
    fruit.eventMode = 'none';

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
        fruit.picked = false;
        fruit.phase = 'buffer';
        fruit.bufferSlotIndex = emptyIdx;
        parent.removeChild(fruit);
        fruit.position.set(0, 0);
        fruit.scale.set(0.88);
        anchor.addChild(fruit);
        this.bufferSlots[emptyIdx] = fruit;
        this.tryConsumeOrderFromBuffer();
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
    if (!slotState || slotState.progress >= this.orderSize) {
      return;
    }

    const fruit = this.bufferSlots[bufIdx];
    if (!fruit || fruit.fruitId !== slotState.fruitId) {
      return;
    }

    this.bufferFlightBusy = true;
    this.bufferSlots[bufIdx] = null;

    const anchor = this.bufferSlotAnchors[bufIdx]!;
    const worldStart = anchor.toGlobal(new PIXI.Point(fruit.x, fruit.y));
    anchor.removeChild(fruit);
    const lp = this.fruitLayer.toLocal(worldStart);
    fruit.position.copyFrom(lp);
    fruit.scale.set(this.randomInRange(1.24, 1.46));
    this.flyingFruitLayer.addChild(fruit);
    fruit.phase = 'flying';
    fruit.picked = true;
    fruit.eventMode = 'none';
    fruit.bufferSlotIndex = null;

    const world = this.getPlateSlotWorld(plateIdx, slotState.progress);
    const fromX = fruit.x;
    const fromY = fruit.y;
    this.runFlightToPlate(fruit, fromX, fromY, world.x, world.y, () => {
      this.bufferFlightBusy = false;
      this.finishOrderCommitForFruit(fruit, plateIdx);
    });
  }

  private finishOrderCommitForFruit(fruit: FruitItem, plateIdx: PlateIdx): void {
    this.remainingCounts[fruit.fruitId] = Math.max(0, (this.remainingCounts[fruit.fruitId] ?? 0) - 1);
    const slot = this.parallelOrders[plateIdx];
    if (slot) {
      slot.progress += 1;
    }
    fruit.removeFromParent();
    const fi = this.fruits.indexOf(fruit);
    if (fi >= 0) {
      this.fruits.splice(fi, 1);
    }
    fruit.destroy({ children: true });
    this.renderOrders();
    this.refreshHud();

    const order = this.parallelOrders[plateIdx];
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
    for (let i = 0; i < 3; i += 1) {
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
   * `plateIndex` 0/1/2 对应三圆盘圆心；`slotIndex` 为盘上三角槽位。
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
    holder.position.set(x, y);
    holder.visible = false;
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

  private shouldSubmergeFruit(fruit: FruitItem): boolean {
    return Math.sin(Date.now() * FRUIT_BOB_SPEED + fruit.bobSeed) < FRUIT_SURFACE_BOB_THRESHOLD;
  }

  private mountFruitInBowlLayer(fruit: FruitItem, rerollDepth = false): void {
    if (rerollDepth) {
      fruit.bobSeed = Math.random() * Math.PI * 2;
    }
    const target = this.shouldSubmergeFruit(fruit) ? this.submergedFruitLayer : this.surfaceFruitLayer;
    target.addChild(fruit);
    this.applyFruitSoupVisual(fruit);
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

  private applyFruitSoupVisual(fruit: FruitItem): void {
    const display = fruit.display as PIXI.DisplayObject & { tint?: number };
    if (fruit.parent === this.submergedFruitLayer) {
      fruit.alpha = 0.8;
      if (typeof display.tint === 'number') {
        display.tint = this.getSubmergedFruitTint();
      }
      return;
    }
    if (fruit.parent === this.surfaceFruitLayer) {
      fruit.alpha = 1;
      if (typeof display.tint === 'number') {
        display.tint = 0xffffff;
      }
      return;
    }
    fruit.alpha = 1;
    if (typeof display.tint === 'number') {
      display.tint = 0xffffff;
    }
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
      fruit.alpha = 1;
      this.flyingFruitLayer.addChild(fruit);
      return;
    }
    const world = parent.toGlobal(new PIXI.Point(fruit.x, fruit.y));
    parent.removeChild(fruit);
    const local = this.flyingFruitLayer.toLocal(world);
    fruit.position.copyFrom(local);
    fruit.alpha = 1;
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

  private createCenterText(text: string, fontSize: number, fill: number): PIXI.Text {
    const node = new PIXI.Text(text, {
      fontSize,
      fill,
      fontWeight: '700',
    });
    node.anchor.set(0.5);
    return node;
  }
}
