import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { FRUIT_CONFIGS, type FruitConfig, type FruitId } from '@/config/fruits';
import { fruitSliceWholeTextureKey, FRUIT_SLICE_IDS, FRUIT_SLICE_WHOLE_PATH } from '@/config/fruitSliceWhole';
import { loadCatalogAssetsSubpackage } from '@/utils/loadBowlSubpackage';
import { TextureCache } from '@/utils/TextureCache';
import { gameTopBarY, GAME_TOP_BAR_BACK_X } from '@/utils/gameTopBarLayout';

type FruitSliceNode = PIXI.Container & { fruitId: FruitId };
const FRUIT_SLICE_ID_SET = new Set<FruitId>(FRUIT_SLICE_IDS);

/** 果切玩法原型：上方完整水果（主包 fruit_book）、中部漏斗崖、底部消除/打乱 */
export class FruitSliceScene implements Scene {
  readonly name = 'fruitSlice';
  readonly container = new PIXI.Container();

  private loaded = false;
  private readonly fruitLayer = new PIXI.Container();
  /** 管道内堆叠（自下而上），与网格分离 */
  private readonly pipeStackLayer = new PIXI.Container();
  private readonly pipeStack: { node: PIXI.Container; fruitId: FruitId }[] = [];
  private fruitNodes: PIXI.Container[] = [];
  private remainingLabel!: PIXI.Text;
  private percentLabel!: PIXI.Text;
  private remaining = 174;
  private fruitTopY = 0;
  private fruitBottomY = 0;
  /** 管道落点（与 drawCliffs 峡谷底对齐） */
  private cliffTopY = 0;
  private cliffBottomY = 0;
  /** 每列自上而下 [顶→底]，仅列尾可点 */
  private readonly columns: PIXI.Container[][] = [[], [], [], [], []];
  private static readonly FRUIT_COLS = 5;

  constructor() {
    this.build();
  }

  onEnter(): void {
    if (!this.loaded) {
      void this.preloadAndMountFruits();
    }
  }

  private async preloadAndMountFruits(): Promise<void> {
    try {
      // 整果贴图已下沉到 catalog_assets 分包，进玩法前确保分包完成加载
      await loadCatalogAssetsSubpackage();
      const jobs = FRUIT_SLICE_IDS.map((id) =>
        TextureCache.load(fruitSliceWholeTextureKey(id), FRUIT_SLICE_WHOLE_PATH[id]),
      );
      await Promise.all(jobs);
      this.loaded = true;
      this.layoutFruitCluster();
    } catch (e) {
      console.warn('[FruitSliceScene] preload failed', e);
      this.loaded = true;
      this.layoutFruitCluster();
    }
  }

