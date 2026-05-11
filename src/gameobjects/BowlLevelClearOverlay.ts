import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { FRUIT_MAP, type FruitId } from '@/config/fruits';
import type { BowlSkinUnlock } from '@/config/bowlSkins';
import { BOWL_IMAGES_ROOT } from '@/config/bowlAssets';
import { TextureCache } from '@/utils/TextureCache';

export interface BowlLevelClearOverlayOptions {
  newFruitIds: FruitId[];
  newSkinUnlocks?: BowlSkinUnlock[];
  /** 是否已是最后一关（文案区分「下一关」） */
  isLastLevel: boolean;
  onHome: () => void;
  onNextLevel: () => void;
  onShare: () => void;
  onRank?: () => void;
}

const COLS = 3;
const COLOR_CREAM = 0xfff9f0;
const COLOR_CREAM_DEEP = 0xffecd4;
const COLOR_GOLD_LINE = 0xc9a06b;
const COLOR_GOLD_DARK = 0x8b5a2b;
const COLOR_BLUE = 0x3d8dd4;
const COLOR_BLUE_DEEP = 0x2a6bb0;
export const LEVEL_CLEAR_ACTION_ICONS_TEXTURE_KEY = 'level_clear_action_icons';
export const LEVEL_CLEAR_ACTION_ICONS_ASSET = `${BOWL_IMAGES_ROOT}/level_clear_home_share_icons.png`;
export const BOWL_UNLOCK_PANEL_TEXTURE_KEY = 'bowl_unlock_panel';
export const BOWL_UNLOCK_PANEL_ASSET = `${BOWL_IMAGES_ROOT}/bowl_unlock_panel.png`;
export const BOWL_NEXT_LEVEL_BUTTON_TEXTURE_KEY = 'bowl_next_level_button';
export const BOWL_NEXT_LEVEL_BUTTON_ASSET = `${BOWL_IMAGES_ROOT}/bowl_next_level_button.png`;
export const BOWL_LEVEL_CLEAR_SIDE_ACTION_BUTTON_TEXTURE_KEY = 'bowl_level_clear_side_action_button';
export const BOWL_LEVEL_CLEAR_SIDE_ACTION_BUTTON_ASSET = `${BOWL_IMAGES_ROOT}/bowl_level_clear_side_action_button.png`;

export function mountLevelClearActionIconSprite(
  target: PIXI.Container,
  index: 0 | 1,
  targetSize: number,
): boolean {
  const sheet = TextureCache.get(LEVEL_CLEAR_ACTION_ICONS_TEXTURE_KEY);
  if (!sheet) {
    return false;
  }
  target.removeChildren();
  const cellW = Math.floor(sheet.width / 2);
  const tex = new PIXI.Texture(sheet.baseTexture, new PIXI.Rectangle(cellW * index, 0, cellW, sheet.height));
  const sp = new PIXI.Sprite(tex);
  sp.anchor.set(0.5);
  const sc = targetSize / Math.max(tex.width, tex.height);
  sp.scale.set(sc);
  target.addChild(sp);
  const hitSide = targetSize + 8;
  target.hitArea = new PIXI.Rectangle(-hitSide / 2, -hitSide / 2, hitSide, hitSide);
  return true;
}

/**
 * 过关弹层：参考「解锁新食材」休闲消除类竖版卡片 — 分层圆角面板、标题星光、
 * 食材白边卡片、羊皮纸奖励区、底部房子 / 下一关 / 分享三钮（矢量图标）。
 */
export class BowlLevelClearOverlay extends PIXI.Container {
  private readonly maskGfx: PIXI.Graphics;
  private readonly panelRoot: PIXI.Container;
  private readonly panelShadow: PIXI.Graphics;
  private readonly panelSprite: PIXI.Sprite;
  private readonly panelBody: PIXI.Graphics;
  private readonly panelInner: PIXI.Graphics;
  private readonly titleRoot: PIXI.Container;
  private readonly titleText: PIXI.Text;
  private readonly sparkleLayer: PIXI.Graphics;
  private readonly gridRoot: PIXI.Container;
  private readonly rewardRoot: PIXI.Container;
  private readonly rewardParchment: PIXI.Graphics;
  private readonly rewardTitle: PIXI.Text;
  private readonly rewardMain: PIXI.Text;
  private readonly homeBtn: PIXI.Container;
  private readonly homeActionBg = new PIXI.Sprite(PIXI.Texture.EMPTY);
  private readonly homeIconHost = new PIXI.Container();
  private readonly nextBtn: PIXI.Container;
  private readonly nextSprite: PIXI.Sprite;
  private readonly nextLabel: PIXI.Text;
  private readonly nextSub: PIXI.Text;
  private readonly shareBtn: PIXI.Container;
  private readonly shareActionBg = new PIXI.Sprite(PIXI.Texture.EMPTY);
  private readonly shareIconHost = new PIXI.Container();
  private readonly rankBtn: PIXI.Container;
  private readonly homeHint: PIXI.Text;
  private readonly shareHint: PIXI.Text;

