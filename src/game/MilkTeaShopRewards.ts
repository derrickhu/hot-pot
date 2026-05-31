import { getMilkTeaShopLevelDef } from '@/config/milkTeaShopLevels';
import { addCoins } from '@/game/Wallet';
import { applyMilkTeaShopClear, type MilkTeaShopProgressState } from '@/game/MilkTeaShopProgress';

export interface MilkTeaShopRoundRewardInput {
  readonly shopLevel: number;
  readonly orderBagCount: number;
  readonly fiveOrderBagCount: number;
  readonly drinkTypeCount: number;
}

export interface MilkTeaShopRoundRewardResult {
  readonly coins: number;
  readonly balance: number;
  readonly previousLevel: number;
  readonly levelUps: number;
  readonly state: MilkTeaShopProgressState;
}

export function settleMilkTeaShopRound(input: MilkTeaShopRoundRewardInput): MilkTeaShopRoundRewardResult {
  const levelDef = getMilkTeaShopLevelDef(input.shopLevel);
  const coins = levelDef.roundCoins;
  const progress = applyMilkTeaShopClear();
  const wallet = addCoins(coins);
  return {
    coins,
    balance: wallet.coins,
    previousLevel: progress.previousLevel,
    levelUps: progress.levelUps,
    state: progress.state,
  };
}