  private build(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const top = Game.safeTop;
    const headerH = top + 72;
    /** 整体上移易压住水果层；下移崖顶并加大与水果区的垂直间距 */
    const cliffTop = H * 0.51;
    const cliffBottom = H * 0.78;
    const gapHalf = 26;
    this.cliffTopY = cliffTop;
    this.cliffBottomY = cliffBottom;

    this.fruitTopY = headerH + 10;
    this.fruitBottomY = cliffTop - 44;

    this.drawSky(W, H, headerH);

    this.fruitLayer.sortableChildren = true;
    this.pipeStackLayer.sortableChildren = true;
    this.container.addChild(this.fruitLayer);

    this.drawCliffs(W, cliffTop, cliffBottom, gapHalf);

    this.drawGapKnife(W, cliffBottom);
    /** 叠在刀与崖之上，管道内水果可见 */
    this.container.addChild(this.pipeStackLayer);

    const leftPill = new PIXI.Container();
    leftPill.position.set(W * 0.22, cliffTop + (cliffBottom - cliffTop) * 0.38);
    const lp = new PIXI.Graphics();
    lp.beginFill(0x5d8c3a, 0.92);
    lp.drawRoundedRect(-56, -40, 112, 80, 14);
    lp.endFill();
    leftPill.addChild(lp);
    const lr1 = new PIXI.Text('剩余', { fontSize: 16, fill: 0xfff8dd, fontWeight: '700' });
    lr1.anchor.set(0.5);
    lr1.position.set(0, -14);
    leftPill.addChild(lr1);
    this.remainingLabel = new PIXI.Text(String(this.remaining), {
      fontSize: 28,
      fill: 0xfffef0,
      fontWeight: '800',
    });
    this.remainingLabel.anchor.set(0.5);
    this.remainingLabel.position.set(0, 14);
    leftPill.addChild(this.remainingLabel);
    this.container.addChild(leftPill);

    const rightPill = new PIXI.Container();
    rightPill.position.set(W * 0.78, cliffTop + (cliffBottom - cliffTop) * 0.38);
    const rp = new PIXI.Graphics();
    rp.beginFill(0x5d8c3a, 0.92);
    rp.drawRoundedRect(-56, -40, 112, 80, 14);
    rp.endFill();
    rightPill.addChild(rp);
    const rr1 = new PIXI.Text('🍉', { fontSize: 22 });
    rr1.anchor.set(0.5);
    rr1.position.set(-18, -10);
    rightPill.addChild(rr1);
    this.percentLabel = new PIXI.Text('0%', {
      fontSize: 26,
      fill: 0xfffef0,
      fontWeight: '800',
    });
    this.percentLabel.anchor.set(0.5);
    this.percentLabel.position.set(12, 4);
    rightPill.addChild(this.percentLabel);
    this.container.addChild(rightPill);

    const headerBar = new PIXI.Graphics();
    headerBar.beginFill(0x2d5f78, 0.88);
    headerBar.drawRect(0, top, W, headerH - top + 4);
    headerBar.endFill();
    this.container.addChild(headerBar);

    const backBtn = new PIXI.Container();
    backBtn.position.set(GAME_TOP_BAR_BACK_X, gameTopBarY(top));
    backBtn.eventMode = 'static';
    backBtn.cursor = 'pointer';
    const backBg = new PIXI.Graphics();
    backBg.beginFill(0xffffff, 0.95);
    backBg.drawCircle(0, 0, 22);
    backBg.endFill();
    backBtn.addChild(backBg);
    const backTxt = new PIXI.Text('‹', { fontSize: 32, fill: 0x2a5a78, fontWeight: '700' });
    backTxt.anchor.set(0.5);
    backBtn.addChild(backTxt);
    backBtn.hitArea = new PIXI.Circle(0, 0, 28);
    backBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('home');
    });
    this.container.addChild(backBtn);

    const title = new PIXI.Text('果切', {
      fontSize: 26,
      fill: 0xffffff,
      fontWeight: '800',
      dropShadow: true,
      dropShadowColor: 0x1a3a50,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    });
    title.anchor.set(0.5);
    title.position.set(W / 2, top + 36);
    this.container.addChild(title);

    this.drawBottomDecor(W, H);
    this.drawActionButtons(W, H);
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
    const left = new PIXI.Graphics();
    left.beginFill(0x7a5a3d);
    left.drawPolygon([
      0, cliffTop - 20,
      cx - gapHalf, cliffTop + 4,
      cx - gapHalf - 6, cliffBottom,
      0, cliffBottom,
    ]);
    left.endFill();
    const leftGrass = new PIXI.Graphics();
    leftGrass.beginFill(0x4fa83a);
    leftGrass.drawPolygon([
      0, cliffTop - 28,
      cx - gapHalf - 2, cliffTop + 2,
      cx - gapHalf, cliffTop + 8,
      0, cliffTop + 6,
    ]);
    leftGrass.endFill();
    this.container.addChild(left, leftGrass);

    const right = new PIXI.Graphics();
    right.beginFill(0x7a5a3d);
    right.drawPolygon([
      W, cliffTop - 20,
      cx + gapHalf, cliffTop + 4,
      cx + gapHalf + 6, cliffBottom,
      W, cliffBottom,
    ]);
    right.endFill();
    const rightGrass = new PIXI.Graphics();
    rightGrass.beginFill(0x4fa83a);
    rightGrass.drawPolygon([
      W, cliffTop - 28,
      cx + gapHalf + 2, cliffTop + 2,
      cx + gapHalf, cliffTop + 8,
      W, cliffTop + 6,
    ]);
    rightGrass.endFill();
    this.container.addChild(right, rightGrass);

    for (let x = 20; x < W; x += 50) {
      const vine = new PIXI.Graphics();
      vine.lineStyle(3, 0x3d7a2d, 0.65);
      vine.moveTo(x, cliffBottom + 4);
      vine.bezierCurveTo(x + 8, cliffBottom - 40, x - 6, cliffTop + 30, x + 4, cliffTop + 8);
      this.container.addChild(vine);
    }
  }

  /** 峡谷缺口底部：卡通大刀（刃朝上），替代原解锁+篮子 */
  private drawGapKnife(_W: number, cliffBottom: number): void {
    const root = new PIXI.Container();
    root.position.set(_W / 2, cliffBottom + 14);

    const blade = new PIXI.Graphics();
    blade.lineStyle(2, 0x6a737d, 1);
    blade.beginFill(0xd5dce3);
    blade.drawPolygon([
      0, -132,
      10, -126,
      64, -44,
      64, -34,
      22, -28,
      -22, -28,
      -26, -38,
      -8, -50,
    ]);
    blade.endFill();
    blade.beginFill(0xecf0f4, 0.5);
    blade.drawPolygon([6, -120, 18, -118, 50, -52, 36, -50]);
    blade.endFill();
    root.addChild(blade);

    const edge = new PIXI.Graphics();
    edge.lineStyle(3, 0xb0b8c2, 1);
    edge.moveTo(-20, -40);
    edge.lineTo(60, -40);
    root.addChild(edge);

    const guard = new PIXI.Graphics();
    guard.lineStyle(2, 0x546e7a, 1);
    guard.beginFill(0x90a4ae);
    guard.drawRoundedRect(-32, -32, 64, 10, 3);
    guard.endFill();
    root.addChild(guard);

    const handle = new PIXI.Graphics();
    handle.lineStyle(2, 0x3e2723, 1);
    handle.beginFill(0x5d4037);
    handle.drawRoundedRect(-18, -22, 36, 54, 10);
    handle.endFill();
    root.addChild(handle);

    const woodGrain = new PIXI.Graphics();
    woodGrain.lineStyle(1, 0x4e342e, 0.35);
    woodGrain.moveTo(-8, 0);
    woodGrain.lineTo(-8, 24);
    woodGrain.moveTo(8, 2);
    woodGrain.lineTo(8, 26);
    root.addChild(woodGrain);

    const pommel = new PIXI.Graphics();
    pommel.lineStyle(2, 0xc9a227, 1);
    pommel.beginFill(0xe6d060, 0.75);
    pommel.drawEllipse(0, 24, 13, 9);
    pommel.endFill();
    root.addChild(pommel);

    this.container.addChild(root);
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

  private drawActionButtons(W: number, H: number): void {
    const y = H - 108;
    const mk = (x: number, icon: string, label: string, fn: () => void) => {
      const c = new PIXI.Container();
      c.position.set(x, y);
      c.eventMode = 'static';
      c.cursor = 'pointer';
      const bg = new PIXI.Graphics();
      bg.beginFill(0x43b75d);
      bg.lineStyle(3, 0x2e8b45, 1);
      bg.drawRoundedRect(-78, -44, 156, 88, 22);
      bg.endFill();
      c.addChild(bg);
      const ic = new PIXI.Text(icon, { fontSize: 30 });
      ic.anchor.set(0.5);
      ic.position.set(0, -12);
      c.addChild(ic);
      const lb = new PIXI.Text(label, {
        fontSize: 20,
        fill: 0xfffef8,
        fontWeight: '800',
      });
      lb.anchor.set(0.5);
      lb.position.set(0, 22);
      c.addChild(lb);
      c.hitArea = new PIXI.Rectangle(-78, -44, 156, 88);
      c.on('pointertap', () => {
        AudioManager.playButtonSound();
        fn();
      });
      this.container.addChild(c);
    };

    mk(W * 0.24, '💣', '消除', () => {
      this.onEliminateBottomRandom();
    });
    mk(W * 0.76, '🔁', '打乱', () => {
      this.layoutFruitCluster();
      const api = typeof wx !== 'undefined' ? wx : null;
      api?.showToast?.({ title: '已打乱', icon: 'none' });
    });
  }

  /** 随机消除某一列最底一颗（与点击规则一致） */
  private onEliminateBottomRandom(): void {
    const cols = this.columns.map((stack, c) => ({ c, stack })).filter(({ stack }) => stack.length > 0);
    if (cols.length === 0) {
      const api = typeof wx !== 'undefined' ? wx : null;
      api?.showToast?.({ title: '暂无可消除', icon: 'none' });
      return;
    }
    const pick = cols[Math.floor(Math.random() * cols.length)];
    this.tapColumn(pick.c);
  }

  private layoutFruitCluster(): void {
    for (const e of this.pipeStack) {
      this.pipeStackLayer.removeChild(e.node);
      e.node.destroy({ children: true });
    }
    this.pipeStack.length = 0;

    for (let c = 0; c < FruitSliceScene.FRUIT_COLS; c += 1) {
      this.columns[c].length = 0;
    }
    for (const node of this.fruitNodes) {
      this.fruitLayer.removeChild(node);
      node.destroy({ children: true });
    }
    this.fruitNodes = [];

    const W = Game.logicWidth;
    const fruitTop = this.fruitTopY;
    const fruitBottom = this.fruitBottomY;

    const pool: FruitConfig[] = [];
    const sliceConfigs = FRUIT_CONFIGS.filter((f) => FRUIT_SLICE_ID_SET.has(f.id));
    for (const f of sliceConfigs) {
      pool.push(f, f);
    }
    this.shuffleInPlace(pool);
    const count = Math.min(20, pool.length);

    const cols = FruitSliceScene.FRUIT_COLS;
    const rows = 4;
    const padX = 36;
    const padY = 6;
    const cellW = (W - padX * 2) / Math.max(1, cols - 1);
    const cellH = (fruitBottom - fruitTop - padY * 2) / Math.max(1, rows - 1);

    for (let i = 0; i < count; i += 1) {
      const f = pool[i];
      const tex = TextureCache.get(fruitSliceWholeTextureKey(f.id));
      const col = i % cols;
      const row = Math.floor(i / cols);
      const jitterX = (Math.random() - 0.5) * 10;
      const jitterY = (Math.random() - 0.5) * 8;
      const x = padX + col * cellW + jitterX;
      let y = fruitTop + padY + row * cellH + jitterY;
      y = Math.min(Math.max(y, fruitTop + padY + 4), fruitBottom - padY - 4);

      const wrap = new PIXI.Container() as FruitSliceNode;
      wrap.fruitId = f.id;
      if (tex) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const target = 68 + Math.random() * 24;
        const s = target / Math.max(sp.width, sp.height);
        sp.scale.set(s);
        wrap.addChild(sp);
      } else {
        const g = new PIXI.Graphics();
        g.beginFill(f.color);
        g.drawCircle(0, 0, 30);
        g.endFill();
        wrap.addChild(g);
      }

      wrap.position.set(x, y);
      wrap.rotation = (Math.random() - 0.5) * 0.35;
      wrap.zIndex = Math.round(y);
      this.fruitLayer.addChild(wrap);
      this.fruitNodes.push(wrap);
      this.columns[col].push(wrap);
    }

    this.refreshFruitClickable();
  }

  private refreshFruitClickable(): void {
    for (let c = 0; c < FruitSliceScene.FRUIT_COLS; c += 1) {
      const stack = this.columns[c];
      for (let r = 0; r < stack.length; r += 1) {
        const node = stack[r];
        const bottom = r === stack.length - 1;
        node.off('pointertap');
        if (bottom) {
          node.eventMode = 'static';
          node.cursor = 'pointer';
          node.hitArea = new PIXI.Circle(0, 0, 46);
          node.on('pointertap', () => {
            this.tapColumn(c);
          });
        } else {
          node.eventMode = 'none';
          node.cursor = 'default';
          node.hitArea = null;
        }
      }
    }
  }

  private tapColumn(col: number): void {
    const stack = this.columns[col];
    if (stack.length === 0) {
      return;
    }
    const node = stack.pop() as FruitSliceNode;
    node.off('pointertap');
    node.eventMode = 'none';

    const idx = this.fruitNodes.indexOf(node);
    if (idx >= 0) {
      this.fruitNodes.splice(idx, 1);
    }

    this.remaining = Math.max(0, this.remaining - 1);
    this.remainingLabel.text = String(this.remaining);
    const pct = Math.min(100, Math.round(((174 - this.remaining) / 174) * 100));
    this.percentLabel.text = `${pct}%`;

    this.refreshFruitClickable();

    const fruitId = node.fruitId;
    this.animateFruitIntoPipe(node, col, () => {
      this.onFruitLandedInPipe(node, fruitId);
    });
  }

  /** 落入管道：与栈顶同类则两颗一起消失，否则叠在栈顶 */
  private onFruitLandedInPipe(node: FruitSliceNode, fruitId: FruitId): void {
    this.fruitLayer.removeChild(node);

    const top = this.pipeStack.length > 0 ? this.pipeStack[this.pipeStack.length - 1] : null;
    if (top && top.fruitId === fruitId) {
      this.pipeStackLayer.removeChild(top.node);
      top.node.destroy({ children: true });
      this.pipeStack.pop();
      this.pipeStackLayer.removeChild(node);
      node.destroy({ children: true });
      return;
    }

    this.pipeStackLayer.addChild(node);
    const stackIndex = this.pipeStack.length;
    const x = this.pipeStackCenterX();
    const y = this.pipeStackY(stackIndex);
    node.position.set(x, y);
    node.rotation = 0;
    const sc = Math.min(node.scale.x, node.scale.y) * 0.88;
    node.scale.set(sc);
    node.zIndex = 10000 + stackIndex;
    this.pipeStack.push({ node, fruitId });
  }

  private pipeStackCenterX(): number {
    return Game.logicWidth / 2;
  }

  /** 管道内第 i 颗（0 为最底）的 Y */
  private pipeStackY(stackIndex: number): number {
    const base = this.cliffBottomY - 48;
    const step = 32;
    return base - stackIndex * step;
  }

  private animateFruitIntoPipe(node: PIXI.Container, col: number, done: () => void): void {
    const W = Game.logicWidth;
    const startX = node.x;
    const startY = node.y;
    const targetX = W / 2 + (col - 2) * 6;
    const targetY = this.pipeStackY(Math.max(0, this.pipeStack.length)) - 8;
    const duration = 0.45;
    let elapsed = 0;
    const sx = node.scale.x;
    const sy = node.scale.y;
    const startRot = node.rotation;

    node.zIndex = 200000;

    const tick = (): void => {
      elapsed += Game.ticker.deltaMS / 1000;
      const p = Math.min(elapsed / duration, 1);
      const e = 1 - (1 - p) * (1 - p);
      node.x = startX + (targetX - startX) * e;
      node.y = startY + (targetY - startY) * e + Math.sin(p * Math.PI) * 22;
      const sc = sx * (1 - 0.12 * p);
      node.scale.set(sc, sc * (sy / sx));
      node.rotation = startRot + Math.sin(p * Math.PI) * 0.45;
      if (p >= 1) {
        Game.ticker.remove(tick);
        done();
      }
    };
    Game.ticker.add(tick);
  }

  private shuffleInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
