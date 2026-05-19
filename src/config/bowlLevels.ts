import type { FruitId } from '@/config/fruits';
import type { BowlRimKey, BowlSoupKey } from '@/config/bowlSkins';
import type { BowlThemeKey } from '@/config/bowlThemes';

export interface BowlLevelDef {
  /** 关卡序号（从 1 起，与 UI「第 N 关」一致） */
  levelNumber: number;
  displayName: string;
  /** 本关出现的可下单食材种类 */
  fruitIds: FruitId[];
  /** 每种可下单食材在碗内出现的个数 */
  copiesPerFruit: number;
  /** 每个订单需要的个数 */
  orderTarget: number;
  /** 底部暂存槽位数 */
  bufferSize: number;
  /** 冰块障碍件数：不进订单，但会占碗与暂存压力 */
  iceCount?: number;
  /**
   * 冻果件数：从本关订单库存中挑 N 颗盖上冰块。
   * 点击会强制进暂存槽并开始解冻；解冻后按普通水果交付，仍计入订单总数。
   */
  frozenCount?: number;
  /** 开局浮在上层、可点击的物品上限；其余先藏在下层，随订单推进浮出 */
  initialVisibleCount?: number;
  /** 每完成一盘订单后，从下层释放的物品数量 */
  revealPerOrderComplete?: number;
  /** 开局并行订单路数，默认 2；新手加速关可直接开到 4 路 */
  plateLanesInitial?: 2 | 3 | 4;
  allowAddDish: boolean;
  allowRemove: boolean;
  allowShuffle: boolean;
  soupKey?: BowlSoupKey;
  bowlKey?: BowlRimKey;
  /** 玩法页主题；未配置时按关卡区间自动切换 */
  themeKey?: BowlThemeKey;
}

const allTools = { allowAddDish: true, allowRemove: true, allowShuffle: true } as const;

/**
 * 每关新解锁的食材（累积式：本关订单池 = 前 N 组并集）。
 * 节奏：L1=4、L2 解锁 4 但订单池压到 7、L3 解锁 4 但订单池压到 11；
 *      L4-15 保持原解锁节奏不动，L16-30 补齐全部小料/滋补/甜品食材。
 * 关卡通关弹窗的「下一关解锁」会显示对应组中的新水果。
 */
const UNLOCK_GROUPS = [
  ['blueberry', 'lemon', 'orange', 'strawberry'],
  ['apple', 'banana', 'grape', 'kiwi'],
  ['cucumber', 'peach', 'pineapple', 'watermelon'],
  ['mango', 'cherry', 'cherry_tomato'],
  ['grape_green', 'lime', 'mandarin'],
  ['cantaloupe', 'honeydew', 'young_coconut'],
  ['lychee', 'longan'],
  ['dried_longan', 'bayberry'],
  ['blackberry', 'cranberry'],
  ['raspberry', 'mulberry'],
  ['passionfruit', 'grapefruit'],
  ['kumquat', 'starfruit'],
  ['plum', 'nectarine'],
  ['persimmon', 'almond_slice'],
  ['peanut', 'walnut_piece'],
  ['chestnut', 'oat_flake'],
  ['red_date', 'sour_plum', 'mint'],
  ['blackcurrant', 'gooseberry', 'osmanthus'],
  ['basil_seed', 'crystal_jelly'],
  ['lotus_root', 'water_chestnut', 'radish_heart'],
  ['black_rice', 'red_bean'],
  ['foxnut', 'lotus_seed'],
  ['lily_bulb', 'snow_fungus', 'peach_gum'],
  ['boba_pearl', 'pudding_cube', 'mini_mochi'],
  ['chocolate_chip', 'cookie_crumb', 'marshmallow'],
  ['pumpkin_cube', 'sweet_potato', 'durian'],
  ['coconut_jelly', 'sago'],
  ['grass_jelly', 'taro_ball', 'taro_dice'],
  ['pop_boba'],
  ['dragonfruit'],
] as const satisfies readonly (readonly FruitId[])[];

/** 图鉴只展示关卡体系内真正可获得的食材，避免通关后仍出现永远无法解锁的占位。 */
export const BOWL_UNLOCKABLE_FRUIT_IDS = Array.from(new Set<FruitId>(UNLOCK_GROUPS.flat()));

/**
 * 后 15 关不再把最早期全部基础水果无限累积进订单池，而是保留一批辨识度高的主食材，
 * 再叠加最近解锁的小料/滋补/甜品，保证每关新鲜感和图鉴解锁一致。
 */
