const SHARE_QUERY = 'from=share';

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
] as const;

function pickRandomFrom<const T extends readonly string[]>(arr: T): T[number] {
  const i = Math.floor(Math.random() * arr.length);
  return arr[i]!;
}

function pickRandomShareTitle(): string {
  return pickRandomFrom(SHARE_TITLES);
}

function pickRandomShareImageUrl(): string {
  return pickRandomFrom(SHARE_IMAGE_URLS);
}

interface WechatSharePayload {
  title: string;
  imageUrl: string;
  query: string;
}

export function getWechatSharePayload(): WechatSharePayload {
  return {
    title: pickRandomShareTitle(),
    imageUrl: pickRandomShareImageUrl(),
    query: SHARE_QUERY,
  };
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
  api.onShareAppMessage?.(() => getWechatSharePayload());
}

export function shareGame(): boolean {
  const api = typeof wx !== 'undefined' ? wx : null;
  if (!api?.shareAppMessage) {
    return false;
  }
  api.shareAppMessage(getWechatSharePayload());
  return true;
}
