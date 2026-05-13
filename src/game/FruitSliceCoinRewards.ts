import {
  DAILY_FIRST_FRUIT_SLICE_COINS,
  DAILY_FIRST_FRUIT_SLICE_MIN_SCORE,
  fruitSliceCoinsForScore,
} from '@/config/economy';
import { FRUIT_SLICE_REWARD_KEY } from '@/config/CloudConfig';
import { PersistService } from '@/core/PersistService';
import { addCoins } from '@/game/Wallet';

export interface FruitSliceCoinRewardState {
  lastFirstRunRewardDate: string;
  rewardedRuns: number;
  totalScoreCoins: number;
  totalFirstRunCoins: number;
}

export interface FruitSliceCoinRewardResult {
  firstRunCoins: number;
  scoreCoins: number;
  totalCoins: number;
  balance: number;
  tierLabel: string;
  scoreTierMinScore: number;
}

const DEFAULT_STATE: FruitSliceCoinRewardState = {
  lastFirstRunRewardDate: '',
  rewardedRuns: 0,
  totalScoreCoins: 0,
  totalFirstRunCoins: 0,
};

export function settleFruitSliceCoinReward(score: number): FruitSliceCoinRewardResult {
  const normalizedScore = normalizeScore(score);
  const state = readFruitSliceCoinRewardState();
  const today = todayKey();
  const firstRunCoins = state.lastFirstRunRewardDate !== today && normalizedScore >= DAILY_FIRST_FRUIT_SLICE_MIN_SCORE
    ? DAILY_FIRST_FRUIT_SLICE_COINS
    : 0;
  const tier = fruitSliceCoinsForScore(normalizedScore);
  const scoreCoins = tier?.coins ?? 0;
  const totalCoins = firstRunCoins + scoreCoins;
  const nextState = {
    lastFirstRunRewardDate: firstRunCoins > 0 ? today : state.lastFirstRunRewardDate,
    rewardedRuns: state.rewardedRuns + (totalCoins > 0 ? 1 : 0),
    totalScoreCoins: state.totalScoreCoins + scoreCoins,
    totalFirstRunCoins: state.totalFirstRunCoins + firstRunCoins,
  };
  writeFruitSliceCoinRewardState(nextState);
  const wallet = addCoins(totalCoins);
  return {
    firstRunCoins,
    scoreCoins,
    totalCoins,
    balance: wallet.coins,
    tierLabel: tier?.label ?? '暂无奖励',
    scoreTierMinScore: tier?.minScore ?? 0,
  };
}

export function readFruitSliceCoinRewardState(): FruitSliceCoinRewardState {
  return normalizeState(PersistService.readJSON<Partial<FruitSliceCoinRewardState>>(FRUIT_SLICE_REWARD_KEY) || {});
}

function writeFruitSliceCoinRewardState(next: FruitSliceCoinRewardState): void {
  PersistService.writeJSON(FRUIT_SLICE_REWARD_KEY, normalizeState(next));
}

function normalizeState(input: Partial<FruitSliceCoinRewardState>): FruitSliceCoinRewardState {
  return {
    lastFirstRunRewardDate: typeof input.lastFirstRunRewardDate === 'string' ? input.lastFirstRunRewardDate : '',
    rewardedRuns: normalizeScore(input.rewardedRuns),
    totalScoreCoins: normalizeScore(input.totalScoreCoins),
    totalFirstRunCoins: normalizeScore(input.totalFirstRunCoins),
  };
}

function normalizeScore(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
