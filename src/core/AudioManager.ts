const BGM_SRC = 'assets/audio/melon_spoon_loop.mp3';
const SCOOP_SFX_SRC = 'assets/audio/scoop_2.mp3';
const ORDER_COMPLETE_SFX_SRC = 'assets/audio/order_complete.mp3';
const BUTTON_SFX_SRC = 'assets/audio/button_common.mp3';
const MUSIC_ENABLED_KEY = 'hotPot.musicEnabled';
const SOUND_ENABLED_KEY = 'hotPot.soundEnabled';

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
  private musicEnabled = this.readMusicEnabled();
  private soundEnabled = this.readSoundEnabled();

  initBackgroundMusic(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    const api = typeof wx !== 'undefined' ? wx : null;
    if (api?.createInnerAudioContext) {
      const bgm = api.createInnerAudioContext();
      bgm.src = BGM_SRC;
      bgm.loop = true;
      bgm.volume = 0.42;
      bgm.autoplay = false;
      bgm.obeyMuteSwitch = false;
      bgm.onError?.((error) => {
        console.warn('[AudioManager] BGM failed', error);
      });
      this.wxBgm = bgm;
    } else if (typeof Audio !== 'undefined') {
      const bgm = new Audio(BGM_SRC);
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
    this.writeMusicEnabled(enabled);
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
    this.writeSoundEnabled(enabled);
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

  private readMusicEnabled(): boolean {
    try {
      const api = typeof wx !== 'undefined' ? wx : null;
      const raw = api?.getStorageSync?.(MUSIC_ENABLED_KEY) ?? globalThis.localStorage?.getItem(MUSIC_ENABLED_KEY);
      return raw !== '0';
    } catch {
      return true;
    }
  }

  private readSoundEnabled(): boolean {
    try {
      const api = typeof wx !== 'undefined' ? wx : null;
      const raw = api?.getStorageSync?.(SOUND_ENABLED_KEY) ?? globalThis.localStorage?.getItem(SOUND_ENABLED_KEY);
      return raw !== '0';
    } catch {
      return true;
    }
  }

  private writeMusicEnabled(enabled: boolean): void {
    try {
      const text = enabled ? '1' : '0';
      const api = typeof wx !== 'undefined' ? wx : null;
      if (api?.setStorageSync) {
        api.setStorageSync(MUSIC_ENABLED_KEY, text);
        return;
      }
      globalThis.localStorage?.setItem(MUSIC_ENABLED_KEY, text);
    } catch {
      // Preference persistence is best-effort.
    }
  }

  private writeSoundEnabled(enabled: boolean): void {
    try {
      const text = enabled ? '1' : '0';
      const api = typeof wx !== 'undefined' ? wx : null;
      if (api?.setStorageSync) {
        api.setStorageSync(SOUND_ENABLED_KEY, text);
        return;
      }
      globalThis.localStorage?.setItem(SOUND_ENABLED_KEY, text);
    } catch {
      // Preference persistence is best-effort.
    }
  }
}

const holder = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
if (!holder.__hotPotAudioManager) {
  holder.__hotPotAudioManager = new AudioManagerClass();
}

export const AudioManager: AudioManagerClass = holder.__hotPotAudioManager;
