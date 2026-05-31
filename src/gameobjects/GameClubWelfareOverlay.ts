import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import { GAME_CLUB_DAILY_POST_COINS } from '@/config/economy';
import {
  canClaimGameClubDailyPostReward,
  claimGameClubDailyPostReward,
  hasClaimedGameClubRewardToday,
} from '@/game/GameClubRewardState';
import { COIN_ICON_TEXTURE_KEY, COIN_ICON_TEXTURE_PATH } from '@/gameobjects/CoinBar';
import {
  fetchDailyPostCount,
  isGameClubButtonSupported,
  type GameClubDailyPostStatus,
} from '@/services/GameClubService';
import { TextureCache } from '@/utils/TextureCache';

export const GAME_CLUB_WELFARE_PANEL_TEXTURE_KEY = 'game_club_welfare_panel';
export const GAME_CLUB_WELFARE_PANEL_TEXTURE_PATH = 'assets/images/game_club_welfare_panel_empty_v1.png';
export const GAME_CLUB_WELFARE_ENTER_BTN_TEXTURE_KEY = 'game_club_welfare_enter_btn';
export const GAME_CLUB_WELFARE_ENTER_BTN_TEXTURE_PATH = 'assets/images/game_club_welfare_btn_enter_club_v1.png';

/** 空面板贴图原始尺寸（与 assets/images 内 PNG 一致） */
const PANEL_ART_W = 766;
const PANEL_ART_H = 1040;
const ENTER_BTN_ART_W = 688;
const ENTER_BTN_ART_H = 244;

/**
 * 面板 UI 锚点：母版贴图像素坐标（左上角原点）。
 * 换图 / 换设备时只改这里，运行时按 panelScale 等比缩放。
 */
const PANEL_LAYOUT = {
  closeHit: { cx: 733, cy: 54, r: 34 },
  /** 任务行：三列等间距，整行在任务卡片内容区内水平居中 */
  taskRow: {
    cy: 662,
    innerX: 80,
    innerW: 606,
    gap: 28,
    rewardSize: 92,
    progressW: 182,
    progressH: 26,
    claimW: 124,
    claimH: 52,
  },
  enterBtn: { cx: 383, cy: 918, w: 344 },
} as const;

interface PanelLayoutMetrics {
  artW: number;
  artH: number;
  displayW: number;
  displayH: number;
  scale: number;
  x: (artX: number) => number;
  y: (artY: number) => number;
  len: (artLen: number) => number;
  centerX: (artX: number) => number;
  centerY: (artY: number) => number;
}

function createPanelLayoutMetrics(artW: number, artH: number, displayW: number): PanelLayoutMetrics {
  const scale = displayW / artW;
  const displayH = artH * scale;
  const x = (artX: number): number => artX * scale;
  const y = (artY: number): number => artY * scale;
  const len = (artLen: number): number => artLen * scale;
  return {
    artW,
    artH,
    displayW,
    displayH,
    scale,
    x,
    y,
    len,
    centerX: (artX: number): number => x(artX) - displayW / 2,
    centerY: (artY: number): number => y(artY) - displayH / 2,
  };
}

export interface GameClubWelfareOverlayOptions {
  onClaimed?: (coins: number) => void;
}

