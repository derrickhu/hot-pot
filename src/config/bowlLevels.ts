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
   * 冻果障碍件数：从订单水果列表中额外注入 N 颗「冰块包水果」实例，
   * 点击会强制进暂存槽并开始解冻；不计入订单总数，只是障碍。
   */
  frozenCount?: number;
  /** 开局浮在上层、可点击的物品上限；其余先藏在下层，随订单推进浮出 */
  initialVisibleCount?: number;
  /** 每完成一盘订单后，从下层释放的物品数量 */
  revealPerOrderComplete?: number;
  /** 开局并行订单路数，默认 2 */
  plateLanesInitial?: 2 | 3;
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
 * 节奏：L1=4、L2+4、L3+4 → L3 一开就 12 种；
 *      L4-5 各 +3、L6 +3、L7-15 各 +2、L16-30 各 +1，到 L30 累计 53 种。
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
  ['chestnut'],
  ['red_date'],
  ['sour_plum'],
  ['mint'],
  ['osmanthus'],
  ['radish_heart'],
  ['black_rice'],
  ['foxnut'],
  ['lotus_seed'],
  ['lily_bulb'],
  ['lotus_root'],
  ['snow_fungus'],
  ['peach_gum'],
  ['pumpkin_cube'],
  ['sweet_potato'],
] as const satisfies readonly (readonly FruitId[])[];

/**
 * 累积式：第 N 关订单池 = UNLOCK_GROUPS[0..N-1] 全部并集（去重）。
 * 一旦解锁不再失踪，符合「难度只能加不能减」的诉求。
 */
function levelFruits(levelNumber: number): FruitId[] {
  const idx = Math.max(0, Math.min(levelNumber - 1, UNLOCK_GROUPS.length - 1));
  return Array.from(new Set<FruitId>(UNLOCK_GROUPS.slice(0, idx + 1).flat()));
}

/**
 * 30 关数值（v6，碗内"满当当"画面 + L3 起强压力）：
 *   `orderTarget` 全程 = 3（三消核心玩法不动）；
 *   `copiesPerFruit` 必须全程为 3 的倍数，避免生成无法凑满 x3 的尾数水果。
 *   `plateLanesInitial` 全程 = 2 —— 第 3/4 路订单盘上的「解锁」按钮点了才看广告解锁
 *     （`unlockNextOrderPlateReward`）；失败复活也会顺带解锁一路。这是核心广告变现位。
 *   底部「加菜碟」工具是另一条广告点：每次 +1 个 `bufferSize`（最多 7），
 *     缓解 buffer 满压力但不解锁订单路。
 *   难度递增完全靠：水果种类 ↑、copiesPerFruit、冰 / 冻果 ↑、bufferSize ↓、初始可见 ↑。
 *
 *   A 段 教学（L1-2）           — 零障碍上手；L2 起 8 种水果让选择压力出现
 *   B 段 习惯养成（L3-7）       — L3 一上来 12 种 + 48 单位 + 4 颗冰 + 72 颗满碗；必用 1 道具/关
 *   C 段 中阶（L8-13）          — 25-35 种水果，冰 8→11、冻果 3→5，碗内 110-125 颗高密度
 *   D 段 高阶（L14-30）         — buffer 收紧 4 格 + 大量冰冻果 + 130-175 颗碗满，30 关末 53 单位
 *
 * 总订单单位 (`ordersRemaining`)：L1=4 → L3=48 → L10=87 → L18=32 → L30=53
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
    plateLanesInitial: 2,
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
    copiesPerFruit: 6,
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
    copiesPerFruit: 6,
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
    copiesPerFruit: 6,
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
    copiesPerFruit: 6,
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
    copiesPerFruit: 6,
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
    copiesPerFruit: 6,
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
    copiesPerFruit: 6,
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
    copiesPerFruit: 6,
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
    copiesPerFruit: 6,
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
    copiesPerFruit: 6,
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
    copiesPerFruit: 6,
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
    copiesPerFruit: 6,
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
    copiesPerFruit: 6,
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
    copiesPerFruit: 6,
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
    copiesPerFruit: 6,
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
