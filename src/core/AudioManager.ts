import { USER_SETTINGS_KEY } from '@/config/CloudConfig';
import { PersistService } from '@/core/PersistService';

const DEFAULT_BGM_SRC = 'assets/audio/melon_spoon_loop.mp3';
const FRUIT_SLICE_BGM_SRC = 'assets/audio/fruit_slice_bgm.mp3';
const SCOOP_SFX_SRC = 'assets/audio/scoop_2.mp3';
const ORDER_COMPLETE_SFX_SRC = 'assets/audio/order_complete.mp3';
const BUTTON_SFX_SRC = 'assets/audio/button_common.mp3';
const BADGE_UNLOCK_SFX_SRC = 'assets/audio/badge_unlock.mp3';
/**
 * 暂存盘全满时的紧迫警告音；建议 0.4–0.6s 双音节"叮叮 / 铛铛"短促 stinger，
 * mono / 干声 / 无尾混响。文件不存在时 onError 静默兜底，不影响玩法。
 */
const BUFFER_PANIC_SFX_SRC = 'assets/audio/buffer_panic.mp3';

interface UserAudioSettings {
  musicEnabled: boolean;
  soundEnabled: boolean;
}

type WxInnerAudioContext = {
  src: string;
  loop: boolean;
  volume: number;
  autoplay?: boolean;
  obeyMuteSwitch?: boolean;
  play: () => void;
  pause: () => void;
  stop?: () => void;
  destroy?: () => void;
  seek?: (position: number) => void;
  onError?: (handler: (error: unknown) => void) => void;
  onEnded?: (handler: () => void) => void;
};

class AudioManagerClass {
  private wxBgm: WxInnerAudioContext | null = null;
  private webBgm: HTMLAudioElement | null = null;
  private initialized = false;
  private firstGestureBound = false;
  private musicEnabled = this.readSettings().musicEnabled;
  private soundEnabled = this.readSettings().soundEnabled;
  private bgmSrc = DEFAULT_BGM_SRC;

  constructor() {
    PersistService.subscribeCloudImport(() => {
      this.reloadSettingsFromPersist();
    });
  }

