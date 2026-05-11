import * as PIXI from 'pixi.js';

export interface TextureTopEdge {
  edge: Float32Array;
  texW: number;
  texH: number;
}

interface CanvasLike {
  width: number;
  height: number;
  getContext: (type: '2d') => CanvasRenderingContext2D | null;
}

function createCanvasLike(width: number, height: number): CanvasLike | null {
  const api = typeof wx !== 'undefined' ? wx : null;
  if (api && typeof api.createCanvas === 'function') {
    const c = api.createCanvas() as unknown as CanvasLike;
    c.width = width;
    c.height = height;
    return c;
  }
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const c = document.createElement('canvas') as unknown as CanvasLike;
    c.width = width;
    c.height = height;
    return c;
  }
  return null;
}

/**
 * 沿纹理每一列扫描首个 alpha >= 阈值的行号，得到该贴图的"不透明上沿"曲线。
 * 用于让物理斜面沿素材真实边走（带圆角/绿草）。
 *
 * @returns `edge[col] = 行号 y`；找不到不透明像素则记为 `texH - 1`。
 *  失败（无 Canvas / CORS）返回 null，调用方可走线性回退。
 */
export function sampleTextureTopEdge(
  texture: PIXI.Texture,
  alphaThreshold = 16,
  smoothRadius = 2,
): TextureTopEdge | null {
  const w = texture.width | 0;
  const h = texture.height | 0;
  if (w < 2 || h < 2) {
    return null;
  }
  const resource = texture.baseTexture.resource as { source?: unknown } | undefined;
  const source = resource?.source as CanvasImageSource | undefined;
  if (!source) {
    return null;
  }
  const canvas = createCanvasLike(w, h);
  if (!canvas) {
    return null;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  try {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
  } catch (error) {
    console.warn('[textureTopEdge] drawImage failed', error);
    return null;
  }
  let raw: Uint8ClampedArray;
  try {
    raw = ctx.getImageData(0, 0, w, h).data;
  } catch (error) {
    console.warn('[textureTopEdge] getImageData failed', error);
    return null;
  }
  const out = new Float32Array(w);
  for (let x = 0; x < w; x += 1) {
    let foundY = h - 1;
    for (let y = 0; y < h; y += 1) {
      const a = raw[(y * w + x) * 4 + 3];
      if (a !== undefined && a >= alphaThreshold) {
        foundY = y;
        break;
      }
    }
    out[x] = foundY;
  }
  if (smoothRadius <= 0) {
    return { edge: out, texW: w, texH: h };
  }
  const smooth = new Float32Array(w);
  for (let x = 0; x < w; x += 1) {
    let sum = 0;
    let cnt = 0;
    for (let k = -smoothRadius; k <= smoothRadius; k += 1) {
      const xi = Math.min(w - 1, Math.max(0, x + k));
      sum += out[xi] ?? 0;
      cnt += 1;
    }
    smooth[x] = sum / Math.max(1, cnt);
  }
  return { edge: smooth, texW: w, texH: h };
}

/**
 * 给定贴图的水平归一化位置 t in [0, 1]（左→右），按曲线返回行号 y（在 [0, texH-1] 内）。
 */
export function sampleEdgeAt(edge: TextureTopEdge, t: number): number {
  const tw = edge.texW;
  const idx = Math.max(0, Math.min(tw - 1, Math.round(t * (tw - 1))));
  return edge.edge[idx] ?? edge.texH - 1;
}
