export const GAMEPLAY_REWARDED_AD_UNIT_ID = 'adunit-baadf000b7626d29';

export type RewardedAdResult = 'completed' | 'skipped' | 'unavailable' | 'error';

type RewardedVideoAd = ReturnType<NonNullable<typeof wx.createRewardedVideoAd>>;

let gameplayRewardedAd: RewardedVideoAd | null = null;
let pendingResolve: ((result: RewardedAdResult) => void) | null = null;
let rewardedAdListenersReady = false;

function finishPendingRewardedAd(result: RewardedAdResult): void {
  const resolve = pendingResolve;
  if (!resolve) {
    return;
  }
  pendingResolve = null;
  resolve(result);
}

function bindGameplayRewardedAdListeners(ad: RewardedVideoAd): void {
  if (rewardedAdListenersReady) {
    return;
  }
  rewardedAdListenersReady = true;
  ad.onClose((res?: { isEnded?: boolean }) => {
    finishPendingRewardedAd(res?.isEnded === false ? 'skipped' : 'completed');
  });
  ad.onError((err: { errMsg?: string; errCode?: number }) => {
    console.warn('Rewarded video ad error', err);
    finishPendingRewardedAd('error');
  });
}

function getGameplayRewardedAd(): RewardedVideoAd | null {
  if (typeof wx === 'undefined' || !wx.createRewardedVideoAd) {
    return null;
  }
  try {
    gameplayRewardedAd ??= wx.createRewardedVideoAd({ adUnitId: GAMEPLAY_REWARDED_AD_UNIT_ID });
    bindGameplayRewardedAdListeners(gameplayRewardedAd);
    return gameplayRewardedAd;
  } catch {
    return null;
  }
}

export async function showGameplayRewardedAd(): Promise<RewardedAdResult> {
  const ad = getGameplayRewardedAd();
  if (!ad) {
    return 'unavailable';
  }
  if (pendingResolve) {
    return 'error';
  }

  return new Promise<RewardedAdResult>((resolve) => {
    pendingResolve = resolve;

    ad.show()
      .catch(() => ad.load().then(() => ad.show()))
      .catch(() => {
        finishPendingRewardedAd('error');
      });
  });
}
