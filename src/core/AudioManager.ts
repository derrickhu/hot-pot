import { USER_SETTINGS_KEY } from '@/config/CloudConfig';
import { PersistService } from '@/core/PersistService';

const DEFAULT_BGM_SRC = 'assets/audio/melon_spoon_loop.mp3';
const SUBPACKAGE_AUDIO_ROOT = 'subpackages/bowl_game/assets/audio';
const FRUIT_SLICE_BGM_SRC = `${SUBPACKAGE_AUDIO_ROOT}/fruit_slice_bgm.mp3`;
const MILK_TEA_SHOP_BGM_SRC = `${SUBPACKAGE_AUDIO_ROOT}/milk_tea_shop_bgm.mp3`;
const SCOOP_SFX_SRC = `${SUBPACKAGE_AUDIO_ROOT}/scoop_2.mp3`;
const ORDER_COMPLETE_SFX_SRC = `${SUBPACKAGE_AUDIO_ROOT}/order_complete.mp3`;
const BUTTON_SFX_SRC = 'assets/audio/button_common.mp3';
const BADGE_UNLOCK_SFX_SRC = `${SUBPACKAGE_AUDIO_ROOT}/badge_unlock.mp3`;
const GACHA_PULL_SFX_SRC = `${SUBPACKAGE_AUDIO_ROOT}/gacha_pull.mp3`;
const GACHA_CAPSULE_POP_SFX_SRC = `${SUBPACKAGE_AUDIO_ROOT}/gacha_capsule_pop.mp3`;
const GACHA_REWARD_REVEAL_SFX_SRC = `${SUBPACKAGE_AUDIO_ROOT}/gacha_reward_reveal.mp3`;
const BUFFER_MATCH_SFX_SRC = GACHA_CAPSULE_POP_SFX_SRC;
/**
 * 暂存盘全满时的紧迫警告音；建议 0.4–0.6s 双音节"叮叮 / 铛铛"短促 stinger，
 * mono / 干声 / 无尾混响。文件不存在时 onError 静默兜底，不影响玩法。
 */
const BUFFER_PANIC_SFX_SRC = `${SUBPACKAGE_AUDIO_ROOT}/buffer_panic.mp3`;
const MILK_TEA_TRAY_SWAP_SFX_SRC = `${SUBPACKAGE_AUDIO_ROOT}/milk_tea_tray_swap.mp3`;

interface UserAudioSettings {
  musicEnabled: boolean;
  soundEnabled: boolean;
  vibrateEnabled?: boolean;
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

interface PooledSfx {
  ctx: WxInnerAudioContext;
  busy: boolean;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

class AudioManagerClass {
  private wxBgm: WxInnerAudioContext | null = null;
  private webBgm: HTMLAudioElement | null = null;
  private initialized = false;
  private firstGestureBound = false;
  private musicEnabled = this.readSettings().musicEnabled;
  private soundEnabled = this.readSettings().soundEnabled;
  private bgmSrc = DEFAULT_BGM_SRC;
  // 真机上 wx.createInnerAudioContext 单次开销很大（>20ms），
  // 多次点击连续创建会让卡片 tap 出现明显卡顿。这里按 src 池化，
  // 每个音效仅保留 1 个常驻上下文，重置 currentTime 后复播。
  private readonly sfxPool = new Map<string, PooledSfx>();
  private readonly webSfxPool = new Map<string, HTMLAudioElement>();

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
    this.playSoundEffect(ORDER_COMPLETE_SFX_SRC, undefined, 1);
  }

  playButtonSound(): void {
    this.playSoundEffect(BUTTON_SFX_SRC);
  }

  playBadgeUnlockSound(): void {
    this.playSoundEffect(BADGE_UNLOCK_SFX_SRC);
  }

  playGachaPullSound(): void {
    this.playSoundEffect(GACHA_PULL_SFX_SRC);
  }

  playGachaCapsulePopSound(): void {
    this.playSoundEffect(GACHA_CAPSULE_POP_SFX_SRC);
  }

