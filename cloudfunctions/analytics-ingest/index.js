const { respond, preflight, parseEvent, getRequestIp } = require('./lib/http');
const { sanitizeBatch, MAX_BATCH } = require('./lib/validate');
const { persistBatch } = require('./lib/ingest');

function getGameWhitelist() {
  const raw = process.env.ANALYTICS_GAME_KEYS || 'hotpot,huahua,caizhu';
  const set = new Set();
  for (const item of String(raw).split(',')) {
    const k = item.trim();
    if (k) set.add(k);
  }
  return set;
}

const ROUTES = {
  'POST /track': handleTrack,
  'POST /health': async () => ({ ok: true, ts: Date.now() }),
};

async function handleTrack(req) {
  const body = req.body || {};
  const rawBatch = Array.isArray(body.batch) ? body.batch : (Array.isArray(body) ? body : []);
  if (rawBatch.length === 0) {
    return respond(400, { ok: false, code: 'EMPTY_BATCH', error: 'batch is empty' });
  }

  const whitelist = getGameWhitelist();
  const { valid, invalidCount, truncated } = sanitizeBatch(rawBatch, whitelist);

  if (valid.length === 0) {
    return respond(400, {
      ok: false,
      code: 'ALL_INVALID',
      error: `no valid event in batch=${rawBatch.length}, invalid=${invalidCount}`,
    });
  }

  const ingestTs = Date.now();
  const ipHash = ''; // 隐私要求：默认不存 IP；如需归因可改为 hashIp(getRequestIp(req))
  const result = await persistBatch(valid, ingestTs, ipHash);

  return respond(200, {
    ok: true,
    accepted: result.accepted,
    deduped: result.deduped,
    failed: result.failed,
    invalid: invalidCount,
    truncated,
    max_batch: MAX_BATCH,
  });
}

exports.main = async (event, context) => {
  try {
    if (event && event.httpMethod === 'OPTIONS') {
      return preflight();
    }
    const req = parseEvent(event);
    const key = `${req.method} ${req.path}`;
    const handler = ROUTES[key];
    if (!handler) {
      return respond(404, { ok: false, code: 'NOT_FOUND', error: `no route: ${key}` });
    }
    return await handler(req, context);
  } catch (error) {
    const code = (error && error.code) || 'INTERNAL';
    const status = (error && error.status) || 500;
    const message = (error && error.message) || String(error);
    console.error('[analytics-ingest] error:', code, message, error && error.stack);
    return respond(status, { ok: false, code, error: message });
  }
};
