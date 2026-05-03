/**
 * 微信小游戏：开发者工具内「模拟器」环境 platform 为 `devtools`；
 * 真机预览 / 体验版 / 正式版为 `ios` | `android` 等。
 * GM 等调试入口仅允许在模拟器出现。
 */
export function isWxDevtoolsSimulator(): boolean {
  if (typeof wx === 'undefined') {
    return false;
  }
  try {
    const info = wx.getSystemInfoSync?.();
    return info?.platform === 'devtools';
  } catch {
    return false;
  }
}
