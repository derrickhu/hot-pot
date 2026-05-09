import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import type { BowlBadgeDef } from '@/config/bowlBadges';
import { mountBowlBadgeIcon } from '@/gameobjects/BowlBadgeIcon';
import { toolLabel, type ToolKind } from '@/game/ToolInventory';

const BADGE_ICON_SIZE = 252;
const BADGE_CENTER_X = 0;
const BADGE_CENTER_Y = 58;
const BADGE_ROOT_BASE_Y = BADGE_CENTER_Y - BADGE_ICON_SIZE / 2;

export interface BowlBadgeShareRewardResult {
  status: 'claimed' | 'already_claimed' | 'unavailable' | 'failed';
  count?: number;
}

export interface BowlBadgeShareRewardOptions {
  toolKind: ToolKind;
  iconTexture?: PIXI.Texture | null;
  buttonTexture?: PIXI.Texture | null;
  canClaim: boolean;
  ownedCount: number;
  onShare: () => Promise<BowlBadgeShareRewardResult>;
}

export interface BowlBadgeUnlockOverlayOptions {
  badge: BowlBadgeDef;
  texture: PIXI.Texture | null;
  onClose: () => void;
  shareReward?: BowlBadgeShareRewardOptions;
}

export class BowlBadgeUnlockOverlay extends PIXI.Container {
  private readonly maskGfx: PIXI.Graphics;
  private readonly panelRoot: PIXI.Container;
  private readonly titleRoot: PIXI.Container;
  private readonly badgeRoot: PIXI.Container;
  private readonly auraRoot: PIXI.Container;
  private readonly raySpinner: PIXI.Container;
  private readonly ringSpinner: PIXI.Container;
  private readonly sparkleRoot: PIXI.Container;
  private readonly titleText: PIXI.Text;
  private readonly titleSprite: PIXI.Sprite;
  private readonly badgeTitle: PIXI.Text;
  private readonly hintText: PIXI.Text;
  private readonly shareRewardRoot: PIXI.Container;
  private readonly shareButtonSprite: PIXI.Sprite;
  private readonly shareButtonBg: PIXI.Graphics;
  private readonly shareButtonText: PIXI.Text;
  private readonly shareButtonArrow: PIXI.Text;
  private readonly rewardIconHost: PIXI.Container;
  private readonly rewardHintText: PIXI.Text;
  private readonly sparkles: Array<{ node: PIXI.DisplayObject; phase: number }> = [];
  private readonly tick = (delta: number): void => this.updateAnimation(delta);
  private titleTexture: PIXI.Texture | null = null;
  private shareRewardOptions: BowlBadgeShareRewardOptions | null = null;
  private shareRewardBusy = false;
  private onClose: () => void = () => {};
  private closing = false;
  private animationTime = 0;

