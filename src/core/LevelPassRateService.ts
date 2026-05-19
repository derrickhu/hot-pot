import {
  CLOUD_ENV_ID,
  LEVEL_PASS_RATE_CACHE_KEY,
  LEVEL_PASS_RATE_COLLECTION,
  LEVEL_PASS_RATE_DOC_ID,
} from '@/config/CloudConfig';
import { BackendService, type BackendLevelPassRatesResult, type LevelPassRateItem } from '@/core/BackendService';
import { Platform } from '@/core/PlatformService';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface LevelPassRateCache extends BackendLevelPassRatesResult {
  cached_at: number;
}

class LevelPassRateServiceClass {
  private snapshot: LevelPassRateCache | null = null;
  private inflight: Promise<LevelPassRateCache | null> | null = null;

  getLevel(levelId: number): LevelPassRateItem | null {
    const snapshot = this.getCachedSnapshot();
    return snapshot?.levels.find((item) => item.level_id === levelId) || null;
  }

  async refreshIfNeeded(): Promise<LevelPassRateCache | null> {
    const cached = this.getCachedSnapshot();
    if (cached && Date.now() - cached.cached_at < CACHE_TTL_MS) {
      return cached;
    }
    return this.refresh();
  }

  async refresh(): Promise<LevelPassRateCache | null> {
    if (this.inflight) {
      return this.inflight;
    }
    this.inflight = this.fetchSnapshot()
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  private getCachedSnapshot(): LevelPassRateCache | null {
    if (this.snapshot) {
      return this.snapshot;
    }
    const raw = Platform.getStorageSync(LEVEL_PASS_RATE_CACHE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as LevelPassRateCache;
      if (Array.isArray(parsed?.levels)) {
        this.snapshot = parsed;
        return parsed;
      }
    } catch {
      // 缓存损坏时静默降级，不影响正常闯关。
    }
    return null;
  }

  private async fetchSnapshot(): Promise<LevelPassRateCache | null> {
    try {
      const remote = await this.fetchFromBackendOrCloud();
      const snapshot = { ...remote, cached_at: Date.now() };
      this.snapshot = snapshot;
      Platform.setStorageSync(LEVEL_PASS_RATE_CACHE_KEY, JSON.stringify(snapshot));
      return snapshot;
    } catch (error) {
      console.warn('[LevelPassRate] fetch failed', error);
      return this.getCachedSnapshot();
    }
  }

  private async fetchFromBackendOrCloud(): Promise<BackendLevelPassRatesResult> {
    try {
      return await BackendService.listLevelPassRates();
    } catch (backendError) {
      const cloudSnapshot = await this.fetchFromWechatCloud();
      if (cloudSnapshot) {
        return cloudSnapshot;
      }
      throw backendError;
    }
  }

  private fetchFromWechatCloud(): Promise<BackendLevelPassRatesResult | null> {
    const cloud = typeof wx !== 'undefined' ? wx.cloud : null;
    if (!cloud?.database) {
      return Promise.resolve(null);
    }
    try {
      cloud.init?.({ env: CLOUD_ENV_ID });
    } catch {
      // 云开发可能已经初始化过，继续尝试读取公共快照。
    }
    return new Promise((resolve) => {
      try {
        cloud.database()
          .collection(LEVEL_PASS_RATE_COLLECTION)
          .doc(LEVEL_PASS_RATE_DOC_ID)
          .get({
            success: (res: { data?: BackendLevelPassRatesResult }) => resolve(res?.data || null),
            fail: () => resolve(null),
          });
      } catch {
        resolve(null);
      }
    });
  }
}

export const LevelPassRateService = new LevelPassRateServiceClass();