  initBackgroundMusic(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    const api = typeof wx !== 'undefined' ? wx : null;
    if (api?.createInnerAudioContext) {
      const bgm = api.createInnerAudioContext();
      bgm.src = this.bgmSrc;
      bgm.loop = true;
      bgm.volume = 0.42;
      bgm.autoplay = false;
      bgm.obeyMuteSwitch = false;
      bgm.onError?.((error) => {
        console.warn('[AudioManager] BGM failed', error);
      });
      this.wxBgm = bgm;
    } else if (typeof Audio !== 'undefined') {
      const bgm = new Audio(this.bgmSrc);
      bgm.loop = true;
      bgm.volume = 0.42;
      bgm.preload = 'auto';
      this.webBgm = bgm;
    }

    this.bindFirstGestureReplay();
    if (this.musicEnabled) {
      this.playBackgroundMusic();
    }
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    this.writeSettings();
    if (enabled) {
      this.playBackgroundMusic();
    } else {
      this.pauseBackgroundMusic();
    }
  }

  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    this.writeSettings();
  }

  playScoopSound(): void {
    this.playSoundEffect(SCOOP_SFX_SRC, 1);
  }

  playOrderCompleteSound(): void {
    this.playSoundEffect(ORDER_COMPLETE_SFX_SRC);
  }

  playButtonSound(): void {
    this.playSoundEffect(BUTTON_SFX_SRC);
  }

  playBadgeUnlockSound(): void {
    this.playSoundEffect(BADGE_UNLOCK_SFX_SRC);
  }

  playBufferPanicSound(): void {
    this.playSoundEffect(BUFFER_PANIC_SFX_SRC, 0.8);
  }

  playBackgroundMusic(): void {
    if (!this.musicEnabled) {
      return;
    }
    if (!this.initialized) {
      this.initBackgroundMusic();
      return;
    }
    try {
      this.wxBgm?.play();
      void this.webBgm?.play?.();
    } catch {
      // Some runtimes require a user gesture; the first tap handler will retry.
    }
  }

  pauseBackgroundMusic(): void {
    try {
      this.wxBgm?.pause();
      this.webBgm?.pause?.();
    } catch {
      // Pausing audio should never block gameplay.
    }
  }

  useDefaultBackgroundMusic(): void {
    this.switchBackgroundMusic(DEFAULT_BGM_SRC);
  }

  useFruitSliceBackgroundMusic(): void {
    this.switchBackgroundMusic(FRUIT_SLICE_BGM_SRC);
  }

  private playSoundEffect(src: string, maxDurationSec?: number): void {
    if (!this.soundEnabled) {
      return;
    }

    const api = typeof wx !== 'undefined' ? wx : null;
    if (api?.createInnerAudioContext) {
      const sfx = api.createInnerAudioContext();
      sfx.src = src;
      sfx.loop = false;
      sfx.volume = 0.86;
      sfx.obeyMuteSwitch = false;
      sfx.onEnded?.(() => {
        sfx.destroy?.();
      });
      sfx.onError?.((error) => {
        console.warn('[AudioManager] SFX failed', error);
        sfx.destroy?.();
      });
      try {
        sfx.seek?.(0);
        sfx.play();
      } catch {
        sfx.destroy?.();
        return;
      }
      if (maxDurationSec !== undefined) {
        setTimeout(() => {
          try {
            sfx.stop?.();
          } finally {
            sfx.destroy?.();
          }
        }, Math.max(0, maxDurationSec) * 1000);
      }
      return;
    }

    if (typeof Audio === 'undefined') {
      return;
    }
    const sfx = new Audio(src);
    sfx.volume = 0.86;
    sfx.preload = 'auto';
    sfx.currentTime = 0;
    sfx.addEventListener('ended', () => {
      sfx.remove();
    }, { once: true });
    try {
      void sfx.play();
    } catch {
      return;
    }
    if (maxDurationSec !== undefined) {
      setTimeout(() => {
        sfx.pause();
        sfx.currentTime = 0;
        sfx.remove();
      }, Math.max(0, maxDurationSec) * 1000);
    }
  }

  private bindFirstGestureReplay(): void {
    if (this.firstGestureBound) {
      return;
    }
    this.firstGestureBound = true;

    const api = typeof wx !== 'undefined' ? wx : null;
    if (api?.onTouchStart) {
      api.onTouchStart(() => {
        this.playBackgroundMusic();
      });
      return;
    }

    const root = typeof globalThis !== 'undefined' ? globalThis : null;
    root?.addEventListener?.('pointerdown', () => this.playBackgroundMusic(), { once: true });
    root?.addEventListener?.('touchstart', () => this.playBackgroundMusic(), { once: true });
  }

  private switchBackgroundMusic(src: string): void {
    if (this.bgmSrc === src) {
      this.playBackgroundMusic();
      return;
    }
    this.bgmSrc = src;
    if (!this.initialized) {
      if (this.musicEnabled) {
        this.initBackgroundMusic();
      }
      return;
    }
    try {
      if (this.wxBgm) {
        this.wxBgm.pause();
        this.wxBgm.src = src;
        this.wxBgm.loop = true;
        this.wxBgm.volume = 0.42;
        this.wxBgm.seek?.(0);
      }
      if (this.webBgm) {
        this.webBgm.pause();
        this.webBgm.src = src;
        this.webBgm.loop = true;
        this.webBgm.volume = 0.42;
        this.webBgm.load();
      }
    } catch {
      // 切换曲目失败不应打断玩法；下一次点击会继续尝试播放当前 src。
    }
    this.playBackgroundMusic();
  }

  reloadSettingsFromPersist(): void {
    const next = this.readSettings();
    const musicChanged = next.musicEnabled !== this.musicEnabled;
    this.musicEnabled = next.musicEnabled;
    this.soundEnabled = next.soundEnabled;
    if (musicChanged) {
      if (this.musicEnabled) {
        this.playBackgroundMusic();
      } else {
        this.pauseBackgroundMusic();
      }
    }
  }

  private readSettings(): UserAudioSettings {
    const stored = PersistService.readJSON<Partial<UserAudioSettings>>(USER_SETTINGS_KEY);
    return {
      musicEnabled: stored?.musicEnabled !== false,
      soundEnabled: stored?.soundEnabled !== false,
    };
  }

  private writeSettings(): void {
    PersistService.writeJSON(USER_SETTINGS_KEY, {
      musicEnabled: this.musicEnabled,
      soundEnabled: this.soundEnabled,
    });
  }
}

const holder = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
if (!holder.__hotPotAudioManager) {
  holder.__hotPotAudioManager = new AudioManagerClass();
}

export const AudioManager: AudioManagerClass = holder.__hotPotAudioManager;
