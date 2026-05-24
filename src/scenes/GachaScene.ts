import * as PIXI from 'pixi.js';
import { GACHA_PULL_COST, GACHA_REWARD_POOL, type GachaReward } from '@/config/economy';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { pullGachaOnce, type GachaPullResult } from '@/game/GachaState';
import { addCoins, getCoinBalance } from '@/game/Wallet';
import {
  CoinBar,
  COIN_ICON_TEXTURE_KEY,
  COIN_ICON_TEXTURE_PATH,
  createCoinIcon,
} from '@/gameobjects/CoinBar';
import { TextureCache } from '@/utils/TextureCache';
import {
  loadBowlSubpackage,
  loadFruitSliceSubpackage,
  loadGachaAssetsSubpackage,
} from '@/utils/loadBowlSubpackage';
import { isWxDevtoolsSimulator } from '@/utils/wxMinigameEnv';

const GACHA_IMAGE_DIR = 'subpackages/gacha_assets/assets/images/gacha';
const GACHA_BG_KEY = 'gacha_bg';
const GACHA_BG_PATH = `${GACHA_IMAGE_DIR}/gacha_bg.jpg`;
const GACHA_TITLE_KEY = 'gacha_title';
const GACHA_TITLE_PATH = `${GACHA_IMAGE_DIR}/gacha_title.png`;
const GACHA_BACK_BTN_KEY = 'gacha_back_btn';
const GACHA_BACK_BTN_PATH = 'subpackages/fruit_slice/assets/images/fruit_slice/back_button.png';
const GACHA_PULL_BTN_KEY = 'gacha_pull_btn';
const GACHA_PULL_BTN_PATH = `${GACHA_IMAGE_DIR}/gacha_pull_button.png`;
const GACHA_POOL_PANEL_KEY = 'gacha_pool_panel';
const GACHA_POOL_PANEL_PATH = `${GACHA_IMAGE_DIR}/gacha_pool_panel.png`;
const GACHA_MACHINE_BACK_KEY = 'gacha_machine_back';
const GACHA_MACHINE_BACK_PATH = `${GACHA_IMAGE_DIR}/gacha_machine_back.png`;
const GACHA_RESULT_TITLE_RIBBON_KEY = 'gacha_result_title_ribbon';
const GACHA_RESULT_TITLE_RIBBON_PATH = `${GACHA_IMAGE_DIR}/gacha_result_title_ribbon.png`;
const GACHA_CAPSULES_SHEET_KEY = 'gacha_capsules';
const GACHA_CAPSULES_SHEET_PATH = `${GACHA_IMAGE_DIR}/gacha_capsules_sheet.png`;

const BOWL_TOOL_REWARD_ICONS_KEY = 'gacha_pool_bowl_tool_icons';
const BOWL_TOOL_REWARD_ICONS_PATH = `${GACHA_IMAGE_DIR}/pool_bowl_tool_icons.png`;
const FRUIT_SLICE_TOOL_BUTTONS_KEY = 'gacha_pool_fruit_tool_icons';
const FRUIT_SLICE_TOOL_BUTTONS_PATH = `${GACHA_IMAGE_DIR}/pool_fruit_tool_icons.png`;
const BUNDLE_REWARD_ICONS_KEY = 'gacha_pool_bundle_icons';
const BUNDLE_REWARD_ICONS_PATH = `${GACHA_IMAGE_DIR}/pool_bundle_icons.png`;

/** 玻璃球区域中心相对扭蛋机左上的归一化位置（按 v3 立体机身贴图量得）。 */
const DOME_CENTER_NX = 0.50;
const DOME_CENTER_NY = 0.42;
/** 玻璃球半径 / 贴图宽度，略小于可视玻璃边缘，避免球压到边框。 */
const DOME_RADIUS_NX = 0.36;
/** 出蛋口中心相对扭蛋机左上的归一化位置。 */
const EGG_SLOT_NX = 0.50;
const EGG_SLOT_NY = 0.75;
/** 胶囊 sprite sheet 网格规格（3×3 = 9 帧）。 */
const CAPSULE_SHEET_COLS = 3;
const CAPSULE_SHEET_ROWS = 3;
const CAPSULE_FRAME_COUNT = CAPSULE_SHEET_COLS * CAPSULE_SHEET_ROWS;
/** v5 起改用“机身贴图自带一堆球”的静态方案，不再运行时叠胶囊球。 */
const DOME_BALL_COUNT = 0;
const GM_ADD_COINS_AMOUNT = 200;

/** 金币扭蛋活动：消耗果切返利金币，抽取关卡/果切道具。
 *  视觉：整机贴图 + 程序动画（idle bob / shake / 出蛋飞行 / 光线 burst），
 *  避免大量帧贴图。
 */
export class GachaScene implements Scene {
  readonly name = 'gacha';
  readonly container = new PIXI.Container();

  private readonly bgRoot = new PIXI.Container();
  private readonly bgFill = new PIXI.Graphics();
  private readonly bgRays = new PIXI.Graphics();
  private readonly bgSprite = new PIXI.Sprite();
  private readonly machineRoot = new PIXI.Container();
  /** 扭蛋机底层贴图（机身轮廓 + 顶 + 底 + 出蛋口 + 把手 + 玻璃罩平涂 cyan 底色）。 */
  private readonly machineBackSprite = new PIXI.Sprite();
  /** 可选玻璃罩高光 overlay。v3 默认使用机身贴图自带玻璃高光，不再程序绘制。 */
  private readonly domeOverlaySprite = new PIXI.Sprite();
  private readonly machineFallback = new PIXI.Graphics();
  /** 围绕玻璃球的旋转金光（idle 慢转，抽奖时加速） */
  private readonly domeAuraRoot = new PIXI.Container();
  private readonly domeRays = new PIXI.Container();
  private readonly domeRingRays = new PIXI.Container();
  /** 玻璃球上方点缀的闪烁星星 */
  private readonly domeSparkles: Array<{ node: PIXI.Graphics; phase: number }> = [];
  /** 玻璃罩内胶囊球容器 + 圆形 mask */
  private readonly domeBallsLayer = new PIXI.Container();
  private readonly domeMaskGraphics = new PIXI.Graphics();
  /** 标题：先尝试贴图，无贴图就用 PIXI.Text 兜底（两者只显示一个） */
  private titleSprite: PIXI.Sprite | null = null;
  private titleText: PIXI.Text | null = null;
  /** 返回按钮：贴图 + 透明 hitArea，无贴图退回程序绘制药丸 */
  private readonly backButtonRoot = new PIXI.Container();
  private readonly backButtonSprite = new PIXI.Sprite();
  private readonly backButtonFallback = new PIXI.Graphics();
  private backButtonFallbackText: PIXI.Text | null = null;
  /** 抽奖按钮：药丸 + 居中文字 + 右侧金币 N */
  private readonly pullButtonRoot = new PIXI.Container();
  private readonly pullButtonBg = new PIXI.Graphics();
  private readonly pullButtonBgSprite = new PIXI.Sprite();
  private readonly pullButtonLabel: PIXI.Text;
  private readonly pullButtonCoinIconRoot = new PIXI.Container();
  private readonly pullButtonCostText: PIXI.Text;
  private readonly pullHintText: PIXI.Text;
  /** 「可能获得」面板：贴图底 + 7 个程序道具图标 */
  private readonly poolPanelRoot = new PIXI.Container();
  private readonly poolPanelSprite = new PIXI.Sprite();
  private readonly poolPanelFallback = new PIXI.Graphics();
  private readonly poolPanelTitle: PIXI.Text;
  private readonly poolPanelLabelSprite = new PIXI.Sprite();
  private readonly poolPanelSlotsRoot = new PIXI.Container();
  private readonly coinBar = new CoinBar();
  private readonly gmCoinButtonRoot = new PIXI.Container();
  private readonly resultLayer = new PIXI.Container();
  private readonly tick = (delta: number): void => this.updateAnimation(delta);
  private readonly transientTickers = new Set<(delta: number) => void>();
  private animationTime = 0;
  /** 抽奖整体阶段：idle / shake / drop / result */
  private phase: 'idle' | 'shake' | 'drop' | 'result' = 'idle';
  private phaseElapsed = 0;
  /** 当前 shake/drop 暂存的抽奖结果，drop 收尾时 commit 到 result 弹层。 */
  private pendingResult: GachaPullResult | null = null;
  /** 已生成的彩色扭蛋帧：出蛋动画随机抽一颗显示。 */
  private capsuleFrames: PIXI.Texture[] = [];
  /** 玻璃罩内的胶囊球阵（贴图就绪后才挂上） */
  private domeBalls: DomeBalls | null = null;
  private gachaTexturesPromise: Promise<void> | null = null;

