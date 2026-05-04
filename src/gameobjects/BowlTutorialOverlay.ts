import * as PIXI from 'pixi.js';

import { BOWL_IMAGES_ROOT } from '@/config/bowlAssets';

export const BOWL_TUTORIAL_HAND_TEXTURE_KEY = 'bowl_tutorial_hand';
export const BOWL_TUTORIAL_HAND_ASSET = `${BOWL_IMAGES_ROOT}/tutorial_hand.png`;

/** 高亮目标形状：圆（用于碗内水果）或圆角矩形（用于订单气泡）。 */
export type TutorialHighlight =
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'rect'; cx: number; cy: number; w: number; h: number; cornerR: number };

/** 手指接近方向：'down' 表示从右上向下点，'up' 表示从右下向上点（适合屏幕顶部目标）。 */
export type TutorialHandFacing = 'down' | 'up';

/**
 * 第一关新手引导：半透明暗化遮罩在目标位置开洞高亮，并显示一只手 + 文案。
 *
 * - 默认 `eventMode='none'` 不拦截点击；调用 `enableTapCatcher(handler)` 可临时开启全屏点击捕获，
 *   用于「点击任意处继续」类提示步骤。
 * - 通过 `setHighlight(...)` 切换圆 / 圆角矩形高亮；`setHandFacing(...)` 切换手指朝向。
 */
export class BowlTutorialOverlay extends PIXI.Container {
  private readonly stageW: number;
  private readonly stageH: number;
  private readonly tapCatcher: PIXI.Graphics;
  private readonly dimMask: PIXI.Graphics;
  private readonly highlightRing: PIXI.Graphics;
  private readonly hand: PIXI.Sprite;
  private readonly captionBg: PIXI.Graphics;
  private readonly captionText: PIXI.Text;

  private highlight: TutorialHighlight = { kind: 'circle', cx: 0, cy: 0, r: 56 };
  private facing: TutorialHandFacing = 'down';
  private animTime = 0;
  private dirty = true;
  /** 手指基础缩放（按贴图最大边匹配 124px），脉动动画在此基础上叠加 */
  private handBaseScale = 1;
  private tapHandler: (() => void) | null = null;

  constructor(width: number, height: number, handTexture?: PIXI.Texture | null) {
    super();
    this.stageW = width;
    this.stageH = height;
    this.visible = false;
    this.eventMode = 'passive';

    /** 全屏点击捕获层；默认 eventMode=none，仅在 enableTapCatcher 时启用 */
    this.tapCatcher = new PIXI.Graphics();
    this.tapCatcher.beginFill(0x000000, 0.001);
    this.tapCatcher.drawRect(0, 0, width, height);
    this.tapCatcher.endFill();
    this.tapCatcher.eventMode = 'none';
    this.tapCatcher.cursor = 'pointer';
    this.tapCatcher.on('pointertap', () => {
      const handler = this.tapHandler;
      if (handler) {
        handler();
      }
    });
    this.addChild(this.tapCatcher);

    this.dimMask = new PIXI.Graphics();
    this.dimMask.eventMode = 'none';
    this.addChild(this.dimMask);

    this.highlightRing = new PIXI.Graphics();
    this.highlightRing.eventMode = 'none';
    this.addChild(this.highlightRing);

    this.hand = new PIXI.Sprite(handTexture ?? PIXI.Texture.EMPTY);
    /** 指尖大约位于贴图左下区域；锚点压在指尖处，便于贴住目标 */
    this.hand.anchor.set(0.22, 0.62);
    this.hand.eventMode = 'none';
    this.applyHandTextureScale();
    this.addChild(this.hand);

    this.captionBg = new PIXI.Graphics();
    this.captionBg.eventMode = 'none';
    this.addChild(this.captionBg);

    this.captionText = new PIXI.Text('', {
      fontSize: 22,
      fill: 0xfff7df,
      fontWeight: '800',
      align: 'center',
      stroke: 0x4b2e19,
      strokeThickness: 4,
      wordWrap: true,
      wordWrapWidth: Math.min(width - 80, 540),
    });
    this.captionText.anchor.set(0.5);
    this.addChild(this.captionText);
  }

