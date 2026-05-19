const { requireUser } = require('./auth');
const { getLevelPassRateCollection } = require('./db');
const { httpError } = require('./http');

const MODE_BOWL = 'bowl';
const WINDOW_DAYS = 30;
const DOC_ID = `${MODE_BOWL}_${WINDOW_DAYS}d_latest`;

function normalizeMode(value) {
  const mode = String(value || MODE_BOWL).trim();
  if (mode !== MODE_BOWL) {
    throw httpError(400, 'BAD_MODE', `unsupported mode_key: ${mode}`);
  }
  return mode;
}

function normalizeWindowDays(value) {
  const days = Number(value || WINDOW_DAYS);
  if (!Number.isFinite(days) || Math.floor(days) !== WINDOW_DAYS) {
    throw httpError(400, 'BAD_WINDOW_DAYS', `unsupported window_days: ${value}`);
  }
  return WINDOW_DAYS;
}

function publicSnapshot(doc) {
  return {
    game_key: String(doc.game_key || 'hotpot'),
    mode_key: MODE_BOWL,
    window_days: WINDOW_DAYS,
    window_start_date: String(doc.window_start_date || ''),
    window_end_date: String(doc.window_end_date || ''),
    computed_at: Number(doc.computed_at) || 0,
    levels: Array.isArray(doc.levels) ? doc.levels.map(publicLevel).filter(Boolean) : [],
  };
}

function publicLevel(item) {
  const levelId = Number(item && item.level_id);
  if (!Number.isFinite(levelId) || levelId <= 0) {
    return null;
  }
  const passRate = Number(item.pass_rate);
  return {
    level_id: Math.floor(levelId),
    pass_rate: Number.isFinite(passRate) ? Math.max(0, Math.min(1, passRate)) : 0,
    start_users: Math.max(0, Math.floor(Number(item.start_users) || 0)),
    clear_users: Math.max(0, Math.floor(Number(item.clear_users) || 0)),
    started_and_cleared_users: Math.max(0, Math.floor(Number(item.started_and_cleared_users) || 0)),
    is_sample_low: item.is_sample_low === true || item.is_sample_low === 1,
  };
}

async function handleList(req) {
  requireUser(req);
  const body = req.body || {};
  normalizeMode(body.mode_key);
  normalizeWindowDays(body.window_days);

  const res = await getLevelPassRateCollection().doc(DOC_ID).get();
  const doc = res && (Array.isArray(res.data) ? res.data[0] : res.data);
  if (!doc) {
    throw httpError(404, 'LEVEL_PASS_RATE_NOT_READY', '关卡通关率快照尚未生成');
  }
  return publicSnapshot(doc);
}

module.exports = {
  handleList,
};
