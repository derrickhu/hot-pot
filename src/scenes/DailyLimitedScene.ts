import * as PIXI from 'pixi.js';
import { getDailyLimitedLevel, type DailyThemeLevelDef } from '@/config/dailyLimitedLevels';
import { FRUIT_MAP, type FruitId } from '@/config/fruits';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import { PersistService } from '@/core/PersistService';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { addCoins } from '@/game/Wallet';
import { CoinBar, COIN_ICON_TEXTURE_KEY, COIN_ICON_TEXTURE_PATH, createCoinIcon } from '@/gameobjects/CoinBar';
import { loadBowlSubpackage } from '@/utils/loadBowlSubpackage';
import { showRewardedAd, warmupRewardedAd } from '@/utils/rewardedAd';
import { TextureCache } from '@/utils/TextureCache';
import { shareGame } from '@/utils/wechatShare';

type DailyToolKind = 'shuffle' | 'undo' | 'lift';
type CardZone = 'stack' | 'lift';

interface CardState {
  id: string;
  fruitId: FruitId;
  columnIndex: number;
  depthIndex: number;
  zone: CardZone;
  removed: boolean;
}

interface ClickHistoryEntry {
  cardId: string;
  prevCollected: number;
  prevCollectedByFruit: Partial<Record<FruitId, number>>;
  prevBuffer: FruitId[];
}

interface ToolButtonView {
  root: PIXI.Container;
  bg?: PIXI.Graphics;
  kind: DailyToolKind;
}

interface DailyLimitedRewardState {
  claimedRecipeDateByTheme: Record<string, string>;
}

const CARD_COLS = 9;
const CARD_W = 70;
const CARD_H = 76;
const CARD_GAP = 8;
const STACK_STEP_Y = 17;
const FLAT_COLS = 9;
const FLAT_ROWS = 3;
const FLAT_CARD_COUNT = FLAT_COLS * FLAT_ROWS;
const ICE_BOWL_COUNT = 5;
const ICE_BOWL_CAPACITY = 3;
const STACK_DISTRACTOR_COPIES = 10;
const DAILY_LIMITED_CLEAR_REWARD_COINS = 50;
const DAILY_LIMITED_REPEAT_CLEAR_REWARD_COINS = 5;
const DAILY_LIMITED_REWARD_STATE_KEY = 'hot_pot_daily_limited_reward_v1';
const DAILY_TEXTURE_PREFIX = 'daily_limited_fruit_';
const DAILY_BG_VARIANTS = [
  {
    key: 'daily_limited_bg_meadow_picnic',
    path: 'subpackages/bowl_game/assets/images/daily_limited/bg_meadow_picnic_v2.png',
  },
  {
    key: 'daily_limited_bg_tropical_orchard',
    path: 'subpackages/bowl_game/assets/images/daily_limited/bg_tropical_orchard_v2.png',
  },
] as const;
const DAILY_BOARD_FRAME_VARIANTS = [
  {
    key: 'daily_limited_frame_wood_material',
    path: 'subpackages/bowl_game/assets/images/daily_limited/frame_wood_material_v4.png',
  },
  {
    key: 'daily_limited_frame_ice_glass_material',
    path: 'subpackages/bowl_game/assets/images/daily_limited/frame_ice_glass_material_v4.png',
  },
] as const;
const DAILY_ICE_BOWL_TEXTURE_KEY = 'daily_limited_ice_bowl_with_ice';
const DAILY_ICE_BOWL_PATH = 'subpackages/bowl_game/assets/images/daily_limited/ice_bowl_with_ice_v1.png';
const DAILY_LIMITED_REWARDED_AD_UNIT_ID = 'adunit-bf1f15914de547fc';
const DAILY_BACK_BUTTON_TEXTURE_KEY = 'daily_limited_back_button';
const DAILY_BACK_BUTTON_PATH = 'subpackages/bowl_game/assets/images/fruit_slice/back_button.png';
const DAILY_TOOL_BUTTONS_TEXTURE_KEY = 'daily_limited_tool_buttons_sheet';
const DAILY_TOOL_BUTTONS_PATH = 'subpackages/bowl_game/assets/images/daily_limited/tool_buttons_sheet_v1.png';
const DAILY_TOOL_PANELS_TEXTURE_KEY = 'daily_limited_tool_panels_sheet';
const DAILY_TOOL_PANELS_PATH = 'subpackages/bowl_game/assets/images/daily_limited/tool_panels_sheet_v1.png';
const DAILY_FREE_BUTTON_TEXTURE_KEY = 'daily_limited_ui_panel_free_btn';
const DAILY_FREE_BUTTON_PATH = 'subpackages/bowl_game/assets/images/ui_panel_free_btn.png';
const DAILY_RECIPE_CARD_TEXTURE_KEY = 'daily_limited_pineapple_sprite_slush_recipe_card';
const DAILY_RECIPE_CARD_PATH = 'subpackages/bowl_game/assets/images/daily_limited/pineapple_sprite_slush_recipe_card_v2.png';
const DAILY_CLEAR_BANNER_TEXTURE_KEY = 'daily_limited_clear_banner';
const DAILY_CLEAR_BANNER_PATH = 'subpackages/bowl_game/assets/images/daily_limited/daily_limited_clear_banner_v1.png';
const DAILY_SHARE_BUTTON_TEXTURE_KEY = 'daily_limited_badge_share_reward_button';
const DAILY_SHARE_BUTTON_PATH = 'subpackages/bowl_game/assets/images/badge_share_reward_button.png';
const DAILY_TOOL_KINDS: readonly DailyToolKind[] = ['shuffle', 'undo', 'lift'];

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const next = items.slice();
  const random = seededRandom(seed);
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function textureKey(fruitId: FruitId): string {
  return `${DAILY_TEXTURE_PREFIX}${fruitId}`;
}

function getLocalDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickDailyVariant<T>(variants: readonly T[], scope: string, themeId: string): T {
  const seed = hashString(`${getLocalDayKey()}|${themeId}|${scope}`);
  return variants[seed % variants.length];
}

export class DailyLimitedScene implements Scene {
  readonly name = 'dailyLimited';
  readonly container = new PIXI.Container();

  private readonly level: DailyThemeLevelDef = getDailyLimitedLevel(0);
  private readonly dailyBackground = pickDailyVariant(DAILY_BG_VARIANTS, 'background', this.level.themeId);
  private readonly dailyBoardFrame = pickDailyVariant(DAILY_BOARD_FRAME_VARIANTS, 'board-frame', this.level.themeId);
  private readonly bgLayer = new PIXI.Container();
  private readonly boardFrameLayer = new PIXI.Container();
  private readonly cardLayer = new PIXI.Container();
  private readonly liftLayer = new PIXI.Container();
  private readonly iceBowlLayer = new PIXI.Container();
  private readonly bufferLayer = new PIXI.Container();
  private readonly toolLayer = new PIXI.Container();
  private readonly overlayLayer = new PIXI.Container();
  private readonly backButtonSprite = new PIXI.Sprite();
  private readonly coinBar = new CoinBar();
  private readonly hintText = new PIXI.Text('', {
    fontSize: 24,
    fill: 0x5d3a1a,
    fontWeight: '700',
    align: 'center',
    wordWrap: true,
    wordWrapWidth: Game.logicWidth - 80,
  });
  private readonly toolViews = new Map<DailyToolKind, ToolButtonView>();
  private readonly cards: CardState[] = [];
  private readonly buffer: FruitId[] = [];
  private readonly history: ClickHistoryEntry[] = [];
  private toolCounts: Record<DailyToolKind, number> = { shuffle: 0, undo: 0, lift: 0 };
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;
  private collected = 0;
  private collectedByFruit: Partial<Record<FruitId, number>> = {};
  private roundStarted = false;
  private roundEnded = false;
  private clearRewardGranted = false;
  private lastClearRewardCoins = DAILY_LIMITED_CLEAR_REWARD_COINS;
  private lastClearRewardWasFirstToday = true;
  private bufferMatchResolving = false;
  private animatingBufferMatchIndexes: readonly number[] = [];
  private extraBufferSlotUnlocked = false;
  private unlockBufferAdBusy = false;
  private toolRewardedAdBusy = false;
  private nextLiftCardId = 1;

