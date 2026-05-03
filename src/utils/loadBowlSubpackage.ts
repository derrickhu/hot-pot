/**
 * 进入碗场景前必须完成，否则分包内图片路径无法加载。
 * 非微信环境（无 wx / 无 loadSubpackage）直接 resolve，便于本地调试。
 */
export function loadBowlSubpackage(): Promise<void> {
  const api = typeof wx !== 'undefined' ? wx : null;
  const sub = api?.loadSubpackage;
  if (!api || typeof sub !== 'function') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    sub({
      name: 'bowl_game',
      success: () => resolve(),
      fail: (err: { errMsg?: string } | null) => {
        console.warn('[loadBowlSubpackage] failed', err);
        reject(err ?? new Error('loadSubpackage failed'));
      },
    });
  });
}
