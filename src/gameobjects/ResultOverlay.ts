import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';

export interface ResultOverlayOptions {
  title: string;
  desc: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/**
 * 过关 / 通关 / 失败 共用弹层，由 BowlScene 传入文案与回调。
 */
export class ResultOverlay extends PIXI.Container {
  private readonly maskGfx: PIXI.Graphics;
  private readonly panel: PIXI.Graphics;
  private readonly titleText: PIXI.Text;
  private readonly descText: PIXI.Text;
  private readonly primaryBtn: PIXI.Graphics;
  private readonly primaryLabel: PIXI.Text;
  private readonly secondaryBtn: PIXI.Graphics;
  private readonly secondaryLabel: PIXI.Text;

  private onPrimary: () => void = () => {};
  private onSecondary: () => void = () => {};

  constructor(width: number, height: number) {
    super();
    this.visible = false;
    this.eventMode = 'static';

    this.maskGfx = new PIXI.Graphics();
    this.maskGfx.beginFill(0x000000, 0.45);
    this.maskGfx.drawRect(0, 0, width, height);
    this.maskGfx.endFill();
    this.addChild(this.maskGfx);

    this.panel = new PIXI.Graphics();
    this.panel.beginFill(0xfff6e7, 1);
    this.panel.drawRoundedRect(0, 0, 420, 280, 32);
    this.panel.endFill();
    this.panel.beginFill(0x5a3d2b, 1);
    this.panel.drawRoundedRect(18, 18, 384, 244, 26);
    this.panel.endFill();
    this.panel.position.set((width - 420) / 2, height / 2 - 190);
    this.addChild(this.panel);

    this.titleText = new PIXI.Text('', {
      fontSize: 36,
      fill: 0xfff4de,
      fontWeight: '700',
    });
    this.titleText.anchor.set(0.5, 0);
    this.titleText.position.set(width / 2, height / 2 - 135);
    this.titleText.eventMode = 'none';
    this.addChild(this.titleText);

    this.descText = new PIXI.Text('', {
      fontSize: 22,
      fill: 0xffd9b3,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: width * 0.72,
    });
    this.descText.anchor.set(0.5, 0);
    this.descText.position.set(width / 2, height / 2 - 72);
    this.descText.eventMode = 'none';
    this.addChild(this.descText);

    this.primaryBtn = new PIXI.Graphics();
    this.primaryBtn.beginFill(0xf0a843);
    this.primaryBtn.drawRoundedRect(0, 0, 220, 64, 32);
    this.primaryBtn.endFill();
    this.primaryBtn.position.set((width - 220) / 2, height / 2 + 8);
    this.primaryBtn.eventMode = 'static';
    this.primaryBtn.cursor = 'pointer';
    this.primaryBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.onPrimary();
    });
    this.addChild(this.primaryBtn);

    this.primaryLabel = new PIXI.Text('', {
      fontSize: 28,
      fill: 0xffffff,
      fontWeight: '700',
    });
    this.primaryLabel.anchor.set(0.5);
    this.primaryLabel.position.set(width / 2, height / 2 + 40);
    this.primaryLabel.eventMode = 'none';
    this.addChild(this.primaryLabel);

    this.secondaryBtn = new PIXI.Graphics();
    this.secondaryBtn.lineStyle(3, 0xf0a843, 1);
    this.secondaryBtn.beginFill(0x5a3d2b, 1);
    this.secondaryBtn.drawRoundedRect(0, 0, 200, 52, 26);
    this.secondaryBtn.endFill();
    this.secondaryBtn.position.set((width - 200) / 2, height / 2 + 88);
    this.secondaryBtn.eventMode = 'static';
    this.secondaryBtn.cursor = 'pointer';
    this.secondaryBtn.visible = false;
    this.secondaryBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.onSecondary();
    });
    this.addChild(this.secondaryBtn);

    this.secondaryLabel = new PIXI.Text('', {
      fontSize: 24,
      fill: 0xf0a843,
      fontWeight: '700',
    });
    this.secondaryLabel.anchor.set(0.5);
    this.secondaryLabel.position.set(width / 2, height / 2 + 114);
    this.secondaryLabel.visible = false;
    this.secondaryLabel.eventMode = 'none';
    this.addChild(this.secondaryLabel);
  }

  showOptions(options: ResultOverlayOptions): void {
    this.titleText.text = options.title;
    this.descText.text = options.desc;
    this.primaryLabel.text = options.primaryLabel;
    this.onPrimary = options.onPrimary;

    if (options.secondaryLabel && options.onSecondary) {
      this.secondaryLabel.text = options.secondaryLabel;
      this.secondaryLabel.visible = true;
      this.secondaryBtn.visible = true;
      this.onSecondary = options.onSecondary;
    } else {
      this.secondaryLabel.visible = false;
      this.secondaryBtn.visible = false;
      this.onSecondary = () => {};
    }

    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }
}
