import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import type { BowlBadgeDef } from '@/config/bowlBadges';
import { mountBowlBadgeIcon } from '@/gameobjects/BowlBadgeIcon';

export interface BowlBadgeUnlockOverlayOptions {
  badge: BowlBadgeDef;
  texture: PIXI.Texture | null;
  onClose: () => void;
}

export class BowlBadgeUnlockOverlay extends PIXI.Container {
  private readonly maskGfx: PIXI.Graphics;
  private readonly panelRoot: PIXI.Container;
  private readonly badgeRoot: PIXI.Container;
  private readonly titleText: PIXI.Text;
  private readonly badgeTitle: PIXI.Text;
  private readonly hintText: PIXI.Text;
  private onClose: () => void = () => {};
  private closing = false;

  constructor(w: number, h: number) {
    super();
    this.visible = false;
    this.eventMode = 'static';

    this.maskGfx = new PIXI.Graphics();
    this.maskGfx.beginFill(0x050505, 0.72);
    this.maskGfx.drawRect(0, 0, w, h);
    this.maskGfx.endFill();
    this.maskGfx.eventMode = 'static';
    this.addChild(this.maskGfx);

    this.panelRoot = new PIXI.Container();
    this.panelRoot.position.set(w / 2, Math.round(h * 0.43));
    this.addChild(this.panelRoot);

    this.titleText = new PIXI.Text('新徽章!', {
      fontSize: 46,
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
    this.titleText.anchor.set(0.5);
    this.titleText.position.set(0, -118);
    this.panelRoot.addChild(this.titleText);

    const burst = new PIXI.Graphics();
    for (let i = 0; i < 18; i += 1) {
      const a = (Math.PI * 2 * i) / 18;
      const r1 = 96;
      const r2 = i % 2 === 0 ? 150 : 124;
      burst.lineStyle(6, 0xfff4a6, i % 2 === 0 ? 0.26 : 0.16);
      burst.moveTo(Math.cos(a) * r1, Math.sin(a) * r1 + 18);
      burst.lineTo(Math.cos(a) * r2, Math.sin(a) * r2 + 18);
    }
    this.panelRoot.addChild(burst);

    this.badgeRoot = new PIXI.Container();
    this.badgeRoot.position.set(-96, -58);
    this.panelRoot.addChild(this.badgeRoot);

    this.badgeTitle = new PIXI.Text('', {
      fontSize: 28,
      fill: 0xfff7d4,
      fontWeight: '900',
      stroke: 0x5a2b16,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    this.badgeTitle.anchor.set(0.5, 0);
    this.badgeTitle.position.set(0, 88);
    this.panelRoot.addChild(this.badgeTitle);

    const congrats = new PIXI.Text('恭喜获得', {
      fontSize: 26,
      fill: 0xffffff,
      fontWeight: '800',
      stroke: 0x2b1a12,
      strokeThickness: 4,
    });
    congrats.anchor.set(0.5);
    congrats.position.set(0, 52);
    this.panelRoot.addChild(congrats);

    this.hintText = new PIXI.Text('点击任意处关闭', {
      fontSize: 24,
      fill: 0xfdf1d4,
      fontWeight: '800',
      stroke: 0x3b2316,
      strokeThickness: 4,
    });
    this.hintText.anchor.set(0.5);
    this.hintText.position.set(w / 2, Math.round(h * 0.68));
    this.addChild(this.hintText);

    this.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.close();
    });
  }

  show(options: BowlBadgeUnlockOverlayOptions): void {
    this.onClose = options.onClose;
    this.closing = false;
    mountBowlBadgeIcon(this.badgeRoot, options.badge, options.texture, 192);
    this.badgeTitle.text = options.badge.title;
    this.visible = true;
    AudioManager.playBadgeUnlockSound();
  }

  hide(): void {
    this.visible = false;
  }

  private close(): void {
    if (!this.visible || this.closing) {
      return;
    }
    this.closing = true;
    this.hide();
    this.onClose();
  }
}
