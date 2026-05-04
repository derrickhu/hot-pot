import * as PIXI from 'pixi.js';
import type { FruitConfig, FruitId } from '@/config/fruits';

export type FruitPhase = 'bowl' | 'buffer' | 'flying';

export class FruitItem extends PIXI.Container {
  readonly fruitId: FruitId;
  readonly display: PIXI.DisplayObject;
  /** 冻果冰块覆盖层：仅在 frozen=true 时可见；与 display 同生同灭 */
  readonly frostOverlay: PIXI.Container;
  private readonly frostIceSprite: PIXI.Sprite;
  /** 冻果倒计时秒数文本（叠在冰块上）；仅 frozen=true 且 remainingMs>0 时显示 */
  readonly frostTimerText: PIXI.Text;
  /** 飞向盘子或已结算时为 true，避免重复点击 */
  picked = false;
  /** 仅在碗内漂移时参与物理与叠放排序 */
  phase: FruitPhase = 'bowl';
  /** 在暂存槽内时为槽索引，否则为 null */
  bufferSlotIndex: number | null = null;
  /** 下层储备：暂时不可点击，随订单推进逐步浮出。 */
  hiddenReserve = false;
  /**
   * 冻果标记：水果被冻在冰块里，点击会强制进 buffer 并启动倒计时；
   * 倒计时到 0 自动解冻，期间也可被 Shuffle 立即解冻 / Remove 移除。
   */
  frozen = false;
  /** 冻果剩余解冻毫秒；仅在 phase==='buffer' 且 frozen=true 时由 BowlScene 推进 */
  frostRemainingMs = 0;
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

    /** 冻果表现为冰块资源包住水果，默认隐藏，由 BowlScene 在标记冻果时显示。 */
    this.frostOverlay = new PIXI.Container();
    this.frostOverlay.eventMode = 'none';
    this.frostOverlay.visible = false;
    this.frostIceSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this.frostIceSprite.anchor.set(0.5);
    this.frostIceSprite.alpha = 0.58;
    this.frostIceSprite.eventMode = 'none';
    this.frostOverlay.addChild(this.frostIceSprite);
    this.addChild(this.frostOverlay);

    this.frostTimerText = new PIXI.Text('', {
      fontSize: 22,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x1c4d7a,
      strokeThickness: 4,
      align: 'center',
    });
    this.frostTimerText.anchor.set(0.5);
    this.frostTimerText.eventMode = 'none';
    this.frostTimerText.visible = false;
    this.addChild(this.frostTimerText);

    this.eventMode = 'static';
    this.cursor = 'pointer';
  }

  /** 设置冻果覆盖用的冰块贴图；冰块尺寸大于水果，避免水果露在冰块外。 */
  setFrostTexture(texture: PIXI.Texture | null | undefined): void {
    if (!texture) {
      return;
    }
    this.frostIceSprite.texture = texture;
    const targetSide = 132;
    const max = Math.max(texture.width || targetSide, texture.height || targetSide);
    this.frostIceSprite.scale.set(targetSide / max);
  }

  /**
   * 标记 / 取消「冻果」状态。
   * - 传 durationMs > 0 时同时启动倒计时（覆盖之前的剩余时间）；
   * - 解冻时清零倒计时并隐藏文字。
   */
  setFrozen(frozen: boolean, durationMs?: number): void {
    this.frozen = frozen;
    this.frostOverlay.visible = frozen;
    if (!frozen) {
      this.frostRemainingMs = 0;
      this.frostTimerText.visible = false;
      this.frostTimerText.text = '';
    } else if (typeof durationMs === 'number' && durationMs > 0) {
      this.frostRemainingMs = durationMs;
      this.refreshFrostTimerLabel();
    }
  }

  /** 同步刷新倒计时数字显示（按整秒向上取整；剩余 0 时隐藏） */
  refreshFrostTimerLabel(): void {
    if (!this.frozen || this.frostRemainingMs <= 0) {
      this.frostTimerText.visible = false;
      this.frostTimerText.text = '';
      return;
    }
    const sec = Math.max(1, Math.ceil(this.frostRemainingMs / 1000));
    this.frostTimerText.text = String(sec);
    this.frostTimerText.visible = true;
  }
}
