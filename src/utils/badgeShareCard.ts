import type { BowlBadgeDef } from '@/config/bowlBadges';

const CARD_W = 1000;
const CARD_H = 800;
const DEFAULT_SHARE_BG = 'subpackages/bowl_game/assets/images/badge_share_card_bg.jpg';

interface BadgeShareCardOptions {
  badge: BowlBadgeDef;
}

type CanvasLike = HTMLCanvasElement & {
  toTempFilePathSync?: (options?: { fileType?: 'jpg' | 'png'; quality?: number }) => string;
};

export async function createBadgeShareCard(options: BadgeShareCardOptions): Promise<string | null> {
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  try {
    const [bg, badgeImage] = await Promise.all([
      loadImage(DEFAULT_SHARE_BG),
      loadImage(options.badge.asset),
    ]);

    drawCover(ctx, bg, CARD_W, CARD_H);

    drawHeader(ctx);
    drawBadgeGlow(ctx, CARD_W / 2, 342);
    drawImageContain(ctx, badgeImage, CARD_W / 2 - 170, 172, 340, 300);
    drawBadgeTitle(ctx, options.badge.title);
    drawFooter(ctx);

    return exportCanvas(canvas);
  } catch (error) {
    console.warn('[badgeShareCard] create failed', error);
    return null;
  }
}

function createCanvas(width: number, height: number): CanvasLike {
  const api = typeof wx !== 'undefined' ? wx : null;
  const canvas = api?.createCanvas ? (api.createCanvas() as CanvasLike) : document.createElement('canvas') as CanvasLike;
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const api = typeof wx !== 'undefined' ? wx : null;
    const image = api?.createImage ? api.createImage() as HTMLImageElement : new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`load image failed: ${src}`));
    try {
      image.src = src;
    } catch (error) {
      reject(error);
    }
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  targetW: number,
  targetH: number,
): void {
  const iw = Math.max(1, image.width);
  const ih = Math.max(1, image.height);
  const scale = Math.max(targetW / iw, targetH / ih);
  const w = iw * scale;
  const h = ih * scale;
  ctx.drawImage(image, (targetW - w) / 2, (targetH - h) / 2, w, h);
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
): void {
  const iw = Math.max(1, image.width);
  const ih = Math.max(1, image.height);
  const scale = Math.min(maxW / iw, maxH / ih);
  const w = iw * scale;
  const h = ih * scale;
  ctx.drawImage(image, x + (maxW - w) / 2, y + (maxH - h) / 2, w, h);
}

function drawHeader(ctx: CanvasRenderingContext2D): void {
  drawText(ctx, '我解锁了新徽章！', CARD_W / 2, 110, {
    fontSize: 58,
    fill: '#fff3b8',
    stroke: '#7a3517',
    strokeWidth: 10,
  });
}

function drawBadgeGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 230);
  grad.addColorStop(0, 'rgba(255, 246, 170, 0.88)');
  grad.addColorStop(0.58, 'rgba(255, 205, 92, 0.24)');
  grad.addColorStop(1, 'rgba(255, 205, 92, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 230, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 245, 190, 0.65)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 16; i += 1) {
    const a = (Math.PI * 2 * i) / 16;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 128, cy + Math.sin(a) * 128);
    ctx.lineTo(cx + Math.cos(a) * 222, cy + Math.sin(a) * 222);
    ctx.stroke();
  }
}

function drawBadgeTitle(ctx: CanvasRenderingContext2D, title: string): void {
  drawText(ctx, title, CARD_W / 2, 542, {
    fontSize: 46,
    fill: '#ffffff',
    stroke: '#6b3b1f',
    strokeWidth: 8,
  });
}

function drawFooter(ctx: CanvasRenderingContext2D): void {
  drawText(ctx, '来挑战一碗清凉水果捞', CARD_W / 2, 655, {
    fontSize: 38,
    fill: '#fff5dc',
    stroke: '#57301c',
    strokeWidth: 7,
  });
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { fontSize: number; fill: string; stroke: string; strokeWidth: number },
): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.font = `900 ${opts.fontSize}px sans-serif`;
  ctx.strokeStyle = opts.stroke;
  ctx.lineWidth = opts.strokeWidth;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = opts.fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function exportCanvas(canvas: CanvasLike): string | null {
  try {
    if (typeof canvas.toTempFilePathSync === 'function') {
      return canvas.toTempFilePathSync({ fileType: 'jpg', quality: 0.9 });
    }
    if (typeof canvas.toDataURL === 'function') {
      return canvas.toDataURL('image/jpeg', 0.9);
    }
  } catch (error) {
    console.warn('[badgeShareCard] export failed', error);
  }
  return null;
}