const POST_15_BASE_POOL = [
  'apple',
  'banana',
  'grape',
  'kiwi',
  'peach',
  'pineapple',
  'watermelon',
  'mango',
  'cherry',
  'cherry_tomato',
  'grape_green',
  'lime',
  'mandarin',
  'cantaloupe',
  'honeydew',
  'young_coconut',
  'lychee',
  'longan',
  'bayberry',
  'blackberry',
  'cranberry',
  'raspberry',
  'mulberry',
  'passionfruit',
  'grapefruit',
  'plum',
  'nectarine',
  'persimmon',
  'almond_slice',
  'peanut',
  'walnut_piece',
] as const satisfies readonly FruitId[];

const POST_15_RECENT_GROUP_WINDOW = 8;
const POST_15_FIRST_LEVEL = 16;
const POST_15_START_ORDER_COUNT = 80;
const POST_15_ORDER_INCREMENT = 2;
const POST_15_COPIES_PER_FRUIT = 6;

function uniqueFruitIds(ids: readonly FruitId[]): FruitId[] {
  return Array.from(new Set<FruitId>(ids));
}

function post15TargetFoodCount(levelNumber: number): number {
  const orderCount =
    POST_15_START_ORDER_COUNT + (levelNumber - POST_15_FIRST_LEVEL) * POST_15_ORDER_INCREMENT;
  return Math.ceil((orderCount * 3) / POST_15_COPIES_PER_FRUIT);
}

function removeOneOldFruitForEarlyLevel(levelIndex: number, fruits: FruitId[]): FruitId[] {
  if (levelIndex <= 0 || fruits.length <= 1) {
    return fruits;
  }
  /**
   * 每关降 1 种水果时，优先从更早的旧池删，保护本关与上一关新解锁的食材。
   * L2 没有“更早旧池”，只能从 L1 基础水果里删 1 个。
   */
  const removableGroupsEnd = Math.max(1, levelIndex - 1);
  const removable = uniqueFruitIds(UNLOCK_GROUPS.slice(0, removableGroupsEnd).flat());
  const removed = removable[removable.length - 1];
  return removed ? fruits.filter((id) => id !== removed) : fruits.slice(0, -1);
}

/**
 * 累积式：第 N 关订单池 = UNLOCK_GROUPS[0..N-1] 全部并集（去重）。
 * L16 起改为「后期基础池 + 最近新解锁食材」，避免早期食材过度重复。
 */
function levelFruits(levelNumber: number): FruitId[] {
  const idx = Math.max(0, Math.min(levelNumber - 1, UNLOCK_GROUPS.length - 1));
  if (idx < 15) {
    return removeOneOldFruitForEarlyLevel(
      idx,
      uniqueFruitIds(UNLOCK_GROUPS.slice(0, idx + 1).flat()),
    );
  }
  const recentStart = Math.max(15, idx - POST_15_RECENT_GROUP_WINDOW + 1);
  const targetFoodCount = Math.max(1, post15TargetFoodCount(levelNumber) - 1);
  return uniqueFruitIds([
    ...UNLOCK_GROUPS.slice(recentStart, idx + 1).flat(),
    ...POST_15_BASE_POOL,
    ...UNLOCK_GROUPS.slice(0, recentStart).flat(),
  ]).slice(0, targetFoodCount);
}

