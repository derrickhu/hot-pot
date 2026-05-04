import * as PIXI from 'pixi.js';

import { BOWL_IMAGES_ROOT } from '@/config/bowlAssets';

/**
 * bowl_common_modal_panel.png 九宫格边距（约 1328×646），避免整图非等比拉伸导致圆角/边框/角标水果变形。
 * 若换图后边角仍略糊，可微调四边像素。
 */
const COMMON_MODAL_PANEL_NINE_SLICE = {
  left: 200,
  top: 110,
  right: 200,
  bottom: 110,
} as const;

export const BOWL_COMMON_MODAL_PANEL_TEXTURE_KEY = 'bowl_common_modal_panel';
export const BOWL_COMMON_MODAL_BUTTON_TEXTURE_KEY = 'bowl_common_modal_button';
export const BOWL_COMMON_MODAL_PANEL_ASSET = `${BOWL_IMAGES_ROOT}/bowl_common_modal_panel.png`;
export const BOWL_COMMON_MODAL_BUTTON_ASSET = `${BOWL_IMAGES_ROOT}/bowl_common_modal_button.png`;

export interface BowlMechanicIntroContent {
  /** 顶部标题，例如「新机制：冰块」 */
  title: string;
  /** 主体文本（自动换行） */
  body: string;
  /** 中央展示图：自定义 Container；由调用方组装（可叠水果贴图 + 冰/冻视觉） */
  iconBuilder: () => PIXI.Container;
  /** 底部按钮文案，默认「我知道了」 */
  buttonLabel?: string;
}

/**
 * 首次解锁特殊机制（冰块、冻果等）时弹出的说明面板：
 * 半透明蒙层 + 圆角面板 + 标题 / 图 / 文字 / 确认按钮。
 *
 * 使用流程：
 *   const overlay = new BowlMechanicIntroOverlay(W, H);
 *   container.addChild(overlay);
 *   overlay.show(content, () => { ... });   // 用户点确认后回调
 */
export class BowlMechanicIntroOverlay extends PIXI.Container {
  private readonly dim = new PIXI.Graphics();
  private readonly panel = new PIXI.Container();
  private readonly panelSliceHost = new PIXI.Container();
  private panelNineSlice: PIXI.NineSlicePlane | null = null;
  private readonly panelBg = new PIXI.Graphics();
  private readonly titleText: PIXI.Text;
  private readonly bodyText: PIXI.Text;
  private readonly iconHost = new PIXI.Container();
  private readonly confirmBtn = new PIXI.Container();
  private readonly confirmSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
  private readonly confirmBg = new PIXI.Graphics();
  private readonly confirmLabel: PIXI.Text;

  private widthLogic: number;
  private heightLogic: number;
  private confirmHandler: (() => void) | null = null;