  playGachaRewardRevealSound(): void {
    this.playSoundEffect(GACHA_REWARD_REVEAL_SFX_SRC);
  }

  playBufferPanicSound(): void {
    this.playSoundEffect(BUFFER_PANIC_SFX_SRC, 0.8);
  }

  playBufferMatchSound(): void {
    this.playSoundEffect(BUFFER_MATCH_SFX_SRC, 0.55);
  }

  playMilkTeaTraySwapSound(): void {
    this.playSoundEffect(MILK_TEA_TRAY_SWAP_SFX_SRC);
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

  useMilkTeaShopBackgroundMusic(): void {
    this.switchBackgroundMusic(MILK_TEA_SHOP_BGM_SRC);
  }

  private playSoundEffect(src: string, maxDurationSec?: number, volume = 0.86): void {
    if (!this.soundEnabled) {
      return;
    }

    const api = typeof wx !== 'undefined' ? wx : null;
    const create = api?.createInnerAudioContext;
    if (create) {
      this.playWxSfx(create.bind(api), src, maxDurationSec, volume);
      return;
    }

    if (typeof Audio === 'undefined') {
      return;
    }
    this.playWebSfx(src, maxDurationSec, volume);
  }

  private playWxSfx(
    create: () => WxInnerAudioContext,
    src: string,
    maxDurationSec?: number,
    volume = 0.86,
  ): void {
    let entry = this.sfxPool.get(src);
    if (!entry) {
      const ctx = create();
      ctx.src = src;
      ctx.loop = false;
      ctx.volume = 0.86;
      ctx.obeyMuteSwitch = false;
      const created: PooledSfx = { ctx, busy: false, stopTimer: null };
      ctx.onEnded?.(() => {
        if (created.stopTimer !== null) {
          clearTimeout(created.stopTimer);
          created.stopTimer = null;
        }
        created.busy = false;
      });
      ctx.onError?.((error) => {
        console.warn('[AudioManager] SFX failed', error);
        if (created.stopTimer !== null) {
          clearTimeout(created.stopTimer);
          created.stopTimer = null;
        }
        created.busy = false;
      });
      this.sfxPool.set(src, created);
      entry = created;
    }
    if (entry.stopTimer !== null) {
      clearTimeout(entry.stopTimer);
      entry.stopTimer = null;
    }
    try {
      // 重置到起点再 play() 即可复播；比 destroy/重建快几十倍。
      entry.ctx.volume = Math.max(0, Math.min(1, volume));
      entry.ctx.seek?.(0);
      entry.ctx.play();
      entry.busy = true;
    } catch {
      entry.busy = false;
      return;
    }
    if (maxDurationSec !== undefined) {
      const sfxEntry = entry;
      sfxEntry.stopTimer = setTimeout(() => {
        sfxEntry.stopTimer = null;
        try {
          sfxEntry.ctx.stop?.();
        } catch {
          // ignore
        }
        sfxEntry.busy = false;
      }, Math.max(0, maxDurationSec) * 1000);
    }
  }

  private playWebSfx(src: string, maxDurationSec?: number, volume = 0.86): void {
    let sfx = this.webSfxPool.get(src);
    if (!sfx) {
      sfx = new Audio(src);
      sfx.preload = 'auto';
      this.webSfxPool.set(src, sfx);
    }
    try {
      sfx.volume = Math.max(0, Math.min(1, volume));
      sfx.currentTime = 0;
      void sfx.play();
    } catch {
      return;
    }
    if (maxDurationSec !== undefined) {
      const node = sfx;
      setTimeout(() => {
        try {
          node.pause();
          node.currentTime = 0;
        } catch {
          // ignore
        }
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
    const prev = PersistService.readJSON<Partial<UserAudioSettings>>(USER_SETTINGS_KEY) ?? {};
    PersistService.writeJSON(USER_SETTINGS_KEY, {
      ...prev,
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
