import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TextureCache } from '@/utils/TextureCache';
import { getCoinBalance } from '@/game/Wallet';

/**
 * 通用金币显示资源路径，所有场景共用同一张贴图与同一套布局，
 * 避免不同入口分别维护尺寸/绘制兜底。
 */
export const COIN_ICON_TEXTURE_KEY = 'game_coin_icon';
export const COIN_ICON_TEXTURE_PATH = 'assets/images/coin_icon.png';

/** 标准金币条尺寸：左对齐，整体高度与返回按钮（54）相近。 */
const COIN_BAR_HEIGHT = 46;
const COIN_BAR_WIDTH = 132;
const COIN_ICON_TARGET = 50;
const COIN_ICON_CENTER_X = 4;
const COIN_LABEL_OFFSET_X = 36;

/**
 * 通用金币条：左对齐的金色胶囊条，带金币图标 + 数字。
 * 外部传入「左中点」坐标，需要刷新数字时调用 refresh()。
 */
export class CoinBar extends PIXI.Container {
  private readonly bg = new PIXI.Graphics();
  private readonly iconRoot = new PIXI.Container();
  private readonly label: PIXI.Text;

  constructor() {
    super();
    this.eventMode = 'none';

    this.bg.beginFill(0xd9fff1, 0.9);
    this.bg.lineStyle(2, 0xffffff, 0.7);
    this.bg.drawRoundedRect(-4, -COIN_BAR_HEIGHT / 2, COIN_BAR_WIDTH, COIN_BAR_HEIGHT, COIN_BAR_HEIGHT / 2);
    this.bg.endFill();
    this.bg.beginFill(0xffffff, 0.22);
    this.bg.drawRoundedRect(20, -COIN_BAR_HEIGHT / 2 + 5, COIN_BAR_WIDTH - 40, 14, 7);
    this.bg.endFill();
    this.addChild(this.bg);

    this.iconRoot.position.set(COIN_ICON_CENTER_X, 0);
    this.addChild(this.iconRoot);

    this.label = new PIXI.Text('0', {
      fontSize: 26,
      fill: 0x1f5a62,
      fontWeight: '900',
      stroke: 0xeaffff,
      strokeThickness: 3,
      lineJoin: 'round',
    });
    this.label.anchor.set(0, 0.5);
    this.label.position.set(COIN_LABEL_OFFSET_X, 0);
    this.label.resolution = 2;
    this.addChild(this.label);

    this.refreshIcon();
    this.refresh();
  }

  refresh(): void {
    this.label.text = String(getCoinBalance());
  }

  /** 贴图加载完成后调用一次以替换绘制兜底。 */
  refreshIcon(): void {
    this.iconRoot.removeChildren();
    this.iconRoot.addChild(createCoinIcon(COIN_ICON_TARGET / 2));
  }

  /** 数字刷新后的反馈：金币图标弹动 + 数字短暂放大高亮。 */
  bump(): void {
    let elapsed = 0;
    const duration = 0.36;
    const baseLabelScale = 1;
    const tick = (): void => {
      elapsed += Game.ticker.deltaMS / 1000;
      const p = Math.min(elapsed / duration, 1);
      const bump = 1 + Math.sin(p * Math.PI) * 0.32;
      this.iconRoot.scale.set(bump);
      this.label.scale.set(baseLabelScale + Math.sin(p * Math.PI) * 0.18);
      if (p >= 1) {
        this.iconRoot.scale.set(1);
        this.label.scale.set(baseLabelScale);
        Game.ticker.remove(tick);
      }
    };
    Game.ticker.add(tick);
  }
}

/**
 * 通用金币图标：优先使用 TextureCache 内的统一贴图；尚未加载时回退绘制版。
 * 用于结算弹层等需要更大尺寸的金币插画。
 */
export function createCoinIcon(radius: number): PIXI.Container {
  const root = new PIXI.Container();
  const tex = TextureCache.get(COIN_ICON_TEXTURE_KEY);
  if (tex) {
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    const sc = (radius * 2) / Math.max(tex.width, tex.height);
    sp.scale.set(sc);
    root.addChild(sp);
    return root;
  }
  const coin = new PIXI.Graphics();
  coin.beginFill(0xffb82e);
  coin.lineStyle(Math.max(3, radius * 0.12), 0xc47a10, 1);
  coin.drawCircle(0, 0, radius);
  coin.endFill();
  coin.beginFill(0xffe48a);
  coin.drawCircle(0, 0, radius * 0.68);
  coin.endFill();
  coin.beginFill(0xfff3b2);
  drawStar(coin, 0, 0, 5, radius * 0.45, radius * 0.2);
  coin.endFill();
  root.addChild(coin);
  return root;
}

function drawStar(g: PIXI.Graphics, cx: number, cy: number, n: number, outer: number, inner: number): void {
  const step = Math.PI / n;
  const pts: number[] = [];
  for (let i = 0; i < n * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + i * step;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.drawPolygon(pts);
}
