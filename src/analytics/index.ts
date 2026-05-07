import { Analytics, EVENT_NAMES, type DeviceInfo, type PlatformName } from '@gp/analytics-sdk';

import { BACKEND_BASE_URL } from '@/config/CloudConfig';
import { Platform } from '@/core/PlatformService';

export { EVENT_NAMES };
export const analytics = Analytics;

const APP_VERSION = '1.0.0';
const GAME_KEY = 'hotpot';

/**
 * 复用 hot-pot 现有 hotpot-api 同款 HTTP 访问服务网关：
 *   <env-id>.service.tcloudbase.com/<云函数名>/<path>
 * 这是 CloudBase「HTTP 访问服务」网关，跟「云函数 HTTP 触发器」是两套不同 URL 格式，
 * 之前写的 *.app.tcloudbase.com/... 是后者的格式，会被网关 404 INVALID_PATH 拒绝。
 */
const ENDPOINT = `${BACKEND_BASE_URL}/analytics-ingest/track`;

let inited = false;

/** hot-pot 接入入口：在 main.ts 启动尽早调用一次。把 PlatformService 作为 Adapter 注入给 SDK。 */
export function initAnalytics(opts?: { endpoint?: string; userId?: string; debug?: boolean }): void {
  if (inited) return;

  const platformName = mapPlatform();
  const deviceInfo = buildDeviceInfo();

  Analytics.init({
    endpoint: opts?.endpoint || ENDPOINT,
    gameKey: GAME_KEY,
    appVersion: APP_VERSION,
    platform: platformName,
    deviceInfo,
    initialUserId: opts?.userId,
    transport: { request: Platform.request.bind(Platform) },
    storage: {
      get: Platform.getStorageSync.bind(Platform),
      set: Platform.setStorageSync.bind(Platform),
      remove: Platform.removeStorageSync.bind(Platform),
    },
    lifecycle: { onHide: Platform.onHide.bind(Platform) },
    debug: opts?.debug,
  });

  inited = true;
}

/** 业务登录拿到 openid 后调用，让后续事件都带上 user_id */
export function setAnalyticsUserId(userId: string): void {
  if (!inited) return;
  Analytics.setUserId(userId || '');
}

function mapPlatform(): PlatformName {
  if (Platform.isWechat) return 'wechat';
  if (Platform.isDouyin) return 'douyin';
  if (Platform.isMinigame) return 'unknown';
  return 'h5';
}

function buildDeviceInfo(): DeviceInfo {
  const sys = Platform.getSystemInfoSync() || {};
  return {
    brand: String(sys.brand || sys.deviceBrand || ''),
    model: String(sys.model || sys.deviceModel || ''),
    system: String(sys.system || ''),
    sdkVersion: String(sys.SDKVersion || sys.sdkVersion || ''),
    screenWidth: Number(sys.screenWidth) || 0,
    screenHeight: Number(sys.screenHeight) || 0,
    network: 'unknown',
  };
}
