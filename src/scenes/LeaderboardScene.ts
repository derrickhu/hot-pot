import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { BackendService } from '@/core/BackendService';
import { Game } from '@/core/Game';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { awaitFlushPendingRankUploads } from '@/game/RankUpload';
import { PrivacyAuthService } from '@/services/PrivacyAuthService';
import {
  RankService,
  RANK_BOARD_BOWL,
  RANK_BOARD_FRUIT,
  type RankBoard,
  type RankListResult,
  type RankRecord,
} from '@/services/RankService';
import { UserProfileService } from '@/services/UserProfileService';
import {
  ensureSharedCanvasSize,
  getSharedCanvas,
  isFriendRankSupported,
  prefetchFriendRank,
  renderFriendBoard,
  warmupFriendRankContext,
  type FriendRankTab,
} from '@/utils/friendRanking';
import { TextureCache } from '@/utils/TextureCache';

/** 排行榜分类标签：世界榜 / 好友榜（好友榜接入微信开放数据域） */
type BoardTab = 'world' | 'friend';

let nextInitialBoard: RankBoard = RANK_BOARD_BOWL;

class WxSharedCanvasResource extends PIXI.Resource {
  private readonly source: HTMLCanvasElement & { width: number; height: number };

  constructor(source: HTMLCanvasElement & { width: number; height: number }) {
    super(Math.max(1, source.width | 0), Math.max(1, source.height | 0));
    this.source = source;
  }

  upload(renderer: PIXI.Renderer, baseTexture: PIXI.BaseTexture, glTexture: any): boolean {
    const gl = renderer.gl as any;
    if (!gl || typeof gl.wxBindCanvasTexture !== 'function') {
      return false;
    }
    gl.wxBindCanvasTexture(gl.TEXTURE_2D, this.source);
    glTexture.width = baseTexture.realWidth;
    glTexture.height = baseTexture.realHeight;
    return true;
  }

  update(): void {
    this.resize(Math.max(1, this.source.width | 0), Math.max(1, this.source.height | 0));
    super.update();
  }
}

/**
 * 外部仍按场景方式打开排行榜，参数透传给世界榜数据源。
 * 进入前先调起微信隐私授权弹窗（基础库 ≥ 2.32.3），玩家同意后才进入榜单；
 * 玩家拒绝时弹 toast 并阻断进入，避免误以为入口失效。
 *
 * 兜底：每次打开都把当前本地进度上报一次（云函数侧自带"非更优记录"拦截，
 * 不会产生脏写），保证老玩家或漏掉通关上报的玩家进入榜单就能看到自己。
 */
export function openLeaderboard(board: RankBoard = RANK_BOARD_BOWL): void {
  PrivacyAuthService.guard(() => {
    nextInitialBoard = board;
    // 上报当前最高进度的动作放在 LeaderboardScene.onEnter 内 await，
    // 避免和 onEnter 里的 await 形成"已发送但 await 不到"的竞态。
    SceneManager.switchTo('leaderboard');
  }, '需同意隐私协议后查看排行榜');
}

/**
 * 主页授权路径专用入口：调用方（HomeScene 的透明 wx.createUserInfoButton）
 * 已经在原生 onTap 中由微信代为弹完了「隐私协议 + 用户信息授权」，
 * 这里不再走 PrivacyAuthService.guard（否则同一次点击会被二次拦截）。
 *
 * 玩家拒绝授权也会走到这里，进入排行榜后由榜内「使用微信昵称头像上榜」CTA 兜底。
 */
export function openLeaderboardWithProfile(board: RankBoard = RANK_BOARD_BOWL): void {
  nextInitialBoard = board;
  SceneManager.switchTo('leaderboard');
}

/** 头像槽位水果 emoji 兜底，依次对应前若干名；自己行另用一个深色水果以呼应 UI 图 */
const AVATAR_FRUIT_FOR_RANK: readonly string[] = ['🍈', '🍋', '🍇', '🍑', '🍒', '🍓', '🥝', '🍊', '🍉', '🍐'];
const AVATAR_FRUIT_FOR_ME = '🥥';

/** 上下色调统一：紫色主色 + 橙色高亮 + 米色卡片底 */
const COLOR_HEADER_PURPLE = 0x9b6dd8;
const COLOR_HEADER_PURPLE_DEEP = 0x7e58b8;
const COLOR_CARD_WHITE = 0xfdf6ec;
const COLOR_CARD_STROKE = 0xeadbc5;
const COLOR_ROW_BG = 0xfff9ee;
const COLOR_ROW_STROKE = 0xe9d8b9;
const COLOR_ME_BG = 0xffa743;
const COLOR_ME_STROKE = 0xd6791f;
const COLOR_PILL_PURPLE = 0xb086e1;
const COLOR_TAB_INACTIVE_BG = 0xf3eadb;
const COLOR_TAB_INACTIVE_STROKE = 0xd9c8a8;
const COLOR_TAB_INACTIVE_TEXT = 0x9b8268;
const COLOR_TAB_ACTIVE_BG = 0xffc857;
const COLOR_TAB_ACTIVE_STROKE = 0xd99b1f;
const COLOR_TAB_ACTIVE_TEXT = 0xffffff;
const COLOR_CLOSE_RED = 0xe85a5a;
const COLOR_TITLE_TEXT = 0xffffff;
const COLOR_TITLE_STROKE = 0x5a3a90;

export class LeaderboardScene implements Scene {
  readonly name = 'leaderboard';
  readonly container = new PIXI.Container();

  private readonly backdrop = new PIXI.Graphics();
  /** 顶部金色装饰带（奖杯/月桂）容器，处于卡片之外 */
  private readonly trophyDeco = new PIXI.Container();
  /** 居中弹窗外壳（含横幅、关闭按钮） */
  private readonly cardChrome = new PIXI.Container();
  /** 中央内容区域（Tab + 列表 + 状态文案），每次 redraw 清空重画 */
  private readonly cardContent = new PIXI.Container();
  /** 弹窗底部固定的“自己”一行（不受滚动影响） */
  private readonly mineLayer = new PIXI.Container();

