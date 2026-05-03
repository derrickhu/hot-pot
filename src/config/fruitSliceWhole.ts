import type { FruitId } from '@/config/fruits';

/**
 * 果切画面上方使用「完整水果」主包贴图（与碗内切片资源分离）
 */
export const FRUIT_SLICE_IDS = [
  'watermelon',
  'strawberry',
  'pineapple',
  'peach',
  'orange',
  'mango',
  'lemon',
  'kiwi',
  'grape',
  'blueberry',
  'banana',
  'apple',
] as const satisfies readonly FruitId[];

export type FruitSliceId = (typeof FRUIT_SLICE_IDS)[number];

export const FRUIT_SLICE_WHOLE_PATH: Record<FruitSliceId, string> = {
  watermelon: 'assets/images/fruit_book/fruit_v5_watermelon_whole.png',
  strawberry: 'assets/images/fruit_book/fruit_v5_strawberry_whole.png',
  pineapple: 'assets/images/fruit_book/fruit_v5_pineapple_whole.png',
  peach: 'assets/images/fruit_book/fruit_peach_a.png',
  orange: 'assets/images/fruit_book/fruit_orange_a.png',
  mango: 'assets/images/fruit_book/fruit_mango_a.png',
  lemon: 'assets/images/fruit_book/fruit_lemon_a.png',
  kiwi: 'assets/images/fruit_book/fruit_kiwi_a.png',
  grape: 'assets/images/fruit_book/fruit_grape_a.png',
  blueberry: 'assets/images/fruit_book/fruit_blueberry_a.png',
  banana: 'assets/images/fruit_book/fruit_banana_a.png',
  apple: 'assets/images/fruit_book/fruit_apple_a.png',
};

export function fruitSliceWholeTextureKey(id: FruitId): string {
  return `slice_whole_${id}`;
}