/** 游戏圈福利弹层：贴图面板 + 程序绘制任务区 + 进入游戏圈按钮 */
export class GameClubWelfareOverlay extends PIXI.Container {
  private readonly screenWidth: number;
  private readonly screenHeight: number;
  private readonly options: GameClubWelfareOverlayOptions;
  private readonly contentRoot = new PIXI.Container();
  private readonly taskLayer = new PIXI.Container();
  private readonly enterClubRoot = new PIXI.Container();
  private readonly progressText = new PIXI.Text('');
  private readonly progressFill = new PIXI.Graphics();
  private readonly progressTrack = new PIXI.Graphics();
  private readonly rewardIconBg = new PIXI.Graphics();
  private readonly claimBtnRoot = new PIXI.Container();
  private readonly claimBtnBg = new PIXI.Graphics();
  private readonly claimBtnLabel = new PIXI.Text('');
  private panelSprite: PIXI.Sprite | null = null;
  private enterBtnSprite: PIXI.Sprite | null = null;
  private panelDisplayW = 0;
  private panelDisplayH = 0;
  private panelScale = 1;
  private progressTrackWidth = 0;
  private progressTrackHeight = 0;
  private progressTrackX = 0;
  private progressTrackY = 0;
  private gameClubButton: ReturnType<NonNullable<typeof wx.createGameClubButton>> | null = null;
  private postCount = 0;
  private refreshing = false;
  private artReady = false;
  private readonly returnRefreshTimers: ReturnType<typeof setTimeout>[] = [];
  private lastStatusErrorToastAt = 0;
  private readonly onWxShow = (): void => {
    if (!this.canSyncGameClubNativeButton()) {
      return;
    }
    this.scheduleReturnRefreshes();
  };

  constructor(width: number, height: number, options: GameClubWelfareOverlayOptions = {}) {
    super();
    this.screenWidth = width;
    this.screenHeight = height;
    this.options = options;
    this.visible = false;
    this.eventMode = 'static';
    this.buildBase();
    void this.loadArt();
    if (typeof wx !== 'undefined' && wx.onShow) {
      wx.onShow(this.onWxShow);
    }
  }

  static preloadTextures(): Promise<void[]> {
    return Promise.all([
      TextureCache.load(GAME_CLUB_WELFARE_PANEL_TEXTURE_KEY, GAME_CLUB_WELFARE_PANEL_TEXTURE_PATH),
      TextureCache.load(GAME_CLUB_WELFARE_ENTER_BTN_TEXTURE_KEY, GAME_CLUB_WELFARE_ENTER_BTN_TEXTURE_PATH),
      TextureCache.load(COIN_ICON_TEXTURE_KEY, COIN_ICON_TEXTURE_PATH),
    ]);
  }

  destroy(options?: PIXI.IDestroyOptions | boolean): void {
    this.destroyGameClubNativeButton();
    this.clearReturnRefreshTimers();
    if (typeof wx !== 'undefined' && wx.offShow) {
      wx.offShow(this.onWxShow);
    }
    super.destroy(options);
  }

  open(): void {
    this.visible = true;
    this.syncGameClubNativeButton();
    void this.refreshStatus();
  }

  close(): void {
    this.visible = false;
    this.clearReturnRefreshTimers();
    this.destroyGameClubNativeButton();
  }

  layout(): void {
    if (!this.canSyncGameClubNativeButton()) {
      this.destroyGameClubNativeButton();
      return;
    }
    this.syncGameClubNativeButton();
  }

