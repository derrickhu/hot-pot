import * as PIXI from 'pixi.js';
import type { BowlBadgeDef } from '@/config/bowlBadges';

export interface BowlBadgeIconOptions {
  locked?: boolean;
}

function fitSprite(sp: PIXI.Sprite, texture: PIXI.Texture, size: number): void {
  sp.anchor.set(0.5);
  const maxSide = size * 0.9;
  if (texture.width >= texture.height) {
    sp.width = maxSide;
    sp.height = texture.width > 0 ? (texture.height / texture.width) * maxSide : maxSide;
  } else {
    sp.height = maxSide;
    sp.width = texture.height > 0 ? (texture.width / texture.height) * maxSide : maxSide;
  }
}

function makeLockedBadgeFilter(): PIXI.ColorMatrixFilter {
  const filter = new PIXI.ColorMatrixFilter();
  filter.matrix = [
    0.25, 0.25, 0.25, 0, 0.38,
    0.25, 0.25, 0.25, 0, 0.38,
    0.25, 0.25, 0.25, 0, 0.38,
    0, 0, 0, 1, 0,
  ];
  return filter;
}

function drawFruit(g: PIXI.Graphics, x: number, y: number, r: number, color: number): void {
  g.lineStyle(2, 0xffffff, 0.9);
  g.beginFill(color);
  g.drawCircle(x, y, r);
  g.endFill();
  g.lineStyle(0);
  g.beginFill(0xffffff, 0.42);
  g.drawCircle(x - r * 0.32, y - r * 0.34, r * 0.28);
  g.endFill();
}

function drawCupBadge(g: PIXI.Graphics, badge: BowlBadgeDef, size: number): void {
  const s = size / 120;
  const cupTopY = -20 * s;
  const cupBotY = 36 * s;
  const cupTopW = 56 * s;
  const cupBotW = 40 * s;

  g.lineStyle(4 * s, 0xffffff, 0.95);
  g.beginFill(0xeafaff, 0.72);
  g.moveTo(-cupTopW / 2, cupTopY);
  g.lineTo(cupTopW / 2, cupTopY);
  g.lineTo(cupBotW / 2, cupBotY);
  g.quadraticCurveTo(0, cupBotY + 8 * s, -cupBotW / 2, cupBotY);
  g.closePath();
  g.endFill();

  g.lineStyle(0);
  g.beginFill(badge.drinkColor, 0.9);
  g.moveTo(-23 * s, -4 * s);
  g.lineTo(23 * s, -4 * s);
  g.lineTo(17 * s, 28 * s);
  g.quadraticCurveTo(0, 34 * s, -17 * s, 28 * s);
  g.closePath();
  g.endFill();

  g.lineStyle(5 * s, badge.accentColor, 0.95);
  g.moveTo(18 * s, -46 * s);
  g.lineTo(2 * s, -12 * s);

  drawFruit(g, -16 * s, -18 * s, 10 * s, badge.fruitColors[0] ?? 0xff6b7b);
  drawFruit(g, 10 * s, -24 * s, 9 * s, badge.fruitColors[1] ?? 0xffd65a);
  drawFruit(g, 22 * s, -8 * s, 7 * s, badge.fruitColors[2] ?? 0x7ed86a);
}

function drawBowlBadge(g: PIXI.Graphics, badge: BowlBadgeDef, size: number): void {
  const s = size / 120;

  g.lineStyle(4 * s, 0xffffff, 0.96);
  g.beginFill(0xeefbff, 0.88);
  g.drawEllipse(0, 4 * s, 44 * s, 20 * s);
  g.endFill();

  g.lineStyle(0);
  g.beginFill(badge.drinkColor, 0.92);
  g.drawEllipse(0, 0, 36 * s, 14 * s);
  g.endFill();

  g.lineStyle(4 * s, 0xffffff, 0.88);
  g.beginFill(badge.accentColor, 0.68);
  g.moveTo(-38 * s, 8 * s);
  g.quadraticCurveTo(-28 * s, 44 * s, 0, 48 * s);
  g.quadraticCurveTo(28 * s, 44 * s, 38 * s, 8 * s);
  g.quadraticCurveTo(0, 22 * s, -38 * s, 8 * s);
  g.endFill();

  drawFruit(g, -20 * s, -12 * s, 10 * s, badge.fruitColors[0] ?? 0xff6b7b);
  drawFruit(g, 4 * s, -18 * s, 11 * s, badge.fruitColors[1] ?? 0xffd65a);
  drawFruit(g, 24 * s, -4 * s, 8 * s, badge.fruitColors[2] ?? 0x7ed86a);
}

export function mountBowlBadgeIcon(
  target: PIXI.Container,
  badge: BowlBadgeDef,
  texture: PIXI.Texture | null,
  size: number,
  options: BowlBadgeIconOptions = {},
): void {
  target.removeChildren();

  const root = new PIXI.Container();
  root.eventMode = 'none';
  root.position.set(size / 2, size / 2);
  if (options.locked) {
    root.filters = [makeLockedBadgeFilter()];
    root.alpha = 0.78;
  }
  target.addChild(root);

  if (texture) {
    const sp = new PIXI.Sprite(texture);
    fitSprite(sp, texture, size);
    root.addChild(sp);
    return;
  }

  const g = new PIXI.Graphics();
  g.lineStyle(size * 0.045, 0xffffff, 1);
  g.beginFill(0x6bd9ff, 0.94);
  g.drawCircle(0, 0, size * 0.47);
  g.endFill();
  g.lineStyle(size * 0.035, badge.accentColor, 0.95);
  g.drawCircle(0, 0, size * 0.39);
  g.lineStyle(0);
  g.beginFill(0xffffff, 0.25);
  g.drawEllipse(-size * 0.13, -size * 0.22, size * 0.2, size * 0.08);
  g.endFill();

  if (badge.vessel === 'cup') {
    drawCupBadge(g, badge, size);
  } else {
    drawBowlBadge(g, badge, size);
  }

  g.lineStyle(0);
  g.beginFill(badge.garnishColor, 0.95);
  g.drawEllipse(-size * 0.22, -size * 0.32, size * 0.08, size * 0.035);
  g.drawEllipse(size * 0.24, -size * 0.28, size * 0.07, size * 0.03);
  g.endFill();
  root.addChild(g);
}
