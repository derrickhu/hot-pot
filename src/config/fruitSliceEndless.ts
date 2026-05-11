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
  100,
  300,
  600,
  1000,
  1600,
  2400,
  3400,
  4800,
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
    minScore: 200,
    fruitIds: ['grape'],
    bonus: 0,
    label: '果香升级',
  },
  {
    minScore: 300,
    fruitIds: ['kiwi'],
    bonus: 0,
    label: '果香升级',
  },
  {
    minScore: 400,
    fruitIds: ['cucumber'],
    bonus: 0,
    label: '果香升级',
  },
  {
    minScore: 500,
    fruitIds: ['peach'],
    bonus: 2,
    label: '热带加码',
  },
  {
    minScore: 650,
    fruitIds: ['pineapple'],
    bonus: 2,
    label: '热带加码',
  },
  {
    minScore: 800,
    fruitIds: ['watermelon'],
    bonus: 2,
    label: '热带加码',
  },
  {
    minScore: 950,
    fruitIds: ['mango'],
    bonus: 2,
    label: '热带加码',
  },
  {
    minScore: 1150,
    fruitIds: ['mandarin'],
    bonus: 2,
    label: '清甜果园',
  },
  {
    minScore: 1350,
    fruitIds: ['cantaloupe'],
    bonus: 2,
    label: '清甜果园',
  },
  {
    minScore: 1550,
    fruitIds: ['honeydew'],
    bonus: 2,
    label: '清甜果园',
  },
  {
    minScore: 1800,
    fruitIds: ['young_coconut'],
    bonus: 4,
    label: '岭南丰收',
  },
  {
    minScore: 2050,
    fruitIds: ['lychee'],
    bonus: 4,
    label: '岭南丰收',
  },
  {
    minScore: 2300,
    fruitIds: ['bayberry'],
    bonus: 4,
    label: '岭南丰收',
  },
  {
    minScore: 2600,
    fruitIds: ['passionfruit'],
    bonus: 4,
    label: '酸甜冲刺',
  },
  {
    minScore: 2900,
    fruitIds: ['grapefruit'],
    bonus: 4,
    label: '酸甜冲刺',
  },
  {
    minScore: 3200,
    fruitIds: ['starfruit'],
    bonus: 6,
    label: '星果长廊',
  },
  {
    minScore: 3700,
    fruitIds: ['durian'],
    bonus: 8,
    label: '榴莲压轴',
  },
  {
    minScore: 4300,
    fruitIds: ['dragonfruit'],
    bonus: 8,
    label: '火龙惊喜',
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
