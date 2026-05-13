import * as PIXI from 'pixi.js';

type OpenDataOverlay = {
  canvas: HTMLCanvasElement & { width: number; height: number };
  x: number;
  y: number;
  width: number;
  height: number;
};

type PixiRuntime = {
  app: PIXI.Application;
  stage: PIXI.Container;
  ticker: PIXI.Ticker;
  renderer: PIXI.IRenderer;
};

class GameClass {
  app!: PIXI.Application;
  stage = new PIXI.Container();
  ticker = new PIXI.Ticker();
  designWidth = 750;
  /**
   * 固定安全设计高度（现代 iPhone 约 750x1624）。
   * 叠碗玩法的进度条、碗、工具栏是按这个纵向空间排布的；
   * iPad 等宽屏设备必须把这整张安全画布等比 fit 进去，
   * 不能只 fit 到 750x1334，否则碗会压到上方进度条。
   */
  designHeight = 1624;
  screenWidth = 375;
  screenHeight = 667;
  dpr = 2;
  scale = 1;
  safeTop = 0;
  /** 等比缩放后舞台在 canvas 像素坐标系下的左上角偏移（letterbox 边距） */
  stageOffsetX = 0;
  stageOffsetY = 0;
  /** init 完成后冻结下来的逻辑坐标系尺寸（设计像素） */
  private cachedLogicHeight = 1624;
  private initialized = false;
  private screenCanvas: HTMLCanvasElement | null = null;
  private renderCanvas: HTMLCanvasElement | null = null;
  private screenContext2d: CanvasRenderingContext2D | null = null;
  private openDataOverlay: OpenDataOverlay | null = null;
  private compositorDrawWarned = false;

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

    const realWidth = this.screenWidth * this.dpr;
    const realHeight = this.screenHeight * this.dpr;

    const screenCanvas = this.resolveScreenCanvas(canvas);
    screenCanvas.width = realWidth;
    screenCanvas.height = realHeight;
    if (canvas !== screenCanvas) {
      canvas.width = realWidth;
      canvas.height = realHeight;
    }

    /**
     * 等比适配：
     * - 屏幕宽高比 < 设计稿宽高比（即屏幕"比设计更窄/更长"）：按宽缩放，
     *   logicHeight 跟随屏幕实际长度变长，保留 iPhone 全屏铺满的体验。
     * - 否则（屏幕比设计稿更宽，例如 iPad 3:4）：按高缩放，
     *   logicHeight 固定 designHeight，舞台水平居中，左右出现 letterbox。
     */
    const designAspect = this.designWidth / this.designHeight;
    const screenAspect = realWidth / realHeight;
    if (screenAspect <= designAspect) {
      this.scale = realWidth / this.designWidth;
      this.cachedLogicHeight = realHeight / this.scale;
      this.stageOffsetX = 0;
      this.stageOffsetY = 0;
    } else {
      this.scale = realHeight / this.designHeight;
      this.cachedLogicHeight = this.designHeight;
      this.stageOffsetX = Math.round((realWidth - this.designWidth * this.scale) / 2);
      this.stageOffsetY = 0;
    }
    // 系统安全区 CSS px -> 设计像素。必须在 scale/stageOffset 计算完成后再换算，
    // 否则 iPad letterbox 模式下顶部按钮会偏小或偏上。
    this.safeTop = Math.max(0, Math.round((safeTopPx * this.dpr - this.stageOffsetY) / this.scale));

    let pixiCanvas = this.createPixiRenderCanvas(screenCanvas, realWidth, realHeight, canvas);
    let runtime = this.createPixiRuntime(pixiCanvas, realWidth, realHeight);

    if (!runtime && pixiCanvas !== screenCanvas) {
      console.warn('[Game] offscreen Pixi renderer failed, fallback to direct WebGL canvas');
      this.disableScreenCompositor(screenCanvas);
      pixiCanvas = screenCanvas;
      runtime = this.createPixiRuntime(pixiCanvas, realWidth, realHeight);
    }

    if (!runtime) {
      throw new Error('Failed to create Pixi renderer');
    }

    if (pixiCanvas !== screenCanvas && !this.enableScreenCompositor(screenCanvas)) {
      console.warn('[Game] screen 2d compositor unavailable after offscreen renderer, fallback to direct WebGL canvas');
      try {
        runtime.app.destroy(true);
      } catch (error) {}
      this.disableScreenCompositor(screenCanvas);
      pixiCanvas = screenCanvas;
      runtime = this.createPixiRuntime(pixiCanvas, realWidth, realHeight);
      if (!runtime) {
        throw new Error('Failed to create Pixi renderer');
      }
    }

