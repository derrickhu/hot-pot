export type MilkTeaShopBlockerKind = 'crate' | 'coin' | 'ad' | 'share';
export type MilkTeaShopCrateSeal = 'full' | 'half';

export interface MilkTeaShopCellBlockerDef {
  readonly row: number;
  readonly col: number;
  readonly kind: MilkTeaShopBlockerKind;
  readonly seal?: MilkTeaShopCrateSeal;
  readonly cost?: number;
}

export interface MilkTeaShopLevelDef {
  readonly level: number;
  readonly clearsToNext: number;
  readonly unlockedDrinkCount: number;
  readonly roundDrinkTypeRange: readonly [number, number];
  /** 当前店铺等级下，每局固定需要完成的订单袋数量。 */
  readonly orderBagCount: number;
  /** 每个订单袋内需要的杯数范围，每袋单独随机。 */
  readonly ordersPerBagRange: readonly [number, number];
  readonly blockers: readonly MilkTeaShopCellBlockerDef[];
  /** 待解锁格：每级 2 金币 + 1 分享 + 3 广告，位置随等级变化，不与木板箱重叠。 */
  readonly unlockCells: readonly MilkTeaShopCellBlockerDef[];
  /** 每局过关奖励金币：8 + (level - 1) × 2 */
  readonly roundCoins: number;
}

const UNLOCK_COIN_COST = 20;

const crate = (row: number, col: number, seal: MilkTeaShopCrateSeal = 'full'): MilkTeaShopCellBlockerDef => ({
  row,
  col,
  kind: 'crate',
  seal,
});

const coinUnlock = (row: number, col: number, cost = UNLOCK_COIN_COST): MilkTeaShopCellBlockerDef => ({
  row,
  col,
  kind: 'coin',
  cost,
});

const adUnlock = (row: number, col: number): MilkTeaShopCellBlockerDef => ({
  row,
  col,
  kind: 'ad',
});

const shareUnlock = (row: number, col: number): MilkTeaShopCellBlockerDef => ({
  row,
  col,
  kind: 'share',
});

