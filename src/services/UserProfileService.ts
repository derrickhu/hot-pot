import { USER_PROFILE_KEY } from '@/config/CloudConfig';
import { Platform } from '@/core/PlatformService';

/**
 * 微信用户资料服务
 * ---------------------------------------------------------------
 * 小游戏获取真实昵称 / 头像的唯一可靠入口是 wx.createUserInfoButton，
 * 且必须由"用户主动点击原生按钮"触发。本服务负责：
 *
 *  1. 本地缓存玩家已授权的 { nickName, avatarUrl }，避免每次进入排行榜都要求重新授权；
 *  2. 接收 wx 授权按钮回调中的 userInfo，做有效性校验（过滤"微信用户"占位）后落盘；
 *  3. 给业务侧（如 RankUpload）提供"上报排行榜时附带的资料字段"。
 *
 * 不在 CloudSyncManager 范围内（不跨设备同步）：用户资料属本机敏感数据，
 * 换设备的玩家在新设备上重新触发授权即可。
 */

export interface UserProfile {
  /** 微信昵称；可能为""（未授权或被微信替换成占位） */
  nickName: string;
  /** 微信头像 URL，一般在 thirdwx.qlogo.cn 域 */
  avatarUrl: string;
  /** 该资料缓存的写入时间戳，用于排错 */
  savedAt: number;
}

type Listener = (profile: UserProfile | null) => void;

class UserProfileServiceClass {
  private cached: UserProfile | null = null;
  private loaded = false;
  private readonly listeners = new Set<Listener>();

  /** 当前是否拿到了被认为"有效"的微信资料 */
  hasRealProfile(): boolean {
    this.ensureLoaded();
    return !!this.cached && this.isRealProfile(this.cached);
  }

  /** 取本机缓存的玩家资料（可能 null） */
  getProfile(): UserProfile | null {
    this.ensureLoaded();
    return this.cached;
  }

  /** 提供给排行榜上报使用的字段：未授权时返回空对象，业务侧按可选字段处理 */
  getProfileForRankSubmit(): { displayName?: string; avatarUrl?: string } {
    const p = this.getProfile();
    if (!p || !this.isRealProfile(p)) {
      return {};
    }
    const out: { displayName?: string; avatarUrl?: string } = {};
    if (p.nickName) {
      out.displayName = p.nickName;
    }
    if (p.avatarUrl) {
      out.avatarUrl = p.avatarUrl;
    }
    return out;
  }

  /**
   * 收到 wx 授权按钮的 userInfo 后调用：通过有效性校验则写盘 + 通知监听者。
   * 返回是否真的写入了有效资料（业务侧据此决定是否提示"已带真名上榜"）。
   */
  applyFromWeChat(userInfo: { nickName?: string; avatarUrl?: string } | undefined): boolean {
    if (!userInfo) {
      console.log('[UserProfile] applyFromWeChat skipped: empty userInfo');
      return false;
    }
    const candidate: UserProfile = {
      nickName: String(userInfo.nickName || '').trim(),
      avatarUrl: String(userInfo.avatarUrl || '').trim(),
      savedAt: Date.now(),
    };
    const reason = this.invalidProfileReason(candidate);
    if (reason) {
      // 排错关键日志：把微信返回的真实字段都打出来，方便定位"为什么被判占位"
      console.log(
        `[UserProfile] skip ${reason}: nick="${candidate.nickName}"` +
          ` avatarUrl=${candidate.avatarUrl ? candidate.avatarUrl.slice(0, 64) + '...' : '(empty)'}`,
      );
      return false;
    }
    this.cached = candidate;
    this.persist();
    console.log(
      `[UserProfile] applied: nick="${candidate.nickName}" avatarUrl=${candidate.avatarUrl.slice(0, 32)}...`,
    );
    this.notify();
    return true;
  }

  /** 清掉本机资料（仅供调试 / 退出登录使用，业务侧通常不需要） */
  clear(): void {
    this.cached = null;
    Platform.removeStorageSync(USER_PROFILE_KEY);
    this.notify();
  }

  /** 监听资料变化（拿到授权 / 清空时回调），用于排行榜自动重画 */
  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private ensureLoaded(): void {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    const raw = Platform.getStorageSync(USER_PROFILE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<UserProfile>;
      const profile: UserProfile = {
        nickName: String(parsed?.nickName || ''),
        avatarUrl: String(parsed?.avatarUrl || ''),
        savedAt: Number(parsed?.savedAt) || 0,
      };
      if (this.isRealProfile(profile)) {
        this.cached = profile;
      } else {
        // 旧数据无效，清理掉避免误用
        Platform.removeStorageSync(USER_PROFILE_KEY);
      }
    } catch (error) {
      console.warn('[UserProfile] parse cached profile failed', error);
    }
  }

  /**
   * 资料有效性：必须有非空昵称且不为"微信用户"占位，头像 URL 至少 4 字符。
   * 微信近期返回的占位通常是 nickName="微信用户" + 默认灰头像 URL，
   * 我们宁可不存也不能让占位污染玩家本地缓存。
   *
   * 备注：早期版本要求 avatarUrl.length >= 10，但部分基础库会返回 wxfile:// 形式的
   * 本地路径（长度 4 字符即可识别），那种 URL 在本地能渲染但**云端 sanitize 会拒**——
   * 这里只做"本机展示有效"判断，云端有效性由 RankUpload + 云函数 sanitize 单独把关。
   */
  private isRealProfile(profile: UserProfile): boolean {
    return !this.invalidProfileReason(profile);
  }

  /** 返回"为什么这条资料不合法"，合法则返回 null。用于把诊断日志细化到具体字段。 */
  private invalidProfileReason(profile: UserProfile): string | null {
    if (!profile.nickName) {
      return 'empty-nickname';
    }
    if (profile.nickName === '微信用户') {
      return 'placeholder-nickname';
    }
    if (!profile.avatarUrl || profile.avatarUrl.length < 4) {
      return 'empty-avatarUrl';
    }
    return null;
  }

  private persist(): void {
    if (!this.cached) {
      return;
    }
    try {
      Platform.setStorageSync(USER_PROFILE_KEY, JSON.stringify(this.cached));
    } catch (error) {
      console.warn('[UserProfile] persist failed', error);
    }
  }

  private notify(): void {
    const snapshot = this.cached;
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn('[UserProfile] listener threw', error);
      }
    });
  }
}

export const UserProfileService = new UserProfileServiceClass();
