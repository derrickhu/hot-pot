import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';

export interface BowlReviveOverlayOptions {
  onRevive: () => void;
  /** 关闭复活窗后（点 X）：放弃复活 */
  onGiveUp: () => void;
}

/**
 * 失败时复活：清空暂存菜碟，并解锁第三路订单盘（由 BowlScene.performRevive 实现）。
 */
export class BowlReviveOverlay extends PIXI.Container {
  private readonly maskGfx: PIXI.Graphics;
  private readonly panel: PIXI.Graphics;
  private readonly titleText: PIXI.Text;
  private readonly descText: PIXI.Text;
  private readonly freeBtn: PIXI.Container;
  private readonly closeBtn: PIXI.Container;

  private onRevive: () => void = () => {};
  private onGiveUp: () => void = () => {};

  constructor(w: number, h: number) {
    super();
    this.visible = false;
    this.eventMode = 'static';

    this.maskGfx = new PIXI.Graphics();
    this.maskGfx.beginFill(0x000000, 0.55);
    this.maskGfx.drawRect(0, 0, w, h);
    this.maskGfx.endFill();
    this.maskGfx.eventMode = 'static';
    this.maskGfx.on('pointertap', () => {});
    this.addChild(this.maskGfx);

    const pw = Math.min(400, w * 0.88);
    const ph = 248;
    this.panel = new PIXI.Graphics();
    this.panel.beginFill(0xfff6e7, 1);
    this.panel.lineStyle(4, 0x6d4c34, 1);
    this.panel.drawRoundedRect(0, 0, pw, ph, 22);
    this.panel.endFill();
    this.panel.position.set((w - pw) / 2, h * 0.34);
    this.panel.eventMode = 'static';
    this.panel.on('pointertap', (e) => e.stopPropagation());
    this.addChild(this.panel);

    this.titleText = new PIXI.Text('复活', {
      fontSize: 32,
      fill: 0x5a3d2b,
      fontWeight: '800',
    });
    this.titleText.anchor.set(0.5, 0);
    this.titleText.position.set(w / 2, this.panel.y + 22);
    this.addChild(this.titleText);

    this.descText = new PIXI.Text('复活将额外解锁 1 路订单盘，并清空暂存菜碟上的水果', {
      fontSize: 18,
      fill: 0x6f533c,
      align: 'center',
      lineHeight: 26,
      fontWeight: '600',
      wordWrap: true,
      wordWrapWidth: pw - 36,
    });
    this.descText.anchor.set(0.5, 0);
    this.descText.position.set(w / 2, this.panel.y + 72);
    this.addChild(this.descText);

    const mkBtn = (label: string, fill: number, y: number): PIXI.Container => {
      const btn = new PIXI.Container();
      btn.position.set(w / 2, this.panel.y + y);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';
      const g = new PIXI.Graphics();
      g.beginFill(fill);
      g.drawRoundedRect(-150, -26, 300, 52, 26);
      g.endFill();
      btn.addChild(g);
      const t = new PIXI.Text(label, {
        fontSize: 22,
        fill: 0xffffff,
        fontWeight: '700',
      });
      t.anchor.set(0.5);
      btn.addChild(t);
      return btn;
    };

    this.freeBtn = mkBtn('免费复活', 0xe8b44c, ph - 58);
    this.freeBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.onRevive();
    });
    this.addChild(this.freeBtn);

    this.closeBtn = new PIXI.Container();
    this.closeBtn.position.set(this.panel.x + pw - 16, this.panel.y + 12);
    this.closeBtn.eventMode = 'static';
    this.closeBtn.cursor = 'pointer';
    const xg = new PIXI.Graphics();
    xg.beginFill(0xd84c4c);
    xg.drawCircle(0, 0, 18);
    xg.endFill();
    this.closeBtn.addChild(xg);
    const xt = new PIXI.Text('×', { fontSize: 26, fill: 0xffffff, fontWeight: '800' });
    xt.anchor.set(0.5);
    this.closeBtn.addChild(xt);
    this.closeBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.onGiveUp();
    });
    this.addChild(this.closeBtn);
  }

  show(options: BowlReviveOverlayOptions): void {
    this.onRevive = options.onRevive;
    this.onGiveUp = options.onGiveUp;
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }
}
