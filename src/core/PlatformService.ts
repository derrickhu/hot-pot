export type PlatformName = 'wechat' | 'douyin' | 'unknown';

class PlatformServiceClass {
  readonly name: PlatformName;
  private readonly api: any;

  constructor() {
    if (typeof wx !== 'undefined') {
      this.api = wx;
      this.name = 'wechat';
    } else if (typeof tt !== 'undefined') {
      this.api = tt;
      this.name = 'douyin';
    } else {
      this.api = null;
      this.name = 'unknown';
    }
  }

  get isMinigame(): boolean {
    return this.api !== null;
  }

  get isWechat(): boolean {
    return this.name === 'wechat';
  }

  get isDouyin(): boolean {
    return this.name === 'douyin';
  }

  get canUseBackend(): boolean {
    return typeof this.api?.request === 'function' || typeof globalThis.fetch === 'function';
  }

  getStorageSync(key: string): string | null {
    try {
      if (this.api?.getStorageSync) {
        return this.api.getStorageSync(key) || null;
      }
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  setStorageSync(key: string, value: string): void {
    try {
      if (this.api?.setStorageSync) {
        this.api.setStorageSync(key, value);
        return;
      }
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Local cache failure should not block gameplay.
    }
  }

  /** 异步写入本地存储（避免阻塞主线程） */
  setStorageAsync(key: string, value: string): void {
    try {
      if (this.api?.setStorage) {
        this.api.setStorage({ key, data: value, fail() {} });
      } else {
        this.setStorageSync(key, value);
      }
    } catch {
      // Local cache failure should not block gameplay.
    }
  }

  removeStorageSync(key: string): void {
    try {
      if (this.api?.removeStorageSync) {
        this.api.removeStorageSync(key);
        return;
      }
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Local cache failure should not block gameplay.
    }
  }

  request(opts: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: unknown;
    headers?: Record<string, string>;
    timeoutMs?: number;
  }): Promise<{ statusCode: number; data: any }> {
    const method = (opts.method || 'POST').toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE';
    const headers = {
      'content-type': 'application/json',
      ...(opts.headers || {}),
    };
    const timeoutMs = opts.timeoutMs && opts.timeoutMs > 0 ? opts.timeoutMs : 10000;

    if (this.api?.request && !this.isDevtoolsFetchPreferred()) {
      return this.requestViaMiniApi(opts.url, method, opts.data, headers, timeoutMs);
    }
    if (typeof globalThis.fetch === 'function') {
      return this.requestViaFetch(opts.url, method, opts.data, headers, timeoutMs);
    }
    if (this.api?.request) {
      return this.requestViaMiniApi(opts.url, method, opts.data, headers, timeoutMs);
    }
    return Promise.reject(new Error('no http transport available'));
  }

  loginCode(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.api?.login) {
        resolve('');
        return;
      }
      try {
        this.api.login({
          success: (res: { code?: string }) => resolve(res?.code || ''),
          fail: () => resolve(''),
        });
      } catch {
        resolve('');
      }
    });
  }

  getSystemInfoSync(): any {
    try {
      return this.api?.getSystemInfoSync?.() || null;
    } catch {
      return null;
    }
  }

  onHide(handler: () => void): void {
    try {
      this.api?.onHide?.(handler);
    } catch {
      // Lifecycle hook is best-effort.
    }
  }

  onShow(callback: (res?: any) => void): void {
    try {
      this.api?.onShow?.(callback);
    } catch {
      // Lifecycle hook is best-effort.
    }
  }

  getLaunchOptionsSync(): any {
    try {
      return this.api?.getLaunchOptionsSync?.() || null;
    } catch {
      return null;
    }
  }

  getEnterOptionsSync(): any {
    try {
      return this.api?.getEnterOptionsSync?.() || null;
    } catch {
      return null;
    }
  }

  private requestViaMiniApi(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    data: unknown,
    headers: Record<string, string>,
    timeoutMs: number,
  ): Promise<{ statusCode: number; data: any }> {
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) {
          return;
        }
        done = true;
        reject(new Error(`request timeout after ${timeoutMs}ms: ${url}`));
      }, timeoutMs);

      try {
        this.api.request({
          url,
          method,
          data: data === undefined || typeof data === 'string' ? data : JSON.stringify(data),
          header: headers,
          timeout: timeoutMs,
          success: (res: { statusCode?: number; data?: any }) => {
            if (done) {
              return;
            }
            done = true;
            clearTimeout(timer);
            resolve({ statusCode: res?.statusCode ?? 0, data: res?.data });
          },
          fail: (err: any) => {
            if (done) {
              return;
            }
            clearTimeout(timer);
            const msg = err?.errMsg || err?.message || String(err);
            if (typeof globalThis.fetch === 'function') {
              void this.requestViaFetch(url, method, data, headers, timeoutMs)
                .then((result) => {
                  if (done) {
                    return;
                  }
                  done = true;
                  resolve(result);
                })
                .catch((fallbackError) => {
                  if (done) {
                    return;
                  }
                  done = true;
                  const fb = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                  reject(new Error(`request failed: ${msg}; fetchFallback=${fb}`));
                });
              return;
            }
            done = true;
            reject(new Error(`request failed: ${msg}`));
          },
        });
      } catch (error) {
        if (done) {
          return;
        }
        done = true;
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private requestViaFetch(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    data: unknown,
    headers: Record<string, string>,
    timeoutMs: number,
  ): Promise<{ statusCode: number; data: any }> {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    const init: RequestInit = {
      method,
      headers,
      signal: ctrl?.signal,
    };
    if (data !== undefined && method !== 'GET') {
      init.body = typeof data === 'string' ? data : JSON.stringify(data);
    }

    return globalThis.fetch(url, init)
      .then(async (res) => {
        if (timer) {
          clearTimeout(timer);
        }
        const text = await res.text();
        let parsed: any = text;
        if (text) {
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = text;
          }
        }
        return { statusCode: res.status, data: parsed };
      })
      .catch((error) => {
        if (timer) {
          clearTimeout(timer);
        }
        throw error instanceof Error ? error : new Error(String(error));
      });
  }

  private isDevtoolsFetchPreferred(): boolean {
    try {
      return this.api?.getSystemInfoSync?.()?.platform === 'devtools'
        && typeof globalThis.fetch === 'function';
    } catch {
      return false;
    }
  }
}

export const Platform = new PlatformServiceClass();
