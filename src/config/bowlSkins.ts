import { BOWL_IMAGES_ROOT } from '@/config/bowlAssets';

export const BOWL_SOUP_KEYS = [
  'milk',
  'berry_tomato',
  'matcha',
  'mango_coconut',
  'taro_purple',
  'cocoa',
] as const;

export const BOWL_RIM_KEYS = [
  'crystal',
  'pink_ceramic',
  'mint_glass',
  'sesame_clay',
  'gold_porcelain',
  'star_glass',
] as const;

export type BowlSoupKey = (typeof BOWL_SOUP_KEYS)[number];
export type BowlRimKey = (typeof BOWL_RIM_KEYS)[number];

export const DEFAULT_BOWL_SOUP_KEY: BowlSoupKey = 'milk';
export const DEFAULT_BOWL_RIM_KEY: BowlRimKey = 'crystal';

export const BOWL_SOUP_ASSETS: Record<BowlSoupKey, string> = {
  milk: `${BOWL_IMAGES_ROOT}/bowl_soup_milk.png`,
  berry_tomato: `${BOWL_IMAGES_ROOT}/bowl_soup_berry_tomato.png`,
  matcha: `${BOWL_IMAGES_ROOT}/bowl_soup_matcha.png`,
  mango_coconut: `${BOWL_IMAGES_ROOT}/bowl_soup_mango_coconut.png`,
  taro_purple: `${BOWL_IMAGES_ROOT}/bowl_soup_taro_purple.png`,
  cocoa: `${BOWL_IMAGES_ROOT}/bowl_soup_cocoa.png`,
};

export const BOWL_RIM_ASSETS: Record<BowlRimKey, string> = {
  crystal: `${BOWL_IMAGES_ROOT}/bowl_crystal_rim.png`,
  pink_ceramic: `${BOWL_IMAGES_ROOT}/bowl_rim_pink_ceramic.png`,
  mint_glass: `${BOWL_IMAGES_ROOT}/bowl_rim_mint_glass.png`,
  sesame_clay: `${BOWL_IMAGES_ROOT}/bowl_rim_sesame_clay.png`,
  gold_porcelain: `${BOWL_IMAGES_ROOT}/bowl_rim_gold_porcelain.png`,
  star_glass: `${BOWL_IMAGES_ROOT}/bowl_rim_star_glass.png`,
};

export const BOWL_SOUP_UNLOCKS: Array<{ levelNumber: number; key: BowlSoupKey; label: string }> = [
  { levelNumber: 1, key: 'milk', label: '奶白汤' },
  { levelNumber: 4, key: 'berry_tomato', label: '草莓番茄红汤' },
  { levelNumber: 9, key: 'matcha', label: '抹茶绿汤' },
  { levelNumber: 14, key: 'mango_coconut', label: '芒果椰乳黄汤' },
  { levelNumber: 20, key: 'taro_purple', label: '芋泥紫汤' },
  { levelNumber: 26, key: 'cocoa', label: '可可巧克力汤' },
];

export const BOWL_RIM_UNLOCKS: Array<{ levelNumber: number; key: BowlRimKey; label: string }> = [
  { levelNumber: 1, key: 'crystal', label: '水晶碗' },
  { levelNumber: 6, key: 'pink_ceramic', label: '樱粉陶瓷碗' },
  { levelNumber: 11, key: 'mint_glass', label: '青釉玻璃碗' },
  { levelNumber: 17, key: 'sesame_clay', label: '黑芝麻陶土碗' },
  { levelNumber: 23, key: 'gold_porcelain', label: '金边白瓷碗' },
  { levelNumber: 29, key: 'star_glass', label: '星空玻璃碗' },
];

export interface BowlSkinUnlock {
  kind: 'soup' | 'bowl';
  key: BowlSoupKey | BowlRimKey;
  label: string;
  textureKey: string;
}

export function getBowlSoupKeyForLevel(levelNumber: number): BowlSoupKey {
  let key = DEFAULT_BOWL_SOUP_KEY;
  for (const unlock of BOWL_SOUP_UNLOCKS) {
    if (levelNumber >= unlock.levelNumber) {
      key = unlock.key;
    }
  }
  return key;
}

export function getBowlRimKeyForLevel(levelNumber: number): BowlRimKey {
  let key = DEFAULT_BOWL_RIM_KEY;
  for (const unlock of BOWL_RIM_UNLOCKS) {
    if (levelNumber >= unlock.levelNumber) {
      key = unlock.key;
    }
  }
  return key;
}

export function getBowlSkinUnlocksInLevel(levelNumber: number): BowlSkinUnlock[] {
  return [
    ...BOWL_SOUP_UNLOCKS.filter((unlock) => unlock.levelNumber === levelNumber).map((unlock) => ({
      kind: 'soup' as const,
      key: unlock.key,
      label: unlock.label,
      textureKey: `bowl_soup_${unlock.key}`,
    })),
    ...BOWL_RIM_UNLOCKS.filter((unlock) => unlock.levelNumber === levelNumber).map((unlock) => ({
      kind: 'bowl' as const,
      key: unlock.key,
      label: unlock.label,
      textureKey: `bowl_rim_${unlock.key}`,
    })),
  ];
}