  constructor() {
    this.buildStaticUi();
  }

  async prepare(): Promise<void> {
    if (this.loaded) {
      return;
    }
    if (!this.loadingPromise) {
      this.loadingPromise = this.preloadAssets();
    }
    await this.loadingPromise;
  }

  onEnter(): void {
    warmupRewardedAd(DAILY_LIMITED_REWARDED_AD_UNIT_ID);
    void this.prepare().then(() => {
      this.applyBackground();
      this.renderMainBoardFrame();
      if (!this.roundStarted || this.roundEnded) {
        this.startRound();
      } else {
        this.renderAll();
      }
    });
  }

  private async preloadAssets(): Promise<void> {
    await loadBowlSubpackage();
    await Promise.all([
      TextureCache.load(this.dailyBackground.key, this.dailyBackground.path),
      TextureCache.load(this.dailyBoardFrame.key, this.dailyBoardFrame.path),
      TextureCache.load(DAILY_ICE_BOWL_TEXTURE_KEY, DAILY_ICE_BOWL_PATH),
      TextureCache.load(DAILY_BACK_BUTTON_TEXTURE_KEY, DAILY_BACK_BUTTON_PATH),
      TextureCache.load(DAILY_TOOL_BUTTONS_TEXTURE_KEY, DAILY_TOOL_BUTTONS_PATH),
      TextureCache.load(DAILY_TOOL_PANELS_TEXTURE_KEY, DAILY_TOOL_PANELS_PATH),
      TextureCache.load(DAILY_FREE_BUTTON_TEXTURE_KEY, DAILY_FREE_BUTTON_PATH),
      TextureCache.load(DAILY_RECIPE_CARD_TEXTURE_KEY, DAILY_RECIPE_CARD_PATH),
      TextureCache.load(DAILY_CLEAR_BANNER_TEXTURE_KEY, DAILY_CLEAR_BANNER_PATH),
      TextureCache.load(DAILY_SHARE_BUTTON_TEXTURE_KEY, DAILY_SHARE_BUTTON_PATH),
      TextureCache.load(COIN_ICON_TEXTURE_KEY, COIN_ICON_TEXTURE_PATH),
      ...this.level.fruitIds.map((fruitId) => {
        const fruit = FRUIT_MAP[fruitId];
        return TextureCache.load(textureKey(fruitId), fruit.asset);
      }),
    ]);
    this.loaded = true;
    this.applyBackground();
    this.renderMainBoardFrame();
    this.applyBackButtonTexture();
    this.coinBar.refreshIcon();
    this.mountToolButtons();
  }

  private buildStaticUi(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const top = Game.safeTop;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xb7edff);
    bg.drawRect(0, 0, W, H);
    bg.endFill();
    bg.beginFill(0x7ed957, 0.55);
    bg.drawEllipse(W * 0.5, H + 120, W * 0.75, H * 0.42);
    bg.endFill();
    this.bgLayer.addChild(bg);
    this.container.addChild(this.bgLayer);

