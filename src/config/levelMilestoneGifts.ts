import type { GachaReward } from '@/config/economy';

/** 首页常驻大礼包：看满指定次数激励广告后可领取一次。 */
export interface LevelMilestoneGiftDef {
  readonly id: string;
  /** 需完整观看的激励广告次数。 */
  readonly requiredAdViews: number;
  readonly previewTitle: string;
  readonly overlayTitle: string;
  readonly overlayLabel: string;
  readonly coins: number;
  readonly toolRewards: Extract<GachaReward, { kind: 'bundle' }>['rewards'];
}

/** 首页新手大礼包：看 2 次广告可领，五种道具各 1 + 100 金币。 */
export const HOME_STARTER_GIFT_PACK: LevelMilestoneGiftDef = {
  id: 'home_starter_pack',
  requiredAdViews: 2,
  previewTitle: '新手大礼包',
  overlayTitle: '恭喜获得！',
  overlayLabel: '新手大礼包',
  coins: 100,
  toolRewards: [
    { kind: 'bowlTool', tool: 'addDish', count: 1 },
    { kind: 'bowlTool', tool: 'remove', count: 1 },
    { kind: 'bowlTool', tool: 'shuffle', count: 1 },
    { kind: 'fruitSliceTool', tool: 'eliminate', count: 1 },
    { kind: 'fruitSliceTool', tool: 'shuffle', count: 1 },
  ],
};

export const LEVEL_MILESTONE_GIFTS: readonly LevelMilestoneGiftDef[] = [
  HOME_STARTER_GIFT_PACK,
];
