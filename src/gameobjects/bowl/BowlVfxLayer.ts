import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';

export type BowlTapFeedbackKind = 'order' | 'buffer' | 'frozen' | 'invalid';

interface BurstParticle {
  node: PIXI.Graphics;
  dx: number;
  dy: number;
  spin: number;
}

export class BowlVfxLayer extends PIXI.Container {
  private readonly activeTickers = new Set<() => void>();

  constructor() {
    super();
    this.eventMode = 'none';
    this.sortableChildren = true;
  }

  destroy(options?: Parameters<PIXI.Container['destroy']>[0]): void {
    for (const ticker of this.activeTickers) {
      Game.ticker.remove(ticker);
    }
    this.activeTickers.clear();
    super.destroy(options);
  }

  playTapRipple(x: number, y: number, kind: BowlTapFeedbackKind): void {
    const root = new PIXI.Container();
    root.position.set(x, y);
    root.zIndex = kind === 'invalid' ? 30 : 10;
    this.addChild(root);

    const color = kind === 'order' ? 0xfff0a6 : kind === 'frozen' ? 0xbde9ff : kind === 'invalid' ? 0xff7f6e : 0xdaf7ff;
    const ring = new PIXI.Graphics();
    const inner = new PIXI.Graphics();
    const droplets: BurstParticle[] = [];
    root.addChild(ring, inner);

    const dropletCount = kind === 'invalid' ? 4 : 7;
    for (let i = 0; i < dropletCount; i += 1) {
      const a = (Math.PI * 2 * i) / dropletCount + Math.random() * 0.32;
      const d = kind === 'frozen' ? 22 + Math.random() * 18 : 18 + Math.random() * 24;
      const drop = new PIXI.Graphics();
      drop.beginFill(color, kind === 'invalid' ? 0.72 : 0.86);
      drop.drawCircle(0, 0, 3 + Math.random() * 2);
      drop.endFill();
      root.addChild(drop);
      droplets.push({
        node: drop,
        dx: Math.cos(a) * d,
        dy: Math.sin(a) * d * 0.56,
        spin: (Math.random() - 0.5) * 0.14,
      });
    }

    this.animate(0.34, (t) => {
      const grow = this.easeOutCubic(t);
      const fade = 1 - t;
      ring.clear();
      ring.lineStyle(5 * fade, color, 0.72 * fade);
      ring.drawEllipse(0, 0, 18 + grow * 46, 8 + grow * 22);
      inner.clear();
      inner.beginFill(0xffffff, 0.16 * fade);
      inner.drawEllipse(0, 0, 12 + grow * 28, 5 + grow * 12);
      inner.endFill();
      for (const p of droplets) {
        p.node.x = p.dx * grow;
        p.node.y = p.dy * grow - Math.sin(t * Math.PI) * 10;
        p.node.alpha = fade;
        p.node.rotation += p.spin;
        p.node.scale.set(0.75 + grow * 0.45);
      }
    }, () => {
      root.removeFromParent();
      root.destroy({ children: true });
    });
  }

  playPlateHit(x: number, y: number, color = 0xfff0a6): void {
    const root = new PIXI.Container();
    root.position.set(x, y);
    root.zIndex = 40;
    this.addChild(root);

    const flash = new PIXI.Graphics();
    const ring = new PIXI.Graphics();
    root.addChild(flash, ring);

    const sparks = this.buildSparks(root, 8, color, 20, 46);
    this.animate(0.36, (t) => {
      const fade = 1 - t;
      const pop = Math.sin(t * Math.PI);
      flash.clear();
      flash.beginFill(0xffffff, 0.32 * fade);
      flash.drawCircle(0, 0, 18 + pop * 18);
      flash.endFill();
      ring.clear();
      ring.lineStyle(5 * fade, color, 0.9 * fade);
      ring.drawCircle(0, 0, 16 + this.easeOutCubic(t) * 34);
      this.updateSparks(sparks, t);
    }, () => {
      root.removeFromParent();
      root.destroy({ children: true });
    });
  }

