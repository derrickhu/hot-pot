import { analytics, EVENT_NAMES } from '@/analytics';
import { isWxDevtoolsSimulator } from '@/utils/wxMinigameEnv';

export const CATALOG_INTERSTITIAL_AD_UNIT_ID = 'adunit-feb828f4fbe9298f';

export type InterstitialAdResult = 'shown' | 'unavailable' | 'error';

export interface InterstitialAdContext {
  /** 业务场景，用于经分聚合，例：'catalog_open' */
  scene: string;
  /** 额外业务字段，会扁平合入 params */
  extra?: Record<string, string | number | boolean>;
}

type InterstitialAd = ReturnType<NonNullable<typeof wx.createInterstitialAd>>;

const AD_TYPE = 'interstitial';

/**
 * SDK 自定义错误码（与激励广告保持同一套语义）：
 * - 负数 -100 段为 SDK 自定义码（unavailable / busy 等业务侧场景）
 * - wx 真实 errCode 透传（-1 cgi fail / 1004 no advertisement / 1005 ad init failed 等）
 */
const SDK_ERR_UNAVAILABLE = -100;

interface InterstitialAdEntry {
  ad: InterstitialAd;
  unitId: string;
  /**
   * 当前在播或刚刚结束的业务上下文。
   *
   * 注意：之前的实现里在 onClose 里直接清成 null，导致后续 wx 后台 prefetch 触发的 onError
   * 拿不到 scene 落到 unknown 桶。改成 onClose 不清空、新一次 show 时再覆盖，
   * 配合「无主错误不上报」逻辑（context 必为 truthy 才打 ad_error）。
   */
  pendingContext: InterstitialAdContext | null;
  /** 单次播放周期内是否已上报 ad_error，避免 onError 与 show().catch() 双发 */
  errorReportedThisCycle: boolean;
  listenersReady: boolean;
}

const entries = new Map<string, InterstitialAdEntry>();

function buildAdParams(
  unitId: string,
  context: InterstitialAdContext | null,
  extras?: Record<string, string | number | boolean>,
): Record<string, string | number | boolean | null> {
  const base: Record<string, string | number | boolean | null> = {
    ad_unit_id: unitId,
    ad_type: AD_TYPE,
    scene: context?.scene || 'unknown',
  };
  if (context?.extra) {
    Object.assign(base, context.extra);
  }
  if (extras) {
    Object.assign(base, extras);
  }
  return base;
}

function trackAd(
  eventName: string,
  unitId: string,
  context: InterstitialAdContext | null,
  extras?: Record<string, string | number | boolean>,
): void {
  try {
    analytics.track(eventName, buildAdParams(unitId, context, extras));
  } catch {
    // 埋点失败不能影响业务
  }
}

/**
 * 同一周期内只允许打一次 ad_error；context 为空时直接跳过。
 *
 * wx 的 InterstitialAd 实例在没有任何业务 show() 调用时也会自动 prefetch / 重试，
 * prefetch 失败也会触发 onError。这种「无主错误」与业务体验无关，上报会污染 scene 维度统计，
 * 跳过即可。
 */
function reportAdErrorOnce(
  entry: InterstitialAdEntry,
  errCode: number,
  errMsg: string,
): void {
  if (entry.errorReportedThisCycle) return;
  if (!entry.pendingContext) return;
  entry.errorReportedThisCycle = true;
  trackAd(EVENT_NAMES.AD_ERROR, entry.unitId, entry.pendingContext, {
    err_code: errCode,
    err_msg: errMsg || 'unknown',
  });
}

function bindListeners(entry: InterstitialAdEntry): void {
  if (entry.listenersReady) {
    return;
  }
  entry.listenersReady = true;
  entry.ad.onClose(() => {
    // 不再立即清 pendingContext —— 留给下一次 show() 覆盖即可，
    // 中间 wx 自动 prefetch 触发的 onError 仍能拿到最近一次业务 scene。
    trackAd(EVENT_NAMES.AD_CLOSE, entry.unitId, entry.pendingContext);
  });
  entry.ad.onError((err: { errMsg?: string; errCode?: number }) => {
    console.warn('Interstitial ad error', err);
    reportAdErrorOnce(entry, Number(err?.errCode ?? -1), String(err?.errMsg || 'unknown'));
  });
}

function getEntry(unitId: string): InterstitialAdEntry | null {
  if (typeof wx === 'undefined' || !wx.createInterstitialAd) {
    return null;
  }
  let entry = entries.get(unitId) ?? null;
  if (!entry) {
    try {
      const ad = wx.createInterstitialAd({ adUnitId: unitId });
      entry = {
        ad,
        unitId,
        pendingContext: null,
        errorReportedThisCycle: false,
        listenersReady: false,
      };
      entries.set(unitId, entry);
    } catch {
      return null;
    }
  }
  bindListeners(entry);
  return entry;
}

/**
 * 展示插屏广告。
 * 微信会自带频次限制（默认 1 次/分钟、新用户保护期等），业务侧无需再做节流。
 * 上报 ad_request / ad_show / ad_close / ad_error，便于经分按 scene 聚合。
 */
export async function showInterstitialAd(
  context: InterstitialAdContext,
  unitId: string = CATALOG_INTERSTITIAL_AD_UNIT_ID,
): Promise<InterstitialAdResult> {
  // 开发者工具里插屏常走 operateWXDataForAd 并报 system apperror，直接跳过避免控制台刷屏与干扰调试
  if (isWxDevtoolsSimulator()) {
    return 'unavailable';
  }

  trackAd(EVENT_NAMES.AD_REQUEST, unitId, context);

  const entry = getEntry(unitId);
  if (!entry) {
    trackAd(EVENT_NAMES.AD_ERROR, unitId, context, { err_code: SDK_ERR_UNAVAILABLE, err_msg: 'unavailable' });
    return 'unavailable';
  }

  // 新一次播放：刷新业务上下文 + 重置 cycle 标志
  entry.pendingContext = context;
  entry.errorReportedThisCycle = false;

  try {
    await entry.ad.show();
    trackAd(EVENT_NAMES.AD_SHOW, unitId, context);
    return 'shown';
  } catch (err) {
    // show 失败常见原因：未到下一次可展示时间、还没 load 完成；尝试 load 后再展示一次
    try {
      await entry.ad.load();
      await entry.ad.show();
      trackAd(EVENT_NAMES.AD_SHOW, unitId, context);
      return 'shown';
    } catch (err2) {
      const e = (err2 ?? err) as { errMsg?: string; errCode?: number } | undefined;
      // 兜底：onError 没触发或 promise 立即 reject 时打一次，cycle 已上报则被去重
      reportAdErrorOnce(entry, Number(e?.errCode ?? -1), String(e?.errMsg || 'unknown'));
      return 'error';
    }
  }
}
