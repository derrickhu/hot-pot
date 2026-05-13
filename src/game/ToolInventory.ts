import { TOOL_INVENTORY_KEY } from '@/config/CloudConfig';
import { PersistService } from '@/core/PersistService';

export type ToolKind = 'addDish' | 'remove' | 'shuffle';

export interface ToolInventoryState {
  addDish: number;
  remove: number;
  shuffle: number;
  lastShareRewardDate: string;
}

const DAILY_SHARE_REWARD_KIND: ToolKind = 'remove';

const DEFAULT_TOOL_INVENTORY: ToolInventoryState = {
  addDish: 0,
  remove: 0,
  shuffle: 0,
  lastShareRewardDate: '',
};

export function readToolInventory(): ToolInventoryState {
  return normalizeToolInventory(PersistService.readJSON<Partial<ToolInventoryState>>(TOOL_INVENTORY_KEY) || {});
}

export function writeToolInventory(next: ToolInventoryState): void {
  PersistService.writeJSON(TOOL_INVENTORY_KEY, normalizeToolInventory(next));
}

export function canClaimDailyShareToolReward(): boolean {
  return readToolInventory().lastShareRewardDate !== todayKey();
}

export function claimDailyShareCleanupReward(): { kind: ToolKind; count: number } | null {
  const state = readToolInventory();
  if (state.lastShareRewardDate === todayKey()) {
    return null;
  }
  state[DAILY_SHARE_REWARD_KIND] += 1;
  state.lastShareRewardDate = todayKey();
  writeToolInventory(state);
  return { kind: DAILY_SHARE_REWARD_KIND, count: state[DAILY_SHARE_REWARD_KIND] };
}

export function getToolCount(kind: ToolKind): number {
  return readToolInventory()[kind];
}

export function consumeTool(kind: ToolKind): { consumed: boolean; count: number } {
  const state = readToolInventory();
  if (state[kind] <= 0) {
    return { consumed: false, count: 0 };
  }
  state[kind] -= 1;
  writeToolInventory(state);
  return { consumed: true, count: state[kind] };
}

export function addTool(kind: ToolKind, count: number): ToolInventoryState {
  const state = readToolInventory();
  const amount = normalizeCount(count);
  if (amount <= 0) {
    return state;
  }
  state[kind] += amount;
  writeToolInventory(state);
  return state;
}

export function toolKindForIndex(index: number): ToolKind {
  if (index === 0) {
    return 'addDish';
  }
  if (index === 1) {
    return 'remove';
  }
  return 'shuffle';
}

export function toolLabel(kind: ToolKind): string {
  if (kind === 'addDish') {
    return '加菜碟';
  }
  if (kind === 'remove') {
    return '移除';
  }
  return '打乱';
}

function normalizeToolInventory(input: Partial<ToolInventoryState>): ToolInventoryState {
  return {
    addDish: normalizeCount(input.addDish),
    remove: normalizeCount(input.remove),
    shuffle: normalizeCount(input.shuffle),
    lastShareRewardDate: typeof input.lastShareRewardDate === 'string' ? input.lastShareRewardDate : '',
  };
}

function normalizeCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return Math.floor(n);
}

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