/**
 * 30 关数值（v6，碗内"满当当"画面 + L3 起强压力）：
 *   `orderTarget` 全程 = 3（三消核心玩法不动）；
 *   `copiesPerFruit` 必须全程为 3 的倍数，避免生成无法凑满 x3 的尾数水果。
   *   `plateLanesInitial` 默认 = 2 —— 第 3/4 路订单盘上的「解锁」按钮点了才看广告解锁
   *     L2 例外：首个扩展教学关直接开 4 路，让玩家体验多订单更快过关；
 *     （`unlockNextOrderPlateReward`）；失败复活也会顺带解锁一路。这是核心广告变现位。
 *   底部「加菜碟」工具是另一条广告点：每次 +1 个 `bufferSize`（最多 7），
 *     缓解 buffer 满压力但不解锁订单路。
 *   难度递增完全靠：水果种类 ↑、copiesPerFruit、冰 / 冻果 ↑、bufferSize ↓、初始可见 ↑。
 *
 *   A 段 教学（L1-2）           — 零障碍上手；L2 起 8 种水果让选择压力出现
 *   B 段 习惯养成（L3-7）       — L3 一上来 12 种 + 48 单位 + 4 颗冰 + 72 颗满碗；必用 1 道具/关
 *   C 段 中阶（L8-13）          — 25-35 种水果，冰 8→11、冻果 3→5，碗内 110-125 颗高密度
 *   D 段 高阶（L14-30）         — buffer 收紧 4 格 + 冰冻果增压；L16+ 每关约 +2 单
 *
 * 总订单单位 (`ordersRemaining`)：L1=4 → L3=48 → L10=87 → L15=78 → L16=80 → L30=108
 * `bufferSize`：L1-L10 全 5 格保新手手感；L11+ 起收紧为 4 格，与水果种类峰值同步加压。
 * `initialVisibleCount`：L1=14、L2=32、L3=72，从 L3 起碗内堆出明显视觉压力；
 *   `revealPerOrderComplete` 与 `parallelPlateCount × orderTarget`（=6/盘）持平，
 *   保证完成订单后及时补充，碗内密度全程贴近"满"。
 * `allTools` 全程开。
 */
