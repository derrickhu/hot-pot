import { WALLET_KEY } from '@/config/CloudConfig';
import { PersistService } from '@/core/PersistService';

export interface WalletState {
  coins: number;
  totalEarned: number;
  totalSpent: number;
}

const DEFAULT_WALLET: WalletState = {
  coins: 0,
  totalEarned: 0,
  totalSpent: 0,
};

export function readWallet(): WalletState {
  return normalizeWallet(PersistService.readJSON<Partial<WalletState>>(WALLET_KEY) || {});
}

export function getCoinBalance(): number {
  return readWallet().coins;
}

export function addCoins(amount: number): WalletState {
  const coins = normalizeCount(amount);
  const state = readWallet();
  if (coins <= 0) {
    return state;
  }
  const next = {
    coins: state.coins + coins,
    totalEarned: state.totalEarned + coins,
    totalSpent: state.totalSpent,
  };
  writeWallet(next);
  return next;
}

export function spendCoins(amount: number): { ok: boolean; state: WalletState } {
  const coins = normalizeCount(amount);
  const state = readWallet();
  if (coins <= 0) {
    return { ok: true, state };
  }
  if (state.coins < coins) {
    return { ok: false, state };
  }
  const next = {
    coins: state.coins - coins,
    totalEarned: state.totalEarned,
    totalSpent: state.totalSpent + coins,
  };
  writeWallet(next);
  return { ok: true, state: next };
}

function writeWallet(next: WalletState): void {
  PersistService.writeJSON(WALLET_KEY, normalizeWallet(next));
}

function normalizeWallet(input: Partial<WalletState>): WalletState {
  return {
    coins: normalizeCount(input.coins),
    totalEarned: normalizeCount(input.totalEarned),
    totalSpent: normalizeCount(input.totalSpent),
  };
}

function normalizeCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return Math.floor(n);
}
