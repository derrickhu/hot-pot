import type { FruitId } from '@/config/fruits';

export const DAILY_LIMITED_MAX_FRUIT_TYPES = 19;
export const DAILY_LIMITED_MIN_STACK_CARDS = 210;

/** 每日限定每局每种道具（洗牌 / 撤销 / 抬起）各自可用次数上限 */
export const DAILY_LIMITED_TOOL_USES_PER_ROUND = 3;

export interface DailyDrinkRecipe {
  readonly title: string;
  readonly intro: string;
  readonly steps: readonly string[];
}

export interface DailyThemeTargetDef {
  readonly fruitId: FruitId;
  readonly requiredCount: number;
  readonly cardCopies: number;
}

export interface DailyThemeRecipeCardDef {
  readonly textureKey: string;
  readonly path: string;
  readonly catalogTitle: string;
  readonly catalogSubtitle: string;
  readonly shareTitle: string;
}

export interface DailyThemeLevelDef {
  readonly dayOfMonth: number;
  readonly themeId: string;
  readonly themeName: string;
  readonly drinkName: string;
  readonly targets: readonly DailyThemeTargetDef[];
  /** 堆叠区总卡数。每日限定必须保持满屏堆叠难度，只能大于等于 DAILY_LIMITED_MIN_STACK_CARDS。 */
  readonly totalStackCards?: number;
  readonly fruitIds: readonly FruitId[];
  readonly positioningText: string;
  readonly recipeUnlock: DailyDrinkRecipe;
  readonly recipeCard: DailyThemeRecipeCardDef;
  readonly bufferSize: number;
  readonly toolCounts: {
    readonly shuffle: number;
    readonly undo: number;
    readonly lift: number;
  };
  readonly layoutSeed: number;
}

export function getDailyLimitedPlayableFruitIds(level: DailyThemeLevelDef): readonly FruitId[] {
  const result: FruitId[] = [];
  const seen = new Set<FruitId>();
  const push = (fruitId: FruitId): void => {
    if (seen.has(fruitId) || result.length >= DAILY_LIMITED_MAX_FRUIT_TYPES) {
      return;
    }
    seen.add(fruitId);
    result.push(fruitId);
  };
  // 目标水果必须优先保留；剩余名额再补干扰水果，保证实际发牌种类不超过 19。
  for (const target of level.targets) {
    push(target.fruitId);
  }
  for (const fruitId of level.fruitIds) {
    push(fruitId);
  }
  return result;
}

const DAILY_LIMITED_COMMON_FRUITS: readonly FruitId[] = [
  'pineapple',
  'apple',
  'avocado',
  'banana',
  'bayberry',
  'blueberry',
  'cantaloupe',
  'cherry_tomato',
  'cucumber',
  'dragonfruit',
  'emblic',
  'grape_green',
  'grapefruit',
  'guava',
  'kumquat',
  'lemon',
  'lily_bulb',
  'lychee',
  'mango',
  'mint',
  'orange',
  'papaya',
  'passionfruit',
  'peach',
  'pear',
  'pomegranate',
  'strawberry',
  'watermelon',
  'young_coconut',
  'sago',
];

