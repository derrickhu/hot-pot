/**
 * 进入碗场景前必须完成，否则分包内图片路径无法加载。
 * 非微信环境（无 wx / 无 loadSubpackage）直接 resolve，便于本地调试。
 *
 * 错误处理策略：
 * - 第一次 fail 时静默 warn 一次，**自动重试 1 次**（开发者工具常见瞬时失败）
 * - 二次仍失败再 reject 并输出一行 hint，提示开发者重启工具或重新构建
 * - 同一会话内多次失败只输出一次 hint，避免日志被刷屏
 */

let warnedThisSession = false;
const cachedPromises = new Map<string, Promise<void>>();

export function loadBowlSubpackage(): Promise<void> {
  return loadGameSubpackage('bowl_game');
}

export function loadBowlCoreSubpackage(): Promise<void> {
  return loadGameSubpackage('bowl_core');
}

export function loadBowlThemesSubpackage(): Promise<void> {
  return loadGameSubpackage('bowl_themes');
}

export function loadBowlBadgesSubpackage(): Promise<void> {
  return loadGameSubpackage('bowl_badges');
}

export function loadCatalogAssetsSubpackage(): Promise<void> {
  return loadGameSubpackage('catalog_assets');
}

export function loadDailyLimitedSubpackage(): Promise<void> {
  return loadGameSubpackage('daily_limited');
}

export function loadDailyRecipesSubpackage(): Promise<void> {
  return loadGameSubpackage('daily_recipes');
}

export function loadFruitSliceSubpackage(): Promise<void> {
  return loadGameSubpackage('fruit_slice');
}

export function loadGachaAssetsSubpackage(): Promise<void> {
  return loadGameSubpackage('gacha_assets');
}

export function loadGameSubpackage(name: string): Promise<void> {
  const api = typeof wx !== 'undefined' ? wx : null;
  const sub = api?.loadSubpackage;
  if (!api || typeof sub !== 'function') {
    return Promise.resolve();
  }
  // 同一会话内复用首次的成功 / 失败结果，避免反复 require 同一子包刷 SystemError
  const cachedPromise = cachedPromises.get(name);
  if (cachedPromise) {
    return cachedPromise;
  }
  const promise = doLoad(sub, name, 0).catch((err) => {
    // 失败缓存清空，允许下次进入 BowlScene 时再 retry 一次
    cachedPromises.delete(name);
    throw err;
  });
  cachedPromises.set(name, promise);
  return promise;
}

function doLoad(
  sub: NonNullable<(typeof wx)['loadSubpackage']>,
  name: string,
  attempt: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    sub({
      name,
      success: () => resolve(),
      fail: (err: { errMsg?: string } | null) => {
        const errMsg = err?.errMsg || 'loadSubpackage failed';
        if (attempt < 1) {
          // 第一次失败：静默 retry，多数情况下是开发者工具的瞬时模块解析失败
          doLoad(sub, name, attempt + 1).then(resolve, reject);
          return;
        }
        // 重试也失败：只在本次会话首次时输出 hint，避免日志爆炸
        if (!warnedThisSession) {
          warnedThisSession = true;
          console.warn(
            `[loadGameSubpackage] ${name} failed twice: ${errMsg}.` +
              ` 请确认 game.json 里 subpackages.${name} 配置存在，` +
              ` 并在微信开发者工具中执行「编译」或重启 IDE。`,
          );
        }
        reject(err ?? new Error(errMsg));
      },
    });
  });
}
