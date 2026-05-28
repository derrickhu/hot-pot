import * as PIXI from 'pixi.js';
import {
  HOME_MILESTONE_GIFT_BTN_GREEN_TEXTURE_KEY,
  HOME_MILESTONE_GIFT_BTN_GREEN_TEXTURE_PATH,
  HOME_MILESTONE_GIFT_BTN_ORANGE_TEXTURE_KEY,
  HOME_MILESTONE_GIFT_BTN_ORANGE_TEXTURE_PATH,
  HOME_MILESTONE_GIFT_PANEL_COMPOSITE,
  HOME_MILESTONE_GIFT_PANEL_DISPLAY,
  HOME_MILESTONE_GIFT_PANEL_LAYOUT,
  HOME_MILESTONE_GIFT_PANEL_NINE_SLICE,
  HOME_MILESTONE_GIFT_PANEL_TEXTURE_KEY,
  HOME_MILESTONE_GIFT_PANEL_TEXTURE_PATH,
} from '@/config/homeMilestoneGiftAssets';
import type { LevelMilestoneGiftDef } from '@/config/levelMilestoneGifts';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import { createCoinIcon } from '@/gameobjects/CoinBar';
import { createRewardIconNode } from '@/utils/gachaRewardIcons';
import { TextureCache } from '@/utils/TextureCache';

export interface HomeMilestoneGiftPanelHandlers {
  readonly onWatchAd: () => void | Promise<void>;
  readonly onClaim: () => void;
  readonly onClose?: () => void;
}

interface PanelMetrics {
  panelW: number;
  panelH: number;
  usesArt: boolean;
  composite: boolean;
}

/** 首页大礼包：v5 整图含文案道具，程序仅叠广告计数/领取。 */
export class HomeMilestoneGiftPanel {
  readonly root = new PIXI.Container();

  private readonly panelRoot = new PIXI.Container();
  private readonly contentRoot = new PIXI.Container();
  private readonly actionButtonRoot = new PIXI.Container();
  private actionButtonLabel: PIXI.Text | null = null;
  private panelMetrics: PanelMetrics = { panelW: 520, panelH: 640, usesArt: false, composite: false };
  private gift: LevelMilestoneGiftDef | null = null;
  private handlers: HomeMilestoneGiftPanelHandlers | null = null;
  private currentAdViews = 0;

  constructor() {
    this.root.visible = false;
    this.root.eventMode = 'static';
    this.root.zIndex = 19990;
  }

  static async preload(): Promise<void> {
    await Promise.all([
      TextureCache.load(HOME_MILESTONE_GIFT_PANEL_TEXTURE_KEY, HOME_MILESTONE_GIFT_PANEL_TEXTURE_PATH),
      TextureCache.load(HOME_MILESTONE_GIFT_BTN_ORANGE_TEXTURE_KEY, HOME_MILESTONE_GIFT_BTN_ORANGE_TEXTURE_PATH),
      TextureCache.load(HOME_MILESTONE_GIFT_BTN_GREEN_TEXTURE_KEY, HOME_MILESTONE_GIFT_BTN_GREEN_TEXTURE_PATH),
    ]);
  }

