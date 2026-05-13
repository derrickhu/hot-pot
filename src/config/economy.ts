export interface FruitSliceCoinTier {
  minScore: number;
  coins: number;
  label: string;
}

export type GachaReward =
  | {
      id: string;
      label: string;
      weight: number;
      kind: 'bowlTool';
      tool: 'addDish' | 'remove' | 'shuffle';
      count: number;
    }
  | {
      id: string;
      label: string;
      weight: number;
      kind: 'fruitSliceTool';
      tool: 'eliminate' | 'shuffle';
      count: number;
    }
  | {
      id: string;
      label: string;
      weight: number;
      kind: 'bundle';
      rewards: Array<
        | { kind: 'bowlTool'; tool: 'addDish' | 'remove' | 'shuffle'; count: number }
        | { kind: 'fruitSliceTool'; tool: 'eliminate' | 'shuffle'; count: number }
      >;
    };

export const DAILY_FIRST_FRUIT_SLICE_COINS = 5;
export const DAILY_FIRST_FRUIT_SLICE_MIN_SCORE = 0;
export const GACHA_PULL_COST = 20;

export const FRUIT_SLICE_COIN_TIERS: FruitSliceCoinTier[] = [
  { minScore: 4300, coins: 85, label: '终局高手' },
  { minScore: 3200, coins: 52, label: '高分冲刺' },
  { minScore: 2500, coins: 30, label: '熟练挑战' },
  { minScore: 2000, coins: 16, label: '进阶挑战' },
  { minScore: 1500, coins: 7, label: '稳定发挥' },
  { minScore: 1000, coins: 2, label: '入门奖励' },
];

export const GACHA_REWARD_POOL: GachaReward[] = [
  { id: 'bowl_remove_1', label: '关卡移除 x1', weight: 24, kind: 'bowlTool', tool: 'remove', count: 1 },
  { id: 'bowl_shuffle_1', label: '关卡打乱 x1', weight: 20, kind: 'bowlTool', tool: 'shuffle', count: 1 },
  { id: 'bowl_add_dish_1', label: '加菜碟 x1', weight: 16, kind: 'bowlTool', tool: 'addDish', count: 1 },
  { id: 'fruit_eliminate_1', label: '果切消除 x1', weight: 18, kind: 'fruitSliceTool', tool: 'eliminate', count: 1 },
  { id: 'fruit_shuffle_1', label: '果切打乱 x1', weight: 16, kind: 'fruitSliceTool', tool: 'shuffle', count: 1 },
  {
    id: 'bowl_small_bundle',
    label: '关卡小礼包',
    weight: 4,
    kind: 'bundle',
    rewards: [
      { kind: 'bowlTool', tool: 'remove', count: 1 },
      { kind: 'bowlTool', tool: 'shuffle', count: 1 },
    ],
  },
  {
    id: 'fruit_small_bundle',
    label: '果切小礼包',
    weight: 2,
    kind: 'bundle',
    rewards: [
      { kind: 'fruitSliceTool', tool: 'eliminate', count: 1 },
      { kind: 'fruitSliceTool', tool: 'shuffle', count: 1 },
    ],
  },
];

export function fruitSliceCoinsForScore(score: number): FruitSliceCoinTier | null {
  const normalized = Math.max(0, Math.floor(Number(score) || 0));
  return FRUIT_SLICE_COIN_TIERS.find((tier) => normalized >= tier.minScore) ?? null;
}

export function nextFruitSliceCoinTier(score: number): FruitSliceCoinTier | null {
  const normalized = Math.max(0, Math.floor(Number(score) || 0));
  const ascending = FRUIT_SLICE_COIN_TIERS.slice().sort((a, b) => a.minScore - b.minScore);
  return ascending.find((tier) => normalized < tier.minScore) ?? null;
}