  private panelW = 480;
  private panelH = 520;
  private panelX = 0;
  private panelY = 0;

  private readonly screenW: number;
  private readonly screenH: number;

  private onHome: () => void = () => {};
  private onNextLevel: () => void = () => {};
  private onShare: () => void = () => {};
  private onRank: () => void = () => {};

  constructor(w: number, h: number) {
    super();
    this.screenW = w;
    this.screenH = h;
    this.visible = false;
    this.eventMode = 'static';

    this.maskGfx = new PIXI.Graphics();
    this.maskGfx.beginFill(0x231812, 0.62);
    this.maskGfx.drawRect(0, 0, w, h);
    this.maskGfx.endFill();
    this.maskGfx.eventMode = 'static';
    this.maskGfx.on('pointertap', () => {});
    this.addChild(this.maskGfx);

    this.panelRoot = new PIXI.Container();
    this.addChild(this.panelRoot);

    this.panelShadow = new PIXI.Graphics();
    this.panelRoot.addChild(this.panelShadow);

    this.panelSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this.panelSprite.anchor.set(0.5);
    this.panelSprite.visible = false;
    this.panelRoot.addChild(this.panelSprite);

    this.panelBody = new PIXI.Graphics();
    this.panelRoot.addChild(this.panelBody);

    this.panelInner = new PIXI.Graphics();
    this.panelRoot.addChild(this.panelInner);

    this.titleRoot = new PIXI.Container();
    this.addChild(this.titleRoot);

    this.sparkleLayer = new PIXI.Graphics();
    this.titleRoot.addChild(this.sparkleLayer);

    this.titleText = new PIXI.Text('解锁新食材', {
      fontSize: 34,
      fill: 0xfff2a8,
      fontWeight: '900',
      stroke: 0xb8732c,
      strokeThickness: 5,
      dropShadow: true,
      dropShadowBlur: 4,
      dropShadowDistance: 2,
      dropShadowColor: 0x5c3010,
      lineJoin: 'round',
    });
    this.titleText.anchor.set(0.5);
    this.titleRoot.addChild(this.titleText);

    this.gridRoot = new PIXI.Container();
    this.addChild(this.gridRoot);

    this.rewardRoot = new PIXI.Container();
    this.addChild(this.rewardRoot);

    this.rewardParchment = new PIXI.Graphics();
    this.rewardRoot.addChild(this.rewardParchment);

    this.rewardTitle = new PIXI.Text('获得奖励', {
      fontSize: 18,
      fill: 0xc45c14,
      fontWeight: '800',
      letterSpacing: 2,
    });
    this.rewardTitle.anchor.set(0.5, 0);
    this.rewardRoot.addChild(this.rewardTitle);

    this.rewardMain = new PIXI.Text('通关成功！', {
      fontSize: 24,
      fill: 0x6b3d2c,
      fontWeight: '800',
    });
    this.rewardMain.anchor.set(0.5, 0);
    this.rewardRoot.addChild(this.rewardMain);

    this.homeBtn = BowlLevelClearOverlay.makeSquareActionBtn();
    this.homeActionBg.anchor.set(0.5);
    this.homeActionBg.visible = false;
    this.homeBtn.addChild(this.homeActionBg);
    this.homeBtn.addChild(this.homeIconHost);
    BowlLevelClearOverlay.drawHouseIcon(this.homeIconHost.addChild(new PIXI.Graphics()));
    this.homeBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.onHome();
    });
    this.addChild(this.homeBtn);

    this.homeHint = new PIXI.Text('返回', {
      fontSize: 20,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x087f82,
      strokeThickness: 4,
    });
    this.homeHint.anchor.set(0.5, 0);
    this.addChild(this.homeHint);

    this.nextBtn = new PIXI.Container();
    this.nextBtn.eventMode = 'static';
    this.nextBtn.cursor = 'pointer';
    const nextBg = new PIXI.Graphics();
    this.nextBtn.addChild(nextBg);
    this.nextSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this.nextSprite.anchor.set(0.5);
    this.nextSprite.visible = false;
    this.nextBtn.addChild(this.nextSprite);
    this.nextLabel = new PIXI.Text('下一关', {
      fontSize: 26,
      fill: 0xffffff,
      fontWeight: '900',
      dropShadow: true,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
      dropShadowColor: 0x1a4480,
    });
    this.nextLabel.anchor.set(0.5, 0);
    this.nextBtn.addChild(this.nextLabel);
    this.nextSub = new PIXI.Text('继续闯关', {
      fontSize: 15,
      fill: 0xd9ecff,
      fontWeight: '600',
    });
    this.nextSub.anchor.set(0.5, 0);
    this.nextBtn.addChild(this.nextSub);
    this.nextBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.onNextLevel();
    });
    this.addChild(this.nextBtn);

    this.shareBtn = BowlLevelClearOverlay.makeSquareActionBtn();
    this.shareActionBg.anchor.set(0.5);
    this.shareActionBg.visible = false;
    this.shareBtn.addChild(this.shareActionBg);
    this.shareBtn.addChild(this.shareIconHost);
    BowlLevelClearOverlay.drawShareIcon(this.shareIconHost.addChild(new PIXI.Graphics()));
    this.shareBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.onShare();
    });
    this.addChild(this.shareBtn);

    this.shareHint = new PIXI.Text('分享', {
      fontSize: 20,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x087f82,
      strokeThickness: 4,
    });
    this.shareHint.anchor.set(0.5, 0);
    this.addChild(this.shareHint);

    this.rankBtn = this.createRankButton();
    this.rankBtn.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.onRank();
    });
    this.addChild(this.rankBtn);

    this.redrawSparkles();
  }

  setSkinTextures(
    panelTexture?: PIXI.Texture | null,
    nextButtonTexture?: PIXI.Texture | null,
    sideActionButtonTexture?: PIXI.Texture | null,
  ): void {
    if (panelTexture) {
      this.panelSprite.texture = panelTexture;
      this.panelSprite.visible = true;
    }
    if (nextButtonTexture) {
      this.nextSprite.texture = nextButtonTexture;
      this.nextSprite.visible = true;
    }
    if (sideActionButtonTexture) {
      for (const sprite of [this.homeActionBg, this.shareActionBg]) {
        sprite.texture = sideActionButtonTexture;
        sprite.visible = true;
      }
    }
  }

  private createRankButton(): PIXI.Container {
    const c = new PIXI.Container();
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.hitArea = new PIXI.Rectangle(-72, -24, 144, 48);
    const bg = new PIXI.Graphics();
    bg.beginFill(0xff8a3d, 0.98);
    bg.lineStyle(3, 0xffffff, 0.7);
    bg.drawRoundedRect(-72, -24, 144, 48, 24);
    bg.endFill();
    c.addChild(bg);
    const text = new PIXI.Text('排行榜', {
      fontSize: 22,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x8b3a12,
      strokeThickness: 3,
    });
    text.anchor.set(0.5);
    c.addChild(text);
    return c;
  }

  private static makeSquareActionBtn(): PIXI.Container {
    const c = new PIXI.Container();
    c.eventMode = 'static';
    c.cursor = 'pointer';
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x3d2818, 0.35);
    shadow.drawRoundedRect(-37, -33, 74, 74, 18);
    shadow.endFill();
    c.addChild(shadow);
    const face = new PIXI.Graphics();
    c.addChild(face);
    BowlLevelClearOverlay.drawYellowTile(face);
    return c;
  }

  private mountActionIconSprites(): void {
    mountLevelClearActionIconSprite(this.homeIconHost, 0, 66);
    mountLevelClearActionIconSprite(this.shareIconHost, 1, 66);
  }

  private static drawYellowTile(g: PIXI.Graphics): void {
    g.clear();
    g.lineStyle(4, COLOR_GOLD_DARK, 1);
    g.beginFill(0xffd24a);
    g.drawRoundedRect(-36, -36, 72, 72, 16);
    g.endFill();
    g.lineStyle(0);
    g.beginFill(0xfff4a8, 0.55);
    g.drawRoundedRect(-30, -30, 44, 26, 10);
    g.endFill();
  }

  private static drawHouseIcon(g: PIXI.Graphics): void {
    g.clear();
    g.lineStyle(3.2, COLOR_GOLD_DARK, 1);
    g.beginFill(0xfff6dd);
    g.moveTo(0, -14);
    g.lineTo(-16, 2);
    g.lineTo(16, 2);
    g.closePath();
    g.endFill();
    g.beginFill(0xfff0c8);
    g.drawRoundedRect(-12, 2, 24, 16, 3);
    g.endFill();
    g.lineStyle(2.5, COLOR_GOLD_DARK, 1);
    g.beginFill(0xd4a574);
    g.drawRoundedRect(-3, 8, 6, 10, 1);
    g.endFill();
  }

  private static drawShareIcon(g: PIXI.Graphics): void {
    g.clear();
    g.lineStyle(3, COLOR_GOLD_DARK, 1);
    g.beginFill(0xfff6dd);
    g.drawRoundedRect(-10, -10, 20, 16, 3);
    g.endFill();
    g.lineStyle(3, COLOR_GOLD_DARK, 1);
    g.beginFill(0xffd24a);
    g.moveTo(6, -2);
    g.lineTo(16, -2);
    g.lineTo(12, -10);
    g.closePath();
    g.endFill();
    /** Pixi v7 Graphics 无 stroke()，线段需在 lineStyle 下用 moveTo/lineTo 直接描出 */
    g.lineStyle(2.8, COLOR_GOLD_DARK, 1);
    g.moveTo(-4, -8);
    g.lineTo(-14, -8);
    g.lineTo(-14, 2);
    g.moveTo(4, 8);
    g.lineTo(14, 8);
    g.lineTo(14, -2);
  }

  private redrawSparkles(): void {
    if (this.panelSprite.visible) {
      this.titleRoot.visible = false;
      return;
    }
    this.titleRoot.visible = true;
    const s = this.sparkleLayer;
    s.clear();
    const diamond = (x: number, y: number, r: number, a: number) => {
      s.lineStyle(0);
      s.beginFill(0xfff6c6, a);
      s.drawPolygon([x, y - r, x + r * 0.55, y, x, y + r, x - r * 0.55, y]);
      s.endFill();
    };
    diamond(-148, -8, 10, 0.95);
    diamond(138, 6, 8, 0.88);
    diamond(-118, 14, 6, 0.72);
    diamond(122, -14, 7, 0.78);
    s.lineStyle(0);
    s.beginFill(0xffffff, 0.5);
    s.drawCircle(-162, 4, 2.5);
    s.drawCircle(154, -6, 2);
    s.endFill();
  }

  private redrawPanelSize(pw: number, ph: number): void {
    this.panelW = pw;
    this.panelH = ph;

    this.panelShadow.clear();
    this.panelBody.clear();
    this.panelInner.clear();

    if (this.panelSprite.visible && this.panelSprite.texture.width > 0 && this.panelSprite.texture.height > 0) {
      this.panelSprite.position.set(pw / 2, ph / 2);
      this.panelSprite.width = pw;
      this.panelSprite.height = ph;
      this.panelBody.visible = false;
      this.panelInner.visible = false;
    } else {
      this.panelBody.visible = true;
      this.panelInner.visible = true;
      this.panelShadow.beginFill(0x1a0f08, 0.45);
      this.panelShadow.drawRoundedRect(10, 14, pw, ph, 28);
      this.panelShadow.endFill();

      this.panelBody.lineStyle(5, COLOR_GOLD_LINE, 1);
      this.panelBody.beginFill(COLOR_CREAM);
      this.panelBody.drawRoundedRect(0, 0, pw, ph, 26);
      this.panelBody.endFill();

      const inset = 10;
      this.panelInner.lineStyle(2, 0xffffff, 0.55);
      this.panelInner.beginFill(COLOR_CREAM_DEEP, 0.35);
      this.panelInner.drawRoundedRect(inset, inset, pw - inset * 2, ph - inset * 2, 18);
      this.panelInner.endFill();
    }

    const nextBg = this.nextBtn.getChildAt(0) as PIXI.Graphics;
    nextBg.clear();
    if (this.nextSprite.visible && this.nextSprite.texture.width > 0 && this.nextSprite.texture.height > 0) {
      this.nextSprite.width = 212;
      this.nextSprite.height = 72;
      this.nextLabel.visible = false;
      this.nextSub.visible = false;
      this.nextBtn.hitArea = new PIXI.Rectangle(-106, -36, 212, 72);
    } else {
      this.nextLabel.visible = true;
      this.nextSub.visible = true;
      nextBg.beginFill(COLOR_BLUE_DEEP);
      nextBg.drawRoundedRect(-128, -36, 256, 72, 36);
      nextBg.endFill();
      nextBg.lineStyle(4, 0xffffff, 0.35);
      nextBg.drawRoundedRect(-124, -32, 248, 64, 32);
      nextBg.lineStyle(0);
      nextBg.beginFill(COLOR_BLUE);
      nextBg.drawRoundedRect(-120, -28, 240, 56, 28);
      nextBg.endFill();
    }

    const applySideSkin = (btn: PIXI.Container, sprite: PIXI.Sprite) => {
      if (!sprite.visible || sprite.texture.width <= 0 || sprite.texture.height <= 0) {
        return;
      }
      sprite.width = 66;
      sprite.height = 66;
      btn.getChildAt(0).visible = false;
      btn.getChildAt(1).visible = false;
      btn.hitArea = new PIXI.Rectangle(-38, -38, 76, 76);
    };
    applySideSkin(this.homeBtn, this.homeActionBg);
    applySideSkin(this.shareBtn, this.shareActionBg);
  }

  private redrawRewardParchment(rw: number, rh: number): void {
    const g = this.rewardParchment;
    g.clear();
    g.lineStyle(3, 0x9a7348, 0.85);
    g.beginFill(0xf2dfbd);
    g.drawRoundedRect(0, 0, rw, rh, 14);
    g.endFill();
    g.lineStyle(2, 0xfff2d6, 0.9);
    g.drawRoundedRect(4, 4, rw - 8, rh - 8, 10);
    g.lineStyle(0);
    g.beginFill(0xe8d2a8, 0.45);
    g.drawRect(10, rh - 16, rw - 20, 6);
    g.endFill();
  }

  show(options: BowlLevelClearOverlayOptions): void {
    this.onHome = options.onHome;
    this.onNextLevel = options.onNextLevel;
    this.onShare = options.onShare;
    this.onRank = options.onRank ?? (() => {});
    this.rankBtn.visible = !!options.onRank;

    const w = this.screenW;
    const h = this.screenH;

    const ids = options.newFruitIds;
    const skinUnlocks = options.newSkinUnlocks ?? [];
    const unlockCount = ids.length + skinUnlocks.length;
    const hasPanelSkin = this.panelSprite.visible && this.panelSprite.texture.width > 0;
    const panelMaxW = Math.min(hasPanelSkin ? 540 : 520, Math.floor(w * 0.88));
    const innerW = panelMaxW - (hasPanelSkin ? 72 : 40);

    const gridGap = hasPanelSkin ? 10 : 12;
    let rows: number;
    if (unlockCount === 0) {
      rows = 1;
    } else {
      rows = Math.ceil(unlockCount / COLS);
    }

    const cellW = Math.floor((innerW - gridGap * (COLS - 1)) / COLS);
    const iconBoxH = Math.round(cellW * 0.78);
    const labelH = 26;
    const cellH = iconBoxH + labelH;
    const gridH = rows * cellH + (rows > 0 ? (rows - 1) * 10 : 0);

    const headerH = hasPanelSkin ? 0 : 52;
    const topPad = hasPanelSkin ? 148 : 56;
    const gridTopGap = hasPanelSkin ? 8 : 12;
    /** 面板内：解锁网格底边距「下一关」按钮可视顶部的留白（≥100）—— ph 中与 footY 推导一致时为 footerH - 下一关半高≈76 */
    const footerH = 176;
    const bottomPad = 28;

    const contentDrivenH =
      topPad +
      headerH +
      gridTopGap +
      (unlockCount === 0 ? 48 : gridH) +
      footerH +
      bottomPad;
    const ph = hasPanelSkin
      ? Math.min(Math.floor(h * 0.82), Math.max(contentDrivenH, Math.round(panelMaxW * (994 / 832))))
      : contentDrivenH;

    const pw = panelMaxW;
    this.panelX = Math.round((w - pw) / 2);
    this.panelY = Math.round(h * 0.46 - ph / 2);

    this.panelRoot.position.set(this.panelX, this.panelY);
    this.redrawPanelSize(pw, ph);
    this.redrawSparkles();

    this.titleRoot.position.set(w / 2, this.panelY + topPad + 8);
    this.titleText.text = skinUnlocks.length > 0 || hasPanelSkin ? '解锁新内容' : '解锁新食材';

    this.gridRoot.position.set(this.panelX + (hasPanelSkin ? 46 : 20), this.panelY + topPad + headerH + gridTopGap + (hasPanelSkin ? 28 : 0));

    this.nextLabel.text = options.isLastLevel ? '再来一次' : '下一关';
    this.nextSub.text = options.isLastLevel ? '重温本关' : '继续闯关';
    this.mountActionIconSprites();

    this.rewardRoot.visible = false;

    const footY = this.panelY + ph - (hasPanelSkin ? 78 : bottomPad + 40);
    this.homeBtn.position.set(this.panelX + 82, footY);
    this.nextBtn.position.set(w / 2, footY);
    this.shareBtn.position.set(this.panelX + pw - 82, footY);

    this.homeHint.position.set(this.homeBtn.x, this.homeBtn.y + 21);
    this.shareHint.position.set(this.shareBtn.x, this.shareBtn.y + 21);
    this.rankBtn.position.set(w / 2, footY - 74);

    this.nextLabel.position.set(0, -18);
    this.nextSub.position.set(0, 10);

    this.gridRoot.removeChildren();

    if (unlockCount === 0) {
      const empty = new PIXI.Text('本关无新内容', {
        fontSize: 20,
        fill: 0x7a5c4e,
        fontWeight: '700',
      });
      empty.position.set(innerW / 2 - empty.width / 2, 8);
      this.gridRoot.addChild(empty);
    } else {
      const entries: Array<
        | { type: 'fruit'; id: FruitId; label: string; textureKey: string }
        | { type: 'skin'; kind: BowlSkinUnlock['kind']; label: string; textureKey: string }
      > = [
        ...ids.map((id) => ({
          type: 'fruit' as const,
          id,
          label: FRUIT_MAP[id]?.label ?? id,
          textureKey: id,
        })),
        ...skinUnlocks.map((unlock) => ({
          type: 'skin' as const,
          kind: unlock.kind,
          label: unlock.label,
          textureKey: unlock.textureKey,
        })),
      ];

      entries.forEach((entry, i) => {
        const row = Math.floor(i / COLS);
        const ci = i % COLS;
        const card = new PIXI.Container();
        card.position.set(ci * (cellW + gridGap), row * (cellH + 10));

        const sh = new PIXI.Graphics();
        sh.beginFill(0x6d4350, 0.18);
        sh.drawRoundedRect(3, 4, cellW, iconBoxH + 4, 14);
        sh.endFill();
        card.addChild(sh);

        const bg = new PIXI.Graphics();
        bg.lineStyle(3, 0xffffff, 1);
        bg.beginFill(0xffe8f0);
        bg.drawRoundedRect(0, 0, cellW, iconBoxH, 12);
        bg.endFill();
        bg.lineStyle(2, 0xf5b8cc, 0.9);
        bg.drawRoundedRect(4, 4, cellW - 8, iconBoxH - 8, 8);
        card.addChild(bg);

        const tex = TextureCache.get(entry.textureKey);
        if (tex) {
          const sp = new PIXI.Sprite(tex);
          sp.anchor.set(0.5);
          const maxS = Math.min(cellW, iconBoxH) * (entry.type === 'skin' ? 0.82 : 0.68);
          if (tex.width >= tex.height) {
            sp.width = maxS;
            sp.height = (tex.height / tex.width) * maxS;
          } else {
            sp.height = maxS;
            sp.width = (tex.width / tex.height) * maxS;
          }
          sp.position.set(cellW / 2, iconBoxH / 2 - 2);
          card.addChild(sp);
        }

        if (entry.type === 'skin') {
          const tag = new PIXI.Graphics();
          tag.beginFill(entry.kind === 'soup' ? 0xf39a39 : 0x68a8d8, 0.95);
          tag.drawRoundedRect(8, 8, 54, 22, 11);
          tag.endFill();
          const tagText = new PIXI.Text(entry.kind === 'soup' ? '汤底' : '新碗', {
            fontSize: 14,
            fill: 0xffffff,
            fontWeight: '800',
          });
          tagText.anchor.set(0.5);
          tagText.position.set(35, 19);
          card.addChild(tag, tagText);
        }

        const lab = new PIXI.Text(entry.label, {
          fontSize: 16,
          fill: 0x5a2e20,
          fontWeight: '800',
        });
        lab.anchor.set(0.5, 0);
        lab.position.set(cellW / 2, iconBoxH + 6);
        card.addChild(lab);

        this.gridRoot.addChild(card);
      });
    }

    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }
}
