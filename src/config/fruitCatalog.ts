import { BOWL_LEVELS, BOWL_UNLOCKABLE_FRUIT_IDS } from '@/config/bowlLevels';
import { FRUIT_CONFIGS, type FruitConfig, type FruitId } from '@/config/fruits';
import { FRUIT_SLICE_WHOLE_PATH } from '@/config/fruitSliceWhole';
import { getMaxUnlockedBowlLevelIndex } from '@/game/BowlProgress';

export interface CatalogSlot {
  id: FruitId;
  textureKey: string;
  assetCandidates: string[];
  label: string;
  unlocked: boolean;
}

const FRUIT_BOOK_ROOT = 'subpackages/catalog_assets/assets/images/fruit_book';

/** 图鉴加载顺序：先碗内贴图（配料与水果一致），再果切/图鉴整果，最后通用 whole 文件名兜底 */
function catalogAssetCandidates(fruit: FruitConfig): string[] {
  const out: string[] = [];
  const push = (p?: string) => {
    if (p && !out.includes(p)) {
      out.push(p);
    }
  };
  push(fruit.asset);
  push(fruit.bowlAsset2);
  const sliceBookWhole = FRUIT_SLICE_WHOLE_PATH[fruit.id as keyof typeof FRUIT_SLICE_WHOLE_PATH];
  if (typeof sliceBookWhole === 'string') {
    push(sliceBookWhole);
  }
  push(`${FRUIT_BOOK_ROOT}/fruit_${fruit.id}_whole.png`);
  return out;
}

export function getUnlockedFruitIds(): Set<FruitId> {
  const maxLevel = Math.max(0, Math.min(getMaxUnlockedBowlLevelIndex(), BOWL_LEVELS.length - 1));
  const unlocked = new Set<FruitId>();
  for (let i = 0; i <= maxLevel; i += 1) {
    for (const id of BOWL_LEVELS[i]!.fruitIds) {
      if (id !== 'ice_cube') {
        unlocked.add(id);
      }
    }
  }
  return unlocked;
}

/** 图鉴展示全部可收集食材；未解锁显示问号，占位不消失。 */
export function getCatalogSlots(): CatalogSlot[] {
  const unlocked = getUnlockedFruitIds();
  const unlockable = new Set<FruitId>(BOWL_UNLOCKABLE_FRUIT_IDS);
  return FRUIT_CONFIGS.filter((fruit) => unlockable.has(fruit.id)).map((fruit) => ({
    id: fruit.id,
    textureKey: `cat_${fruit.id}`,
    assetCandidates: catalogAssetCandidates(fruit),
    label: fruit.label,
    unlocked: unlocked.has(fruit.id),
  }));
}
