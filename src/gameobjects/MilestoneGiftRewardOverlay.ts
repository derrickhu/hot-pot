import * as PIXI from 'pixi.js';
import type { LevelMilestoneGiftDef } from '@/config/levelMilestoneGifts';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import { createCoinIcon } from '@/gameobjects/CoinBar';
import {
  createRewardIconNode,
  getRewardItemShortLabel,
  GACHA_RESULT_TITLE_RIBBON_KEY,
  preloadGachaRewardIconTextures,
} from '@/utils/gachaRewardIcons';
import { TextureCache } from '@/utils/TextureCache';

export interface MilestoneGiftRewardOverlayOptions {
  onClose?: () => void;
}

/** 闯关里程碑礼包领取：视觉对齐扭蛋「恭喜获得」弹层。 */
export class MilestoneGiftRewardOverlay {
  readonly root = new PIXI.Container();

  private readonly transientTickers = new Set<(delta: number) => void>();
  private readonly options: MilestoneGiftRewardOverlayOptions;
  private burstRays: PIXI.Container | null = null;
  private burstRingRays: PIXI.Container | null = null;
  private rewardIconRoot: PIXI.Container | null = null;

  constructor(options: MilestoneGiftRewardOverlayOptions = {}) {
    this.options = options;
    this.root.visible = false;
    this.root.eventMode = 'static';
  }

  static async preload(): Promise<void> {
    await preloadGachaRewardIconTextures();
  }