  private activeTab: BoardTab = 'world';
  private worldBoard: RankBoard = RANK_BOARD_BOWL;
  private worldResult: RankListResult | null = null;
  private loading = false;
  private errorText = '';
  private requestSeq = 0;
  private time = 0;
  /** 卡片实际几何尺寸，layout 时确定，用于子节点定位 */
  private cardX = 0;
  private cardY = 0;
  private cardW = 0;
  private cardH = 0;
  /**
   * 自己行上方"使用微信资料"按钮在 PIXI 设计坐标系下的矩形（设计像素，左上原点）。
   * Game.update 每帧把它换算成 CSS 像素并同步覆盖透明 wx.createUserInfoButton。
   * w/h 为 0 时表示当前没有 CTA（已授权或榜单不可见）。
   */
  private weChatProfileButtonRect: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 0, h: 0 };
  private weChatProfileNativeBtn: ReturnType<NonNullable<typeof wx.createUserInfoButton>> | null = null;
  /**
   * 上一次成功同步到 wx 原生按钮的 CSS 坐标，仅当任一字段变了才再 Object.assign style，
   * 避免基础库 3.15+ 上每次 style 写入都触发 `updateTextView:fail` SystemError 噪音。
   */
  private lastSyncedBtnCss: { left: number; top: number; width: number; height: number } | null = null;
  /** UserProfileService 资料变化时触发重画的取消订阅函数 */
  private unsubProfileChange: (() => void) | null = null;
  /** 已经发起加载的远程头像 URL → 缓存 key，避免重复发请求 */
  private readonly avatarKeyByUrl = new Map<string, string>();
  /** 上次重画时是否处于"加载头像"中的标记，用于头像 onload 时局部刷新 */
  private avatarLoadGeneration = 0;
  /** 当前是否正在通过 Game 的 2D 合成层显示好友榜 sharedCanvas */
  private friendBoardOverlayActive = false;
  /** iOS 微信 wxBindCanvasTexture 兜底：direct-webgl 下直接绑定 sharedCanvas 纹理 */
  private friendBoardSprite: PIXI.Sprite | null = null;

  constructor() {
    this.container.addChild(this.backdrop, this.trophyDeco, this.cardChrome, this.cardContent, this.mineLayer);
  }

  onEnter(): void {
    this.worldBoard = nextInitialBoard;
    this.activeTab = 'world';
    this.worldResult = null;
    this.errorText = '';
    this.buildLayout();
    // 进入时先等待"当前进度上报"落库再拉列表，避免玩家自己看不到自己；
    // 上报失败也继续 list（不阻塞看其他玩家成绩）
    void this.loadWorldBoardWithFlush(this.worldBoard);
    // 预热好友榜：玩家正在看世界榜的几百毫秒里，让子域沙箱起来并把好友 KV 拉好，
    // 等他切到好友榜 tab 时直接命中缓存，省掉一整段网络等待。
    if (isFriendRankSupported()) {
      warmupFriendRankContext();
      const tabKey: FriendRankTab = this.worldBoard === RANK_BOARD_FRUIT ? 'fruit' : 'bowl';
      prefetchFriendRank(tabKey);
    }
    // 资料变化时（拿到真实昵称 / 头像后）立即重画并清空旧的覆盖按钮
    if (!this.unsubProfileChange) {
      this.unsubProfileChange = UserProfileService.onChange(() => {
        this.redraw();
      });
    }
  }

  onExit(): void {
    // 离开榜单时拆掉 wx 原生按钮，避免继续盖在其他场景的画布上
    this.destroyWeChatProfileNativeBtn();
    this.weChatProfileButtonRect = { x: 0, y: 0, w: 0, h: 0 };
    if (this.unsubProfileChange) {
      this.unsubProfileChange();
      this.unsubProfileChange = null;
    }
    this.destroyFriendBoardSprite();
  }

  update(dt: number): void {
    this.time += dt;
    // 顶部奖杯轻微上下浮动，强化“弹出层”视觉
    this.trophyDeco.y = Math.sin(this.time * 1.6) * 3;
    // 注：不再每帧 sync wx 原生按钮 —— CTA 矩形只在 drawMineRow 时变化，
    //    那里已经同步调过 syncWeChatProfileNativeBtn 一次。
    //    基础库 3.15+ 上每帧 Object.assign(style, ...) 都会触发
    //    `updateTextView:fail` SystemError 日志，把面板刷爆。

    // 好友榜优先由 Game 的上屏 2D 合成层直接绘制 sharedCanvas；
    // iOS direct-webgl 兜底则通过 wxBindCanvasTexture 每帧刷新纹理。
    if (this.friendBoardSprite?.texture) {
      this.friendBoardSprite.texture.update();
    }
  }

  /** 统一布局入口：根据当前 logic 尺寸重算卡片几何并重绘所有装饰 */
  private buildLayout(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const top = Game.safeTop;

    const sidePad = 30;
    this.cardW = W - sidePad * 2;
    const reservedTop = top + 110;
    const reservedBottom = 56;
    this.cardH = Math.min(H - reservedTop - reservedBottom, Math.round(H * 0.78));
    this.cardX = (W - this.cardW) / 2;
    this.cardY = reservedTop;

    this.drawBackdrop();
    this.drawTrophyDeco();
    this.buildChrome();
    this.redraw();
  }

  /** 背景：深蓝紫渐变 + 半透明黑色蒙层，营造弹窗叠层感 */
  private drawBackdrop(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    this.backdrop.clear();
    this.backdrop.beginFill(0x3a4a8a);
    this.backdrop.drawRect(0, 0, W, H);
    this.backdrop.endFill();
    this.backdrop.beginFill(0x2c3868, 0.85);
    this.backdrop.drawRect(0, Math.round(H * 0.45), W, Math.ceil(H * 0.55));
    this.backdrop.endFill();
    this.backdrop.beginFill(0x000000, 0.18);
    this.backdrop.drawRect(0, 0, W, H);
    this.backdrop.endFill();
  }

  /** 顶部奖杯 + 月桂叶矢量装饰；卡片在它的下面 */
  private drawTrophyDeco(): void {
    this.trophyDeco.removeChildren();
    const W = Game.logicWidth;
    const cy = this.cardY - 38;
    const cx = W / 2;

    const laurelLeft = this.createLaurelLeaf();
    laurelLeft.position.set(cx - 110, cy + 18);
    this.trophyDeco.addChild(laurelLeft);

    const laurelRight = this.createLaurelLeaf();
    laurelRight.scale.x = -1;
    laurelRight.position.set(cx + 110, cy + 18);
    this.trophyDeco.addChild(laurelRight);

    const trophy = this.createTrophyIcon();
    trophy.position.set(cx, cy);
    this.trophyDeco.addChild(trophy);
  }

  /** 月桂叶（用三组椭圆叶片堆叠的简化矢量） */
  private createLaurelLeaf(): PIXI.Container {
    const root = new PIXI.Container();
    const g = new PIXI.Graphics();
    g.beginFill(0xefb540);
    for (let i = 0; i < 5; i += 1) {
      const x = -i * 16;
      const y = i * 6 - 10;
      g.drawEllipse(x, y, 12, 22);
    }
    g.endFill();
    g.beginFill(0xd99026, 0.8);
    for (let i = 0; i < 5; i += 1) {
      const x = -i * 16;
      const y = i * 6 - 10;
      g.drawEllipse(x - 4, y - 6, 6, 10);
    }
    g.endFill();
    root.addChild(g);
    return root;
  }

  /** 奖杯：杯体 + 双耳 + 五角星 + 底座 */
  private createTrophyIcon(): PIXI.Container {
    const root = new PIXI.Container();

    // 双耳
    const handle = new PIXI.Graphics();
    handle.lineStyle(8, 0xc88517, 1);
    handle.arc(-30, 4, 18, -Math.PI * 0.85, Math.PI * 0.35);
    handle.arc(30, 4, 18, Math.PI * 0.65, -Math.PI * 0.35, true);
    root.addChild(handle);

    // 杯体
    const cup = new PIXI.Graphics();
    cup.beginFill(0xf7c64a);
    cup.lineStyle(4, 0xc88517, 1);
    cup.moveTo(-30, -22);
    cup.lineTo(30, -22);
    cup.lineTo(22, 22);
    cup.lineTo(-22, 22);
    cup.closePath();
    cup.endFill();

    cup.beginFill(0xffd97a, 0.6);
    cup.drawPolygon([-18, -18, -12, -18, -8, 18, -14, 18]);
    cup.endFill();

    // 底座柄 + 底盘
    cup.beginFill(0xefb540);
    cup.lineStyle(3, 0xc88517, 1);
    cup.drawRoundedRect(-10, 22, 20, 12, 4);
    cup.drawRoundedRect(-28, 32, 56, 12, 6);
    cup.endFill();

    root.addChild(cup);

    // 中心五角星
    const star = new PIXI.Graphics();
    star.beginFill(0xff4d3d);
    star.lineStyle(2, 0xb73022, 1);
    this.drawStar(star, 0, -2, 5, 14, 6);
    star.endFill();
    root.addChild(star);

    root.scale.set(1.1);
    return root;
  }

  private drawStar(g: PIXI.Graphics, x: number, y: number, n: number, outer: number, inner: number): void {
    const step = Math.PI / n;
    const pts: number[] = [];
    for (let i = 0; i < n * 2; i += 1) {
      const r = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + i * step;
      pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.drawPolygon(pts);
  }

  /** 弹窗外壳：白色卡片 + 紫色标题横幅 + 关闭按钮 */
  private buildChrome(): void {
    this.cardChrome.removeChildren();
    const W = Game.logicWidth;

    // 卡片阴影
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x1a2456, 0.32);
    shadow.drawRoundedRect(this.cardX + 6, this.cardY + 10, this.cardW, this.cardH, 32);
    shadow.endFill();
    this.cardChrome.addChild(shadow);

    // 白色卡片底
    const card = new PIXI.Graphics();
    card.beginFill(COLOR_CARD_WHITE);
    card.lineStyle(3, COLOR_CARD_STROKE, 1);
    card.drawRoundedRect(this.cardX, this.cardY, this.cardW, this.cardH, 32);
    card.endFill();
    this.cardChrome.addChild(card);

    // 紫色标题横幅（带左右飘带凹口）
    const banner = this.createTitleBanner('排行榜');
    banner.position.set(W / 2, this.cardY + 4);
    this.cardChrome.addChild(banner);

    // 红色叉号关闭按钮
    const close = this.createCloseButton();
    close.position.set(this.cardX + this.cardW - 28, this.cardY + 36);
    close.eventMode = 'static';
    close.cursor = 'pointer';
    close.hitArea = new PIXI.Rectangle(-32, -32, 64, 64);
    close.on('pointertap', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('home');
    });
    this.cardChrome.addChild(close);
  }

  /** 紫色横幅：圆角 + 两侧三角飘带凹口，标题文字带白色描边 */
  private createTitleBanner(text: string): PIXI.Container {
    const root = new PIXI.Container();
    const w = Math.min(440, this.cardW * 0.66);
    const h = 76;

    const ribbon = new PIXI.Graphics();
    // 下方暗紫底，模拟悬空挂带
    ribbon.beginFill(COLOR_HEADER_PURPLE_DEEP);
    ribbon.drawRoundedRect(-w / 2 - 18, -h / 2 + 12, w + 36, h - 12, 18);
    ribbon.endFill();
    // 上方亮紫主体
    ribbon.beginFill(COLOR_HEADER_PURPLE);
    ribbon.lineStyle(3, 0xffffff, 0.5);
    ribbon.drawRoundedRect(-w / 2, -h / 2, w, h, 22);
    ribbon.endFill();
    // 飘带凹口（左右各一个V形）
    ribbon.lineStyle(0);
    ribbon.beginFill(COLOR_HEADER_PURPLE_DEEP);
    ribbon.drawPolygon([-w / 2 - 16, -h / 2 + 12, -w / 2 - 2, h / 2 - 4, -w / 2 - 30, h / 2 - 4]);
    ribbon.drawPolygon([w / 2 + 16, -h / 2 + 12, w / 2 + 2, h / 2 - 4, w / 2 + 30, h / 2 - 4]);
    ribbon.endFill();
    root.addChild(ribbon);

    const title = new PIXI.Text(text, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 42,
      fill: COLOR_TITLE_TEXT,
      fontWeight: '900',
      stroke: COLOR_TITLE_STROKE,
      strokeThickness: 6,
      lineJoin: 'round',
      letterSpacing: 4,
    });
    title.anchor.set(0.5);
    title.resolution = 2;
    title.position.set(0, -2);
    root.addChild(title);

    return root;
  }

  /** 红色圆形关闭按钮（X 图标） */
  private createCloseButton(): PIXI.Container {
    const root = new PIXI.Container();
    const ring = new PIXI.Graphics();
    ring.beginFill(0xffffff);
    ring.drawCircle(0, 0, 32);
    ring.endFill();
    root.addChild(ring);

    const disk = new PIXI.Graphics();
    disk.beginFill(COLOR_CLOSE_RED);
    disk.lineStyle(3, 0xb83a3a, 1);
    disk.drawCircle(0, 0, 27);
    disk.endFill();
    root.addChild(disk);

    const cross = new PIXI.Graphics();
    cross.lineStyle(6, 0xffffff, 1, 0.5, false);
    cross.moveTo(-10, -10);
    cross.lineTo(10, 10);
    cross.moveTo(10, -10);
    cross.lineTo(-10, 10);
    root.addChild(cross);
    return root;
  }

  /** 先把当前最高进度上报落库，再拉列表，保证「自己」一定能看到 */
  private async loadWorldBoardWithFlush(board: RankBoard): Promise<void> {
    try {
      await awaitFlushPendingRankUploads();
    } catch (error) {
      console.warn('[LeaderboardScene] flush submit before list failed', error);
    }
    await this.loadWorldBoard(board);
  }

  private async loadWorldBoard(board: RankBoard): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading = true;
    this.errorText = '';
    this.redraw();
    try {
      const result = await RankService.list(board, 50, 0);
      if (seq !== this.requestSeq) {
        return;
      }
      this.worldResult = result;
    } catch (error) {
      if (seq !== this.requestSeq) {
        return;
      }
      console.warn('[LeaderboardScene] load rank failed', error);
      this.worldResult = null;
      this.errorText = '排行榜加载失败，请稍后重试';
    } finally {
      if (seq === this.requestSeq) {
        this.loading = false;
        this.redraw();
      }
    }
  }

  /** Tab 切换：世界榜 → 后端拉取；好友榜 → openDataContext */
  private switchTab(tab: BoardTab): void {
    if (this.activeTab === tab) {
      return;
    }
    AudioManager.playButtonSound();
    this.activeTab = tab;
    if (tab !== 'friend') {
      // 切回世界榜：关闭上屏 2D 合成层，避免 sharedCanvas 残留
      this.destroyFriendBoardSprite();
    }
    this.redraw();
  }

  private redraw(): void {
    this.cardContent.removeChildren();
    this.mineLayer.removeChildren();

    this.drawTabs();

    if (this.activeTab === 'friend') {
      this.drawFriendBoard();
      return;
    }
    // 离开好友榜的兜底清理：上一次 redraw 在 friend 时挂的 sprite 需要回收
    if (this.friendBoardOverlayActive) {
      this.destroyFriendBoardSprite();
    }

    if (this.loading) {
      this.drawState('正在加载排行榜…');
      return;
    }
    if (this.errorText) {
      this.drawState(this.errorText, true);
      return;
    }

    const list = this.worldResult?.list ?? [];
    if (list.length === 0) {
      this.drawState('还没有玩家上榜\n通关后抢占第一名');
      this.drawMineRow(null);
      return;
    }

    this.drawList(list);
    this.drawMineRow(this.worldResult?.mine ?? null, list);
  }

  /** 两个 Tab：世界榜（橙黄选中）/ 好友榜（米色描边） */
  private drawTabs(): void {
    const W = Game.logicWidth;
    const tabY = this.cardY + 124;
    const tabW = Math.min(220, (this.cardW - 80) / 2);
    const gap = 16;
    const totalW = tabW * 2 + gap;
    const startX = (W - totalW) / 2;

    this.cardContent.addChild(this.createTab(startX + tabW / 2, tabY, tabW, '世界榜', 'world'));
    this.cardContent.addChild(this.createTab(startX + tabW * 1.5 + gap, tabY, tabW, '好友榜', 'friend'));
  }

  private createTab(cx: number, cy: number, w: number, label: string, tab: BoardTab): PIXI.Container {
    const selected = this.activeTab === tab;
    const h = 54;
    const root = new PIXI.Container();
    root.position.set(cx, cy);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12);

    const bg = new PIXI.Graphics();
    if (selected) {
      bg.beginFill(0xffb83b);
      bg.lineStyle(3, COLOR_TAB_ACTIVE_STROKE, 1);
      bg.drawRoundedRect(-w / 2, -h / 2, w, h, 26);
      bg.endFill();
      // 顶部高光
      bg.beginFill(COLOR_TAB_ACTIVE_BG, 0.85);
      bg.drawRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 14, 22);
      bg.endFill();
    } else {
      bg.beginFill(COLOR_TAB_INACTIVE_BG);
      bg.lineStyle(3, COLOR_TAB_INACTIVE_STROKE, 1);
      bg.drawRoundedRect(-w / 2, -h / 2, w, h, 26);
      bg.endFill();
    }
    root.addChild(bg);

    const text = new PIXI.Text(label, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 26,
      fill: selected ? COLOR_TAB_ACTIVE_TEXT : COLOR_TAB_INACTIVE_TEXT,
      fontWeight: '900',
      stroke: selected ? 0xc97f1a : 0xffffff,
      strokeThickness: selected ? 4 : 0,
      lineJoin: 'round',
      letterSpacing: 2,
    });
    text.anchor.set(0.5);
    text.resolution = 2;
    root.addChild(text);

    root.on('pointertap', () => this.switchTab(tab));
    return root;
  }

  /** 列表区域：顶部 8 行外加自己行（自己行另行渲染） */
  private drawList(records: RankRecord[]): void {
    const rowH = 84;
    const gap = 10;
    const startY = this.cardY + 196;
    // 自己行高 84 + 底距 26；未授权时上方还多挂一条 56 高的 CTA + 28 间隔。
    // 列表为了不和这两者重叠，按"未授权"的最大占用预留底部空间。
    const ctaReserve = UserProfileService.hasRealProfile() ? 0 : 84;
    const reservedForMine = 110 + ctaReserve;
    const available = this.cardY + this.cardH - reservedForMine - startY;
    const maxRows = Math.max(3, Math.floor((available + gap) / (rowH + gap)));
    const visible = records.slice(0, maxRows);

    for (let i = 0; i < visible.length; i += 1) {
      const rec = visible[i]!;
      const row = this.createRankRow(rec, i);
      row.position.set(Game.logicWidth / 2, startY + i * (rowH + gap) + rowH / 2);
      this.cardContent.addChild(row);
    }
  }

  private createRankRow(record: RankRecord, listIndex: number): PIXI.Container {
    const root = new PIXI.Container();
    const w = this.cardW - 56;
    const h = 84;
    const rank = record.rank ?? listIndex + 1;

    const bg = new PIXI.Graphics();
    if (record.isMe) {
      bg.beginFill(COLOR_ME_BG);
      bg.lineStyle(3, COLOR_ME_STROKE, 1);
    } else {
      bg.beginFill(COLOR_ROW_BG);
      bg.lineStyle(2, COLOR_ROW_STROKE, 1);
    }
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, 20);
    bg.endFill();
    root.addChild(bg);

    // 左侧：奖牌徽章 / 序号
    const badge = this.createRankBadge(rank, record.isMe);
    badge.position.set(-w / 2 + 50, 0);
    root.addChild(badge);

    // 圆形头像（优先远程头像，回退到水果 emoji）
    const avatar = this.createAvatar(record, rank);
    avatar.position.set(-w / 2 + 124, 0);
    root.addChild(avatar);

    // 名字
    const displayName = this.resolveDisplayName(record);
    const name = new PIXI.Text(displayName, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 26,
      fill: record.isMe ? 0xffffff : 0x5a3318,
      fontWeight: '900',
      stroke: record.isMe ? 0xa14400 : 0xffffff,
      strokeThickness: record.isMe ? 4 : 3,
      lineJoin: 'round',
    });
    name.anchor.set(0, 0.5);
    name.resolution = 2;
    name.position.set(-w / 2 + 178, 0);
    root.addChild(name);

    // 右侧紫色 pill：关卡数 / 分数
    const pill = this.createValuePill(record, record.isMe);
    pill.position.set(w / 2 - 8, 0);
    root.addChild(pill);

    return root;
  }

  /**
   * 解析展示名：自己 + 已授权微信资料时优先使用真实昵称，
   * 否则用后端 displayName（兜底「水果达人XXXX」）。
   */
  private resolveDisplayName(record: RankRecord): string {
    if (record.isMe) {
      const profile = UserProfileService.getProfile();
      if (profile?.nickName) {
        return profile.nickName;
      }
    }
    return record.displayName || '神秘玩家';
  }

  /**
   * 头像渲染：
   *  - 有 avatarUrl（已授权）：异步加载远程图，先用 emoji 占位，加载完成后重画
   *  - 自己 + 未授权：emoji 兜底（CTA 按钮在 drawMineRow 里另行覆盖）
   *  - 其他玩家未授权：emoji 兜底
   */
  private createAvatar(record: RankRecord, rank: number): PIXI.Container {
    const url = this.resolveAvatarUrl(record);
    if (url) {
      const tex = this.ensureAvatarTexture(url);
      if (tex) {
        return this.createImageAvatar(tex, record.isMe);
      }
    }
    return this.createFruitAvatar(rank, record.isMe);
  }

  /** 自己行优先用本地缓存的微信头像 URL，避免依赖后端返回的字段（首次授权时尚未提交） */
  private resolveAvatarUrl(record: RankRecord): string {
    if (record.isMe) {
      const profile = UserProfileService.getProfile();
      if (profile?.avatarUrl) {
        return profile.avatarUrl;
      }
    }
    return record.avatarUrl || '';
  }

  /**
   * 用 PIXI.Sprite + 圆形 mask 显示远程头像。
   * 微信小游戏 wx.createImage() 可以直接 image.src = thirdwx.qlogo.cn 域 URL，
   * 不受 downloadFile 白名单限制（不同于 wx.request / wx.downloadFile）。
   */
  private createImageAvatar(texture: PIXI.Texture, isMe: boolean): PIXI.Container {
    const root = new PIXI.Container();
    const ring = new PIXI.Graphics();
    ring.beginFill(0xffffff);
    ring.lineStyle(3, isMe ? 0xa14400 : 0xe9d8b9, 1);
    ring.drawCircle(0, 0, 30);
    ring.endFill();
    root.addChild(ring);

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    const baseSize = 56;
    sprite.width = baseSize;
    sprite.height = baseSize;
    sprite.position.set(0, 0);
    root.addChild(sprite);

    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawCircle(0, 0, 27);
    mask.endFill();
    root.addChild(mask);
    sprite.mask = mask;

    return root;
  }

  /**
   * 启动一次远程头像加载；同步返回当前缓存中的纹理（若有），否则返回 null 等加载完成。
   * 加载完成后触发 redraw，让"占位 emoji → 真实头像"的切换发生。
   */
  private ensureAvatarTexture(url: string): PIXI.Texture | null {
    if (!url) {
      return null;
    }
    let key = this.avatarKeyByUrl.get(url);
    if (!key) {
      key = `avatar_${this.avatarKeyByUrl.size}_${url.slice(-12)}`;
      this.avatarKeyByUrl.set(url, key);
    }
    const cached = TextureCache.get(key);
    if (cached) {
      return cached;
    }
    const generation = ++this.avatarLoadGeneration;
    void TextureCache.load(key, url).then((tex) => {
      if (tex && generation <= this.avatarLoadGeneration) {
        // 头像就绪后局部刷新榜单：调用 redraw 会重画 mineLayer 与 cardContent
        this.redraw();
      }
    }).catch((error) => {
      console.warn('[LeaderboardScene] load avatar failed', url, error);
    });
    return null;
  }

  /** 奖牌徽章：前 3 名金/银/铜 + 丝带，4+ 显示数字（自己行另用 99+ 兜底） */
  private createRankBadge(rank: number, isMe: boolean): PIXI.Container {
    const root = new PIXI.Container();
    if (rank <= 3) {
      const palette = rank === 1
        ? { core: 0xf7c64a, edge: 0xc88517, ribbon: 0xd94b4b }
        : rank === 2
          ? { core: 0xd8e2ec, edge: 0x8aa3b9, ribbon: 0xd94b4b }
          : { core: 0xe79768, edge: 0xa15a2a, ribbon: 0xd94b4b };

      // 丝带（两条三角形）
      const ribbon = new PIXI.Graphics();
      ribbon.beginFill(palette.ribbon);
      ribbon.drawPolygon([-18, -24, -6, -24, -2, 10, -14, 6]);
      ribbon.drawPolygon([18, -24, 6, -24, 2, 10, 14, 6]);
      ribbon.endFill();
      root.addChild(ribbon);

      // 圆盘
      const disk = new PIXI.Graphics();
      disk.beginFill(palette.edge);
      disk.drawCircle(0, 10, 26);
      disk.endFill();
      disk.beginFill(palette.core);
      disk.drawCircle(0, 10, 22);
      disk.endFill();
      root.addChild(disk);

      const numText = new PIXI.Text(String(rank), {
        fontSize: 26,
        fill: 0x5a3318,
        fontWeight: '900',
        stroke: 0xffffff,
        strokeThickness: 3,
        lineJoin: 'round',
      });
      numText.anchor.set(0.5);
      numText.resolution = 2;
      numText.position.set(0, 10);
      root.addChild(numText);
      return root;
    }

    // 4+ 名次：纯数字（自己行特殊显示 99+）
    const display = isMe && rank > 99 ? '99+' : String(rank);
    const sizeMap: Record<string, number> = { '99+': 26 };
    const label = new PIXI.Text(display, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: sizeMap[display] ?? 32,
      fill: isMe ? 0xffffff : 0x9b8268,
      fontWeight: '900',
      stroke: isMe ? 0xa14400 : 0xffffff,
      strokeThickness: isMe ? 4 : 3,
      lineJoin: 'round',
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    root.addChild(label);
    return root;
  }

  /** 圆形水果头像：白色圆 + 描边 + emoji */
  private createFruitAvatar(rank: number, isMe: boolean): PIXI.Container {
    const root = new PIXI.Container();
    const ring = new PIXI.Graphics();
    ring.beginFill(0xffffff);
    ring.lineStyle(3, isMe ? 0xa14400 : 0xe9d8b9, 1);
    ring.drawCircle(0, 0, 30);
    ring.endFill();
    root.addChild(ring);

    const fruit = isMe
      ? AVATAR_FRUIT_FOR_ME
      : (AVATAR_FRUIT_FOR_RANK[(rank - 1) % AVATAR_FRUIT_FOR_RANK.length] ?? '🍎');
    const emoji = new PIXI.Text(fruit, {
      fontSize: 38,
      fill: 0xffffff,
    });
    emoji.anchor.set(0.5);
    emoji.resolution = 2;
    emoji.position.set(0, 1);
    root.addChild(emoji);
    return root;
  }

  /** 关卡/分数 pill：右侧紫色长方形，白字 */
  private createValuePill(record: RankRecord, isMe: boolean): PIXI.Container {
    const root = new PIXI.Container();
    const w = 132;
    const h = 64;
    const bg = new PIXI.Graphics();
    bg.beginFill(isMe ? 0xf9852c : COLOR_PILL_PURPLE);
    bg.lineStyle(2, isMe ? 0xb35a1a : 0x7c5bb0, 1);
    bg.drawRoundedRect(-w, -h / 2, w, h, 18);
    bg.endFill();
    root.addChild(bg);

    const text = new PIXI.Text(this.formatRecordValue(record), {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 26,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: isMe ? 0xa14400 : 0x6a4a99,
      strokeThickness: 3,
      lineJoin: 'round',
    });
    text.anchor.set(0.5);
    text.resolution = 2;
    text.position.set(-w / 2, 0);
    root.addChild(text);
    return root;
  }

  /** 卡片底部固定的自己一行（已上榜时也会重复显示，便于快速定位） */
  private drawMineRow(mine: RankRecord | null, list: RankRecord[] = []): void {
    const rowH = 84;
    const y = this.cardY + this.cardH - rowH / 2 - 26;

    // 默认隐藏 CTA：在下面如果"自己未授权"再打开
    this.weChatProfileButtonRect = { x: 0, y: 0, w: 0, h: 0 };

    if (this.activeTab !== 'world') {
      return;
    }

    let record: RankRecord;
    if (mine) {
      record = { ...mine, isMe: true };
    } else {
      // 兜底：列表里若已包含 isMe=true 的记录则复用，否则用占位
      const meInList = list.find((it) => it.isMe);
      if (meInList) {
        record = { ...meInList, isMe: true };
      } else {
        record = {
          rank: null,
          board: this.worldBoard,
          displayName: '自己',
          avatarUrl: '',
          isMe: true,
          updatedAt: 0,
          level: 1,
          badgeLevel: 0,
          score: 0,
        } as RankRecord;
      }
    }

    // 没排名时显示 99+，符合 UI 图样式
    if (record.rank == null || record.rank > 99) {
      record.rank = 100; // 仅用于 createRankBadge 内部判断 >99 路径
    }
    const row = this.createRankRow(record, 99);
    row.position.set(Game.logicWidth / 2, y);
    this.mineLayer.addChild(row);

    // 未授权微信资料 → 在自己行上方再叠一条"用微信头像昵称"的 CTA 提示
    if (!UserProfileService.hasRealProfile()) {
      const cta = this.createWeChatProfileCta(rowH);
      // 先设置 position + 挂到父链，再让 createWeChatProfileCta 内部用 toGlobal 同步算坐标
      cta.position.set(Game.logicWidth / 2, y - rowH / 2 - 28);
      this.mineLayer.addChild(cta);
      // 真正写入透明按钮坐标 —— 同步执行，避免和 update() 每帧调用 sync 之间的清零/重建窗口
      this.applyWeChatProfileCtaRect(cta);
    }
  }

  /**
   * 自己行上方的提示条：「使用微信昵称和头像上榜」
   * 把"授权"绿色按钮在 root 局部坐标里的中心点存到 root._authBtnCenter，
   * 真正写入 weChatProfileButtonRect 由 applyWeChatProfileCtaRect 在挂载后同步完成，
   * 这样避免和 update() 每帧的 syncWeChatProfileNativeBtn 之间出现"rect=0 短暂窗口期"。
   */
  private createWeChatProfileCta(rowH: number): PIXI.Container {
    const root = new PIXI.Container();
    const w = this.cardW - 56;
    const h = 56;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xfff3d6);
    bg.lineStyle(2, 0xf5b94a, 1);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.endFill();
    root.addChild(bg);

    const icon = new PIXI.Text('💚', {
      fontSize: 28,
    });
    icon.anchor.set(0.5);
    icon.position.set(-w / 2 + 30, 0);
    root.addChild(icon);

    const label = new PIXI.Text('使用微信昵称头像上榜', {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 22,
      fill: 0x8a5a2b,
      fontWeight: '900',
    });
    label.anchor.set(0, 0.5);
    label.resolution = 2;
    label.position.set(-w / 2 + 56, 0);
    root.addChild(label);

    const btnBg = new PIXI.Graphics();
    const btnW = 110;
    const btnH = 40;
    btnBg.beginFill(0x07c160);
    btnBg.lineStyle(2, 0x059149, 1);
    btnBg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 20);
    btnBg.endFill();
    const btnCenterX = w / 2 - btnW / 2 - 12;
    btnBg.position.set(btnCenterX, 0);
    root.addChild(btnBg);

    const btnLabel = new PIXI.Text('授权', {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 22,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x059149,
      strokeThickness: 3,
      lineJoin: 'round',
    });
    btnLabel.anchor.set(0.5);
    btnLabel.resolution = 2;
    btnLabel.position.set(btnCenterX, 0);
    root.addChild(btnLabel);

    // 把"授权"按钮的局部坐标和尺寸挂在 root 上，等 root 加入 mineLayer 之后由
    // applyWeChatProfileCtaRect 同步用 toGlobal 换算出物理矩形（避免 microtask 时序坑）。
    (root as any)._authBtnLocalX = btnCenterX;
    (root as any)._authBtnW = btnW;
    (root as any)._authBtnH = btnH;
    return root;
  }

  /**
   * 把 CTA 内"授权"按钮的全局坐标算出来，立刻写入 weChatProfileButtonRect 并同步透明 wx 按钮。
   * 必须在 cta 已经 addChild 且 position 设置完之后调用 —— toGlobal 才能拿到正确父链。
   */
  private applyWeChatProfileCtaRect(cta: PIXI.Container): void {
    const btnCenterX = (cta as any)._authBtnLocalX as number;
    const btnW = (cta as any)._authBtnW as number;
    const btnH = (cta as any)._authBtnH as number;
    if (!Number.isFinite(btnCenterX) || !Number.isFinite(btnW) || !Number.isFinite(btnH)) {
      return;
    }
    const global = cta.toGlobal(new PIXI.Point(btnCenterX, 0));
    // global 是物理像素；除以 stage.scale 还原回设计像素
    const stageScale = Math.max(0.0001, Game.scale || 1);
    const designX = global.x / stageScale;
    const designY = global.y / stageScale;
    this.weChatProfileButtonRect = {
      x: designX - btnW / 2,
      y: designY - btnH / 2,
      w: btnW,
      h: btnH,
    };
    console.log(
      `[LeaderboardScene] CTA rect ready (design px):` +
        ` x=${this.weChatProfileButtonRect.x.toFixed(1)} y=${this.weChatProfileButtonRect.y.toFixed(1)}` +
        ` w=${btnW} h=${btnH} stageScale=${stageScale.toFixed(3)}`,
    );
    this.syncWeChatProfileNativeBtn();
  }

  /**
   * 把 wx 原生 createUserInfoButton 同步盖在 weChatProfileButtonRect 上，
   * 让玩家"看上去点了授权按钮"实际就是触发了原生授权框（微信唯一可靠的获取真实头像昵称途径）。
   */
  private syncWeChatProfileNativeBtn(): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    if (!api?.createUserInfoButton) {
      return;
    }
    const rect = this.weChatProfileButtonRect;
    if (!rect.w || !rect.h) {
      this.destroyWeChatProfileNativeBtn();
      return;
    }
    // weChatProfileButtonRect 存的是"设计像素"坐标；
    // 设计 → CSS 像素 = 设计 * (screenWidth / designWidth) = 设计 * (1 / designWidth) * screenWidth
    // 我们直接用 Game 上的 designWidth / screenWidth 换算：
    const designW = Game.designWidth || 750;
    const screenW = Game.screenWidth || designW;
    const designToCss = screenW / designW;
    const cssLeft = Math.round(rect.x * designToCss);
    const cssTop = Math.round(rect.y * designToCss);
    const cssW = Math.max(1, Math.round(rect.w * designToCss));
    const cssH = Math.max(1, Math.round(rect.h * designToCss));

    if (!this.weChatProfileNativeBtn) {
      try {
        this.lastSyncedBtnCss = { left: cssLeft, top: cssTop, width: cssW, height: cssH };
        // 注：text 必须非空、fontSize 最低 12，部分基础库下 text='' 或 fontSize<12
        // 按钮不会被渲染（不会触发 onTap），用一个空格 + color 透明能避开这条已知坑。
        const btn = api.createUserInfoButton({
          type: 'text',
          text: ' ',
          style: {
            left: cssLeft,
            top: cssTop,
            width: cssW,
            height: cssH,
            backgroundColor: 'rgba(0,0,0,0)',
            borderColor: 'rgba(0,0,0,0)',
            borderWidth: 0,
            borderRadius: Math.round(cssH / 2),
            color: 'rgba(0,0,0,0)',
            fontSize: 12,
            textAlign: 'center',
            lineHeight: cssH,
          },
          withCredentials: false,
        });
        if (!btn) {
          console.warn('[LeaderboardScene] createUserInfoButton returned falsy');
          return;
        }
        this.weChatProfileNativeBtn = btn;
        btn.onTap((res) => this.handleWeChatProfileTap(res));
        btn.show();
        console.log(
          `[LeaderboardScene] CTA wx btn created css(left=${cssLeft} top=${cssTop}` +
            ` w=${cssW} h=${cssH}) screen(${Game.screenWidth}x${(Game.screenHeight as any) || '?'})`,
        );
      } catch (error) {
        console.warn('[LeaderboardScene] createUserInfoButton failed', error);
      }
      return;
    }

    const last = this.lastSyncedBtnCss;
    if (last && last.left === cssLeft && last.top === cssTop && last.width === cssW && last.height === cssH) {
      // 完全没变就跳过 ——避免每次写 style 触发基础库 updateTextView 日志
      return;
    }
    try {
      this.lastSyncedBtnCss = { left: cssLeft, top: cssTop, width: cssW, height: cssH };
      Object.assign(this.weChatProfileNativeBtn.style, {
        left: cssLeft,
        top: cssTop,
        width: cssW,
        height: cssH,
        lineHeight: cssH,
        borderRadius: Math.round(cssH / 2),
      });
    } catch (error) {
      console.warn('[LeaderboardScene] sync userInfo btn style failed', error);
    }
  }

  private destroyWeChatProfileNativeBtn(): void {
    this.lastSyncedBtnCss = null;
    if (!this.weChatProfileNativeBtn) {
      return;
    }
    try {
      this.weChatProfileNativeBtn.hide();
    } catch {
      // 销毁前 hide 失败不影响后续 destroy
    }
    try {
      this.weChatProfileNativeBtn.destroy();
    } catch (error) {
      console.warn('[LeaderboardScene] destroy userInfo btn failed', error);
    }
    this.weChatProfileNativeBtn = null;
  }

  /** wx.createUserInfoButton 点击回调：拿到资料则落地 + 重传后端，未拿到给玩家一个反馈 */
  private handleWeChatProfileTap(res?: {
    errMsg?: string;
    err_code?: number;
    userInfo?: { nickName: string; avatarUrl: string };
  }): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    const errMsg = res?.errMsg || '';
    console.log('[LeaderboardScene] userInfo onTap:', JSON.stringify({
      hasUserInfo: !!res?.userInfo,
      nick: res?.userInfo?.nickName,
      errMsg,
      errCode: res?.err_code,
    }));

    // 隐私协议未配置：兜底 toast，避免玩家以为按钮失灵
    if (errMsg.includes('no privacy api permission') || res?.err_code === -12034) {
      api?.showToast?.({ title: '隐私协议未配置', icon: 'none' });
      return;
    }

    // 用户拒绝授权 → 礼貌提示，原 CTA 继续保留可二次点击
    if (errMsg.includes('fail') && errMsg.includes('deny')) {
      api?.showToast?.({ title: '已取消授权', icon: 'none' });
      return;
    }

    const applied = UserProfileService.applyFromWeChat(res?.userInfo);
    if (applied) {
      api?.showToast?.({ title: '已带微信昵称上榜', icon: 'success' });
      this.destroyWeChatProfileNativeBtn();
      // 拿到资料后触发"强制重传"+"重新拉列表"以同步后端
      void this.loadWorldBoardWithFlush(this.worldBoard);
    } else {
      // 微信新策略下拿不到真名时，至少告诉玩家结果
      api?.showToast?.({ title: '微信限制，未获取到真实昵称', icon: 'none', duration: 2500 });
    }
  }

  /** 状态卡片：用于 loading / 错误 / 空数据 / 好友榜占位 */
  private drawState(text: string, retry = false): void {
    const W = Game.logicWidth;
    const y = this.cardY + 320;
    const card = new PIXI.Container();
    card.position.set(W / 2, y);

    const w = this.cardW - 120;
    const h = retry ? 200 : 168;
    const bg = new PIXI.Graphics();
    bg.beginFill(0xffffff);
    bg.lineStyle(3, COLOR_CARD_STROKE, 1);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, 24);
    bg.endFill();
    card.addChild(bg);

    const label = new PIXI.Text(text, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 26,
      fill: 0x8a5a2b,
      fontWeight: '900',
      align: 'center',
      wordWrap: true,
      wordWrapWidth: w - 40,
      lineHeight: 36,
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    label.position.set(0, retry ? -24 : 0);
    card.addChild(label);

    if (retry) {
      const btn = this.createPillButton('重新加载', () => {
        AudioManager.playButtonSound();
        void this.loadWorldBoard(this.worldBoard);
      }, COLOR_TAB_ACTIVE_BG, 0x5a3318);
      btn.position.set(0, 44);
      card.addChild(btn);
    }

    this.cardContent.addChild(card);
  }

  /**
   * 好友榜：把 wx.getOpenDataContext() 子域绘制的 sharedCanvas 贴到 PIXI 上展示。
   * - 非微信小游戏环境（开发预览 / 不支持基础库）：回退到 drawFriendPlaceholder()
   * - 微信小游戏：创建/复用 friendBoardSprite，并 postMessage 触发子域重绘
   */
  private drawFriendBoard(): void {
    if (!isFriendRankSupported()) {
      this.drawFriendPlaceholder();
      return;
    }

    const W = Game.logicWidth;
    // 好友榜区域：跟世界榜列表的纵向起止严格对齐（startY=cardY+196, 底距 26）；
    // 横向用同样的 sidePad=28，行宽 = cardW - 56，跟 createRankRow 的有效宽相同。
    const topY = this.cardY + 196;
    const bottomY = this.cardY + this.cardH - 26;
    const sidePad = 28;
    const area = {
      x: this.cardX + sidePad,
      y: topY,
      w: this.cardW - sidePad * 2,
      h: Math.max(120, bottomY - topY),
    };

    // sharedCanvas 物理像素 = 设计像素 * pixelRatio；
    // 取 2x 以保证文字与头像在高 dpr 屏上仍清晰，但又不至于让子域 canvas 太大浪费内存
    const pixelRatio = 2;
    const physW = Math.max(1, Math.round(area.w * pixelRatio));
    const physH = Math.max(1, Math.round(area.h * pixelRatio));
    ensureSharedCanvasSize(physW, physH);

    // sharedCanvas size 或绘制区域变化时，先清掉旧合成区域再设置新的。
    if (this.friendBoardOverlayActive) {
      this.destroyFriendBoardSprite();
    }
    const canvas = getSharedCanvas();
    if (!canvas) {
      this.drawFriendPlaceholder();
      return;
    }
    // 触发子域绘制：
    //  - 始终 force=true，与历史行为一致。即便 LeaderboardScene.onEnter 阶段 prefetch
    //    已经把数据填进 60s 缓存，子域里的 inflight 合并层也会把两次请求合成一次 wx 网络调用，
    //    不会因此多刷一份接口。force=true 主要保证在真机上 prefetch postMessage 漏掉时，
    //    render 路径仍然会触发实际的数据拉取，避免出现"白屏不刷新"。
    const tabKey: FriendRankTab = this.worldBoard === RANK_BOARD_FRUIT ? 'fruit' : 'bowl';
    console.log(
      '[LeaderboardScene] drawFriendBoard tab=' + tabKey
        + ' area=' + Math.round(area.w) + 'x' + Math.round(area.h)
        + ' phys=' + physW + 'x' + physH
        + ' canvas=' + (canvas as any).width + 'x' + (canvas as any).height
        + ' selfOpenId=' + (this.resolveWechatOpenId() ? 'yes' : 'no')
    );
    renderFriendBoard({
      tab: tabKey,
      width: physW,
      height: physH,
      pixelRatio,
      selfOpenId: this.resolveWechatOpenId(),
      force: true,
    });
    const overlayOk = Game.setOpenDataOverlay({
      canvas,
      x: area.x,
      y: area.y,
      width: area.w,
      height: area.h,
    });
    this.friendBoardOverlayActive = overlayOk;
    if (!overlayOk) {
      if (this.tryDrawFriendBoardWithWxBindTexture(canvas, area)) {
        this.friendBoardOverlayActive = true;
      } else {
        this.drawFriendPlaceholder(
          '当前渲染模式无法显示好友榜',
          '微信开放数据域需要 2D 上屏合成；当前 Pixi 已回退为 WebGL 直出，且本环境不支持 iOS 纹理绑定'
        );
      }
    }

    // 好友榜内容完全由子域渲染：列表与底部自己行都在 sharedCanvas 中绘制，
    // 把上一次可能残留的 wx 原生授权按钮拆掉。
    this.destroyWeChatProfileNativeBtn();
    this.weChatProfileButtonRect = { x: 0, y: 0, w: 0, h: 0 };
  }

  /** CloudBase 登录态里的 userId 形如 `wx:<openid>`，子域用 openid 精确高亮“我” */
  private resolveWechatOpenId(): string {
    const userId = BackendService.userId || '';
    return userId.startsWith('wx:') ? userId.slice(3) : '';
  }

  /** direct-webgl 下的 iOS 官方兜底：gl.wxBindCanvasTexture，仅 iOS 支持 */
  private tryDrawFriendBoardWithWxBindTexture(
    canvas: HTMLCanvasElement & { width: number; height: number },
    area: { x: number; y: number; w: number; h: number }
  ): boolean {
    if (!Game.canBindCanvasTexture()) {
      return false;
    }
    try {
      const resource = new WxSharedCanvasResource(canvas);
      const baseTexture = new PIXI.BaseTexture(resource, {
        mipmap: PIXI.MIPMAP_MODES.OFF,
        scaleMode: PIXI.SCALE_MODES.LINEAR,
        wrapMode: PIXI.WRAP_MODES.CLAMP,
      });
      baseTexture.setRealSize(canvas.width, canvas.height);
      const texture = new PIXI.Texture(baseTexture);
      const sprite = new PIXI.Sprite(texture);
      sprite.position.set(area.x, area.y);
      sprite.width = area.w;
      sprite.height = area.h;
      this.friendBoardSprite = sprite;
      this.cardContent.addChild(sprite);
      console.log('[LeaderboardScene] use wxBindCanvasTexture fallback for friendBoard');
      return true;
    } catch (error) {
      console.warn('[LeaderboardScene] wxBindCanvasTexture fallback failed', error);
      return false;
    }
  }

  /** 离开好友榜时关闭 sharedCanvas 上屏合成，避免在其他 tab/场景下残留 */
  private destroyFriendBoardSprite(): void {
    Game.clearOpenDataOverlay();
    if (this.friendBoardSprite) {
      try {
        this.friendBoardSprite.parent?.removeChild(this.friendBoardSprite);
        this.friendBoardSprite.destroy({ children: false, texture: true, baseTexture: true });
      } catch (error) {
        console.warn('[LeaderboardScene] destroy friendBoardSprite failed', error);
      }
      this.friendBoardSprite = null;
    }
    this.friendBoardOverlayActive = false;
  }

  /** 好友榜占位：非微信小游戏环境（开发预览等）下，给出引导文案与分享入口 */
  private drawFriendPlaceholder(
    titleText = '好友榜即将开放',
    descText = '邀请微信好友一起来挑战吧\n好友越多，你的排名越精彩'
  ): void {
    const W = Game.logicWidth;
    const y = this.cardY + 332;
    const card = new PIXI.Container();
    card.position.set(W / 2, y);

    const w = this.cardW - 120;
    const h = 280;
    const bg = new PIXI.Graphics();
    bg.beginFill(0xffffff);
    bg.lineStyle(3, COLOR_CARD_STROKE, 1);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, 24);
    bg.endFill();
    card.addChild(bg);

    const icon = new PIXI.Text('🥥🍈🍋', {
      fontSize: 56,
    });
    icon.anchor.set(0.5);
    icon.resolution = 2;
    icon.position.set(0, -h / 2 + 60);
    card.addChild(icon);

    const title = new PIXI.Text(titleText, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 30,
      fill: 0x5a3318,
      fontWeight: '900',
      stroke: 0xffffff,
      strokeThickness: 4,
      lineJoin: 'round',
    });
    title.anchor.set(0.5);
    title.resolution = 2;
    title.position.set(0, -h / 2 + 130);
    card.addChild(title);

    const desc = new PIXI.Text(descText, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 22,
      fill: 0x8a5a2b,
      fontWeight: '700',
      align: 'center',
      lineHeight: 32,
    });
    desc.anchor.set(0.5);
    desc.resolution = 2;
    desc.position.set(0, -h / 2 + 188);
    card.addChild(desc);

    const inviteBtn = this.createPillButton('邀请好友', () => {
      AudioManager.playButtonSound();
      this.shareToWechat();
    }, COLOR_TAB_ACTIVE_BG, 0x5a3318);
    inviteBtn.position.set(0, h / 2 - 50);
    card.addChild(inviteBtn);

    this.cardContent.addChild(card);
  }

  /** 调用微信原生分享，邀请好友前来挑战 */
  private shareToWechat(): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    if (!api?.shareAppMessage) {
      api?.showToast?.({ title: '当前环境不支持分享', icon: 'none' });
      return;
    }
    try {
      api.shareAppMessage({
        title: '别捞水果｜来挑战榜单看看谁更强',
        imageUrl: 'assets/images/share_card.jpg',
      });
    } catch (error) {
      console.warn('[LeaderboardScene] share failed', error);
    }
  }

  /** 通用药丸按钮（白文字 + 圆角橙底） */
  private createPillButton(label: string, onTap: () => void, bgColor: number, textColor: number): PIXI.Container {
    const root = new PIXI.Container();
    const w = 200;
    const h = 60;
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-w / 2, -h / 2, w, h);

    const bg = new PIXI.Graphics();
    bg.beginFill(bgColor);
    bg.lineStyle(3, 0xd99b1f, 1);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, 30);
    bg.endFill();
    root.addChild(bg);

    const t = new PIXI.Text(label, {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 26,
      fill: textColor,
      fontWeight: '900',
      stroke: 0xffffff,
      strokeThickness: 3,
      lineJoin: 'round',
    });
    t.anchor.set(0.5);
    t.resolution = 2;
    root.addChild(t);
    root.on('pointertap', onTap);
    return root;
  }

  private formatRecordValue(record: RankRecord): string {
    // 当前 UI 图统一展示为「N关」；果切高分时改成「N分」更直观
    if (record.board === RANK_BOARD_BOWL) {
      const level = Math.max(1, Math.floor(record.level || 1));
      return `${level}关`;
    }
    if (record.board === RANK_BOARD_FRUIT) {
      return `${Math.max(0, Math.floor(record.score || 0))}分`;
    }
    return '—';
  }
}