  constructor(w: number, h: number) {
    super();
    this.visible = false;
    this.eventMode = 'static';

    this.maskGfx = new PIXI.Graphics();
    this.maskGfx.beginFill(0x050505, 0.72);
    this.maskGfx.drawRect(0, 0, w, h);
    this.maskGfx.endFill();
    this.maskGfx.eventMode = 'static';
    this.addChild(this.maskGfx);

    this.panelRoot = new PIXI.Container();
    this.panelRoot.position.set(w / 2, Math.round(h * 0.42));
    this.addChild(this.panelRoot);

    this.titleRoot = new PIXI.Container();
    this.titleRoot.position.set(0, -188);
    this.panelRoot.addChild(this.titleRoot);

    this.titleText = new PIXI.Text('恭喜通关\n新徽章!', {
      fontSize: 40,
      fill: 0xfff06a,
      fontWeight: '900',
      stroke: 0x6d2a10,
      strokeThickness: 8,
      dropShadow: true,
      dropShadowBlur: 4,
      dropShadowDistance: 3,
      dropShadowColor: 0x2c1208,
      lineJoin: 'round',
      align: 'center',
      lineHeight: 50,
    });
    this.titleText.anchor.set(0.5);
    this.titleRoot.addChild(this.titleText);

    this.titleSprite = new PIXI.Sprite();
    this.titleSprite.anchor.set(0.5);
    this.titleSprite.visible = false;
    this.titleRoot.addChild(this.titleSprite);

    this.auraRoot = new PIXI.Container();
    this.auraRoot.position.set(BADGE_CENTER_X, BADGE_CENTER_Y);
    this.panelRoot.addChild(this.auraRoot);

    this.raySpinner = this.createRaySpinner(18, 68, 160, 0xfff0a2, 0.38);
    this.auraRoot.addChild(this.raySpinner);

    this.ringSpinner = this.createRaySpinner(12, 92, 138, 0xffffff, 0.18);
    this.ringSpinner.rotation = Math.PI / 12;
    this.auraRoot.addChild(this.ringSpinner);

    this.sparkleRoot = new PIXI.Container();
    this.auraRoot.addChild(this.sparkleRoot);
    this.mountSparkles();

    this.badgeRoot = new PIXI.Container();
    this.badgeRoot.position.set(BADGE_CENTER_X - BADGE_ICON_SIZE / 2, BADGE_ROOT_BASE_Y);
    this.panelRoot.addChild(this.badgeRoot);

    this.badgeTitle = new PIXI.Text('', {
      fontSize: 28,
      fill: 0xfff7d4,
      fontWeight: '900',
      stroke: 0x5a2b16,
      strokeThickness: 5,
      lineJoin: 'round',
    });
    this.badgeTitle.anchor.set(0.5, 0);
    this.badgeTitle.position.set(0, 150);
    this.panelRoot.addChild(this.badgeTitle);

    this.shareRewardRoot = new PIXI.Container();
    this.shareRewardRoot.position.set(w / 2, Math.round(h * 0.64));
    this.shareRewardRoot.eventMode = 'static';
    this.shareRewardRoot.cursor = 'pointer';
    this.shareRewardRoot.hitArea = new PIXI.Rectangle(-178, -44, 356, 116);
    this.shareRewardRoot.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      void this.handleShareRewardTap();
    });
    this.addChild(this.shareRewardRoot);

    this.shareButtonBg = new PIXI.Graphics();
    this.shareRewardRoot.addChild(this.shareButtonBg);

    this.shareButtonSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this.shareButtonSprite.anchor.set(0.5);
    this.shareButtonSprite.visible = false;
    this.shareRewardRoot.addChild(this.shareButtonSprite);

    this.shareButtonText = new PIXI.Text('分享', {
      fontSize: 40,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x5b3a32,
      strokeThickness: 6,
      lineJoin: 'round',
    });
    this.shareButtonText.anchor.set(0.5);
    this.shareButtonText.position.set(-38, -6);
    this.shareRewardRoot.addChild(this.shareButtonText);

    this.shareButtonArrow = new PIXI.Text('↗', {
      fontSize: 42,
      fill: 0xffa61f,
      fontWeight: '900',
      stroke: 0x7d3f13,
      strokeThickness: 4,
      lineJoin: 'round',
    });
    this.shareButtonArrow.anchor.set(0.5);
    this.shareButtonArrow.position.set(94, -8);
    this.shareRewardRoot.addChild(this.shareButtonArrow);

    this.rewardIconHost = new PIXI.Container();
    this.rewardIconHost.position.set(-82, 82);
    this.shareRewardRoot.addChild(this.rewardIconHost);

    this.rewardHintText = new PIXI.Text('', {
      fontSize: 28,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x3b2316,
      strokeThickness: 4,
      lineJoin: 'round',
    });
    this.rewardHintText.anchor.set(0, 0.5);
    this.rewardHintText.position.set(-42, 82);
    this.shareRewardRoot.addChild(this.rewardHintText);

    this.hintText = new PIXI.Text('点击任意处关闭', {
      fontSize: 24,
      fill: 0xfdf1d4,
      fontWeight: '800',
      stroke: 0x3b2316,
      strokeThickness: 4,
    });
    this.hintText.anchor.set(0.5);
    this.hintText.position.set(w / 2, Math.round(h * 0.78));
    this.addChild(this.hintText);

    this.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.close();
    });
  }

  setTitleTexture(texture: PIXI.Texture | null): void {
    this.titleTexture = texture;
    this.refreshTitleVisual();
  }

  show(options: BowlBadgeUnlockOverlayOptions): void {
    this.onClose = options.onClose;
    this.closing = false;
    this.animationTime = 0;
    this.panelRoot.scale.set(0.92);
    this.panelRoot.alpha = 0.96;
    this.refreshTitleVisual();
    mountBowlBadgeIcon(this.badgeRoot, options.badge, options.texture, BADGE_ICON_SIZE);
    this.badgeTitle.text = options.badge.title;
    this.shareRewardOptions = options.shareReward ?? null;
    this.shareRewardBusy = false;
    this.refreshShareRewardVisual();
    this.visible = true;
    PIXI.Ticker.shared.remove(this.tick);
    PIXI.Ticker.shared.add(this.tick);
    AudioManager.playBadgeUnlockSound();
  }

  hide(): void {
    PIXI.Ticker.shared.remove(this.tick);
    this.visible = false;
  }

  private close(): void {
    if (!this.visible || this.closing) {
      return;
    }
    this.closing = true;
    this.hide();
    this.onClose();
  }

  private async handleShareRewardTap(): Promise<void> {
    const reward = this.shareRewardOptions;
    if (!reward || this.shareRewardBusy) {
      return;
    }

    AudioManager.playButtonSound();
    this.shareRewardBusy = true;
    this.shareButtonText.text = '分享中';
    if (reward.canClaim) {
      this.rewardHintText.text = `分享完成后领取${toolLabel(reward.toolKind)} +1`;
      this.rewardHintText.visible = true;
      this.rewardIconHost.visible = true;
    }
    try {
      const result = await reward.onShare();
      if (result.status === 'claimed') {
        reward.canClaim = false;
        reward.ownedCount = result.count ?? reward.ownedCount + 1;
        this.rewardHintText.text = `获得${toolLabel(reward.toolKind)} +1 · 已有 ${reward.ownedCount}`;
        this.rewardHintText.visible = true;
        this.rewardIconHost.visible = true;
      } else if (result.status === 'already_claimed') {
        reward.canClaim = false;
        this.rewardHintText.visible = false;
        this.rewardIconHost.visible = false;
      } else if (result.status === 'unavailable') {
        this.rewardHintText.text = '请在微信小游戏中分享领取';
        this.rewardHintText.visible = true;
        this.rewardIconHost.visible = true;
      } else {
        this.rewardHintText.text = '分享未完成，请稍后再试';
        this.rewardHintText.visible = true;
        this.rewardIconHost.visible = true;
      }
    } finally {
      this.shareRewardBusy = false;
      this.shareButtonText.text = reward.canClaim ? '分享' : '已领取';
      this.shareButtonArrow.visible = reward.canClaim;
      this.shareRewardRoot.cursor = reward.canClaim ? 'pointer' : 'default';
      this.drawShareButtonBg(reward.canClaim);
    }
  }

  private refreshShareRewardVisual(): void {
    const reward = this.shareRewardOptions;
    this.shareRewardRoot.visible = !!reward;
    if (!reward) {
      return;
    }
    const enabled = reward.canClaim && !this.shareRewardBusy;
    this.shareRewardRoot.cursor = this.shareRewardBusy ? 'default' : 'pointer';
    this.shareButtonText.text = reward.canClaim ? '分享' : '已领取';
    this.shareButtonArrow.visible = reward.canClaim;
    this.rewardHintText.text = reward.canClaim
      ? '+1（今日0/1）'
      : `今日已领取 · 已有 ${reward.ownedCount}`;
    this.rewardHintText.visible = reward.canClaim;
    this.rewardIconHost.visible = reward.canClaim;
    this.drawShareButtonBg(enabled);
    this.mountShareButtonTexture(reward.buttonTexture ?? null);
    this.mountRewardIcon(reward.iconTexture ?? null, reward.toolKind);
  }

  private mountShareButtonTexture(texture: PIXI.Texture | null): void {
    const hasTexture = !!texture && texture.width > 0 && texture.height > 0;
    this.shareButtonSprite.visible = hasTexture;
    this.shareButtonBg.visible = !hasTexture;
    this.shareButtonText.visible = !hasTexture;
    this.shareButtonArrow.visible = !hasTexture && this.shareButtonArrow.visible;
    if (!hasTexture || !texture) {
      return;
    }
    this.shareButtonSprite.texture = texture;
    const targetW = 260;
    const scale = targetW / Math.max(1, texture.width);
    this.shareButtonSprite.scale.set(scale);
  }

  private drawShareButtonBg(enabled: boolean): void {
    const g = this.shareButtonBg;
    g.clear();
    const outer = enabled ? 0x6b4b42 : 0x5f5a55;
    const face = enabled ? 0xc9f6a6 : 0xb8b2aa;
    const inner = enabled ? 0xe3ffc7 : 0xd2ccc4;
    g.beginFill(0x2e2018, 0.28);
    g.drawRoundedRect(-164, -44, 328, 76, 20);
    g.endFill();
    g.lineStyle(5, outer, 1);
    g.beginFill(face);
    g.drawRoundedRect(-168, -50, 336, 78, 18);
    g.endFill();
    g.lineStyle(2, 0xffffff, 0.55);
    g.beginFill(inner, 0.7);
    g.drawRoundedRect(-156, -42, 312, 42, 16);
    g.endFill();
  }

  private mountRewardIcon(texture: PIXI.Texture | null, kind: ToolKind): void {
    this.rewardIconHost.removeChildren();
    if (texture && texture.width > 0 && texture.height > 0) {
      const sp = new PIXI.Sprite(texture);
      sp.anchor.set(0.5);
      const side = 58;
      const scale = side / Math.max(texture.width, texture.height);
      sp.scale.set(scale);
      this.rewardIconHost.addChild(sp);
      return;
    }
    this.drawFallbackToolIcon(kind);
  }

  private drawFallbackToolIcon(kind: ToolKind): void {
    const g = new PIXI.Graphics();
    g.lineStyle(3, 0x2f3d40, 1);
    g.beginFill(0xf7fbff);
    g.drawCircle(0, 0, 20);
    g.endFill();
    if (kind === 'remove') {
      g.lineStyle(5, 0x6b4b2a, 1);
      g.moveTo(4, 8);
      g.lineTo(22, 26);
      g.lineStyle(0);
      g.beginFill(0x7cc7ff);
      g.drawRoundedRect(-18, -14, 28, 16, 6);
      g.endFill();
      g.beginFill(0x2f79bd);
      for (let i = 0; i < 4; i += 1) {
        g.drawRect(-15 + i * 6, 2, 3, 16);
      }
      g.endFill();
    }
    this.rewardIconHost.addChild(g);
  }

  private refreshTitleVisual(): void {
    if (this.titleTexture) {
      this.titleSprite.texture = this.titleTexture;
      const maxW = 392;
      const maxH = 182;
      const scale = Math.min(maxW / Math.max(1, this.titleTexture.width), maxH / Math.max(1, this.titleTexture.height));
      this.titleSprite.scale.set(scale);
      this.titleSprite.visible = true;
      this.titleText.visible = false;
      return;
    }

    this.titleSprite.visible = false;
    this.titleText.visible = true;
  }

  private createRaySpinner(
    count: number,
    innerR: number,
    outerR: number,
    color: number,
    alpha: number,
  ): PIXI.Container {
    const root = new PIXI.Container();
    const g = new PIXI.Graphics();
    for (let i = 0; i < count; i += 1) {
      const a = (Math.PI * 2 * i) / count;
      const spread = i % 2 === 0 ? 0.055 : 0.034;
      const out = i % 2 === 0 ? outerR : outerR * 0.78;
      g.beginFill(color, i % 2 === 0 ? alpha : alpha * 0.58);
      g.moveTo(Math.cos(a - spread) * innerR, Math.sin(a - spread) * innerR);
      g.lineTo(Math.cos(a) * out, Math.sin(a) * out);
      g.lineTo(Math.cos(a + spread) * innerR, Math.sin(a + spread) * innerR);
      g.closePath();
      g.endFill();
    }
    g.blendMode = PIXI.BLEND_MODES.ADD;
    root.addChild(g);
    return root;
  }

  private mountSparkles(): void {
    const points = [
      [-124, -32, 0],
      [-96, 82, 0.8],
      [108, -72, 1.5],
      [126, 54, 2.2],
      [-26, -126, 2.8],
      [48, 116, 3.4],
    ] as const;

    for (const [x, y, phase] of points) {
      const star = new PIXI.Graphics();
      star.beginFill(0xffffff, 0.95);
      star.moveTo(0, -8);
      star.lineTo(3, -3);
      star.lineTo(8, 0);
      star.lineTo(3, 3);
      star.lineTo(0, 8);
      star.lineTo(-3, 3);
      star.lineTo(-8, 0);
      star.lineTo(-3, -3);
      star.closePath();
      star.endFill();
      star.beginFill(0xfff0a2, 0.75);
      star.drawCircle(0, 0, 2.5);
      star.endFill();
      star.position.set(x, y);
      star.blendMode = PIXI.BLEND_MODES.ADD;
      this.sparkleRoot.addChild(star);
      this.sparkles.push({ node: star, phase });
    }
  }

  private updateAnimation(delta: number): void {
    if (!this.visible) {
      return;
    }

    this.animationTime += delta / 60;
    const t = this.animationTime;
    const settle = Math.min(1, t * 5);
    this.panelRoot.scale.set(0.92 + settle * 0.08 + Math.sin(t * 5.8) * 0.012);
    this.raySpinner.rotation += delta * 0.008;
    this.ringSpinner.rotation -= delta * 0.0045;
    this.auraRoot.scale.set(1 + Math.sin(t * 4.2) * 0.035);
    this.titleRoot.y = -188 + Math.sin(t * 4.6) * 2;
    const badgeBob = Math.sin(t * 3.8) * 3;
    this.badgeRoot.y = BADGE_ROOT_BASE_Y + badgeBob;
    this.auraRoot.y = BADGE_CENTER_Y + badgeBob;

    for (const sparkle of this.sparkles) {
      const pulse = (Math.sin(t * 5 + sparkle.phase) + 1) / 2;
      sparkle.node.alpha = 0.28 + pulse * 0.72;
      sparkle.node.scale.set(0.65 + pulse * 0.55);
      sparkle.node.rotation += delta * 0.018;
    }
  }
}
