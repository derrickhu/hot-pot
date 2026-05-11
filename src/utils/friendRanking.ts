/**
 * 微信小游戏好友榜（openDataContext 子上下文）主域 helper
 * ---------------------------------------------------------------
 * 微信对好友榜数据有强制要求：
 *   1. 主域只能 `wx.setUserCloudStorage` 写入自己的 KV，
 *      不能直接读取好友数据；
 *   2. 好友数据必须放到开放数据域子上下文里通过 `wx.getFriendCloudStorage` 拉取，
 *      绘制结果写到 sharedCanvas，再由主域贴上屏。
 *
 * 本模块负责主域侧职责：
 *   - 上报当前用户在「叠碗」与「水果切切乐」两个榜的分数；
 *   - 同步 sharedCanvas 物理像素尺寸（新基础库下子域只读，必须主域写入）；
 *   - 通过 postMessage 驱动子域渲染并清缓存。
 *
 * 子域实现见 `openDataContext/index.js`。
 */

/** 好友榜 tab 标识，需与 `openDataContext/index.js:TAB_META` 完全一致 */
export type FriendRankTab = 'bowl' | 'fruit';

/** KV key 与子域 TAB_META[*].key 保持一致 */
const KV_KEY: Record<FriendRankTab, string> = {
  bowl: 'hotpot_bowl_level',
  fruit: 'hotpot_fruit_score',
};

const MIN_UPLOAD_GAP_MS = 10 * 1000;
let lastUploadTs = 0;
const lastVals: Record<FriendRankTab, number> = { bowl: 0, fruit: 0 };
let friendRankUploadDisabledReason = '';

let lastCanvasW = 0;
let lastCanvasH = 0;

function isCredentialError(err: { errMsg?: string; err_code?: number } | undefined): boolean {
  const msg = err?.errMsg || '';
  return err?.err_code === 40001 || /invalid credential|access_token/i.test(msg);
}

/** 当前环境是否支持好友榜：必须是微信小游戏且具备 openDataContext */
export function isFriendRankSupported(): boolean {
  if (typeof wx === 'undefined') return false;
  if (typeof wx.getOpenDataContext !== 'function') return false;
  return true;
}

function getOpenDataContext(): ReturnType<NonNullable<typeof wx.getOpenDataContext>> | null {
  if (!isFriendRankSupported()) return null;
  try {
    return wx.getOpenDataContext!();
  } catch (e) {
    console.warn('[FriendRank] getOpenDataContext throw', e);
    return null;
  }
}

/** 取 sharedCanvas，主域只用它作为 PIXI 纹理来源；不应直接绘制 */
export function getSharedCanvas(): (HTMLCanvasElement & { width: number; height: number }) | null {
  const odc = getOpenDataContext();
  return odc ? odc.canvas : null;
}

/**
 * 主域侧同步 sharedCanvas 物理像素尺寸。
 * 新基础库下子域内 sharedCanvas 的 width/height 只读，必须主域负责。
 * 只在目标尺寸真正变化时赋值，避免每帧 reset 清空绘制内容。
 */
export function ensureSharedCanvasSize(width: number, height: number): void {
  const canvas = getSharedCanvas();
  if (!canvas) return;
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (lastCanvasW === w && lastCanvasH === h && canvas.width === w && canvas.height === h) return;
  try {
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    lastCanvasW = w;
    lastCanvasH = h;
  } catch (e) {
    console.warn('[FriendRank] sharedCanvas resize failed', e);
  }
}

/** 向子上下文发送消息，可吞掉异常 */
export function postMessage(msg: Record<string, unknown>): void {
  const odc = getOpenDataContext();
  if (!odc || typeof odc.postMessage !== 'function') return;
  try {
    odc.postMessage(msg);
  } catch (e) {
    console.warn('[FriendRank] postMessage failed', e);
  }
}

let warmupDone = false;
let prefetchedTabs: Partial<Record<FriendRankTab, number>> = {};
const PREFETCH_TTL_MS = 30 * 1000;

/**
 * 预热 openDataContext 子上下文：
 *  - 第一次 `wx.getOpenDataContext()` 调用会让微信冷启动一个独立 JS 沙箱并加载 openDataContext/ 内的代码，
 *    冷启动本身就有 ~100-500ms。提前在 HomeScene 触发，可以把这段时间藏到玩家进入主页之后、
 *    点开排行榜之前，让首次点击"好友榜" tab 时少等一截。
 *  - 只触发一次，重复调用是 no-op。
 *  - 失败完全静默：好友榜不可用本来也只是降级。
 */