  show(
    gift: LevelMilestoneGiftDef,
    adViews: number,
    handlers: HomeMilestoneGiftPanelHandlers,
  ): void {
    this.hide();
    this.gift = gift;
    this.handlers = handlers;
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const centerX = W / 2;
    this.root.visible = true;

    const dim = new PIXI.Graphics();
    dim.beginFill(0x06121b, 0.78);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    dim.eventMode = 'static';
    dim.on('pointertap', () => this.close());
    this.root.addChild(dim);

    const panelY = H * 0.46;
    this.panelRoot.position.set(centerX, panelY);
    this.panelRoot.eventMode = 'static';
    this.panelRoot.on('pointertap', (event) => {
      event.stopPropagation();
    });
    this.root.addChild(this.panelRoot);

    this.panelMetrics = this.mountPanelBackground(W);
    const { panelW, panelH } = this.panelMetrics;
    const halfH = panelH / 2;
    const layout = HOME_MILESTONE_GIFT_PANEL_LAYOUT;

    if (!this.panelMetrics.composite) {
      this.contentRoot.removeChildren();
      this.panelRoot.addChild(this.contentRoot);

      const title = new PIXI.Text(gift.previewTitle, {
        fontSize: layout.titleFontSize,
        fill: 0xfff06a,
        fontWeight: '900',
        stroke: 0xe83324,
        strokeThickness: 7,
        lineJoin: 'round',
        dropShadow: true,
        dropShadowBlur: 4,
        dropShadowDistance: 2,
        dropShadowColor: 0x6d2a10,
      });
      title.anchor.set(0.5);
      title.position.set(0, -halfH + panelH * layout.titleYRatio);
      title.resolution = 2;
      this.contentRoot.addChild(title);

      const subtitle = new PIXI.Text(`观看 ${gift.requiredAdViews} 次广告即可免费领取`, {
        fontSize: layout.subtitleFontSize,
        fill: 0xff6a3d,
        fontWeight: '800',
        stroke: 0x5a3218,
        strokeThickness: 4,
        lineJoin: 'round',
      });
      subtitle.anchor.set(0.5);
      subtitle.position.set(0, -halfH + panelH * layout.subtitleYRatio);
      subtitle.resolution = 2;
      this.contentRoot.addChild(subtitle);

      const rewardGrid = this.createRewardGrid(gift, W);
      rewardGrid.position.set(0, -halfH + panelH * layout.rewardsYRatio);
      this.contentRoot.addChild(rewardGrid);
    }

    this.actionButtonRoot.position.set(0, -halfH + panelH * layout.actionButtonYRatio);
    this.panelRoot.addChild(this.actionButtonRoot);
    this.actionButtonRoot.eventMode = 'static';
    this.actionButtonRoot.cursor = 'pointer';
    this.actionButtonRoot.on('pointertap', (event) => {
      event.stopPropagation();
      void this.onActionTap();
    });

    const closeHint = new PIXI.Text('点击空白处关闭', {
      fontSize: 20,
      fill: 0xfdf1d4,
      fontWeight: '800',
      stroke: 0x3b2316,
      strokeThickness: 3,
    });
    closeHint.anchor.set(0.5);
    closeHint.position.set(centerX, H * 0.84);
    closeHint.resolution = 2;
    closeHint.eventMode = 'none';
    this.root.addChild(closeHint);

    this.refreshActionButton(adViews, gift.requiredAdViews);
  }

