import { Game } from '@/core/Game';

/** 返回按钮中心 X（逻辑像素）。 */
export const GAME_TOP_BAR_BACK_X = 58;
/** 金币条左中点 X（逻辑像素）。 */
export const GAME_TOP_BAR_COIN_X = 110;
/** 顶部栏 Y 相对 safeTop 的偏移（返回按钮 / 金币条共用）。 */
export const GAME_TOP_BAR_Y_OFFSET = 18;

export function gameTopBarY(safeTop = Game.safeTop): number {
  return safeTop + GAME_TOP_BAR_Y_OFFSET;
}
