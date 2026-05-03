const platform = require('./platform');

let systemInfo = {};

try {
  systemInfo = platform.getSystemInfoSync();
} catch (error) {
  systemInfo = {};
}

module.exports = {
  platform: systemInfo.platform || 'wechat',
  language: systemInfo.language || 'zh_CN',
  appVersion: '5.0 (MiniGame)',
  userAgent: `Mozilla/5.0 (MiniGame; ${systemInfo.platform || 'wechat'}) PixiJS/7`,
  onLine: true,
  maxTouchPoints: 10,
  vendor: '',
  product: '',
  productSub: '',
  hardwareConcurrency: 4,
};
