import * as PIXI from 'pixi.js';
import { TextureCache } from '@/utils/TextureCache';

const LOADING_BG_KEY = 'loading_page_cool_vacation';
const LOADING_BG_PATH = 'assets/images/loading_page_cool_vacation.jpg';
const LOGO_KEY = 'loading_game_logo_title';
const LOGO_PATH = 'assets/images/game_logo_title.png';

export class LoadingOverlay {
  readonly container = new PIXI.Container();

  private readonly width: number;
  private readonly height: number;
  private readonly safeTop: number;
  private readonly bgLayer = new PIXI.Container();
  private readonly logoLayer = new PIXI.Container();
  private readonly barTrack = new PIXI.Graphics();
  private readonly barFill = new PIXI.Graphics();
  private progress = 0;

  constructor(width: number, height: number, safeTop: number) {
    this.width = width;
    this.height = height;
    this.safeTop = safeTop;
    this.container.sortableChildren = true;
    this.buildFallback();
    this.buildProgressBar();
  }

  async loadAssets(): Promise<void> {
    const [bgTex, logoTex] = await Promise.all([
      TextureCache.load(LOADING_BG_KEY, LOADING_BG_PATH),
      TextureCache.load(LOGO_KEY, LOGO_PATH),
    ]);
    this.applyBackground(bgTex);
    this.applyLogo(logoTex);
  }

  setProgress(value: number): void {
    this.progress = Math.max(0, Math.min(1, value));
    this.drawProgressBar();
  }

  destroy(): void {
    this.container.removeChildren();
    this.container.destroy({ children: true });
  }

  private buildFallback(): void {
    const g = new PIXI.Graphics();
    g.beginFill(0xd9f8f0, 1);
    g.drawRect(0, 0, this.width, this.height);
    g.endFill();
    g.beginFill(0x9ee8e2, 1);
    g.drawRect(0, 0, this.width, this.height * 0.58);
    g.endFill();
    g.beginFill(0xfff2d0, 1);
    g.drawRect(0, this.height * 0.58, this.width, this.height * 0.42);
    g.endFill();
    this.bgLayer.addChild(g);
    this.container.addChild(this.bgLayer);
    this.container.addChild(this.logoLayer);
  }

  private applyBackground(tex: PIXI.Texture | null): void {
    if (!tex) {
      return;
    }
    this.bgLayer.removeChildren();
    const sp = new PIXI.Sprite(tex);
    const scale = Math.max(this.width / tex.width, this.height / tex.height);
    sp.scale.set(scale);
    sp.position.set((this.width - tex.width * scale) / 2, (this.height - tex.height * scale) / 2);
    this.bgLayer.addChild(sp);
  }

  private applyLogo(tex: PIXI.Texture | null): void {
    this.logoLayer.removeChildren();
    if (!tex) {
      return;
    }
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5, 0);
    const maxW = this.width * 0.62;
    const maxH = this.height * 0.16;
    const scale = Math.min(maxW / tex.width, maxH / tex.height, 1.15);
    sp.scale.set(scale);
    sp.position.set(this.width / 2, Math.max(22, this.safeTop + 16));
    this.logoLayer.addChild(sp);
  }

  private buildProgressBar(): void {
    this.container.addChild(this.barTrack);
    this.container.addChild(this.barFill);
    this.drawProgressBar();
  }

  private drawProgressBar(): void {
    const w = Math.round(this.width * 0.58);
    const h = 18;
    const x = Math.round((this.width - w) / 2);
    const y = Math.round(this.height - Math.max(96, this.height * 0.12));
    const fillW = Math.max(h, Math.round(w * this.progress));

    this.barTrack.clear();
    this.barTrack.beginFill(0x7bd3d0, 0.22);
    this.barTrack.drawRoundedRect(x - 12, y - 10, w + 24, h + 20, 20);
    this.barTrack.endFill();
    this.barTrack.beginFill(0xfffbec, 0.96);
    this.barTrack.drawRoundedRect(x - 5, y - 5, w + 10, h + 10, 14);
    this.barTrack.endFill();
    this.barTrack.lineStyle(2, 0xcaa36a, 0.9);
    this.barTrack.drawRoundedRect(x - 5, y - 5, w + 10, h + 10, 14);
    this.barTrack.beginFill(0xcfeee9, 0.92);
    this.barTrack.drawRoundedRect(x, y, w, h, h / 2);
    this.barTrack.endFill();

    this.barFill.clear();
    this.barFill.beginFill(0x44d7c6, 1);
    this.barFill.drawRoundedRect(x, y, fillW, h, h / 2);
    this.barFill.endFill();
    this.barFill.beginFill(0xbffcf1, 0.72);
    this.barFill.drawRoundedRect(x + 4, y + 3, Math.max(0, fillW - 8), 5, 3);
    this.barFill.endFill();
    this.barFill.beginFill(0x1aa997, 0.28);
    this.barFill.drawRoundedRect(x + 4, y + h - 7, Math.max(0, fillW - 8), 4, 2);
    this.barFill.endFill();
  }
}
