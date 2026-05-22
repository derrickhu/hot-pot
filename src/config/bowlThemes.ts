import { BOWL_IMAGES_ROOT } from '@/config/bowlAssets';

export const BOWL_THEME_KEYS = [
  'mint_waterpark',
  'tropical_fruit_stand',
  'pool_ice_drink',
  'seaside_night_market',
  'garden_picnic',
  'fruit_restaurant',
  'beach_picnic',
] as const;

export type BowlThemeKey = (typeof BOWL_THEME_KEYS)[number];

export interface BowlThemeDef {
  key: BowlThemeKey;
  label: string;
  backdropAsset: string;
  bgTop: number;
  bgBottom: number;
  header: number;
  headerAccent: number;
  board: number;
  boardAccent: number;
  hudOuter: number;
  hudInner: number;
  hudStroke: number;
  hudText: number;
  orderBubble: number;
  orderBubbleStroke: number;
  progressFill: number;
  progressFillHi: number;
  slotTint: number;
}

export const BOWL_THEMES: Record<BowlThemeKey, BowlThemeDef> = {
  mint_waterpark: {
    key: 'mint_waterpark',
    label: '薄荷水上乐园',
    backdropAsset: `${BOWL_IMAGES_ROOT}/themes/bowl_theme_mint_waterpark.png`,
    bgTop: 0xcff9df,
    bgBottom: 0xeaffcf,
    header: 0x90eadc,
    headerAccent: 0x4cc8bd,
    board: 0xa8f3df,
    boardAccent: 0x60d2c9,
    hudOuter: 0x248c91,
    hudInner: 0x3bb7b6,
    hudStroke: 0xd9fff2,
    hudText: 0xf5fff3,
    orderBubble: 0xffffee,
    orderBubbleStroke: 0x49b8a8,
    progressFill: 0x42d8c8,
    progressFillHi: 0xbffff2,
    slotTint: 0xd7fff5,
  },
  tropical_fruit_stand: {
    key: 'tropical_fruit_stand',
    label: '热带果摊',
    backdropAsset: `${BOWL_IMAGES_ROOT}/themes/bowl_theme_tropical_fruit_stand.png`,
    bgTop: 0xfff0b8,
    bgBottom: 0xffffe8,
    header: 0xd9a961,
    headerAccent: 0x75b85b,
    board: 0xe9bd77,
    boardAccent: 0xb98343,
    hudOuter: 0x5d3c1f,
    hudInner: 0x8f5d2f,
    hudStroke: 0xffde75,
    hudText: 0xfff6bd,
    orderBubble: 0xffffef,
    orderBubbleStroke: 0x8d6234,
    progressFill: 0x71cf65,
    progressFillHi: 0xdfffb1,
    slotTint: 0xfff1c9,
  },
  pool_ice_drink: {
    key: 'pool_ice_drink',
    label: '泳池冰饮',
    backdropAsset: `${BOWL_IMAGES_ROOT}/themes/bowl_theme_pool_ice_drink.png`,
    bgTop: 0xa4f2ff,
    bgBottom: 0xe6fff7,
    header: 0x7addec,
    headerAccent: 0x2ba9d2,
    board: 0xb8f4f1,
    boardAccent: 0x58cfdc,
    hudOuter: 0x217f9a,
    hudInner: 0x3bb5c8,
    hudStroke: 0xd9fbff,
    hudText: 0xf3ffff,
    orderBubble: 0xf7ffff,
    orderBubbleStroke: 0x4fbfd4,
    progressFill: 0x38c7f1,
    progressFillHi: 0xc9f7ff,
    slotTint: 0xdbfbff,
  },
  garden_picnic: {
    key: 'garden_picnic',
    label: '花园野餐',
    backdropAsset: `${BOWL_IMAGES_ROOT}/themes/bowl_theme_garden_picnic.png`,
    bgTop: 0xfff4e8,
    bgBottom: 0xf8fff0,
    header: 0xc8e8b0,
    headerAccent: 0x8bc98a,
    board: 0xe8d8b0,
    boardAccent: 0xb8c98a,
    hudOuter: 0x5a6b3f,
    hudInner: 0x7d8f6a,
    hudStroke: 0xfff6d8,
    hudText: 0xfff8ef,
    orderBubble: 0xfffff2,
    orderBubbleStroke: 0x8d9a7a,
    progressFill: 0x7fcf8a,
    progressFillHi: 0xe8ffd8,
    slotTint: 0xfff8ef,
  },
  seaside_night_market: {
    key: 'seaside_night_market',
    label: '海边夜市',
    backdropAsset: `${BOWL_IMAGES_ROOT}/themes/bowl_theme_seaside_night_market.png`,
    bgTop: 0x3e426c,
    bgBottom: 0xffba89,
    header: 0x4b3c67,
    headerAccent: 0xffc46b,
    board: 0xd8876b,
    boardAccent: 0x714e68,
    hudOuter: 0x33263e,
    hudInner: 0x5b3c61,
    hudStroke: 0xffd180,
    hudText: 0xfff0c7,
    orderBubble: 0xffefd9,
    orderBubbleStroke: 0x8d5472,
    progressFill: 0xff9f7a,
    progressFillHi: 0xffe0a0,
    slotTint: 0xffe0d4,
  },
  fruit_restaurant: {
    key: 'fruit_restaurant',
    label: '果味餐厅',
    backdropAsset: `${BOWL_IMAGES_ROOT}/themes/bowl_theme_fruit_restaurant.png`,
    bgTop: 0xfff0e8,
    bgBottom: 0xfffff5,
    header: 0xe8c4a8,
    headerAccent: 0xc98a6a,
    board: 0xf0d4b8,
    boardAccent: 0xb88868,
    hudOuter: 0x6b4030,
    hudInner: 0x9a6048,
    hudStroke: 0xffe8d0,
    hudText: 0xfff8ef,
    orderBubble: 0xfffff5,
    orderBubbleStroke: 0xa07058,
    progressFill: 0xe89070,
    progressFillHi: 0xffe0c8,
    slotTint: 0xfff0e8,
  },
  beach_picnic: {
    key: 'beach_picnic',
    label: '沙滩野餐',
    backdropAsset: `${BOWL_IMAGES_ROOT}/themes/bowl_theme_beach_picnic.png`,
    bgTop: 0xd4f4ff,
    bgBottom: 0xfff8e8,
    header: 0x8ad4e8,
    headerAccent: 0x4ab8d8,
    board: 0xc8e8f0,
    boardAccent: 0x68b8d0,
    hudOuter: 0x2a6888,
    hudInner: 0x48a0b8,
    hudStroke: 0xe8ffff,
    hudText: 0xf5ffff,
    orderBubble: 0xf7ffff,
    orderBubbleStroke: 0x58a8c8,
    progressFill: 0x48c8e8,
    progressFillHi: 0xc8f0ff,
    slotTint: 0xe8f8ff,
  },
};