  show(gift: LevelMilestoneGiftDef): void {
    this.clear();
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const centerX = W / 2;
    const centerY = H * 0.46;
    this.root.visible = true;

    AudioManager.playGachaRewardRevealSound();

    const dim = new PIXI.Graphics();
    dim.beginFill(0x06121b, 0.74);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    dim.eventMode = 'static';
    this.root.addChild(dim);

    const burstRoot = new PIXI.Container();
    burstRoot.position.set(centerX, centerY);
    this.root.addChild(burstRoot);
    this.burstRays = this.buildRays(20, 84, 250, 0xffe27a, 0.42);
    burstRoot.addChild(this.burstRays);
    this.burstRingRays = this.buildRays(14, 110, 200, 0xffffff, 0.22);
    this.burstRingRays.rotation = Math.PI / 14;
    burstRoot.addChild(this.burstRingRays);

    const titleY = centerY - 200;
    const titleTextY = titleY - 10;
    const titleRibbon = this.createTitleRibbon();
    titleRibbon.position.set(centerX, titleY + 2);
    this.root.addChild(titleRibbon);

    const title = new PIXI.Text(gift.overlayTitle, {
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
    this.root.addChild(title);

    const rewardRow = this.createRewardRow(gift, W);
    rewardRow.position.set(centerX, centerY);
    this.root.addChild(rewardRow);
    this.rewardIconRoot = rewardRow;

    const rewardLabel = new PIXI.Text(gift.overlayLabel, {
      fontSize: 40,
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
    rewardLabel.position.set(centerX, centerY + 150);
    rewardLabel.resolution = 2;
    this.root.addChild(rewardLabel);

    const detailParts = [
      ...gift.toolRewards.map((item) => `${getRewardItemShortLabel(item)} x${item.count}`),
      `金币 x${gift.coins}`,
    ];
    const subLine = new PIXI.Text(`包含：${detailParts.join('、')}`, {
      fontSize: 22,
      fill: 0xfff1d0,
      fontWeight: '900',
      stroke: 0x3b2316,
      strokeThickness: 4,
      lineJoin: 'round',
      align: 'center',
      wordWrap: true,
      wordWrapWidth: W - 72,
    });
    subLine.anchor.set(0.5);
    subLine.position.set(centerX, centerY + 204);
    subLine.resolution = 2;
    this.root.addChild(subLine);

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
    this.root.addChild(closeHint);

    let elapsed = 0;
    let closing = false;
    rewardRow.scale.set(0);
    rewardLabel.alpha = 0;
    titleRibbon.alpha = 0;
    title.alpha = 0;
    title.y -= 14;

    const localTick = (delta: number): void => {
      if (closing || this.root.destroyed) {
        this.removeTransientTicker(localTick);
        return;
      }
      elapsed += delta / 60;
      const t = elapsed;
      if (this.burstRays) {
        this.burstRays.rotation += delta * 0.012;
      }
      if (this.burstRingRays) {
        this.burstRingRays.rotation -= delta * 0.0065;
      }
      const settle = Math.min(1, t * 4);
      rewardRow.scale.set(1.0 * settle + Math.sin(t * 4.6) * 0.05 * settle);
      rewardRow.rotation = Math.sin(t * 3.6) * 0.04;
      const titleSettle = Math.min(1, Math.max(0, (t - 0.05) * 5));
      title.alpha = titleSettle;
      titleRibbon.alpha = titleSettle;
      titleRibbon.y = (titleY + 2) - 14 + titleSettle * 14;
      title.y = titleTextY - 14 + titleSettle * 14;
      rewardLabel.alpha = Math.min(1, Math.max(0, (t - 0.22) * 6));
      subLine.alpha = Math.min(1, Math.max(0, (t - 0.35) * 5));
      closeHint.alpha = 0.6 + Math.sin(t * 4.2) * 0.4;
    };
    this.addTransientTicker(localTick);

    const close = (): void => {
      if (closing) {
        return;
      }
      closing = true;
      this.removeTransientTicker(localTick);
      AudioManager.playButtonSound();
      this.hide();
      this.options.onClose?.();
    };

    this.root.on('pointertap', close);
  }

  hide(): void {
    this.clear();
    this.root.visible = false;
  }

  destroy(): void {
    for (const tick of this.transientTickers) {
      PIXI.Ticker.shared.remove(tick);
    }
    this.transientTickers.clear();
    this.clear();
    this.root.destroy({ children: true });
  }

  private clear(): void {
    for (const tick of this.transientTickers) {
      PIXI.Ticker.shared.remove(tick);
    }
    this.transientTickers.clear();
    this.burstRays = null;
    this.burstRingRays = null;
    this.rewardIconRoot = null;
    this.root.removeAllListeners();
    while (this.root.children.length > 0) {
      const child = this.root.children[0]!;
      this.root.removeChild(child);
      child.destroy({ children: true });
    }
  }

  private createRewardRow(gift: LevelMilestoneGiftDef, screenW: number): PIXI.Container {
    const root = new PIXI.Container();
    const iconSize = screenW < 360 ? 58 : 68;
    const gap = screenW < 360 ? 10 : 14;
    const slots: Array<
      | { kind: 'bowlTool'; tool: 'addDish' | 'remove' | 'shuffle'; count: number }
      | { kind: 'fruitSliceTool'; tool: 'eliminate' | 'shuffle'; count: number }
      | { kind: 'coins'; count: number }
    > = [...gift.toolRewards, { kind: 'coins', count: gift.coins }];
    const totalW = slots.length * iconSize + (slots.length - 1) * gap;
    let x = -totalW / 2 + iconSize / 2;
    for (const slot of slots) {
      const cell = new PIXI.Container();
      cell.position.set(x, 0);
      const icon = createRewardIconNode(
        slot,
        iconSize,
        () => createCoinIcon(iconSize * 0.9),
      );
      cell.addChild(icon);
      const countLabel = new PIXI.Text(`x${slot.count}`, {
        fontSize: 20,
        fill: 0xfff4c2,
        fontWeight: '900',
        stroke: 0x6d2a10,
        strokeThickness: 4,
        lineJoin: 'round',
      });
      countLabel.anchor.set(0.5);
      countLabel.position.set(0, iconSize * 0.56);
      countLabel.resolution = 2;
      cell.addChild(countLabel);
      root.addChild(cell);
      x += iconSize + gap;
    }
    return root;
  }

  private createTitleRibbon(): PIXI.Container {
    const root = new PIXI.Container();
    const tex = TextureCache.get(GACHA_RESULT_TITLE_RIBBON_KEY);
    if (tex && tex !== PIXI.Texture.EMPTY) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const targetW = Math.min(520, Game.logicWidth * 0.72);
      sp.scale.set(targetW / Math.max(1, tex.width));
      root.addChild(sp);
      return root;
    }
    const fallback = new PIXI.Graphics();
    fallback.beginFill(0xffd95a, 0.95);
    fallback.lineStyle(5, 0x8b3a0c, 1);
    fallback.drawRoundedRect(-210, -40, 420, 80, 32);
    fallback.endFill();
    root.addChild(fallback);
    return root;
  }

  private buildRays(
    count: number,
    innerR: number,
    outerR: number,
    color: number,
    alpha: number,
  ): PIXI.Container {
    const root = new PIXI.Container();
    const g = new PIXI.Graphics();
    for (let i = 0; i < count; i += 1) {
      const a0 = (i / count) * Math.PI * 2;
      const a1 = ((i + 0.45) / count) * Math.PI * 2;
      g.beginFill(color, alpha);
      g.moveTo(Math.cos(a0) * innerR, Math.sin(a0) * innerR);
      g.lineTo(Math.cos(a1) * outerR, Math.sin(a1) * outerR);
      g.lineTo(Math.cos(a0 + 0.08) * outerR * 0.92, Math.sin(a0 + 0.08) * outerR * 0.92);
      g.closePath();
      g.endFill();
    }
    root.addChild(g);
    return root;
  }

  private addTransientTicker(fn: (delta: number) => void): void {
    this.transientTickers.add(fn);
    PIXI.Ticker.shared.add(fn);
  }

  private removeTransientTicker(fn: (delta: number) => void): void {
    this.transientTickers.delete(fn);
    PIXI.Ticker.shared.remove(fn);
  }
}
