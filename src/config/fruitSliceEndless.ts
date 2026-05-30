import type { FruitId } from '@/config/fruits';

export interface FruitSliceStage {
  minScore: number;
  fruitIds: FruitId[];
  bonus: number;
  label: string;
}

export interface FruitSlicePhysicsConfig {
  fruitCount: number;
  minRadius: number;
  maxRadius: number;
  gravity: number;
  maxFallSpeed: number;
  bounce: number;
  supportScanRadius: number;
  pipeCapacity: number;
}

export const FRUIT_SLICE_BASE_SCORE = 10;
export const FRUIT_SLICE_UNLOCKED_BONUS = 5;
export const FRUIT_SLICE_COMBO_WINDOW_MS = 1800;
export const FRUIT_SLICE_COMBO_BONUS_STEP = 2;
export const FRUIT_SLICE_COMBO_BONUS_MAX = 6;

export const FRUIT_SLICE_MILESTONES = [
  1000,
  1500,
  2000,
  2500,
  3000,
  3500,
  4000,
  5000,
  6000,
  7000,
  8000,
  9000,
  10000,
] as const;

export const FRUIT_SLICE_PHYSICS: FruitSlicePhysicsConfig = {
  fruitCount: 56,
  minRadius: 40,
  maxRadius: 48,
  gravity: 1850,
  maxFallSpeed: 1450,
  bounce: 0.18,
  supportScanRadius: 150,
  pipeCapacity: 8,
};

export const FRUIT_SLICE_STAGES: FruitSliceStage[] = [
  {
    minScore: 0,
    fruitIds: ['blueberry', 'lemon', 'orange', 'strawberry', 'apple', 'banana'],
    bonus: 0,
    label: '鲜果开局',
  },
  {
    minScore: 300,
    fruitIds: ['grape'],
    bonus: 0,
    label: '果香升级',
  },
  {
    minScore: 500,
    fruitIds: ['kiwi'],
    bonus: 0,
    label: '果香升级',
  },
  {
    minScore: 700,
    fruitIds: ['cucumber'],
    bonus: 0,
    label: '果香升级',
  },
  {
    minScore: 900,
    fruitIds: ['peach'],
    bonus: 2,
    label: '果香升级',
  },
  {
    minScore: 1000,
    fruitIds: ['pineapple'],
    bonus: 2,
    label: '热带加码',
  },
  {
    minScore: 1250,
    fruitIds: ['mango'],
    bonus: 2,
    label: '热带加码',
  },
  {
    minScore: 1500,
    fruitIds: ['watermelon'],
    bonus: 2,
    label: '清甜果园',
  },
  {
    minScore: 1750,
    fruitIds: ['mandarin'],
    bonus: 2,
    label: '清甜果园',
  },
  {
    minScore: 2000,
    fruitIds: ['cantaloupe'],
    bonus: 2,
    label: '瓜香满园',
  },
  {
    minScore: 2250,
    fruitIds: ['honeydew'],
    bonus: 2,
    label: '瓜香满园',
  },
  {
    minScore: 2500,
    fruitIds: ['young_coconut'],
    bonus: 4,
    label: '岭南丰收',
  },
  {
    minScore: 2670,
    fruitIds: ['lychee'],
    bonus: 4,
    label: '岭南丰收',
  },
  {
    minScore: 2840,
    fruitIds: ['bayberry'],
    bonus: 4,
    label: '岭南丰收',
  },
  {
    minScore: 3000,
    fruitIds: ['passionfruit'],
    bonus: 4,
    label: '酸甜冲刺',
  },
  {
    minScore: 3250,
    fruitIds: ['grapefruit'],
    bonus: 4,
    label: '酸甜冲刺',
  },
  {
    minScore: 3500,
    fruitIds: ['starfruit'],
    bonus: 6,
    label: '星果长廊',
  },
  {
    minScore: 3750,
    fruitIds: ['durian'],
    bonus: 8,
    label: '星果长廊',
  },
  {
    minScore: 4000,
    fruitIds: ['dragonfruit'],
    bonus: 8,
    label: '火龙惊喜',
  },
  {
    minScore: 5000,
    fruitIds: ['mangosteen'],
    bonus: 10,
    label: '紫果秘境',
  },
  {
    minScore: 6000,
    fruitIds: ['avocado'],
    bonus: 10,
    label: '绿野新味',
  },
  {
    minScore: 7000,
    fruitIds: ['pomegranate'],
    bonus: 12,
    label: '红晶满枝',
  },
  {
    minScore: 8000,
    fruitIds: ['papaya'],
    bonus: 12,
    label: '热带深远',
  },
  {
    minScore: 9000,
    fruitIds: ['guava'],
    bonus: 14,
    label: '番香愈浓',
  },
  {
    minScore: 10000,
    fruitIds: ['fig'],
    bonus: 16,
    label: '奇园终章',
  },
];

export function getFruitSliceStageIndex(score: number): number {
  let out = 0;
  for (let i = 0; i < FRUIT_SLICE_STAGES.length; i += 1) {
    if (score >= FRUIT_SLICE_STAGES[i]!.minScore) {
      out = i;
    }
  }
  return out;
}

export function getFruitSliceActiveFruitIds(score: number): FruitId[] {
  const stageIndex = getFruitSliceStageIndex(score);
  return Array.from(new Set(FRUIT_SLICE_STAGES.slice(0, stageIndex + 1).flatMap((stage) => stage.fruitIds)));
}

export function getFruitSliceStageBonus(fruitId: FruitId, score: number): number {
  const stageIndex = getFruitSliceStageIndex(score);
  for (let i = stageIndex; i >= 0; i -= 1) {
    const stage = FRUIT_SLICE_STAGES[i]!;
    if (stage.fruitIds.includes(fruitId)) {
      return stage.bonus;
    }
  }
  return 0;
}
