import { DAILY_LIMITED_LEVELS } from '@/config/dailyLimitedLevels';

/** 果茶店托盘 Demo 分包贴图根路径（与 game.json 中 milk_tea_demo 一致） */
export const MILK_TEA_DEMO_IMAGES_ROOT = 'subpackages/milk_tea_tray_demo/assets/images';

export const MILK_TEA_DEMO_TEXTURE_KEYS = {
  pageBg: 'milk_tea_demo_page_bg',
  emptyTray: 'milk_tea_demo_empty_tray',
  orderPanel: 'milk_tea_demo_order_panel',
  toolRemove: 'milk_tea_demo_tool_remove',
  toolReshuffle: 'milk_tea_demo_tool_reshuffle',
  toolClearRow: 'milk_tea_demo_tool_clear_row',
  orderCheck: 'milk_tea_demo_order_check',
  orderBag: 'milk_tea_demo_order_bag',
  shopStatusFrame: 'milk_tea_demo_shop_status_frame',
  resultPanelClear: 'milk_tea_demo_result_panel_clear',
  resultPanelLevelUp: 'milk_tea_demo_result_panel_level_up',
  resultPanelFail: 'milk_tea_demo_result_panel_fail',
  boardCrate: 'milk_tea_demo_board_crate',
  boardCrateStates: 'milk_tea_demo_board_crate_states',
  unlockButton: 'milk_tea_demo_unlock_button',
  unlockButtonSheet: 'milk_tea_demo_unlock_button_sheet',
  toolHelpPanels: 'milk_tea_demo_tool_help_panels',
  toolFreeButton: 'milk_tea_demo_tool_free_button',
  roundStartBanner: 'milk_tea_demo_round_start_banner',
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
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.orderCheck, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/order_check.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.orderBag, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/order_bag.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.shopStatusFrame, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/shop_status_frame.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.resultPanelClear, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/result_panel_clear.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.resultPanelLevelUp, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/result_panel_level_up.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.resultPanelFail, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/result_panel_fail.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.boardCrateStates, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/board_crate_states.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.unlockButtonSheet, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/unlock_button_sheet.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.toolHelpPanels, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/tool_help_panels_sheet.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.toolFreeButton, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/tool_free_button.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.roundStartBanner, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/round_start_banner.png` },
  ...DAILY_LIMITED_LEVELS.map((level) => ({
    key: milkTeaDemoDrinkTextureKey(level.themeId),
    path: milkTeaDemoDrinkImagePath(level.themeId),
  })),
];
