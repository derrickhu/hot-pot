import * as PIXI from 'pixi.js';
import { FRUIT_MAP, type FruitId } from '@/config/fruits';

export class OrderPanel extends PIXI.Container {
  private titleText: PIXI.Text;
  private badgeBg: PIXI.Graphics;
  private badgeText: PIXI.Text;
  private progressText: PIXI.Text;

  constructor() {
    super();

    const panel = new PIXI.Graphics();
    panel.beginFill(0x2f2119, 0.85);
    panel.drawRoundedRect(0, 0, 420, 120, 28);
    panel.endFill();
    panel.beginFill(0xf8f0e4, 1);
    panel.drawRoundedRect(12, 12, 396, 96, 22);
    panel.endFill();
    this.addChild(panel);

    this.titleText = new PIXI.Text('当前订单', {
      fontSize: 28,
      fill: 0x5a3d2b,
      fontWeight: '700',
    });
    this.titleText.position.set(26, 18);
    this.addChild(this.titleText);

    this.badgeBg = new PIXI.Graphics();
    this.badgeBg.position.set(26, 58);
    this.addChild(this.badgeBg);

    this.badgeText = new PIXI.Text('', {
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: '700',
    });
    this.badgeText.anchor.set(0.5);
    this.badgeText.position.set(86, 80);
    this.addChild(this.badgeText);

    this.progressText = new PIXI.Text('', {
      fontSize: 28,
      fill: 0x5a3d2b,
      fontWeight: '700',
    });
    this.progressText.position.set(180, 60);
    this.addChild(this.progressText);
  }

  updateOrder(fruitId: FruitId, current: number, target: number): void {
    const fruit = FRUIT_MAP[fruitId];
    this.badgeBg.clear();
    this.badgeBg.lineStyle(2, 0xffffff, 0.35);
    this.badgeBg.beginFill(fruit.color);
    this.badgeBg.drawRoundedRect(0, 0, 120, 44, 22);
    this.badgeBg.endFill();
    this.badgeText.text = fruit.label;
    this.progressText.text = `${current} / ${target}`;
  }
}
