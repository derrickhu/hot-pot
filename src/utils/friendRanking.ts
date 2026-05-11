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

let lastCanvasW = 0;
let lastCanvasH = 0;

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
