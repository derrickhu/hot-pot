import * as PIXI from 'pixi.js';
import { DAILY_LIMITED_LEVELS } from '@/config/dailyLimitedLevels';
import {
  MILK_TEA_DEMO_PRELOAD_PATHS,
  MILK_TEA_DEMO_TEXTURE_KEYS,
  milkTeaDemoDrinkTextureKey,
} from '@/config/milkTeaTrayAssets';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import type { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { loadMilkTeaDemoSubpackage } from '@/utils/loadBowlSubpackage';
import { TextureCache } from '@/utils/TextureCache';

type DrinkId = string;

interface DrinkDef {
  readonly id: DrinkId;
  readonly name: string;
  readonly liquidColor: number;
  readonly toppingColor: number;
  readonly accentColor: number;
  readonly pattern: number;
}

interface Tray {
  readonly id: number;
  drinks: DrinkId[];
}

interface BoardCell {
  readonly index: number;
  readonly row: number;
  readonly col: number;
  tray: Tray | null;
}

interface FlyAnimation {
  readonly node: PIXI.Container;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  elapsed: number;
  readonly duration: number;
  readonly onLand?: () => void;
}

interface PulseEffect {
  readonly node: PIXI.Container;
  elapsed: number;
  readonly duration: number;
  readonly baseScale: number;
  readonly maxScale: number;
  readonly alphaStart: number;
}

interface DeliveryAnimation {
  readonly node: PIXI.Container;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  elapsed: number;
  readonly duration: number;
  readonly onComplete?: () => void;
}

interface DragState {
  readonly tray: Tray;
  readonly pendingIndex: number;
  readonly node: PIXI.Container;
}

const BOARD_COLS = 4;
const BOARD_ROWS = 6;
const TRAY_CAPACITY = 6;
const BOTTOM_TRAY_COUNT = 3;
const ROUND_DRINK_TYPES = 6;
const ORDER_SLOTS = 5;
const TARGET_DELIVERIES = 8;

const BOARD_CELL_W = 156;
const BOARD_CELL_H = 110;
const BOARD_GAP = 10;
const BOARD_TRAY_W = 154;
const BOARD_TRAY_H = 108;
const PENDING_TRAY_W = 162;
const PENDING_TRAY_H = 114;

const DRINK_PALETTE = [
  { liquid: 0xffd25f, topping: 0xfff0a6, accent: 0xf58c2b },
  { liquid: 0x8f58c7, topping: 0xd8b4ff, accent: 0x6d3fa3 },
  { liquid: 0xff8fba, topping: 0xffd2e3, accent: 0xd94f84 },
  { liquid: 0x78d47f, topping: 0xd8ffd8, accent: 0x329f54 },
  { liquid: 0xff6f61, topping: 0xffccb8, accent: 0xd94a3d },
  { liquid: 0x4fb1ff, topping: 0xbde8ff, accent: 0x2577bd },
  { liquid: 0xf3bd6b, topping: 0xffedc2, accent: 0xb97024 },
  { liquid: 0xc7654a, topping: 0xf3cfb4, accent: 0x8c3a28 },
  { liquid: 0xffdf8f, topping: 0xffffff, accent: 0xce8e30 },
  { liquid: 0xb5d96b, topping: 0xf3ffd2, accent: 0x789b2f },
] as const;

function destroyContainerChildren(container: PIXI.Container): void {
  const children = container.removeChildren();
  for (const child of children) {
    if (!child.destroyed) {
      child.destroy({ children: true });
    }
  }
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeDrinkDefs(): DrinkDef[] {
  return DAILY_LIMITED_LEVELS.map((level, index) => {
    const hash = hashString(level.themeId);
    const palette = DRINK_PALETTE[(hash + index) % DRINK_PALETTE.length];
    return {
      id: level.themeId,
      name: level.drinkName,
      liquidColor: palette.liquid,
      toppingColor: palette.topping,
      accentColor: palette.accent,
      pattern: hash % 4,
    };
  });
}

function seededNext(seed: number): number {
  return (Math.imul(1664525, seed >>> 0) + 1013904223) >>> 0;
}

export class MilkTeaTrayDemoScene implements Scene {
  readonly name = 'milkTeaTrayDemo';
  readonly container = new PIXI.Container();

  private readonly bg = new PIXI.Graphics();
  private bgSprite: PIXI.Sprite | null = null;
  private readonly toolsRoot = new PIXI.Container();
  private readonly orderRoot = new PIXI.Container();
  private readonly boardRoot = new PIXI.Container();
  private readonly trayRoot = new PIXI.Container();
  private readonly hudRoot = new PIXI.Container();
  private readonly overlayRoot = new PIXI.Container();
  private readonly drinkDefs = makeDrinkDefs();
  private readonly drinkMap = new Map<DrinkId, DrinkDef>(this.drinkDefs.map((drink) => [drink.id, drink]));

  private activeDrinks: DrinkDef[] = [];
  private board: BoardCell[] = [];
  private pendingTrays: Tray[] = [];
  private orders: DrinkId[] = [];
  private selectedTrayIndex = 0;
  private delivered = 0;
  private nextTrayId = 1;
  private randomState = 20260526;
  private messageText!: PIXI.Text;
  private deliveryAnimations: DeliveryAnimation[] = [];
  private flyAnimations: FlyAnimation[] = [];
  private pulseEffects: PulseEffect[] = [];
  private dragState: DragState | null = null;
  private dropHighlightIndex = -1;
  private dragWobblePhase = 0;
  private texturesReady = false;

  constructor() {
    this.build();
  }

  async prepare(): Promise<void> {
    if (this.texturesReady) {
      return;
    }
    await loadMilkTeaDemoSubpackage();
    await Promise.all(
      MILK_TEA_DEMO_PRELOAD_PATHS.map(({ key, path }) => TextureCache.load(key, path)),
    );
    this.texturesReady = true;
    this.applyPageBackground();
  }

  onEnter(): void {
    this.applyPageBackground();
    this.startRound();
  }

  update(dt: number): void {
    this.updateFlyAnimations(dt);
    this.updatePulseEffects(dt);
    this.updateDeliveryAnimations(dt);
    if (this.dragState) {
      this.dragWobblePhase += dt;
      this.dragState.node.rotation = Math.sin(this.dragWobblePhase * 8) * 0.04;
      this.dragState.node.scale.set(1.08 + Math.sin(this.dragWobblePhase * 10) * 0.02);
    }
  }

  private build(): void {
    const W = Game.logicWidth;
    const H = Game.logicHeight;
    const top = Game.safeTop;

    this.container.eventMode = 'static';
    this.container.hitArea = new PIXI.Rectangle(0, 0, W, H);
    this.container.on('pointermove', (event) => this.onGlobalPointerMove(event));
    this.container.on('pointerup', (event) => this.onGlobalPointerUp(event));
    this.container.on('pointerupoutside', (event) => this.onGlobalPointerUp(event));

    this.bg.beginFill(0xffefd4);
    this.bg.drawRect(0, 0, W, H);
    this.bg.endFill();
    this.bg.beginFill(0xf7c982, 0.42);
    this.bg.drawRoundedRect(28, top + 96, W - 56, H - top - 190, 36);
    this.bg.endFill();
    this.container.addChild(this.bg);

    const backButton = this.createPillButton('返回', 82, 44, 0xfff8e8, 0xb97a30, 22);
    backButton.position.set(66, top + 46);
    backButton.on('pointertap', () => {
      AudioManager.playButtonSound();
      SceneManager.switchTo('home');
    });
    this.container.addChild(backButton);

    const restartButton = this.createPillButton('重开', 82, 44, 0xfff8e8, 0xb97a30, 22);
    restartButton.position.set(W - 66, top + 46);
    restartButton.on('pointertap', () => {
      AudioManager.playButtonSound();
      this.startRound();
    });
    this.container.addChild(restartButton);

    this.messageText = new PIXI.Text('', {
      fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif',
      fontSize: 18,
      fill: 0x7b4b23,
      fontWeight: '900',
      align: 'center',
      wordWrap: true,
      wordWrapWidth: W - 88,
    });
    this.messageText.anchor.set(0.5);
    this.messageText.resolution = 2;
    this.messageText.visible = false;
    this.messageText.position.set(W / 2, top + 92);
    this.container.addChild(this.messageText);

    this.orderRoot.position.set(W / 2, top + 260);
    this.boardRoot.position.set(W / 2, top + 725);
    this.trayRoot.position.set(W / 2, H - 270);
    this.hudRoot.position.set(W / 2, H - 94);
    this.toolsRoot.position.set(W / 2, H - 42);
    this.container.addChild(
      this.orderRoot,
      this.boardRoot,
      this.trayRoot,
      this.toolsRoot,
      this.hudRoot,
      this.overlayRoot,
    );
  }

  private applyPageBackground(): void {
    const tex = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.pageBg);
    if (!tex) {
      return;
    }
    if (!this.bgSprite) {
      this.bgSprite = new PIXI.Sprite(tex);
      this.container.addChildAt(this.bgSprite, 0);
      if (this.bg.parent) {
        this.container.removeChild(this.bg);
      }
    } else {
      this.bgSprite.texture = tex;
    }
    this.bgSprite.width = Game.logicWidth;
    this.bgSprite.height = Game.logicHeight;
  }

  private startRound(): void {
    const todayIndex = Math.max(0, new Date().getDate() - 1);
    this.randomState = 20260526 + todayIndex * 97;
    this.nextTrayId = 1;
    this.delivered = 0;
    this.selectedTrayIndex = 0;
    this.activeDrinks = [];
    for (let i = 0; i < ROUND_DRINK_TYPES; i += 1) {
      this.activeDrinks.push(this.drinkDefs[(todayIndex + i) % this.drinkDefs.length]);
    }

    this.board = [];
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        this.board.push({ index: row * BOARD_COLS + col, row, col, tray: null });
      }
    }

    const orderPool = this.activeDrinks.map((drink) => drink.id);
    this.orders = orderPool.slice(0, ORDER_SLOTS);
    this.refillPendingBatch();
    this.clearOverlayAnimations();
    this.dropHighlightIndex = -1;
    this.setMessage('底部一次 3 个托盘：拖到中间空格放下，放完 3 个才会补下一批。相邻同款会自动归并，满 6 杯同款匹配订单即交付。');
    this.renderAll();
  }

  private createNextTray(): Tray {
    const orderPool = this.orders.length > 0 ? this.orders : this.activeDrinks.map((drink) => drink.id);
    const primary = orderPool[(this.nextTrayId - 1) % orderPool.length];
    const secondary = this.pickDrinkId();
    const tertiary = this.pickDrinkId();
    const fillCount = 2 + (this.nextRandom() % 4);
    const drinks: DrinkId[] = [];

    for (let i = 0; i < fillCount; i += 1) {
      if (i < 2) {
        drinks.push(primary);
      } else if (i % 2 === 0) {
        drinks.push(secondary);
      } else {
        drinks.push(tertiary);
      }
    }

    return {
      id: this.nextTrayId++,
      drinks: this.shuffleDrinks(drinks),
    };
  }

  private nextRandom(): number {
    this.randomState = seededNext(this.randomState);
    return this.randomState;
  }

  private pickDrinkId(): DrinkId {
    return this.activeDrinks[this.nextRandom() % this.activeDrinks.length].id;
  }

  private shuffleDrinks(drinks: DrinkId[]): DrinkId[] {
    const result = [...drinks];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = this.nextRandom() % (i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  private renderAll(): void {
    this.renderOrders();
    this.renderBoard();
    this.renderPendingTrays();
    this.renderTools();
    this.renderHud();
  }

  private renderOrders(): void {
    destroyContainerChildren(this.orderRoot);
    const panelTex = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.orderPanel);
    if (panelTex) {
      const panel = new PIXI.Sprite(panelTex);
      panel.anchor.set(0.5);
      const targetW = Math.min(610, Game.logicWidth - 88);
      panel.scale.set(targetW / panelTex.width);
      panel.position.set(0, 0);
      this.orderRoot.addChild(panel);
    } else {
      const panel = new PIXI.Graphics();
      panel.beginFill(0xd66f5d, 0.88);
      panel.lineStyle(4, 0xb9503f, 1);
      panel.drawRoundedRect(-315, -58, 630, 116, 26);
      panel.endFill();
      this.orderRoot.addChild(panel);
    }

    const startX = -204;
    this.orders.forEach((drinkId, index) => {
      const root = new PIXI.Container();
      root.position.set(startX + index * 102, 3);
      root.addChild(this.createDrinkVisual(drinkId, 76, 68));
      this.orderRoot.addChild(root);
    });
  }

  private renderBoard(): void {
    destroyContainerChildren(this.boardRoot);
    const boardW = BOARD_COLS * BOARD_CELL_W + (BOARD_COLS - 1) * BOARD_GAP;
    const boardH = BOARD_ROWS * BOARD_CELL_H + (BOARD_ROWS - 1) * BOARD_GAP;

    for (const cell of this.board) {
      const local = this.getCellLocalCenter(cell);
      const cellRoot = new PIXI.Container();
      cellRoot.position.set(local.x, local.y);

      if (!cell.tray) {
        const isDropTarget = this.dragState && cell.index === this.dropHighlightIndex;
        const slot = new PIXI.Graphics();
        slot.beginFill(isDropTarget ? 0xfff2b8 : 0x8a6d4c, isDropTarget ? 0.42 : 0.24);
        slot.lineStyle(isDropTarget ? 3 : 0, isDropTarget ? 0xffd86a : 0, isDropTarget ? 0.9 : 0);
        slot.drawRoundedRect(-BOARD_CELL_W / 2, -BOARD_CELL_H / 2, BOARD_CELL_W, BOARD_CELL_H, 16);
        slot.endFill();
        cellRoot.addChild(slot);
        if (isDropTarget) {
          const glow = new PIXI.Graphics();
          glow.beginFill(0xfff8c8, 0.18);
          glow.drawRoundedRect(-BOARD_CELL_W / 2 - 6, -BOARD_CELL_H / 2 - 6, BOARD_CELL_W + 12, BOARD_CELL_H + 12, 20);
          glow.endFill();
          cellRoot.addChildAt(glow, 0);
        }
      }

      if (cell.tray) {
        cellRoot.addChild(this.createTrayVisual(cell.tray, BOARD_TRAY_W, BOARD_TRAY_H, false));
      }
      this.boardRoot.addChild(cellRoot);
    }
  }

  private renderPendingTrays(): void {
    destroyContainerChildren(this.trayRoot);
    const startX = -210;
    this.pendingTrays.forEach((tray, index) => {
      const root = new PIXI.Container();
      root.position.set(startX + index * 210, 0);
      root.eventMode = 'static';
      root.cursor = 'grab';
      root.hitArea = new PIXI.Rectangle(-95, -72, 190, 132);
      root.on('pointerdown', (event) => this.startDragTray(event, index));
      root.addChild(this.createTrayVisual(tray, PENDING_TRAY_W, PENDING_TRAY_H, false));
      this.trayRoot.addChild(root);
    });
  }

  private renderTools(): void {
    destroyContainerChildren(this.toolsRoot);
    const specs = [
      { key: MILK_TEA_DEMO_TEXTURE_KEYS.toolRemove, x: -200 },
      { key: MILK_TEA_DEMO_TEXTURE_KEYS.toolReshuffle, x: 0 },
      { key: MILK_TEA_DEMO_TEXTURE_KEYS.toolClearRow, x: 200 },
    ];
    for (const spec of specs) {
      const tex = TextureCache.get(spec.key);
      if (!tex) {
        continue;
      }
      const btn = new PIXI.Sprite(tex);
      btn.anchor.set(0.5);
      const target = 88;
      btn.scale.set(target / Math.max(tex.width, tex.height));
      btn.position.set(spec.x, 0);
      this.toolsRoot.addChild(btn);
    }
  }

  private renderHud(): void {
    destroyContainerChildren(this.hudRoot);
  }

  private placeSelectedTray(cellIndex: number): void {
    this.placePendingTrayAtCell(this.selectedTrayIndex, cellIndex);
  }

  private placePendingTrayAtCell(pendingIndex: number, cellIndex: number): boolean {
    const cell = this.board[cellIndex];
    const tray = this.pendingTrays[pendingIndex];
    if (!tray) {
      this.setMessage('没有可放置的托盘了。');
      return false;
    }
    if (!cell || cell.tray) {
      this.setMessage('中间区域只能放到空格里。');
      return false;
    }

    cell.tray = tray;
    this.pendingTrays.splice(pendingIndex, 1);
    this.selectedTrayIndex = Math.min(pendingIndex, Math.max(0, this.pendingTrays.length - 1));
    if (this.pendingTrays.length === 0) {
      this.refillPendingBatch();
    }

    this.spawnPlaceEffect(cell);
    AudioManager.playScoopSound();

    const moved = this.mergeAdjacentTrays(cellIndex);
    const delivered = this.tryDeliverCompletedTrays();
    if (delivered > 0) {
      this.setMessage(`交付成功！完成 ${delivered} 个订单。`);
    } else if (moved > 0) {
      this.setMessage(`相邻托盘自动归并了 ${moved} 杯同款饮品。`);
    } else {
      this.setMessage('已放下托盘。继续让同款饮品相邻，凑满 6 杯后交付订单。');
    }
    this.checkRoundState();
    this.renderAll();
    return true;
  }

  private startDragTray(event: PIXI.FederatedPointerEvent, pendingIndex: number): void {
    const tray = this.pendingTrays[pendingIndex];
    if (!tray) {
      return;
    }
    AudioManager.playButtonSound();
    this.selectedTrayIndex = pendingIndex;
    this.endDrag(false);
    const node = this.createTrayVisual(tray, PENDING_TRAY_W, PENDING_TRAY_H, false);
    node.alpha = 0.96;
    node.scale.set(1.08);
    node.eventMode = 'none';
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.22);
    shadow.drawEllipse(0, PENDING_TRAY_H * 0.42, PENDING_TRAY_W * 0.72, 16);
    shadow.endFill();
    node.addChildAt(shadow, 0);
    this.overlayRoot.addChild(node);
    this.dragState = { tray, pendingIndex, node };
    const local = event.getLocalPosition(this.container);
    node.position.set(local.x, local.y - 12);
    this.dropHighlightIndex = -1;
    this.renderPendingTrays();
    this.renderBoard();
  }

  private onGlobalPointerMove(event: PIXI.FederatedPointerEvent): void {
    if (!this.dragState) {
      return;
    }
    const local = event.getLocalPosition(this.container);
    this.dragState.node.position.set(local.x, local.y - 12);
    const nextHighlight = this.getBoardCellIndexAt(local.x, local.y);
    if (nextHighlight !== this.dropHighlightIndex) {
      this.dropHighlightIndex = nextHighlight;
      this.renderBoard();
    }
  }

  private onGlobalPointerUp(event: PIXI.FederatedPointerEvent): void {
    if (!this.dragState) {
      return;
    }
    const local = event.getLocalPosition(this.container);
    const cellIndex = this.getBoardCellIndexAt(local.x, local.y);
    let placed = false;
    if (cellIndex >= 0) {
      placed = this.placePendingTrayAtCell(this.dragState.pendingIndex, cellIndex);
    } else {
      this.setMessage('拖到中间阴影格里再松手放置。');
    }
    this.endDrag(false);
    this.dropHighlightIndex = -1;
    if (!placed) {
      this.renderAll();
    }
  }

  private endDrag(render = true): void {
    if (!this.dragState) {
      return;
    }
    if (this.dragState.node.parent) {
      this.dragState.node.parent.removeChild(this.dragState.node);
    }
    this.dragState.node.destroy({ children: true });
    this.dragState = null;
    this.dropHighlightIndex = -1;
    if (render) {
      this.renderAll();
    }
  }

  private getBoardCellIndexAt(stageX: number, stageY: number): number {
    const x = stageX - this.boardRoot.x;
    const y = stageY - this.boardRoot.y;
    for (const cell of this.board) {
      if (cell.tray) {
        continue;
      }
      const local = this.getCellLocalCenter(cell);
      if (
        x >= local.x - BOARD_CELL_W / 2
        && x <= local.x + BOARD_CELL_W / 2
        && y >= local.y - BOARD_CELL_H / 2
        && y <= local.y + BOARD_CELL_H / 2
      ) {
        return cell.index;
      }
    }
    return -1;
  }

  private mergeAdjacentTrays(startIndex: number): number {
    let movedTotal = 0;
    let changed = true;
    while (changed) {
      changed = false;
      for (const cell of this.board) {
        if (!cell.tray) {
          continue;
        }
        const neighbors = this.getNeighbors(cell).filter((neighbor) => !!neighbor.tray);
        for (const neighbor of neighbors) {
          const moved = this.mergePairCells(cell, neighbor);
          if (moved > 0) {
            movedTotal += moved;
            changed = true;
          }
        }
      }
    }

    const start = this.board[startIndex];
    if (start?.tray) {
      const deliveredDrink = this.getCompleteTrayDrink(start.tray);
      if (deliveredDrink) {
        this.compactDrinkInTray(start.tray, deliveredDrink);
      }
    }
    return movedTotal;
  }

  private mergePairCells(aCell: BoardCell, bCell: BoardCell): number {
    const a = aCell.tray;
    const b = bCell.tray;
    if (!a || !b) {
      return 0;
    }
    let moved = 0;
    const common = this.getCommonDrinkIds(a, b);
    for (const drinkId of common) {
      const aCount = this.countDrink(a, drinkId);
      const bCount = this.countDrink(b, drinkId);
      if (aCount <= 0 || bCount <= 0) {
        continue;
      }
      const target = aCount >= bCount ? a : b;
      const source = target === a ? b : a;
      const targetCell = target === a ? aCell : bCell;
      const sourceCell = source === a ? aCell : bCell;
      const capacity = TRAY_CAPACITY - target.drinks.length;
      if (capacity <= 0) {
        continue;
      }
      const moveCount = Math.min(capacity, this.countDrink(source, drinkId));
      if (moveCount <= 0) {
        continue;
      }
      for (let i = 0; i < moveCount; i += 1) {
        const sourceSlot = this.findLastDrinkSlot(source, drinkId);
        const targetSlot = target.drinks.length;
        this.spawnDrinkFlyAnimation(sourceCell, targetCell, drinkId, sourceSlot, targetSlot);
        this.removeDrinkCopies(source, drinkId, 1);
        target.drinks.push(drinkId);
      }
      this.compactDrinkInTray(target, drinkId);
      moved += moveCount;
    }
    if (moved > 0) {
      AudioManager.playBufferMatchSound();
    }
    return moved;
  }

  private findLastDrinkSlot(tray: Tray, drinkId: DrinkId): number {
    for (let i = tray.drinks.length - 1; i >= 0; i -= 1) {
      if (tray.drinks[i] === drinkId) {
        return i;
      }
    }
    return Math.max(0, tray.drinks.length - 1);
  }

  private refillPendingBatch(): void {
    this.pendingTrays = [];
    for (let i = 0; i < BOTTOM_TRAY_COUNT; i += 1) {
      this.pendingTrays.push(this.createNextTray());
    }
  }

  private getCommonDrinkIds(a: Tray, b: Tray): DrinkId[] {
    const aSet = new Set(a.drinks);
    const result: DrinkId[] = [];
    for (const id of b.drinks) {
      if (aSet.has(id) && !result.includes(id)) {
        result.push(id);
      }
    }
    return result;
  }

  private countDrink(tray: Tray, drinkId: DrinkId): number {
    return tray.drinks.reduce((count, id) => count + (id === drinkId ? 1 : 0), 0);
  }

  private removeDrinkCopies(tray: Tray, drinkId: DrinkId, count: number): void {
    let remaining = count;
    tray.drinks = tray.drinks.filter((id) => {
      if (id === drinkId && remaining > 0) {
        remaining -= 1;
        return false;
      }
      return true;
    });
  }

  private compactDrinkInTray(tray: Tray, drinkId: DrinkId): void {
    const same = tray.drinks.filter((id) => id === drinkId);
    const other = tray.drinks.filter((id) => id !== drinkId);
    tray.drinks = [...same, ...other];
  }

  private getNeighbors(cell: BoardCell): BoardCell[] {
    const result: BoardCell[] = [];
    const offsets = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
    ];
    for (const offset of offsets) {
      const row = cell.row + offset.row;
      const col = cell.col + offset.col;
      if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
        continue;
      }
      result.push(this.board[row * BOARD_COLS + col]);
    }
    return result;
  }

  private tryDeliverCompletedTrays(): number {
    let deliveredNow = 0;
    for (const cell of this.board) {
      if (!cell.tray) {
        continue;
      }
      const drinkId = this.getCompleteTrayDrink(cell.tray);
      if (!drinkId) {
        continue;
      }
      const orderIndex = this.orders.indexOf(drinkId);
      if (orderIndex < 0) {
        continue;
      }
      this.spawnDeliveryAnimation(cell, drinkId, orderIndex);
      cell.tray = null;
      deliveredNow += 1;
      this.delivered += 1;
      this.orders.splice(orderIndex, 1);
      this.orders.push(this.nextOrderDrinkId());
    }
    return deliveredNow;
  }

  private getCompleteTrayDrink(tray: Tray): DrinkId | null {
    if (tray.drinks.length !== TRAY_CAPACITY) {
      return null;
    }
    const drinkId = tray.drinks[0];
    return drinkId && tray.drinks.every((id) => id === drinkId) ? drinkId : null;
  }

  private nextOrderDrinkId(): DrinkId {
    const pool = this.activeDrinks.map((drink) => drink.id);
    return pool[(this.delivered + this.orders.length) % pool.length];
  }

  private checkRoundState(): void {
    if (this.delivered >= TARGET_DELIVERIES) {
      this.setMessage('Demo 完成！已经交付足够订单，可以重开继续测试。');
      return;
    }
    const hasEmptyCell = this.board.some((cell) => !cell.tray);
    if (!hasEmptyCell) {
      this.setMessage('中间区域放满了，点右上角重开再试。');
    }
  }

  private getDrinkWorldPos(cell: BoardCell, slotIndex: number): { x: number; y: number } {
    const local = this.getCellLocalCenter(cell);
    const holes = this.trayHolePositions(BOARD_TRAY_W, BOARD_TRAY_H);
    const hole = holes[Math.min(slotIndex, holes.length - 1)] ?? { x: 0, y: 0 };
    return this.boardRoot.toGlobal({
      x: local.x + hole.x,
      y: local.y + hole.y - 24,
    });
  }

  private spawnDrinkFlyAnimation(
    sourceCell: BoardCell,
    targetCell: BoardCell,
    drinkId: DrinkId,
    sourceSlot: number,
    targetSlot: number,
  ): void {
    const from = this.getDrinkWorldPos(sourceCell, sourceSlot);
    const to = this.getDrinkWorldPos(targetCell, targetSlot);
    const cup = this.createDrinkVisual(drinkId, 50, 46);
    cup.position.set(from.x, from.y);
    this.overlayRoot.addChild(cup);
    this.flyAnimations.push({
      node: cup,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      elapsed: 0,
      duration: 0.34,
      onLand: () => this.spawnLandingSpark(to.x, to.y),
    });
  }

  private spawnPlaceEffect(cell: BoardCell): void {
    const local = this.getCellLocalCenter(cell);
    const x = this.boardRoot.x + local.x;
    const y = this.boardRoot.y + local.y;
    this.spawnPulseRing(x, y, 0.55, 1.65, 0.75);
    this.spawnPulseRing(x, y, 0.7, 1.35, 0.55);
    const trayBurst = this.createTrayVisual(cell.tray!, BOARD_TRAY_W, BOARD_TRAY_H, false);
    trayBurst.position.set(x, y);
    trayBurst.scale.set(0.88);
    trayBurst.alpha = 0.92;
    this.overlayRoot.addChild(trayBurst);
    this.pulseEffects.push({
      node: trayBurst,
      elapsed: 0,
      duration: 0.24,
      baseScale: 0.88,
      maxScale: 1.05,
      alphaStart: 0.92,
    });
  }

  private spawnLandingSpark(x: number, y: number): void {
    this.spawnPulseRing(x, y, 0.28, 0.95, 0.85);
    const star = new PIXI.Graphics();
    star.beginFill(0xfff6b0, 0.95);
    this.drawSparkStar(star, 0, 0, 4, 10, 4);
    star.endFill();
    star.position.set(x, y);
    star.scale.set(0.4);
    this.overlayRoot.addChild(star);
    this.pulseEffects.push({
      node: star,
      elapsed: 0,
      duration: 0.26,
      baseScale: 0.4,
      maxScale: 1.1,
      alphaStart: 0.95,
    });
  }

  private drawSparkStar(g: PIXI.Graphics, x: number, y: number, n: number, outer: number, inner: number): void {
    const step = Math.PI / n;
    let rot = -Math.PI / 2;
    g.moveTo(x + Math.cos(rot) * outer, y + Math.sin(rot) * outer);
    for (let i = 0; i < n; i += 1) {
      rot += step;
      g.lineTo(x + Math.cos(rot) * inner, y + Math.sin(rot) * inner);
      rot += step;
      g.lineTo(x + Math.cos(rot) * outer, y + Math.sin(rot) * outer);
    }
    g.closePath();
  }

  private spawnPulseRing(
    x: number,
    y: number,
    duration: number,
    maxScale: number,
    alphaStart: number,
  ): void {
    const ring = new PIXI.Graphics();
    ring.lineStyle(4, 0xfff0a0, alphaStart);
    ring.drawCircle(0, 0, 28);
    ring.position.set(x, y);
    this.overlayRoot.addChild(ring);
    this.pulseEffects.push({
      node: ring,
      elapsed: 0,
      duration,
      baseScale: 0.55,
      maxScale,
      alphaStart,
    });
  }

  private spawnOrderSlotBurst(orderIndex: number): void {
    const x = this.orderRoot.x - 202 + orderIndex * 102;
    const y = this.orderRoot.y + 4;
    this.spawnPulseRing(x, y, 0.5, 1.45, 0.9);
    const check = new PIXI.Graphics();
    check.lineStyle(5, 0x5ec45e, 1);
    check.moveTo(-14, 0);
    check.lineTo(-4, 10);
    check.lineTo(16, -12);
    check.position.set(x, y);
    this.overlayRoot.addChild(check);
    this.pulseEffects.push({
      node: check,
      elapsed: 0,
      duration: 0.38,
      baseScale: 0.7,
      maxScale: 1.15,
      alphaStart: 1,
    });
  }

  private spawnDeliveryAnimation(cell: BoardCell, drinkId: DrinkId, orderIndex: number): void {
    const cellLocal = this.getCellLocalCenter(cell);
    const orderLocalX = -202 + orderIndex * 102;
    const fromX = this.boardRoot.x + cellLocal.x;
    const fromY = this.boardRoot.y + cellLocal.y;
    const toX = this.orderRoot.x + orderLocalX;
    const toY = this.orderRoot.y + 4;
    const node = this.createTrayVisual(
      { id: -1, drinks: Array.from({ length: TRAY_CAPACITY }, () => drinkId) },
      BOARD_TRAY_W,
      BOARD_TRAY_H,
      false,
    );
    node.position.set(fromX, fromY);
    this.overlayRoot.addChild(node);
    this.spawnPulseRing(fromX, fromY, 0.45, 1.5, 0.8);
    this.deliveryAnimations.push({
      node,
      fromX,
      fromY,
      toX,
      toY,
      elapsed: 0,
      duration: 0.58,
      onComplete: () => {
        AudioManager.playOrderCompleteSound();
        this.spawnOrderSlotBurst(orderIndex);
      },
    });
  }

  private updateFlyAnimations(dt: number): void {
    for (let i = this.flyAnimations.length - 1; i >= 0; i -= 1) {
      const anim = this.flyAnimations[i];
      anim.elapsed += dt;
      const t = Math.min(1, anim.elapsed / anim.duration);
      const eased = 1 - (1 - t) * (1 - t);
      const arc = Math.sin(t * Math.PI) * 48;
      anim.node.position.set(
        anim.fromX + (anim.toX - anim.fromX) * eased,
        anim.fromY + (anim.toY - anim.fromY) * eased - arc,
      );
      const pop = 1 + 0.18 * Math.sin(t * Math.PI);
      anim.node.scale.set(pop);
      if (t >= 1) {
        anim.onLand?.();
        if (anim.node.parent) {
          anim.node.parent.removeChild(anim.node);
        }
        anim.node.destroy({ children: true });
        this.flyAnimations.splice(i, 1);
      }
    }
  }

  private updatePulseEffects(dt: number): void {
    for (let i = this.pulseEffects.length - 1; i >= 0; i -= 1) {
      const effect = this.pulseEffects[i];
      effect.elapsed += dt;
      const t = Math.min(1, effect.elapsed / effect.duration);
      const scale = effect.baseScale + (effect.maxScale - effect.baseScale) * t;
      effect.node.scale.set(scale);
      effect.node.alpha = effect.alphaStart * (1 - t);
      if (t >= 1) {
        if (effect.node.parent) {
          effect.node.parent.removeChild(effect.node);
        }
        effect.node.destroy({ children: true });
        this.pulseEffects.splice(i, 1);
      }
    }
  }

  private getCellLocalCenter(cell: BoardCell): { x: number; y: number } {
    const boardW = BOARD_COLS * BOARD_CELL_W + (BOARD_COLS - 1) * BOARD_GAP;
    const boardH = BOARD_ROWS * BOARD_CELL_H + (BOARD_ROWS - 1) * BOARD_GAP;
    return {
      x: -boardW / 2 + cell.col * (BOARD_CELL_W + BOARD_GAP) + BOARD_CELL_W / 2,
      y: -boardH / 2 + cell.row * (BOARD_CELL_H + BOARD_GAP) + BOARD_CELL_H / 2,
    };
  }

  private updateDeliveryAnimations(dt: number): void {
    for (let i = this.deliveryAnimations.length - 1; i >= 0; i -= 1) {
      const anim = this.deliveryAnimations[i];
      anim.elapsed += dt;
      const t = Math.min(1, anim.elapsed / anim.duration);
      const eased = 1 - (1 - t) * (1 - t);
      const arc = Math.sin(t * Math.PI) * 56;
      anim.node.position.set(
        anim.fromX + (anim.toX - anim.fromX) * eased,
        anim.fromY + (anim.toY - anim.fromY) * eased - arc,
      );
      const spin = 1 + 0.22 * Math.sin(t * Math.PI);
      anim.node.scale.set(spin * (1 - t * 0.35));
      anim.node.rotation = (1 - t) * 0.12;
      anim.node.alpha = 1 - Math.max(0, t - 0.68) / 0.32;
      if (t >= 1) {
        anim.onComplete?.();
        this.overlayRoot.removeChild(anim.node);
        anim.node.destroy({ children: true });
        this.deliveryAnimations.splice(i, 1);
      }
    }
  }

  private clearOverlayAnimations(): void {
    for (const anim of this.deliveryAnimations) {
      if (anim.node.parent) {
        anim.node.parent.removeChild(anim.node);
      }
      anim.node.destroy({ children: true });
    }
    this.deliveryAnimations = [];
    for (const anim of this.flyAnimations) {
      if (anim.node.parent) {
        anim.node.parent.removeChild(anim.node);
      }
      anim.node.destroy({ children: true });
    }
    this.flyAnimations = [];
    for (const effect of this.pulseEffects) {
      if (effect.node.parent) {
        effect.node.parent.removeChild(effect.node);
      }
      effect.node.destroy({ children: true });
    }
    this.pulseEffects = [];
    destroyContainerChildren(this.overlayRoot);
  }

  private setMessage(message: string): void {
    if (this.messageText) {
      this.messageText.text = message;
    }
  }

  private createTrayVisual(tray: Tray, width: number, height: number, showId: boolean): PIXI.Container {
    const root = new PIXI.Container();
    const holes = this.trayHolePositions(width, height);
    const trayTex = TextureCache.get(MILK_TEA_DEMO_TEXTURE_KEYS.emptyTray);
    if (trayTex) {
      const traySprite = new PIXI.Sprite(trayTex);
      traySprite.anchor.set(0.5);
      const scale = Math.min(width / trayTex.width, height / trayTex.height);
      traySprite.scale.set(scale);
      root.addChild(traySprite);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(0xfff5df, 1);
      bg.lineStyle(3, 0xb88b5a, 1);
      bg.drawRoundedRect(-width / 2, -height / 2, width, height, 14);
      bg.endFill();
      root.addChild(bg);
    }

    tray.drinks.slice(0, TRAY_CAPACITY).forEach((drinkId, index) => {
      const pos = holes[index];
      if (!pos) {
        return;
      }
      const cup = this.createDrinkVisual(drinkId, height * 0.56, width * 0.3);
      cup.position.set(pos.x, pos.y - 24);
      root.addChild(cup);
    });

    if (showId) {
      const label = new PIXI.Text(`${tray.drinks.length}/6`, {
        fontSize: 17,
        fill: 0x8b5b2b,
        fontWeight: '900',
        stroke: 0xffffff,
        strokeThickness: 3,
      });
      label.anchor.set(1, 1);
      label.resolution = 2;
      label.position.set(width / 2 - 8, height / 2 - 7);
      root.addChild(label);
    }
    return root;
  }

  private trayHolePositions(width: number, height: number): Array<{ x: number; y: number }> {
    const xs = [-0.28, 0, 0.28].map((n) => n * width);
    const ys = [-0.18, 0.18].map((n) => n * height);
    return [
      { x: xs[0], y: ys[0] },
      { x: xs[1], y: ys[0] },
      { x: xs[2], y: ys[0] },
      { x: xs[0], y: ys[1] },
      { x: xs[1], y: ys[1] },
      { x: xs[2], y: ys[1] },
    ];
  }

  private createDrinkVisual(drinkId: DrinkId, targetHeight: number, maxWidth = targetHeight * 0.78): PIXI.Container {
    const tex = TextureCache.get(milkTeaDemoDrinkTextureKey(drinkId));
    if (tex && tex.height > 2) {
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      const scale = Math.min(targetHeight / tex.height, maxWidth / tex.width);
      sprite.scale.set(scale);
      return sprite;
    }
    const drink = this.drinkMap.get(drinkId);
    if (!drink) {
      return new PIXI.Container();
    }
    return this.createDrinkCup(drink, targetHeight * 0.55, targetHeight);
  }

  private createPillButton(label: string, width: number, height: number, fill: number, stroke: number, fontSize: number): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-width / 2, -height / 2, width, height);
    const bg = new PIXI.Graphics();
    bg.beginFill(fill, 0.96);
    bg.lineStyle(4, stroke, 1);
    bg.drawRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    bg.endFill();
    root.addChild(bg);
    const text = new PIXI.Text(label, {
      fontSize,
      fill: 0x7a421d,
      fontWeight: '900',
    });
    text.anchor.set(0.5);
    text.resolution = 2;
    root.addChild(text);
    return root;
  }

  private createDrinkCup(drink: DrinkDef, width: number, height: number): PIXI.Container {
    const root = new PIXI.Container();
    const g = new PIXI.Graphics();
    const topW = width * 0.86;
    const bottomW = width * 0.62;
    const bodyH = height * 0.7;
    const topY = -height * 0.28;
    const bottomY = topY + bodyH;

    g.lineStyle(3, 0x7d4c2a, 0.9);
    g.beginFill(0xffffff, 0.86);
    g.drawRoundedRect(-topW / 2, topY - 10, topW, 14, 7);
    g.endFill();
    g.beginFill(drink.toppingColor, 1);
    g.drawEllipse(0, topY + 2, topW / 2, 9);
    g.endFill();
    g.beginFill(drink.liquidColor, 0.95);
    g.moveTo(-topW / 2 + 4, topY + 4);
    g.lineTo(topW / 2 - 4, topY + 4);
    g.lineTo(bottomW / 2, bottomY);
    g.lineTo(-bottomW / 2, bottomY);
    g.closePath();
    g.endFill();
    g.lineStyle(2, 0xffffff, 0.65);
    g.moveTo(-topW * 0.24, topY + 7);
    g.lineTo(-bottomW * 0.18, bottomY - 4);
    g.moveTo(topW * 0.25, topY + 7);
    g.lineTo(bottomW * 0.18, bottomY - 4);
    g.lineStyle(3, drink.accentColor, 0.95);
    g.moveTo(width * 0.2, topY - 20);
    g.lineTo(width * 0.32, topY + 8);

    if (drink.pattern === 0) {
      g.lineStyle(3, 0xffffff, 0.7);
      g.moveTo(-bottomW * 0.36, bottomY - 14);
      g.lineTo(bottomW * 0.36, bottomY - 14);
    } else if (drink.pattern === 1) {
      g.beginFill(0xffffff, 0.65);
      g.drawCircle(-width * 0.13, topY + bodyH * 0.52, 4);
      g.drawCircle(width * 0.11, topY + bodyH * 0.62, 3);
      g.endFill();
    } else if (drink.pattern === 2) {
      g.lineStyle(3, drink.accentColor, 0.75);
      g.moveTo(-bottomW * 0.22, topY + bodyH * 0.48);
      g.lineTo(bottomW * 0.22, topY + bodyH * 0.34);
    } else {
      g.beginFill(0xffffff, 0.72);
      g.drawRoundedRect(-width * 0.18, topY + bodyH * 0.42, width * 0.36, 10, 5);
      g.endFill();
    }

    g.beginFill(0x6a3d24, 0.28);
    g.drawEllipse(0, bottomY + 5, bottomW / 2, 5);
    g.endFill();
    root.addChild(g);
    return root;
  }
}
