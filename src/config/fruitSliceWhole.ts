import type { FruitId } from '@/config/fruits';

/**
 * 果切画面上方使用「完整水果」主包贴图（与碗内切片资源分离）
 */
export const FRUIT_SLICE_IDS = [
  'blueberry',
  'lemon',
  'orange',
  'strawberry',
  'apple',
  'banana',
  'grape',
  'kiwi',
  'cucumber',
  'peach',
  'pineapple',
  'watermelon',
  'mango',
  'mandarin',
  'cantaloupe',
  'honeydew',
  'young_coconut',
  'lychee',
  'bayberry',
  'passionfruit',
  'grapefruit',
  'starfruit',
  'durian',
  'dragonfruit',
] as const satisfies readonly FruitId[];

export type FruitSliceId = (typeof FRUIT_SLICE_IDS)[number];

// fruit_book/ 整体下沉到 bowl_game 分包，主包零体积
const FRUIT_BOOK_DIR = 'subpackages/catalog_assets/assets/images/fruit_book';

export const FRUIT_SLICE_WHOLE_PATH: Record<FruitSliceId, string> = {
  blueberry: `${FRUIT_BOOK_DIR}/fruit_blueberry_a.png`,
  lemon: `${FRUIT_BOOK_DIR}/fruit_lemon_a.png`,
  orange: `${FRUIT_BOOK_DIR}/fruit_orange_a.png`,
  strawberry: `${FRUIT_BOOK_DIR}/fruit_v5_strawberry_whole.png`,
  apple: `${FRUIT_BOOK_DIR}/fruit_apple_a.png`,
  banana: `${FRUIT_BOOK_DIR}/fruit_banana_a.png`,
  grape: `${FRUIT_BOOK_DIR}/fruit_grape_a.png`,
  kiwi: `${FRUIT_BOOK_DIR}/fruit_kiwi_a.png`,
  cucumber: `${FRUIT_BOOK_DIR}/fruit_cucumber_whole.png`,
  peach: `${FRUIT_BOOK_DIR}/fruit_peach_a.png`,
  pineapple: `${FRUIT_BOOK_DIR}/fruit_v5_pineapple_whole.png`,
  watermelon: `${FRUIT_BOOK_DIR}/fruit_v5_watermelon_whole.png`,
  mango: `${FRUIT_BOOK_DIR}/fruit_mango_a.png`,
  mandarin: `${FRUIT_BOOK_DIR}/fruit_mandarin_whole.png`,
  cantaloupe: `${FRUIT_BOOK_DIR}/fruit_cantaloupe_whole.png`,
  honeydew: `${FRUIT_BOOK_DIR}/fruit_honeydew_whole.png`,
  young_coconut: `${FRUIT_BOOK_DIR}/fruit_young_coconut_whole.png`,
  lychee: `${FRUIT_BOOK_DIR}/fruit_lychee_whole.png`,
  bayberry: `${FRUIT_BOOK_DIR}/fruit_bayberry_whole.png`,
  passionfruit: `${FRUIT_BOOK_DIR}/fruit_passionfruit_whole.png`,
  grapefruit: `${FRUIT_BOOK_DIR}/fruit_grapefruit_whole.png`,
  starfruit: `${FRUIT_BOOK_DIR}/fruit_starfruit_whole.png`,
  durian: `${FRUIT_BOOK_DIR}/fruit_durian_whole.png`,
  dragonfruit: `${FRUIT_BOOK_DIR}/fruit_dragonfruit_whole.png`,
};

export function fruitSliceWholeTextureKey(id: FruitId): string {
  return `slice_whole_${id}`;
}
