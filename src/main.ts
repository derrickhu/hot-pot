import '@/core/pixiUnsafeEvalPatch';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import { SceneManager } from '@/core/SceneManager';
import { Platform } from '@/core/PlatformService';
import { LoadingOverlay } from '@/gameobjects/LoadingOverlay';
import { CloudSyncManager } from '@/managers/CloudSyncManager';
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
    const loadingOverlay = new LoadingOverlay(Game.logicWidth, Game.logicHeight, Game.safeTop);
    Game.stage.addChild(loadingOverlay.container);
    loadingOverlay.setProgress(0.08);
    await loadingOverlay.loadAssets();
    loadingOverlay.setProgress(0.28);

    CloudSyncManager.prewarm();
    loadingOverlay.setProgress(0.48);
    const startupSync = await CloudSyncManager.awaitAuthoritativeStartup();
    console.log(`[CloudSync] startup gate result status=${startupSync.status}, reason=${startupSync.reason}`);
    loadingOverlay.setProgress(0.72);
    AudioManager.initBackgroundMusic();
    Platform.onHide(() => {
      void CloudSyncManager.flushNow('app-hide');
    });

    const homeScene = new HomeScene();
    const bowlScene = new BowlScene();
    const fruitSliceScene = new FruitSliceScene();
    const catalogScene = new CatalogScene();
    SceneManager.register(homeScene);
    SceneManager.register(bowlScene);
    SceneManager.register(fruitSliceScene);
    SceneManager.register(catalogScene);
    loadingOverlay.setProgress(1);
    Game.stage.removeChild(loadingOverlay.container);
    loadingOverlay.destroy();
    SceneManager.switchTo('home');
  } catch (error) {
    console.error('[main] boot failed', error);
  }
}

main();
