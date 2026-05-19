import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { Haptics } from '@/core/Haptics';
import { BOWL_IMAGES_ROOT } from '@/config/bowlAssets';

export const BOWL_PAUSE_PANEL_TEXTURE_KEY = 'bowl_pause_panel_three_buttons';
export const BOWL_PAUSE_PANEL_ASSET = `${BOWL_IMAGES_ROOT}/bowl_pause_panel_three_buttons.png`;

export interface SettingsPauseCallbacks {
  onReplay: () => void;
  onHome: () => void;
  onContinue: () => void;
}

export interface SettingsPauseOptions {
  mode?: 'full' | 'home';
}

/** 设置 / 暂停面板（剪贴板风格） */
export class SettingsPauseOverlay extends PIXI.Container {
  private readonly musicOn = { value: AudioManager.isMusicEnabled() };
  private readonly soundOn = { value: AudioManager.isSoundEnabled() };
  private readonly vibrateOn = { value: Haptics.isEnabled() };
  private readonly pausePanelSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);

  constructor(
    width: number,
    height: number,
    callbacks: SettingsPauseCallbacks,
    options: SettingsPauseOptions = {},
  ) {
    super();
    this.visible = false;
    this.eventMode = 'static';
    const isHomeMode = options.mode === 'home';
    const showToggles = isHomeMode;

    const dim = new PIXI.Graphics();
    dim.beginFill(0x2a2118, 0.52);
    dim.drawRect(0, 0, width, height);
    dim.endFill();
    dim.eventMode = 'static';
    dim.on('pointertap', (e) => e.stopPropagation());
    this.addChild(dim);

    if (!showToggles) {
      this.addArtworkPausePanel(width, height, callbacks);
      return;
    }

    const panelW = 420;
    const panelH = isHomeMode ? 300 : 360;
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2 - 20;

    const boardBack = new PIXI.Graphics();
    boardBack.beginFill(0x6d5a4d);
    boardBack.drawRoundedRect(px + 8, py + 36, panelW - 16, panelH - 28, 18);
    boardBack.endFill();
    this.addChild(boardBack);

    const clip = new PIXI.Graphics();
    clip.beginFill(0x9a8f88);
    clip.drawRoundedRect(px + panelW / 2 - 36, py - 6, 72, 28, 10);
    clip.endFill();
    this.addChild(clip);

    const paper = new PIXI.Graphics();
    paper.beginFill(0xf4e8d4);
    paper.lineStyle(4, 0x5c4a3d, 1);
    paper.drawRoundedRect(px, py, panelW, panelH, 22);
    paper.endFill();
    this.addChild(paper);

    const closeBtn = new PIXI.Container();
    closeBtn.position.set(px + panelW - 44, py + 16);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    const closeG = new PIXI.Graphics();
    closeG.beginFill(0xd94b4b);
    closeG.drawCircle(0, 0, 20);
    closeG.endFill();
    closeBtn.addChild(closeG);
    const closeX = new PIXI.Text('✕', { fontSize: 20, fill: 0xffffff, fontWeight: '700' });
    closeX.anchor.set(0.5);
    closeBtn.addChild(closeX);
    closeBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.visible = false;
      callbacks.onContinue();
    });
    this.addChild(closeBtn);

    const titleBg = new PIXI.Graphics();
    titleBg.beginFill(0x7d5a3f);
    titleBg.drawRoundedRect(px + 36, py + 52, panelW - 72, 44, 16);
    titleBg.endFill();
    this.addChild(titleBg);

    const title = new PIXI.Text('设置', {
      fontSize: 30,
      fill: 0xfff6e8,
      fontWeight: '700',
    });
    title.anchor.set(0.5);
    title.position.set(width / 2, py + 74);
    this.addChild(title);

    const inner = new PIXI.Graphics();
    if (showToggles) {
      inner.beginFill(0xfff3d6);
      inner.drawRoundedRect(px + 28, py + 112, panelW - 56, 116, 16);
      inner.endFill();
      this.addChild(inner);

      let ty = py + 132;
      this.addToggleRow(width / 2, ty, '音乐', this.musicOn, (enabled) => {
        AudioManager.setMusicEnabled(enabled);
      });
      ty += 52;
      this.addToggleRow(width / 2, ty, '音效', this.soundOn, (enabled) => {
        AudioManager.setSoundEnabled(enabled);
      });
      return;
    }

    const btnW = panelW - 72;
    const btnH = 56;
    const bx = px + 36;
    let by = py + 128;

    this.addBigButton(bx, by, btnW, btnH, 0xc67d3a, '重玩本关', 0xffffff, () => {
      this.visible = false;
      callbacks.onReplay();
    });
    by += btnH + 14;
    this.addBigButton(bx, by, btnW, btnH, 0x4a7dbd, '回到主页', 0xffffff, () => {
      this.visible = false;
      callbacks.onHome();
    });
    by += btnH + 14;
    this.addBigButton(bx, by, btnW, btnH, 0xf0c84a, '继续游戏', 0x5a3d2b, () => {
      this.visible = false;
      callbacks.onContinue();
    });
  }

  private addToggleRow(
    cx: number,
    y: number,
    label: string,
    state: { value: boolean },
    onChange?: (enabled: boolean) => void,
  ): void {
    const row = new PIXI.Container();
    row.position.set(cx, y);
    row.eventMode = 'static';
    row.cursor = 'pointer';

    const lab = new PIXI.Text(label, {
      fontSize: 26,
      fill: 0x4b2e20,
      fontWeight: '700',
    });
    lab.anchor.set(1, 0.5);
    lab.position.set(-88, 0);
    row.addChild(lab);

    const track = new PIXI.Graphics();
    const knob = new PIXI.Graphics();
    row.addChild(track, knob);

    const draw = (on: boolean) => {
      track.clear();
      track.beginFill(on ? 0x6abf69 : 0xb5b0a8);
      track.drawRoundedRect(40, -22, 88, 44, 22);
      track.endFill();
      knob.clear();
      knob.beginFill(0xfff8ee);
      knob.lineStyle(2, 0x4b3a2a, 0.35);
      knob.drawCircle(on ? 108 : 62, 0, 18);
      knob.endFill();
    };

    draw(state.value);
    row.on('pointertap', () => {
      AudioManager.playButtonSound();
      state.value = !state.value;
      draw(state.value);
      onChange?.(state.value);
    });
    this.addChild(row);
  }

  private addBigButton(
    x: number,
    y: number,
    w: number,
    h: number,
    bg: number,
    label: string,
    textColor: number,
    onTap: () => void,
  ): void {
    const root = new PIXI.Container();
    root.position.set(x, y);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(0, 0, w, h);
    root.on('pointertap', () => {
      AudioManager.playButtonSound();
      onTap();
    });

    const g = new PIXI.Graphics();
    g.beginFill(bg);
    g.lineStyle(3, 0x3d2a1f, 0.25);
    g.drawRoundedRect(0, 0, w, h, 18);
    g.endFill();
    root.addChild(g);

    const t = new PIXI.Text(label, {
      fontSize: 28,
      fill: textColor,
      fontWeight: '700',
    });
    t.anchor.set(0.5);
    t.position.set(w / 2, h / 2);
    t.eventMode = 'none';
    root.addChild(t);
    this.addChild(root);
  }

  setPanelTexture(texture?: PIXI.Texture | null): void {
    if (!texture) {
      return;
    }
    this.pausePanelSprite.texture = texture;
    this.pausePanelSprite.visible = true;
  }

  private addArtworkPausePanel(width: number, height: number, callbacks: SettingsPauseCallbacks): void {
    const sourceW = 902;
    const sourceH = 854;
    const panelW = Math.min(430, Math.floor(width * 0.84));
    const panelH = Math.round(panelW * (sourceH / sourceW));
    const panelX = Math.round((width - panelW) / 2);
    const panelY = Math.round((height - panelH) / 2 - 14);
    const scaleX = panelW / sourceW;
    const scaleY = panelH / sourceH;

    this.pausePanelSprite.anchor.set(0);
    this.pausePanelSprite.position.set(panelX, panelY);
    this.pausePanelSprite.width = panelW;
    this.pausePanelSprite.height = panelH;
    this.pausePanelSprite.visible = false;
    this.addChild(this.pausePanelSprite);

    const addHotspot = (x: number, y: number, w: number, h: number, onTap: () => void): void => {
      const root = new PIXI.Container();
      root.position.set(panelX + x * scaleX, panelY + y * scaleY);
      root.eventMode = 'static';
      root.cursor = 'pointer';
      root.hitArea = new PIXI.Rectangle(0, 0, w * scaleX, h * scaleY);
      root.on('pointertap', () => {
        AudioManager.playButtonSound();
        this.visible = false;
        onTap();
      });
      this.addChild(root);
    };

    addHotspot(180, 140, 560, 165, callbacks.onReplay);
    addHotspot(180, 355, 560, 165, callbacks.onHome);
    addHotspot(180, 570, 560, 165, callbacks.onContinue);
  }
}
