const platform = require('./platform');

let systemInfo = {};

try {
  systemInfo = platform.getSystemInfoSync();
} catch (error) {
  systemInfo = {};
}

const runtimePlatform = systemInfo.platform || 'wechat';
const isOhos = runtimePlatform === 'ohos';

let userAgent;
if (isOhos) {
  userAgent = `Mozilla/5.0 (Linux; Android 12; HarmonyOS; ${systemInfo.model || 'HUAWEI'}) AppleWebKit/537.36 (KHTML, like Gecko) MiniGame PixiJS/7`;
} else if (runtimePlatform === 'android') {
  userAgent = `Mozilla/5.0 (Linux; Android; ${systemInfo.model || ''}) AppleWebKit/537.36 MiniGame PixiJS/7`;
} else if (runtimePlatform === 'ios') {
  userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS) AppleWebKit/537.36 MiniGame PixiJS/7';
} else {
  userAgent = `Mozilla/5.0 (MiniGame; ${runtimePlatform}) PixiJS/7`;
}

module.exports = {
  platform: isOhos ? 'Linux armv8l' : runtimePlatform,
  language: systemInfo.language || 'zh_CN',
  appVersion: '5.0 (MiniGame)',
  userAgent,
  onLine: true,
  maxTouchPoints: 10,
  vendor: '',
  product: '',
  productSub: '',
  hardwareConcurrency: 4,
};