  constructor(width: number, height: number) {
    super();
    this.widthLogic = width;
    this.heightLogic = height;
    this.eventMode = 'static';
    this.visible = false;

    this.dim.eventMode = 'static';
    this.dim.cursor = 'default';
    this.dim.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
    });
    this.addChild(this.dim);

    this.panel.eventMode = 'static';
    this.panel.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
    });
    this.panelSliceHost.eventMode = 'none';
    this.panelSliceHost.visible = false;
    this.panel.addChild(this.panelSliceHost, this.panelBg);

    this.titleText = new PIXI.Text('', {
      fontSize: 36,
      fill: 0xfff7d6,
      fontWeight: '900',
      stroke: 0x6a3210,
      strokeThickness: 5,
      align: 'center',
    });
    this.titleText.anchor.set(0.5, 0);
    this.panel.addChild(this.titleText);

    this.iconHost.eventMode = 'none';
    this.panel.addChild(this.iconHost);

    this.bodyText = new PIXI.Text('', {
      fontSize: 26,
      fill: 0xffffff,
      fontWeight: '600',
      stroke: 0x3a200c,
      strokeThickness: 3,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: Math.max(120, Math.min(width * 0.92, 720) - 92),
      lineHeight: 36,
    });
    this.bodyText.anchor.set(0.5, 0);
    this.panel.addChild(this.bodyText);

    this.confirmLabel = new PIXI.Text('我知道了', {
      fontSize: 30,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x6a3210,
      strokeThickness: 4,
    });
    this.confirmLabel.anchor.set(0.5);

    this.confirmSprite.anchor.set(0.5);
    this.confirmSprite.eventMode = 'none';
    this.confirmSprite.visible = false;
    this.confirmBtn.addChild(this.confirmSprite, this.confirmBg);
    this.confirmBtn.addChild(this.confirmLabel);
    this.confirmBtn.eventMode = 'static';
    this.confirmBtn.cursor = 'pointer';
    this.confirmBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      const h = this.confirmHandler;
      this.hide();
      h?.();
    });
    this.panel.addChild(this.confirmBtn);

    this.addChild(this.panel);
  }

  setSkinTextures(panelTexture?: PIXI.Texture | null, buttonTexture?: PIXI.Texture | null): void {
    if (panelTexture) {
      if (!this.panelNineSlice || this.panelNineSlice.texture !== panelTexture) {
        this.panelNineSlice?.destroy();
        this.panelNineSlice = null;
        this.panelSliceHost.removeChildren();
        const slice = new PIXI.NineSlicePlane(
          panelTexture,
          COMMON_MODAL_PANEL_NINE_SLICE.left,
          COMMON_MODAL_PANEL_NINE_SLICE.top,
          COMMON_MODAL_PANEL_NINE_SLICE.right,
          COMMON_MODAL_PANEL_NINE_SLICE.bottom,
        );
        slice.eventMode = 'none';
        this.panelNineSlice = slice;
        this.panelSliceHost.addChild(slice);
      }
      this.panelSliceHost.visible = true;
    } else {
      this.panelSliceHost.visible = false;
      this.panelNineSlice?.destroy();
      this.panelNineSlice = null;
      this.panelSliceHost.removeChildren();
    }
    if (buttonTexture) {
      this.confirmSprite.texture = buttonTexture;
      this.confirmSprite.visible = true;
    }
  }

  resize(width: number, height: number): void {
    this.widthLogic = width;
    this.heightLogic = height;
    const panelWMax = Math.min(width * 0.92, 720);
    this.bodyText.style.wordWrapWidth = Math.max(120, panelWMax - 92);
  }

  show(content: BowlMechanicIntroContent, onConfirm: () => void): void {
    this.confirmHandler = onConfirm;

    this.titleText.text = content.title;
    this.bodyText.text = content.body;
    this.confirmLabel.text = content.buttonLabel ?? '我知道了';

    this.iconHost.removeChildren();
    const icon = content.iconBuilder();
    this.iconHost.addChild(icon);

    this.redraw();
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
    this.iconHost.removeChildren();
    this.confirmHandler = null;
  }

  private redraw(): void {
    const W = this.widthLogic;
    const H = this.heightLogic;

    this.dim.clear();
    this.dim.beginFill(0x1a1510, 0.62);
    this.dim.drawRect(0, 0, W, H);
    this.dim.endFill();

    /** 主面板最大宽度（逻辑像素）；略放大以免说明贴边或被 nine slice 内侧装饰裁切 */
    const panelW = Math.min(W * 0.92, 720);
    /** 正文距面板左右内边距（双侧）；描边会外扩，留白略大 */
    const bodySideInset = 46;
    const titleH = 52;
    const titleGap = 18;
    const iconH = 132;
    const iconGap = 20;
    const bodyMetrics = this.bodyText.style;
    bodyMetrics.wordWrapWidth = Math.max(120, panelW - bodySideInset * 2);
    const bodyTextHeight = this.bodyText.height;
    const bodyGap = 36;
    const btnH = 76;
    const padTop = 44;
    const padBottom = 52;
    const panelH = padTop + titleH + titleGap + iconH + iconGap + bodyTextHeight + bodyGap + btnH + padBottom;

    if (
      this.panelSliceHost.visible &&
      this.panelNineSlice &&
      this.panelNineSlice.texture.width > 0 &&
      this.panelNineSlice.texture.height > 0
    ) {
      this.panelBg.visible = false;
      const ns = this.panelNineSlice;
      ns.position.set(-panelW / 2, -panelH / 2);
      ns.width = panelW;
      ns.height = panelH;
    } else {
      this.panelBg.visible = true;
      this.panelBg.clear();
      this.panelBg.lineStyle(4, 0xffe89d, 0.95);
      this.panelBg.beginFill(0x6a3a18, 0.96);
      this.panelBg.drawRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 26);
      this.panelBg.endFill();
      this.panelBg.lineStyle(2, 0xffe89d, 0.45);
      this.panelBg.drawRoundedRect(-panelW / 2 + 10, -panelH / 2 + 10, panelW - 20, panelH - 20, 20);
      this.panelBg.lineStyle(0);
    }

    let cursorY = -panelH / 2 + padTop;
    this.titleText.position.set(0, cursorY);
    cursorY += titleH + titleGap;

    this.iconHost.position.set(0, cursorY + iconH / 2);
    cursorY += iconH + iconGap;

    this.bodyText.position.set(0, cursorY);
    cursorY += bodyTextHeight + bodyGap;

    const btnW = Math.min(panelW * 0.6, 320);
    if (this.confirmSprite.visible && this.confirmSprite.texture.width > 0 && this.confirmSprite.texture.height > 0) {
      this.confirmBg.visible = false;
      this.confirmSprite.width = btnW;
      this.confirmSprite.height = btnH;
    } else {
      this.confirmBg.visible = true;
      this.confirmBg.clear();
      this.confirmBg.lineStyle(3, 0x6a3210, 0.6);
      this.confirmBg.beginFill(0xffb24c, 1);
      this.confirmBg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 22);
      this.confirmBg.endFill();
      this.confirmBg.beginFill(0xffd58a, 0.55);
      this.confirmBg.drawRoundedRect(-btnW / 2 + 6, -btnH / 2 + 6, btnW - 12, btnH * 0.42, 18);
      this.confirmBg.endFill();
      this.confirmBg.lineStyle(0);
    }
    this.confirmBtn.position.set(0, cursorY + btnH / 2);

    this.panel.position.set(W / 2, H / 2);
  }
}

