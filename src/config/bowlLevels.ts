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

const UNLOCK_GROUPS = [
  ['blueberry', 'lemon', 'orange', 'strawberry'],
  ['apple', 'banana', 'grape'],
  ['kiwi', 'cucumber'],
  ['peach', 'pineapple', 'watermelon'],
  ['mango', 'cherry'],
  ['cherry_tomato', 'grape_green', 'lime'],
  ['mandarin', 'cantaloupe'],
  ['honeydew', 'young_coconut', 'lychee'],
  ['longan', 'dried_longan'],
  ['bayberry', 'blackberry', 'cranberry'],
  ['raspberry', 'mulberry'],
  ['passionfruit', 'grapefruit', 'kumquat'],
  ['starfruit', 'plum'],
  ['nectarine', 'persimmon', 'almond_slice'],
  ['peanut', 'walnut_piece'],
  ['chestnut', 'red_date', 'sour_plum'],
  ['mint', 'osmanthus'],
  ['radish_heart', 'black_rice', 'foxnut'],
  ['lotus_seed', 'lily_bulb'],
  ['lotus_root', 'snow_fungus', 'peach_gum'],
  ['pumpkin_cube', 'sweet_potato'],
  ['taro_dice', 'water_chestnut', 'boba_pearl'],
  ['coconut_jelly', 'sago'],
  ['basil_seed', 'grass_jelly', 'red_bean'],
  ['mini_mochi', 'taro_ball'],
  ['pudding_cube', 'cookie_crumb', 'chocolate_chip'],
  ['oat_flake', 'marshmallow'],
  ['pop_boba', 'durian', 'gooseberry'],
  ['blackcurrant'],
  ['dragonfruit'],
] as const satisfies readonly (readonly FruitId[])[];

function levelFruits(levelNumber: number): FruitId[] {
  const idx = Math.max(0, Math.min(levelNumber - 1, UNLOCK_GROUPS.length - 1));
  const windowSize = levelNumber < 10 ? levelNumber : levelNumber < 20 ? 7 : 8;
  const start = Math.max(0, idx - windowSize + 1);
  return Array.from(new Set<FruitId>([
    ...UNLOCK_GROUPS[0]!,
    ...UNLOCK_GROUPS.slice(start, idx + 1).flat(),
  ]));
}

export const BOWL_LEVELS: BowlLevelDef[] = [
  {
    levelNumber: 1,
    displayName: '第1关 酸奶初醒',
    fruitIds: levelFruits(1),
    copiesPerFruit: 3,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 2,
    displayName: '第2关 红绿双响',
    fruitIds: levelFruits(2),
    copiesPerFruit: 3,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 3,
    displayName: '第3关 热带开席',
    fruitIds: levelFruits(3),
    copiesPerFruit: 3,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 4,
    displayName: '第4关 星果长廊',
    fruitIds: levelFruits(4),
    copiesPerFruit: 3,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 5,
    displayName: '第5关 莓柚花会',
    fruitIds: levelFruits(5),
    copiesPerFruit: 3,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 6,
    displayName: '第6关 坚果蜜语',
    fruitIds: levelFruits(6),
    copiesPerFruit: 3,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 7,
    displayName: '第7关 暖盅小宴',
    fruitIds: levelFruits(7),
    copiesPerFruit: 3,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 8,
    displayName: '第8关 珠露小料',
    fruitIds: levelFruits(8),
    copiesPerFruit: 3,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 9,
    displayName: '第9关 甜脆交锋',
    fruitIds: levelFruits(9),
    copiesPerFruit: 3,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 2,
    ...allTools,
  },
  {
    levelNumber: 10,
    displayName: '第10关 三盘演练',
    fruitIds: levelFruits(10),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 11,
    displayName: '第11关 鲜果巡礼',
    fruitIds: levelFruits(11),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 12,
    displayName: '第12关 果香续宴',
    fruitIds: levelFruits(12),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 13,
    displayName: '第13关 东方蜜径',
    fruitIds: levelFruits(13),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 14,
    displayName: '第14关 缤纷拼盘',
    fruitIds: levelFruits(14),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 15,
    displayName: '第15关 百味协奏',
    fruitIds: levelFruits(15),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 16,
    displayName: '第16关 十五星上席',
    fruitIds: levelFruits(16),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 17,
    displayName: '第17关 十五星收束',
    fruitIds: levelFruits(17),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 18,
    displayName: '第18关 杂味圆舞',
    fruitIds: levelFruits(18),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 19,
    displayName: '第19关 薄冰试炼',
    fruitIds: levelFruits(19),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    iceCount: 10,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 20,
    displayName: '第20关 四味重奏',
    fruitIds: levelFruits(20),
    copiesPerFruit: 8,
    orderTarget: 4,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 21,
    displayName: '第21关 果阵初章',
    fruitIds: levelFruits(21),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 22,
    displayName: '第22关 果阵回环',
    fruitIds: levelFruits(22),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 23,
    displayName: '第23关 滋补雅集',
    fruitIds: levelFruits(23),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 24,
    displayName: '第24关 小料满仓',
    fruitIds: levelFruits(24),
    copiesPerFruit: 6,
    orderTarget: 3,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 25,
    displayName: '第25关 重味温习',
    fruitIds: levelFruits(25),
    copiesPerFruit: 8,
    orderTarget: 4,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 26,
    displayName: '第26关 果阵再开',
    fruitIds: levelFruits(26),
    copiesPerFruit: 8,
    orderTarget: 4,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 27,
    displayName: '第27关 滋补再炖',
    fruitIds: levelFruits(27),
    copiesPerFruit: 8,
    orderTarget: 4,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 28,
    displayName: '第28关 小料再添',
    fruitIds: levelFruits(28),
    copiesPerFruit: 8,
    orderTarget: 4,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 29,
    displayName: '第29关 廿星连珠',
    fruitIds: levelFruits(29),
    copiesPerFruit: 8,
    orderTarget: 4,
    bufferSize: 5,
    plateLanesInitial: 3,
    ...allTools,
  },
  {
    levelNumber: 30,
    displayName: '第30关 廿四终宴',
    fruitIds: levelFruits(30),
    copiesPerFruit: 8,
    orderTarget: 4,
    bufferSize: 5,
    iceCount: 12,
    plateLanesInitial: 3,
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
