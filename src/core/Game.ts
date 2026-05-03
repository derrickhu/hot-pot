import * as PIXI from 'pixi.js';

class GameClass {
  app!: PIXI.Application;
  stage = new PIXI.Container();
  ticker = new PIXI.Ticker();
  designWidth = 750;
  screenWidth = 375;
  screenHeight = 667;
  dpr = 2;
  scale = 1;
  safeTop = 0;
  private initialized = false;

  init(canvas: HTMLCanvasElement): void {
    if (this.initialized) {
      return;
    }

    const api = typeof wx !== 'undefined' ? wx : null;
    const info = api?.getSystemInfoSync?.();

    if (info) {
      this.screenWidth = info.screenWidth;
      this.screenHeight = info.screenHeight;
      this.dpr = info.pixelRatio || 2;
    }

    const capsule = api?.getMenuButtonBoundingClientRect?.();
    const safeTopPx = capsule?.top || info?.statusBarHeight || 32;
    this.safeTop = Math.round(safeTopPx * (this.designWidth / this.screenWidth));

    const realWidth = this.screenWidth * this.dpr;
    const realHeight = this.screenHeight * this.dpr;

    canvas.width = realWidth;
    canvas.height = realHeight;

    this.scale = realWidth / this.designWidth;

    this.app = new PIXI.Application({
      view: canvas,
      width: realWidth,
      height: realHeight,
      resolution: 1,
      backgroundColor: 0xf7e4c4,
      antialias: true,
    });

    this.stage = this.app.stage;
    this.ticker = this.app.ticker;
    this.stage.scale.set(this.scale, this.scale);

    try {
      const events = (this.app.renderer as PIXI.Renderer & { events?: any }).events;
      const dom = events?.domElement;
      if (events && dom) {
        events.mapPositionToPoint = (point: PIXI.IPointData, x: number, y: number) => {
          let rect;
          try {
            rect = dom.getBoundingClientRect();
          } catch (error) {
            rect = null;
          }

          if (!rect || !rect.width || !rect.height) {
            rect = {
              left: 0,
              top: 0,
              width: this.screenWidth,
              height: this.screenHeight,
            };
          }

          const resolution = 1.0 / (events.resolution || 1);
          point.x = ((x - rect.left) * (dom.width / rect.width)) * resolution;
          point.y = ((y - rect.top) * (dom.height / rect.height)) * resolution;
        };
      }
    } catch (error) {
      console.warn('[Game] event mapping patch failed', error);
    }

    this.initialized = true;
  }

  get logicWidth(): number {
    return this.designWidth;
  }

  get logicHeight(): number {
    return this.screenHeight / this.screenWidth * this.designWidth;
  }
}

const holder = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
if (!holder.__hotPotGame) {
  holder.__hotPotGame = new GameClass();
}

export const Game: GameClass = holder.__hotPotGame;
