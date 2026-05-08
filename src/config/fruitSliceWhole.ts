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

// fruit_book/ 整体下沉到 bowl_game 分包，主包零体积
const FRUIT_BOOK_DIR = 'subpackages/bowl_game/assets/images/fruit_book';

export const FRUIT_SLICE_WHOLE_PATH: Record<FruitSliceId, string> = {
  watermelon: `${FRUIT_BOOK_DIR}/fruit_v5_watermelon_whole.png`,
  strawberry: `${FRUIT_BOOK_DIR}/fruit_v5_strawberry_whole.png`,
  pineapple: `${FRUIT_BOOK_DIR}/fruit_v5_pineapple_whole.png`,
  peach: `${FRUIT_BOOK_DIR}/fruit_peach_a.png`,
  orange: `${FRUIT_BOOK_DIR}/fruit_orange_a.png`,
  mango: `${FRUIT_BOOK_DIR}/fruit_mango_a.png`,
  lemon: `${FRUIT_BOOK_DIR}/fruit_lemon_a.png`,
  kiwi: `${FRUIT_BOOK_DIR}/fruit_kiwi_a.png`,
  grape: `${FRUIT_BOOK_DIR}/fruit_grape_a.png`,
  blueberry: `${FRUIT_BOOK_DIR}/fruit_blueberry_a.png`,
  banana: `${FRUIT_BOOK_DIR}/fruit_banana_a.png`,
  apple: `${FRUIT_BOOK_DIR}/fruit_apple_a.png`,
};

export function fruitSliceWholeTextureKey(id: FruitId): string {
  return `slice_whole_${id}`;
}
