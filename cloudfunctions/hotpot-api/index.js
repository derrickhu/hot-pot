const { handleLogin } = require('./lib/auth');
const { handlePull, handlePush } = require('./lib/save');
const { handleSubmit: handleRankSubmit, handleList: handleRankList, handleMine: handleRankMine } = require('./lib/rank');
const { handleList: handleLevelPassRates } = require('./lib/level-pass-rates');
const { respond, parseEvent, preflight } = require('./lib/http');

const ROUTES = {
  'POST /health': async () => ({ ok: true, ts: Date.now() }),
  'POST /login': handleLogin,
  'POST /save/pull': handlePull,
  'POST /save/push': handlePush,
  'POST /rank/submit': handleRankSubmit,
  'POST /rank/list': handleRankList,
  'POST /rank/mine': handleRankMine,
  'POST /level/pass-rates': handleLevelPassRates,
};

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

    const result = await handler(req, context);
    if (result && typeof result === 'object' && 'statusCode' in result) {
      return result;
    }
    return respond(200, { ok: true, data: result });
  } catch (error) {
    const code = error && error.code ? error.code : 'INTERNAL';
    const status = error && error.status ? error.status : 500;
    const message = (error && error.message) || String(error);
    console.error('[hotpot-api] error:', code, message, error && error.stack);
    const out = { ok: false, code, error: message };
    if (error && error.data !== undefined) {
      out.data = error.data;
    }
    return respond(status, out);
  }
};
