import { GACHA_PULL_COST, GACHA_REWARD_POOL, type GachaReward } from '@/config/economy';
import { GACHA_STATE_KEY } from '@/config/CloudConfig';
import { PersistService } from '@/core/PersistService';
import { addFruitSliceTools, type FruitSliceInventoryToolKind } from '@/game/FruitSliceToolInventory';
import { addTools, type ToolKind } from '@/game/ToolInventory';
import { spendCoins } from '@/game/Wallet';

export interface GachaState {
  totalPulls: number;
  lastRewardId: string;
  lastRewardAt: number;
}

export interface GachaPullResult {
  ok: boolean;
  reason?: 'notEnoughCoins';
  reward?: GachaReward;
  balance: number;
  totalPulls: number;
}

const DEFAULT_STATE: GachaState = {
  totalPulls: 0,
  lastRewardId: '',
  lastRewardAt: 0,
};

export function pullGachaOnce(): GachaPullResult {
  const spent = spendCoins(GACHA_PULL_COST);
  if (!spent.ok) {
    return {
      ok: false,
      reason: 'notEnoughCoins',
      balance: spent.state.coins,
      totalPulls: readGachaState().totalPulls,
    };
  }
  const reward = rollGachaReward();
  grantGachaReward(reward);
  const state = readGachaState();
  const next = {
    totalPulls: state.totalPulls + 1,
    lastRewardId: reward.id,
    lastRewardAt: Date.now(),
  };
  writeGachaState(next);
  return {
    ok: true,
    reward,
    balance: spent.state.coins,
    totalPulls: next.totalPulls,
  };
}

export function readGachaState(): GachaState {
  return normalizeState(PersistService.readJSON<Partial<GachaState>>(GACHA_STATE_KEY) || {});
}

function writeGachaState(next: GachaState): void {
  PersistService.writeJSON(GACHA_STATE_KEY, normalizeState(next));
}

function rollGachaReward(): GachaReward {
  const totalWeight = GACHA_REWARD_POOL.reduce((sum, reward) => sum + Math.max(0, reward.weight), 0);
  let ticket = Math.random() * Math.max(1, totalWeight);
  for (const reward of GACHA_REWARD_POOL) {
    ticket -= Math.max(0, reward.weight);
    if (ticket <= 0) {
      return reward;
    }
  }
  return GACHA_REWARD_POOL[GACHA_REWARD_POOL.length - 1]!;
}

function grantGachaReward(reward: GachaReward): void {
  const bowlToolCounts: Partial<Record<ToolKind, number>> = {};
  const fruitSliceToolCounts: Partial<Record<FruitSliceInventoryToolKind, number>> = {};
  const addBowlToolReward = (tool: ToolKind, count: number): void => {
    bowlToolCounts[tool] = (bowlToolCounts[tool] ?? 0) + count;
  };
  const addFruitSliceToolReward = (tool: FruitSliceInventoryToolKind, count: number): void => {
    fruitSliceToolCounts[tool] = (fruitSliceToolCounts[tool] ?? 0) + count;
  };

  if (reward.kind === 'bowlTool') {
    addBowlToolReward(reward.tool, reward.count);
    addTools(bowlToolCounts);
    return;
  }
  if (reward.kind === 'fruitSliceTool') {
    addFruitSliceToolReward(reward.tool, reward.count);
    addFruitSliceTools(fruitSliceToolCounts);
    return;
  }
  for (const item of reward.rewards) {
    if (item.kind === 'bowlTool') {
      addBowlToolReward(item.tool, item.count);
    } else if (item.kind === 'fruitSliceTool') {
      addFruitSliceToolReward(item.tool, item.count);
    } else {
      const unexpected: never = item;
      console.warn('[GachaState] unknown bundle reward item', unexpected);
    }
  }
  addTools(bowlToolCounts);
  addFruitSliceTools(fruitSliceToolCounts);
}

function normalizeState(input: Partial<GachaState>): GachaState {
  return {
    totalPulls: normalizeCount(input.totalPulls),
    lastRewardId: typeof input.lastRewardId === 'string' ? input.lastRewardId : '',
    lastRewardAt: normalizeCount(input.lastRewardAt),
  };
}

function normalizeCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return Math.floor(n);
}
