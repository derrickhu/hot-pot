const tcb = require('@cloudbase/node-sdk');
const crypto = require('crypto');

const COLLECTION = process.env.ANALYTICS_COLLECTION || 'analytics_events';

let app = null;

function getApp() {
  if (app) return app;
  app = tcb.init({
    env: process.env.TCB_ENV || tcb.SYMBOL_CURRENT_ENV,
  });
  return app;
}

function getCollection() {
  return getApp().database().collection(COLLECTION);
}

function hashIp(ip) {
  if (!ip) return '';
  try {
    return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
  } catch (_) {
    return '';
  }
}

/**
 * 批量写入事件到 CloudDB。利用 _id 设为 event_id 让相同事件被自动判重（add 同 _id 会失败，逐条捕获后归到 deduped）。
 * 注意：CloudDB 文档型批量 add 一次调用算 1 次写入配额，但内部仍按文档收费；这一层是为了"次数配额"做缩 50:1。
 */
async function persistBatch(events, ingestTs, ipHash) {
  if (events.length === 0) {
    return { accepted: 0, deduped: 0, failed: 0 };
  }
  // 同批多条事件 ingest_ts 各差 1 毫秒，避免下游 cron 用 ingest_ts 做 cursor 时
  // 同 ms 撞车导致 _.gt 整批被跳过的问题（一批最多 100 条，偏移 0~99ms 不会和下一批冲突）
  const docs = events.map((e, i) => ({
    _id: e.event_id,
    ...e,
    ingest_ts: ingestTs + i,
    ingest_ip_hash: ipHash || '',
  }));

  const col = getCollection();
  let accepted = 0;
  let deduped = 0;
  let failed = 0;

  // node-sdk 的 collection.add 支持数组批量；冲突时整批失败，所以失败时再降级到逐条 add 区分原因
  try {
    const res = await col.add(docs);
    const idList = (res && (res.ids || res.id)) || [];
    accepted = Array.isArray(idList) ? idList.length : docs.length;
    return { accepted, deduped, failed };
  } catch (batchErr) {
    // 批量失败常见原因是其中有 _id 重复，降级逐条上报
    for (const doc of docs) {
      try {
        await col.add(doc);
        accepted += 1;
      } catch (singleErr) {
        const msg = String((singleErr && singleErr.message) || '');
        // CloudBase 文档型 _id 冲突错误码不固定，按消息关键字宽松判定
        if (/duplicate|exists|11000/i.test(msg)) {
          deduped += 1;
        } else {
          failed += 1;
          console.warn('[analytics-ingest] doc add failed', doc.event_id, msg);
        }
      }
    }
    return { accepted, deduped, failed };
  }
}

module.exports = {
  persistBatch,
  COLLECTION,
};