    this.backButtonSprite.anchor.set(0.5);
    this.backButtonSprite.eventMode = 'static';
    this.backButtonSprite.cursor = 'pointer';
    this.layoutBackButton();
    this.backButtonSprite.on('pointertap', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('home');
    });
    this.container.addChild(this.backButtonSprite);

    this.coinBar.position.set(110, top + 28);
    this.container.addChild(this.coinBar);
    this.coinBar.refresh();

    const gmClear = this.createPillButton('GM通关', 132, 48, 0xff7f50, 0x9d3b20);
    gmClear.position.set(W - 94, top + 104);
    gmClear.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.completeRoundByGm();
    });
    this.container.addChild(gmClear);

    const title = new PIXI.Text(this.level.themeName, {
      fontSize: 44,
      fill: 0xfff3b1,
      fontWeight: '900',
      stroke: 0x235a7a,
      strokeThickness: 7,
      lineJoin: 'round',
    });
    title.anchor.set(0.5);
    title.resolution = 2;
    title.position.set(W / 2, top + 56);
    this.container.addChild(title);

    this.hintText.text = this.level.positioningText;
    this.hintText.anchor.set(0.5);
    this.hintText.resolution = 2;
    this.hintText.position.set(W / 2, top + 108);
    this.container.addChild(this.hintText);

    const boardTop = this.boardTop();
    const boardH = this.boardHeight();
    this.container.addChild(this.boardFrameLayer);
    this.renderMainBoardFrame();

    this.container.addChild(this.cardLayer);
    this.container.addChild(this.iceBowlLayer);
    this.container.addChild(this.liftLayer);
    this.container.addChild(this.bufferLayer);
    this.container.addChild(this.toolLayer);
    this.container.addChild(this.overlayLayer);

    this.mountToolButtons();
  }

  private applyBackground(): void {
    const tex = TextureCache.get(this.dailyBackground.key);
    if (!tex) {
      return;
    }

    const W = Game.logicWidth;
    const H = Game.logicHeight;
    this.bgLayer.removeChildren();
    const sp = new PIXI.Sprite(tex);
    const scale = Math.max(W / tex.width, H / tex.height);
    sp.scale.set(scale);
    sp.position.set((W - tex.width * scale) / 2, (H - tex.height * scale) / 2);
    this.bgLayer.addChild(sp);
  }

  private applyBackButtonTexture(): void {
    const tex = TextureCache.get(DAILY_BACK_BUTTON_TEXTURE_KEY);
    if (!tex) {
      return;
    }
    this.backButtonSprite.texture = tex;
    this.layoutBackButton();
  }

  private layoutBackButton(): void {
    const tex = this.backButtonSprite.texture;
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return;
    }
    const target = 54;
    const scale = target / Math.max(1, Math.max(tex.width, tex.height));
    this.backButtonSprite.scale.set(scale);
    this.backButtonSprite.position.set(58, Game.safeTop + 28);
    this.backButtonSprite.hitArea = new PIXI.Circle(0, 0, 38 / Math.max(0.01, scale));
  }

  private renderMainBoardFrame(): void {
    this.boardFrameLayer.removeChildren();
    const frame = this.createBoardFrameView(-2, this.boardTop() - 4, Game.logicWidth + 4, this.boardHeight() + 8);
    this.boardFrameLayer.addChild(frame);
  }

  private createBoardFrameView(x: number, y: number, width: number, height: number): PIXI.DisplayObject {
    const tex = TextureCache.get(this.dailyBoardFrame.key);
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.position.set(x, y);
      sp.width = width;
      sp.height = height;
      return sp;
    }

    const board = new PIXI.Graphics();
    board.beginFill(0x83dd5f);
    board.lineStyle(8, 0x3ea43f, 1);
    board.drawRoundedRect(x, y, width, height, 28);
    board.endFill();
    board.beginFill(0xf6ffe6, 0.88);
    board.lineStyle(3, 0x4d8f34, 0.9);
    board.drawRoundedRect(x + 18, y + 24, width - 36, height - 48, 18);
    board.endFill();
    return board;
  }

  private startRound(): void {
    this.roundStarted = true;
    this.roundEnded = false;
    this.clearRewardGranted = false;
    this.lastClearRewardCoins = DAILY_LIMITED_CLEAR_REWARD_COINS;
    this.lastClearRewardWasFirstToday = true;
    this.collected = 0;
    this.collectedByFruit = {};
    this.nextLiftCardId = 1;
    this.bufferMatchResolving = false;
    this.animatingBufferMatchIndexes = [];
    this.extraBufferSlotUnlocked = false;
    this.unlockBufferAdBusy = false;
    this.toolRewardedAdBusy = false;
    this.cards.length = 0;
    this.buffer.length = 0;
    this.history.length = 0;
    this.overlayLayer.removeChildren();
    this.toolCounts = {
      shuffle: this.level.toolCounts.shuffle,
      undo: this.level.toolCounts.undo,
      lift: this.level.toolCounts.lift,
    };

    const deal = this.generateCardDeal();
    const allCards = [
      ...deal.flat.map((fruitId) => ({ fruitId, zone: 'lift' as const })),
      ...deal.stack.map((fruitId) => ({ fruitId, zone: 'stack' as const })),
    ];
    allCards.forEach((entry, index) => {
      const isFlatCard = entry.zone === 'lift';
      const localIndex = isFlatCard ? index : index - deal.flat.length;
      const cols = isFlatCard ? FLAT_COLS : CARD_COLS;
      const columnIndex = localIndex % cols;
      const depthIndex = Math.floor(localIndex / cols);
      this.cards.push({
        id: `${isFlatCard ? 'flat' : 'stack'}_${index}`,
        fruitId: entry.fruitId,
        columnIndex,
        depthIndex,
        zone: entry.zone,
        removed: false,
      });
    });

    this.renderAll();
  }

  private generateCardDeal(): { flat: FruitId[]; stack: FruitId[] } {
    const targetSet = new Set<FruitId>(this.level.targetFruitIds);
    const flatPool: FruitId[] = [];
    const stackCards: FruitId[] = [];
    const primaryTarget = this.level.targetFruitIds[0];
    for (let i = 0; i < this.level.targetCopies; i += 1) {
      stackCards.push(primaryTarget);
    }
    for (const fruitId of this.level.fruitIds) {
      if (targetSet.has(fruitId)) {
        continue;
      }
      flatPool.push(fruitId, fruitId, fruitId);
      for (let i = 0; i < STACK_DISTRACTOR_COPIES; i += 1) {
        stackCards.push(fruitId);
      }
    }
    return {
      flat: shuffleWithSeed(flatPool, this.level.layoutSeed + 17).slice(0, FLAT_CARD_COUNT),
      stack: shuffleWithSeed(stackCards, this.level.layoutSeed + 31),
    };
  }

  private renderAll(): void {
    this.renderCards();
    this.renderLiftCards();
    this.renderIceBowls();
    this.renderBuffer();
    this.updateToolButtons();
  }

  private renderCards(): void {
    this.cardLayer.removeChildren();
    const boardTop = this.boardTop();
    const startX = Math.round((Game.logicWidth - (CARD_COLS * CARD_W + (CARD_COLS - 1) * CARD_GAP)) / 2);
    for (let col = 0; col < CARD_COLS; col += 1) {
      const topCard = this.topStackCard(col);
      const cards = this.cards
        .filter((card) => card.zone === 'stack' && card.columnIndex === col && !card.removed)
        .sort((a, b) => a.depthIndex - b.depthIndex);
      for (const card of cards) {
        const x = startX + col * (CARD_W + CARD_GAP);
        const y = boardTop + 42 + card.depthIndex * STACK_STEP_Y;
        const view = this.createCardView(card, topCard?.id === card.id);
        view.position.set(x, y);
        this.cardLayer.addChild(view);
      }
    }
  }

  private renderLiftCards(): void {
    this.liftLayer.removeChildren();
    const lifted = this.cards
      .filter((card) => card.zone === 'lift' && !card.removed)
      .sort((a, b) => (a.depthIndex - b.depthIndex) || (a.columnIndex - b.columnIndex));

    const y = this.flatAreaY();
    const rowCount = Math.max(
      FLAT_ROWS,
      lifted.reduce((maxRow, card) => Math.max(maxRow, card.depthIndex + 1), 0),
    );
    const panelW = FLAT_COLS * CARD_W + (FLAT_COLS - 1) * CARD_GAP + 30;
    const panelH = rowCount * CARD_H + (rowCount - 1) * 8 + 30;
    const panel = new PIXI.Graphics();
    const panelX = (Game.logicWidth - panelW) / 2;
    const panelY = y - 15;
    panel.beginFill(0xfffdf3, 0.58);
    panel.lineStyle(2, 0x9ec872, 0.85);
    panel.drawRoundedRect(panelX, panelY, panelW, panelH, 16);
    panel.endFill();
    this.liftLayer.addChild(panel);

    const totalW = FLAT_COLS * CARD_W + (FLAT_COLS - 1) * CARD_GAP;
    const startX = Math.round((Game.logicWidth - totalW) / 2);
    lifted.forEach((card) => {
      const view = this.createCardView(card, true);
      view.position.set(
        startX + card.columnIndex * (CARD_W + CARD_GAP),
        y + card.depthIndex * (CARD_H + 8),
      );
      this.liftLayer.addChild(view);
    });
  }

  private renderBuffer(): void {
    this.bufferLayer.removeChildren();
    const W = Game.logicWidth;
    const slotSize = 76;
    const gap = 8;
    const totalSlots = this.level.bufferSize + 1;
    const totalW = totalSlots * slotSize + (totalSlots - 1) * gap;
    const startX = Math.round((W - totalW) / 2);
    const y = this.bufferY();

    const strip = new PIXI.Graphics();
    strip.beginFill(0x7a4e42, 0.95);
    strip.drawRoundedRect(startX - 18, y - 18, totalW + 36, slotSize + 36, 28);
    strip.endFill();
    this.bufferLayer.addChild(strip);

    for (let i = 0; i < totalSlots; i += 1) {
      const x = startX + i * (slotSize + gap);
      const locked = i >= this.activeBufferSize();
      const slot = new PIXI.Graphics();
      slot.beginFill(locked ? 0xd8c4b0 : 0xf6dfc6, locked ? 0.82 : 0.96);
      slot.lineStyle(3, 0xfaf0df, locked ? 0.55 : 0.82);
      slot.drawRoundedRect(x, y, slotSize, slotSize, 12);
      slot.endFill();
      this.bufferLayer.addChild(slot);

      const fruitId = this.buffer[i];
      const isMatching = this.animatingBufferMatchIndexes.includes(i);
      if (fruitId && !isMatching) {
        const icon = this.createFruitIcon(fruitId, 56);
        icon.position.set(x + slotSize / 2, y + slotSize / 2);
        this.bufferLayer.addChild(icon);
      }

      if (locked) {
        const lock = this.createLockedBufferSlot(x, y, slotSize);
        this.bufferLayer.addChild(lock);
      }
    }
  }

  private createLockedBufferSlot(x: number, y: number, size: number): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = this.unlockBufferAdBusy ? 'none' : 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(x, y, size, size);
    root.on('pointertap', () => {
      AudioManager.playButtonSound();
      void this.unlockExtraBufferSlotByAd();
    });

    const mask = new PIXI.Graphics();
    mask.beginFill(0x4b3428, 0.48);
    mask.drawRoundedRect(x, y, size, size, 12);
    mask.endFill();
    root.addChild(mask);

    const label = new PIXI.Text(this.unlockBufferAdBusy ? '广告中' : '解锁', {
      fontSize: 20,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x5a351f,
      strokeThickness: 4,
      align: 'center',
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    label.position.set(x + size / 2, y + size / 2 - 10);
    root.addChild(label);

    const video = new PIXI.Text('▶', {
      fontSize: 20,
      fill: 0xfff2a7,
      fontWeight: '900',
      stroke: 0x5a351f,
      strokeThickness: 3,
    });
    video.anchor.set(0.5);
    video.resolution = 2;
    video.position.set(x + size / 2, y + size / 2 + 18);
    root.addChild(video);
    return root;
  }

  private bufferSlotCenter(index: number): { x: number; y: number } {
    const W = Game.logicWidth;
    const slotSize = 76;
    const gap = 8;
    const totalSlots = this.level.bufferSize + 1;
    const totalW = totalSlots * slotSize + (totalSlots - 1) * gap;
    const startX = Math.round((W - totalW) / 2);
    const y = this.bufferY();
    return {
      x: startX + index * (slotSize + gap) + slotSize / 2,
      y: y + slotSize / 2,
    };
  }

  private createCardView(card: CardState, clickable: boolean): PIXI.Container {
    const root = new PIXI.Container();

    const lift = new PIXI.Graphics();
    lift.beginFill(0x31551d, 0.18);
    lift.drawRoundedRect(1.5, 2.5, CARD_W - 1, CARD_H - 1, 8);
    lift.endFill();
    root.addChild(lift);

    const cardBg = new PIXI.Graphics();
    cardBg.beginFill(0xfff8df, 1);
    cardBg.lineStyle(2, 0x4f8c2e, 1);
    cardBg.drawRoundedRect(0.5, 0.5, CARD_W - 2, CARD_H - 2, 8);
    cardBg.endFill();
    cardBg.lineStyle(1, 0xffffff, 0.75);
    cardBg.moveTo(8, 6);
    cardBg.lineTo(CARD_W - 8, 6);
    cardBg.lineStyle(1, 0xd9d49b, 0.6);
    cardBg.moveTo(8, CARD_H - 7);
    cardBg.lineTo(CARD_W - 8, CARD_H - 7);
    root.addChild(cardBg);

    const icon = this.createFruitIcon(card.fruitId, 55);
    icon.position.set(CARD_W / 2, CARD_H / 2 + 1);
    root.addChild(icon);

    if (clickable) {
      root.eventMode = 'static';
      root.cursor = 'pointer';
      root.hitArea = new PIXI.Rectangle(0, 0, CARD_W, CARD_H);
      root.on('pointertap', () => {
        AudioManager.playButtonSound();
        this.onCardTap(card.id);
      });
    }
    return root;
  }

  private createFruitIcon(fruitId: FruitId, size: number): PIXI.Container {
    const root = new PIXI.Container();
    const tex = TextureCache.get(textureKey(fruitId));
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.scale.set(size / Math.max(tex.width, tex.height));
      root.addChild(sp);
      return root;
    }

    const fallback = new PIXI.Graphics();
    fallback.beginFill(FRUIT_MAP[fruitId].color);
    fallback.drawCircle(0, 0, size / 2);
    fallback.endFill();
    root.addChild(fallback);
    const label = new PIXI.Text(FRUIT_MAP[fruitId].label.slice(0, 1), {
      fontSize: Math.round(size * 0.42),
      fill: 0xffffff,
      fontWeight: '900',
    });
    label.anchor.set(0.5);
    label.resolution = 2;
    root.addChild(label);
    return root;
  }

  private onCardTap(cardId: string): void {
    if (this.roundEnded || this.bufferMatchResolving) {
      return;
    }
    const card = this.cards.find((item) => item.id === cardId);
    if (!card || card.removed) {
      return;
    }
    if (card.zone === 'stack' && this.topStackCard(card.columnIndex)?.id !== card.id) {
      return;
    }

    this.history.push({
      cardId,
      prevCollected: this.collected,
      prevCollectedByFruit: { ...this.collectedByFruit },
      prevBuffer: this.buffer.slice(),
    });
    card.removed = true;

    if (this.isTargetFruit(card.fruitId)) {
      this.collected += 1;
      this.collectedByFruit[card.fruitId] = (this.collectedByFruit[card.fruitId] ?? 0) + 1;
      AudioManager.playScoopSound();
      if (this.collected >= this.level.targetCount) {
        this.renderAll();
        this.finishRound(true);
        return;
      }
    } else {
      if (this.buffer.length >= this.activeBufferSize()) {
        this.finishRound(false);
        return;
      }
      this.buffer.push(card.fruitId);
      const matchIndexes = this.findBufferMatchIndexes();
      this.renderAll();
      if (matchIndexes) {
        this.scheduleBufferMatchResolve(matchIndexes);
      }
      return;
    }

    this.renderAll();
  }

  private findBufferMatchIndexes(): number[] | null {
    const counts = new Map<FruitId, number>();
    for (const fruitId of this.buffer) {
      counts.set(fruitId, (counts.get(fruitId) ?? 0) + 1);
    }
    for (const [fruitId, count] of counts) {
      if (count >= 3) {
        const indexes: number[] = [];
        for (let i = this.buffer.length - 1; i >= 0; i -= 1) {
          if (this.buffer[i] === fruitId) {
            indexes.push(i);
          }
          if (indexes.length >= 3) {
            break;
          }
        }
        return indexes;
      }
    }
    return null;
  }

  private scheduleBufferMatchResolve(matchIndexes: readonly number[]): void {
    this.bufferMatchResolving = true;
    window.setTimeout(() => {
      this.playBufferMatchAnimation(matchIndexes);
    }, 220);
  }

  private playBufferMatchAnimation(matchIndexes: readonly number[]): void {
    this.animatingBufferMatchIndexes = matchIndexes;
    this.renderBuffer();

    const fxLayer = new PIXI.Container();
    this.overlayLayer.addChild(fxLayer);

    const starOffsets: ReadonlyArray<readonly [number, number]> = [
      [-28, -24],
      [26, -20],
      [4, 28],
    ];

    const items = matchIndexes.map((bufferIndex) => {
      const center = this.bufferSlotCenter(bufferIndex);
      const fruitId = this.buffer[bufferIndex];
      const iconHolder = new PIXI.Container();
      iconHolder.position.set(center.x, center.y);
      const icon = fruitId ? this.createFruitIcon(fruitId, 56) : null;
      if (icon) {
        iconHolder.addChild(icon);
      }
      fxLayer.addChild(iconHolder);

      const stars = starOffsets.map(([dx, dy]) => {
        const star = new PIXI.Text('✦', {
          fontSize: 32,
          fill: 0xfff8c7,
          fontWeight: '900',
          stroke: 0xb56a18,
          strokeThickness: 3,
        });
        star.anchor.set(0.5);
        star.resolution = 2;
        star.position.set(center.x + dx, center.y + dy);
        star.scale.set(0.4);
        star.alpha = 0;
        fxLayer.addChild(star);
        return { sprite: star, dx, dy, baseX: center.x, baseY: center.y };
      });

      return { iconHolder, stars };
    });

    AudioManager.playOrderCompleteSound();

    const duration = 540;
    const start = performance.now();

    const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

    const tick = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / duration);

      const growT = Math.min(progress / 0.35, 1);
      const fadeT = Math.max(0, (progress - 0.35) / 0.65);
      const iconScale = 1 + easeOut(growT) * 0.55;
      const iconAlpha = 1 - fadeT;

      const starInT = Math.min(progress / 0.2, 1);
      const starOutT = Math.max(0, (progress - 0.4) / 0.6);
      const starScale = 0.5 + easeOut(starInT) * 0.7;
      const starAlpha = Math.max(0, Math.min(1, starInT) - starOutT);
      const starSpread = 1 + easeOut(progress) * 0.7;

      for (const item of items) {
        item.iconHolder.scale.set(iconScale);
        item.iconHolder.alpha = iconAlpha;
        for (const star of item.stars) {
          star.sprite.position.set(star.baseX + star.dx * starSpread, star.baseY + star.dy * starSpread);
          star.sprite.scale.set(starScale);
          star.sprite.alpha = starAlpha;
          star.sprite.rotation += 0.06;
        }
      }

      if (progress >= 1) {
        PIXI.Ticker.shared.remove(tick);
        if (fxLayer.parent) {
          fxLayer.parent.removeChild(fxLayer);
        }
        fxLayer.destroy({ children: true });

        const sortedIndexes = [...matchIndexes].sort((a, b) => b - a);
        for (const index of sortedIndexes) {
          if (index >= 0 && index < this.buffer.length) {
            this.buffer.splice(index, 1);
          }
        }
        this.animatingBufferMatchIndexes = [];
        this.bufferMatchResolving = false;
        this.renderAll();
      }
    };

    PIXI.Ticker.shared.add(tick);
  }

  private finishRound(success: boolean): void {
    this.roundEnded = true;
    if (success) {
      if (!this.clearRewardGranted) {
        this.clearRewardGranted = true;
        const firstToday = this.claimDailyFirstClearRewardIfNeeded();
        const rewardCoins = firstToday ? DAILY_LIMITED_CLEAR_REWARD_COINS : DAILY_LIMITED_REPEAT_CLEAR_REWARD_COINS;
        this.lastClearRewardWasFirstToday = firstToday;
        this.lastClearRewardCoins = rewardCoins;
        addCoins(rewardCoins);
        this.coinBar.refresh();
        this.coinBar.bump();
      }
      AudioManager.playBadgeUnlockSound();
    } else {
      AudioManager.playBufferPanicSound();
    }
    this.showResultOverlay(success);
  }

  private readDailyRewardState(): DailyLimitedRewardState {
    const stored = PersistService.readJSON<Partial<DailyLimitedRewardState>>(DAILY_LIMITED_REWARD_STATE_KEY);
    return {
      claimedRecipeDateByTheme: {
        ...(stored?.claimedRecipeDateByTheme ?? {}),
      },
    };
  }

  private writeDailyRewardState(state: DailyLimitedRewardState): void {
    PersistService.writeJSON(DAILY_LIMITED_REWARD_STATE_KEY, {
      claimedRecipeDateByTheme: { ...state.claimedRecipeDateByTheme },
    });
  }

  private claimDailyFirstClearRewardIfNeeded(): boolean {
    const today = getLocalDayKey();
    const state = this.readDailyRewardState();
    if (state.claimedRecipeDateByTheme[this.level.themeId] === today) {
      return false;
    }
    state.claimedRecipeDateByTheme[this.level.themeId] = today;
    this.writeDailyRewardState(state);
    return true;
  }

  private completeRoundByGm(): void {
    if (this.roundEnded) {
      return;
    }
    this.bufferMatchResolving = false;
    this.animatingBufferMatchIndexes = [];
    this.collected = this.level.targetCount;
    this.collectedByFruit = {};
    let remaining = this.level.targetCount;
    this.level.targetFruitIds.forEach((fruitId, index) => {
      const slotsLeft = this.level.targetFruitIds.length - index;
      const count = index === this.level.targetFruitIds.length - 1 ? remaining : Math.ceil(remaining / slotsLeft);
      this.collectedByFruit[fruitId] = count;
      remaining -= count;
    });
    this.renderAll();
    this.finishRound(true);
  }

  private topStackCard(columnIndex: number): CardState | null {
    let top: CardState | null = null;
    for (const card of this.cards) {
      if (card.zone !== 'stack' || card.columnIndex !== columnIndex || card.removed) {
        continue;
      }
      if (!top || card.depthIndex > top.depthIndex) {
        top = card;
      }
    }
    return top;
  }

  private isTargetFruit(fruitId: FruitId): boolean {
    return this.level.targetFruitIds.includes(fruitId);
  }

  private activeBufferSize(): number {
    return this.level.bufferSize + (this.extraBufferSlotUnlocked ? 1 : 0);
  }

  private async unlockExtraBufferSlotByAd(): Promise<void> {
    if (this.extraBufferSlotUnlocked || this.unlockBufferAdBusy) {
      return;
    }
    this.unlockBufferAdBusy = true;
    this.renderBuffer();
    try {
      const result = await showRewardedAd({
        scene: 'daily_limited_unlock_buffer_slot',
        levelId: this.level.themeId,
      }, DAILY_LIMITED_REWARDED_AD_UNIT_ID);
      if (result === 'completed' || result === 'unavailable') {
        this.extraBufferSlotUnlocked = true;
        this.toast(result === 'completed' ? '已解锁额外格子' : '广告不可用，已临时解锁');
      } else if (result === 'skipped') {
        this.toast('看完广告才能解锁');
      } else {
        this.toast('广告加载失败，请稍后再试');
      }
    } finally {
      this.unlockBufferAdBusy = false;
      this.renderBuffer();
    }
  }

  private useTool(kind: DailyToolKind): void {
    if (this.roundEnded || this.bufferMatchResolving || this.toolCounts[kind] <= 0 || this.toolRewardedAdBusy) {
      return;
    }
    this.showToolHelpPanel(kind);
  }

  private async useToolWithRewardedAd(kind: DailyToolKind): Promise<void> {
    if (this.roundEnded || this.bufferMatchResolving || this.toolCounts[kind] <= 0 || this.toolRewardedAdBusy) {
      return;
    }
    this.toolRewardedAdBusy = true;
    try {
      const result = await showRewardedAd({
        scene: `daily_limited_tool_${kind}`,
        levelId: this.level.themeId,
      }, DAILY_LIMITED_REWARDED_AD_UNIT_ID);
      if (result !== 'completed' && result !== 'unavailable') {
        this.toast(result === 'skipped' ? '看完广告才能使用道具' : '广告加载失败，请稍后再试');
        return;
      }
      if (kind === 'shuffle') {
        this.shuffleRemainingCards();
      } else if (kind === 'undo') {
        this.undoLastClick();
      } else {
        this.liftBufferCards();
      }
    } finally {
      this.toolRewardedAdBusy = false;
    }
  }

  private showToolHelpPanel(kind: DailyToolKind): void {
    const sheet = TextureCache.get(DAILY_TOOL_PANELS_TEXTURE_KEY);
    if (!sheet) {
      void this.useToolWithRewardedAd(kind);
      return;
    }

    const panelIndex = DAILY_TOOL_KINDS.indexOf(kind);
    if (panelIndex < 0) {
      return;
    }

    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const overlay = new PIXI.Container();
    overlay.eventMode = 'static';

    const dim = new PIXI.Graphics();
    dim.beginFill(0x1a1510, 0.56);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    dim.eventMode = 'static';
    dim.cursor = 'pointer';
    dim.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.overlayLayer.removeChild(overlay);
      overlay.destroy({ children: true });
    });
    overlay.addChild(dim);

    const colW = Math.floor(sheet.width / 3);
    const x0 = panelIndex * colW;
    const frameW = panelIndex === 2 ? sheet.width - colW * 2 : colW;
    const frame = new PIXI.Texture(sheet.baseTexture, new PIXI.Rectangle(x0, 0, frameW, sheet.height));
    const panel = new PIXI.Container();
    panel.position.set(W / 2, H * 0.46);
    panel.eventMode = 'static';
    panel.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    overlay.addChild(panel);

    const sprite = new PIXI.Sprite(frame);
    sprite.anchor.set(0.5);
    const sc = Math.min((W * 0.88) / frameW, (H * 0.66) / sheet.height, 1.25);
    sprite.scale.set(sc);
    panel.addChild(sprite);

    const panelHalfH = (sheet.height * sc) / 2;
    const action = this.createAdActionButton();
    action.position.set(0, panelHalfH - 128);
    action.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.playButtonSound();
      this.overlayLayer.removeChild(overlay);
      overlay.destroy({ children: true });
      void this.useToolWithRewardedAd(kind);
    });
    panel.addChild(action);

    const limit = this.level.toolCounts[kind];
    const used = Math.max(0, limit - this.toolCounts[kind]);
    const usageText = new PIXI.Text(`每局限使用${limit}次，当前${used}/${limit}`, {
      fontSize: 24,
      fill: used >= limit ? 0xd94b33 : 0x7a3d16,
      fontWeight: '800',
      stroke: 0xfffff2,
      strokeThickness: 4,
    });
    usageText.anchor.set(0.5);
    usageText.resolution = 2;
    usageText.position.set(0, panelHalfH - 62);
    panel.addChild(usageText);

    this.overlayLayer.addChild(overlay);
  }

  private createAdActionButton(): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    const tex = TextureCache.get(DAILY_FREE_BUTTON_TEXTURE_KEY);
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const sc = Math.min(1, 300 / tex.width, 92 / tex.height);
      sp.scale.set(sc);
      root.hitArea = new PIXI.Rectangle((-tex.width * sc) / 2, (-tex.height * sc) / 2, tex.width * sc, tex.height * sc);
      root.addChild(sp);
      return root;
    }
    return this.createPillButton('观看广告', 230, 70, 0x65c7f7, 0x2d6f9f);
  }

  private shuffleRemainingCards(): void {
    const remaining = this.cards.filter((card) => !card.removed);
    if (remaining.length < 2) {
      return;
    }
    const fruitIds = shuffleWithSeed(
      remaining.map((card) => card.fruitId),
      Date.now() % 100000,
    );
    remaining.forEach((card, index) => {
      card.fruitId = fruitIds[index];
    });
    this.toolCounts.shuffle -= 1;
    AudioManager.playOrderCompleteSound();
    this.renderAll();
  }

  private undoLastClick(): void {
    const last = this.history.pop();
    if (!last) {
      return;
    }
    const card = this.cards.find((item) => item.id === last.cardId);
    if (!card) {
      return;
    }
    card.removed = false;
    this.collected = last.prevCollected;
    this.collectedByFruit = { ...last.prevCollectedByFruit };
    this.buffer.splice(0, this.buffer.length, ...last.prevBuffer);
    this.toolCounts.undo -= 1;
    this.roundEnded = false;
    AudioManager.playOrderCompleteSound();
    this.renderAll();
  }

  private liftBufferCards(): void {
    if (this.buffer.length <= 0) {
      return;
    }
    const lifted = this.buffer.splice(Math.max(0, this.buffer.length - 3));
    lifted.forEach((fruitId) => {
      const slot = this.findFlatEmptySlot();
      this.cards.push({
        id: `lift_${this.nextLiftCardId}`,
        fruitId,
        columnIndex: slot.columnIndex,
        depthIndex: slot.depthIndex,
        zone: 'lift',
        removed: false,
      });
      this.nextLiftCardId += 1;
    });
    this.toolCounts.lift -= 1;
    AudioManager.playOrderCompleteSound();
    this.renderAll();
  }

  private findFlatEmptySlot(): { columnIndex: number; depthIndex: number } {
    const occupied = new Set(
      this.cards
        .filter((card) => card.zone === 'lift' && !card.removed)
        .map((card) => `${card.depthIndex}:${card.columnIndex}`),
    );
    for (let row = 0; row < FLAT_ROWS + 4; row += 1) {
      for (let col = 0; col < FLAT_COLS; col += 1) {
        const key = `${row}:${col}`;
        if (!occupied.has(key)) {
          return { columnIndex: col, depthIndex: row };
        }
      }
    }
    const fallbackIndex = this.cards.filter((card) => card.zone === 'lift').length;
    return {
      columnIndex: fallbackIndex % FLAT_COLS,
      depthIndex: Math.floor(fallbackIndex / FLAT_COLS),
    };
  }

  private mountToolButtons(): void {
    this.toolLayer.removeChildren();
    this.toolViews.clear();
    const buttons: Array<{ kind: DailyToolKind; label: string; icon: string }> = [
      { kind: 'shuffle', label: '洗牌', icon: '↻' },
      { kind: 'undo', label: '撤销', icon: '↶' },
      { kind: 'lift', label: '上移', icon: '↑' },
    ];
    const sheet = TextureCache.get(DAILY_TOOL_BUTTONS_TEXTURE_KEY);
    const totalW = buttons.length * 150 + (buttons.length - 1) * 36;
    const startX = Math.round((Game.logicWidth - totalW) / 2);
    buttons.forEach((button, index) => {
      const root = new PIXI.Container();
      root.position.set(startX + index * 186 + 75, Game.logicHeight - 94);
      root.eventMode = 'static';
      root.cursor = 'pointer';
      root.hitArea = new PIXI.Rectangle(-75, -62, 150, 124);
      root.on('pointertap', () => {
        AudioManager.playButtonSound();
        this.useTool(button.kind);
      });

      let bg: PIXI.Graphics | undefined;
      if (sheet) {
        const colW = Math.floor(sheet.width / 3);
        const x0 = index * colW;
        const w = index === 2 ? sheet.width - colW * 2 : colW;
        const sub = new PIXI.Texture(sheet.baseTexture, new PIXI.Rectangle(x0, 0, w, sheet.height));
        const sp = new PIXI.Sprite(sub);
        sp.anchor.set(0.5);
        const sc = 142 / Math.max(w, sheet.height);
        sp.scale.set(sc);
        root.addChild(sp);
      } else {
        bg = new PIXI.Graphics();
        root.addChild(bg);
        const icon = new PIXI.Text(button.icon, {
          fontSize: 48,
          fill: 0x7be33a,
          fontWeight: '900',
          stroke: 0x2d6b1f,
          strokeThickness: 5,
        });
        icon.anchor.set(0.5);
        icon.resolution = 2;
        icon.position.set(0, -14);
        root.addChild(icon);
        const label = new PIXI.Text(button.label, {
          fontSize: 26,
          fill: 0xffffff,
          fontWeight: '900',
          stroke: 0x5a351f,
          strokeThickness: 5,
        });
        label.anchor.set(0.5);
        label.resolution = 2;
        label.position.set(0, 38);
        root.addChild(label);
      }
      this.toolViews.set(button.kind, { root, bg, kind: button.kind });
      this.toolLayer.addChild(root);
    });
    this.updateToolButtons();
  }

  private updateToolButtons(): void {
    for (const view of this.toolViews.values()) {
      const count = this.toolCounts[view.kind];
      if (view.bg) {
        view.bg.clear();
        view.bg.beginFill(count > 0 ? 0xb77a3a : 0x7b6658, 1);
        view.bg.lineStyle(5, count > 0 ? 0xf8d28b : 0xbca995, 1);
        view.bg.drawCircle(0, 0, 58);
        view.bg.endFill();
      }
      view.root.alpha = count > 0 ? 1 : 0.55;
    }
  }

  private renderIceBowls(): void {
    this.iceBowlLayer.removeChildren();
    const W = Game.logicWidth;
    const y = this.bowlY();
    const bowlW = 118;
    const gap = 12;
    const totalW = ICE_BOWL_COUNT * bowlW + (ICE_BOWL_COUNT - 1) * gap;
    const startX = Math.round((W - totalW) / 2);
    const bowlOrdinalsByFruit = new Map<FruitId, number>();

    for (let i = 0; i < ICE_BOWL_COUNT; i += 1) {
      const x = startX + i * (bowlW + gap) + bowlW / 2;
      const targetFruit = this.level.targetFruitIds[i % this.level.targetFruitIds.length];
      const ordinal = bowlOrdinalsByFruit.get(targetFruit) ?? 0;
      bowlOrdinalsByFruit.set(targetFruit, ordinal + 1);
      const targetCollected = this.collectedByFruit[targetFruit] ?? 0;
      const filled = Math.max(0, Math.min(ICE_BOWL_CAPACITY, targetCollected - ordinal * ICE_BOWL_CAPACITY));
      this.iceBowlLayer.addChild(this.createIceBowlView(x, y, bowlW, filled, targetFruit));
    }
  }

  private createIceBowlView(
    x: number,
    y: number,
    width: number,
    filledCount: number,
    targetFruit: FruitId,
  ): PIXI.Container {
    const root = new PIXI.Container();
    const tex = TextureCache.get(DAILY_ICE_BOWL_TEXTURE_KEY);
    if (tex) {
      const bowl = new PIXI.Sprite(tex);
      bowl.anchor.set(0.5);
      bowl.scale.set(width / tex.width);
      bowl.position.set(x, y + 24);
      root.addChild(bowl);
    } else {
      const g = new PIXI.Graphics();
      g.beginFill(0xffffff, 0.28);
      g.drawEllipse(x + 8, y + 40, width * 0.48, 16);
      g.endFill();
      g.beginFill(0xbef7ff, 0.36);
      g.lineStyle(3, 0xffffff, 0.84);
      g.moveTo(x - width * 0.44, y - 12);
      g.lineTo(x + width * 0.44, y - 12);
      g.lineTo(x + width * 0.30, y + 42);
      g.quadraticCurveTo(x, y + 58, x - width * 0.30, y + 42);
      g.closePath();
      g.endFill();
      g.beginFill(0xe9ffff, 0.6);
      g.drawEllipse(x, y - 12, width * 0.45, 18);
      g.endFill();
      g.beginFill(0xffffff, 0.42);
      g.drawEllipse(x - 12, y + 60, width * 0.22, 10);
      g.endFill();
      root.addChild(g);
    }

    const fruitPositions = [
      { x: x - 22, y: y + 30 },
      { x, y: y + 22 },
      { x: x + 22, y: y + 31 },
    ];
    for (let i = 0; i < filledCount; i += 1) {
      const pos = fruitPositions[i];
      const icon = this.createFruitIcon(targetFruit, 32);
      icon.position.set(pos.x, pos.y);
      icon.alpha = 0.92;
      root.addChild(icon);
    }

    const countIcon = this.createFruitIcon(targetFruit, 22);
    countIcon.position.set(x - 20, y + 90);
    root.addChild(countIcon);

    const count = new PIXI.Text(`${filledCount}/${ICE_BOWL_CAPACITY}`, {
      fontSize: 18,
      fill: 0x20718a,
      fontWeight: '900',
      stroke: 0xffffff,
      strokeThickness: 3,
    });
    count.anchor.set(0.5);
    count.resolution = 2;
    count.position.set(x + 12, y + 90);
    root.addChild(count);
    return root;
  }

  private showResultOverlay(success: boolean): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    this.overlayLayer.removeChildren();

    const dim = new PIXI.Graphics();
    dim.beginFill(0x1b260f, 0.62);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    this.overlayLayer.addChild(dim);

    if (success) {
      dim.eventMode = 'static';
      dim.cursor = 'pointer';
      dim.on('pointertap', () => {
        SceneManager.switchTo('home');
      });
      if (this.lastClearRewardWasFirstToday) {
        this.showDailyClearRewardOverlay(W, H);
      } else {
        this.showDailyRepeatClearOverlay(W, H);
      }
      return;
    }

    const panelW = Math.min(620, W - 64);
    const panelH = 400;
    const panelX = (W - panelW) / 2;
    const panelY = (H - panelH) / 2;
    const panel = new PIXI.Graphics();
    panel.beginFill(0xfff8e8, 1);
    panel.lineStyle(10, 0xc47634, 1);
    panel.drawRoundedRect(panelX, panelY, panelW, panelH, 30);
    panel.endFill();
    this.overlayLayer.addChild(panel);

    const title = new PIXI.Text('冰碗没装满', {
      fontSize: 42,
      fill: 0xb44428,
      fontWeight: '900',
      stroke: 0xffffff,
      strokeThickness: 5,
    });
    title.anchor.set(0.5);
    title.resolution = 2;
    title.position.set(W / 2, panelY + 72);
    this.overlayLayer.addChild(title);

    const body = new PIXI.Text(
      '底部格子已经放满了，继续收集目标水果片再试一次吧。',
      {
        fontSize: 28,
        fill: 0x6b4320,
        fontWeight: '700',
        align: 'center',
        wordWrap: true,
        wordWrapWidth: panelW - 86,
        lineHeight: 42,
      },
    );
    body.anchor.set(0.5);
    body.resolution = 2;
    body.position.set(W / 2, panelY + 190);
    this.overlayLayer.addChild(body);

    const retry = this.createPillButton('再来一局', 190, 68, 0x79d64b, 0x2f7a26);
    retry.position.set(W / 2 - 112, panelY + panelH - 76);
    retry.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.startRound();
    });
    this.overlayLayer.addChild(retry);

    const home = this.createPillButton('回首页', 170, 68, 0xffc65a, 0xa86720);
    home.position.set(W / 2 + 128, panelY + panelH - 76);
    home.on('pointertap', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('home');
    });
    this.overlayLayer.addChild(home);
  }

  private showDailyClearRewardOverlay(W: number, H: number): void {
    const centerX = W / 2;
    const bannerY = H * 0.24;
    const bannerTex = TextureCache.get(DAILY_CLEAR_BANNER_TEXTURE_KEY);
    if (bannerTex) {
      const banner = new PIXI.Sprite(bannerTex);
      banner.anchor.set(0.5);
      banner.scale.set(Math.min((W * 0.9) / bannerTex.width, 190 / bannerTex.height));
      banner.position.set(centerX, bannerY);
      this.overlayLayer.addChild(banner);
    } else {
      const title = new PIXI.Text('恭喜通关每日限定关卡', {
        fontSize: 42,
        fill: 0xfff05a,
        fontWeight: '900',
        stroke: 0x7b2a10,
        strokeThickness: 8,
        dropShadow: true,
        dropShadowBlur: 4,
        dropShadowDistance: 3,
        dropShadowColor: 0x2c1208,
        lineJoin: 'round',
      });
      title.anchor.set(0.5);
      title.resolution = 2;
      title.position.set(centerX, bannerY);
      this.overlayLayer.addChild(title);
    }

    const aura = new PIXI.Graphics();
    aura.beginFill(0xfff1a6, 0.16);
    aura.drawCircle(centerX, H * 0.44, 190);
    aura.endFill();
    aura.lineStyle(3, 0xffffff, 0.2);
    aura.drawCircle(centerX, H * 0.44, 154);
    this.overlayLayer.addChild(aura);

    this.overlayLayer.addChild(this.createFloatingReward(centerX - 104, H * 0.45, '金币', `+${DAILY_LIMITED_CLEAR_REWARD_COINS}`, createCoinIcon(56)));
    this.overlayLayer.addChild(this.createRecipeFloatingReward(centerX + 118, H * 0.45));

    const share = this.createShareRewardButton();
    share.position.set(centerX, H * 0.71);
    share.on('pointertap', () => {
      AudioManager.playButtonSound();
      const ok = shareGame({
        title: '菠萝雪碧冰沙制作方法，酸甜清爽一口降温！',
        imageUrl: DAILY_RECIPE_CARD_PATH,
        query: 'from=share&entry=daily_limited_recipe',
      });
      if (!ok) {
        this.toast('请在微信小游戏中分享');
      }
    });
    this.overlayLayer.addChild(share);

    const hint = new PIXI.Text('点击空白处返回首页', {
      fontSize: 22,
      fill: 0xffffff,
      fontWeight: '800',
      stroke: 0x2d1a12,
      strokeThickness: 4,
    });
    hint.anchor.set(0.5);
    hint.resolution = 2;
    hint.position.set(centerX, H * 0.9);
    this.overlayLayer.addChild(hint);
  }

  private showDailyRepeatClearOverlay(W: number, H: number): void {
    const centerX = W / 2;
    const bannerY = H * 0.26;
    const bannerTex = TextureCache.get(DAILY_CLEAR_BANNER_TEXTURE_KEY);
    if (bannerTex) {
      const banner = new PIXI.Sprite(bannerTex);
      banner.anchor.set(0.5);
      banner.scale.set(Math.min((W * 0.86) / bannerTex.width, 178 / bannerTex.height));
      banner.position.set(centerX, bannerY);
      this.overlayLayer.addChild(banner);
    }

    const aura = new PIXI.Graphics();
    aura.beginFill(0xfff1a6, 0.16);
    aura.drawCircle(centerX, H * 0.45, 150);
    aura.endFill();
    aura.lineStyle(3, 0xffffff, 0.2);
    aura.drawCircle(centerX, H * 0.45, 116);
    this.overlayLayer.addChild(aura);

    this.overlayLayer.addChild(this.createFloatingReward(centerX, H * 0.43, '金币', `+${this.lastClearRewardCoins}`, createCoinIcon(58)));

    const message = new PIXI.Text('今日制作方法已解锁\n明日再来有新惊喜', {
      fontSize: 30,
      fill: 0xfff4d6,
      fontWeight: '900',
      align: 'center',
      lineHeight: 42,
      stroke: 0x4c2a15,
      strokeThickness: 6,
    });
    message.anchor.set(0.5);
    message.resolution = 2;
    message.position.set(centerX, H * 0.62);
    this.overlayLayer.addChild(message);

    const hint = new PIXI.Text('点击空白处返回首页', {
      fontSize: 22,
      fill: 0xffffff,
      fontWeight: '800',
      stroke: 0x2d1a12,
      strokeThickness: 4,
    });
    hint.anchor.set(0.5);
    hint.resolution = 2;
    hint.position.set(centerX, H * 0.84);
    this.overlayLayer.addChild(hint);
  }

  private createFloatingReward(x: number, y: number, title: string, subtitle: string, icon: PIXI.Container): PIXI.Container {
    const root = new PIXI.Container();
    root.position.set(x, y);

    const glow = new PIXI.Graphics();
    glow.beginFill(0xfff0a6, 0.22);
    glow.drawCircle(0, -22, 76);
    glow.endFill();
    glow.lineStyle(3, 0xffffff, 0.28);
    glow.drawCircle(0, -22, 58);
    root.addChild(glow);

    for (const [dx, dy] of [[-58, -52], [56, -46], [-42, 34], [52, 26]] as const) {
      const sparkle = new PIXI.Text('✦', {
        fontSize: 22,
        fill: 0xfff7b6,
        fontWeight: '900',
        stroke: 0x7a4a22,
        strokeThickness: 2,
      });
      sparkle.anchor.set(0.5);
      sparkle.resolution = 2;
      sparkle.position.set(dx, dy - 22);
      root.addChild(sparkle);
    }

    icon.position.set(0, -28);
    root.addChild(icon);
    const titleText = new PIXI.Text(title, {
      fontSize: 28,
      fill: 0xfff4d6,
      fontWeight: '900',
      stroke: 0x4c2a15,
      strokeThickness: 5,
    });
    titleText.anchor.set(0.5);
    titleText.resolution = 2;
    titleText.position.set(0, 56);
    root.addChild(titleText);
    const subText = new PIXI.Text(subtitle, {
      fontSize: 26,
      fill: 0xffd463,
      fontWeight: '900',
      stroke: 0x5a2c15,
      strokeThickness: 5,
    });
    subText.anchor.set(0.5);
    subText.resolution = 2;
    subText.position.set(0, 88);
    root.addChild(subText);
    return root;
  }

  private createRecipeFloatingReward(x: number, y: number): PIXI.Container {
    const icon = new PIXI.Container();
    const tex = TextureCache.get(DAILY_RECIPE_CARD_TEXTURE_KEY);
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.scale.set(118 / Math.max(tex.width, tex.height));
      icon.addChild(sp);
    } else {
      const fallback = this.createFruitIcon('pineapple', 72);
      icon.addChild(fallback);
    }
    const root = this.createFloatingReward(x, y, '制作方法', '菠萝冰', icon);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-86, -112, 172, 220);
    root.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.playButtonSound();
      this.showRecipeCardPreview();
    });

    const hint = new PIXI.Text('点击查看大图', {
      fontSize: 20,
      fill: 0xfff4d6,
      fontWeight: '800',
      stroke: 0x4c2a15,
      strokeThickness: 4,
    });
    hint.anchor.set(0.5);
    hint.resolution = 2;
    hint.position.set(0, 122);
    root.addChild(hint);
    return root;
  }

  private showRecipeCardPreview(): void {
    const tex = TextureCache.get(DAILY_RECIPE_CARD_TEXTURE_KEY);
    if (!tex) {
      return;
    }
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const preview = new PIXI.Container();
    preview.eventMode = 'static';
    preview.cursor = 'pointer';
    const dim = new PIXI.Graphics();
    dim.beginFill(0x080808, 0.72);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    preview.addChild(dim);
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    const sc = Math.min((W * 0.84) / tex.width, (H * 0.72) / tex.height);
    sp.scale.set(sc);
    sp.position.set(W / 2, H / 2);
    preview.addChild(sp);
    const catalogNote = new PIXI.Text('已收入图鉴随时查看', {
      fontSize: 24,
      fill: 0xfff4d6,
      fontWeight: '900',
      stroke: 0x2d1a12,
      strokeThickness: 4,
    });
    catalogNote.anchor.set(0.5);
    catalogNote.resolution = 2;
    catalogNote.position.set(W / 2, Math.min(H * 0.86, H / 2 + (tex.height * sc) / 2 + 34));
    preview.addChild(catalogNote);
    const close = new PIXI.Text('点击关闭', {
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: '800',
      stroke: 0x2d1a12,
      strokeThickness: 4,
    });
    close.anchor.set(0.5);
    close.resolution = 2;
    close.position.set(W / 2, H * 0.92);
    preview.addChild(close);
    preview.on('pointertap', () => {
      this.overlayLayer.removeChild(preview);
      preview.destroy({ children: true });
    });
    this.overlayLayer.addChild(preview);
  }

  private createShareRewardButton(): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    const tex = TextureCache.get(DAILY_SHARE_BUTTON_TEXTURE_KEY);
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const sc = Math.min(1, 300 / tex.width, 88 / tex.height);
      sp.scale.set(sc);
      root.hitArea = new PIXI.Rectangle((-tex.width * sc) / 2, (-tex.height * sc) / 2, tex.width * sc, tex.height * sc);
      root.addChild(sp);
      return root;
    }
    return this.createPillButton('分享', 230, 70, 0x9be45c, 0x6c7a19);
  }

  private createPillButton(label: string, width: number, height: number, fill: number, stroke: number): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-width / 2, -height / 2, width, height);
    const bg = new PIXI.Graphics();
    bg.beginFill(fill);
    bg.lineStyle(4, stroke, 1);
    bg.drawRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    bg.endFill();
    root.addChild(bg);
    const text = new PIXI.Text(label, {
      fontSize: Math.round(height * 0.42),
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x5a351f,
      strokeThickness: 4,
    });
    text.anchor.set(0.5);
    text.resolution = 2;
    root.addChild(text);
    return root;
  }

  private toast(title: string): void {
    const api = typeof wx !== 'undefined' ? wx : null;
    api?.showToast?.({ title, icon: 'none', duration: 1200 });
  }

  private boardTop(): number {
    return Game.safeTop + 150;
  }

  private boardHeight(): number {
    return Math.min(620, Game.logicHeight * 0.38);
  }

  private bowlY(): number {
    return this.flatAreaY() + FLAT_ROWS * (CARD_H + 8) + 82;
  }

  private flatAreaY(): number {
    return this.boardTop() + this.boardHeight() + 42;
  }

  private bufferY(): number {
    return Game.logicHeight - 258;
  }
}