/** 在 BowlScene 用：把 PIXI.Texture 包成「图标 Container」，可叠加冰块贴图模拟冻果 */
export function buildIntroIcon(opts: {
  texture: PIXI.Texture | null | undefined;
  withFrost?: boolean;
  frostTexture?: PIXI.Texture | null | undefined;
  fallbackFill?: number;
}): PIXI.Container {
  const wrap = new PIXI.Container();
  const targetSize = 132;
  const fruitSize = targetSize;
  if (opts.texture) {
    const sprite = new PIXI.Sprite(opts.texture);
    sprite.anchor.set(0.5);
    const ratio = fruitSize / Math.max(sprite.texture.width || fruitSize, sprite.texture.height || fruitSize);
    sprite.scale.set(ratio);
    wrap.addChild(sprite);
  } else {
    const g = new PIXI.Graphics();
    g.beginFill(opts.fallbackFill ?? 0x88c7ff, 1);
    g.drawCircle(0, 0, fruitSize / 2);
    g.endFill();
    wrap.addChild(g);
  }

  if (opts.withFrost) {
    const frostTexture = opts.frostTexture;
    if (frostTexture) {
      const frost = new PIXI.Sprite(frostTexture);
      frost.anchor.set(0.5);
      frost.alpha = 0.58;
      const frostSide = targetSize * 1.38;
      const frostMax = Math.max(frost.texture.width || frostSide, frost.texture.height || frostSide);
      frost.scale.set(frostSide / frostMax);
      wrap.addChild(frost);
    }
  }

  return wrap;
}