  /** 资源延迟加载完成后写入手指贴图，并按目标尺寸适配 */
  setHandTexture(texture: PIXI.Texture | null | undefined): void {
    if (!texture) {
      return;
    }
    this.hand.texture = texture;
    this.applyHandTextureScale();
  }

  private applyHandTextureScale(): void {
    const tex = this.hand.texture;
    if (!tex || tex.width <= 0 || tex.height <= 0) {
      return;
    }
    const targetSide = 124;
    const max = Math.max(tex.width, tex.height);
    this.handBaseScale = targetSide / max;
    this.hand.scale.set(this.handBaseScale);
  }

  /** 设置文案；为空时隐藏文案 */
  setCaption(text: string): void {
    if (!text) {
      this.captionText.visible = false;
      this.captionBg.visible = false;
      return;
    }
    this.captionText.visible = true;
    this.captionBg.visible = true;
    if (this.captionText.text !== text) {
      this.captionText.text = text;
    }
    this.dirty = true;
  }

  /** 设置当前高亮形状（场景容器坐标空间） */
  setHighlight(highlight: TutorialHighlight): void {
    this.highlight = highlight;
    this.dirty = true;
  }

  /** 切换手指朝向；底部目标用 'down'（默认），屏幕顶部目标用 'up' */
  setHandFacing(facing: TutorialHandFacing): void {
    if (this.facing === facing) {
      return;
    }
    this.facing = facing;
    this.hand.rotation = facing === 'up' ? Math.PI : 0;
    this.dirty = true;
  }

  /** 开 / 关「点击任意处继续」捕获层；handler=null 关闭并恢复非阻挡 */
  enableTapCatcher(handler: (() => void) | null): void {
    this.tapHandler = handler;
    if (handler) {
      this.tapCatcher.eventMode = 'static';
      this.tapCatcher.hitArea = new PIXI.Rectangle(0, 0, this.stageW, this.stageH);
    } else {
      this.tapCatcher.eventMode = 'none';
      this.tapCatcher.hitArea = null as unknown as PIXI.IHitArea;
    }
  }

  show(): void {
    this.visible = true;
    this.animTime = 0;
    this.dirty = true;
    this.redraw();
  }

  hide(): void {
    this.visible = false;
    this.enableTapCatcher(null);
  }

  update(dt: number): void {
    if (!this.visible) {
      return;
    }
    this.animTime += dt;
    const tapPulse = (Math.sin(this.animTime * 4.2) + 1) * 0.5;
    /** 指尖轻点：脉冲时手略微推近目标 + 略放大 */
    const targetScale = this.handBaseScale * (1 + tapPulse * 0.06);
    if (Math.abs(this.hand.scale.x - targetScale) > 0.001) {
      this.hand.scale.set(targetScale);
    }
    this.layoutHand(tapPulse);

    const breath = (Math.sin(this.animTime * 3.0) + 1) * 0.5;
    this.highlightRing.alpha = 0.55 + breath * 0.35;
    if (this.dirty) {
      this.redraw();
    }
  }

  private layoutHand(tapPulse: number): void {
    const center = this.highlightCenter();
    /** 指尖目标点：圆 → 偏目标内侧；矩形 → 顶部订单从左下外侧指入，避免手掌遮住订单内容 */
    let targetX = center.x;
    let targetY = center.y;
    if (this.highlight.kind === 'circle') {
      const r = this.highlight.r;
      const reach = -tapPulse * 4;
      if (this.facing === 'down') {
        targetX = center.x + r * 0.18;
        targetY = center.y + r * 0.16 + reach;
      } else {
        targetX = center.x + r * 0.18;
        targetY = center.y - r * 0.16 - reach;
      }
    } else {
      const halfW = this.highlight.w / 2;
      const halfH = this.highlight.h / 2;
      const reach = -tapPulse * 4;
      if (this.facing === 'down') {
        targetX = center.x + halfW * 0.45;
        targetY = center.y + halfH * 0.55 + reach;
      } else {
        targetX = center.x - halfW - 18;
        targetY = center.y + halfH + 22 - reach;
      }
    }
    this.hand.position.set(targetX, targetY);
  }

