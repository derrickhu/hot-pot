import { USER_SETTINGS_KEY } from '@/config/CloudConfig';
import { PersistService } from '@/core/PersistService';

interface UserFeedbackSettings {
  vibrateEnabled?: boolean;
}

export type HapticStyle = 'light' | 'medium' | 'heavy';

class HapticsClass {
  private enabled = this.readEnabled();

  constructor() {
    PersistService.subscribeCloudImport(() => {
      this.enabled = this.readEnabled();
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    const prev = PersistService.readJSON<UserFeedbackSettings>(USER_SETTINGS_KEY) ?? {};
    PersistService.writeJSON(USER_SETTINGS_KEY, {
      ...prev,
      vibrateEnabled: enabled,
    });
  }

  play(style: HapticStyle = 'light'): void {
    if (!this.enabled) {
      return;
    }
    const api = typeof wx !== 'undefined' ? wx : null;
    try {
      api?.vibrateShort?.({ type: style });
    } catch {
      // Haptics are best-effort and should never block gameplay.
    }
  }

  light(): void {
    this.play('light');
  }

  medium(): void {
    this.play('medium');
  }

  heavy(): void {
    this.play('heavy');
  }

  private readEnabled(): boolean {
    const settings = PersistService.readJSON<UserFeedbackSettings>(USER_SETTINGS_KEY);
    return settings?.vibrateEnabled !== false;
  }
}

export const Haptics = new HapticsClass();
