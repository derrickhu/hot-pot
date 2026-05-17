import type { FruitId } from '@/config/fruits';

export interface DailyDrinkRecipe {
  readonly title: string;
  readonly intro: string;
  readonly steps: readonly string[];
}

export interface DailyThemeLevelDef {
  readonly themeId: string;
  readonly themeName: string;
  readonly drinkName: string;
  readonly targetFruitIds: readonly FruitId[];
  readonly targetCount: number;
  readonly targetCopies: number;
  readonly fruitIds: readonly FruitId[];
  readonly positioningText: string;
  readonly recipeUnlock: DailyDrinkRecipe;
  readonly bufferSize: number;
  readonly toolCounts: {
    readonly shuffle: number;
    readonly undo: number;
    readonly lift: number;
  };
  readonly layoutSeed: number;
}

export const DAILY_LIMITED_LEVELS: readonly DailyThemeLevelDef[] = [
  {
    themeId: 'pineapple_ice',
    themeName: '今日主题：菠萝冰',
    drinkName: '菠萝冰',
    targetFruitIds: ['pineapple'],
    targetCount: 15,
    targetCopies: 20,
    fruitIds: [
      'pineapple',
      'apple',
      'banana',
      'blueberry',
      'cantaloupe',
      'cherry',
      'dragonfruit',
      'grape',
      'grape_green',
      'kiwi',
      'lemon',
      'lychee',
      'mango',
      'orange',
      'peach',
      'raspberry',
      'strawberry',
      'watermelon',
      'young_coconut',
      'sago',
    ],
    positioningText: '把菠萝片捞进冰碗，做一碗清爽菠萝冰',
    recipeUnlock: {
      title: '菠萝冰制作方法',
      intro: '酸甜菠萝配碎冰，适合做成夏日限定饮品。',
      steps: ['菠萝切小片，先铺满冰碗', '加入碎冰和少量椰青水', '点缀薄荷或西米，搅匀后开吃'],
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: 2,
      undo: 2,
      lift: 2,
    },
    layoutSeed: 20260516,
  },
];

export function getDailyLimitedLevel(index = 0): DailyThemeLevelDef {
  const safeIndex = ((Math.floor(index) % DAILY_LIMITED_LEVELS.length) + DAILY_LIMITED_LEVELS.length)
    % DAILY_LIMITED_LEVELS.length;
  return DAILY_LIMITED_LEVELS[safeIndex];
}
