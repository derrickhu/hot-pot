import '@/core/pixiUnsafeEvalPatch';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import { SceneManager } from '@/core/SceneManager';
import { BowlScene } from '@/scenes/BowlScene';
import { CatalogScene } from '@/scenes/CatalogScene';
import { FruitSliceScene } from '@/scenes/FruitSliceScene';
import { HomeScene } from '@/scenes/HomeScene';

async function main(): Promise<void> {
  try {
    const canvas = (typeof GameGlobal !== 'undefined' && GameGlobal.canvas)
      || (typeof globalThis !== 'undefined' && (globalThis as any).canvas);

    if (!canvas) {
      throw new Error('Canvas not found');
    }

    Game.init(canvas);
    AudioManager.initBackgroundMusic();

    const homeScene = new HomeScene();
    const bowlScene = new BowlScene();
    const fruitSliceScene = new FruitSliceScene();
    const catalogScene = new CatalogScene();
    SceneManager.register(homeScene);
    SceneManager.register(bowlScene);
    SceneManager.register(fruitSliceScene);
    SceneManager.register(catalogScene);
    SceneManager.switchTo('home');
  } catch (error) {
    console.error('[main] boot failed', error);
  }
}

main();
