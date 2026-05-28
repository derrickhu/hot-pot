/** 首页大礼包激励视频广告位（独立于闯关道具广告）。 */
export const HOME_MILESTONE_GIFT_REWARDED_AD_UNIT_ID = 'adunit-6471a691220f784f';

/** v5 整图已含标题/道具/文案，仅底部按钮由程序叠广告进度。 */
export const HOME_MILESTONE_GIFT_PANEL_COMPOSITE = true;

export const HOME_MILESTONE_GIFT_PANEL_TEXTURE_KEY = 'home_milestone_gift_panel';
export const HOME_MILESTONE_GIFT_PANEL_TEXTURE_PATH = 'assets/images/home_milestone_gift_panel_v5.png';

export const HOME_MILESTONE_GIFT_BTN_ORANGE_TEXTURE_KEY = 'home_milestone_gift_btn_orange';
export const HOME_MILESTONE_GIFT_BTN_ORANGE_TEXTURE_PATH = 'assets/images/home_milestone_gift_btn_orange_v2.png';

export const HOME_MILESTONE_GIFT_BTN_GREEN_TEXTURE_KEY = 'home_milestone_gift_btn_green';
export const HOME_MILESTONE_GIFT_BTN_GREEN_TEXTURE_PATH = 'assets/images/home_milestone_gift_btn_green_v2.png';

/** 非 composite 时九宫格；v5 整图不用。 */
export const HOME_MILESTONE_GIFT_PANEL_NINE_SLICE = {
  left: 72,
  top: 112,
  right: 72,
  bottom: 56,
} as const;

/** 面板内容区布局（v5 composite 仅按钮位置有效）。 */
export const HOME_MILESTONE_GIFT_PANEL_LAYOUT = {
  titleYRatio: 0.09,
  subtitleYRatio: 0.22,
  rewardsYRatio: 0.56,
  actionButtonYRatio: 0.86,
  titleFontSize: 32,
  subtitleFontSize: 17,
  rewardIconSize: 76,
  rewardIconSizeNarrow: 66,
  rewardRowGap: 12,
  actionButtonMaxWidth: 360,
  actionButtonWidthRatio: 0.82,
  actionButtonFontSizePending: 24,
  actionButtonFontSizeReady: 30,
  /** 相对按钮中心下移，贴合整图绿色按钮视觉中心 */
  actionButtonLabelOffsetY: 8,
} as const;

/** v5 整图在屏上显示比例（相对逻辑宽/高上限）。 */
export const HOME_MILESTONE_GIFT_PANEL_DISPLAY = {
  widthRatio: 0.92,
  maxWidth: 700,
  heightRatio: 0.78,
  maxHeight: 820,
  screenPaddingX: 16,
} as const;