export const BOWL_LEVELS: BowlLevelDef[] = [
  {
    levelNumber: 1,
    displayName: '第1关 酸奶初醒',
    fruitIds: levelFruits(1),
    copiesPerFruit: 3,
    orderTarget: 3,
    bufferSize: 5,
    initialVisibleCount: 14,
    revealPerOrderComplete: 4,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 2,
    displayName: '第2关 鲜果开张',
    fruitIds: levelFruits(2),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    initialVisibleCount: 32,
    revealPerOrderComplete: 5,
    plateLanesInitial: 4,
    ...allTools,
  },
  {
    levelNumber: 3,
    displayName: '第3关 热带开席',
    fruitIds: levelFruits(3),
    copiesPerFruit: 12,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 4,
    initialVisibleCount: 72,
    revealPerOrderComplete: 6,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 4,
    displayName: '第4关 星果长廊',
    fruitIds: levelFruits(4),
    copiesPerFruit: 9,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 5,
    initialVisibleCount: 80,
    revealPerOrderComplete: 6,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 5,
    displayName: '第5关 薄冰试饮',
    fruitIds: levelFruits(5),
    copiesPerFruit: 9,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 6,
    frozenCount: 1,
    initialVisibleCount: 90,
    revealPerOrderComplete: 6,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 6,
    displayName: '第6关 坚果蜜语',
    fruitIds: levelFruits(6),
    copiesPerFruit: 9,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 7,
    frozenCount: 2,
    initialVisibleCount: 100,
    revealPerOrderComplete: 6,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 7,
    displayName: '第7关 暖盅小宴',
    fruitIds: levelFruits(7),
    copiesPerFruit: 9,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 8,
    frozenCount: 2,
    initialVisibleCount: 105,
    revealPerOrderComplete: 6,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 8,
    displayName: '第8关 满席小酌',
    fruitIds: levelFruits(8),
    copiesPerFruit: 9,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 8,
    frozenCount: 3,
    initialVisibleCount: 110,
    revealPerOrderComplete: 7,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 9,
    displayName: '第9关 甜脆交锋',
    fruitIds: levelFruits(9),
    copiesPerFruit: 9,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 9,
    frozenCount: 3,
    initialVisibleCount: 115,
    revealPerOrderComplete: 7,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 10,
    displayName: '第10关 深汤追单',
    fruitIds: levelFruits(10),
    copiesPerFruit: 9,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 9,
    frozenCount: 4,
    initialVisibleCount: 115,
    revealPerOrderComplete: 7,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 11,
    displayName: '第11关 鲜果巡礼',
    fruitIds: levelFruits(11),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 10,
    frozenCount: 4,
    initialVisibleCount: 115,
    revealPerOrderComplete: 7,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 12,
    displayName: '第12关 果香续宴',
    fruitIds: levelFruits(12),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 11,
    frozenCount: 5,
    initialVisibleCount: 120,
    revealPerOrderComplete: 7,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 13,
    displayName: '第13关 东方蜜径',
    fruitIds: levelFruits(13),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 11,
    frozenCount: 5,
    initialVisibleCount: 125,
    revealPerOrderComplete: 8,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 14,
    displayName: '第14关 缤纷拼盘',
    fruitIds: levelFruits(14),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 12,
    frozenCount: 6,
    initialVisibleCount: 125,
    revealPerOrderComplete: 8,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 15,
    displayName: '第15关 百味协奏',
    fruitIds: levelFruits(15),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 12,
    frozenCount: 6,
    initialVisibleCount: 130,
    revealPerOrderComplete: 8,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 16,
    displayName: '第16关 十五星上席',
    fruitIds: levelFruits(16),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 13,
    frozenCount: 7,
    initialVisibleCount: 130,
    revealPerOrderComplete: 8,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 17,
    displayName: '第17关 十五星收束',
    fruitIds: levelFruits(17),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 13,
    frozenCount: 7,
    initialVisibleCount: 135,
    revealPerOrderComplete: 8,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 18,
    displayName: '第18关 杂味圆舞',
    fruitIds: levelFruits(18),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 14,
    frozenCount: 8,
    initialVisibleCount: 140,
    revealPerOrderComplete: 9,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 19,
    displayName: '第19关 薄冰试炼',
    fruitIds: levelFruits(19),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 14,
    frozenCount: 8,
    initialVisibleCount: 140,
    revealPerOrderComplete: 9,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 20,
    displayName: '第20关 四味重奏',
    fruitIds: levelFruits(20),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 15,
    frozenCount: 9,
    initialVisibleCount: 145,
    revealPerOrderComplete: 9,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 21,
    displayName: '第21关 果阵初章',
    fruitIds: levelFruits(21),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 15,
    frozenCount: 9,
    initialVisibleCount: 145,
    revealPerOrderComplete: 9,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 22,
    displayName: '第22关 果阵回环',
    fruitIds: levelFruits(22),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 16,
    frozenCount: 10,
    initialVisibleCount: 150,
    revealPerOrderComplete: 9,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 23,
    displayName: '第23关 滋补雅集',
    fruitIds: levelFruits(23),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 16,
    frozenCount: 10,
    initialVisibleCount: 150,
    revealPerOrderComplete: 10,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 24,
    displayName: '第24关 小料满仓',
    fruitIds: levelFruits(24),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 17,
    frozenCount: 11,
    initialVisibleCount: 155,
    revealPerOrderComplete: 10,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 25,
    displayName: '第25关 重味温习',
    fruitIds: levelFruits(25),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 17,
    frozenCount: 11,
    initialVisibleCount: 155,
    revealPerOrderComplete: 10,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 26,
    displayName: '第26关 果阵再开',
    fruitIds: levelFruits(26),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 18,
    frozenCount: 12,
    initialVisibleCount: 160,
    revealPerOrderComplete: 10,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 27,
    displayName: '第27关 滋补再炖',
    fruitIds: levelFruits(27),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 18,
    frozenCount: 12,
    initialVisibleCount: 160,
    revealPerOrderComplete: 10,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 28,
    displayName: '第28关 小料再添',
    fruitIds: levelFruits(28),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 19,
    frozenCount: 13,
    initialVisibleCount: 165,
    revealPerOrderComplete: 10,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 29,
    displayName: '第29关 廿星连珠',
    fruitIds: levelFruits(29),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 19,
    frozenCount: 13,
    initialVisibleCount: 170,
    revealPerOrderComplete: 11,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 30,
    displayName: '第30关 廿四终宴',
    fruitIds: levelFruits(30),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 4,
    iceCount: 20,
    frozenCount: 14,
    initialVisibleCount: 175,
    revealPerOrderComplete: 11,
    plateLanesInitial: 2,
    ...allTools,
  },
];

export const BOWL_LEVEL_COUNT = BOWL_LEVELS.length;

export function getBowlLevelDef(index: number): BowlLevelDef {
  const clamped = Math.max(0, Math.min(index, BOWL_LEVELS.length - 1));
  return BOWL_LEVELS[clamped]!;
}

/** 相对所有前序关卡新出现的食材（用于过关「解锁食材」展示；第 1 关为全部本关食材） */
export function getNewFruitsIntroducedInLevel(levelIndex: number): FruitId[] {
  const def = getBowlLevelDef(levelIndex);
  if (levelIndex <= 0) {
    return def.fruitIds.slice();
  }
  const seen = new Set<FruitId>();
  for (let i = 0; i < levelIndex; i += 1) {
    for (const id of getBowlLevelDef(i).fruitIds) {
      seen.add(id);
    }
  }
  return def.fruitIds.filter((id) => !seen.has(id));
}
