import * as PIXI from 'pixi.js';
import { GACHA_PULL_COST, GACHA_REWARD_POOL, type GachaReward } from '@/config/economy';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { pullGachaOnce, type GachaPullResult } from '@/game/GachaState';
import { getCoinBalance } from '@/game/Wallet';
import {
  CoinBar,
  COIN_ICON_TEXTURE_KEY,
  COIN_ICON_TEXTURE_PATH,
  createCoinIcon,
} from '@/gameobjects/CoinBar';
import { TextureCache } from '@/utils/TextureCache';

const GACHA_MACHINE_TEXTURE_KEY = 'gacha_machine';
const GACHA_MACHINE_TEXTURE_PATH = 'assets/images/gacha/gacha_machine.png';

/** 玻璃球区域中心相对扭蛋机左上的归一化位置（按原图视觉手测）。 */
const DOME_CENTER_NX = 0.50;
const DOME_CENTER_NY = 0.36;
/** 出蛋口中心相对扭蛋机左上的归一化位置。 */
const EGG_SLOT_NX = 0.46;
const EGG_SLOT_NY = 0.81;

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
  private readonly machineRoot = new PIXI.Container();
  private readonly machineSprite = new PIXI.Sprite();
  private readonly machineFallback = new PIXI.Graphics();
  /** 围绕玻璃球的旋转金光（idle 慢转，抽奖时加速） */
  private readonly domeAuraRoot = new PIXI.Container();
  private readonly domeRays = new PIXI.Container();
  private readonly domeRingRays = new PIXI.Container();
  /** 玻璃球上方点缀的闪烁星星 */
  private readonly domeSparkles: Array<{ node: PIXI.Graphics; phase: number }> = [];
  /** 抽奖按钮：药丸 + 居中文字 + 右侧金币 N */
  private readonly pullButtonRoot = new PIXI.Container();
  private readonly pullButtonBg = new PIXI.Graphics();
  private readonly pullButtonLabel: PIXI.Text;
  private readonly pullButtonCostText: PIXI.Text;
  private readonly pullHintText: PIXI.Text;
  private readonly coinBar = new CoinBar();
  private readonly resultLayer = new PIXI.Container();
  private readonly tick = (delta: number): void => this.updateAnimation(delta);
  private animationTime = 0;
  /** 抽奖整体阶段：idle / shake / drop / result */
  private phase: 'idle' | 'shake' | 'drop' | 'result' = 'idle';
  private phaseElapsed = 0;
  /** 当前 shake/drop 暂存的抽奖结果，drop 收尾时 commit 到 result 弹层。 */
  private pendingResult: GachaPullResult | null = null;

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

    this.pullHintText = new PIXI.Text('金币来自果切挑战返利', {
      fontSize: 22,
      fill: 0x9c5a24,
      fontWeight: '900',
      stroke: 0xfff1d0,
      strokeThickness: 3,
      lineJoin: 'round',
    });
    this.pullHintText.anchor.set(0.5);
    this.pullHintText.resolution = 2;

    void TextureCache.load(COIN_ICON_TEXTURE_KEY, COIN_ICON_TEXTURE_PATH).then(() => {
      this.coinBar.refreshIcon();
    });
    void TextureCache.load(GACHA_MACHINE_TEXTURE_KEY, GACHA_MACHINE_TEXTURE_PATH).then((tex) => {
      this.applyMachineTexture(tex);
    });
    this.build();
  }

  onEnter(): void {
    AudioManager.useDefaultBackgroundMusic();
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
    this.clearResultLayer();
  }

  /** Scene 接口的 update 由 SceneManager 调用，但本场景动画使用 PIXI ticker，避免依赖。 */
  update(_dt: number): void {}

  private build(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const top = Game.safeTop;

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
    this.container.addChild(this.bgRoot);

    const back = this.createPillButton(78, top + 58, 112, 54, '返回', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('home');
    });
    this.container.addChild(back);

    const title = new PIXI.Text('金币扭蛋', {
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
    title.anchor.set(0.5);
    title.position.set(W / 2, top + 58);
    title.resolution = 2;
    this.container.addChild(title);

    this.coinBar.position.set(W - 160, top + 36);
    this.container.addChild(this.coinBar);

    const machineCenterY = H * 0.46;
    this.machineRoot.position.set(W / 2, machineCenterY);
    this.machineSprite.anchor.set(0.5);
    this.machineRoot.addChild(this.machineSprite);
    this.drawMachineFallback();
    this.machineRoot.addChild(this.machineFallback);
    this.container.addChild(this.machineRoot);

    this.domeAuraRoot.position.set(0, 0);
    this.domeRays.addChild(this.buildRays(20, 90, 230, 0xffe27a, 0.32));
    this.domeRingRays.addChild(this.buildRays(14, 116, 188, 0xffffff, 0.16));
    this.domeRingRays.rotation = Math.PI / 14;
    this.domeAuraRoot.addChild(this.domeRays);
    this.domeAuraRoot.addChild(this.domeRingRays);
    this.machineRoot.addChildAt(this.domeAuraRoot, 0);
    this.mountDomeSparkles();

    const buttonY = Math.max(machineCenterY + 380, H - 220);
    this.layoutPullButton(W / 2, buttonY, Math.min(380, W * 0.72), 86);
    this.container.addChild(this.pullButtonRoot);

    this.pullHintText.position.set(W / 2, buttonY + 64);
    this.container.addChild(this.pullHintText);

    this.container.addChild(this.resultLayer);
  }

  /** 抽奖按钮：药丸 + 文字 + 右侧金币 N。 */
  private layoutPullButton(x: number, y: number, width: number, height: number): void {
    this.pullButtonRoot.position.set(x, y);
    this.pullButtonRoot.eventMode = 'static';
    this.pullButtonRoot.cursor = 'pointer';
    this.pullButtonRoot.hitArea = new PIXI.Rectangle(-width / 2, -height / 2, width, height);
    this.drawPullButtonBg(width, height);
    this.pullButtonRoot.addChild(this.pullButtonBg);
    this.pullButtonLabel.position.set(-26, -2);
    this.pullButtonRoot.addChild(this.pullButtonLabel);
    const coin = createCoinIcon(18);
    coin.position.set(80, 0);
    this.pullButtonRoot.addChild(coin);
    this.pullButtonCostText.position.set(98, 0);
    this.pullButtonRoot.addChild(this.pullButtonCostText);
    this.pullButtonRoot.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.handlePullTap();
    });
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

  /** 贴图加载完成后替换扭蛋机，并按目标显示尺寸缩放。 */
  private applyMachineTexture(tex: PIXI.Texture | null): void {
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return;
    }
    this.machineSprite.texture = tex;
    const targetH = Math.min(560, Game.logicHeight * 0.5);
    const scale = targetH / tex.height;
    this.machineSprite.scale.set(scale);
    this.machineFallback.visible = false;
    this.repositionDomeAura();
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

  /** 玻璃球光环和闪星按贴图的真实尺寸重新定位到玻璃球中心。 */
  private repositionDomeAura(): void {
    const tex = this.machineSprite.texture;
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return;
    }
    const sx = this.machineSprite.scale.x;
    const sy = this.machineSprite.scale.y;
    const wPx = tex.width * sx;
    const hPx = tex.height * sy;
    const domeX = (DOME_CENTER_NX - 0.5) * wPx;
    const domeY = (DOME_CENTER_NY - 0.5) * hPx;
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
  }

  /** 出蛋口在世界（machineRoot 子坐标）中的近似位置，用于飞蛋动画起点。 */
  private getEggSlotLocal(): { x: number; y: number } {
    const tex = this.machineSprite.texture;
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return { x: 0, y: 80 };
    }
    const sx = this.machineSprite.scale.x;
    const sy = this.machineSprite.scale.y;
    const wPx = tex.width * sx;
    const hPx = tex.height * sy;
    return {
      x: (EGG_SLOT_NX - 0.5) * wPx,
      y: (EGG_SLOT_NY - 0.5) * hPx,
    };
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
        PIXI.Ticker.shared.remove(tick);
        toast.parent?.removeChild(toast);
        toast.destroy({ children: true });
      }
    };
    PIXI.Ticker.shared.add(tick);
  }

  private startShakePhase(): void {
    this.phase = 'shake';
    this.phaseElapsed = 0;
  }

  private startDropPhase(): void {
    this.phase = 'drop';
    this.phaseElapsed = 0;
    this.machineRoot.rotation = 0;
    this.machineRoot.scale.set(1);
    this.spawnEggBurst();
  }

  /** 从扭蛋机出蛋口位置弹出一颗金蛋，飞到屏幕中央并放大；途中迸发星星。 */
  private spawnEggBurst(): void {
    const slotLocal = this.getEggSlotLocal();
    const startX = this.machineRoot.x + slotLocal.x;
    const startY = this.machineRoot.y + slotLocal.y;
    const targetX = Game.logicWidth / 2;
    const targetY = Game.logicHeight * 0.42;

    const egg = this.createGachaEggIcon(40);
    egg.position.set(startX, startY);
    egg.scale.set(0.6);
    this.resultLayer.addChild(egg);

    let elapsed = 0;
    const duration = 0.85;
    const tick = (delta: number): void => {
      if (egg.destroyed) {
        PIXI.Ticker.shared.remove(tick);
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
        PIXI.Ticker.shared.remove(tick);
        egg.parent?.removeChild(egg);
        egg.destroy({ children: true });
        this.commitResultOverlay();
      }
    };
    PIXI.Ticker.shared.add(tick);
  }

  private commitResultOverlay(): void {
    const result = this.pendingResult;
    this.pendingResult = null;
    this.phase = 'result';
    if (!result || !result.ok || !result.reward) {
      this.phase = 'idle';
      return;
    }
    this.showRewardOverlay(result.reward, result.totalPulls);
  }

  /** 抽奖结果遮罩：参考获得金币弹层风格，遮罩 + 大金蛋 + 旋转金光 + 奖励名 */
  private showRewardOverlay(reward: GachaReward, totalPulls: number): void {
    this.clearResultLayer();
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
    const title = new PIXI.Text(rarityTitle, {
      fontSize: 48,
      fill: 0xfff06a,
      fontWeight: '900',
      stroke: 0x6d2a10,
      strokeThickness: 8,
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

    const egg = this.createGachaEggIcon(96);
    egg.position.set(centerX, centerY);
    root.addChild(egg);

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

    const subLine = new PIXI.Text(`累计抽奖 ${totalPulls} 次`, {
      fontSize: 22,
      fill: 0xfff1d0,
      fontWeight: '900',
      stroke: 0x3b2316,
      strokeThickness: 4,
      lineJoin: 'round',
    });
    subLine.anchor.set(0.5);
    subLine.position.set(centerX, centerY + 210);
    subLine.resolution = 2;
    root.addChild(subLine);

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
    egg.scale.set(0);
    rewardLabel.alpha = 0;
    title.alpha = 0;
    title.y -= 14;
    const localTick = (delta: number): void => {
      if (closing || root.destroyed) {
        PIXI.Ticker.shared.remove(localTick);
        return;
      }
      elapsed += delta / 60;
      const t = elapsed;
      rays.rotation += delta * 0.012;
      ringRays.rotation -= delta * 0.0065;
      const settle = Math.min(1, t * 4);
      egg.scale.set(0.7 * settle + Math.sin(t * 4.6) * 0.05 * settle);
      egg.rotation = Math.sin(t * 3.6) * 0.06;
      const titleSettle = Math.min(1, Math.max(0, (t - 0.05) * 5));
      title.alpha = titleSettle;
      title.y = (centerY - 200) - 14 + titleSettle * 14;
      rewardLabel.alpha = Math.min(1, Math.max(0, (t - 0.22) * 6));
      subLine.alpha = Math.min(1, Math.max(0, (t - 0.35) * 5));
      closeHint.alpha = 0.6 + Math.sin(t * 4.2) * 0.4;
    };
    PIXI.Ticker.shared.add(localTick);

    root.on('pointertap', () => {
      if (closing) {
        return;
      }
      closing = true;
      PIXI.Ticker.shared.remove(localTick);
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

    for (const sp of this.domeSparkles) {
      const phaseSpeed = this.phase === 'shake' ? 12 : 5;
      const pulse = (Math.sin(t * phaseSpeed + sp.phase) + 1) / 2;
      sp.node.alpha = 0.28 + pulse * 0.72;
      sp.node.scale.set(0.65 + pulse * 0.55);
      sp.node.rotation += delta * 0.018;
    }
  }

  /** 顶部「返回」药丸按钮，与游戏内其它二级页一致。 */
  private createPillButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onTap: () => void,
  ): PIXI.Container {
    const root = new PIXI.Container();
    root.position.set(x, y);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-width / 2, -height / 2, width, height);
    const bg = new PIXI.Graphics();
    bg.beginFill(0xff8a4a);
    bg.lineStyle(3, 0xa83a16, 1);
    bg.drawRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    bg.endFill();
    bg.beginFill(0xffd07a, 0.7);
    bg.drawRoundedRect(-width / 2 + 6, -height / 2 + 5, width - 12, height * 0.4, height / 2);
    bg.endFill();
    root.addChild(bg);
    const text = new PIXI.Text(label, {
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0xa83a16,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    text.anchor.set(0.5);
    text.resolution = 2;
    root.addChild(text);
    root.on('pointertap', onTap);
    return root;
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
