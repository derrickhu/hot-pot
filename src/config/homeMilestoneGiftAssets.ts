/** 首页大礼包激励视频广告位（独立于闯关道具广告）。 */
export const HOME_MILESTONE_GIFT_REWARDED_AD_UNIT_ID = 'adunit-6471a691220f784f';

/** 首页大礼包弹窗 UI 贴图（品红底生成 + 色键抠图，程序叠字与道具）。 */
export const HOME_MILESTONE_GIFT_PANEL_TEXTURE_KEY = 'home_milestone_gift_panel';
export const HOME_MILESTONE_GIFT_PANEL_TEXTURE_PATH = 'assets/images/home_milestone_gift_panel_v3.png';

export const HOME_MILESTONE_GIFT_BTN_ORANGE_TEXTURE_KEY = 'home_milestone_gift_btn_orange';
export const HOME_MILESTONE_GIFT_BTN_ORANGE_TEXTURE_PATH = 'assets/images/home_milestone_gift_btn_orange_v2.png';

export const HOME_MILESTONE_GIFT_BTN_GREEN_TEXTURE_KEY = 'home_milestone_gift_btn_green';
export const HOME_MILESTONE_GIFT_BTN_GREEN_TEXTURE_PATH = 'assets/images/home_milestone_gift_btn_green_v2.png';

/** 面板九宫格边距（按 v2 抠图后约 680×440 逻辑尺寸估算）。 */
export const HOME_MILESTONE_GIFT_PANEL_NINE_SLICE = {
  left: 105,
  top: 118,
  right: 105,
  bottom: 72,
} as const;

/** 面板内容区布局（相对面板高度，anchor 居中；v3 顶部庆祝彩带较高）。 */
export const HOME_MILESTONE_GIFT_PANEL_LAYOUT = {
  titleYRatio: 0.1,
  subtitleYRatio: 0.2,
  /** 三行奖励区整体垂直中心 */
  rewardsYRatio: 0.52,
  actionButtonYRatio: 0.88,
  titleFontSize: 34,
  subtitleFontSize: 18,
  rewardIconSize: 72,
  rewardIconSizeNarrow: 64,
  rewardRowGap: 14,
  actionButtonMaxWidth: 252,
  actionButtonWidthRatio: 0.6,
  actionButtonFontSize: 20,
  actionButtonFontSizeReady: 22,
} as const;
