import { GAME_KEY } from '@/config/CloudConfig';
import { Platform } from '@/core/PlatformService';

/**
 * 新手引导完成标记仅保存在本机（不进云存储）：
 * - 仅用于决定下次进玩法是否再次显示，不需要跨端同步；
 * - 不进 CLOUD_SYNC_ALLOWLIST，避免被云端覆盖。
 */
const FIRST_LEVEL_TUTORIAL_KEY = `${GAME_KEY}_tutorial_lvl1`;
const TRUE_FLAG = '1';

export function isFirstLevelTutorialDone(): boolean {
  return Platform.getStorageSync(FIRST_LEVEL_TUTORIAL_KEY) === TRUE_FLAG;
}

export function markFirstLevelTutorialDone(): void {
  Platform.setStorageSync(FIRST_LEVEL_TUTORIAL_KEY, TRUE_FLAG);
}

/** 调试用：清除引导标记，下次进第一关将重新显示。 */
export function resetFirstLevelTutorial(): void {
  Platform.removeStorageSync(FIRST_LEVEL_TUTORIAL_KEY);
}

/**
 * 机制说明面板「已看」标记：
 *   - ice：首次进入有冰块的关卡时弹一次
 *   - frozen：首次进入有冻果的关卡时弹一次
 * 与新手引导一样仅本机存储，不进云存储。
 */
export type MechanicIntroKind = 'ice' | 'frozen';

function mechanicIntroStorageKey(kind: MechanicIntroKind): string {
  return `${GAME_KEY}_intro_${kind}`;
}

export function isMechanicIntroSeen(kind: MechanicIntroKind): boolean {
  return Platform.getStorageSync(mechanicIntroStorageKey(kind)) === TRUE_FLAG;
}

export function markMechanicIntroSeen(kind: MechanicIntroKind): void {
  Platform.setStorageSync(mechanicIntroStorageKey(kind), TRUE_FLAG);
}

/** 调试用：清除某机制说明已看标记 */
export function resetMechanicIntroSeen(kind: MechanicIntroKind): void {
  Platform.removeStorageSync(mechanicIntroStorageKey(kind));
}
