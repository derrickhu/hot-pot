const SHARE_TITLE = '清凉水果捞，来挑战你的眼力！';
const SHARE_IMAGE_URL = 'assets/images/share_card.jpg';
const SHARE_QUERY = 'from=share';

interface WechatSharePayload {
  title: string;
  imageUrl: string;
  query: string;
}

export function getWechatSharePayload(): WechatSharePayload {
  return {
    title: SHARE_TITLE,
    imageUrl: SHARE_IMAGE_URL,
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
