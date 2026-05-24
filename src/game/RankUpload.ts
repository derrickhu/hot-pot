import { BOWL_LEVEL_COUNT } from '@/config/bowlLevels';
import { BackendService } from '@/core/BackendService';
import { getMaxUnlockedBowlBadgeLevelNumber } from '@/game/BowlProgress';
import { getFruitSliceBestScore } from '@/game/FruitSliceProgress';
import { RankService } from '@/services/RankService';
import { UserProfileService } from '@/services/UserProfileService';
import { uploadFriendScores } from '@/utils/friendRanking';

/**
 * 客户端排行榜上报模块
 * ---------------------------------------------------------------
 * - `submitCurrentBowlProgressRank()` 通关时上报已通关关数（badgeLevel）
 * - `submitFruitBestRankIfNeeded(isNewBest)` 果切刷新最高分时上报
 * - `flushPendingRankUploads()` / `awaitFlushPendingRankUploads()` 打开榜单时兜底
 *
 * 上报时会从 UserProfileService 自动附带玩家本机的微信昵称 / 头像（如已授权），
 * 资料变化时会清掉本地去重 key，下一次上报会强制重传以更新后端 displayName / avatarUrl。
 */

let bowlUploadKey = '';
let fruitUploadScore = 0;
/** 上次成功上报时附带的资料指纹（用于资料更新后强制重传） */
let lastProfileFingerprint = '';
/**
 * 当前正在飞行中的 bowl/fruit submit Promise；用于 awaitFlushPendingRankUploads
 * 等"打开榜单时机"被调用时，把 in-flight 的请求也 await 上，避免 list 早于 submit 落库。
 *
 * 没有这层跟踪的话：通关后自动 submit 还在路上，玩家立刻打开榜单 → dedupe 命中
 * → awaitFlushPendingRankUploads 立刻 resolve → loadList 拿到 submit 之前的旧 DB 数据。
 */
let inFlightBowlSubmit: Promise<unknown> | null = null;
let inFlightFruitSubmit: Promise<unknown> | null = null;

const RANK_UPLOAD_BLOCKED_USER_IDS = new Set([
  // GM 测试账号：不上传世界榜，也不刷新微信好友榜 KV。
  'wx:oB0xx3SeJgkkU0_ONokPrzvFljrE',
]);

/**
 * 资料一旦更新（拿到真实微信昵称 / 头像）：
 *   1. 清掉本进程内的去重缓存，避免新资料被旧 key 短路
 *   2. **立刻主动**发起一次 flushPendingRankUploads —— 不再依赖 LeaderboardScene.onEnter
 *      之类的"打开榜单"时机，否则只要玩家授权完没打开榜单（或上一次切场景错过 await），
 *      云端那条记录就永远停留在「水果达人XXXX + 空头像」。
 */
UserProfileService.onChange((profile) => {
  bowlUploadKey = '';
  fruitUploadScore = 0;
  lastProfileFingerprint = '';
  console.log(
    `[RankUpload] profile changed, force re-upload (nick=${profile?.nickName || '(empty)'}` +
      ` avatar=${profile?.avatarUrl ? profile.avatarUrl.slice(0, 32) + '...' : '(empty)'})`,
  );
  flushPendingRankUploads();
});

function profileFingerprint(): string {
  const fields = UserProfileService.getProfileForRankSubmit();
  return `${fields.displayName || ''}|${fields.avatarUrl || ''}`;
}

function shouldSkipBackend(): boolean {
  return !RankService.available;
}

function isRankUploadBlockedUser(): boolean {
  return RANK_UPLOAD_BLOCKED_USER_IDS.has(BackendService.userId);
}

function shouldSkipRankUpload(): boolean {
  return shouldSkipBackend() || isRankUploadBlockedUser();
}

/** 排行榜口径：已通关关数；尚未通关任何关时返回 0（不上榜）。 */
function getBowlClearedLevelForRank(): number {
  return Math.min(BOWL_LEVEL_COUNT, Math.max(0, getMaxUnlockedBowlBadgeLevelNumber()));
}

/**
 * 同步把当前已通关关数 / 果切高分推送到微信 KV（好友榜数据源）。
 * - 任何主流程的 RankService.submit 之后调一次即可，内置节流避免刷接口；
 * - 不依赖 CloudBase，离线 / 未启用后端时也能让好友榜显示。
 */
function syncFriendRankFromLocal(): void {
  if (isRankUploadBlockedUser()) {
    return;
  }
  const clearedLevel = getBowlClearedLevelForRank();
  const score = getFruitSliceBestScore();
  uploadFriendScores(clearedLevel, score);
}

/**
 * 把"当前本地已通关关数"上报到 bowl 排行榜。
 * 进程内会按 `${clearedLevel}:${fp}` 去重，重复调用零开销；
 * 后端 `isBetterRecord` 也会兜底拦截非更优记录。
 */
