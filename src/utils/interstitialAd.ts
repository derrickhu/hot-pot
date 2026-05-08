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

interface InterstitialAdEntry {
  ad: InterstitialAd;
  unitId: string;
  pendingContext: InterstitialAdContext | null;
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

function bindListeners(entry: InterstitialAdEntry): void {
  if (entry.listenersReady) {
    return;
  }
  entry.listenersReady = true;
  entry.ad.onClose(() => {
    const ctx = entry.pendingContext;
    entry.pendingContext = null;
    trackAd(EVENT_NAMES.AD_CLOSE, entry.unitId, ctx);
  });
  entry.ad.onError((err: { errMsg?: string; errCode?: number }) => {
    console.warn('Interstitial ad error', err);
    trackAd(EVENT_NAMES.AD_ERROR, entry.unitId, entry.pendingContext, {
      err_code: err?.errCode ?? -1,
      err_msg: err?.errMsg || 'unknown',
    });
    entry.pendingContext = null;
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
      entry = { ad, unitId, pendingContext: null, listenersReady: false };
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
    trackAd(EVENT_NAMES.AD_ERROR, unitId, context, { err_code: -100, err_msg: 'unavailable' });
    return 'unavailable';
  }

  entry.pendingContext = context;
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
      const e = (err2 ?? err) as { errMsg?: string; errCode?: number };
      trackAd(EVENT_NAMES.AD_ERROR, unitId, context, {
        err_code: e?.errCode ?? -102,
        err_msg: e?.errMsg || String(e),
      });
      entry.pendingContext = null;
      return 'error';
    }
  }
}