    this.app = runtime.app;
    this.stage = runtime.stage;
    this.ticker = runtime.ticker;
    console.log(
      '[Game] render mode='
        + (this.screenContext2d && this.renderCanvas !== screenCanvas ? '2d-compositor' : 'direct-webgl')
        + ' screen=' + screenCanvas.width + 'x' + screenCanvas.height
        + ' render=' + ((this.renderCanvas as any)?.width || 0) + 'x' + ((this.renderCanvas as any)?.height || 0)
    );
    this.stage.scale.set(this.scale, this.scale);
    this.stage.position.set(this.stageOffsetX, this.stageOffsetY);
    this.ticker.add(() => {
      this.compositeToScreen();
    }, undefined, PIXI.UPDATE_PRIORITY.LOW);

    try {
      if (typeof GameGlobal !== 'undefined') {
        GameGlobal.__hotPotRendered = true;
      }
    } catch (error) {}

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

  private resolveScreenCanvas(fallback: HTMLCanvasElement): HTMLCanvasElement {
    try {
      const mainCanvas = typeof GameGlobal !== 'undefined' ? GameGlobal.__mainCanvas : null;
      if (mainCanvas && typeof mainCanvas.getContext === 'function') {
        return mainCanvas as HTMLCanvasElement;
      }
    } catch (error) {}
    return fallback;
  }

  private createPixiRuntime(view: HTMLCanvasElement, width: number, height: number): PixiRuntime | null {
    let renderer: PIXI.IRenderer | null = null;
    let app: PIXI.Application | null = null;

    try {
      app = new PIXI.Application({
        view,
        width,
        height,
        resolution: 1,
        backgroundColor: 0xf7e4c4,
        antialias: true,
        preferWebGLVersion: 1,
      } as any);
    } catch (error) {
      console.error('[Game] new PIXI.Application failed', error);
    }

    if (app?.stage && app.ticker && app.renderer) {
      return {
        app,
        stage: app.stage,
        ticker: app.ticker,
        renderer: app.renderer,
      };
    }

    if (app?.renderer) {
      renderer = app.renderer;
    }

    if (!renderer) {
      try {
        renderer = new PIXI.Renderer({
          view,
          width,
          height,
          resolution: 1,
          backgroundColor: 0xf7e4c4,
          antialias: true,
          preferWebGLVersion: 1,
        } as any);
      } catch (error) {
        console.error('[Game] new PIXI.Renderer failed', error);
      }
    }

    if (!renderer) {
      try {
        renderer = PIXI.autoDetectRenderer({
          view,
          width,
          height,
          resolution: 1,
          backgroundColor: 0xf7e4c4,
          antialias: true,
          preferWebGLVersion: 1,
        } as any) as PIXI.IRenderer;
      } catch (error) {
        console.error('[Game] autoDetectRenderer failed', error);
      }
    }

    if (!renderer) {
      return null;
    }

    const stage = new PIXI.Container();
    const ticker = new PIXI.Ticker();
    ticker.start();
    ticker.add(() => {
      renderer!.render(stage);
    });

    const fallbackApp = {
      stage,
      ticker,
      renderer,
      view,
      destroy: () => {
        ticker.destroy();
        renderer?.destroy();
      },
    } as any as PIXI.Application;

    return { app: fallbackApp, stage, ticker, renderer };
  }

  /**
   * 微信开放数据域开启后，sharedCanvas 只能直接绘制到“上屏 canvas”。
   * 因此在微信小游戏里把 Pixi 渲染到离屏 WebGL canvas，再用上屏 2D canvas 合成：
   * 先画游戏画面，再把好友榜 sharedCanvas 叠上去。
   */
  private createPixiRenderCanvas(
    screenCanvas: HTMLCanvasElement,
    width: number,
    height: number,
    preferredRenderCanvas?: HTMLCanvasElement
  ): HTMLCanvasElement {
    this.screenCanvas = screenCanvas;
    this.renderCanvas = screenCanvas;
    this.screenContext2d = null;

    const api = typeof wx !== 'undefined' ? wx : null;
    const shouldCompositeForOpenData = !!api?.getOpenDataContext && typeof api?.createCanvas === 'function';
    if (!shouldCompositeForOpenData) {
      return screenCanvas;
    }

    try {
      // 如果 game.js 已经按 xiao_chu 的方式提前创建了 2D 上屏 canvas，
      // pixi-adapter 传进来的 canvas 就是第二个 canvas，可直接作为 Pixi 离屏 WebGL。
      const renderCanvas = preferredRenderCanvas && preferredRenderCanvas !== screenCanvas
        ? preferredRenderCanvas
        : api!.createCanvas() as HTMLCanvasElement;
      renderCanvas.width = width;
      renderCanvas.height = height;
      this.renderCanvas = renderCanvas;
      return renderCanvas;
    } catch (error) {
      console.warn('[Game] offscreen canvas unavailable, fallback to direct WebGL', error);
      this.screenContext2d = null;
      this.renderCanvas = screenCanvas;
      return screenCanvas;
    }
  }

