/**
 * 微信隐私授权服务
 * ---------------------------------------------------------------
 * 用于在涉及隐私的入口（如排行榜）触发"微信平台统一隐私授权弹窗"。
 *
 * 流程：
 *   1. 优先用 wx.getPrivacySetting 检查是否真的需要弹（已同意过则不弹）
 *   2. 需要弹时调用 wx.requirePrivacyAuthorize，弹微信原生隐私协议框
 *      （前提：在小程序后台已配置好"用户隐私保护指引"）
 *   3. 用户同意 → 业务侧通过 onAgreed 进入流程；
 *      用户拒绝 → onDisagreed（默认提示并阻断进入）
 *
 * 兼容性：
 *   - 基础库 < 2.32.3 / 非微信环境：API 不存在 → 直接走 onAgreed，
 *     不阻塞玩家（隐私弹窗是新合规要求，老用户不受影响）
 *   - 进程内缓存同意态：玩家本次会话内同意一次，后续入口不再重复检查
 */

export type PrivacyAuthStatus = 'agreed' | 'disagreed' | 'unsupported';

export interface PrivacyAuthResult {
  status: PrivacyAuthStatus;
  errMsg?: string;
}

class PrivacyAuthServiceClass {
  /** 本次会话内是否已通过隐私授权（避免每次点排行榜都查一遍） */
  private sessionAgreed = false;

  /** 重置本次会话内的"已同意"缓存（小游戏内通常无需主动重置） */
  reset(): void {
    this.sessionAgreed = false;
  }

  /**
   * 请求一次隐私授权。如玩家此前已同意过，立即 resolve(agreed)；
   * 否则弹出微信原生隐私协议弹窗，等待玩家选择。
   */
  request(): Promise<PrivacyAuthResult> {
    if (this.sessionAgreed) {
      return Promise.resolve({ status: 'agreed' });
    }
    const api = typeof wx !== 'undefined' ? wx : null;
    if (!api) {
      return Promise.resolve({ status: 'unsupported' });
    }
    if (typeof api.getPrivacySetting === 'function') {
      return new Promise((resolve) => {
        api.getPrivacySetting!({
          success: (res) => {
            if (!res?.needAuthorization) {
              this.sessionAgreed = true;
              resolve({ status: 'agreed' });
              return;
            }
            this.requirePrivacyAuthorize(resolve);
          },
          fail: (err) => {
            console.warn('[PrivacyAuth] getPrivacySetting fail', err?.errMsg);
            // 查询失败兜底直接尝试弹授权框
            this.requirePrivacyAuthorize(resolve);
          },
        });
      });
    }
    if (typeof api.requirePrivacyAuthorize === 'function') {
      return new Promise((resolve) => this.requirePrivacyAuthorize(resolve));
    }
    // 老基础库无隐私接口：不阻塞业务（旧版本微信尚未引入隐私协议机制）
    console.log('[PrivacyAuth] runtime lacks requirePrivacyAuthorize, fallback to agreed');
    return Promise.resolve({ status: 'unsupported' });
  }

  /**
   * 业务侧便捷封装：未同意 / 拒绝时用 wx.showToast 给出反馈，并阻断后续动作；
   * 已同意或运行时不支持隐私接口时调用 onAgreed 放行。
   */
  guard(onAgreed: () => void, disagreedTip = '需同意隐私协议后查看'): void {
    void this.request().then((result) => {
      if (result.status === 'disagreed') {
        const api = typeof wx !== 'undefined' ? wx : null;
        try {
          api?.showToast?.({ title: disagreedTip, icon: 'none' });
        } catch (error) {
          console.warn('[PrivacyAuth] toast failed', error);
        }
        return;
      }
      onAgreed();
    });
  }

  private requirePrivacyAuthorize(resolve: (r: PrivacyAuthResult) => void): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    if (!api?.requirePrivacyAuthorize) {
      resolve({ status: 'unsupported' });
      return;
    }
    try {
      api.requirePrivacyAuthorize({
        success: () => {
          this.sessionAgreed = true;
          resolve({ status: 'agreed' });
        },
        fail: (err) => {
          console.log('[PrivacyAuth] declined:', err?.errMsg);
          resolve({ status: 'disagreed', errMsg: err?.errMsg });
        },
      });
    } catch (error) {
      console.warn('[PrivacyAuth] requirePrivacyAuthorize threw', error);
      resolve({ status: 'unsupported' });
    }
  }
}

export const PrivacyAuthService = new PrivacyAuthServiceClass();
