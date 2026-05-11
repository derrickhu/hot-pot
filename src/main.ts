import '@/core/pixiUnsafeEvalPatch';
import { analytics, EVENT_NAMES, initAnalytics, setAnalyticsUserId } from '@/analytics';
import { AudioManager } from '@/core/AudioManager';
import { Game } from '@/core/Game';
import { SceneManager } from '@/core/SceneManager';
import { Platform } from '@/core/PlatformService';
import { hasBowlProgressRecord, markBowlProgressStarted } from '@/game/BowlProgress';
import { LoadingOverlay } from '@/gameobjects/LoadingOverlay';
import { CloudSyncManager } from '@/managers/CloudSyncManager';
import { BowlScene } from '@/scenes/BowlScene';
import { CatalogScene } from '@/scenes/CatalogScene';
import { FruitSliceEndlessScene } from '@/scenes/FruitSliceEndlessScene';
import { HomeScene } from '@/scenes/HomeScene';
import { LeaderboardScene } from '@/scenes/LeaderboardScene';
import { setupWechatShare } from '@/utils/wechatShare';

async function main(): Promise<void> {
  try {
    const canvas = (typeof GameGlobal !== 'undefined' && GameGlobal.canvas)
      || (typeof globalThis !== 'undefined' && (globalThis as any).canvas);

    if (!canvas) {
      throw new Error('Canvas not found');
    }

    Game.init(canvas);
    setupWechatShare();
    initAnalytics();
    // session_start 不在启动时立刻打：那时还没拿到 openid，事件 user_id='' 只挂在 anonymous_id 上，
    // 后端会把同一玩家算成 anonymous + user_id 两个 uk 造成 DAU 双计数。
    // 推迟到 setAnalyticsUserId 之后再打，这样 session_start 就直接带 user_id 入库。

    const loadingOverlay = new LoadingOverlay(Game.logicWidth, Game.logicHeight, Game.safeTop);
    Game.stage.addChild(loadingOverlay.container);
    loadingOverlay.setProgress(0.08);
    await loadingOverlay.loadAssets();
    loadingOverlay.setProgress(0.28);

    CloudSyncManager.prewarm();
    loadingOverlay.setProgress(0.48);
    const startupSync = await CloudSyncManager.awaitAuthoritativeStartup();
    console.log(`[CloudSync] startup gate result status=${startupSync.status}, reason=${startupSync.reason}`);
    if (CloudSyncManager.userId) {
      // 默认会自动 track 一次 LOGIN 事件并立即 flush，不再等 15s batch
      setAnalyticsUserId(CloudSyncManager.userId);
    }
    // CloudSync 失败时 user_id 仍为空，这里也要兜底打 session_start，避免 DAU 漏统计
    analytics.track(EVENT_NAMES.SESSION_START, {
      entry: 'main',
      // 标记这条事件是否带上了真实 user_id（false=匿名兜底，登录失败的离群样本）
      with_user_id: !!CloudSyncManager.userId,
    });
    loadingOverlay.setProgress(0.72);
    AudioManager.initBackgroundMusic();
    Platform.onHide(() => {
      void CloudSyncManager.flushNow('app-hide');
      analytics.track(EVENT_NAMES.SESSION_END, { reason: 'app-hide' });
    });

    const homeScene = new HomeScene();
    const bowlScene = new BowlScene();
    const fruitSliceScene = new FruitSliceEndlessScene();
    const catalogScene = new CatalogScene();
    const leaderboardScene = new LeaderboardScene();
    SceneManager.register(homeScene);
    SceneManager.register(bowlScene);
    SceneManager.register(fruitSliceScene);
    SceneManager.register(catalogScene);
    SceneManager.register(leaderboardScene);
    const shouldEnterFirstLevel = !hasBowlProgressRecord();
    if (shouldEnterFirstLevel) {
      markBowlProgressStarted();
      loadingOverlay.setProgress(0.86);
      await SceneManager.prepare('bowl');
    }
    loadingOverlay.setProgress(1);
    Game.stage.removeChild(loadingOverlay.container);
    loadingOverlay.destroy();
    SceneManager.switchTo(shouldEnterFirstLevel ? 'bowl' : 'home');
  } catch (error) {
    console.error('[main] boot failed', error);
  }
}

main();