export function submitCurrentBowlProgressRank(): void {
  if (shouldSkipRankUpload()) {
    return;
  }
  const clearedLevel = getBowlClearedLevelForRank();
  if (clearedLevel <= 0) {
    return;
  }
  const profile = UserProfileService.getProfileForRankSubmit();
  const fp = profileFingerprint();
  const key = `${clearedLevel}:${fp}`;
  // 微信好友榜 KV 节流 10s，跟后端去重独立；通关后同步刷一刀确保好友榜也是最新
  syncFriendRankFromLocal();
  if (key === bowlUploadKey) {
    return;
  }
  bowlUploadKey = key;
  lastProfileFingerprint = fp;
  console.log(
    `[RankUpload] submit bowl cleared=${clearedLevel}` +
      ` name=${profile.displayName || '(default)'} avatarUrl=${profile.avatarUrl ? 'yes' : 'no'}`,
  );
  const flight = RankService.submitBowlProgress(clearedLevel, clearedLevel, profile)
    .then((result) => {
      maybeUnlockDedupeOnMismatch('bowl', profile, result);
      console.log(
        `[RankUpload] submit bowl ok updated=${result?.updated} mode=${result?.mode || '-'}` +
          ` reason=${result?.reason || '-'}`,
      );
    })
    .catch((error: any) => {
      bowlUploadKey = '';
      console.warn(
        '[RankUpload] submit bowl progress failed:',
        error?.message || error,
        error?.stack ? `\n${error.stack}` : '',
      );
    })
    .finally(() => {
      if (inFlightBowlSubmit === flight) {
        inFlightBowlSubmit = null;
      }
    });
  inFlightBowlSubmit = flight;
  void flight;
}

/**
 * 果切高分上报：仅在玩家本局打出新最高分时调用。
 * isNewBest=false 时直接 return，避免无意义网络请求。
 */
export function submitFruitBestRankIfNeeded(isNewBest: boolean): void {
  if (!isNewBest || shouldSkipRankUpload()) {
    return;
  }
  submitFruitBestNow();
}

/**
 * 强制把当前 best 分数上报一次。仅供「打开排行榜」之类的兜底场景使用：
 * 由 fruitUploadScore 在本进程内去重，已经上报过的不会重发。
 */
export function submitFruitBestNow(): void {
  if (shouldSkipRankUpload()) {
    return;
  }
  const score = getFruitSliceBestScore();
  if (score <= 0) {
    return;
  }
  const profile = UserProfileService.getProfileForRankSubmit();
  const fp = profileFingerprint();
  syncFriendRankFromLocal();
  if (score <= fruitUploadScore && fp === lastProfileFingerprint) {
    return;
  }
  fruitUploadScore = Math.max(fruitUploadScore, score);
  lastProfileFingerprint = fp;
  console.log(
    `[RankUpload] submit fruit best score=${score}` +
      ` name=${profile.displayName || '(default)'} avatarUrl=${profile.avatarUrl ? 'yes' : 'no'}`,
  );
  const flight = RankService.submitFruitBest(score, profile)
    .then((result) => {
      maybeUnlockDedupeOnMismatch('fruit', profile, result);
      console.log(
        `[RankUpload] submit fruit ok updated=${result?.updated} mode=${result?.mode || '-'}` +
          ` reason=${result?.reason || '-'}`,
      );
    })
    .catch((error: any) => {
      fruitUploadScore = 0;
      console.warn(
        '[RankUpload] submit fruit best failed:',
        error?.message || error,
        error?.stack ? `\n${error.stack}` : '',
      );
    })
    .finally(() => {
      if (inFlightFruitSubmit === flight) {
        inFlightFruitSubmit = null;
      }
    });
  inFlightFruitSubmit = flight;
  void flight;
}

/**
 * 「打开排行榜」前的兜底上报：把当前本地最佳成绩同时刷新到两个榜单。
 * 即使玩家在通关时漏报（旧版本逻辑 bug / 网络异常），打开榜单时也能补上。
 */
export function flushPendingRankUploads(): void {
  submitCurrentBowlProgressRank();
  submitFruitBestNow();
}

/**
 * 同步版兜底：返回一个 Promise，待两份上报真正落库后才 resolve。
 * 用于 LeaderboardScene.onEnter 等需要"先 submit 再 list"的场景；
 * 任一上报失败也 resolve（不阻塞玩家进入榜单页查看其他玩家成绩）。
 */
