import { DAILY_LIMITED_LEVELS } from '@/config/dailyLimitedLevels';

/** 奶茶店托盘 Demo 分包贴图根路径（与 game.json 中 milk_tea_demo 一致） */
export const MILK_TEA_DEMO_IMAGES_ROOT = 'subpackages/milk_tea_tray_demo/assets/images';

export const MILK_TEA_DEMO_TEXTURE_KEYS = {
  pageBg: 'milk_tea_demo_page_bg',
  emptyTray: 'milk_tea_demo_empty_tray',
  orderPanel: 'milk_tea_demo_order_panel',
  toolRemove: 'milk_tea_demo_tool_remove',
  toolReshuffle: 'milk_tea_demo_tool_reshuffle',
  toolClearRow: 'milk_tea_demo_tool_clear_row',
} as const;

export function milkTeaDemoDrinkTextureKey(themeId: string): string {
  return `milk_tea_demo_drink_${themeId}`;
}

export function milkTeaDemoDrinkImagePath(themeId: string): string {
  return `${MILK_TEA_DEMO_IMAGES_ROOT}/drinks/${themeId}.png`;
}

export const MILK_TEA_DEMO_PRELOAD_PATHS: ReadonlyArray<{ key: string; path: string }> = [
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.pageBg, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/page_bg.jpg` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.emptyTray, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/empty_tray.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.orderPanel, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/order_panel.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.toolRemove, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/tools/tool_remove.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.toolReshuffle, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/tools/tool_reshuffle.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.toolClearRow, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/tools/tool_clear_row.png` },
  ...DAILY_LIMITED_LEVELS.map((level) => ({
    key: milkTeaDemoDrinkTextureKey(level.themeId),
    path: milkTeaDemoDrinkImagePath(level.themeId),
  })),
];
