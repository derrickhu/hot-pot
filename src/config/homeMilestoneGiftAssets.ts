/** 首页大礼包激励视频广告位（独立于闯关道具广告）。 */
export const HOME_MILESTONE_GIFT_REWARDED_AD_UNIT_ID = 'adunit-6471a691220f784f';

/** 首页大礼包弹窗 UI 贴图（品红底生成 + 色键抠图，程序叠字与道具）。 */
export const HOME_MILESTONE_GIFT_PANEL_TEXTURE_KEY = 'home_milestone_gift_panel';
export const HOME_MILESTONE_GIFT_PANEL_TEXTURE_PATH = 'assets/images/home_milestone_gift_panel_v4.png';

export const HOME_MILESTONE_GIFT_BTN_ORANGE_TEXTURE_KEY = 'home_milestone_gift_btn_orange';
export const HOME_MILESTONE_GIFT_BTN_ORANGE_TEXTURE_PATH = 'assets/images/home_milestone_gift_btn_orange_v2.png';

export const HOME_MILESTONE_GIFT_BTN_GREEN_TEXTURE_KEY = 'home_milestone_gift_btn_green';
export const HOME_MILESTONE_GIFT_BTN_GREEN_TEXTURE_PATH = 'assets/images/home_milestone_gift_btn_green_v2.png';

/** 面板九宫格边距（v4 抠图后 720×486，顶栏彩带不拉伸）。 */
export const HOME_MILESTONE_GIFT_PANEL_NINE_SLICE = {
  left: 72,
  top: 112,
  right: 72,
  bottom: 56,
} as const;

/** 面板内容区布局（v4：超值顶栏 + 大内容区，程序叠字与道具）。 */
export const HOME_MILESTONE_GIFT_PANEL_LAYOUT = {
  titleYRatio: 0.09,
  subtitleYRatio: 0.22,
  /** 三行奖励区整体垂直中心 */
  rewardsYRatio: 0.56,
  actionButtonYRatio: 0.87,
  titleFontSize: 32,
  subtitleFontSize: 17,
  rewardIconSize: 76,
  rewardIconSizeNarrow: 66,
  rewardRowGap: 12,
  actionButtonMaxWidth: 252,
  actionButtonWidthRatio: 0.6,
  actionButtonFontSize: 20,
  actionButtonFontSizeReady: 22,
} as const;
