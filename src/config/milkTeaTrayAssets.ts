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
  shopLevelInfoPanel: 'milk_tea_demo_shop_level_info_panel',
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
  shareRewardButton: 'milk_tea_demo_share_reward_button',
  clearShareCard: 'milk_tea_demo_clear_share_card',
} as const;

export const MILK_TEA_SHOP_CLEAR_SHARE_CARD_PATH = `${MILK_TEA_DEMO_IMAGES_ROOT}/milk_tea_shop_clear_share_card.jpg`;

const BOWL_GAME_IMAGES_ROOT = 'subpackages/bowl_game/assets/images';

export function milkTeaDemoDrinkTextureKey(themeId: string): string {
  return `milk_tea_demo_drink_${themeId}`;
}

export function milkTeaDemoDrinkImagePath(themeId: string): string {
  return `${MILK_TEA_DEMO_IMAGES_ROOT}/drinks/${themeId}.png`;
}

/**
 * 果茶店局内杯身贴图覆盖（仅 milkTeaTrayDemo 使用，不影响每日限定）。
 * key = 饮品 themeId；value = 实际加载的 drinks/{themeId}.png。
 *
 * | 饮品（显示名不变） | 原图相近点 | 改用贴图 |
 * |---|---|---|
 * | 蓝莓气泡茶 | 与蓝莓桑葚/葡萄系紫蓝杯相近 | papaya_milk |
 * | 蓝莓桑葚茶 | 紫浆果杯与多肉葡萄相近 | pomegranate_ice_tea |
 * | 芒果香蕉冰饮 | 黄杯与芒果绿茶/菠萝系重复 | cantaloupe_oat_latte |
 * | 芒果绿茶 | 黄块杯与菠萝/香蕉系重复 | snow_pear_lily_tea |
 * | 菠萝椰子茶 | 黄杯+白块与菠萝冰相近 | cucumber_pear_juice |
 * | 荔枝玫瑰茶 | 粉杯与多肉桃桃相近 | lychee_dragonfruit_drink |
 * | 柠檬蜂蜜红茶 | 黄柠杯与百香果爆柠檬相近 | apple_ginger_tea |
 */
export const MILK_TEA_SHOP_DRINK_TEXTURE_OVERRIDES: Readonly<Record<string, string>> = {
  blueberry_soda_tea: 'papaya_milk',
  blueberry_mulberry_tea: 'pomegranate_ice_tea',
  mango_banana_smoothie: 'cantaloupe_oat_latte',
  mango_green_tea: 'snow_pear_lily_tea',
  pineapple_coconut_tea: 'cucumber_pear_juice',
  lychee_rose_tea: 'lychee_dragonfruit_drink',
  lemon_honey_black_tea: 'apple_ginger_tea',
};

export function milkTeaShopDrinkTextureKey(themeId: string): string {
  const resolved = MILK_TEA_SHOP_DRINK_TEXTURE_OVERRIDES[themeId] ?? themeId;
  return milkTeaDemoDrinkTextureKey(resolved);
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
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.shopLevelInfoPanel, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/shop_level_info_panel.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.resultPanelClear, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/result_panel_clear.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.resultPanelLevelUp, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/result_panel_level_up.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.resultPanelFail, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/result_panel_fail.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.boardCrateStates, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/board_crate_states.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.unlockButtonSheet, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/unlock_button_sheet.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.toolHelpPanels, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/tool_help_panels_sheet.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.toolFreeButton, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/tool_free_button.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.roundStartBanner, path: `${MILK_TEA_DEMO_IMAGES_ROOT}/ui/round_start_banner.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.shareRewardButton, path: `${BOWL_GAME_IMAGES_ROOT}/badge_share_reward_button.png` },
  { key: MILK_TEA_DEMO_TEXTURE_KEYS.clearShareCard, path: MILK_TEA_SHOP_CLEAR_SHARE_CARD_PATH },
  ...DAILY_LIMITED_LEVELS.map((level) => ({
    key: milkTeaDemoDrinkTextureKey(level.themeId),
    path: milkTeaDemoDrinkImagePath(level.themeId),
  })),
];
