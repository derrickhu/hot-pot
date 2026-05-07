/**
 * 轻量事件校验：保留必须字段、修正可选字段、丢弃异常事件。
 * 不引入 zod 等额外依赖，避免云函数 cold start 时间增加。
 *
 * 设计原则：宽进严出。客户端可能版本参差，我们尽量保留能用的字段，缺失字段补默认值；
 * 但 game_key、event_name、event_id 是去重和聚合的根，缺一就丢。
 */

const ALLOWED_PARAM_TYPES = new Set(['string', 'number', 'boolean']);
const MAX_BATCH = 100;
const MAX_PARAM_KEYS = 32;
const MAX_STRING_LEN = 512;

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function clipStr(v, max) {
  if (typeof v !== 'string') return '';
  return v.length > max ? v.slice(0, max) : v;
}

function sanitizeParams(raw) {
  if (!isObject(raw)) return {};
  const out = {};
  let count = 0;
  for (const key of Object.keys(raw)) {
    if (count >= MAX_PARAM_KEYS) break;
    if (typeof key !== 'string' || key.length > 64) continue;
    const v = raw[key];
    if (v === null) {
      out[key] = null;
      count += 1;
      continue;
    }
    const t = typeof v;
    if (!ALLOWED_PARAM_TYPES.has(t)) continue;
    out[key] = t === 'string' ? clipStr(v, MAX_STRING_LEN) : v;
    count += 1;
  }
  return out;
}

function sanitizeDevice(raw) {
  if (!isObject(raw)) {
    return { brand: '', model: '', system: '', sdk_version: '', screen_w: 0, screen_h: 0, network: 'unknown' };
  }
  return {
    brand: clipStr(raw.brand || '', 64),
    model: clipStr(raw.model || '', 128),
    system: clipStr(raw.system || '', 128),
    sdk_version: clipStr(raw.sdk_version || '', 64),
    screen_w: Number.isFinite(raw.screen_w) ? Number(raw.screen_w) : 0,
    screen_h: Number.isFinite(raw.screen_h) ? Number(raw.screen_h) : 0,
    network: clipStr(raw.network || 'unknown', 32),
  };
}

/**
 * 校验单条事件，返回归一化后的事件对象；非法返回 null。
 */
function sanitizeEvent(raw, gameWhitelist) {
  if (!isObject(raw)) return null;
  if (typeof raw.event_id !== 'string' || raw.event_id.length < 6) return null;
  if (typeof raw.event_name !== 'string' || raw.event_name.length === 0) return null;
  if (typeof raw.game_key !== 'string' || !gameWhitelist.has(raw.game_key)) return null;
  if (!Number.isFinite(raw.event_ts) || raw.event_ts <= 0) return null;

  return {
    event_id: clipStr(raw.event_id, 64),
    event_name: clipStr(raw.event_name, 64),
    event_ts: Number(raw.event_ts),
    game_key: clipStr(raw.game_key, 32),
    app_version: clipStr(raw.app_version || '0.0.0', 32),
    sdk_version: clipStr(raw.sdk_version || '0.0.0', 32),
    platform: clipStr(raw.platform || 'unknown', 16),
    user_id: clipStr(raw.user_id || '', 128),
    anonymous_id: clipStr(raw.anonymous_id || '', 64),
    session_id: clipStr(raw.session_id || '', 64),
    session_seq: Number.isFinite(raw.session_seq) ? Number(raw.session_seq) : 0,
    device: sanitizeDevice(raw.device),
    params: sanitizeParams(raw.params),
  };
}

/**
 * 校验整批，返回 { valid, invalidCount }。
 * 同时强制 batch 上限 MAX_BATCH，超出截断。
 */
function sanitizeBatch(rawBatch, gameWhitelist) {
  if (!Array.isArray(rawBatch)) {
    return { valid: [], invalidCount: 0, truncated: 0 };
  }
  let truncated = 0;
  let arr = rawBatch;
  if (arr.length > MAX_BATCH) {
    truncated = arr.length - MAX_BATCH;
    arr = arr.slice(0, MAX_BATCH);
  }
  const valid = [];
  let invalidCount = 0;
  for (const raw of arr) {
    const e = sanitizeEvent(raw, gameWhitelist);
    if (e) {
      valid.push(e);
    } else {
      invalidCount += 1;
    }
  }
  return { valid, invalidCount, truncated };
}

module.exports = {
  sanitizeBatch,
  MAX_BATCH,
};
