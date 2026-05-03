const BOWL_LEVEL_KEY = 'hotPot.bowlLevelIndex';
const BOWL_MAX_UNLOCKED_LEVEL_KEY = 'hotPot.bowlMaxUnlockedLevelIndex';
const BOWL_MAX_UNLOCKED_BADGE_LEVEL_KEY = 'hotPot.bowlMaxUnlockedBadgeLevelNumber';

function readNumber(key: string): number | null {
  try {
    const api = typeof wx !== 'undefined' ? wx : null;
    const raw = api?.getStorageSync?.(key) ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null);
    if (raw === null || raw === undefined || raw === '') {
      return null;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number): void {
  try {
    const text = String(Math.max(0, Math.floor(value)));
    const api = typeof wx !== 'undefined' ? wx : null;
    if (api?.setStorageSync) {
      api.setStorageSync(key, text);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, text);
    }
  } catch {
    // 存储失败不影响本局游玩，内存值仍然可用。
  }
}

/** 碗内玩法关卡进度 */
let bowlLevelIndex = readNumber(BOWL_LEVEL_KEY) ?? 0;
let maxUnlockedBowlLevelIndex = Math.max(bowlLevelIndex, readNumber(BOWL_MAX_UNLOCKED_LEVEL_KEY) ?? 0);
let maxUnlockedBowlBadgeLevelNumber =
  readNumber(BOWL_MAX_UNLOCKED_BADGE_LEVEL_KEY) ?? Math.max(0, maxUnlockedBowlLevelIndex);

export function getBowlLevelIndex(): number {
  return bowlLevelIndex;
}

export function setBowlLevelIndex(index: number): void {
  bowlLevelIndex = Math.max(0, Math.floor(index));
  maxUnlockedBowlLevelIndex = Math.max(maxUnlockedBowlLevelIndex, bowlLevelIndex);
  writeNumber(BOWL_LEVEL_KEY, bowlLevelIndex);
  writeNumber(BOWL_MAX_UNLOCKED_LEVEL_KEY, maxUnlockedBowlLevelIndex);
}

export function getMaxUnlockedBowlLevelIndex(): number {
  return maxUnlockedBowlLevelIndex;
}

export function getMaxUnlockedBowlBadgeLevelNumber(): number {
  return maxUnlockedBowlBadgeLevelNumber;
}

export function recordBowlBadgeUnlocked(levelNumber: number): void {
  maxUnlockedBowlBadgeLevelNumber = Math.max(maxUnlockedBowlBadgeLevelNumber, Math.max(0, Math.floor(levelNumber)));
  writeNumber(BOWL_MAX_UNLOCKED_BADGE_LEVEL_KEY, maxUnlockedBowlBadgeLevelNumber);
}

export function resetBowlProgress(): void {
  bowlLevelIndex = 0;
  maxUnlockedBowlLevelIndex = 0;
  maxUnlockedBowlBadgeLevelNumber = 0;
  writeNumber(BOWL_LEVEL_KEY, bowlLevelIndex);
  writeNumber(BOWL_MAX_UNLOCKED_LEVEL_KEY, maxUnlockedBowlLevelIndex);
  writeNumber(BOWL_MAX_UNLOCKED_BADGE_LEVEL_KEY, maxUnlockedBowlBadgeLevelNumber);
}
