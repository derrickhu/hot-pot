import { BOWL_LEVEL_COUNT } from '@/config/bowlLevels';
import { BOWL_PROGRESS_KEY } from '@/config/CloudConfig';
import { PersistService } from '@/core/PersistService';

interface BowlProgressState {
  levelIndex: number;
  maxUnlockedLevelIndex: number;
  maxUnlockedBadgeLevelNumber: number;
}

function sanitizeIndex(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function readRawState(): BowlProgressState {
  const stored = PersistService.readJSON<Partial<BowlProgressState>>(BOWL_PROGRESS_KEY);
  const levelIndex = sanitizeIndex(stored?.levelIndex);
  return {
    levelIndex,
    maxUnlockedLevelIndex: Math.max(levelIndex, sanitizeIndex(stored?.maxUnlockedLevelIndex)),
    maxUnlockedBadgeLevelNumber: sanitizeIndex(stored?.maxUnlockedBadgeLevelNumber),
  };
}

/**
 * 徽章 N 表示第 N 关已通关，下一关应为 index N。
 * 旧版在最后一关通关后会把 levelIndex 重置为 0 或停在 29，扩关后需自动补到续章起点。
 */
function reconcileLevelIndex(state: BowlProgressState): BowlProgressState {
  const { levelIndex, maxUnlockedLevelIndex, maxUnlockedBadgeLevelNumber } = state;
  if (maxUnlockedBadgeLevelNumber >= BOWL_LEVEL_COUNT) {
    return state;
  }
  const minPlayIndex = Math.min(maxUnlockedBadgeLevelNumber, BOWL_LEVEL_COUNT - 1);
  if (levelIndex >= minPlayIndex) {
    return state;
  }
  return {
    levelIndex: minPlayIndex,
    maxUnlockedLevelIndex: Math.max(maxUnlockedLevelIndex, minPlayIndex),
    maxUnlockedBadgeLevelNumber,
  };
}

function readState(): BowlProgressState {
  return reconcileLevelIndex(readRawState());
}

function applyReconciledState(state: BowlProgressState): void {
  const next = reconcileLevelIndex(state);
  bowlLevelIndex = next.levelIndex;
  maxUnlockedBowlLevelIndex = next.maxUnlockedLevelIndex;
  maxUnlockedBowlBadgeLevelNumber = next.maxUnlockedBadgeLevelNumber;
}
function hydrateFromStorage(persistIfReconciled = false): void {
  const raw = readRawState();
  applyReconciledState(raw);
  const next = readState();
  if (
    persistIfReconciled &&
    (next.levelIndex !== raw.levelIndex || next.maxUnlockedLevelIndex !== raw.maxUnlockedLevelIndex)
  ) {
    writeState();
  }
}

function writeState(): void {
  PersistService.writeJSON(BOWL_PROGRESS_KEY, {
    levelIndex: bowlLevelIndex,
    maxUnlockedLevelIndex: maxUnlockedBowlLevelIndex,
    maxUnlockedBadgeLevelNumber: maxUnlockedBowlBadgeLevelNumber,
  });
}

let bowlLevelIndex = 0;
let maxUnlockedBowlLevelIndex = 0;
let maxUnlockedBowlBadgeLevelNumber = 0;

hydrateFromStorage(true);

PersistService.subscribeCloudImport(() => {
  reloadBowlProgressFromPersist();
});

export function getBowlLevelIndex(): number {
  return bowlLevelIndex;
}

export function hasBowlProgressRecord(): boolean {
  return PersistService.readRaw(BOWL_PROGRESS_KEY) !== null;
}

export function markBowlProgressStarted(): void {
  if (!hasBowlProgressRecord()) {
    writeState();
  }
}

export function setBowlLevelIndex(index: number): void {
  bowlLevelIndex = Math.max(0, Math.floor(index));
  maxUnlockedBowlLevelIndex = Math.max(maxUnlockedBowlLevelIndex, bowlLevelIndex);
  writeState();
}

export function getMaxUnlockedBowlLevelIndex(): number {
  return maxUnlockedBowlLevelIndex;
}

export function getMaxUnlockedBowlBadgeLevelNumber(): number {
  return maxUnlockedBowlBadgeLevelNumber;
}

export function recordBowlBadgeUnlocked(levelNumber: number): void {
  maxUnlockedBowlBadgeLevelNumber = Math.max(maxUnlockedBowlBadgeLevelNumber, Math.max(0, Math.floor(levelNumber)));
  applyReconciledState({
    levelIndex: bowlLevelIndex,
    maxUnlockedLevelIndex: maxUnlockedBowlLevelIndex,
    maxUnlockedBadgeLevelNumber: maxUnlockedBowlBadgeLevelNumber,
  });
  writeState();
}

export function resetBowlProgress(): void {
  bowlLevelIndex = 0;
  maxUnlockedBowlLevelIndex = 0;
  maxUnlockedBowlBadgeLevelNumber = 0;
  writeState();
}

export function reloadBowlProgressFromPersist(): void {
  hydrateFromStorage(true);
}