  private enableScreenCompositor(screenCanvas: HTMLCanvasElement): boolean {
    try {
      const ctx = screenCanvas.getContext('2d') as CanvasRenderingContext2D | null;
      if (!ctx) return false;
      this.screenContext2d = ctx;
      console.log('[Game] use 2d compositor for openDataContext');
      return true;
    } catch (error) {
      console.warn('[Game] 2d compositor unavailable', error);
      this.screenContext2d = null;
      return false;
    }
  }

  private disableScreenCompositor(screenCanvas: HTMLCanvasElement): void {
    this.screenCanvas = screenCanvas;
    this.renderCanvas = screenCanvas;
    this.screenContext2d = null;
    this.openDataOverlay = null;
  }

  /** 每帧把离屏 Pixi 画面与开放数据域画布合成到真正上屏 canvas */
  private compositeToScreen(): void {
    const ctx = this.screenContext2d;
    const screen = this.screenCanvas;
    const render = this.renderCanvas;
    if (!ctx || !screen || !render || screen === render) {
      return;
    }

    try {
      ctx.clearRect(0, 0, screen.width, screen.height);
      ctx.drawImage(render, 0, 0, screen.width, screen.height);
      const overlay = this.openDataOverlay;
      if (overlay?.canvas) {
        ctx.drawImage(
          overlay.canvas,
          0,
          0,
          overlay.canvas.width,
          overlay.canvas.height,
          // 设计像素 → 物理像素后再叠加 letterbox 偏移，
          // 否则 iPad 上好友榜会画在舞台左侧 letterbox 区域。
          Math.round(this.stageOffsetX + overlay.x * this.scale),
          Math.round(this.stageOffsetY + overlay.y * this.scale),
          Math.round(overlay.width * this.scale),
          Math.round(overlay.height * this.scale)
        );
      }
    } catch (error) {
      if (!this.compositorDrawWarned) {
        this.compositorDrawWarned = true;
        console.warn('[Game] 2d compositor draw failed', error);
      }
    }
  }

  /** 当前是否真的能把开放数据域 sharedCanvas 直接合成到上屏 canvas */
  canCompositeOpenDataOverlay(): boolean {
    return !!this.screenContext2d && !!this.screenCanvas && !!this.renderCanvas && this.screenCanvas !== this.renderCanvas;
  }

  /** iOS 微信提供的 WebGL 绑定 Canvas 纹理能力；Android/开发者工具通常没有 */
  canBindCanvasTexture(): boolean {
    try {
      const renderer = this.app?.renderer as PIXI.Renderer | undefined;
      const gl = renderer?.gl as any;
      return !!gl && typeof gl.wxBindCanvasTexture === 'function';
    } catch (error) {
      return false;
    }
  }

  /** 设置开放数据域显示区域，坐标使用游戏逻辑坐标 */
  setOpenDataOverlay(overlay: OpenDataOverlay): boolean {
    if (!this.canCompositeOpenDataOverlay()) {
      console.warn('[Game] openData overlay unavailable: render mode is direct-webgl');
      return false;
    }
    this.openDataOverlay = overlay;
    console.log(
      '[Game] openData overlay set'
        + ' src=' + overlay.canvas.width + 'x' + overlay.canvas.height
        + ' dst=' + Math.round(this.stageOffsetX + overlay.x * this.scale)
        + ',' + Math.round(this.stageOffsetY + overlay.y * this.scale)
        + ',' + Math.round(overlay.width * this.scale) + 'x' + Math.round(overlay.height * this.scale)
    );
    return true;
  }

  /** 清理开放数据域显示区域，避免切回世界榜/离开场景后残留 */
  clearOpenDataOverlay(): void {
    this.openDataOverlay = null;
  }

  get logicWidth(): number {
    return this.designWidth;
  }

  get logicHeight(): number {
    return this.cachedLogicHeight;
  }
}

const holder = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
if (!holder.__hotPotGame) {
  holder.__hotPotGame = new GameClass();
}

export const Game: GameClass = holder.__hotPotGame;