  refreshActionButton(adViews: number, requiredAds: number): void {
    if (!this.gift) {
      return;
    }
    const max = Math.max(1, requiredAds);
    const current = Math.min(Math.max(0, adViews), max);
    this.currentAdViews = current;
    const ready = current >= max;
    const { panelW } = this.panelMetrics;

    destroyContainerChildren(this.actionButtonRoot);
    const layout = HOME_MILESTONE_GIFT_PANEL_LAYOUT;
    const btnW = Math.min(layout.actionButtonMaxWidth, panelW * layout.actionButtonWidthRatio);
    const btnH = this.panelMetrics.composite ? 68 : 54;

    if (!this.panelMetrics.composite) {
      const btnTex = TextureCache.get(
        ready ? HOME_MILESTONE_GIFT_BTN_GREEN_TEXTURE_KEY : HOME_MILESTONE_GIFT_BTN_ORANGE_TEXTURE_KEY,
      );
      if (btnTex && btnTex !== PIXI.Texture.EMPTY && btnTex.width > 4) {
        const sp = new PIXI.Sprite(btnTex);
        sp.anchor.set(0.5);
        const scale = btnW / btnTex.width;
        sp.scale.set(scale);
        this.actionButtonRoot.addChild(sp);
        const scaledBtnH = btnTex.height * scale;
        this.actionButtonRoot.hitArea = new PIXI.Rectangle(
          -btnW / 2,
          -scaledBtnH / 2,
          btnW,
          scaledBtnH,
        );
      } else {
        const bg = new PIXI.Graphics();
        if (ready) {
          bg.beginFill(0x6ee04a);
          bg.lineStyle(3, 0xffffff, 1);
          bg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);
          bg.endFill();
        } else {
          bg.beginFill(0xffa726);
          bg.lineStyle(3, 0xffffff, 1);
          bg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);
          bg.endFill();
        }
        this.actionButtonRoot.addChild(bg);
        this.actionButtonRoot.hitArea = new PIXI.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH);
      }
    } else {
      this.actionButtonRoot.hitArea = new PIXI.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH);
    }

    const label = formatMilestoneGiftActionLabel(current, max, ready);
    this.actionButtonLabel = new PIXI.Text(label, {
      fontSize: ready ? layout.actionButtonFontSizeReady : layout.actionButtonFontSizePending,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: ready ? 0x2a6d1f : 0x8a4217,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    this.actionButtonLabel.anchor.set(0.5);
    this.actionButtonLabel.position.set(0, layout.actionButtonLabelOffsetY);
    this.actionButtonLabel.resolution = 2;
    this.actionButtonRoot.addChild(this.actionButtonLabel);
  }

  hide(): void {
    this.gift = null;
    this.handlers = null;
    this.actionButtonLabel = null;
    this.panelMetrics = { panelW: 520, panelH: 640, usesArt: false, composite: false };
    this.panelRoot.removeAllListeners();
    this.actionButtonRoot.removeAllListeners();
    this.root.removeAllListeners();
    this.clearEphemeralOverlayChildren();
    this.clearPanelDynamicChildren();
    if (this.panelRoot.parent) {
      this.panelRoot.parent.removeChild(this.panelRoot);
    }
    this.root.visible = false;
  }

  /** 只销毁蒙层、关闭提示等临时节点，保留 panelRoot / contentRoot / actionButtonRoot。 */
  private clearEphemeralOverlayChildren(): void {
    for (const child of [...this.root.children]) {
      if (child === this.panelRoot) {
        continue;
      }
      this.root.removeChild(child);
      child.destroy({ children: true });
    }
  }

  /** 清掉九宫格面板等动态子节点，不 destroy 持久容器本身。 */
  private clearPanelDynamicChildren(): void {
    for (const child of [...this.panelRoot.children]) {
      if (child === this.contentRoot || child === this.actionButtonRoot) {
        continue;
      }
      this.panelRoot.removeChild(child);
      child.destroy({ children: true });
    }
    this.contentRoot.removeChildren();
    this.actionButtonRoot.removeChildren();
  }

  private mountPanelBackground(screenW: number): PanelMetrics {
    const tex = TextureCache.get(HOME_MILESTONE_GIFT_PANEL_TEXTURE_KEY);
    const composite = HOME_MILESTONE_GIFT_PANEL_COMPOSITE;
    const display = HOME_MILESTONE_GIFT_PANEL_DISPLAY;
    const maxPanelH = Math.min(
      composite ? display.maxHeight : 580,
      Game.logicHeight * (composite ? display.heightRatio : 0.62),
    );
    const targetW = Math.min(
      composite ? display.maxWidth : 560,
      screenW * display.widthRatio,
      screenW - display.screenPaddingX * 2,
    );
    if (!tex || tex === PIXI.Texture.EMPTY || tex.width <= 4) {
      const targetH = maxPanelH;
      const panelBg = new PIXI.Graphics();
      panelBg.beginFill(0xf5e6c8, 0.98);
      panelBg.lineStyle(4, 0x5a3218, 1);
      panelBg.drawRoundedRect(-targetW / 2, -targetH / 2, targetW, targetH, 28);
      panelBg.endFill();
      this.panelRoot.addChild(panelBg);
      return { panelW: targetW, panelH: targetH, usesArt: false, composite };
    }

    if (composite) {
      const scale = Math.min(targetW / tex.width, maxPanelH / tex.height);
      const panel = new PIXI.Sprite(tex);
      panel.anchor.set(0.5);
      panel.scale.set(scale);
      this.panelRoot.addChild(panel);
      return {
        panelW: tex.width * scale,
        panelH: tex.height * scale,
        usesArt: true,
        composite: true,
      };
    }

    const targetH = maxPanelH;
    const slice = HOME_MILESTONE_GIFT_PANEL_NINE_SLICE;
    const panel = new PIXI.NineSlicePlane(
      tex,
      slice.left,
      slice.top,
      slice.right,
      slice.bottom,
    );
    panel.width = targetW;
    panel.height = targetH;
    panel.pivot.set(targetW / 2, targetH / 2);
    panel.position.set(0, 0);
    this.panelRoot.addChild(panel);
    return {
      panelW: targetW,
      panelH: targetH,
      usesArt: true,
      composite: false,
    };
  }

  private async onActionTap(): Promise<void> {
    if (!this.gift || !this.handlers) {
      return;
    }
    AudioManager.playButtonSound();
    const ready = this.currentAdViews >= this.gift.requiredAdViews;
    if (ready) {
      this.handlers.onClaim();
      return;
    }
    await this.handlers.onWatchAd();
  }

  private close(): void {
    AudioManager.playButtonSound();
    this.handlers?.onClose?.();
    this.hide();
  }

  private createRewardGrid(gift: LevelMilestoneGiftDef, screenW: number): PIXI.Container {
    const root = new PIXI.Container();
    const layout = HOME_MILESTONE_GIFT_PANEL_LAYOUT;
    const iconSize = screenW < 360 ? layout.rewardIconSizeNarrow : layout.rewardIconSize;
    const gap = screenW < 360 ? 8 : 12;
    const rowStep = iconSize + layout.rewardRowGap;
    const tools = gift.toolRewards;
    const toolRow1 = this.layoutRewardRow(tools.slice(0, 3), iconSize, gap, screenW);
    const toolRow2 = this.layoutRewardRow(tools.slice(3), iconSize, gap, screenW);
    const coinRow = this.layoutRewardRow(
      [{ kind: 'coins' as const, count: gift.coins }],
      iconSize,
      gap,
      screenW,
    );

    toolRow1.position.set(0, -rowStep);
    toolRow2.position.set(0, 0);
    coinRow.position.set(0, rowStep);
    root.addChild(toolRow1);
    root.addChild(toolRow2);
    root.addChild(coinRow);
    return root;
  }

  private layoutRewardRow(
    slots: Array<
      | { kind: 'bowlTool'; tool: 'addDish' | 'remove' | 'shuffle'; count: number }
      | { kind: 'fruitSliceTool'; tool: 'eliminate' | 'shuffle'; count: number }
      | { kind: 'coins'; count: number }
    >,
    iconSize: number,
    gap: number,
    screenW: number,
  ): PIXI.Container {
    const row = new PIXI.Container();
    const totalW = slots.length * iconSize + (slots.length - 1) * gap;
    let x = -totalW / 2 + iconSize / 2;
    for (const slot of slots) {
      const cell = new PIXI.Container();
      cell.position.set(x, 0);
      cell.addChild(
        createRewardIconNode(slot, iconSize, () => createCoinIcon(iconSize * 0.92)),
      );
      const countLabel = new PIXI.Text(`x${slot.count}`, {
        fontSize: screenW < 360 ? 15 : 17,
        fill: 0xfff4c2,
        fontWeight: '900',
        stroke: 0x6d2a10,
        strokeThickness: 4,
        lineJoin: 'round',
      });
      countLabel.anchor.set(1, 1);
      countLabel.position.set(iconSize * 0.42, iconSize * 0.42);
      countLabel.resolution = 2;
      cell.addChild(countLabel);
      row.addChild(cell);
      x += iconSize + gap;
    }
    return row;
  }
}

function formatMilestoneGiftActionLabel(current: number, max: number, ready: boolean): string {
  if (ready) {
    return '领取';
  }
  const adCountWord = max === 2 ? '两' : String(max);
  return `看${adCountWord}个广告获得 ${current}/${max}`;
}

function destroyContainerChildren(container: PIXI.Container): void {
  const children = container.removeChildren();
  for (const child of children) {
    if (!child.destroyed) {
      child.destroy({ children: true });
    }
  }
}
