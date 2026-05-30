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
export const GAME_CLUB_DAILY_POST_COINS = 50;
export const GACHA_PULL_COST = 20;

export const FRUIT_SLICE_COIN_TIERS: FruitSliceCoinTier[] = [
  { minScore: 10000, coins: 220, label: '传奇果切' },
  { minScore: 9000, coins: 195, label: '番香宗师' },
  { minScore: 8000, coins: 170, label: '木瓜大师' },
  { minScore: 7000, coins: 145, label: '红晶达人' },
  { minScore: 6000, coins: 120, label: '绿野高手' },
  { minScore: 5000, coins: 100, label: '异域宗师' },
  { minScore: 4000, coins: 85, label: '龙果过关' },
  { minScore: 3500, coins: 70, label: '高分冲刺' },
  { minScore: 3000, coins: 52, label: '熟练挑战' },
  { minScore: 2500, coins: 30, label: '进阶挑战' },
  { minScore: 2000, coins: 16, label: '稳定发挥' },
  { minScore: 1500, coins: 7, label: '入门奖励' },
  { minScore: 1000, coins: 1, label: '初试奖励' },
];

export const GACHA_REWARD_POOL: GachaReward[] = [
  { id: 'bowl_remove_1', label: '移除道具 x1', weight: 24, kind: 'bowlTool', tool: 'remove', count: 1 },
  { id: 'bowl_shuffle_1', label: '打乱道具 x1', weight: 20, kind: 'bowlTool', tool: 'shuffle', count: 1 },
  { id: 'bowl_add_dish_1', label: '加菜碟道具 x1', weight: 16, kind: 'bowlTool', tool: 'addDish', count: 1 },
  { id: 'fruit_eliminate_1', label: '消除道具 x1', weight: 18, kind: 'fruitSliceTool', tool: 'eliminate', count: 1 },
  { id: 'fruit_shuffle_1', label: '打乱道具 x1', weight: 16, kind: 'fruitSliceTool', tool: 'shuffle', count: 1 },
  {
    id: 'bowl_small_bundle',
    label: '关卡小礼包',
    weight: 8,
    kind: 'bundle',
    rewards: [
      { kind: 'bowlTool', tool: 'remove', count: 1 },
      { kind: 'bowlTool', tool: 'shuffle', count: 1 },
    ],
  },
  {
    id: 'fruit_small_bundle',
    label: '果切小礼包',
    weight: 8,
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