export function warmupFriendRankContext(): void {
  if (warmupDone) return;
  if (!isFriendRankSupported()) {
    warmupDone = true;
    return;
  }
  try {
    // 仅 spawn 子上下文 + 拿一次 canvas 句柄，触发 JS 加载。
    // 不传任何 message，子域内部除了注册 wx.onMessage 不会再做别的事。
    const odc = getOpenDataContext();
    if (odc) {
      try {
        odc.canvas;
      } catch (_) {
        // 忽略：部分基础库版本下 canvas getter 还没就绪也无所谓，
        // 真正用的时候 getSharedCanvas() 会再取一次
      }
    }
  } catch (e) {
    console.warn('[FriendRank] warmup failed', e);
  } finally {
    warmupDone = true;
  }
}

/**
 * 提前在后台让子域去拉 KV，把结果填到子域 60s 缓存里。
 * 用户随后点开"好友榜" tab 时，子域命中缓存直接绘制，可省掉一次完整网络等待。
 *
 * - 默认 30s 节流（同一 tab）避免反复触发 wx 网络
 * - 不会绘制任何东西（postMessage 走 silent prefetch 通道）
 * - 完全静默，失败也不会影响主域
 */
export function prefetchFriendRank(
  tab: FriendRankTab,
  opts?: { force?: boolean }
): void {
  if (!isFriendRankSupported()) return;
  warmupFriendRankContext();
  const now = Date.now();
  const last = prefetchedTabs[tab] || 0;
  if (!opts?.force && now - last < PREFETCH_TTL_MS) return;
  prefetchedTabs[tab] = now;
  postMessage({ action: 'prefetch', tab });
}

/** 调试 / 测试用：清掉本次会话的预拉节流缓存 */
export function resetFriendRankPrefetchThrottle(): void {
  prefetchedTabs = {};
}

/**
 * 上报当前用户的好友榜分数到 wx.setUserCloudStorage
 * - 同时支持 bowl（通关进度）与 fruit（最佳分数），各自独立校验
 * - 节流：相同值 10s 内不重复发；force=true 可绕过
 *
 * 注意：bowlLevel / fruitScore 应该使用「已通关最高关卡」「水果切切乐历史最高分」，
 *       由调用方在 RankUpload 路径上保证一致。
 */
export function uploadFriendScores(
  bowlLevel: number,
  fruitScore: number,
  opts?: { force?: boolean }
): void {
  if (!isFriendRankSupported()) return;
  if (typeof wx.setUserCloudStorage !== 'function') return;
  if (friendRankUploadDisabledReason) return;

  const force = !!opts?.force;
  const now = Date.now();
  const next: Record<FriendRankTab, number> = {
    bowl: Math.max(0, bowlLevel | 0),
    fruit: Math.max(0, fruitScore | 0),
  };
  const unchanged = next.bowl === lastVals.bowl && next.fruit === lastVals.fruit;
  if (!force && unchanged && now - lastUploadTs < MIN_UPLOAD_GAP_MS) return;

  const KVDataList: Array<{ key: string; value: string }> = [];
  if (next.bowl > 0) {
    KVDataList.push({
      key: KV_KEY.bowl,
      // 微信好友榜要求 value 结构必须是 `{ wxgame: { score, update_time } }`
      value: JSON.stringify({
        wxgame: { score: next.bowl, update_time: Math.floor(now / 1000) },
      }),
    });
  }
  if (next.fruit > 0) {
    KVDataList.push({
      key: KV_KEY.fruit,
      value: JSON.stringify({
        wxgame: { score: next.fruit, update_time: Math.floor(now / 1000) },
      }),
    });
  }
  if (!KVDataList.length) return;

  try {
    wx.setUserCloudStorage!({
      KVDataList,
      success: () => {
        lastUploadTs = now;
        lastVals.bowl = next.bowl;
        lastVals.fruit = next.fruit;
        postMessage({ action: 'invalidate' });
        console.log(
          `[FriendRank] uploaded bowl=${next.bowl} fruit=${next.fruit} keys=${KVDataList.length}`
        );
      },
      fail: (err) => {
        if (isCredentialError(err)) {
          // 微信开放数据域凭证异常时，本会话继续重试只会刷屏；重进小程序/刷新微信态后再尝试。
          friendRankUploadDisabledReason = 'credential';
          console.warn('[FriendRank] setUserCloudStorage credential invalid, disabled this session', err);
          return;
        }
        console.warn('[FriendRank] setUserCloudStorage fail', err);
      },
    });
  } catch (e) {
    console.warn('[FriendRank] setUserCloudStorage throw', e);
  }
}

/**
 * 通知子域以新参数重绘好友榜
 * - tab 切换、布局变化、滚动时调用
 * - force=true 表示强制重新拉 wx.getFriendCloudStorage（如点了"刷新"）
 */
export function renderFriendBoard(params: {
  tab: FriendRankTab;
  width: number;
  height: number;
  pixelRatio?: number;
  scrollY?: number;
  selfOpenId?: string;
  force?: boolean;
}): void {
  postMessage(Object.assign({ action: 'render' }, params));
}
