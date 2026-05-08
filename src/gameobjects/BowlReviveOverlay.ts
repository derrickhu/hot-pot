import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { BOWL_IMAGES_ROOT } from '@/config/bowlAssets';

export const BOWL_FAIL_REVIVE_PANEL_TEXTURE_KEY = 'bowl_fail_revive_panel';
export const BOWL_FAIL_REVIVE_PANEL_ASSET = `${BOWL_IMAGES_ROOT}/bowl_fail_revive_panel.png`;

export interface BowlReviveOverlayOptions {
  onRevive: () => void;
  onRetry: () => void;
  onHome: () => void;
  totalOrders: number;
  ordersRemaining: number;
}

/** 失败时的三选项面板：复活 / 重玩 / 回首页。 */
export class BowlReviveOverlay extends PIXI.Container {
  private readonly maskGfx: PIXI.Graphics;
  private readonly panelRoot: PIXI.Container;
  private readonly panelSprite: PIXI.Sprite;
  private readonly titleText: PIXI.Text;
  private readonly progressHintRoot = new PIXI.Container();
  private readonly progressHintBg = new PIXI.Graphics();
  private readonly descRoot = new PIXI.Container();
  private readonly reviveBtn: PIXI.Container;
  private readonly retryBtn: PIXI.Container;
  private readonly homeBtn: PIXI.Container;

  private onRevive: () => void = () => {};
  private onRetry: () => void = () => {};
  private onHome: () => void = () => {};
  private totalOrders = 1;
  private ordersRemaining = 1;

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

    this.panelRoot = new PIXI.Container();
    this.panelRoot.eventMode = 'static';
    this.panelRoot.on('pointertap', (e) => e.stopPropagation());
    this.addChild(this.panelRoot);

    this.panelSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this.panelSprite.anchor.set(0.5);
    this.panelSprite.eventMode = 'none';
    this.panelRoot.addChild(this.panelSprite);

    this.titleText = new PIXI.Text('挑战失败', {
      fontSize: 34,
      fill: 0x7a3a1e,
      fontWeight: '900',
      stroke: 0xfff2cf,
      strokeThickness: 3,
    });
    this.titleText.anchor.set(0.5);
    this.panelRoot.addChild(this.titleText);

    this.progressHintRoot.addChild(this.progressHintBg);
    this.panelRoot.addChild(this.progressHintRoot);
    this.panelRoot.addChild(this.descRoot);
    this.mountProgressHintText();
    this.mountDescriptionText();

    const mkBtn = (label: string): PIXI.Container => {
      const btn = new PIXI.Container();
      btn.eventMode = 'static';
      btn.cursor = 'pointer';
      const t = new PIXI.Text(label, {
        fontSize: 24,
        fill: 0xffffff,
        fontWeight: '900',
        stroke: 0x8c4b1f,
        strokeThickness: 3,
      });
      t.anchor.set(0.5);
      btn.addChild(t);
      return btn;
    };

