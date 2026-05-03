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

function readState(): BowlProgressState {
  const stored = PersistService.readJSON<Partial<BowlProgressState>>(BOWL_PROGRESS_KEY);
  const levelIndex = sanitizeIndex(stored?.levelIndex);
  return {
    levelIndex,
    maxUnlockedLevelIndex: Math.max(levelIndex, sanitizeIndex(stored?.maxUnlockedLevelIndex)),
    maxUnlockedBadgeLevelNumber: sanitizeIndex(stored?.maxUnlockedBadgeLevelNumber),
  };
}

function writeState(): void {
  PersistService.writeJSON(BOWL_PROGRESS_KEY, {
    levelIndex: bowlLevelIndex,
    maxUnlockedLevelIndex: maxUnlockedBowlLevelIndex,
    maxUnlockedBadgeLevelNumber: maxUnlockedBowlBadgeLevelNumber,
  });
}

let {
  levelIndex: bowlLevelIndex,
  maxUnlockedLevelIndex: maxUnlockedBowlLevelIndex,
  maxUnlockedBadgeLevelNumber: maxUnlockedBowlBadgeLevelNumber,
} = readState();

PersistService.subscribeCloudImport(() => {
  reloadBowlProgressFromPersist();
});

export function getBowlLevelIndex(): number {
  return bowlLevelIndex;
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
  writeState();
}

export function resetBowlProgress(): void {
  bowlLevelIndex = 0;
  maxUnlockedBowlLevelIndex = 0;
  maxUnlockedBowlBadgeLevelNumber = 0;
  writeState();
}

export function reloadBowlProgressFromPersist(): void {
  const next = readState();
  bowlLevelIndex = next.levelIndex;
  maxUnlockedBowlLevelIndex = next.maxUnlockedLevelIndex;
  maxUnlockedBowlBadgeLevelNumber = next.maxUnlockedBadgeLevelNumber;
}