  constructor() {
    this.pullButtonLabel = new PIXI.Text('抽一发！', {
      fontSize: 44,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0xa84a16,
      strokeThickness: 7,
      lineJoin: 'round',
      dropShadow: true,
      dropShadowBlur: 4,
      dropShadowDistance: 3,
      dropShadowColor: 0x5a2a16,
    });
    this.pullButtonLabel.anchor.set(0.5);
    this.pullButtonLabel.resolution = 2;

    this.pullButtonCostText = new PIXI.Text(`${GACHA_PULL_COST}`, {
      fontSize: 30,
      fill: 0xfff7c2,
      fontWeight: '900',
      stroke: 0x6d2a10,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    this.pullButtonCostText.anchor.set(0, 0.5);
    this.pullButtonCostText.resolution = 2;

    this.pullHintText = new PIXI.Text('金币通过果切挑战获得', {
      fontSize: 22,
      fill: 0x9c5a24,
      fontWeight: '900',
      stroke: 0xfff1d0,
      strokeThickness: 3,
      lineJoin: 'round',
    });
    this.pullHintText.anchor.set(0.5);
    this.pullHintText.resolution = 2;

    this.poolPanelTitle = new PIXI.Text('可能获得', {
      fontSize: 24,
      fill: 0xfff06a,
      fontWeight: '900',
      stroke: 0xa83a16,
      strokeThickness: 5,
      lineJoin: 'round',
      dropShadow: true,
      dropShadowBlur: 3,
      dropShadowDistance: 2,
      dropShadowColor: 0x4a1a08,
    });
    this.poolPanelTitle.anchor.set(0.5);
    this.poolPanelTitle.resolution = 2;

    void TextureCache.load(COIN_ICON_TEXTURE_KEY, COIN_ICON_TEXTURE_PATH).then(() => {
      this.coinBar.refreshIcon();
      this.refreshPullButtonCoinIcon();
    });
    this.build();
  }

  private ensureGachaTextures(): Promise<void> {
    if (!this.gachaTexturesPromise) {
      this.gachaTexturesPromise = this.preloadGachaTextures().catch((error) => {
        this.gachaTexturesPromise = null;
        console.warn('[GachaScene] preload failed', error);
      });
    }
    return this.gachaTexturesPromise;
  }

  async prepare(): Promise<void> {
    await this.ensureGachaTextures();
  }

  /** 预加载本场景全部贴图，每张失败都允许，运行时各自走兜底。 */
  private async preloadGachaTextures(): Promise<void> {
    await Promise.all([
      loadBowlSubpackage(),
      loadFruitSliceSubpackage(),
      loadGachaAssetsSubpackage(),
    ]);
    const jobs: Array<Promise<unknown>> = [
      TextureCache.load(GACHA_BG_KEY, GACHA_BG_PATH).then((tex) => this.applyBgTexture(tex)),
      TextureCache.load(GACHA_TITLE_KEY, GACHA_TITLE_PATH).then((tex) => this.applyTitleTexture(tex)),
      TextureCache.load(GACHA_BACK_BTN_KEY, GACHA_BACK_BTN_PATH).then((tex) => this.applyBackButtonTexture(tex)),
      TextureCache.load(GACHA_PULL_BTN_KEY, GACHA_PULL_BTN_PATH).then((tex) => this.applyPullButtonTexture(tex)),
      TextureCache.load(GACHA_POOL_PANEL_KEY, GACHA_POOL_PANEL_PATH).then((tex) => this.applyPoolPanelTexture(tex)),
      TextureCache.load(GACHA_MACHINE_BACK_KEY, GACHA_MACHINE_BACK_PATH).then((tex) => this.applyMachineBackTexture(tex)),
      TextureCache.load(GACHA_RESULT_TITLE_RIBBON_KEY, GACHA_RESULT_TITLE_RIBBON_PATH),
      TextureCache.load(GACHA_CAPSULES_SHEET_KEY, GACHA_CAPSULES_SHEET_PATH).then((tex) => this.applyCapsulesSheet(tex)),
      TextureCache.load(BOWL_TOOL_REWARD_ICONS_KEY, BOWL_TOOL_REWARD_ICONS_PATH).then(() => this.refreshPoolSlots()),
      TextureCache.load(FRUIT_SLICE_TOOL_BUTTONS_KEY, FRUIT_SLICE_TOOL_BUTTONS_PATH).then(() => this.refreshPoolSlots()),
      TextureCache.load(BUNDLE_REWARD_ICONS_KEY, BUNDLE_REWARD_ICONS_PATH).then(() => this.refreshPoolSlots()),
    ];
    await Promise.all(jobs);
  }

  onEnter(): void {
    AudioManager.useDefaultBackgroundMusic();
    void this.ensureGachaTextures();
    this.refreshBalance();
    this.phase = 'idle';
    this.phaseElapsed = 0;
    this.pendingResult = null;
    this.machineRoot.scale.set(1);
    this.machineRoot.rotation = 0;
    PIXI.Ticker.shared.remove(this.tick);
    PIXI.Ticker.shared.add(this.tick);
  }

  onExit(): void {
    PIXI.Ticker.shared.remove(this.tick);
    this.stopTransientTickers();
    this.clearResultLayer();
  }

  /** Scene 接口的 update 由 SceneManager 调用，但本场景动画使用 PIXI ticker，避免依赖。 */
  update(_dt: number): void {}

  private addTransientTicker(tick: (delta: number) => void): void {
    this.transientTickers.add(tick);
    PIXI.Ticker.shared.add(tick);
  }

  private removeTransientTicker(tick: (delta: number) => void): void {
    PIXI.Ticker.shared.remove(tick);
    this.transientTickers.delete(tick);
  }

  private stopTransientTickers(): void {
    this.transientTickers.forEach((tick) => PIXI.Ticker.shared.remove(tick));
    this.transientTickers.clear();
  }

  private build(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const top = Game.safeTop;

    /** 背景层：先用程序矢量兜底，gacha_bg 加载好后会在 applyBgTexture 里覆盖 */
    this.bgFill.beginFill(0xffefd4);
    this.bgFill.drawRect(0, 0, W, H);
    this.bgFill.endFill();
    this.bgFill.beginFill(0xffd27d, 0.55);
    this.bgFill.drawCircle(W * 0.16, H * 0.18, 150);
    this.bgFill.drawCircle(W * 0.88, H * 0.78, 190);
    this.bgFill.endFill();
    this.bgRoot.addChild(this.bgFill);

    this.drawBackgroundRays(W, H);
    this.bgRoot.addChild(this.bgRays);
    this.bgSprite.anchor.set(0.5);
    this.bgSprite.position.set(W / 2, H / 2);
    this.bgSprite.visible = false;
    this.bgRoot.addChild(this.bgSprite);
    this.container.addChild(this.bgRoot);

    /** 返回按钮：贴图 + 矢量兜底两套都先挂上，applyBackButtonTexture 决定哪个可见 */
    this.layoutBackButton(58, top + 28, 96, 54);
    this.container.addChild(this.backButtonRoot);

    /** 标题：贴图 + 矢量兜底 */
    this.titleText = new PIXI.Text('金币扭蛋', {
      fontSize: 48,
      fill: 0xfff06a,
      fontWeight: '900',
      stroke: 0xa83a16,
      strokeThickness: 9,
      dropShadow: true,
      dropShadowBlur: 4,
      dropShadowDistance: 3,
      dropShadowColor: 0x4a1a08,
      lineJoin: 'round',
    });
    this.titleText.anchor.set(0.5);
    this.titleText.position.set(W / 2, top + 98);
    this.titleText.resolution = 2;
    this.container.addChild(this.titleText);

    this.titleSprite = new PIXI.Sprite();
    this.titleSprite.anchor.set(0.5);
    this.titleSprite.position.set(W / 2, top + 98);
    this.titleSprite.visible = false;
    this.container.addChild(this.titleSprite);

    this.coinBar.position.set(110, top + 28);
    this.container.addChild(this.coinBar);
    this.mountGmCoinButton(250, top + 28);

    /** 扭蛋机三层：machineBackSprite -> domeBallsLayer(罩内彩球) -> 可选 overlay */
    const machineCenterY = H * 0.42;
    this.machineRoot.position.set(W / 2, machineCenterY);

    this.machineBackSprite.anchor.set(0.5);
    this.drawMachineFallback();
    this.machineRoot.addChild(this.machineFallback);

    this.machineRoot.addChild(this.machineBackSprite);

    /** mask graphics 不直接进 stage，只作为 mask 引用；它的 transform 跟随 machineBackSprite */
    this.domeBallsLayer.mask = this.domeMaskGraphics;
    this.domeBallsLayer.alpha = 0.9;
    this.machineRoot.addChild(this.domeBallsLayer);
    this.machineRoot.addChild(this.domeMaskGraphics);

    this.domeOverlaySprite.anchor.set(0.5);
    this.domeOverlaySprite.alpha = 0.55;
    this.domeOverlaySprite.visible = false;
    this.machineRoot.addChild(this.domeOverlaySprite);

    this.container.addChild(this.machineRoot);

    /** 玻璃罩外圈金光 + 微星，作为环境氛围装饰（不在 mask 内） */
    this.domeAuraRoot.position.set(0, 0);
    this.domeRays.addChild(this.buildRays(20, 90, 230, 0xffe27a, 0.32));
    this.domeRingRays.addChild(this.buildRays(14, 116, 188, 0xffffff, 0.16));
    this.domeRingRays.rotation = Math.PI / 14;
    this.domeAuraRoot.addChild(this.domeRays);
    this.domeAuraRoot.addChild(this.domeRingRays);
    this.machineRoot.addChildAt(this.domeAuraRoot, 0);
    this.mountDomeSparkles();

    /** 抽奖按钮 + 提示 */
    const buttonY = Math.min(H - 500, machineCenterY + 430);
    this.layoutPullButton(W / 2, buttonY, Math.min(380, W * 0.72), 86);
    this.container.addChild(this.pullButtonRoot);

    this.pullHintText.position.set(W / 2, buttonY + 68);
    this.container.addChild(this.pullHintText);

    /** 「可能获得」面板：贴底 + 7 个槽位 */
    const poolPanelW = Math.min(740, W - 10);
    const poolPanelH = 200;
    const poolPanelY = H - poolPanelH / 2 - 30;
    this.layoutPoolPanel(W / 2, poolPanelY, poolPanelW, poolPanelH);
    this.container.addChild(this.poolPanelRoot);

    this.container.addChild(this.resultLayer);
  }

  /** 返回按钮：贴图 + 矢量兜底（先 mount 两套，applyBackButtonTexture 决定可见态） */
  private layoutBackButton(x: number, y: number, width: number, height: number): void {
    this.backButtonRoot.position.set(x, y);
    this.backButtonRoot.eventMode = 'static';
    this.backButtonRoot.cursor = 'pointer';
    this.backButtonRoot.hitArea = new PIXI.Rectangle(-width / 2, -height / 2, width, height);

    this.drawBackButtonFallback(width, height);
    this.backButtonRoot.addChild(this.backButtonFallback);

    this.backButtonFallbackText = new PIXI.Text('返回', {
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0xa83a16,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    this.backButtonFallbackText.anchor.set(0.5);
    this.backButtonFallbackText.resolution = 2;
    this.backButtonRoot.addChild(this.backButtonFallbackText);

    this.backButtonSprite.anchor.set(0.5);
    this.backButtonSprite.visible = false;
    this.backButtonRoot.addChild(this.backButtonSprite);

    this.backButtonRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('home');
    });
  }

  private drawBackButtonFallback(width: number, height: number): void {
    const g = this.backButtonFallback;
    g.clear();
    g.beginFill(0xff8a4a);
    g.lineStyle(3, 0xa83a16, 1);
    g.drawRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    g.endFill();
    g.beginFill(0xffd07a, 0.7);
    g.drawRoundedRect(-width / 2 + 6, -height / 2 + 5, width - 12, height * 0.4, height / 2);
    g.endFill();
  }

  /** 抽奖按钮：药丸 + 文字 + 右侧金币 N。 */
  private layoutPullButton(x: number, y: number, width: number, height: number): void {
    this.pullButtonRoot.position.set(x, y);
    this.pullButtonRoot.eventMode = 'static';
    this.pullButtonRoot.cursor = 'pointer';
    this.pullButtonRoot.hitArea = new PIXI.Rectangle(-width / 2, -height / 2, width, height);
    this.drawPullButtonBg(width, height);
    this.pullButtonRoot.addChild(this.pullButtonBg);
    this.pullButtonBgSprite.anchor.set(0.5);
    this.pullButtonBgSprite.visible = false;
    this.pullButtonRoot.addChild(this.pullButtonBgSprite);
    this.pullButtonLabel.position.set(-26, -2);
    this.pullButtonRoot.addChild(this.pullButtonLabel);
    this.pullButtonCoinIconRoot.position.set(80, 0);
    this.refreshPullButtonCoinIcon();
    this.pullButtonRoot.addChild(this.pullButtonCoinIconRoot);
    this.pullButtonCostText.position.set(98, 0);
    this.pullButtonRoot.addChild(this.pullButtonCostText);
    this.pullButtonRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.handlePullTap();
    });
  }

