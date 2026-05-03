import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';

export interface BowlFailSettlementOptions {
  /** 如「第2关」 */
  levelLabel: string;
  /** 结算时剩余订单数 */
  ordersRemaining: number;
  onRetry: () => void;
  onHome: () => void;
}

/**
 * 放弃复活后的失败结算（参考休闲消除「本关失败」结算感：醒目失败标、本关摘要、重玩/返回）。
 */
export class BowlFailSettlementOverlay extends PIXI.Container {
  private readonly screenW: number;
  private readonly screenH: number;
  private readonly maskGfx: PIXI.Graphics;
  private readonly panelRoot: PIXI.Container;
  private readonly panelShadow: PIXI.Graphics;
  private readonly panelBody: PIXI.Graphics;
  private readonly failBadge: PIXI.Container;
  private readonly burst: PIXI.Graphics;
  private readonly failPill: PIXI.Graphics;
  private readonly failTitle: PIXI.Text;
  private readonly reasonText: PIXI.Text;
  private readonly statLevel: PIXI.Text;
  private readonly statOrders: PIXI.Text;
  private readonly tipText: PIXI.Text;
  private readonly retryBtn: PIXI.Container;
  private readonly homeBtn: PIXI.Container;

  private onRetry: () => void = () => {};
  private onHome: () => void = () => {};

  constructor(w: number, h: number) {
    super();
    this.screenW = w;
    this.screenH = h;
    this.visible = false;
    this.eventMode = 'static';

    this.maskGfx = new PIXI.Graphics();
    this.maskGfx.beginFill(0x1a0f0a, 0.68);
    this.maskGfx.drawRect(0, 0, w, h);
    this.maskGfx.endFill();
    this.maskGfx.eventMode = 'static';
    this.maskGfx.on('pointertap', () => {});
    this.addChild(this.maskGfx);

    const pw = Math.min(500, Math.floor(w * 0.9));
    const ph = 420;
    const px = (w - pw) / 2;
    const py = h * 0.42 - ph / 2;

    this.panelRoot = new PIXI.Container();
    this.panelRoot.position.set(px, py);
    this.addChild(this.panelRoot);

    this.panelShadow = new PIXI.Graphics();
    this.panelShadow.beginFill(0x000000, 0.4);
    this.panelShadow.drawRoundedRect(12, 14, pw, ph, 28);
    this.panelShadow.endFill();
    this.panelRoot.addChild(this.panelShadow);

    this.panelBody = new PIXI.Graphics();
    this.panelBody.lineStyle(5, 0xc9a06b, 1);
    this.panelBody.beginFill(0xfff5e8);
    this.panelBody.drawRoundedRect(0, 0, pw, ph, 26);
    this.panelBody.endFill();
    this.panelBody.lineStyle(2, 0xffffff, 0.7);
    this.panelBody.drawRoundedRect(10, 10, pw - 20, ph - 20, 18);
    this.panelRoot.addChild(this.panelBody);

    const statBox = new PIXI.Graphics();
    statBox.lineStyle(2, 0xd4b896, 1);
    statBox.beginFill(0xfcefd4, 0.72);
    statBox.drawRoundedRect(pw / 2 - 200, 132, 400, 88, 14);
    statBox.endFill();
    this.panelRoot.addChild(statBox);

    this.failBadge = new PIXI.Container();
    this.failBadge.position.set(pw / 2, 8);
    this.panelRoot.addChild(this.failBadge);

    this.burst = new PIXI.Graphics();
    this.burst.lineStyle(0);
    this.burst.beginFill(0x7ec8ff, 0.4);
    const pts: number[] = [];
    const spikes = 8;
    const ro = 52;
    const ri = 26;
    for (let i = 0; i < spikes * 2; i += 1) {
      const a = (i * Math.PI) / spikes - Math.PI / 2;
      const r = i % 2 === 0 ? ro : ri;
      pts.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    this.burst.drawPolygon(pts);
    this.burst.endFill();
    this.failBadge.addChild(this.burst);

    this.failPill = new PIXI.Graphics();
    this.failPill.lineStyle(4, 0x2a6bb0, 1);
    this.failPill.beginFill(0x4a9fe8);
    this.failPill.drawRoundedRect(-118, -30, 236, 60, 28);
    this.failPill.endFill();
    this.failBadge.addChild(this.failPill);

    this.failTitle = new PIXI.Text('挑战失败', {
      fontSize: 30,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x1a5080,
      strokeThickness: 4,
      dropShadow: true,
      dropShadowBlur: 2,
      dropShadowDistance: 2,
      dropShadowColor: 0x103060,
    });
    this.failTitle.anchor.set(0.5);
    this.failBadge.addChild(this.failTitle);

    this.reasonText = new PIXI.Text('暂存菜碟已满', {
      fontSize: 22,
      fill: 0x7a3a32,
      fontWeight: '800',
    });
    this.reasonText.anchor.set(0.5, 0);
    this.reasonText.position.set(pw / 2, 100);
    this.panelRoot.addChild(this.reasonText);

    this.statLevel = new PIXI.Text('', {
      fontSize: 18,
      fill: 0x5a3d2b,
      fontWeight: '700',
    });
    this.statLevel.anchor.set(0.5, 0);
    this.statLevel.position.set(pw / 2, 148);
    this.panelRoot.addChild(this.statLevel);

    this.statOrders = new PIXI.Text('', {
      fontSize: 18,
      fill: 0x5a3d2b,
      fontWeight: '700',
    });
    this.statOrders.anchor.set(0.5, 0);
    this.statOrders.position.set(pw / 2, 180);
    this.panelRoot.addChild(this.statOrders);

    this.tipText = new PIXI.Text('理清订单再腾挪，或复活多一路订单盘', {
      fontSize: 16,
      fill: 0x8a6a52,
      fontWeight: '600',
      align: 'center',
      wordWrap: true,
      wordWrapWidth: pw - 48,
    });
    this.tipText.anchor.set(0.5, 0);
    this.tipText.position.set(pw / 2, 238);
    this.panelRoot.addChild(this.tipText);

    this.retryBtn = BowlFailSettlementOverlay.makePrimaryBtn('重玩本关', 0xf07830);
    this.retryBtn.position.set(pw / 2, ph - 112);
    this.retryBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.onRetry();
    });
    this.panelRoot.addChild(this.retryBtn);