export const DEFAULT_BOWL_THEME_KEY: BowlThemeKey = 'tropical_fruit_stand';

const THEME_UNLOCKS: Array<{ levelNumber: number; key: BowlThemeKey }> = [
  { levelNumber: 1, key: 'tropical_fruit_stand' },
  { levelNumber: 4, key: 'mint_waterpark' },
  { levelNumber: 7, key: 'pool_ice_drink' },
  { levelNumber: 10, key: 'garden_picnic' },
  { levelNumber: 13, key: 'seaside_night_market' },
  { levelNumber: 16, key: 'fruit_restaurant' },
  { levelNumber: 19, key: 'beach_picnic' },
  { levelNumber: 22, key: 'tropical_fruit_stand' },
  { levelNumber: 25, key: 'mint_waterpark' },
  { levelNumber: 28, key: 'pool_ice_drink' },
  { levelNumber: 31, key: 'garden_picnic' },
  { levelNumber: 34, key: 'seaside_night_market' },
  { levelNumber: 37, key: 'fruit_restaurant' },
  { levelNumber: 40, key: 'beach_picnic' },
];

export function getBowlThemeKeyForLevel(levelNumber: number): BowlThemeKey {
  let key = DEFAULT_BOWL_THEME_KEY;
  for (const unlock of THEME_UNLOCKS) {
    if (levelNumber >= unlock.levelNumber) {
      key = unlock.key;
    }
  }
  return key;
}

export function getBowlTheme(key: BowlThemeKey): BowlThemeDef {
  return BOWL_THEMES[key] ?? BOWL_THEMES[DEFAULT_BOWL_THEME_KEY];
}