export async function awaitFlushPendingRankUploads(): Promise<void> {
  // 即使 CloudBase 不可用，好友榜走的是微信 KV，也要刷一刀
  syncFriendRankFromLocal();
  if (shouldSkipRankUpload()) {
    return;
  }
  // 先把"打开榜单"前已经发起、还在飞行中的 submit 等完，
  // 否则 dedupe 命中时 awaitFlushPendingRankUploads 会立刻 resolve，
  // list 调用拿到的还是 submit 之前的旧 DB 数据。
  const inFlight: Array<Promise<unknown>> = [];
  if (inFlightBowlSubmit) inFlight.push(inFlightBowlSubmit);
  if (inFlightFruitSubmit) inFlight.push(inFlightFruitSubmit);
  if (inFlight.length > 0) {
    console.log(`[RankUpload] await in-flight submits before list (${inFlight.length})`);
    await Promise.allSettled(inFlight);
  }

  const tasks: Array<Promise<unknown>> = [];
  const profile = UserProfileService.getProfileForRankSubmit();
  const fp = profileFingerprint();

  const clearedLevel = getBowlClearedLevelForRank();
  const bowlKey = clearedLevel > 0 ? `${clearedLevel}:${fp}` : '';
  if (bowlKey && bowlKey !== bowlUploadKey) {
    bowlUploadKey = bowlKey;
    console.log(
      `[RankUpload] flush bowl cleared=${clearedLevel}` +
        ` name=${profile.displayName || '(default)'} avatarUrl=${profile.avatarUrl ? 'yes' : 'no'}`,
    );
    const flight = RankService.submitBowlProgress(clearedLevel, clearedLevel, profile)
      .then((result) => {
        maybeUnlockDedupeOnMismatch('bowl', profile, result);
        console.log(
          `[RankUpload] flush bowl ok updated=${result?.updated} mode=${result?.mode || '-'}` +
            ` reason=${result?.reason || '-'}`,
        );
      })
      .catch((error: any) => {
        bowlUploadKey = '';
        console.warn(
          '[RankUpload] flush bowl progress failed:',
          error?.message || error,
          error?.stack ? `\n${error.stack}` : '',
        );
      })
      .finally(() => {
        if (inFlightBowlSubmit === flight) {
          inFlightBowlSubmit = null;
        }
      });
    inFlightBowlSubmit = flight;
    tasks.push(flight);
  }

  const score = getFruitSliceBestScore();
  if (score > 0 && (score > fruitUploadScore || fp !== lastProfileFingerprint)) {
    fruitUploadScore = Math.max(fruitUploadScore, score);
    console.log(
      `[RankUpload] flush fruit best score=${score}` +
        ` name=${profile.displayName || '(default)'} avatarUrl=${profile.avatarUrl ? 'yes' : 'no'}`,
    );
    const flight = RankService.submitFruitBest(score, profile)
      .then((result) => {
        maybeUnlockDedupeOnMismatch('fruit', profile, result);
        console.log(
          `[RankUpload] flush fruit ok updated=${result?.updated} mode=${result?.mode || '-'}` +
            ` reason=${result?.reason || '-'}`,
        );
      })
      .catch((error: any) => {
        fruitUploadScore = 0;
        console.warn(
          '[RankUpload] flush fruit best failed:',
          error?.message || error,
          error?.stack ? `\n${error.stack}` : '',
        );
      })
      .finally(() => {
        if (inFlightFruitSubmit === flight) {
          inFlightFruitSubmit = null;
        }
      });
    inFlightFruitSubmit = flight;
    tasks.push(flight);
  }

  lastProfileFingerprint = fp;

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}

/**
 * 兜底：当云函数回来的 record.displayName / avatarUrl 跟我们这次发出去的 profile 不一致时，
 * 说明本次上报没有把客户端期望的资料写进 DB（最常见原因：云函数还在跑没有 profile_update
 * 分支的老版本）。清掉对应去重缓存，让下一次 LeaderboardScene.onEnter 还能重新尝试，
 * 不至于因为客户端进程内 dedupe 而把"没上报成功"锁成"已上报"。
 */
function maybeUnlockDedupeOnMismatch(
  board: 'bowl' | 'fruit',
  profile: { displayName?: string; avatarUrl?: string },
  result: { updated?: boolean; mode?: string; record?: { displayName?: string; avatarUrl?: string } | null } | undefined,
): void {
  // 我们这次根本没有真实昵称/头像可传 —— 不存在不一致，直接锁定 dedupe 即可
  const wanted = profile.displayName || '';
  const wantedAvatar = profile.avatarUrl || '';
  if (!wanted && !wantedAvatar) {
    return;
  }
  // 云函数已经把 profile 写进去了，dedupe 锁定符合预期
  if (result?.mode === 'profile_update' || result?.mode === 'update' || result?.mode === 'insert') {
    return;
  }
  const got = result?.record?.displayName || '';
  const gotAvatar = result?.record?.avatarUrl || '';
  const nameMismatch = wanted && wanted !== got;
  const avatarMismatch = wantedAvatar && wantedAvatar !== gotAvatar;
  if (!nameMismatch && !avatarMismatch) {
    return;
  }
  console.warn(
    `[RankUpload] ${board} profile mismatch on server, will retry next time:` +
      ` wantedName="${wanted}" gotName="${got}"` +
      ` wantedAvatar=${wantedAvatar ? 'yes' : 'no'} gotAvatar=${gotAvatar ? 'yes' : 'no'}` +
      ` mode=${result?.mode || '-'}`,
  );
  if (board === 'bowl') {
    bowlUploadKey = '';
  } else {
    fruitUploadScore = 0;
  }
  lastProfileFingerprint = '';
}
