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
/**
 * 单次播放周期内是否已上报过 ad_error。
 *
 * wx 在 ad.show() 失败时会同时触发 onError 与 show().catch() 两条通路，
 * 任由它们各自上报会导致 ad_error 被重复计数（实测今日 level_fail_revive 单次 cgi fail 被记成 144×2=288）。
 * 用一个 cycle 标志保证「同一次失败只上报一次」，谁先到谁负责。
 */
let errorReportedThisCycle = false;

const AD_TYPE = 'reward';
const AD_UNIT_ID = GAMEPLAY_REWARDED_AD_UNIT_ID;

/**
 * SDK 自定义错误码，与 wx 真实 errCode 共存于同一个 err_code 字段。
 * - SDK 自定义码用负数（-100 段），方便后端按 err_code < 0 区分「我们自己生成的」vs「微信抛的」
 * - wx 真实码透传（常见：-1 cgi fail、1004 no advertisement、1005 ad init failed 等），不再包装成 -102
 */
const SDK_ERR_UNAVAILABLE = -100;
const SDK_ERR_BUSY = -101;

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

/**
 * 同一次播放周期内只允许打一次 ad_error。
 *
 * 还有一个并行约束：context 为空时不上报。
 * wx 的激励广告对象在没有业务调用 show() 的间歇也会做后台 prefetch / 自动重试，prefetch 失败也会
 * 触发 onError，这种与业务无关的「无主错误」如果上报，会让 scene 落到 unknown 桶污染统计。
 */
function reportAdErrorOnce(
  context: RewardedAdContext | null,
  errCode: number,
  errMsg: string,
): void {
  if (errorReportedThisCycle) return;
  if (!context) return;
  errorReportedThisCycle = true;
  trackAd(EVENT_NAMES.AD_ERROR, context, { err_code: errCode, err_msg: errMsg || 'unknown' });
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
    // wx 真实 errCode 透传；onError 与 show().catch() 谁先到谁负责，cycle 标志去重
    reportAdErrorOnce(pendingContext, Number(err?.errCode ?? -1), String(err?.errMsg || 'unknown'));
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
    // SDK 不可用走自定义码（不会被 wx 真实码覆盖）
    trackAd(EVENT_NAMES.AD_ERROR, context, { err_code: SDK_ERR_UNAVAILABLE, err_msg: 'unavailable' });
    return 'unavailable';
  }
  if (pendingResolve) {
    trackAd(EVENT_NAMES.AD_ERROR, context, { err_code: SDK_ERR_BUSY, err_msg: 'busy' });
    return 'error';
  }

  pendingContext = context;
  errorReportedThisCycle = false;
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
      .catch((err: { errMsg?: string; errCode?: number } | Error | undefined) => {
        // 兜底：极少数情况 promise 立即 reject 但 onError 没触发（如 ad.show is undefined），
        // 此时 reportAdErrorOnce 会真的打一次；onError 已上报过则被 cycle flag 跳过。
        const e = err as { errMsg?: string; errCode?: number } | undefined;
        reportAdErrorOnce(pendingContext, Number(e?.errCode ?? -1), String(e?.errMsg || (err as Error)?.message || 'unknown'));
        finishPendingRewardedAd('error');
      });
  });
}
