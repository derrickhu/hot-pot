import { FRUIT_SLICE_TOOL_INVENTORY_KEY } from '@/config/CloudConfig';
import { PersistService } from '@/core/PersistService';

export type FruitSliceInventoryToolKind = 'eliminate' | 'shuffle';

export interface FruitSliceToolInventoryState {
  eliminate: number;
  shuffle: number;
}

const DEFAULT_STATE: FruitSliceToolInventoryState = {
  eliminate: 0,
  shuffle: 0,
};

export function readFruitSliceToolInventory(): FruitSliceToolInventoryState {
  return normalizeState(PersistService.readJSON<Partial<FruitSliceToolInventoryState>>(FRUIT_SLICE_TOOL_INVENTORY_KEY) || {});
}

export function getFruitSliceToolCount(kind: FruitSliceInventoryToolKind): number {
  return readFruitSliceToolInventory()[kind];
}

export function addFruitSliceTool(kind: FruitSliceInventoryToolKind, count: number): FruitSliceToolInventoryState {
  const amount = normalizeCount(count);
  const state = readFruitSliceToolInventory();
  if (amount <= 0) {
    return state;
  }
  const next = { ...state, [kind]: state[kind] + amount };
  writeFruitSliceToolInventory(next);
  return next;
}

export function consumeFruitSliceTool(kind: FruitSliceInventoryToolKind): { consumed: boolean; count: number } {
  const state = readFruitSliceToolInventory();
  if (state[kind] <= 0) {
    return { consumed: false, count: 0 };
  }
  const next = { ...state, [kind]: state[kind] - 1 };
  writeFruitSliceToolInventory(next);
  return { consumed: true, count: next[kind] };
}

export function fruitSliceToolLabel(kind: FruitSliceInventoryToolKind): string {
  return kind === 'eliminate' ? '果切消除' : '果切打乱';
}

function writeFruitSliceToolInventory(next: FruitSliceToolInventoryState): void {
  PersistService.writeJSON(FRUIT_SLICE_TOOL_INVENTORY_KEY, normalizeState(next));
}

function normalizeState(input: Partial<FruitSliceToolInventoryState>): FruitSliceToolInventoryState {
  return {
    eliminate: normalizeCount(input.eliminate),
    shuffle: normalizeCount(input.shuffle),
  };
}

function normalizeCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return Math.floor(n);
}
