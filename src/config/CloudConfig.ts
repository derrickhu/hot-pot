/** CloudBase HTTP backend configuration for the hotpot game. */
export const GAME_KEY = 'hotpot';

export const BACKEND_BASE_URL = 'https://rosa-env-d7grf78r5dbd37323.service.tcloudbase.com';
export const BACKEND_PATH_PREFIX = `/${GAME_KEY}-api`;

export const BACKEND_LOGIN_PATH = `${BACKEND_PATH_PREFIX}/login/`;
export const BACKEND_PULL_PATH = `${BACKEND_PATH_PREFIX}/save/pull`;
export const BACKEND_PUSH_PATH = `${BACKEND_PATH_PREFIX}/save/push`;
export const BACKEND_HEALTH_PATH = `${BACKEND_PATH_PREFIX}/health`;
export const BACKEND_RANK_SUBMIT_PATH = `${BACKEND_PATH_PREFIX}/rank/submit`;
export const BACKEND_RANK_LIST_PATH = `${BACKEND_PATH_PREFIX}/rank/list`;
export const BACKEND_RANK_MINE_PATH = `${BACKEND_PATH_PREFIX}/rank/mine`;

export const BACKEND_REQUEST_TIMEOUT_MS = 10000;

export const BACKEND_TOKEN_KEY = `${GAME_KEY}_token`;
export const BACKEND_ANON_ID_KEY = `${GAME_KEY}_anon_id`;

export const BOWL_PROGRESS_KEY = `${GAME_KEY}_bowl_progress`;
export const USER_SETTINGS_KEY = `${GAME_KEY}_settings`;
export const FRUIT_SLICE_PROGRESS_KEY = `${GAME_KEY}_fruit_slice_progress`;
export const WALLET_KEY = `${GAME_KEY}_wallet_v1`;
export const GACHA_STATE_KEY = `${GAME_KEY}_gacha_state_v1`;
export const TOOL_INVENTORY_KEY = `${GAME_KEY}_tool_inventory_v1`;
export const FRUIT_SLICE_REWARD_KEY = `${GAME_KEY}_fruit_slice_reward_v1`;
export const FRUIT_SLICE_TOOL_INVENTORY_KEY = `${GAME_KEY}_fruit_slice_tool_inventory_v1`;
/**
 * 玩家自己授权拿到的微信昵称 + 头像 URL；仅用于排行榜显示。
 * 不进入 CLOUD_SYNC_ALLOWLIST：用户资料本机敏感，不参与跨设备云端同步，
 * 换设备时由玩家在新设备上重新点击授权即可。
 */
export const USER_PROFILE_KEY = `${GAME_KEY}_user_profile`;

export const CLOUD_SYNC_SCHEMA_VERSION = 1;
export const CLOUD_SYNC_META_KEY = `${GAME_KEY}_cloud_meta`;

export const CLOUD_SYNC_ALLOWLIST = [
  BOWL_PROGRESS_KEY,
  USER_SETTINGS_KEY,
  FRUIT_SLICE_PROGRESS_KEY,
  WALLET_KEY,
  GACHA_STATE_KEY,
  TOOL_INVENTORY_KEY,
  FRUIT_SLICE_REWARD_KEY,
  FRUIT_SLICE_TOOL_INVENTORY_KEY,
] as const;

export const CLOUD_SYNC_EXCLUDE_KEYS = [
  BACKEND_TOKEN_KEY,
  BACKEND_ANON_ID_KEY,
] as const;

export const CLOUD_SYNC_STARTUP_TIMEOUT_MS = 2500;
export const CLOUD_SYNC_DEBOUNCE_MS = 1500;
export const CLOUD_SYNC_BASE_DELAY_MS = 1500;
export const CLOUD_SYNC_MAX_BACKOFF_MS = 30000;
export const CLOUD_SYNC_MAX_FAIL_COUNT = 5;
export const CLOUD_SYNC_RETRY_INTERVAL_MS = 60000;
export const CLOUD_SYNC_LOG_THRESHOLD = 3;

export type CloudSyncKey = typeof CLOUD_SYNC_ALLOWLIST[number];
