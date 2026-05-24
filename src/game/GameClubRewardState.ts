import { GAME_CLUB_REWARD_KEY } from '@/config/CloudConfig';
import { GAME_CLUB_DAILY_POST_COINS } from '@/config/economy';
import { PersistService } from '@/core/PersistService';
import { addCoins } from '@/game/Wallet';

export interface GameClubRewardState {
  lastClaimDate: string;
}

const DEFAULT_STATE: GameClubRewardState = {
  lastClaimDate: '',
};

export function readGameClubRewardState(): GameClubRewardState {
  return normalizeState(PersistService.readJSON<Partial<GameClubRewardState>>(GAME_CLUB_REWARD_KEY) || {});
}

export function hasClaimedGameClubRewardToday(): boolean {
  return readGameClubRewardState().lastClaimDate === todayKey();
}

export function canClaimGameClubDailyPostReward(postCount: number): boolean {
  return postCount >= 1 && !hasClaimedGameClubRewardToday();
}

export function claimGameClubDailyPostReward(postCount: number): { ok: boolean; coins: number; balance: number } {
  if (!canClaimGameClubDailyPostReward(postCount)) {
    return { ok: false, coins: 0, balance: addCoins(0).coins };
  }
  writeGameClubRewardState({ lastClaimDate: todayKey() });
  const wallet = addCoins(GAME_CLUB_DAILY_POST_COINS);
  return { ok: true, coins: GAME_CLUB_DAILY_POST_COINS, balance: wallet.coins };
}

function writeGameClubRewardState(next: GameClubRewardState): void {
  PersistService.writeJSON(GAME_CLUB_REWARD_KEY, normalizeState(next));
}

function normalizeState(input: Partial<GameClubRewardState>): GameClubRewardState {
  return {
    lastClaimDate: typeof input.lastClaimDate === 'string' ? input.lastClaimDate : '',
  };
}

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