  private buildBase(): void {
    const dim = new PIXI.Graphics();
    dim.beginFill(0x1a2830, 0.45);
    dim.drawRect(0, 0, this.screenWidth, this.screenHeight);
    dim.endFill();
    dim.eventMode = 'static';
    dim.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.close();
    });
    this.addChild(dim);

    this.contentRoot.eventMode = 'static';
    this.contentRoot.on('pointertap', (event) => event.stopPropagation());
    this.addChild(this.contentRoot);

    this.taskLayer.addChild(
      this.rewardIconBg,
      this.progressTrack,
      this.progressFill,
      this.progressText,
    );
    this.claimBtnRoot.addChild(this.claimBtnBg, this.claimBtnLabel);
    this.claimBtnRoot.on('pointertap', (event) => {
      event.stopPropagation();
      this.handleClaimTap();
    });
    this.taskLayer.addChild(this.claimBtnRoot);

    this.enterClubRoot.eventMode = 'static';
    this.enterClubRoot.cursor = 'pointer';
    this.enterClubRoot.on('pointertap', (event) => {
      event.stopPropagation();
      AudioManager.playButtonSound();
      const api = typeof wx !== 'undefined' ? wx : null;
      if (api?.createGameClubButton) {
        this.syncGameClubNativeButton(true);
        api.showToast?.({ title: '请再点一次进入游戏圈', icon: 'none' });
        return;
      }
      api?.showToast?.({ title: '游戏圈仅微信内可用', icon: 'none' });
    });
  }

  private async loadArt(): Promise<void> {
    await GameClubWelfareOverlay.preloadTextures();
    if (this.destroyed) {
      return;
    }
    this.applyArt();
    this.artReady = true;
    this.renderTaskState({ postCount: 0, supported: isGameClubButtonSupported() });
    if (this.canSyncGameClubNativeButton()) {
      this.syncGameClubNativeButton();
    }
  }

  private applyArt(): void {
    const panelTex = TextureCache.get(GAME_CLUB_WELFARE_PANEL_TEXTURE_KEY);
    const enterTex = TextureCache.get(GAME_CLUB_WELFARE_ENTER_BTN_TEXTURE_KEY);
    if (!panelTex || !enterTex) {
      return;
    }

    this.contentRoot.removeChildren();
    this.taskLayer.removeChildren();
    this.taskLayer.addChild(
      this.rewardIconBg,
      this.progressTrack,
      this.progressFill,
      this.progressText,
      this.claimBtnRoot,
    );

    const panelMaxW = Math.min(620, this.screenWidth - 48);
    const artW = panelTex.width > 0 ? panelTex.width : PANEL_ART_W;
    const artH = panelTex.height > 0 ? panelTex.height : PANEL_ART_H;
    const layout = createPanelLayoutMetrics(artW, artH, panelMaxW);
    this.panelDisplayW = layout.displayW;
    this.panelDisplayH = layout.displayH;
    this.panelScale = layout.scale;
    const panelScale = layout.scale;

    const { taskRow, enterBtn: enterAnchor } = PANEL_LAYOUT;
    const rewardCardSize = Math.round(layout.len(taskRow.rewardSize));
    const progressArtW = taskRow.progressW;
    const progressArtH = taskRow.progressH;
    const claimArtW = taskRow.claimW;
    const claimArtH = taskRow.claimH;
    const rowGap = layout.len(taskRow.gap);
    const rowInnerW = layout.len(taskRow.innerW);
    const rowTotalW = rewardCardSize + rowGap + layout.len(progressArtW) + rowGap + layout.len(claimArtW);
    const rowLeft = layout.x(taskRow.innerX) + (rowInnerW - rowTotalW) / 2;
    const rowCy = layout.y(taskRow.cy);

    this.progressTrackWidth = Math.round(layout.len(progressArtW));
    this.progressTrackHeight = Math.max(20, Math.round(layout.len(progressArtH)));
    this.progressTrackX = rowLeft + rewardCardSize + rowGap;
    this.progressTrackY = rowCy - this.progressTrackHeight / 2;

    const enterBtnW = layout.len(enterAnchor.w);
    const enterBtnH = enterBtnW * (ENTER_BTN_ART_H / ENTER_BTN_ART_W);
    const stackTop = (this.screenHeight - this.panelDisplayH) / 2 - 8;

    this.contentRoot.position.set(this.screenWidth / 2, stackTop + this.panelDisplayH / 2);

    this.panelSprite = new PIXI.Sprite(panelTex);
    this.panelSprite.anchor.set(0.5);
    this.panelSprite.width = this.panelDisplayW;
    this.panelSprite.height = this.panelDisplayH;
    this.contentRoot.addChild(this.panelSprite);

    const closeHit = new PIXI.Container();
    closeHit.position.set(
      layout.centerX(PANEL_LAYOUT.closeHit.cx),
      layout.centerY(PANEL_LAYOUT.closeHit.cy),
    );
    closeHit.eventMode = 'static';
    closeHit.cursor = 'pointer';
    closeHit.hitArea = new PIXI.Circle(0, 0, Math.max(18, layout.len(PANEL_LAYOUT.closeHit.r)));
    closeHit.on('pointertap', (event) => {
      event.stopPropagation();
      AudioManager.playButtonSound();
      this.close();
    });
    this.contentRoot.addChild(closeHit);

    this.taskLayer.position.set(-this.panelDisplayW / 2, -this.panelDisplayH / 2);
    this.contentRoot.addChild(this.taskLayer);

    const rewardCardX = rowLeft + rewardCardSize / 2;
    const rewardCardY = rowCy;
    this.rewardIconBg.clear();
    this.rewardIconBg.beginFill(0xf3e8d1, 0.96);
    this.rewardIconBg.lineStyle(2, 0xe2d1b2, 1);
    this.rewardIconBg.drawRoundedRect(
      rewardCardX - rewardCardSize / 2,
      rewardCardY - rewardCardSize / 2,
      rewardCardSize,
      rewardCardSize,
      Math.round(12 * panelScale),
    );
    this.rewardIconBg.endFill();

    const coinTex = TextureCache.get(COIN_ICON_TEXTURE_KEY);
    if (coinTex) {
      const coinIcon = new PIXI.Sprite(coinTex);
      coinIcon.anchor.set(0.5);
      coinIcon.scale.set(0.40 * panelScale * (artW / 620));
      coinIcon.position.set(rewardCardX, rewardCardY - Math.round(rewardCardSize * 0.08));
      this.taskLayer.addChild(coinIcon);
    }

    const rewardAmount = new PIXI.Text(String(GAME_CLUB_DAILY_POST_COINS), {
      fontSize: Math.round(34 * panelScale),
      fill: 0xd07a12,
      fontWeight: '900',
      stroke: 0xffffff,
      strokeThickness: 4,
    });
    rewardAmount.anchor.set(0.5);
    rewardAmount.position.set(
      rewardCardX,
      rewardCardY + Math.round(rewardCardSize * 0.22),
    );
    rewardAmount.resolution = 2;
    this.taskLayer.addChild(rewardAmount);

    this.progressTrack.clear();
    this.progressTrack.beginFill(0xb99a7a);
    this.progressTrack.lineStyle(3, 0x70432b, 1);
    this.progressTrack.drawRoundedRect(
      this.progressTrackX,
      this.progressTrackY,
      this.progressTrackWidth,
      this.progressTrackHeight,
      this.progressTrackHeight / 2,
    );
    this.progressTrack.endFill();
    this.progressFill.position.set(this.progressTrackX, this.progressTrackY);

    this.progressText.style = {
      fontSize: Math.round(22 * panelScale),
      fill: 0x5b2b14,
      fontWeight: '900',
    };
    this.progressText.anchor.set(0.5, 0);
    this.progressText.resolution = 2;
    this.progressText.position.set(
      this.progressTrackX + this.progressTrackWidth / 2,
      this.progressTrackY + this.progressTrackHeight + 4,
    );

    const claimW = Math.round(layout.len(claimArtW));
    const claimH = Math.round(layout.len(claimArtH));
    this.claimBtnRoot.position.set(
      rowLeft + rewardCardSize + rowGap + this.progressTrackWidth + rowGap + claimW / 2,
      rowCy - claimH / 2,
    );
    this.claimBtnRoot.hitArea = new PIXI.Rectangle(-claimW / 2, 0, claimW, claimH);

    // 进入游戏圈：锚点相对面板母版坐标，随 panelScale 缩放
    this.enterBtnSprite = new PIXI.Sprite(enterTex);
    this.enterBtnSprite.anchor.set(0.5);
    this.enterBtnSprite.width = enterBtnW;
    this.enterBtnSprite.height = enterBtnH;
    this.enterBtnSprite.position.set(layout.centerX(enterAnchor.cx), layout.centerY(enterAnchor.cy));
    this.contentRoot.addChild(this.enterBtnSprite);

    this.enterClubRoot.position.set(layout.centerX(enterAnchor.cx), layout.centerY(enterAnchor.cy));
    this.enterClubRoot.hitArea = new PIXI.Rectangle(-enterBtnW / 2, -enterBtnH / 2, enterBtnW, enterBtnH);
    this.contentRoot.addChild(this.enterClubRoot);
  }

  private async refreshStatus(): Promise<void> {
    if (this.refreshing || !this.visible) {
      return;
    }
    this.refreshing = true;
    try {
      const status = await fetchDailyPostCount();
      this.postCount = status.postCount;
      this.renderTaskState(status);
      this.showStatusErrorToast(status.error);
      if (status.postCount >= 1) {
        this.clearReturnRefreshTimers();
      }
    } finally {
      this.refreshing = false;
    }
  }

  private scheduleReturnRefreshes(): void {
    this.clearReturnRefreshTimers();
    for (const delayMs of [0, 1500, 4000, 8000]) {
      const timer = setTimeout(() => {
        if (!this.visible || this.destroyed) {
          return;
        }
        void this.refreshStatus();
      }, delayMs);
      this.returnRefreshTimers.push(timer);
    }
  }

  private clearReturnRefreshTimers(): void {
    while (this.returnRefreshTimers.length > 0) {
      const timer = this.returnRefreshTimers.pop();
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private showStatusErrorToast(error?: string): void {
    if (!error) {
      return;
    }
    const now = Date.now();
    if (now - this.lastStatusErrorToastAt < 5000) {
      return;
    }
    this.lastStatusErrorToastAt = now;
    const api = typeof wx !== 'undefined' ? wx : null;
    api?.showToast?.({ title: error, icon: 'none', duration: 2600 });
  }

  private renderTaskState(status: GameClubDailyPostStatus): void {
    if (!this.artReady) {
      return;
    }

    const done = Math.min(1, this.postCount);
    const progressW = Math.max(0, Math.min(1, done)) * this.progressTrackWidth;
    this.progressFill.clear();
    this.progressFill.beginFill(0xffb347);
    this.progressFill.drawRoundedRect(
      0,
      0,
      progressW,
      this.progressTrackHeight,
      this.progressTrackHeight / 2,
    );
    this.progressFill.endFill();
    this.progressText.text = `${done}/1`;

    const claimable = canClaimGameClubDailyPostReward(this.postCount);
    const claimed = hasClaimedGameClubRewardToday();
    const claimW = Math.round(PANEL_LAYOUT.taskRow.claimW * this.panelScale);
    const claimH = Math.round(PANEL_LAYOUT.taskRow.claimH * this.panelScale);

    this.claimBtnBg.clear();
    this.claimBtnBg.beginFill(claimable ? 0xffd34d : 0xb9babd);
    this.claimBtnBg.lineStyle(3, claimable ? 0xc47a10 : 0x777b80, 1);
    this.claimBtnBg.drawRoundedRect(-claimW / 2, 0, claimW, claimH, claimH / 2);
    this.claimBtnBg.endFill();
    this.claimBtnLabel.text = claimed ? '已领取' : '领取';
    this.claimBtnLabel.style = {
      fontSize: Math.round(28 * this.panelScale),
      fill: claimable ? 0x8a4a12 : 0xffffff,
      fontWeight: '900',
      stroke: claimable ? 0xffffff : 0x676b70,
      strokeThickness: 3,
    };
    this.claimBtnLabel.anchor.set(0.5);
    this.claimBtnLabel.position.set(0, claimH / 2);
    this.claimBtnLabel.resolution = 2;
    this.claimBtnRoot.cursor = claimable ? 'pointer' : 'default';
    this.claimBtnRoot.eventMode = claimable ? 'static' : 'none';
  }

  private handleClaimTap(): void {
    if (!canClaimGameClubDailyPostReward(this.postCount)) {
      const api = typeof wx !== 'undefined' ? wx : null;
      if (this.postCount < 1) {
        api?.showToast?.({ title: '请先在游戏圈发帖', icon: 'none' });
      } else if (hasClaimedGameClubRewardToday()) {
        api?.showToast?.({ title: '今日奖励已领取', icon: 'none' });
      }
      return;
    }
    AudioManager.playButtonSound();
    const result = claimGameClubDailyPostReward(this.postCount);
    if (!result.ok) {
      return;
    }
    const api = typeof wx !== 'undefined' ? wx : null;
    api?.showToast?.({ title: `领取成功 +${result.coins} 金币`, icon: 'none' });
    this.options.onClaimed?.(result.coins);
    this.renderTaskState({ postCount: this.postCount, supported: true });
  }

  /** 福利弹层仍挂在当前场景舞台上时才允许创建/同步 wx 原生按钮。 */
  private isMountedOnStage(): boolean {
    let node: PIXI.DisplayObject | null = this;
    while (node) {
      if (node === Game.stage) {
        return true;
      }
      node = node.parent;
    }
    return false;
  }

  private canSyncGameClubNativeButton(): boolean {
    return this.visible && !this.destroyed && this.artReady && this.isMountedOnStage();
  }

  private getEnterClubNativeRectPx(): { left: number; top: number; width: number; height: number } | null {
    const hitArea = this.enterClubRoot.hitArea;
    const bounds = hitArea instanceof PIXI.Rectangle
      ? hitArea
      : this.enterClubRoot.getLocalBounds();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }
    const topLeft = this.enterClubRoot.toGlobal(new PIXI.Point(bounds.x, bounds.y));
    const bottomRight = this.enterClubRoot.toGlobal(
      new PIXI.Point(bounds.x + bounds.width, bounds.y + bounds.height),
    );
    return {
      left: Math.round(topLeft.x / Game.dpr),
      top: Math.round(topLeft.y / Game.dpr),
      width: Math.max(1, Math.round((bottomRight.x - topLeft.x) / Game.dpr)),
      height: Math.max(1, Math.round((bottomRight.y - topLeft.y) / Game.dpr)),
    };
  }

  private ensureGameClubNativeButton(): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    if (this.gameClubButton || !api?.createGameClubButton) {
      return;
    }
    const rect = this.getEnterClubNativeRectPx();
    if (!rect) {
      return;
    }
    try {
      // text 不能为空、fontSize 不宜 < 12，否则部分基础库不会渲染且可能抛 insertTextView 错误。
      this.gameClubButton = api.createGameClubButton({
        type: 'text',
        text: ' ',
        style: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          backgroundColor: 'rgba(0,0,0,0.01)',
          borderColor: 'rgba(0,0,0,0)',
          borderWidth: 0,
          borderRadius: Math.round(rect.height / 2),
          color: 'rgba(0,0,0,0)',
          textAlign: 'center',
          fontSize: 12,
          lineHeight: rect.height,
        },
      });
      this.gameClubButton.hide?.();
    } catch (error) {
      console.warn('[GameClubWelfareOverlay] createGameClubButton failed', error);
      this.destroyGameClubNativeButton();
    }
  }

  private destroyGameClubNativeButton(): void {
    if (!this.gameClubButton) {
      this.enterClubRoot.eventMode = 'static';
      this.enterClubRoot.cursor = 'pointer';
      return;
    }
    try {
      this.gameClubButton.hide?.();
    } catch {
      // ignore
    }
    try {
      this.gameClubButton.destroy?.();
    } catch (error) {
      console.warn('[GameClubWelfareOverlay] destroy game club button failed', error);
    }
    this.gameClubButton = null;
    this.enterClubRoot.eventMode = 'static';
    this.enterClubRoot.cursor = 'pointer';
  }

  private syncGameClubNativeButton(forceInteractive = false): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    if (!this.canSyncGameClubNativeButton() || !api?.createGameClubButton) {
      this.destroyGameClubNativeButton();
      return;
    }
    this.ensureGameClubNativeButton();
    if (!this.gameClubButton) {
      return;
    }
    const rect = this.getEnterClubNativeRectPx();
    if (!rect) {
      this.destroyGameClubNativeButton();
      return;
    }
    try {
      if (this.gameClubButton.style) {
        Object.assign(this.gameClubButton.style, {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          borderRadius: Math.round(rect.height / 2),
          lineHeight: rect.height,
        });
      }
      this.gameClubButton.show?.();
      const nativeVisible = !forceInteractive;
      this.enterClubRoot.eventMode = nativeVisible ? 'none' : 'static';
      this.enterClubRoot.cursor = nativeVisible ? 'default' : 'pointer';
    } catch (error) {
      console.warn('[GameClubWelfareOverlay] sync game club button failed', error);
      this.destroyGameClubNativeButton();
    }
  }
}