export const DAILY_LIMITED_LEVELS: readonly DailyThemeLevelDef[] = [
  {
    dayOfMonth: 1,
    themeId: 'pineapple_ice',
    themeName: '今日主题：菠萝冰',
    drinkName: '菠萝冰',
    targets: [
      {
        fruitId: 'pineapple',
        requiredCount: 15,
        cardCopies: 18,
      },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS,
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
    recipeCard: {
      textureKey: 'daily_limited_recipe_pineapple_sprite_slush',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/pineapple_sprite_slush_recipe_card_v3.jpg',
      catalogTitle: '菠萝冰',
      catalogSubtitle: '菠萝雪碧冰沙',
      shareTitle: '菠萝雪碧冰沙制作方法，酸甜清爽一口降温！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260516,
  },
  {
    dayOfMonth: 2,
    themeId: 'grape_cheese_ice',
    themeName: '今日主题：多肉葡萄',
    drinkName: '多肉葡萄',
    targets: [
      {
        fruitId: 'grape',
        requiredCount: 6,
        cardCopies: 9,
      },
      {
        fruitId: 'grape_green',
        requiredCount: 6,
        cardCopies: 9,
      },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 6,
    fruitIds: [
      'grape',
      'grape_green',
      'lime',
      'lemon',
      'lychee',
      'blueberry',
      'young_coconut',
      'sago',
      'apple',
      'banana',
      'cantaloupe',
      'cherry',
      'dragonfruit',
      'kiwi',
      'mango',
      'orange',
      'peach',
      'raspberry',
      'strawberry',
      'watermelon',
    ],
    positioningText: '捞起葡萄和青提，调一杯果香浓郁的多肉葡萄',
    recipeUnlock: {
      title: '多肉葡萄制作方法',
      intro: '葡萄和青提配茉莉茶，果香清甜，冰镇后更清爽。',
      steps: ['葡萄青提对半切开', '加入青柠片提香', '倒入茉莉花茶', '加入蜂蜜调味', '加入冰块轻轻搅拌'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_grape_cheese_ice',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/grape_cheese_ice_recipe_card_v3.jpg',
      catalogTitle: '多肉葡萄',
      catalogSubtitle: '葡萄青提茉莉冰饮',
      shareTitle: '多肉葡萄制作方法，清甜多汁果香浓郁！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260517,
  },
  {
    dayOfMonth: 3,
    themeId: 'peach_oolong_ice',
    themeName: '今日主题：多肉桃桃',
    drinkName: '多肉桃桃',
    targets: [{ fruitId: 'peach', requiredCount: 15, cardCopies: 18 }],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 6,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '捞起香甜桃子，做一杯夏日多肉桃桃',
    recipeUnlock: {
      title: '多肉桃桃制作方法',
      intro: '水蜜桃配茉莉花茶，果香满满，清甜解暑。',
      steps: ['桃肉去皮切块', '加入柠檬片提香', '倒入茉莉花茶', '加入蜂蜜调味', '加入冰块轻轻搅拌'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_peach_oolong',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/peach_oolong_recipe_card_v3.jpg',
      catalogTitle: '多肉桃桃',
      catalogSubtitle: '桃子茉莉冰饮',
      shareTitle: '多肉桃桃制作方法，清甜多汁果香满满！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260518,
  },
  {
    dayOfMonth: 4,
    themeId: 'passionfruit_lemon_ice',
    themeName: '今日主题：百香果爆柠檬',
    drinkName: '百香果爆柠檬',
    targets: [
      { fruitId: 'passionfruit', requiredCount: 12, cardCopies: 15 },
      { fruitId: 'lemon', requiredCount: 3, cardCopies: 6 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 18,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '收集百香果和柠檬，调一杯酸甜爆汁冰饮',
    recipeUnlock: {
      title: '百香果爆柠檬制作方法',
      intro: '百香果酸甜爆汁，搭配柠檬和茉莉茶更清爽。',
      steps: ['挖出百香果果肉', '加入柠檬片', '倒入茉莉花茶', '加入蜂蜜调味', '加入冰块搅拌'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_passionfruit_lemon',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/passionfruit_lemon_recipe_card_v3.jpg',
      catalogTitle: '百香果爆柠檬',
      catalogSubtitle: '百香果柠檬冰饮',
      shareTitle: '百香果爆柠檬制作方法，酸甜爽口冰凉一夏！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260519,
  },
  {
    dayOfMonth: 5,
    themeId: 'green_grape_jasmine_tea',
    themeName: '今日主题：青提茉莉茶',
    drinkName: '青提茉莉茶',
    targets: [{ fruitId: 'grape_green', requiredCount: 15, cardCopies: 18 }],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '捞起清甜青提，泡一杯花香冰爽茉莉茶',
    recipeUnlock: {
      title: '青提茉莉茶制作方法',
      intro: '青提清甜爽口，搭配茉莉茶花香淡雅。',
      steps: ['青提对半切开', '加入柠檬片', '倒入茉莉花茶', '加入蜂蜜调味', '加冰块搅拌'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_green_grape_jasmine',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/green_grape_jasmine_recipe_card_v3.jpg',
      catalogTitle: '青提茉莉茶',
      catalogSubtitle: '青提茉莉冰饮',
      shareTitle: '青提茉莉茶制作方法，清甜爽口花香淡雅！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260520,
  },
  {
    dayOfMonth: 6,
    themeId: 'grapefruit_jasmine_tea',
    themeName: '今日主题：西柚茉莉茶',
    drinkName: '西柚茉莉茶',
    targets: [{ fruitId: 'grapefruit', requiredCount: 15, cardCopies: 18 }],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 6,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '捞起西柚果片，做一杯清新茉莉果茶',
    recipeUnlock: {
      title: '西柚茉莉茶制作方法',
      intro: '西柚酸甜清爽，搭配茉莉茶香气更轻盈。',
      steps: ['茉莉茶泡好放凉', '西柚贴杯壁', '倒入茶汤', '加入蜂蜜和冰块', '搅拌后完成'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_grapefruit_jasmine',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/grapefruit_jasmine_recipe_card_v3.jpg',
      catalogTitle: '西柚茉莉茶',
      catalogSubtitle: '西柚茉莉冰饮',
      shareTitle: '西柚茉莉茶制作方法，清新果香颜值满分！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260521,
  },
  {
    dayOfMonth: 7,
    themeId: 'strawberry_oolong_tea',
    themeName: '今日主题：草莓乌龙茶',
    drinkName: '草莓乌龙茶',
    targets: [{ fruitId: 'strawberry', requiredCount: 15, cardCopies: 18 }],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 12,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '捞起草莓果肉，做一杯少女心乌龙冰茶',
    recipeUnlock: {
      title: '草莓乌龙茶制作方法',
      intro: '草莓压成果泥，配乌龙茶酸甜又清香。',
      steps: ['乌龙茶泡好放凉', '草莓切块压汁', '倒入乌龙茶', '加入冰块和糖水', '搅拌均匀即可'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_strawberry_oolong',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/strawberry_oolong_recipe_card_v3.jpg',
      catalogTitle: '草莓乌龙茶',
      catalogSubtitle: '草莓乌龙冰饮',
      shareTitle: '草莓乌龙茶制作方法，酸甜少女心爆棚！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260522,
  },
  {
    dayOfMonth: 8,
    themeId: 'mango_green_tea',
    themeName: '今日主题：芒果绿茶',
    drinkName: '芒果绿茶',
    targets: [{ fruitId: 'mango', requiredCount: 15, cardCopies: 18 }],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 6,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '捞起芒果小块，调一杯热带风情绿茶',
    recipeUnlock: {
      title: '芒果绿茶制作方法',
      intro: '芒果香甜浓郁，配绿茶清爽不腻。',
      steps: ['绿茶泡好放凉', '芒果去皮切块', '倒入绿茶', '加入冰块', '轻轻搅拌完成'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_mango_green_tea',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/mango_green_tea_recipe_card_v3.jpg',
      catalogTitle: '芒果绿茶',
      catalogSubtitle: '芒果绿茶冰饮',
      shareTitle: '芒果绿茶制作方法，热带果香清爽不腻！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260523,
  },
  {
    dayOfMonth: 9,
    themeId: 'lychee_rose_tea',
    themeName: '今日主题：荔枝玫瑰茶',
    drinkName: '荔枝玫瑰茶',
    targets: [{ fruitId: 'lychee', requiredCount: 15, cardCopies: 18 }],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 12,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '捞起晶莹荔枝，泡一杯玫瑰香气冰茶',
    recipeUnlock: {
      title: '荔枝玫瑰茶制作方法',
      intro: '荔枝清甜多汁，搭配玫瑰茶香气温柔。',
      steps: ['红茶冲泡放凉', '荔枝去皮去核', '压出汁水', '加入玫瑰', '倒入茶汤搅拌'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_lychee_rose',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/lychee_rose_recipe_card_v3.jpg',
      catalogTitle: '荔枝玫瑰茶',
      catalogSubtitle: '荔枝玫瑰冰饮',
      shareTitle: '荔枝玫瑰茶制作方法，清甜花香仙气满满！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260524,
  },
  {
    dayOfMonth: 10,
    themeId: 'pineapple_coconut_tea',
    themeName: '今日主题：菠萝椰子茶',
    drinkName: '菠萝椰子茶',
    targets: [
      { fruitId: 'pineapple', requiredCount: 9, cardCopies: 12 },
      { fruitId: 'young_coconut', requiredCount: 6, cardCopies: 9 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 18,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '收集菠萝和椰子，做一杯清爽解腻椰乳果茶',
    recipeUnlock: {
      title: '菠萝椰子茶制作方法',
      intro: '菠萝酸甜开胃，椰乳顺滑，清汤茶底冰镇后更解腻。',
      steps: ['绿茶泡好放凉', '菠萝切小块', '椰乳倒入杯底', '倒入清汤茶底', '加冰块搅拌'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_pineapple_coconut',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/pineapple_coconut_recipe_card_v4.jpg',
      catalogTitle: '菠萝椰子茶',
      catalogSubtitle: '菠萝椰乳冰饮',
      shareTitle: '菠萝椰子茶制作方法，清爽解腻一口降温！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260525,
  },
  {
    dayOfMonth: 11,
    themeId: 'orange_apple_tea',
    themeName: '今日主题：橙子苹果茶',
    drinkName: '橙子苹果茶',
    targets: [
      { fruitId: 'orange', requiredCount: 9, cardCopies: 12 },
      { fruitId: 'apple', requiredCount: 6, cardCopies: 9 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 12,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '收集橙子和苹果，泡一杯清甜果香红茶',
    recipeUnlock: {
      title: '橙子苹果茶制作方法',
      intro: '橙香明亮，苹果清甜，搭配红茶做成温柔果香冰茶。',
      steps: ['红茶泡好放凉', '橙子切片取汁', '苹果切成小丁', '杯中加入果肉', '倒入红茶加冰搅拌'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_orange_apple_tea',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/orange_apple_tea_recipe_card_v3.jpg',
      catalogTitle: '橙子苹果茶',
      catalogSubtitle: '橙香苹果红茶',
      shareTitle: '橙子苹果茶制作方法，橙香苹果清甜暖茶！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260526,
  },
  {
    dayOfMonth: 12,
    themeId: 'lemon_honey_black_tea',
    themeName: '今日主题：柠檬蜂蜜红茶',
    drinkName: '柠檬蜂蜜红茶',
    targets: [{ fruitId: 'lemon', requiredCount: 15, cardCopies: 18 }],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '捞起柠檬片，泡一杯暖胃经典蜂蜜红茶',
    recipeUnlock: {
      title: '柠檬蜂蜜红茶制作方法',
      intro: '柠檬清香配红茶和蜂蜜，冷热都适合。',
      steps: ['红茶冲泡放凉', '杯中加入柠檬片', '加入蜂蜜', '倒入红茶', '搅拌均匀即可'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_lemon_honey_black_tea',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/lemon_honey_black_tea_recipe_card_v3.jpg',
      catalogTitle: '柠檬蜂蜜红茶',
      catalogSubtitle: '柠檬红茶冰饮',
      shareTitle: '柠檬蜂蜜红茶制作方法，暖胃经典酸甜舒服！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260527,
  },
  {
    dayOfMonth: 13,
    themeId: 'blueberry_mulberry_tea',
    themeName: '今日主题：蓝莓桑葚茶',
    drinkName: '蓝莓桑葚茶',
    targets: [
      { fruitId: 'blueberry', requiredCount: 9, cardCopies: 12 },
      { fruitId: 'mulberry', requiredCount: 9, cardCopies: 12 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 12,
    fruitIds: [
      'peach',
      'lychee',
      'lime',
      'lemon',
      'orange',
      'grape_green',
      'blueberry',
      'mulberry',
      'strawberry',
      'mango',
      'pineapple',
      'apple',
      'pear',
      'mint',
      'sago',
      'coconut_jelly',
      'passionfruit',
      'grapefruit',
      'guava',
      'cucumber',
      'cherry',
      'bayberry',
      'kiwi',
      'watermelon',
      'cantaloupe',
    ],
    positioningText: '收集蓝莓和桑葚，调一杯酸甜浆果冰茶',
    recipeUnlock: {
      title: '蓝莓桑葚茶制作方法',
      intro: '蓝莓和桑葚果香浓郁，搭配乌龙茶清爽抗氧化。',
      steps: ['乌龙茶泡好放凉', '蓝莓桑葚洗净压汁', '倒入乌龙茶', '加入蜂蜜', '加冰块搅拌'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_blueberry_mulberry',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/blueberry_mulberry_recipe_card_v3.jpg',
      catalogTitle: '蓝莓桑葚茶',
      catalogSubtitle: '蓝莓桑葚冰饮',
      shareTitle: '蓝莓桑葚茶制作方法，酸甜浆果一口清爽！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260528,
  },
  {
    dayOfMonth: 14,
    themeId: 'watermelon_green_grape_tea',
    themeName: '今日主题：西瓜青提冰茶',
    drinkName: '西瓜青提冰茶',
    targets: [
      { fruitId: 'watermelon', requiredCount: 9, cardCopies: 12 },
      { fruitId: 'grape_green', requiredCount: 6, cardCopies: 9 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 18,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '收集西瓜和青提，调一杯清甜多汁夏日冰茶',
    recipeUnlock: {
      title: '西瓜青提冰茶制作方法',
      intro: '西瓜清甜多汁，青提爽口，搭配茉莉茶和冰块很适合夏天。',
      steps: ['西瓜切成小块', '青提对半切开', '杯中加入果肉', '倒入茉莉茶', '蜂蜜调味后加冰'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_watermelon_green_grape',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/watermelon_green_grape_tea_recipe_card_v1.jpg',
      catalogTitle: '西瓜青提冰茶',
      catalogSubtitle: '西瓜青提茉莉冰饮',
      shareTitle: '西瓜青提冰茶制作方法，清甜多汁夏日冰茶！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260529,
  },
  {
    dayOfMonth: 15,
    themeId: 'blueberry_soda_tea',
    themeName: '今日主题：蓝莓气泡茶',
    drinkName: '蓝莓气泡茶',
    targets: [{ fruitId: 'blueberry', requiredCount: 15, cardCopies: 18 }],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 6,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '捞起蓝莓果粒，做一杯酸甜浆果气泡冰饮',
    recipeUnlock: {
      title: '蓝莓气泡茶制作方法',
      intro: '蓝莓酸甜浓郁，配乌龙茶和气泡水，入口清爽有层次。',
      steps: ['蓝莓洗净压汁', '加入蜂蜜调味', '倒入乌龙茶', '加入气泡水', '放入冰块轻搅'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_blueberry_soda',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/blueberry_soda_tea_recipe_card_v1.jpg',
      catalogTitle: '蓝莓气泡茶',
      catalogSubtitle: '蓝莓气泡冰饮',
      shareTitle: '蓝莓气泡茶制作方法，酸甜浆果气泡冰饮！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260530,
  },
  {
    dayOfMonth: 16,
    themeId: 'mango_banana_smoothie',
    themeName: '今日主题：芒果香蕉冰饮',
    drinkName: '芒果香蕉冰饮',
    targets: [
      { fruitId: 'mango', requiredCount: 9, cardCopies: 12 },
      { fruitId: 'banana', requiredCount: 6, cardCopies: 9 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 12,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '收集芒果和香蕉，做一杯热带香甜顺滑冰饮',
    recipeUnlock: {
      title: '芒果香蕉冰饮制作方法',
      intro: '芒果浓郁、香蕉顺滑，和牛奶冰块搅打后香甜绵密。',
      steps: ['芒果去皮切丁', '香蕉切成小片', '加入牛奶打底', '蜂蜜调味', '放入冰块搅打'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_mango_banana_smoothie',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/mango_banana_smoothie_recipe_card_v1.jpg',
      catalogTitle: '芒果香蕉冰饮',
      catalogSubtitle: '热带香甜顺滑冰饮',
      shareTitle: '芒果香蕉冰饮制作方法，热带香甜顺滑冰饮！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260531,
  },
  {
    dayOfMonth: 17,
    themeId: 'peach_lychee_lime_tea',
    themeName: '今日主题：桃子荔枝青柠茶',
    drinkName: '桃子荔枝青柠茶',
    targets: [
      { fruitId: 'peach', requiredCount: 6, cardCopies: 9 },
      { fruitId: 'lychee', requiredCount: 6, cardCopies: 9 },
      { fruitId: 'lime', requiredCount: 3, cardCopies: 6 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 6,
    fruitIds: [
      'peach',
      'lychee',
      'lime',
      'lemon',
      'orange',
      'grape_green',
      'blueberry',
      'strawberry',
      'mango',
      'pineapple',
      'apple',
      'pear',
      'mint',
      'sago',
      'coconut_jelly',
      'passionfruit',
      'grapefruit',
      'guava',
      'cucumber',
      'cherry',
      'bayberry',
      'kiwi',
      'watermelon',
      'cantaloupe',
    ],
    positioningText: '收集桃子、荔枝和青柠，泡一杯果香冰茶',
    recipeUnlock: {
      title: '桃子荔枝青柠茶制作方法',
      intro: '桃子香甜、荔枝清润，青柠提香，搭配茉莉茶很清爽。',
      steps: ['桃子切成小块', '荔枝去核取肉', '青柠切片提香', '杯中加入果肉', '倒入茉莉茶加冰'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_peach_lychee_lime',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/peach_lychee_lime_tea_recipe_card_v1.jpg',
      catalogTitle: '桃子荔枝青柠茶',
      catalogSubtitle: '桃香荔枝青柠冰茶',
      shareTitle: '桃子荔枝青柠茶制作方法，桃香荔枝青柠冰茶！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260601,
  },
  {
    dayOfMonth: 18,
    themeId: 'kumquat_lemon_tea',
    themeName: '今日主题：金桔柠檬茶',
    drinkName: '金桔柠檬茶',
    targets: [
      { fruitId: 'kumquat', requiredCount: 9, cardCopies: 12 },
      { fruitId: 'lemon', requiredCount: 6, cardCopies: 9 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 18,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '收集金桔和柠檬，冲一杯酸甜清爽果茶',
    recipeUnlock: {
      title: '金桔柠檬茶制作方法',
      intro: '金桔和柠檬酸香明亮，红茶打底，蜂蜜调味更顺口。',
      steps: ['金桔对半切开', '柠檬切成薄片', '轻压果汁出香', '倒入红茶', '蜂蜜调味加冰'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_kumquat_lemon',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/kumquat_lemon_tea_recipe_card_v1.jpg',
      catalogTitle: '金桔柠檬茶',
      catalogSubtitle: '酸甜清爽柑橘茶',
      shareTitle: '金桔柠檬茶制作方法，酸甜清爽不腻口！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260602,
  },
  {
    dayOfMonth: 19,
    themeId: 'apple_ginger_tea',
    themeName: '今日主题：苹果生姜茶',
    drinkName: '苹果生姜茶',
    targets: [{ fruitId: 'apple', requiredCount: 15, cardCopies: 18 }],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '捞起苹果果块，煮一杯暖身苹果生姜茶',
    recipeUnlock: {
      title: '苹果生姜茶制作方法',
      intro: '苹果清甜，生姜温暖，红糖和红茶让口感更柔和。',
      steps: ['苹果切成小块', '生姜切成薄片', '加水煮出香味', '倒入红茶', '红糖调味温饮'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_apple_ginger',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/apple_ginger_tea_recipe_card_v1.jpg',
      catalogTitle: '苹果生姜茶',
      catalogSubtitle: '暖身苹果生姜茶',
      shareTitle: '苹果生姜茶制作方法，身上暖了不怕凉！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260603,
  },
  {
    dayOfMonth: 20,
    themeId: 'snow_pear_lily_tea',
    themeName: '今日主题：雪梨百合茶',
    drinkName: '雪梨百合茶',
    targets: [
      { fruitId: 'pear', requiredCount: 9, cardCopies: 12 },
      { fruitId: 'lily_bulb', requiredCount: 6, cardCopies: 9 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 12,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '收集雪梨和百合，煮一杯温润清甜梨茶',
    recipeUnlock: {
      title: '雪梨百合茶制作方法',
      intro: '雪梨清润，百合温和，慢煮后适合做成温柔的养嗓茶。',
      steps: ['雪梨切成小块', '百合清洗备用', '加水慢煮二十分钟', '加入冰糖调味', '蜂蜜最后加入'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_snow_pear_lily',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/snow_pear_lily_tea_recipe_card_v1.jpg',
      catalogTitle: '雪梨百合茶',
      catalogSubtitle: '温润雪梨百合茶',
      shareTitle: '雪梨百合茶制作方法，嗓子不干咳嗽少了！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260604,
  },
  {
    dayOfMonth: 21,
    themeId: 'orange_mint_tea',
    themeName: '今日主题：橙子薄荷茶',
    drinkName: '橙子薄荷茶',
    targets: [
      { fruitId: 'orange', requiredCount: 12, cardCopies: 15 },
      { fruitId: 'mint', requiredCount: 3, cardCopies: 6 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 18,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '收集橙子和薄荷，调一杯清爽果香茶',
    recipeUnlock: {
      title: '橙子薄荷茶制作方法',
      intro: '橙子果香明亮，薄荷清凉提神，冷泡热泡都很清爽。',
      steps: ['橙子切成薄片', '薄荷叶洗净', '杯中加入橙片', '倒入温水或冷茶', '蜂蜜搅匀可加冰'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_orange_mint',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/orange_mint_tea_recipe_card_v1.jpg',
      catalogTitle: '橙子薄荷茶',
      catalogSubtitle: '清爽橙子薄荷茶',
      shareTitle: '橙子薄荷茶制作方法，整个人清爽起来！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260605,
  },
  {
    dayOfMonth: 22,
    themeId: 'guava_avocado_smoothie',
    themeName: '今日主题：芭乐牛油果奶昔',
    drinkName: '芭乐牛油果奶昔',
    targets: [
      { fruitId: 'guava', requiredCount: 9, cardCopies: 12 },
      { fruitId: 'avocado', requiredCount: 6, cardCopies: 9 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 12,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '收集芭乐和牛油果，搅打一杯清甜顺滑奶昔',
    recipeUnlock: {
      title: '芭乐牛油果奶昔制作方法',
      intro: '芭乐清甜带香，牛油果绵密顺滑，加入牛奶和酸奶后口感更柔和。',
      steps: ['芭乐切成小块', '牛油果去核取肉', '加入牛奶和酸奶', '放入冰块', '搅打细腻后倒杯'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_guava_avocado_smoothie',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/guava_avocado_smoothie_recipe_card_v1.jpg',
      catalogTitle: '芭乐牛油果奶昔',
      catalogSubtitle: '清甜顺滑夏日奶昔',
      shareTitle: '芭乐牛油果奶昔制作方法，清甜顺滑一杯就满足！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260606,
  },
  {
    dayOfMonth: 23,
    themeId: 'cucumber_pear_juice',
    themeName: '今日主题：黄瓜雪梨汁',
    drinkName: '黄瓜雪梨汁',
    targets: [
      { fruitId: 'cucumber', requiredCount: 9, cardCopies: 12 },
      { fruitId: 'pear', requiredCount: 6, cardCopies: 9 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 18,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '收集黄瓜和雪梨，榨一杯清爽润口果蔬汁',
    recipeUnlock: {
      title: '黄瓜雪梨汁制作方法',
      intro: '黄瓜清新，雪梨清润，加一点蜂蜜和冰块，入口清爽不腻。',
      steps: ['黄瓜切成薄片', '雪梨去核切块', '加入净水打底', '蜂蜜调味', '搅打过滤后加冰'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_cucumber_pear_juice',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/cucumber_pear_juice_recipe_card_v1.jpg',
      catalogTitle: '黄瓜雪梨汁',
      catalogSubtitle: '清爽润口果蔬汁',
      shareTitle: '黄瓜雪梨汁制作方法，清爽润口很适合夏天！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260607,
  },
  {
    dayOfMonth: 24,
    themeId: 'lychee_dragonfruit_drink',
    themeName: '今日主题：荔枝火龙果饮',
    drinkName: '荔枝火龙果饮',
    targets: [
      { fruitId: 'lychee', requiredCount: 9, cardCopies: 12 },
      { fruitId: 'dragonfruit', requiredCount: 6, cardCopies: 9 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 12,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '收集荔枝和火龙果，调一杯粉粉果香冰饮',
    recipeUnlock: {
      title: '荔枝火龙果饮制作方法',
      intro: '荔枝清甜多汁，火龙果颜色明亮，搭配茉莉茶和青柠很清爽。',
      steps: ['荔枝去壳去核', '火龙果切成小块', '加入青柠片', '捣出果汁', '倒入茉莉茶加冰'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_lychee_dragonfruit_drink',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/lychee_dragonfruit_drink_recipe_card_v1.jpg',
      catalogTitle: '荔枝火龙果饮',
      catalogSubtitle: '粉粉果香冰饮',
      shareTitle: '荔枝火龙果饮制作方法，粉粉果香清甜多汁！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260608,
  },
  {
    dayOfMonth: 25,
    themeId: 'pickled_cherry_tomato_plum',
    themeName: '今日主题：梅渍小番茄',
    drinkName: '梅渍小番茄',
    targets: [{ fruitId: 'cherry_tomato', requiredCount: 15, cardCopies: 18 }],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 6,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '捞起小番茄，做一份酸甜冰爽梅渍小食',
    recipeUnlock: {
      title: '梅渍小番茄制作方法',
      intro: '小番茄去皮后吸满话梅汁，酸甜开胃，冷藏后更清爽。',
      steps: ['小番茄焯水去皮', '话梅加冰糖煮汁', '加入柠檬片提香', '番茄倒入梅汁', '冷藏入味后开吃'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_pickled_cherry_tomato_plum',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/pickled_cherry_tomato_plum_recipe_card_v1.jpg',
      catalogTitle: '梅渍小番茄',
      catalogSubtitle: '酸甜开胃冰爽小食',
      shareTitle: '梅渍小番茄制作方法，酸甜开胃冰爽入味！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260609,
  },
  {
    dayOfMonth: 26,
    themeId: 'pomegranate_ice_tea',
    themeName: '今日主题：石榴冰茶',
    drinkName: '石榴冰茶',
    targets: [{ fruitId: 'pomegranate', requiredCount: 15, cardCopies: 18 }],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 12,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '捞起石榴果粒，泡一杯红宝石般的果香冰茶',
    recipeUnlock: {
      title: '石榴冰茶制作方法',
      intro: '石榴果粒酸甜爆汁，搭配茉莉茶、柠檬和冰块，颜色明亮又清爽。',
      steps: ['石榴剥出果粒', '轻压挤出果汁', '加入柠檬片', '倒入茉莉茶', '蜂蜜调味后加冰'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_pomegranate_ice_tea',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/pomegranate_ice_tea_recipe_card_v1.jpg',
      catalogTitle: '石榴冰茶',
      catalogSubtitle: '红宝石果粒冰茶',
      shareTitle: '石榴冰茶制作方法，红宝石果粒酸甜爆汁！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260610,
  },
  {
    dayOfMonth: 27,
    themeId: 'bayberry_lychee_drink',
    themeName: '今日主题：杨梅荔枝饮',
    drinkName: '杨梅荔枝饮',
    targets: [
      { fruitId: 'bayberry', requiredCount: 9, cardCopies: 12 },
      { fruitId: 'lychee', requiredCount: 6, cardCopies: 9 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 18,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '收集杨梅和荔枝，煮一杯酸甜莓香冰饮',
    recipeUnlock: {
      title: '杨梅荔枝饮制作方法',
      intro: '杨梅酸甜浓郁，荔枝清甜多汁，加冰后很适合做夏日果饮。',
      steps: ['杨梅盐水浸泡', '加水煮出果汁', '加入冰糖调味', '荔枝去核取肉', '倒入杨梅汁加冰'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_bayberry_lychee_drink',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/bayberry_lychee_drink_recipe_card_v1.jpg',
      catalogTitle: '杨梅荔枝饮',
      catalogSubtitle: '酸甜莓香荔枝饮',
      shareTitle: '杨梅荔枝饮制作方法，酸甜莓香清爽解暑！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260611,
  },
  {
    dayOfMonth: 28,
    themeId: 'bayberry_rena_ice',
    themeName: '今日主题：杨梅瑞纳冰',
    drinkName: '杨梅瑞纳冰',
    targets: [{ fruitId: 'bayberry', requiredCount: 15, cardCopies: 18 }],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 6,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '捞起杨梅果粒，做一杯酸甜冰爽的杨梅瑞纳冰',
    recipeUnlock: {
      title: '杨梅瑞纳冰制作方法',
      intro: '杨梅先做成果酱和沙冰，再和茉莉花茶拌匀，酸甜冰爽又有果肉感。',
      steps: [
        '杨梅去核切碎，喜欢颗粒感可切粗一点',
        '杨梅加冰糖、白砂糖和柠檬汁，小火熬成果酱',
        '另取杨梅冷冻后打成细碎沙冰',
        '杨梅沙冰加入杨梅酱和茉莉花茶，比例约三比一',
        '搅拌均匀，可加冰块让冰感更久',
      ],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_bayberry_rena_ice',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/bayberry_rena_ice_recipe_card_v1.jpg',
      catalogTitle: '杨梅瑞纳冰',
      catalogSubtitle: '酸甜杨梅沙冰饮',
      shareTitle: '杨梅瑞纳冰制作方法，酸甜冰爽还有杨梅颗粒感！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260612,
  },
  {
    dayOfMonth: 29,
    themeId: 'cantaloupe_oat_latte',
    themeName: '今日主题：蜜瓜燕麦拿铁',
    drinkName: '蜜瓜燕麦拿铁',
    targets: [{ fruitId: 'cantaloupe', requiredCount: 15, cardCopies: 18 }],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 12,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '捞起蜜瓜果块，做一杯清甜顺滑的燕麦拿铁',
    recipeUnlock: {
      title: '蜜瓜燕麦拿铁制作方法',
      intro: '蜜瓜清甜配牛奶和咖啡，燕麦增加香气和口感，冰镇后层次更丰富。',
      steps: ['蜜瓜切成小块', '杯底加入蜜瓜泥', '倒入牛奶和冰块', '加入咖啡液', '撒上燕麦点缀', '放蜜瓜片完成'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_cantaloupe_oat_latte',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/cantaloupe_oat_latte_recipe_card_v1.jpg',
      catalogTitle: '蜜瓜燕麦拿铁',
      catalogSubtitle: '清甜蜜瓜咖啡拿铁',
      shareTitle: '蜜瓜燕麦拿铁制作方法，清甜顺滑还带咖啡香！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260613,
  },
  {
    dayOfMonth: 30,
    themeId: 'guava_emblic_drink',
    themeName: '今日主题：芭乐油柑饮',
    drinkName: '芭乐油柑饮',
    targets: [
      { fruitId: 'guava', requiredCount: 9, cardCopies: 12 },
      { fruitId: 'emblic', requiredCount: 6, cardCopies: 9 },
    ],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 18,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '收集芭乐和油柑，调一杯清爽回甘果茶饮',
    recipeUnlock: {
      title: '芭乐油柑饮制作方法',
      intro: '芭乐果香柔和，油柑酸甜回甘，搭配绿茶和冰块很清爽。',
      steps: ['芭乐切块备用', '油柑压出果汁', '杯中加入芭乐', '倒入绿茶油柑汁', '糖浆调甜味', '加冰摇匀完成'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_guava_emblic_drink',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/guava_emblic_drink_recipe_card_v1.jpg',
      catalogTitle: '芭乐油柑饮',
      catalogSubtitle: '清爽回甘果茶饮',
      shareTitle: '芭乐油柑饮制作方法，清爽回甘越喝越香！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260614,
  },
  {
    dayOfMonth: 31,
    themeId: 'papaya_milk',
    themeName: '今日主题：木瓜牛奶',
    drinkName: '木瓜牛奶',
    targets: [{ fruitId: 'papaya', requiredCount: 15, cardCopies: 18 }],
    totalStackCards: DAILY_LIMITED_MIN_STACK_CARDS + 6,
    fruitIds: DAILY_LIMITED_COMMON_FRUITS,
    positioningText: '捞起木瓜果块，煮一杯香甜暖润的木瓜牛奶',
    recipeUnlock: {
      title: '木瓜牛奶制作方法',
      intro: '木瓜香甜软糯，牛奶顺滑温和，加红枣和冰糖后更适合做甜品饮。',
      steps: ['木瓜去皮切块', '红枣煮出甜味', '加入木瓜和冰糖', '倒入牛奶小火煮', '稍微放温', '倒杯完成'],
    },
    recipeCard: {
      textureKey: 'daily_limited_recipe_papaya_milk',
      path: 'subpackages/daily_recipes/assets/images/daily_limited/recipes/papaya_milk_recipe_card_v1.jpg',
      catalogTitle: '木瓜牛奶',
      catalogSubtitle: '香甜暖润木瓜奶',
      shareTitle: '木瓜牛奶制作方法，香甜暖润一杯很舒服！',
    },
    bufferSize: 7,
    toolCounts: {
      shuffle: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      undo: DAILY_LIMITED_TOOL_USES_PER_ROUND,
      lift: DAILY_LIMITED_TOOL_USES_PER_ROUND,
    },
    layoutSeed: 20260615,
  },
];

function assertDailyLimitedLevelsValid(levels: readonly DailyThemeLevelDef[]): void {
  const seenDays = new Set<number>();
  const seenThemeIds = new Set<string>();
  for (const level of levels) {
    if (!Number.isInteger(level.dayOfMonth) || level.dayOfMonth < 1 || level.dayOfMonth > 31) {
      throw new Error(`[dailyLimited] invalid dayOfMonth for ${level.themeId}: ${level.dayOfMonth}`);
    }
    if (seenDays.has(level.dayOfMonth)) {
      throw new Error(`[dailyLimited] duplicated dayOfMonth: ${level.dayOfMonth}`);
    }
    seenDays.add(level.dayOfMonth);
    if (seenThemeIds.has(level.themeId)) {
      throw new Error(`[dailyLimited] duplicated themeId: ${level.themeId}`);
    }
    seenThemeIds.add(level.themeId);
    if (level.targets.length < 1 || level.targets.length > 3) {
      throw new Error(`[dailyLimited] ${level.themeId} must have 1-3 targets`);
    }
    const fruitSet = new Set(level.fruitIds);
    const playableFruitIds = getDailyLimitedPlayableFruitIds(level);
    const playableFruitSet = new Set(playableFruitIds);
    if (playableFruitIds.length > DAILY_LIMITED_MAX_FRUIT_TYPES) {
      throw new Error(
        `[dailyLimited] ${level.themeId} must have at most ${DAILY_LIMITED_MAX_FRUIT_TYPES} playable fruit types`,
      );
    }
    let targetCopiesTotal = 0;
    for (const target of level.targets) {
      if (!fruitSet.has(target.fruitId)) {
        throw new Error(`[dailyLimited] ${level.themeId} missing target fruit in fruitIds: ${target.fruitId}`);
      }
      if (!playableFruitSet.has(target.fruitId)) {
        throw new Error(
          `[dailyLimited] ${level.themeId} target fruit must be in playable fruit pool: ${target.fruitId}`,
        );
      }
      if (target.requiredCount < 1) {
        throw new Error(`[dailyLimited] ${level.themeId} target requiredCount must be positive: ${target.fruitId}`);
      }
      if (target.cardCopies < target.requiredCount || target.cardCopies > target.requiredCount + 3) {
        throw new Error(
          `[dailyLimited] ${level.themeId} ${target.fruitId} cardCopies must be between requiredCount and requiredCount + 3`,
        );
      }
      targetCopiesTotal += target.cardCopies;
    }
    if (level.totalStackCards !== undefined) {
      if (level.totalStackCards < DAILY_LIMITED_MIN_STACK_CARDS) {
        throw new Error(
          `[dailyLimited] ${level.themeId} totalStackCards must be at least ${DAILY_LIMITED_MIN_STACK_CARDS}`,
        );
      }
      if (level.totalStackCards < targetCopiesTotal) {
        throw new Error(`[dailyLimited] ${level.themeId} totalStackCards cannot be less than target card copies`);
      }
    }
    if (!level.recipeCard.textureKey || !level.recipeCard.path) {
      throw new Error(`[dailyLimited] ${level.themeId} recipeCard textureKey/path is required`);
    }
  }
}

assertDailyLimitedLevelsValid(DAILY_LIMITED_LEVELS);

export function getDailyLimitedLevel(index = 0): DailyThemeLevelDef {
  const safeIndex = ((Math.floor(index) % DAILY_LIMITED_LEVELS.length) + DAILY_LIMITED_LEVELS.length)
    % DAILY_LIMITED_LEVELS.length;
  return DAILY_LIMITED_LEVELS[safeIndex];
}

export function getDailyLimitedLevelForDate(date = new Date()): DailyThemeLevelDef {
  const day = date.getDate();
  return DAILY_LIMITED_LEVELS.find((level) => level.dayOfMonth === day) ?? getDailyLimitedLevel(day - 1);
}

export function getDailyLimitedTargetFruitIds(level: DailyThemeLevelDef): readonly FruitId[] {
  return level.targets.map((target) => target.fruitId);
}

export function getDailyLimitedTargetCount(level: DailyThemeLevelDef): number {
  return level.targets.reduce((sum, target) => sum + target.requiredCount, 0);
}
