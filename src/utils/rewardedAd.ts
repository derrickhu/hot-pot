import { analytics, EVENT_NAMES } from '@/analytics';

export const GAMEPLAY_REWARDED_AD_UNIT_ID = 'adunit-baadf000b7626d29';

export type RewardedAdResult = 'completed' | 'skipped' | 'unavailable' | 'error';

export interface RewardedAdContext {
  /** 业务场景，作为广告收益估算的核心维度，例 'level_fail_revive' / 'tool_help_free' */
  scene: string;
  /** 关卡 id，用于经分按关卡聚合 */
  levelId?: number | string;
  /** 额外业务字段，会扁平合入 params */
  extra?: Record<string, string | number | boolean>;
}

type RewardedVideoAd = ReturnType<NonNullable<typeof wx.createRewardedVideoAd>>;

let gameplayRewardedAd: RewardedVideoAd | null = null;
let pendingResolve: ((result: RewardedAdResult) => void) | null = null;
let pendingContext: RewardedAdContext | null = null;
let rewardedAdListenersReady = false;

const AD_TYPE = 'reward';
const AD_UNIT_ID = GAMEPLAY_REWARDED_AD_UNIT_ID;

function buildAdParams(context: RewardedAdContext | null, extras?: Record<string, string | number | boolean>): Record<string, string | number | boolean | null> {
  const base: Record<string, string | number | boolean | null> = {
    ad_unit_id: AD_UNIT_ID,
    ad_type: AD_TYPE,
    scene: context?.scene || 'unknown',
  };
  if (context?.levelId !== undefined && context?.levelId !== null) {
    base.level_id = context.levelId as string | number;
  }
  if (context?.extra) {
    Object.assign(base, context.extra);
  }
  if (extras) {
    Object.assign(base, extras);
  }
  return base;
}

function trackAd(eventName: string, context: RewardedAdContext | null, extras?: Record<string, string | number | boolean>): void {
  try {
    analytics.track(eventName, buildAdParams(context, extras));
  } catch {
    // 埋点失败不能影响业务
  }
}

function finishPendingRewardedAd(result: RewardedAdResult): void {
  const resolve = pendingResolve;
  const context = pendingContext;
  if (!resolve) {
    return;
  }
  pendingResolve = null;
  pendingContext = null;
  trackAd(EVENT_NAMES.AD_CLOSE, context, {
    completed: result === 'completed',
    result,
  });
  resolve(result);
}

function bindGameplayRewardedAdListeners(ad: RewardedVideoAd): void {
  if (rewardedAdListenersReady) {
    return;
  }
  rewardedAdListenersReady = true;
  ad.onClose((res?: { isEnded?: boolean }) => {
    finishPendingRewardedAd(res?.isEnded === false ? 'skipped' : 'completed');
  });
  ad.onError((err: { errMsg?: string; errCode?: number }) => {
    console.warn('Rewarded video ad error', err);
    trackAd(EVENT_NAMES.AD_ERROR, pendingContext, {
      err_code: err?.errCode ?? -1,
      err_msg: err?.errMsg || 'unknown',
    });
    finishPendingRewardedAd('error');
  });
}

function getGameplayRewardedAd(): RewardedVideoAd | null {
  if (typeof wx === 'undefined' || !wx.createRewardedVideoAd) {
    return null;
  }
  try {
    gameplayRewardedAd ??= wx.createRewardedVideoAd({ adUnitId: GAMEPLAY_REWARDED_AD_UNIT_ID });
    bindGameplayRewardedAdListeners(gameplayRewardedAd);
    return gameplayRewardedAd;
  } catch {
    return null;
  }
}

/**
 * 播放激励视频广告。
 * 自动上报 ad_request / ad_show / ad_close / ad_error 四种事件，业务方只需传 scene 上下文。
 * scene 不能为空，否则经分聚合时会落到 unknown 桶。
 */
export async function showGameplayRewardedAd(context: RewardedAdContext): Promise<RewardedAdResult> {
  trackAd(EVENT_NAMES.AD_REQUEST, context);

  const ad = getGameplayRewardedAd();
  if (!ad) {
    trackAd(EVENT_NAMES.AD_ERROR, context, { err_code: -100, err_msg: 'unavailable' });
    return 'unavailable';
  }
  if (pendingResolve) {
    trackAd(EVENT_NAMES.AD_ERROR, context, { err_code: -101, err_msg: 'busy' });
    return 'error';
  }

  pendingContext = context;
  return new Promise<RewardedAdResult>((resolve) => {
    pendingResolve = resolve;

    ad.show()
      .then(() => {
        // 真正展示成功才打 ad_show，避免 load 失败时虚高曝光数据
        trackAd(EVENT_NAMES.AD_SHOW, context);
      })
      .catch(() => ad.load().then(() => ad.show()).then(() => {
        trackAd(EVENT_NAMES.AD_SHOW, context);
      }))
      .catch((err) => {
        trackAd(EVENT_NAMES.AD_ERROR, context, {
          err_code: -102,
          err_msg: err?.errMsg || String(err),
        });
        finishPendingRewardedAd('error');
      });
  });
}