  private refreshPullButtonCoinIcon(): void {
    this.pullButtonCoinIconRoot.removeChildren();
    this.pullButtonCoinIconRoot.addChild(createCoinIcon(18));
  }

  private mountGmCoinButton(x: number, y: number): void {
    if (!isWxDevtoolsSimulator()) {
      return;
    }
    const root = this.gmCoinButtonRoot;
    root.position.set(x, y);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-58, -24, 116, 48);

    const bg = new PIXI.Graphics();
    bg.beginFill(0x29364a, 0.78);
    bg.lineStyle(2, 0xfff1a8, 0.85);
    bg.drawRoundedRect(-58, -24, 116, 48, 20);
    bg.endFill();
    root.addChild(bg);

    const label = new PIXI.Text(`GM +${GM_ADD_COINS_AMOUNT}`, {
      fontSize: 20,
      fill: 0xfff1a8,
      fontWeight: '900',
      stroke: 0x172033,
      strokeThickness: 3,
      lineJoin: 'round',
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    root.addChild(label);

    root.on('pointertap', () => {
      AudioManager.playButtonSound();
      addCoins(GM_ADD_COINS_AMOUNT);
      this.refreshBalance();
      this.coinBar.bump();
    });
    this.container.addChild(root);
  }

  private drawPullButtonBg(width: number, height: number): void {
    const g = this.pullButtonBg;
    g.clear();
    g.beginFill(0x6b3a16, 0.32);
    g.drawRoundedRect(-width / 2 + 4, -height / 2 + 8, width, height, height / 2);
    g.endFill();
    g.lineStyle(5, 0x8d3a0d, 1);
    g.beginFill(0xff9a3c);
    g.drawRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    g.endFill();
    g.lineStyle(2, 0xffffff, 0.6);
    g.beginFill(0xffd07a, 0.78);
    g.drawRoundedRect(-width / 2 + 8, -height / 2 + 6, width - 16, Math.max(18, height * 0.42), height / 2);
    g.endFill();
  }

  /** 「可能获得」面板：贴图底 + 7 个槽位 */
  private layoutPoolPanel(x: number, y: number, width: number, height: number): void {
    this.poolPanelRoot.position.set(x, y);
    this.drawPoolPanelFallback(width, height);
    this.poolPanelRoot.addChild(this.poolPanelFallback);
    this.poolPanelSprite.anchor.set(0.5);
    this.poolPanelSprite.visible = false;
    this.poolPanelRoot.addChild(this.poolPanelSprite);
    this.poolPanelLabelSprite.anchor.set(0.5);
    this.poolPanelLabelSprite.visible = false;
    this.poolPanelLabelSprite.position.set(0, -height / 2 - 14);
    this.poolPanelRoot.addChild(this.poolPanelLabelSprite);
    this.poolPanelTitle.position.set(0, -height / 2 + 24);
    this.poolPanelRoot.addChild(this.poolPanelTitle);
    this.poolPanelSlotsRoot.position.set(0, 0);
    this.poolPanelRoot.addChild(this.poolPanelSlotsRoot);
    this.rebuildPoolSlots(width, height);
  }

  private drawPoolPanelFallback(width: number, height: number): void {
    const g = this.poolPanelFallback;
    g.clear();
    g.beginFill(0x000000, 0.18);
    g.drawRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, 22);
    g.endFill();
    g.lineStyle(4, 0x3a8a6b, 1);
    g.beginFill(0xfff9ea);
    g.drawRoundedRect(-width / 2, -height / 2, width, height, 22);
    g.endFill();
    g.lineStyle(2, 0x9be3c9, 0.85);
    g.drawRoundedRect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12, 18);
  }

  private drawBackgroundRays(W: number, H: number): void {
    const g = this.bgRays;
    g.clear();
    const cx = W / 2;
    const cy = H * 0.46;
    const rays = 24;
    for (let i = 0; i < rays; i += 1) {
      const a = (Math.PI * 2 * i) / rays;
      const inner = 60;
      const outer = Math.max(W, H) * 0.9;
      const spread = i % 2 === 0 ? 0.07 : 0.045;
      const alpha = i % 2 === 0 ? 0.18 : 0.1;
      g.beginFill(0xffd47a, alpha);
      g.moveTo(cx + Math.cos(a - spread) * inner, cy + Math.sin(a - spread) * inner);
      g.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      g.lineTo(cx + Math.cos(a + spread) * inner, cy + Math.sin(a + spread) * inner);
      g.closePath();
      g.endFill();
    }
  }

  /** 玻璃球区域上方放置 6 颗微星，idle 时缓慢闪烁；shake 时大幅闪烁。 */
  private mountDomeSparkles(): void {
    const points = [
      [-90, -90, 0],
      [80, -110, 0.8],
      [-130, -10, 1.5],
      [120, -10, 2.2],
      [-30, -160, 2.8],
      [40, -160, 3.4],
    ] as const;
    for (const [x, y, phase] of points) {
      const star = new PIXI.Graphics();
      star.beginFill(0xffffff, 0.95);
      star.moveTo(0, -8);
      star.lineTo(3, -3);
      star.lineTo(8, 0);
      star.lineTo(3, 3);
      star.lineTo(0, 8);
      star.lineTo(-3, 3);
      star.lineTo(-8, 0);
      star.lineTo(-3, -3);
      star.closePath();
      star.endFill();
      star.beginFill(0xfff0a2, 0.75);
      star.drawCircle(0, 0, 2.5);
      star.endFill();
      star.position.set(x, y);
      star.blendMode = PIXI.BLEND_MODES.ADD;
      this.machineRoot.addChild(star);
      this.domeSparkles.push({ node: star, phase });
    }
  }

  private buildRays(count: number, innerR: number, outerR: number, color: number, alpha: number): PIXI.Graphics {
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
    return g;
  }

  /** 背景贴图就绪：铺满屏幕（按宽自适应缩放），同时隐藏矢量兜底。 */
  private applyBgTexture(tex: PIXI.Texture | null): void {
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return;
    }
    this.bgSprite.texture = tex;
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const sx = W / tex.width;
    const sy = H / tex.height;
    const scale = Math.max(sx, sy);
    this.bgSprite.scale.set(scale);
    this.bgSprite.visible = true;
    this.bgFill.visible = false;
    this.bgRays.visible = false;
  }

  private applyTitleTexture(tex: PIXI.Texture | null): void {
    if (!tex || tex === PIXI.Texture.EMPTY || !this.titleSprite) {
      return;
    }
    this.titleSprite.texture = tex;
    const targetH = 78;
    const s = targetH / tex.height;
    this.titleSprite.scale.set(s);
    this.titleSprite.visible = true;
    if (this.titleText) {
      this.titleText.visible = false;
    }
  }

  private applyBackButtonTexture(tex: PIXI.Texture | null): void {
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return;
    }
    this.backButtonSprite.texture = tex;
    const targetH = 54;
    const s = targetH / tex.height;
    this.backButtonSprite.scale.set(s);
    this.backButtonSprite.visible = true;
    this.backButtonFallback.visible = false;
    if (this.backButtonFallbackText) {
      this.backButtonFallbackText.visible = false;
    }
  }

  private applyPullButtonTexture(tex: PIXI.Texture | null): void {
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return;
    }
    this.pullButtonBgSprite.texture = tex;
    const targetW = Math.min(380, Game.logicWidth * 0.72);
    const s = targetW / tex.width;
    this.pullButtonBgSprite.scale.set(s);
    this.pullButtonBgSprite.visible = true;
    this.pullButtonBg.visible = false;
  }

  private applyPoolPanelTexture(tex: PIXI.Texture | null): void {
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return;
    }
    this.poolPanelSprite.texture = tex;
    const targetW = Math.min(740, Game.logicWidth - 10);
    const s = targetW / tex.width;
    this.poolPanelSprite.scale.set(s);
    this.poolPanelSprite.visible = true;
    this.poolPanelFallback.visible = false;
    this.poolPanelTitle.visible = false;
    this.poolPanelLabelSprite.visible = false;
  }

  /** 扭蛋机底层贴图就绪：定位+缩放，并同步 dome 几何（mask/balls/overlay）。 */
  private applyMachineBackTexture(tex: PIXI.Texture | null): void {
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return;
    }
    this.machineBackSprite.texture = tex;
    const targetH = Math.min(660, Game.logicHeight * 0.58);
    const scale = targetH / tex.height;
    this.machineBackSprite.scale.set(scale);
    this.machineFallback.visible = false;
    this.relayoutDomeElements();
  }

  /** 胶囊 sprite sheet 就绪：构造 9 帧 sub-texture 数组并交给 DomeBalls。 */
  private applyCapsulesSheet(tex: PIXI.Texture | null): void {
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return;
    }
    const frames: PIXI.Texture[] = [];
    const cellW = Math.floor(tex.width / CAPSULE_SHEET_COLS);
    const cellH = Math.floor(tex.height / CAPSULE_SHEET_ROWS);
    for (let r = 0; r < CAPSULE_SHEET_ROWS; r += 1) {
      for (let c = 0; c < CAPSULE_SHEET_COLS; c += 1) {
        const rect = new PIXI.Rectangle(c * cellW, r * cellH, cellW, cellH);
        frames.push(new PIXI.Texture(tex.baseTexture, rect));
      }
    }
    if (frames.length < CAPSULE_FRAME_COUNT) {
      return;
    }
    this.capsuleFrames = frames;
    if (!this.domeBalls) {
      this.domeBalls = new DomeBalls(this.domeBallsLayer, frames, DOME_BALL_COUNT);
    } else {
      this.domeBalls.setFrames(frames);
    }
    this.relayoutDomeElements();
  }

  /** 贴图未到位前的兜底矢量：圆胖糖果机轮廓 + 玻璃球。 */
  private drawMachineFallback(): void {
    const g = this.machineFallback;
    g.clear();
    g.beginFill(0xff5b6f);
    g.lineStyle(8, 0xffffff, 0.92);
    g.drawRoundedRect(-150, -92, 300, 260, 42);
    g.endFill();
    g.beginFill(0xffd15a);
    g.drawRoundedRect(-118, 70, 236, 96, 28);
    g.endFill();
    g.beginFill(0xb7f1ff, 0.86);
    g.lineStyle(6, 0xffffff, 0.95);
    g.drawCircle(0, -30, 104);
    g.endFill();
  }

  /** 当机身或 overlay 贴图变化、或胶囊就绪时统一刷新玻璃罩相关几何。 */
  private relayoutDomeElements(): void {
    const tex = this.machineBackSprite.texture;
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return;
    }
    const sx = this.machineBackSprite.scale.x;
    const sy = this.machineBackSprite.scale.y;
    const wPx = tex.width * sx;
    const hPx = tex.height * sy;
    const domeX = (DOME_CENTER_NX - 0.5) * wPx;
    const domeY = (DOME_CENTER_NY - 0.5) * hPx;
    const domeR = DOME_RADIUS_NX * wPx;

    /** 罩外的旋转金光 / 微星 */
    this.domeAuraRoot.position.set(domeX, domeY);
    const auraScale = (wPx / 580) * 0.95;
    this.domeAuraRoot.scale.set(auraScale);
    for (const sp of this.domeSparkles) {
      const baseX = (sp.node as PIXI.Graphics & { _baseX?: number })._baseX;
      const baseY = (sp.node as PIXI.Graphics & { _baseY?: number })._baseY;
      const bx = typeof baseX === 'number' ? baseX : sp.node.x;
      const by = typeof baseY === 'number' ? baseY : sp.node.y;
      (sp.node as PIXI.Graphics & { _baseX?: number; _baseY?: number })._baseX = bx;
      (sp.node as PIXI.Graphics & { _baseX?: number; _baseY?: number })._baseY = by;
      sp.node.position.set(domeX + bx * auraScale, domeY + by * auraScale);
    }

    /** dome mask = 玻璃罩内圆 */
    const m = this.domeMaskGraphics;
    m.clear();
    m.beginFill(0xffffff);
    m.drawCircle(domeX, domeY, domeR * 0.96);
    m.endFill();

    /** 可选 dome overlay 贴图：v3 默认缺失也不程序绘制，高光来自机器贴图本身。 */
    if (this.domeOverlaySprite.visible
      && this.domeOverlaySprite.texture
      && this.domeOverlaySprite.texture !== PIXI.Texture.EMPTY
    ) {
      this.domeOverlaySprite.scale.set(sx, sy);
      this.domeOverlaySprite.position.set(0, 0);
    }

    /** 胶囊球阵在玻璃罩内 */
    this.domeBalls?.setDome(domeX, domeY, domeR * 0.92);
  }

  /** 出蛋口在世界（machineRoot 子坐标）中的近似位置，用于飞蛋动画起点。 */
  private getEggSlotLocal(): { x: number; y: number } {
    const tex = this.machineBackSprite.texture;
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return { x: 0, y: 80 };
    }
    const sx = this.machineBackSprite.scale.x;
    const sy = this.machineBackSprite.scale.y;
    const wPx = tex.width * sx;
    const hPx = tex.height * sy;
    return {
      x: (EGG_SLOT_NX - 0.5) * wPx,
      y: (EGG_SLOT_NY - 0.5) * hPx,
    };
  }

  /** 「可能获得」面板：按奖池顺序排 7 个槽位，每槽放对应道具图标 + 稀有度星 */
  private rebuildPoolSlots(panelW: number, panelH: number): void {
    while (this.poolPanelSlotsRoot.children.length > 0) {
      const child = this.poolPanelSlotsRoot.children[0]!;
      this.poolPanelSlotsRoot.removeChild(child);
      child.destroy({ children: true });
    }
    const slots = GACHA_REWARD_POOL.slice(0, 7);
    const slotCount = slots.length;
    if (slotCount === 0) {
      return;
    }
    const innerW = panelW - 36;
    const slotW = Math.min(108, innerW / slotCount);
    const gap = (innerW - slotW * slotCount) / Math.max(1, slotCount - 1);
    const startX = -innerW / 2 + slotW / 2;
    for (let i = 0; i < slotCount; i += 1) {
      const reward = slots[i]!;
      const slot = this.createPoolSlot(reward, slotW);
      slot.position.set(startX + i * (slotW + gap), 0);
      this.poolPanelSlotsRoot.addChild(slot);
    }
    /** 图标排在纯面板中线，不再程序绘制凹槽，避免与贴图槽位错位。 */
    this.poolPanelSlotsRoot.position.set(0, panelH * 0.17);
  }

  /** 单个奖池预览项：只放道具图标，不再程序绘制底槽，避免和贴图面板难对齐。 */
  private createPoolSlot(reward: GachaReward, slotW: number): PIXI.Container {
    const root = new PIXI.Container();
    const icon = this.createPoolSlotIcon(reward, slotW);
    if (icon) {
      root.addChild(icon);
    }
    return root;
  }

  private createPoolSlotIcon(reward: GachaReward, size: number): PIXI.Container | null {
    const root = new PIXI.Container();
    if (reward.kind === 'bowlTool') {
      const tex = this.getBowlToolIconTexture(reward.tool);
      if (tex) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const s = size / Math.max(tex.width, tex.height);
        sp.scale.set(s);
        root.addChild(sp);
      } else {
        root.addChild(this.fallbackIconText(reward.tool === 'addDish' ? '碟' : reward.tool === 'remove' ? '移' : '乱'));
      }
      return root;
    }
    if (reward.kind === 'fruitSliceTool') {
      const tex = this.getFruitSliceToolIconTexture(reward.tool);
      if (tex) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const s = size / Math.max(tex.width, tex.height);
        sp.scale.set(s);
        root.addChild(sp);
      } else {
        root.addChild(this.fallbackIconText(reward.tool === 'eliminate' ? '消' : '乱'));
      }
      return root;
    }
    /** bundle 礼包：使用独立礼包图标，避免“原道具 + 礼盒角标”在小槽位里含义不清。 */
    const bundleTex = this.getBundleRewardIconTexture(reward);
    if (bundleTex) {
      const sp = new PIXI.Sprite(bundleTex);
      sp.anchor.set(0.5);
      const s = size / Math.max(bundleTex.width, bundleTex.height);
      sp.scale.set(s);
      root.addChild(sp);
    } else {
      root.addChild(this.fallbackIconText('礼'));
    }
    return root;
  }

  private fallbackIconText(s: string): PIXI.Text {
    const t = new PIXI.Text(s, {
      fontSize: 26,
      fill: 0xfff06a,
      fontWeight: '900',
      stroke: 0xa83a16,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    t.anchor.set(0.5);
    t.resolution = 2;
    return t;
  }

  private getBowlToolIconTexture(kind: 'addDish' | 'remove' | 'shuffle'): PIXI.Texture | null {
    const sheet = TextureCache.get(BOWL_TOOL_REWARD_ICONS_KEY);
    if (!sheet || sheet.width <= 4) {
      return null;
    }
    const idx = kind === 'addDish' ? 0 : kind === 'remove' ? 1 : 2;
    const cellW = Math.floor(sheet.width / 3);
    const x = cellW * idx;
    const w = idx === 2 ? sheet.width - cellW * 2 : cellW;
    return new PIXI.Texture(sheet.baseTexture, new PIXI.Rectangle(x, 0, w, sheet.height));
  }

  private getFruitSliceToolIconTexture(kind: 'eliminate' | 'shuffle'): PIXI.Texture | null {
    const sheet = TextureCache.get(FRUIT_SLICE_TOOL_BUTTONS_KEY);
    if (!sheet || sheet.width <= 4) {
      return null;
    }
    const half = Math.floor(sheet.width / 2);
    const rect = kind === 'eliminate'
      ? new PIXI.Rectangle(0, 0, half, sheet.height)
      : new PIXI.Rectangle(half, 0, sheet.width - half, sheet.height);
    return new PIXI.Texture(sheet.baseTexture, rect);
  }

  private getBundleRewardIconTexture(reward: Extract<GachaReward, { kind: 'bundle' }>): PIXI.Texture | null {
    const sheet = TextureCache.get(BUNDLE_REWARD_ICONS_KEY);
    if (!sheet || sheet.width <= 4) {
      return null;
    }
    const isFruitBundle = reward.rewards.some((item) => item.kind === 'fruitSliceTool');
    const half = Math.floor(sheet.width / 2);
    const rect = isFruitBundle
      ? new PIXI.Rectangle(half, 0, sheet.width - half, sheet.height)
      : new PIXI.Rectangle(0, 0, half, sheet.height);
    return new PIXI.Texture(sheet.baseTexture, rect);
  }

  private refreshPoolSlots(): void {
    /** 道具贴图后到位：按当前面板宽度重排 */
    const panelW = Math.min(740, Game.logicWidth - 10);
    const panelH = 200;
    this.rebuildPoolSlots(panelW, panelH);
  }

  private handlePullTap(): void {
    if (this.phase !== 'idle') {
      return;
    }
    const balance = getCoinBalance();
    if (balance < GACHA_PULL_COST) {
      this.showInsufficientCoinsToast();
      return;
    }
    const result = pullGachaOnce();
    this.pendingResult = result;
    this.refreshBalance();
    if (!result.ok) {
      this.showInsufficientCoinsToast();
      this.pendingResult = null;
      return;
    }
    this.startShakePhase();
  }

  private showInsufficientCoinsToast(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const toast = new PIXI.Text('金币不足，先去果切挑战赚金币', {
      fontSize: 24,
      fill: 0xfff1d0,
      fontWeight: '900',
      stroke: 0x6d2a10,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    toast.anchor.set(0.5);
    toast.position.set(W / 2, H * 0.34);
    toast.resolution = 2;
    this.resultLayer.addChild(toast);
    let elapsed = 0;
    const tick = (delta: number): void => {
      elapsed += delta / 60;
      toast.alpha = Math.max(0, 1 - Math.max(0, elapsed - 1.0) * 1.6);
      toast.y = H * 0.34 - elapsed * 24;
      if (elapsed > 1.7) {
        this.removeTransientTicker(tick);
        toast.parent?.removeChild(toast);
        toast.destroy({ children: true });
      }
    };
    this.addTransientTicker(tick);
  }

  private startShakePhase(): void {
    this.phase = 'shake';
    this.phaseElapsed = 0;
    AudioManager.playGachaPullSound();
    this.domeBalls?.startShake();
  }

  private startDropPhase(): void {
    this.phase = 'drop';
    this.phaseElapsed = 0;
    this.machineRoot.rotation = 0;
    this.machineRoot.scale.set(1);
    this.domeBalls?.endShake();
    this.spawnEggBurst();
  }

  /** 从扭蛋机出蛋口位置弹出一颗金蛋，飞到屏幕中央并放大；途中迸发星星。 */
  private spawnEggBurst(): void {
    const slotLocal = this.getEggSlotLocal();
    const startX = this.machineRoot.x + slotLocal.x;
    const startY = this.machineRoot.y + slotLocal.y;
    const targetX = Game.logicWidth / 2;
    const targetY = Game.logicHeight * 0.42;

    const egg = this.createRandomCapsuleIcon(86);
    egg.position.set(startX, startY);
    egg.scale.set(0.6);
    this.resultLayer.addChild(egg);
    AudioManager.playGachaCapsulePopSound();

    let elapsed = 0;
    const duration = 0.85;
    const tick = (delta: number): void => {
      if (egg.destroyed) {
        this.removeTransientTicker(tick);
        return;
      }
      elapsed += delta / 60;
      const p = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      egg.position.x = startX + (targetX - startX) * ease;
      egg.position.y = startY + (targetY - startY) * ease - Math.sin(p * Math.PI) * 80;
      egg.scale.set(0.6 + 1.6 * ease);
      egg.rotation += delta * 0.04;
      if (p >= 1) {
        this.removeTransientTicker(tick);
        egg.parent?.removeChild(egg);
        egg.destroy({ children: true });
        this.commitResultOverlay();
      }
    };
    this.addTransientTicker(tick);
  }

  private commitResultOverlay(): void {
    const result = this.pendingResult;
    this.pendingResult = null;
    this.phase = 'result';
    if (!result || !result.ok || !result.reward) {
      this.phase = 'idle';
      return;
    }
    this.showRewardOverlay(result.reward);
  }

  /** 抽奖结果遮罩：遮罩 + 奖励对应图标 + 旋转金光 + 奖励名 */
  private showRewardOverlay(reward: GachaReward): void {
    this.clearResultLayer();
    AudioManager.playGachaRewardRevealSound();
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
    const rays = this.buildRays(20, 84, 250, 0xffe27a, 0.42);
    burstRoot.addChild(rays);
    const ringRays = this.buildRays(14, 110, 200, 0xffffff, 0.22);
    ringRays.rotation = Math.PI / 14;
    burstRoot.addChild(ringRays);

    const rarityTitle = this.getRewardRarityTitle(reward);
    const titleY = centerY - 200;
    const titleTextY = titleY - 10;
    const titleRibbon = this.createResultTitleRibbon();
    titleRibbon.position.set(centerX, titleY + 2);
    root.addChild(titleRibbon);

    const title = new PIXI.Text(rarityTitle, {
      fontSize: 42,
      fill: 0xfff06a,
      fontWeight: '900',
      stroke: 0x6d2a10,
      strokeThickness: 7,
      dropShadow: true,
      dropShadowBlur: 4,
      dropShadowDistance: 2,
      dropShadowColor: 0x2c1208,
      lineJoin: 'round',
    });
    title.anchor.set(0.5);
    title.position.set(centerX, titleTextY);
    title.resolution = 2;
    root.addChild(title);

    const rewardIcon = this.createRewardOverlayIcon(reward, 250);
    rewardIcon.position.set(centerX, centerY);
    root.addChild(rewardIcon);

    const rewardLabel = new PIXI.Text(reward.label, {
      fontSize: 44,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x6d2a10,
      strokeThickness: 7,
      dropShadow: true,
      dropShadowBlur: 4,
      dropShadowDistance: 3,
      dropShadowColor: 0x2c1208,
      lineJoin: 'round',
    });
    rewardLabel.anchor.set(0.5);
    rewardLabel.position.set(centerX, centerY + 156);
    rewardLabel.resolution = 2;
    root.addChild(rewardLabel);

    const bundleDetailText = reward.kind === 'bundle' ? this.getBundleRewardDetailText(reward) : '';
    const subLine = new PIXI.Text(bundleDetailText, {
      fontSize: 24,
      fill: 0xfff1d0,
      fontWeight: '900',
      stroke: 0x3b2316,
      strokeThickness: 4,
      lineJoin: 'round',
    });
    subLine.anchor.set(0.5);
    subLine.position.set(centerX, centerY + 210);
    subLine.resolution = 2;
    subLine.visible = bundleDetailText.length > 0;
    if (subLine.visible) {
      root.addChild(subLine);
    }

    const closeHint = new PIXI.Text('点击任意处关闭', {
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
    rewardIcon.scale.set(0);
    rewardLabel.alpha = 0;
    titleRibbon.alpha = 0;
    title.alpha = 0;
    title.y -= 14;
    const localTick = (delta: number): void => {
      if (closing || root.destroyed) {
        this.removeTransientTicker(localTick);
        return;
      }
      elapsed += delta / 60;
      const t = elapsed;
      rays.rotation += delta * 0.012;
      ringRays.rotation -= delta * 0.0065;
      const settle = Math.min(1, t * 4);
      rewardIcon.scale.set(1.0 * settle + Math.sin(t * 4.6) * 0.06 * settle);
      rewardIcon.rotation = Math.sin(t * 3.6) * 0.06;
      const titleSettle = Math.min(1, Math.max(0, (t - 0.05) * 5));
      title.alpha = titleSettle;
      titleRibbon.alpha = titleSettle;
      titleRibbon.y = (titleY + 2) - 14 + titleSettle * 14;
      title.y = titleTextY - 14 + titleSettle * 14;
      rewardLabel.alpha = Math.min(1, Math.max(0, (t - 0.22) * 6));
      if (subLine.visible) {
        subLine.alpha = Math.min(1, Math.max(0, (t - 0.35) * 5));
      }
      closeHint.alpha = 0.6 + Math.sin(t * 4.2) * 0.4;
    };
    this.addTransientTicker(localTick);

    root.on('pointertap', () => {
      if (closing) {
        return;
      }
      closing = true;
      this.removeTransientTicker(localTick);
      AudioManager.playButtonSound();
      this.clearResultLayer();
      this.phase = 'idle';
      this.refreshBalance();
    });

    this.resultLayer.addChild(root);
  }

  private clearResultLayer(): void {
    while (this.resultLayer.children.length > 0) {
      const child = this.resultLayer.children[0]!;
      this.resultLayer.removeChild(child);
      child.destroy({ children: true });
    }
  }

  /** 顶部稀有度文案：单道具 → "获得奖励"；礼包 → "稀有礼包！"。 */
  private getRewardRarityTitle(reward: GachaReward): string {
    return reward.kind === 'bundle' ? '稀有礼包！' : '获得奖励';
  }

  private createResultTitleRibbon(): PIXI.Container {
    const root = new PIXI.Container();
    const tex = TextureCache.get(GACHA_RESULT_TITLE_RIBBON_KEY);
    if (tex && tex !== PIXI.Texture.EMPTY) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const targetW = Math.min(520, Game.logicWidth * 0.72);
      const scale = targetW / Math.max(1, tex.width);
      sp.scale.set(scale);
      root.addChild(sp);
      return root;
    }
    const fallback = new PIXI.Graphics();
    fallback.beginFill(0xffd95a, 0.95);
    fallback.lineStyle(5, 0x8b3a0c, 1);
    fallback.drawRoundedRect(-210, -40, 420, 80, 32);
    fallback.endFill();
    fallback.beginFill(0xff6a2a, 0.9);
    fallback.drawPolygon([-270, -28, -208, -28, -208, 28, -270, 28, -242, 0]);
    fallback.drawPolygon([270, -28, 208, -28, 208, 28, 270, 28, 242, 0]);
    fallback.endFill();
    root.addChild(fallback);
    return root;
  }

  private createRewardOverlayIcon(reward: GachaReward, size: number): PIXI.Container {
    const root = new PIXI.Container();
    let tex: PIXI.Texture | null = null;
    if (reward.kind === 'bowlTool') {
      tex = this.getBowlToolIconTexture(reward.tool);
    } else if (reward.kind === 'fruitSliceTool') {
      tex = this.getFruitSliceToolIconTexture(reward.tool);
    } else {
      tex = this.getBundleRewardIconTexture(reward);
    }
    if (!tex || tex === PIXI.Texture.EMPTY) {
      root.addChild(this.createGachaEggIcon(size / 2));
      return root;
    }
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    const scale = size / Math.max(tex.width, tex.height);
    sp.scale.set(scale);
    root.addChild(sp);
    return root;
  }

  private createRandomCapsuleIcon(size: number): PIXI.Container {
    if (this.capsuleFrames.length === 0) {
      return this.createGachaEggIcon(size / 2);
    }
    const root = new PIXI.Container();
    const tex = this.capsuleFrames[Math.floor(Math.random() * this.capsuleFrames.length)]!;
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    const scale = size / Math.max(tex.width, tex.height);
    sp.scale.set(scale);
    root.addChild(sp);
    return root;
  }

  private getBundleRewardDetailText(reward: Extract<GachaReward, { kind: 'bundle' }>): string {
    const parts = reward.rewards.map((item) => `${this.getRewardItemShortLabel(item)} x${item.count}`);
    return `包含：${parts.join('、')}`;
  }

  private getRewardItemShortLabel(
    item:
      | { kind: 'bowlTool'; tool: 'addDish' | 'remove' | 'shuffle'; count: number }
      | { kind: 'fruitSliceTool'; tool: 'eliminate' | 'shuffle'; count: number },
  ): string {
    if (item.kind === 'bowlTool') {
      if (item.tool === 'addDish') {
        return '加菜碟道具';
      }
      return item.tool === 'remove' ? '移除道具' : '打乱道具';
    }
    return item.tool === 'eliminate' ? '消除道具' : '打乱道具';
  }

  /** 程序绘制的金色扭蛋胶囊（飞行 / 弹层共用），radius 控制整体大小。 */
  private createGachaEggIcon(radius: number): PIXI.Container {
    const root = new PIXI.Container();
    const w = radius * 1.5;
    const h = radius * 2;
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.18);
    shadow.drawEllipse(0, h / 2 + 8, w * 0.5, 6);
    shadow.endFill();
    root.addChild(shadow);

    const body = new PIXI.Graphics();
    body.beginFill(0xffd14a);
    body.lineStyle(Math.max(3, radius * 0.08), 0xa8580a, 1);
    body.drawRoundedRect(-w / 2, -h / 2, w, h, w / 2);
    body.endFill();
    body.beginFill(0xffe98c, 0.95);
    body.drawRoundedRect(-w / 2, -h / 2, w, h * 0.5, w / 2);
    body.endFill();
    body.beginFill(0xffffff, 0.55);
    body.drawEllipse(-w * 0.18, -h * 0.18, w * 0.18, h * 0.06);
    body.endFill();
    root.addChild(body);

    const star = new PIXI.Graphics();
    star.beginFill(0xfff7b2, 0.95);
    drawStar(star, 0, -radius * 0.35, 5, radius * 0.32, radius * 0.14);
    star.endFill();
    star.lineStyle(Math.max(2, radius * 0.05), 0xa8580a, 1);
    drawStar(star, 0, -radius * 0.35, 5, radius * 0.32, radius * 0.14);
    root.addChild(star);

    return root;
  }

  private refreshBalance(): void {
    this.coinBar.refresh();
  }

  private updateAnimation(delta: number): void {
    this.animationTime += delta / 60;
    const t = this.animationTime;

    if (this.phase === 'idle') {
      this.machineRoot.rotation = Math.sin(t * 2.4) * 0.012;
      this.machineRoot.scale.set(1 + Math.sin(t * 2.8) * 0.012);
      this.domeRays.rotation += delta * 0.004;
      this.domeRingRays.rotation -= delta * 0.0028;
    } else if (this.phase === 'shake') {
      this.phaseElapsed += delta / 60;
      const p = Math.min(this.phaseElapsed / 0.7, 1);
      const intensity = (1 - p) * 0.06 + 0.05;
      this.machineRoot.rotation = Math.sin(this.phaseElapsed * 38) * intensity;
      this.machineRoot.scale.set(1 + Math.sin(this.phaseElapsed * 22) * 0.04);
      this.domeRays.rotation += delta * 0.03;
      this.domeRingRays.rotation -= delta * 0.022;
      if (p >= 1) {
        this.startDropPhase();
      }
    } else if (this.phase === 'drop' || this.phase === 'result') {
      this.machineRoot.rotation = Math.sin(t * 2.4) * 0.006;
      this.machineRoot.scale.set(1);
      this.domeRays.rotation += delta * 0.006;
      this.domeRingRays.rotation -= delta * 0.004;
    }

    this.domeBalls?.update(delta, this.phase);

    for (const sp of this.domeSparkles) {
      const phaseSpeed = this.phase === 'shake' ? 12 : 5;
      const pulse = (Math.sin(t * phaseSpeed + sp.phase) + 1) / 2;
      sp.node.alpha = 0.28 + pulse * 0.72;
      sp.node.scale.set(0.65 + pulse * 0.55);
      sp.node.rotation += delta * 0.018;
    }
  }

  /** 必填的奖池触达检查（防御未来配置错误时仍可使用占位） */
  ensureRewardPoolReady(): void {
    if (!GACHA_REWARD_POOL || GACHA_REWARD_POOL.length === 0) {
      console.warn('[GachaScene] reward pool empty');
    }
  }
}

function drawStar(
  g: PIXI.Graphics,
  cx: number,
  cy: number,
  n: number,
  outer: number,
  inner: number,
): void {
  const step = Math.PI / n;
  const pts: number[] = [];
  for (let i = 0; i < n * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + i * step;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.drawPolygon(pts);
}

/** 单颗胶囊球的运行时状态：sprite + 简单物理（位置/速度/相位/半径） */
interface BallState {
  sprite: PIXI.Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  radius: number;
  baseX: number;
  baseY: number;
}

/** 玻璃罩内的胶囊球阵：
 *  - idle 阶段：每颗在 base 位置上微抖（sin），整体几乎静止
 *  - shake 阶段：注入随机推力 + 重力反弹 + 罩内壁夹球，模拟"机子摇动时球乱飞"
 *  - drop 之后：缓慢回归到 base 位置
 *  没有完整物理，只用参数动画 + 简单球壁回弹。 */
class DomeBalls {
  private balls: BallState[] = [];
  private frames: PIXI.Texture[];
  /** 罩中心（machineRoot 本地坐标）+ 半径 */
  private domeX = 0;
  private domeY = 0;
  private domeR = 0;
  /** shake 时累加用，给"摇晃越来越弱"曲线服务 */
  private shakeT = 0;
  private shaking = false;

  constructor(
    private readonly layer: PIXI.Container,
    frames: PIXI.Texture[],
    private readonly count: number,
  ) {
    this.frames = frames;
    this.ensureBalls();
  }

  setFrames(frames: PIXI.Texture[]): void {
    this.frames = frames;
    for (const b of this.balls) {
      const tex = frames[Math.floor(Math.random() * frames.length)] ?? PIXI.Texture.EMPTY;
      b.sprite.texture = tex;
    }
  }

  setDome(cx: number, cy: number, r: number): void {
    const first = this.domeR === 0;
    this.domeX = cx;
    this.domeY = cy;
    this.domeR = r;
    this.ensureBalls();
    if (first) {
      this.scatterToBase();
    } else {
      /** 罩几何变了，球的归一化位置不变，但要按新半径重排可见尺寸 */
      this.scaleBallsToRadius();
    }
  }

  startShake(): void {
    this.shaking = true;
    this.shakeT = 0;
    /** 给每颗注入一次随机推力 */
    for (const b of this.balls) {
      const a = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 6;
      b.vx += Math.cos(a) * speed;
      b.vy += Math.sin(a) * speed - 4;
    }
  }

  endShake(): void {
    this.shaking = false;
  }

  update(delta: number, phase: 'idle' | 'shake' | 'drop' | 'result'): void {
    if (this.domeR <= 0 || this.balls.length === 0) {
      return;
    }
    const dt = Math.min(delta, 2.4);
    if (phase === 'shake') {
      this.shakeT += dt / 60;
      this.integrateShake(dt);
    } else {
      /** idle / drop / result：回归 base 微抖 */
      this.integrateIdle(dt, phase);
    }
    for (const b of this.balls) {
      b.sprite.position.set(b.x, b.y);
    }
  }

  private integrateShake(dt: number): void {
    /** 0.7s 内"摇晃强度"从 1 衰减到 0，给重力 + 推力做衰减 */
    const decay = Math.max(0, 1 - this.shakeT / 0.7);
    const gravity = 0.35 * decay;
    const friction = 0.985;
    for (const b of this.balls) {
      b.vy += gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= friction;
      b.vy *= friction;
      this.clampToDome(b);
    }
    this.resolveBallCollisions();
  }

  private integrateIdle(dt: number, phase: 'idle' | 'shake' | 'drop' | 'result'): void {
    for (const b of this.balls) {
      /** 回归到 base 位置（弹簧），同时叠 sin 微抖 */
      const k = phase === 'idle' ? 0.06 : 0.12;
      b.vx += (b.baseX - b.x) * k;
      b.vy += (b.baseY - b.y) * k;
      b.vx *= 0.78;
      b.vy *= 0.78;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.phase += dt * 0.04;
      b.x += Math.cos(b.phase * 3.1) * 0.3;
      b.y += Math.sin(b.phase * 2.7) * 0.3;
      this.clampToDome(b);
    }
  }

  private clampToDome(b: BallState): void {
    const dx = b.x - this.domeX;
    const dy = b.y - this.domeY;
    const dist = Math.hypot(dx, dy);
    const maxR = this.domeR - b.radius * 0.8;
    if (dist > maxR && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      b.x = this.domeX + nx * maxR;
      b.y = this.domeY + ny * maxR;
      /** 沿法线反弹 */
      const vn = b.vx * nx + b.vy * ny;
      if (vn > 0) {
        b.vx -= 1.6 * vn * nx;
        b.vy -= 1.6 * vn * ny;
      }
    }
  }

  /** 球与球之间简单的"贴合 + 推开"，避免堆叠时穿模 */
  private resolveBallCollisions(): void {
    for (let i = 0; i < this.balls.length; i += 1) {
      const a = this.balls[i]!;
      for (let j = i + 1; j < this.balls.length; j += 1) {
        const c = this.balls[j]!;
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        const d = Math.hypot(dx, dy);
        const minD = a.radius + c.radius - 0.5;
        if (d < minD && d > 0.001) {
          const nx = dx / d;
          const ny = dy / d;
          const overlap = (minD - d) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          c.x += nx * overlap;
          c.y += ny * overlap;
        }
      }
    }
  }

  private ensureBalls(): void {
    if (this.frames.length === 0) {
      return;
    }
    if (this.balls.length >= this.count) {
      return;
    }
    while (this.balls.length < this.count) {
      const tex = this.frames[Math.floor(Math.random() * this.frames.length)] ?? PIXI.Texture.EMPTY;
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.alpha = 0.96;
      this.layer.addChild(sp);
      this.balls.push({
        sprite: sp,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        phase: Math.random() * Math.PI * 2,
        radius: 0,
        baseX: 0,
        baseY: 0,
      });
    }
    this.scaleBallsToRadius();
  }

  /** 每颗胶囊直径 = 罩半径的 ~18%，30 颗填满玻璃罩但保持可读。 */
  private scaleBallsToRadius(): void {
    if (this.domeR <= 0) {
      return;
    }
    const ballR = this.domeR * 0.09;
    for (const b of this.balls) {
      /**
       * 不依赖 texture.width / height 来算缩放：微信小游戏里 sub-texture
       * 偶发返回整张 sheet 尺寸，导致单颗球被放成巨球。直接锁定显示宽高。
       */
      b.sprite.width = ballR * 2;
      b.sprite.height = ballR * 2;
      b.radius = ballR;
    }
  }

  /** 初始摆位：罩内随机散布，下半圆密一点，模拟"很多扭蛋球堆在玻璃罩里"。 */
  private scatterToBase(): void {
    const rows = [7, 7, 6, 6, 4];
    for (let i = 0; i < this.balls.length; i += 1) {
      const b = this.balls[i]!;
      let row = 0;
      let col = i;
      while (row < rows.length - 1 && col >= rows[row]!) {
        col -= rows[row]!;
        row += 1;
      }
      const rowCount = rows[row]!;
      const xSpread = this.domeR * (row >= 3 ? 1.1 : 1.38);
      const xNorm = rowCount <= 1 ? 0 : (col / (rowCount - 1) - 0.5);
      const jitterX = (Math.random() - 0.5) * b.radius * 0.8;
      const jitterY = (Math.random() - 0.5) * b.radius * 0.5;
      const x = this.domeX + xNorm * xSpread + jitterX;
      const y = this.domeY + this.domeR * (0.43 - row * 0.19) + jitterY;
      b.x = x;
      b.y = y;
      b.baseX = x;
      b.baseY = y;
      b.vx = 0;
      b.vy = 0;
      b.sprite.position.set(x, y);
    }
  }
}
