import { MILK_TEA_SHOP_PROGRESS_KEY } from '@/config/CloudConfig';
import { getMilkTeaShopLevelDef, MILK_TEA_SHOP_MAX_LEVEL } from '@/config/milkTeaShopLevels';
import { addCoins } from '@/game/Wallet';
import { PersistService } from '@/core/PersistService';

export const MILK_TEA_SHOP_DAILY_SHARE_REWARD_COINS = 10;

export interface MilkTeaShopProgressState {
  shopLevel: number;
  clearsInLevel: number;
  totalClears: number;
  dailyClears: number;
  lastPlayDate: string;
  lastShareRewardDate: string;
}

const DEFAULT_STATE: MilkTeaShopProgressState = {
  shopLevel: 1,
  clearsInLevel: 0,
  totalClears: 0,
  dailyClears: 0,
  lastPlayDate: '',
  lastShareRewardDate: '',
};

export interface MilkTeaShopClearApplyResult {
  state: MilkTeaShopProgressState;
  previousLevel: number;
  levelUps: number;
}

export function readMilkTeaShopProgress(): MilkTeaShopProgressState {
  return normalizeState(PersistService.readJSON<Partial<MilkTeaShopProgressState>>(MILK_TEA_SHOP_PROGRESS_KEY) || {});
}

export function applyMilkTeaShopClear(): MilkTeaShopClearApplyResult {
  const today = todayKey();
  const current = resetDailyIfNeeded(readMilkTeaShopProgress(), today);
  const previousLevel = current.shopLevel;
  let shopLevel = current.shopLevel;
  let clearsInLevel = current.clearsInLevel + 1;

  while (shopLevel < MILK_TEA_SHOP_MAX_LEVEL) {
    const levelDef = getMilkTeaShopLevelDef(shopLevel);
    if (levelDef.clearsToNext <= 0 || clearsInLevel < levelDef.clearsToNext) {
      break;
    }
    clearsInLevel -= levelDef.clearsToNext;
    shopLevel += 1;
  }

  if (shopLevel >= MILK_TEA_SHOP_MAX_LEVEL) {
    shopLevel = MILK_TEA_SHOP_MAX_LEVEL;
    clearsInLevel = 0;
  }

  const next: MilkTeaShopProgressState = {
    shopLevel,
    clearsInLevel,
    totalClears: current.totalClears + 1,
    dailyClears: current.dailyClears + 1,
    lastPlayDate: today,
    lastShareRewardDate: current.lastShareRewardDate,
  };
  writeMilkTeaShopProgress(next);
  return {
    state: next,
    previousLevel,
    levelUps: Math.max(0, shopLevel - previousLevel),
  };
}

export function resetMilkTeaShopProgress(): void {
  writeMilkTeaShopProgress(DEFAULT_STATE);
}

export function canClaimMilkTeaShopDailyShareReward(): boolean {
  return readMilkTeaShopProgress().lastShareRewardDate !== todayKey();
}

/** 分享奖励：每日一次 +10 金币；已领取则返回 null。 */
export function claimMilkTeaShopDailyShareReward(): number | null {
  const today = todayKey();
  const current = readMilkTeaShopProgress();
  if (current.lastShareRewardDate === today) {
    return null;
  }
  writeMilkTeaShopProgress({
    ...current,
    lastShareRewardDate: today,
  });
  addCoins(MILK_TEA_SHOP_DAILY_SHARE_REWARD_COINS);
  return MILK_TEA_SHOP_DAILY_SHARE_REWARD_COINS;
}

function writeMilkTeaShopProgress(next: MilkTeaShopProgressState): void {
  PersistService.writeJSON(MILK_TEA_SHOP_PROGRESS_KEY, normalizeState(next));
}

function resetDailyIfNeeded(state: MilkTeaShopProgressState, today: string): MilkTeaShopProgressState {
  if (state.lastPlayDate === today) {
    return state;
  }
  return {
    ...state,
    dailyClears: 0,
    lastPlayDate: today,
  };
}

function normalizeState(input: Partial<MilkTeaShopProgressState>): MilkTeaShopProgressState {
  const shopLevel = Math.min(MILK_TEA_SHOP_MAX_LEVEL, Math.max(1, normalizeCount(input.shopLevel) || 1));
  const levelDef = getMilkTeaShopLevelDef(shopLevel);
  return {
    shopLevel,
    clearsInLevel: levelDef.clearsToNext > 0
      ? Math.min(normalizeCount(input.clearsInLevel), levelDef.clearsToNext - 1)
      : 0,
    totalClears: normalizeCount(input.totalClears),
    dailyClears: normalizeCount(input.dailyClears),
    lastPlayDate: typeof input.lastPlayDate === 'string' ? input.lastPlayDate : '',
    lastShareRewardDate: typeof input.lastShareRewardDate === 'string' ? input.lastShareRewardDate : '',
  };
}

function normalizeCount(value: unknown): number {
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