    this.homeBtn = BowlFailSettlementOverlay.makeSecondaryBtn('返回首页');
    this.homeBtn.position.set(pw / 2, ph - 48);
    this.homeBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.onHome();
    });
    this.panelRoot.addChild(this.homeBtn);
  }

  private static makePrimaryBtn(label: string, fill: number): PIXI.Container {
    const c = new PIXI.Container();
    c.eventMode = 'static';
    c.cursor = 'pointer';
    const g = new PIXI.Graphics();
    g.beginFill(0xc45a1a);
    g.drawRoundedRect(-142, -34, 284, 68, 34);
    g.endFill();
    g.lineStyle(3, 0xfff0d0, 0.5);
    g.drawRoundedRect(-138, -30, 276, 60, 30);
    g.lineStyle(0);
    g.beginFill(fill);
    g.drawRoundedRect(-134, -26, 268, 56, 28);
    g.endFill();
    c.addChild(g);
    const t = new PIXI.Text(label, {
      fontSize: 26,
      fill: 0xffffff,
      fontWeight: '900',
    });
    t.anchor.set(0.5);
    c.addChild(t);
    return c;
  }

  private static makeSecondaryBtn(label: string): PIXI.Container {
    const c = new PIXI.Container();
    c.eventMode = 'static';
    c.cursor = 'pointer';
    const g = new PIXI.Graphics();
    g.lineStyle(3, 0xe8a44c, 1);
    g.beginFill(0xfff2e0);
    g.drawRoundedRect(-118, -24, 236, 48, 22);
    g.endFill();
    c.addChild(g);
    const t = new PIXI.Text(label, {
      fontSize: 20,
      fill: 0xb86520,
      fontWeight: '800',
    });
    t.anchor.set(0.5);
    c.addChild(t);
    return c;
  }

  show(options: BowlFailSettlementOptions): void {
    this.onRetry = options.onRetry;
    this.onHome = options.onHome;
    this.statLevel.text = `本关：${options.levelLabel}`;
    this.statOrders.text = `剩余订单：${options.ordersRemaining}`;
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }
}