    this.reviveBtn = mkBtn('看广告复活');
    this.reviveBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.onRevive();
    });
    this.panelRoot.addChild(this.reviveBtn);

    this.retryBtn = mkBtn('重玩本关');
    this.retryBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.onRetry();
    });
    this.panelRoot.addChild(this.retryBtn);

    this.homeBtn = mkBtn('返回首页');
    this.homeBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.onHome();
    });
    this.panelRoot.addChild(this.homeBtn);

    this.layout(w, h);
  }

  private makeDescText(text: string, fill = 0x6f4c35, fontSize = 28): PIXI.Text {
    const t = new PIXI.Text(text, {
      fontSize,
      fill,
      fontWeight: '900',
      stroke: 0xfff4d6,
      strokeThickness: 4,
      lineJoin: 'round',
    });
    t.anchor.set(0, 0.5);
    return t;
  }

  private makeProgressText(text: string, fill = 0x6e4a34, fontSize = 28): PIXI.Text {
    const t = new PIXI.Text(text, {
      fontSize,
      fill,
      fontWeight: '700',
      stroke: 0xffffff,
      strokeThickness: 2,
      lineJoin: 'round',
    });
    t.anchor.set(0, 0.5);
    return t;
  }

  private mountPartsLine(parts: PIXI.Text[], y: number, root: PIXI.Container): void {
    const gap = 2;
    const width = parts.reduce((sum, part) => sum + part.width, 0) + gap * (parts.length - 1);
    let x = -width / 2;
    for (const part of parts) {
      part.position.set(x, y);
      root.addChild(part);
      x += part.width + gap;
    }
  }

  private mountProgressHintText(): void {
    this.progressHintRoot.removeChildren();
    this.progressHintRoot.addChild(this.progressHintBg);

    const highlight = 0xe95b2f;
    const total = Math.max(1, this.totalOrders);
    const remaining = Math.max(0, Math.min(total, this.ordersRemaining));
    const completed = Math.max(0, Math.min(total, total - remaining));
    const percent = Math.round((completed / total) * 100);

    const lineParts = [
      this.makeProgressText('订单已完成', 0x6e4a34, 22),
      this.makeProgressText(`${percent}%`, highlight, 30),
      this.makeProgressText('！', 0x6e4a34, 22),
    ];
    this.mountPartsLine(lineParts, 0, this.progressHintRoot);

    const contentW =
      lineParts.reduce((sum, part) => sum + part.width, 0) + 2 * (lineParts.length - 1);
    const padX = 24;
    const padY = 14;
    const boxW = Math.ceil(contentW) + padX * 2;
    const boxH = 30 + padY * 2;
    this.progressHintBg.clear();
    this.progressHintBg.lineStyle(5, 0xf28c4a, 1);
    this.progressHintBg.beginFill(0xfff6e3, 0.96);
    this.progressHintBg.drawRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 14);
    this.progressHintBg.endFill();
  }

  private mountDescriptionText(): void {
    this.descRoot.removeChildren();
    const highlight = 0xe95b2f;
    const reviveLine1 = [
      this.makeDescText('复活增加', 0x6f4c35, 28),
      this.makeDescText('1', highlight, 36),
      this.makeDescText('个订单盘子', 0x6f4c35, 28),
    ];
    const reviveLine2 = [
      this.makeDescText('并', 0x6f4c35, 28),
      this.makeDescText('清空暂存碟', highlight, 28),
      this.makeDescText('上的所有食物', 0x6f4c35, 28),
    ];
    this.mountPartsLine(reviveLine1, -20, this.descRoot);
    this.mountPartsLine(reviveLine2, 24, this.descRoot);
  }

  setPanelTexture(texture: PIXI.Texture | null | undefined): void {
    if (!texture) {
      return;
    }
    this.panelSprite.texture = texture;
    this.layout(this.maskGfx.width, this.maskGfx.height);
  }

  private layout(w: number, h: number): void {
    const srcW = 843;
    const srcH = 983;
    const panelH = Math.min(h * 0.78, 620);
    const scale = panelH / srcH;
    const panelW = srcW * scale;
    this.panelRoot.position.set(w / 2, h * 0.48);
    this.panelSprite.width = panelW;
    this.panelSprite.height = panelH;

    const toLocalX = (x: number) => (x - srcW / 2) * scale;
    const toLocalY = (y: number) => (y - srcH / 2) * scale;
    const setHit = (btn: PIXI.Container, x1: number, y1: number, x2: number, y2: number) => {
      btn.hitArea = new PIXI.Rectangle(
        (x1 - (x1 + x2) / 2) * scale,
        (y1 - (y1 + y2) / 2) * scale,
        (x2 - x1) * scale,
        (y2 - y1) * scale,
      );
    };

    this.titleText.position.set(toLocalX(421), toLocalY(92));
    this.progressHintRoot.position.set(toLocalX(421), toLocalY(260));
    this.progressHintRoot.scale.set(Math.max(0.84, Math.min(1, panelW / 520)));
    this.descRoot.position.set(toLocalX(421), toLocalY(420));
    this.descRoot.scale.set(Math.max(0.86, Math.min(1, panelW / 520)));

    this.reviveBtn.position.set(toLocalX(419), toLocalY(633));
    setHit(this.reviveBtn, 121, 583, 718, 684);
    this.retryBtn.position.set(toLocalX(419), toLocalY(756));
    setHit(this.retryBtn, 156, 710, 683, 802);
    this.homeBtn.position.set(toLocalX(421), toLocalY(870));
    setHit(this.homeBtn, 198, 830, 645, 910);
  }

  show(options: BowlReviveOverlayOptions): void {
    this.onRevive = options.onRevive;
    this.onRetry = options.onRetry;
    this.onHome = options.onHome;
    this.totalOrders = options.totalOrders;
    this.ordersRemaining = options.ordersRemaining;
    this.mountProgressHintText();
    this.mountDescriptionText();
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }
}
