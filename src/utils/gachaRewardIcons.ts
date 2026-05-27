import * as PIXI from 'pixi.js';
import type { GachaReward } from '@/config/economy';
import { TextureCache } from '@/utils/TextureCache';

const GACHA_IMAGE_DIR = 'subpackages/gacha_assets/assets/images/gacha';
export const GACHA_BOWL_TOOL_REWARD_ICONS_KEY = 'gacha_pool_bowl_tool_icons';
export const GACHA_BOWL_TOOL_REWARD_ICONS_PATH = `${GACHA_IMAGE_DIR}/pool_bowl_tool_icons.png`;
export const GACHA_FRUIT_SLICE_TOOL_ICONS_KEY = 'gacha_pool_fruit_tool_icons';
export const GACHA_FRUIT_SLICE_TOOL_ICONS_PATH = `${GACHA_IMAGE_DIR}/pool_fruit_tool_icons.png`;
export const GACHA_BUNDLE_REWARD_ICONS_KEY = 'gacha_pool_bundle_icons';
export const GACHA_BUNDLE_REWARD_ICONS_PATH = `${GACHA_IMAGE_DIR}/pool_bundle_icons.png`;
export const GACHA_RESULT_TITLE_RIBBON_KEY = 'gacha_result_title_ribbon';
export const GACHA_RESULT_TITLE_RIBBON_PATH = `${GACHA_IMAGE_DIR}/gacha_result_title_ribbon.png`;

export async function preloadGachaRewardIconTextures(): Promise<void> {
  await Promise.all([
    TextureCache.load(GACHA_BOWL_TOOL_REWARD_ICONS_KEY, GACHA_BOWL_TOOL_REWARD_ICONS_PATH),
    TextureCache.load(GACHA_FRUIT_SLICE_TOOL_ICONS_KEY, GACHA_FRUIT_SLICE_TOOL_ICONS_PATH),
    TextureCache.load(GACHA_BUNDLE_REWARD_ICONS_KEY, GACHA_BUNDLE_REWARD_ICONS_PATH),
    TextureCache.load(GACHA_RESULT_TITLE_RIBBON_KEY, GACHA_RESULT_TITLE_RIBBON_PATH),
  ]);
}

export function getBowlToolIconTexture(kind: 'addDish' | 'remove' | 'shuffle'): PIXI.Texture | null {
  const sheet = TextureCache.get(GACHA_BOWL_TOOL_REWARD_ICONS_KEY);
  if (!sheet || sheet.width <= 4) {
    return null;
  }
  const idx = kind === 'addDish' ? 0 : kind === 'remove' ? 1 : 2;
  const cellW = Math.floor(sheet.width / 3);
  const x = cellW * idx;
  const w = idx === 2 ? sheet.width - cellW * 2 : cellW;
  return new PIXI.Texture(sheet.baseTexture, new PIXI.Rectangle(x, 0, w, sheet.height));
}

export function getFruitSliceToolIconTexture(kind: 'eliminate' | 'shuffle'): PIXI.Texture | null {
  const sheet = TextureCache.get(GACHA_FRUIT_SLICE_TOOL_ICONS_KEY);
  if (!sheet || sheet.width <= 4) {
    return null;
  }
  const half = Math.floor(sheet.width / 2);
  const rect = kind === 'eliminate'
    ? new PIXI.Rectangle(0, 0, half, sheet.height)
    : new PIXI.Rectangle(half, 0, sheet.width - half, sheet.height);
  return new PIXI.Texture(sheet.baseTexture, rect);
}

export function getBundleRewardIconTexture(
  rewards: Extract<GachaReward, { kind: 'bundle' }>['rewards'],
): PIXI.Texture | null {
  const sheet = TextureCache.get(GACHA_BUNDLE_REWARD_ICONS_KEY);
  if (!sheet || sheet.width <= 4) {
    return null;
  }
  const isFruitBundle = rewards.some((item) => item.kind === 'fruitSliceTool');
  const half = Math.floor(sheet.width / 2);
  const rect = isFruitBundle
    ? new PIXI.Rectangle(half, 0, sheet.width - half, sheet.height)
    : new PIXI.Rectangle(0, 0, half, sheet.height);
  return new PIXI.Texture(sheet.baseTexture, rect);
}

export function getRewardItemShortLabel(
  item:
    | { kind: 'bowlTool'; tool: 'addDish' | 'remove' | 'shuffle'; count: number }
    | { kind: 'fruitSliceTool'; tool: 'eliminate' | 'shuffle'; count: number },
): string {
  if (item.kind === 'bowlTool') {
    if (item.tool === 'addDish') {
      return '加菜碟';
    }
    return item.tool === 'remove' ? '移除' : '打乱';
  }
  return item.tool === 'eliminate' ? '消除' : '打乱';
}

export function createRewardIconNode(
  item:
    | { kind: 'bowlTool'; tool: 'addDish' | 'remove' | 'shuffle'; count: number }
    | { kind: 'fruitSliceTool'; tool: 'eliminate' | 'shuffle'; count: number }
    | { kind: 'coins'; count: number },
  size: number,
  coinIconBuilder?: () => PIXI.Container,
): PIXI.Container {
  const root = new PIXI.Container();
  let tex: PIXI.Texture | null = null;
  if (item.kind === 'bowlTool') {
    tex = getBowlToolIconTexture(item.tool);
  } else if (item.kind === 'fruitSliceTool') {
    tex = getFruitSliceToolIconTexture(item.tool);
  }
  if (item.kind === 'coins' && coinIconBuilder) {
    const coin = coinIconBuilder();
    const bounds = coin.getLocalBounds();
    const scale = size / Math.max(bounds.width, bounds.height, 1);
    coin.scale.set(scale);
    root.addChild(coin);
    return root;
  }
  if (tex && tex !== PIXI.Texture.EMPTY) {
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    const scale = size / Math.max(tex.width, tex.height);
    sp.scale.set(scale);
    root.addChild(sp);
    return root;
  }
  const fallback = new PIXI.Text(item.kind === 'coins' ? '币' : '道', {
    fontSize: Math.round(size * 0.42),
    fill: 0xfff06a,
    fontWeight: '900',
    stroke: 0xa83a16,
    strokeThickness: 5,
    lineJoin: 'round',
  });
  fallback.anchor.set(0.5);
  fallback.resolution = 2;
  root.addChild(fallback);
  return root;
}