  playOrderCompleteBurst(x: number, y: number): void {
    const root = new PIXI.Container();
    root.position.set(x, y);
    root.zIndex = 60;
    this.addChild(root);

    const halo = new PIXI.Graphics();
    const ring = new PIXI.Graphics();
    root.addChild(halo, ring);
    const sparks = this.buildSparks(root, 18, 0xffe16b, 34, 88);

    this.animate(0.62, (t) => {
      const grow = this.easeOutCubic(t);
      const fade = 1 - Math.max(0, (t - 0.18) / 0.82);
      halo.clear();
      halo.beginFill(0xfff4b8, 0.24 * fade);
      halo.drawCircle(0, 0, 36 + grow * 58);
      halo.endFill();
      ring.clear();
      ring.lineStyle(8 * fade, 0xffd856, 0.92 * fade);
      ring.drawCircle(0, 0, 42 + grow * 68);
      ring.lineStyle(3 * fade, 0xffffff, 0.7 * fade);
      ring.drawCircle(0, 0, 26 + grow * 42);
      this.updateSparks(sparks, t);
    }, () => {
      root.removeFromParent();
      root.destroy({ children: true });
    });
  }

  playBufferLand(x: number, y: number): void {
    const root = new PIXI.Container();
    root.position.set(x, y);
    root.zIndex = 20;
    this.addChild(root);

    const glow = new PIXI.Graphics();
    root.addChild(glow);
    this.animate(0.28, (t) => {
      const fade = 1 - t;
      glow.clear();
      glow.lineStyle(4 * fade, 0xdff8ff, 0.76 * fade);
      glow.drawRoundedRect(-34 - t * 8, -20 - t * 4, 68 + t * 16, 40 + t * 8, 14);
      glow.beginFill(0xffffff, 0.16 * fade);
      glow.drawRoundedRect(-28, -16, 56, 32, 12);
      glow.endFill();
    }, () => {
      root.removeFromParent();
      root.destroy({ children: true });
    });
  }

  private buildSparks(root: PIXI.Container, count: number, color: number, minD: number, maxD: number): BurstParticle[] {
    const sparks: BurstParticle[] = [];
    for (let i = 0; i < count; i += 1) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.24;
      const d = minD + Math.random() * (maxD - minD);
      const star = new PIXI.Graphics();
      this.drawDiamond(star, color, 4 + Math.random() * 3);
      root.addChild(star);
      sparks.push({
        node: star,
        dx: Math.cos(a) * d,
        dy: Math.sin(a) * d,
        spin: (Math.random() - 0.5) * 0.22,
      });
    }
    return sparks;
  }

  private updateSparks(sparks: BurstParticle[], t: number): void {
    const move = this.easeOutCubic(t);
    const fade = 1 - Math.max(0, (t - 0.18) / 0.82);
    for (const spark of sparks) {
      spark.node.x = spark.dx * move;
      spark.node.y = spark.dy * move - Math.sin(t * Math.PI) * 12;
      spark.node.alpha = fade;
      spark.node.rotation += spark.spin;
      spark.node.scale.set(0.55 + Math.sin(t * Math.PI) * 0.72);
    }
  }

  private drawDiamond(g: PIXI.Graphics, color: number, r: number): void {
    g.clear();
    g.beginFill(0xffffff, 0.92);
    g.moveTo(0, -r * 1.45);
    g.lineTo(r * 0.45, -r * 0.45);
    g.lineTo(r * 1.45, 0);
    g.lineTo(r * 0.45, r * 0.45);
    g.lineTo(0, r * 1.45);
    g.lineTo(-r * 0.45, r * 0.45);
    g.lineTo(-r * 1.45, 0);
    g.lineTo(-r * 0.45, -r * 0.45);
    g.closePath();
    g.endFill();
    g.beginFill(color, 0.72);
    g.drawCircle(0, 0, r * 0.55);
    g.endFill();
  }

  private animate(durationSec: number, onFrame: (t: number) => void, onDone: () => void): void {
    let elapsed = 0;
    const ticker = () => {
      elapsed += Game.ticker.deltaMS / 1000;
      const t = Math.min(1, elapsed / durationSec);
      onFrame(t);
      if (t >= 1) {
        Game.ticker.remove(ticker);
        this.activeTickers.delete(ticker);
        onDone();
      }
    };
    this.activeTickers.add(ticker);
    Game.ticker.add(ticker);
  }

  private easeOutCubic(t: number): number {
    const x = Math.max(0, Math.min(1, t));
    return 1 - (1 - x) * (1 - x) * (1 - x);
  }
}
