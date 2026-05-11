import { FRUIT_SLICE_PROGRESS_KEY } from '@/config/CloudConfig';
import { PersistService } from '@/core/PersistService';

interface FruitSliceProgressState {
  bestScore: number;
  bestScoreAt: number;
  totalRuns: number;
}

function sanitizeScore(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function sanitizeTime(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function readState(): FruitSliceProgressState {
  const stored = PersistService.readJSON<Partial<FruitSliceProgressState>>(FRUIT_SLICE_PROGRESS_KEY);
  return {
    bestScore: sanitizeScore(stored?.bestScore),
    bestScoreAt: sanitizeTime(stored?.bestScoreAt),
    totalRuns: sanitizeScore(stored?.totalRuns),
  };
}

function writeState(): void {
  PersistService.writeJSON(FRUIT_SLICE_PROGRESS_KEY, {
    bestScore,
    bestScoreAt,
    totalRuns,
  });
}

let {
  bestScore,
  bestScoreAt,
  totalRuns,
} = readState();

PersistService.subscribeCloudImport(() => {
  reloadFruitSliceProgressFromPersist();
});

export function getFruitSliceBestScore(): number {
  return bestScore;
}

export function getFruitSliceTotalRuns(): number {
  return totalRuns;
}

export function recordFruitSliceRun(score: number): boolean {
  const normalized = sanitizeScore(score);
  totalRuns += 1;
  const isNewBest = normalized > bestScore;
  if (isNewBest) {
    bestScore = normalized;
    bestScoreAt = Date.now();
  }
  writeState();
  return isNewBest;
}

export function resetFruitSliceProgress(): void {
  bestScore = 0;
  bestScoreAt = 0;
  totalRuns = 0;
  writeState();
}

export function reloadFruitSliceProgressFromPersist(): void {
  const next = readState();
  bestScore = next.bestScore;
  bestScoreAt = next.bestScoreAt;
  totalRuns = next.totalRuns;
}
