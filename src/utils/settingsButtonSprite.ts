import * as PIXI from 'pixi.js';
import { TextureCache } from '@/utils/TextureCache';

export const SETTINGS_BTN_TEXTURE_KEY = 'ui_settings_btn';
export const SETTINGS_BTN_PATH = 'assets/images/settings_btn.png';

export function loadSettingsButtonTexture(): Promise<PIXI.Texture | null> {
  return TextureCache.load(SETTINGS_BTN_TEXTURE_KEY, SETTINGS_BTN_PATH);
}

/**
 * 将设置按钮贴图放入 root（居中）；无贴图时用原矢量兜底。
 * @param targetSize 逻辑像素边长约等于按钮直径
 */
export function mountSettingsButtonSprite(
  root: PIXI.Container,
  tex: PIXI.Texture | null,
  targetSize: number,
): void {
  root.removeChildren();
  const half = targetSize / 2;
  if (!tex) {
    const g = new PIXI.Graphics();
    g.beginFill(0x3d2a22, 0.88);
    g.drawCircle(0, 0, half);
    g.endFill();
    root.addChild(g);
    const t = new PIXI.Text('⚙', { fontSize: Math.max(18, targetSize * 0.48), fill: 0xf5e6c8 });
    t.anchor.set(0.5);
    root.addChild(t);
    root.hitArea = new PIXI.Circle(0, 0, half + 4);
    return;
  }
  const sp = new PIXI.Sprite(tex);
  sp.anchor.set(0.5);
  const s = targetSize / Math.max(tex.width, tex.height);
  sp.scale.set(s);
  root.addChild(sp);
  root.hitArea = new PIXI.Circle(0, 0, half + 2);
}
