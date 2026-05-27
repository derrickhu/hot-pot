import type { LevelMilestoneGiftDef } from '@/config/levelMilestoneGifts';
import { LEVEL_MILESTONE_GIFTS } from '@/config/levelMilestoneGifts';
import { LEVEL_MILESTONE_GIFT_STATE_KEY } from '@/config/CloudConfig';
import { PersistService } from '@/core/PersistService';
import { addFruitSliceTools, type FruitSliceInventoryToolKind } from '@/game/FruitSliceToolInventory';
import { addTools, type ToolKind } from '@/game/ToolInventory';
import { addCoins } from '@/game/Wallet';

export type LevelMilestoneGiftStatus = 'pending_ads' | 'claimable' | 'claimed';

interface LevelMilestoneGiftPersistState {
  claimedIds: string[];
  adViewsByGiftId: Record<string, number>;
}

function readState(): LevelMilestoneGiftPersistState {
  const stored = PersistService.readJSON<Partial<LevelMilestoneGiftPersistState>>(LEVEL_MILESTONE_GIFT_STATE_KEY);
  const claimedIds = Array.isArray(stored?.claimedIds)
    ? stored.claimedIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  const adViewsByGiftId: Record<string, number> = {};
  if (stored?.adViewsByGiftId && typeof stored.adViewsByGiftId === 'object') {
    for (const [key, value] of Object.entries(stored.adViewsByGiftId)) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) {
        adViewsByGiftId[key] = Math.floor(n);
      }
    }
  }
  return { claimedIds, adViewsByGiftId };
}

function writeState(next: LevelMilestoneGiftPersistState): void {
  PersistService.writeJSON(LEVEL_MILESTONE_GIFT_STATE_KEY, next);
}

export function isLevelMilestoneGiftClaimed(giftId: string): boolean {
  return readState().claimedIds.includes(giftId);
}

export function getLevelMilestoneGiftAdProgress(
  gift: LevelMilestoneGiftDef,
): { current: number; max: number } {
  const max = Math.max(1, gift.requiredAdViews);
  const state = readState();
  const current = Math.min(Math.max(0, state.adViewsByGiftId[gift.id] ?? 0), max);
  return { current, max };
}

export function recordLevelMilestoneGiftAdView(giftId: string, gift: LevelMilestoneGiftDef): number {
  const state = readState();
  const max = Math.max(1, gift.requiredAdViews);
  const prev = Math.min(state.adViewsByGiftId[giftId] ?? 0, max);
  if (prev >= max) {
    return prev;
  }
  const next = prev + 1;
  writeState({
    ...state,
    adViewsByGiftId: { ...state.adViewsByGiftId, [giftId]: next },
  });
  return next;
}

export function getLevelMilestoneGiftStatus(gift: LevelMilestoneGiftDef): LevelMilestoneGiftStatus {
  if (isLevelMilestoneGiftClaimed(gift.id)) {
    return 'claimed';
  }
  const { current, max } = getLevelMilestoneGiftAdProgress(gift);
  if (current >= max) {
    return 'claimable';
  }
  return 'pending_ads';
}

/** 未领取时始终展示在首页。 */
export function getActiveHomeLevelMilestoneGift(): LevelMilestoneGiftDef | null {
  for (const gift of LEVEL_MILESTONE_GIFTS) {
    if (!isLevelMilestoneGiftClaimed(gift.id)) {
      return gift;
    }
  }
  return null;
}

export function claimLevelMilestoneGift(gift: LevelMilestoneGiftDef): boolean {
  if (getLevelMilestoneGiftStatus(gift) !== 'claimable') {
    return false;
  }
  const state = readState();
  if (state.claimedIds.includes(gift.id)) {
    return false;
  }

  const bowlToolCounts: Partial<Record<ToolKind, number>> = {};
  const fruitSliceToolCounts: Partial<Record<FruitSliceInventoryToolKind, number>> = {};
  for (const item of gift.toolRewards) {
    if (item.kind === 'bowlTool') {
      bowlToolCounts[item.tool] = (bowlToolCounts[item.tool] ?? 0) + item.count;
    } else {
      fruitSliceToolCounts[item.tool] = (fruitSliceToolCounts[item.tool] ?? 0) + item.count;
    }
  }
  addTools(bowlToolCounts);
  addFruitSliceTools(fruitSliceToolCounts);
  if (gift.coins > 0) {
    addCoins(gift.coins);
  }

  const adViewsByGiftId = { ...state.adViewsByGiftId };
  delete adViewsByGiftId[gift.id];
  writeState({ claimedIds: [...state.claimedIds, gift.id], adViewsByGiftId });
  return true;
}