  private highlightCenter(): { x: number; y: number } {
    return { x: this.highlight.cx, y: this.highlight.cy };
  }

  private redraw(): void {
    this.dirty = false;

    this.dimMask.clear();
    this.dimMask.beginFill(0x000000, 0.55);
    this.dimMask.drawRect(0, 0, this.stageW, this.stageH);
    this.dimMask.beginHole();
    if (this.highlight.kind === 'circle') {
      this.dimMask.drawCircle(this.highlight.cx, this.highlight.cy, this.highlight.r * 0.94);
    } else {
      this.dimMask.drawRoundedRect(
        this.highlight.cx - this.highlight.w / 2,
        this.highlight.cy - this.highlight.h / 2,
        this.highlight.w,
        this.highlight.h,
        this.highlight.cornerR,
      );
    }
    this.dimMask.endHole();
    this.dimMask.endFill();

    this.highlightRing.clear();
    if (this.highlight.kind === 'circle') {
      this.highlightRing.lineStyle(4, 0xfff3b8, 0.95);
      this.highlightRing.drawCircle(this.highlight.cx, this.highlight.cy, this.highlight.r * 1.04);
      this.highlightRing.lineStyle(2, 0xffffff, 0.7);
      this.highlightRing.drawCircle(this.highlight.cx, this.highlight.cy, this.highlight.r * 1.18);
    } else {
      const x = this.highlight.cx - this.highlight.w / 2;
      const y = this.highlight.cy - this.highlight.h / 2;
      this.highlightRing.lineStyle(4, 0xfff3b8, 0.95);
      this.highlightRing.drawRoundedRect(
        x - 2,
        y - 2,
        this.highlight.w + 4,
        this.highlight.h + 4,
        this.highlight.cornerR + 2,
      );
      this.highlightRing.lineStyle(2, 0xffffff, 0.7);
      this.highlightRing.drawRoundedRect(
        x - 8,
        y - 8,
        this.highlight.w + 16,
        this.highlight.h + 16,
        this.highlight.cornerR + 6,
      );
    }

    /** show() 触发 redraw 时手指还未跑过 update，此处先放一次稳态位置避免闪到 (0,0) */
    this.layoutHand(0);
    this.layoutCaption();
  }

  private layoutCaption(): void {
    if (!this.captionText.visible) {
      return;
    }
    const padX = 22;
    const padY = 10;
    const w = Math.ceil(this.captionText.width) + padX * 2;
    const h = Math.ceil(this.captionText.height) + padY * 2;
    /** 'down'：高亮下方放文案；'up'：高亮下方仍可放（屏幕顶部目标也有空间） */
    const halfH =
      this.highlight.kind === 'circle' ? this.highlight.r : this.highlight.h / 2;
    const cx = Math.max(w / 2 + 16, Math.min(this.stageW - w / 2 - 16, this.highlight.cx));
    const cyBelow = this.highlight.cy + halfH + 96;
    const cyAbove = this.highlight.cy - halfH - 64;
    /** 优先放下方；若超出屏幕则放上方 */
    const cy = cyBelow + h / 2 < this.stageH - 24
      ? cyBelow
      : Math.max(h / 2 + 16, cyAbove);
    this.captionText.position.set(cx, cy);
    this.captionBg.clear();
    this.captionBg.beginFill(0x2b1a12, 0.62);
    this.captionBg.drawRoundedRect(cx - w / 2, cy - h / 2, w, h, h / 2);
    this.captionBg.endFill();
  }
}
