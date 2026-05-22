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
const POST_15_START_ORDER_COUNT = 54;
const POST_15_ORDER_INCREMENT = 1;
const POST_15_COPIES_PER_FRUIT = 6;

function uniqueFruitIds(ids: readonly FruitId[]): FruitId[] {
  return Array.from(new Set<FruitId>(ids));
}

function post15TargetFoodCount(levelNumber: number): number {
  const orderCount =
    POST_15_START_ORDER_COUNT + (levelNumber - POST_15_FIRST_LEVEL) * POST_15_ORDER_INCREMENT;
  return Math.ceil((orderCount * 3) / POST_15_COPIES_PER_FRUIT);
}

function targetFruitCountForEarlyLevel(levelNumber: number): number {
  const targets = [4, 7, 10, 12, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
  return targets[Math.max(0, Math.min(levelNumber - 1, targets.length - 1))]!;
}

function trimOldFruitsForEarlyLevel(levelIndex: number, fruits: FruitId[]): FruitId[] {
  const target = targetFruitCountForEarlyLevel(levelIndex + 1);
  if (fruits.length <= target) {
    return fruits;
  }
  /**
   * 降低每关水果种类时，保护本关新解锁食材；L3 起额外保护上一关食材。
   * 其余名额从较新的旧食材往回补，优先剔除更早的旧水果。
   */
  const protectedStart = levelIndex <= 1 ? levelIndex : levelIndex - 1;
  const protectedIds = new Set<FruitId>(uniqueFruitIds(UNLOCK_GROUPS.slice(protectedStart, levelIndex + 1).flat()));
  const keep = new Set<FruitId>(protectedIds);
  for (const id of fruits.filter((fruitId) => !protectedIds.has(fruitId)).reverse()) {
    if (keep.size >= target) {
      break;
    }
    keep.add(id);
  }
  return fruits.filter((id) => keep.has(id));
}

/**
 * 累积式：第 N 关订单池 = UNLOCK_GROUPS[0..N-1] 全部并集（去重）。
 * L16 起改为「后期基础池 + 最近新解锁食材」，避免早期食材过度重复。
 */
function levelFruits(levelNumber: number): FruitId[] {
  const idx = Math.max(0, Math.min(levelNumber - 1, UNLOCK_GROUPS.length - 1));
  if (idx < 15) {
    return trimOldFruitsForEarlyLevel(
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
 * 30 关数值（v7，平缓学习曲线 + 碗内"满当当"视觉）：
 *   `orderTarget` 全程 = 3（三消核心玩法不动）；
 *   `copiesPerFruit` 必须全程为 3 的倍数，避免生成无法凑满 x3 的尾数水果。
   *   `plateLanesInitial` 默认 = 2 —— 第 3/4 路订单盘上的「解锁」按钮点了才看广告解锁
   *     L2 例外：首个扩展教学关直接开 4 路，让玩家体验多订单更快过关；
 *     （`unlockNextOrderPlateReward`）；失败复活也会顺带解锁一路。这是核心广告变现位。
 *   底部「加菜碟」工具是另一条广告点：每次 +1 个 `bufferSize`（最多 7），
 *     缓解 buffer 满压力但不解锁订单路。
 *   难度递增完全靠：水果种类 ↑、copiesPerFruit、冰 / 冻果 ↑、bufferSize ↓、初始可见 ↑。
 *
 *   A 段 教学（L1-2）           — 零障碍上手；L2 起 7 种水果让选择压力出现
 *   B 段 习惯养成（L3-7）       — L3 起只增加水果种类与少量冰块，不再把订单量翻倍
 *   C 段 中阶（L8-15）          — 逐步加入冻果，障碍缓慢爬升，始终保留 5 个暂存盘
 *   D 段 长线（L16-30）         — 订单量小幅增长，靠新食材与背景变化提供新鲜感
 *
 * 总订单单位 (`ordersRemaining`)：L1=4 → L3≈20 → L10≈40 → L15≈50 → L16≈54 → L30≈68
 * `bufferSize`：全程 5 格保留安全感；加菜碟工具仍可扩到 7 格。
 * `initialVisibleCount`：跟随订单量慢慢提升；通过水果放大和更多上层水果来保持画面丰富，
 *   不再用过量可点击水果制造早期压迫感。
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
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 2,
    initialVisibleCount: 54,
    revealPerOrderComplete: 5,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 4,
    displayName: '第4关 星果长廊',
    fruitIds: levelFruits(4),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 3,
    initialVisibleCount: 60,
    revealPerOrderComplete: 5,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 5,
    displayName: '第5关 薄冰试饮',
    fruitIds: levelFruits(5),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 4,
    frozenCount: 1,
    initialVisibleCount: 66,
    revealPerOrderComplete: 5,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 6,
    displayName: '第6关 坚果蜜语',
    fruitIds: levelFruits(6),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 4,
    frozenCount: 1,
    initialVisibleCount: 72,
    revealPerOrderComplete: 5,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 7,
    displayName: '第7关 暖盅小宴',
    fruitIds: levelFruits(7),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 5,
    frozenCount: 1,
    initialVisibleCount: 78,
    revealPerOrderComplete: 6,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 8,
    displayName: '第8关 满席小酌',
    fruitIds: levelFruits(8),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 5,
    frozenCount: 2,
    initialVisibleCount: 84,
    revealPerOrderComplete: 6,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 9,
    displayName: '第9关 甜脆交锋',
    fruitIds: levelFruits(9),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 6,
    frozenCount: 2,
    initialVisibleCount: 90,
    revealPerOrderComplete: 6,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 10,
    displayName: '第10关 深汤追单',
    fruitIds: levelFruits(10),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 6,
    frozenCount: 2,
    initialVisibleCount: 96,
    revealPerOrderComplete: 6,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 11,
    displayName: '第11关 鲜果巡礼',
    fruitIds: levelFruits(11),
    copiesPerFruit: 6,
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
    levelNumber: 12,
    displayName: '第12关 果香续宴',
    fruitIds: levelFruits(12),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 7,
    frozenCount: 3,
    initialVisibleCount: 104,
    revealPerOrderComplete: 6,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 13,
    displayName: '第13关 东方蜜径',
    fruitIds: levelFruits(13),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 8,
    frozenCount: 3,
    initialVisibleCount: 108,
    revealPerOrderComplete: 7,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 14,
    displayName: '第14关 缤纷拼盘',
    fruitIds: levelFruits(14),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 8,
    frozenCount: 4,
    initialVisibleCount: 112,
    revealPerOrderComplete: 7,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 15,
    displayName: '第15关 百味协奏',
    fruitIds: levelFruits(15),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 9,
    frozenCount: 4,
    initialVisibleCount: 116,
    revealPerOrderComplete: 7,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 16,
    displayName: '第16关 十五星上席',
    fruitIds: levelFruits(16),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 9,
    frozenCount: 4,
    initialVisibleCount: 118,
    revealPerOrderComplete: 7,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 17,
    displayName: '第17关 十五星收束',
    fruitIds: levelFruits(17),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 9,
    frozenCount: 5,
    initialVisibleCount: 120,
    revealPerOrderComplete: 7,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 18,
    displayName: '第18关 杂味圆舞',
    fruitIds: levelFruits(18),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 10,
    frozenCount: 5,
    initialVisibleCount: 122,
    revealPerOrderComplete: 7,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 19,
    displayName: '第19关 薄冰试炼',
    fruitIds: levelFruits(19),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 10,
    frozenCount: 5,
    initialVisibleCount: 124,
    revealPerOrderComplete: 8,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 20,
    displayName: '第20关 四味重奏',
    fruitIds: levelFruits(20),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 11,
    frozenCount: 6,
    initialVisibleCount: 126,
    revealPerOrderComplete: 8,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 21,
    displayName: '第21关 果阵初章',
    fruitIds: levelFruits(21),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 11,
    frozenCount: 6,
    initialVisibleCount: 128,
    revealPerOrderComplete: 8,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 22,
    displayName: '第22关 果阵回环',
    fruitIds: levelFruits(22),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 12,
    frozenCount: 6,
    initialVisibleCount: 130,
    revealPerOrderComplete: 8,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 23,
    displayName: '第23关 滋补雅集',
    fruitIds: levelFruits(23),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 12,
    frozenCount: 7,
    initialVisibleCount: 132,
    revealPerOrderComplete: 8,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 24,
    displayName: '第24关 小料满仓',
    fruitIds: levelFruits(24),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 13,
    frozenCount: 7,
    initialVisibleCount: 134,
    revealPerOrderComplete: 8,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 25,
    displayName: '第25关 重味温习',
    fruitIds: levelFruits(25),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 13,
    frozenCount: 7,
    initialVisibleCount: 136,
    revealPerOrderComplete: 9,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 26,
    displayName: '第26关 果阵再开',
    fruitIds: levelFruits(26),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 14,
    frozenCount: 8,
    initialVisibleCount: 138,
    revealPerOrderComplete: 9,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 27,
    displayName: '第27关 滋补再炖',
    fruitIds: levelFruits(27),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 14,
    frozenCount: 8,
    initialVisibleCount: 140,
    revealPerOrderComplete: 9,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 28,
    displayName: '第28关 小料再添',
    fruitIds: levelFruits(28),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 15,
    frozenCount: 8,
    initialVisibleCount: 142,
    revealPerOrderComplete: 9,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 29,
    displayName: '第29关 廿星连珠',
    fruitIds: levelFruits(29),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 15,
    frozenCount: 9,
    initialVisibleCount: 144,
    revealPerOrderComplete: 9,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 30,
    displayName: '第30关 廿四终宴',
    fruitIds: levelFruits(30),
    copiesPerFruit: POST_15_COPIES_PER_FRUIT,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 16,
    frozenCount: 9,
    initialVisibleCount: 146,
    revealPerOrderComplete: 9,
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
