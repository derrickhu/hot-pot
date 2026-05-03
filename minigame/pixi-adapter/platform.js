const isWechat = typeof wx !== 'undefined';
const api = isWechat ? wx : null;

if (!api) {
  console.error('[pixi-adapter] wx is not available');
}

module.exports = {
  name: isWechat ? 'wechat' : 'unknown',
  api,
  createCanvas: () => api.createCanvas(),
  createImage: () => api.createImage(),
  getSystemInfoSync: () => api.getSystemInfoSync(),
  getStorageSync: (key) => api.getStorageSync(key),
  setStorageSync: (key, value) => api.setStorageSync(key, value),
  removeStorageSync: (key) => api.removeStorageSync(key),
  request: (options) => api.request(options),
  onTouchStart: (handler) => api.onTouchStart(handler),
  onTouchMove: (handler) => api.onTouchMove(handler),
  onTouchEnd: (handler) => api.onTouchEnd(handler),
  onTouchCancel: (handler) => api.onTouchCancel(handler),
};
