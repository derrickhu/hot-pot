const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Max-Age': '86400',
};

function respond(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false,
  };
}

function preflight() {
  return {
    statusCode: 204,
    headers: { ...CORS_HEADERS },
    body: '',
    isBase64Encoded: false,
  };
}

function parseEvent(event) {
  event = event || {};
  if (event.httpMethod) {
    const method = String(event.httpMethod).toUpperCase();
    let rawBody = event.body || '';
    if (event.isBase64Encoded && rawBody) {
      try {
        rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
      } catch (_) {
        // 解码失败按空 body 处理，校验阶段会拒
      }
    }

    let body = {};
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch (_) {
        body = {};
      }
    }

    return {
      method,
      path: normalizePath(event.path || '/'),
      body,
      headers: lowercaseHeaders(event.headers || {}),
      query: event.queryStringParameters || {},
      raw: event,
    };
  }

  // 兼容直接调用云函数（非 HTTP 触发）的场景，保留给联调
  const action = String(event.action || '').replace(/^\/+/, '');
  return {
    method: 'POST',
    path: action ? `/${action}` : '/track',
    body: event.body || event,
    headers: lowercaseHeaders(event.headers || {}),
    query: {},
    raw: event,
  };
}

function normalizePath(path) {
  if (!path) return '/';
  let p = String(path);
  if (!p.startsWith('/')) p = `/${p}`;
  // 兼容触发器路径前缀，例如 /analytics-ingest/track 归一为 /track
  p = p.replace(/^\/(?:analytics-ingest)(?=\/|$)/, '');
  if (p === '') p = '/';
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

function lowercaseHeaders(headers) {
  const out = {};
  for (const key of Object.keys(headers || {})) {
    out[key.toLowerCase()] = headers[key];
  }
  return out;
}

/** 取请求来源 IP 用于做哈希归因，不存原 IP */
function getRequestIp(parsed) {
  const h = parsed.headers || {};
  const xff = h['x-forwarded-for'] || h['x-real-ip'] || '';
  if (typeof xff === 'string' && xff) {
    return xff.split(',')[0].trim();
  }
  return '';
}

module.exports = {
  respond,
  preflight,
  parseEvent,
  getRequestIp,
};
