import { analytics, EVENT_NAMES } from '@/analytics';

const SHARE_QUERY = 'from=share';
const SHARE_REWARD_QUERY = 'from=share&entry=badge_reward';

/** 转发标题池：每次分享随机一条（与配图独立抽取，组合更多样）。 */
const SHARE_TITLES = [
  '清凉水果捞，来挑战你的眼力！',
  '越捞越上头，不信你来一局？',
  '眼疾手快，这碗你能捞明白吗？',
  '三果一连，解压又过瘾～',
  '帮我看一眼，这关到底怎么过！',
  '摸鱼五分钟，捞完精神一整天',
  '图鉴党狂喜：今天又能解锁谁？',
  '冰爽水果碗，点开就停不下来',
  '鲜果三连，手残也能逆袭？',
  '今日手气测试：捞一把就知道',
  '好友都在捞，就差你一个了',
  '脑力+眼力小考，敢接招吗？',
] as const;

/** 微信转发分享图池（5:4，与 conform 输出一致）；每次分享随机一张。 */
const SHARE_IMAGE_URLS = [
  'assets/images/share_rand_mint_frame.jpg',
  'assets/images/share_rand_yellow_frame.jpg',
  'assets/images/share_rand_table_warm.jpg',
  'assets/images/share_rand_combo.jpg',
  'assets/images/share_rand_collection.jpg',
  'assets/images/share_card.jpg',
] as const;

/** 分享抽取序号：避免仅依赖 Math.random() 时出现连续相同；与 Date 混合打散。 */
let sharePickSeq = 0;
/** 上一次分享图下标，连续两次尽量不重复（池子大于 1 时）。 */
let lastShareImageIndex = -1;

function pickIndexMixed(len: number): number {
  sharePickSeq = (sharePickSeq + 1) | 0;
  const t = typeof Date !== 'undefined' ? Date.now() : 0;
  // 与序号相乘再取模，连续调用也会有不同偏移
  let i = ((sharePickSeq * 1103515245 + t) >>> 0) % len;
  return i;
}

function pickRandomShareTitle(): string {
  const arr = SHARE_TITLES;
  return arr[pickIndexMixed(arr.length)]!;
}

function pickRandomShareImageUrl(): string {
  const arr = SHARE_IMAGE_URLS;
  const n = arr.length;
  if (n <= 0) {
    return '';
  }
  let idx = pickIndexMixed(n);
  if (n > 1) {
    let guard = 0;
    while (idx === lastShareImageIndex && guard < n + 2) {
      idx = (idx + 1) % n;
      guard += 1;
    }
  }
  lastShareImageIndex = idx;
  return arr[idx]!;
}

interface WechatSharePayload {
  title: string;
  imageUrl: string;
  query: string;
}

interface SharePayloadOptions {
  title?: string;
  query?: string;
  imageUrl?: string;
}

function buildSharePayload(options: SharePayloadOptions = {}): WechatSharePayload {
  return {
    title: options.title ?? pickRandomShareTitle(),
    imageUrl: options.imageUrl ?? pickRandomShareImageUrl(),
    query: options.query ?? SHARE_QUERY,
  };
}

function trackShareAppMessage(
  payload: WechatSharePayload,
  entryPoint: string,
  extra?: Record<string, string | number | boolean>,
): void {
  analytics.track(EVENT_NAMES.SHARE_APP_MESSAGE, {
    entry_point: entryPoint,
    title: payload.title,
    image_url: payload.imageUrl || '',
    query: payload.query || '',
    ...(extra ?? {}),
  });
}

export function setupWechatShare(): void {
  const api = typeof wx !== 'undefined' ? wx : null;
  if (!api) {
    return;
  }

  api.showShareMenu?.({
    withShareTicket: true,
    menus: ['shareAppMessage'],
  });
  api.onShareAppMessage?.((res) => {
    const payload = buildSharePayload();
    const from = res?.from;
    const entryPoint =
      from === 'button' ? 'wx_button' : from === 'menu' ? 'wx_menu' : 'wx_other';
    trackShareAppMessage(payload, entryPoint);
    return payload;
  });
}

export function shareGame(): boolean {
  const api = typeof wx !== 'undefined' ? wx : null;
  if (!api?.shareAppMessage) {
    return false;
  }
  const payload = buildSharePayload();
  trackShareAppMessage(payload, 'api_share_game');
  api.shareAppMessage(payload);
  return true;
}

export type ShareGameResult = 'shared' | 'unavailable' | 'failed';

export function shareGameForReward(options: SharePayloadOptions = {}): Promise<ShareGameResult> {
  const api = typeof wx !== 'undefined' ? wx : null;
  if (!api?.shareAppMessage) {
    return Promise.resolve('unavailable');
  }

  const payload = buildSharePayload({
    title: options.title ?? '我刚解锁新徽章，送你一碗水果捞！',
    imageUrl: options.imageUrl,
    query: SHARE_REWARD_QUERY,
  });
  trackShareAppMessage(payload, 'badge_unlock_reward', {
    reward_type: 'remove',
    daily_claimed: false,
  });

  return new Promise<ShareGameResult>((resolve) => {
    let settled = false;
    const finish = (result: ShareGameResult) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    try {
      api.shareAppMessage({
        ...payload,
        success: () => finish('shared'),
        fail: () => finish('failed'),
        // 部分小游戏运行时不会可靠回调 success；complete 后给一个短延迟兜底。
        complete: () => {
          setTimeout(() => finish('shared'), 1200);
        },
      });
      setTimeout(() => finish('shared'), 1800);
    } catch {
      finish('failed');
    }
  });
}
