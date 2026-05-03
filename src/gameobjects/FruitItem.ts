import * as PIXI from 'pixi.js';
import type { FruitConfig, FruitId } from '@/config/fruits';

export type FruitPhase = 'bowl' | 'buffer' | 'flying';

export class FruitItem extends PIXI.Container {
  readonly fruitId: FruitId;
  readonly display: PIXI.DisplayObject;
  /** 飞向盘子或已结算时为 true，避免重复点击 */
  picked = false;
  /** 仅在碗内漂移时参与物理与叠放排序 */
  phase: FruitPhase = 'bowl';
  /** 在暂存槽内时为槽索引，否则为 null */
  bufferSlotIndex: number | null = null;
  velocityX = 0;
  velocityY = 0;
  bobSeed = Math.random() * Math.PI * 2;
  baseY = 0;
  /** 叠放用，与 y 解耦的小偏置，避免同 y 时 z 序抖动 */
  depthJitter = Math.random() * 0.001;

  constructor(config: FruitConfig, texture?: PIXI.Texture | null) {
    super();
    this.fruitId = config.id;

    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      const ratio = 88 / Math.max(sprite.texture.width || 88, sprite.texture.height || 88);
      sprite.scale.set(ratio);
      this.display = sprite;
    } else {
      const graphic = new PIXI.Graphics();
      graphic.beginFill(0xffffff, 0.16);
      graphic.drawCircle(0, 6, 30);
      graphic.endFill();
      graphic.beginFill(config.color);
      graphic.drawCircle(0, 0, 28);
      graphic.endFill();

      const shine = new PIXI.Graphics();
      shine.beginFill(0xffffff, 0.28);
      shine.drawEllipse(-8, -10, 8, 12);
      shine.endFill();
      graphic.addChild(shine);

      const text = new PIXI.Text(config.label.slice(0, 1), {
        fontSize: 22,
        fill: 0xffffff,
        fontWeight: '700',
      });
      text.anchor.set(0.5);
      graphic.addChild(text);

      this.display = graphic;
    }

    this.addChild(this.display);
    this.eventMode = 'static';
    this.cursor = 'pointer';
  }
}