export const MILK_TEA_SHOP_LEVELS: readonly MilkTeaShopLevelDef[] = [
  {
    level: 1,
    clearsToNext: 2,
    unlockedDrinkCount: 5,
    roundDrinkTypeRange: [3, 3],
    orderBagCount: 1,
    ordersPerBagRange: [3, 3],
    blockers: [crate(1, 1, 'half')],
    unlockCells: [coinUnlock(2, 0), coinUnlock(3, 0), shareUnlock(4, 3), adUnlock(4, 0), adUnlock(5, 0), adUnlock(5, 3)],
    roundCoins: 8,
  },
  {
    level: 2,
    clearsToNext: 3,
    unlockedDrinkCount: 6,
    roundDrinkTypeRange: [3, 4],
    orderBagCount: 2,
    ordersPerBagRange: [3, 4],
    blockers: [crate(0, 1, 'half'), crate(1, 3, 'full')],
    unlockCells: [coinUnlock(2, 0), coinUnlock(3, 0), shareUnlock(2, 3), adUnlock(4, 0), adUnlock(5, 0), adUnlock(5, 3)],
    roundCoins: 10,
  },
  {
    level: 3,
    clearsToNext: 6,
    unlockedDrinkCount: 7,
    roundDrinkTypeRange: [4, 4],
    orderBagCount: 3,
    ordersPerBagRange: [4, 5],
    blockers: [crate(0, 1, 'half'), crate(0, 2, 'half'), crate(1, 0, 'full'), crate(1, 3, 'full')],
    unlockCells: [coinUnlock(2, 0), coinUnlock(3, 0), shareUnlock(4, 3), adUnlock(3, 3), adUnlock(5, 0), adUnlock(5, 3)],
    roundCoins: 12,
  },
  {
    level: 4,
    clearsToNext: 10,
    unlockedDrinkCount: 8,
    roundDrinkTypeRange: [4, 5],
    orderBagCount: 4,
    ordersPerBagRange: [4, 5],
    blockers: [crate(0, 0, 'full'), crate(0, 3, 'half'), crate(2, 1, 'full'), crate(2, 2, 'half')],
    unlockCells: [coinUnlock(1, 0), coinUnlock(3, 0), shareUnlock(4, 0), adUnlock(4, 3), adUnlock(5, 1), adUnlock(5, 2)],
    roundCoins: 14,
  },
  {
    level: 5,
    clearsToNext: 15,
    unlockedDrinkCount: 9,
    roundDrinkTypeRange: [5, 5],
    orderBagCount: 5,
    ordersPerBagRange: [4, 5],
    blockers: [crate(0, 1, 'full'), crate(0, 2, 'full'), crate(1, 0, 'half'), crate(2, 3, 'half'), crate(3, 1, 'full')],
    unlockCells: [coinUnlock(1, 3), coinUnlock(2, 0), shareUnlock(3, 0), adUnlock(3, 3), adUnlock(4, 0), adUnlock(5, 3)],
    roundCoins: 16,
  },
  {
    level: 6,
    clearsToNext: 20,
    unlockedDrinkCount: 10,
    roundDrinkTypeRange: [5, 6],
    orderBagCount: 5,
    ordersPerBagRange: [4, 6],
    blockers: [
      crate(0, 0, 'half'),
      crate(0, 3, 'full'),
      crate(1, 1, 'full'),
      crate(1, 2, 'half'),
      crate(2, 2, 'full'),
      crate(3, 0, 'half'),
    ],
    unlockCells: [coinUnlock(2, 0), coinUnlock(4, 0), shareUnlock(5, 0), adUnlock(1, 3), adUnlock(3, 3), adUnlock(5, 3)],
    roundCoins: 18,
  },
  {
    level: 7,
    clearsToNext: 20,
    unlockedDrinkCount: 11,
    roundDrinkTypeRange: [6, 6],
    orderBagCount: 5,
    ordersPerBagRange: [5, 6],
    blockers: [
      crate(0, 1, 'full'),
      crate(0, 2, 'half'),
      crate(1, 3, 'full'),
      crate(2, 0, 'half'),
      crate(2, 2, 'full'),
      crate(3, 1, 'half'),
    ],
    unlockCells: [coinUnlock(0, 0), coinUnlock(3, 0), shareUnlock(4, 3), adUnlock(1, 0), adUnlock(5, 0), adUnlock(5, 3)],
    roundCoins: 20,
  },
  {
    level: 8,
    clearsToNext: 20,
    unlockedDrinkCount: 12,
    roundDrinkTypeRange: [6, 7],
    orderBagCount: 6,
    ordersPerBagRange: [5, 6],
    blockers: [
      crate(0, 0, 'full'),
      crate(0, 3, 'full'),
      crate(1, 1, 'half'),
      crate(1, 2, 'full'),
      crate(2, 0, 'half'),
      crate(3, 2, 'full'),
    ],
    unlockCells: [coinUnlock(2, 3), coinUnlock(3, 3), shareUnlock(4, 0), adUnlock(0, 1), adUnlock(4, 3), adUnlock(5, 2)],
    roundCoins: 22,
  },
  {
    level: 9,
    clearsToNext: 20,
    unlockedDrinkCount: 13,
    roundDrinkTypeRange: [6, 7],
    orderBagCount: 6,
    ordersPerBagRange: [5, 6],
    blockers: [
      crate(0, 1, 'full'),
      crate(0, 2, 'full'),
      crate(1, 0, 'half'),
      crate(1, 3, 'full'),
      crate(2, 1, 'full'),
      crate(2, 2, 'half'),
    ],
    unlockCells: [coinUnlock(2, 0), coinUnlock(3, 0), shareUnlock(0, 3), adUnlock(4, 0), adUnlock(5, 1), adUnlock(5, 3)],
    roundCoins: 24,
  },
  {
    level: 10,
    clearsToNext: 20,
    unlockedDrinkCount: 14,
    roundDrinkTypeRange: [7, 7],
    orderBagCount: 6,
    ordersPerBagRange: [6, 6],
    blockers: [
      crate(0, 0, 'full'),
      crate(0, 3, 'half'),
      crate(1, 1, 'full'),
      crate(1, 2, 'full'),
      crate(2, 0, 'full'),
      crate(3, 2, 'half'),
    ],
    unlockCells: [coinUnlock(2, 3), coinUnlock(4, 0), shareUnlock(5, 0), adUnlock(3, 0), adUnlock(4, 3), adUnlock(5, 3)],
    roundCoins: 26,
  },
  {
    level: 11,
    clearsToNext: 20,
    unlockedDrinkCount: 15,
    roundDrinkTypeRange: [7, 7],
    orderBagCount: 6,
    ordersPerBagRange: [6, 6],
    blockers: [
      crate(0, 1, 'full'),
      crate(0, 2, 'full'),
      crate(1, 0, 'full'),
      crate(1, 3, 'full'),
      crate(2, 1, 'half'),
      crate(2, 2, 'full'),
    ],
    unlockCells: [coinUnlock(0, 0), coinUnlock(3, 0), shareUnlock(4, 0), adUnlock(2, 3), adUnlock(5, 0), adUnlock(5, 3)],
    roundCoins: 28,
  },
  {
    level: 12,
    clearsToNext: 0,
    unlockedDrinkCount: 16,
    roundDrinkTypeRange: [7, 8],
    orderBagCount: 6,
    ordersPerBagRange: [6, 6],
    blockers: [
      crate(0, 0, 'full'),
      crate(0, 3, 'full'),
      crate(1, 1, 'full'),
      crate(1, 2, 'full'),
      crate(2, 0, 'full'),
      crate(2, 3, 'full'),
    ],
    unlockCells: [coinUnlock(3, 0), coinUnlock(4, 0), shareUnlock(5, 1), adUnlock(0, 1), adUnlock(3, 3), adUnlock(5, 3)],
    roundCoins: 30,
  },
];

export const MILK_TEA_SHOP_MAX_LEVEL = MILK_TEA_SHOP_LEVELS[MILK_TEA_SHOP_LEVELS.length - 1]!.level;

export function getMilkTeaShopLevelDef(level: number): MilkTeaShopLevelDef {
  const normalized = Math.max(1, Math.floor(Number(level) || 1));
  return MILK_TEA_SHOP_LEVELS.find((def) => def.level === normalized)
    ?? MILK_TEA_SHOP_LEVELS[MILK_TEA_SHOP_LEVELS.length - 1]!;
}
