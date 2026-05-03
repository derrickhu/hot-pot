import '@pixi/unsafe-eval';
import { BaseImageResource, BaseTexture, ShaderSystem, Texture } from '@pixi/core';
import { settings } from '@pixi/settings';

declare const wx: any;

const api = typeof wx !== 'undefined' ? wx : null;

if (api) {
  try {
    let useOffscreen = false;

    try {
      if (typeof api.createOffscreenCanvas === 'function') {
        const testCanvas = api.createOffscreenCanvas({ type: '2d', width: 1, height: 1 });
        const testCtx = testCanvas.getContext('2d');
        if (testCtx) {
          useOffscreen = true;
        }
      }
    } catch (error) {}

    const create2DCanvas = (width?: number, height?: number): any => {
      let nextCanvas: any;

      if (useOffscreen) {
        try {
          nextCanvas = api.createOffscreenCanvas({
            type: '2d',
            width: width || 1,
            height: height || 1,
          });
        } catch (error) {
          nextCanvas = api.createCanvas();
        }
      } else {
        nextCanvas = api.createCanvas();
      }

      if (width !== undefined) nextCanvas.width = width;
      if (height !== undefined) nextCanvas.height = height;
      return nextCanvas;
    };

    settings.ADAPTER = {
      createCanvas: create2DCanvas,
      getCanvasRenderingContext2D: (): any => {
        try {
          const nextCanvas = create2DCanvas(1, 1);
          const ctx = nextCanvas.getContext('2d');
          return ctx ? ctx.constructor : Object;
        } catch (error) {
          return Object;
        }
      },
      getWebGLRenderingContext: (): any => {
        try {
          const nextCanvas = api.createCanvas();
          const gl = nextCanvas.getContext('webgl', {
            stencil: true,
            antialias: true,
            alpha: true,
            depth: true,
          });
          return gl ? gl.constructor : Object;
        } catch (error) {
          return Object;
        }
      },
      getNavigator: (): any => ({
        userAgent: 'wxgame',
        gpu: null,
      }),
      getBaseUrl: (): string => '',
      getFontFaceSet: (): any => null,
      fetch: ((_url: any, _opts?: any): any => {
        return Promise.reject(new Error('fetch not available in mini game'));
      }) as any,
    };
  } catch (error) {
    console.warn('[pixiPatch] settings.ADAPTER patch failed', error);
  }
}

try {
  (ShaderSystem.prototype as any).systemCheck = function systemCheck() {};
} catch (error) {
  console.warn('[pixiPatch] shader systemCheck patch failed', error);
}

const isRealDevice = (() => {
  try {
    if (!api) return false;
    const info = api.getSystemInfoSync();
    return info.platform !== 'devtools';
  } catch (error) {
    return false;
  }
})();

if (isRealDevice) {
  try {
    const whitePixels = new Uint8Array(16 * 16 * 4);
    whitePixels.fill(255);
    const whiteBaseTexture = BaseTexture.fromBuffer(whitePixels, 16, 16);
    const whiteTexture = new Texture(whiteBaseTexture);
    (whiteTexture as any).destroy = () => {};

    Object.defineProperty(Texture, '_WHITE', {
      value: whiteTexture,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(Texture, 'WHITE', {
      get: () => whiteTexture,
      configurable: true,
    });
  } catch (error) {
    console.warn('[pixiPatch] Texture.WHITE patch failed', error);
  }

  try {
    const originalUpload = BaseImageResource.prototype.upload;
    let inUpload = false;
    let canReadPixels = false;

    try {
      const testCanvas = settings.ADAPTER.createCanvas(4, 4);
      const testCtx = testCanvas.getContext('2d');
      if (testCtx) {
        testCtx.fillStyle = '#ff0000';
        testCtx.fillRect(0, 0, 4, 4);
        const pixel = testCtx.getImageData(0, 0, 1, 1).data;
        canReadPixels = pixel[0] > 200 && pixel[3] > 200;
      }
    } catch (error) {}

    BaseImageResource.prototype.upload = function upload(renderer: any, baseTexture: any, glTexture: any, source?: any): boolean {
      if (inUpload) {
        return originalUpload.call(this, renderer, baseTexture, glTexture, source);
      }

      inUpload = true;

      try {
        const nextSource = source || this.source;
        const result = originalUpload.call(this, renderer, baseTexture, glTexture, nextSource);

        if (
          canReadPixels
          && nextSource
          && nextSource.width > 0
          && nextSource.height > 0
          && typeof nextSource.getContext === 'function'
          && typeof nextSource.toTempFilePathSync === 'function'
        ) {
          const ctx = nextSource.getContext('2d');
          if (ctx && typeof ctx.getImageData === 'function') {
            const width = nextSource.width;
            const height = nextSource.height;
            const imageData = ctx.getImageData(0, 0, width, height);
            const pixels = new Uint8Array(imageData.data.buffer);
            const gl = renderer.gl;
            gl.pixelStorei(
              gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
              baseTexture.alphaMode > 0 ? 1 : 0,
            );
            gl.texImage2D(
              gl.TEXTURE_2D,
              0,
              glTexture.internalFormat,
              width,
              height,
              0,
              baseTexture.format,
              glTexture.type,
              pixels,
            );
          }
        }

        return result;
      } finally {
        inUpload = false;
      }
    };
  } catch (error) {
    console.warn('[pixiPatch] BaseImageResource upload patch failed', error);
  }
}
