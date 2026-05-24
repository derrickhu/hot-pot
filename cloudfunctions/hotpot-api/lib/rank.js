const crypto = require('crypto');
const { requireUser } = require('./auth');
const { getRankingCollection } = require('./db');
const { httpError } = require('./http');
const {
  getRankBowlMaxLevel,
  getRankFruitMaxScore,
  getRankListLimit,
  getRankListMaxLimit,
  getRankMineScanLimit,
} = require('./config');

const BOARD_BOWL = 'bowl_progress';
const BOARD_FRUIT = 'fruit_best';
const BOARDS = new Set([BOARD_BOWL, BOARD_FRUIT]);
const RANK_SUBMIT_BLOCKED_USER_IDS = new Set([
  // GM 测试账号：不再写入 / 更新排行榜数据，避免测试进度污染线上榜单。
  'wx:oB0xx3SeJgkkU0_ONokPrzvFljrE',
]);

function normalizeBoard(value) {
  const board = String(value || '').trim();
  if (!BOARDS.has(board)) {
    throw httpError(400, 'BAD_BOARD', `unsupported board: ${board}`);
  }
  return board;
}

function normalizeNonNegativeInt(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw httpError(400, `BAD_${field.toUpperCase()}`, `${field} 必须为非负整数`);
  }
  return Math.floor(n);
}

function normalizeLimit(value) {
  const fallback = getRankListLimit();
  const max = Math.max(1, getRankListMaxLimit());
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return Math.min(fallback, max);
  }
  return Math.min(Math.floor(n), max);
}

function normalizeOffset(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function displayNameForUser(userId) {
  const digest = crypto.createHash('sha1').update(String(userId)).digest('hex');
  const suffix = String(parseInt(digest.slice(0, 8), 16) % 10000).padStart(4, '0');
  return `水果达人${suffix}`;
}

function sanitizeDisplayName(value, fallback) {
  const text = String(value || '').trim().replace(/[\r\n\t]/g, ' ').slice(0, 16);
  return text || fallback;
}

/**
 * 仅接受 http(s):// 开头、长度不超过 1024 的头像 URL；
 * 其余视为无效，回退到 fallback（一般是已有头像或空字符串）。
 */
function sanitizeAvatarUrl(value, fallback) {
  const text = String(value || '').trim();
  if (!text) {
    return fallback || '';
  }
  if (text.length > 1024) {
    return fallback || '';
  }
  if (!/^https?:\/\//i.test(text)) {
    return fallback || '';
  }
  return text;
}

function isBetterRecord(board, next, prev) {
  if (!prev) return true;
  if (board === BOARD_BOWL) {
    const prevLevel = Number(prev.level) || 0;
    const prevBadge = Number(prev.badgeLevel) || 0;
    return next.level > prevLevel || (next.level === prevLevel && next.badgeLevel > prevBadge);
  }
  return next.score > (Number(prev.score) || 0);
}

function publicRecord(doc, userId, rank) {
  if (!doc) return null;
  const out = {
    rank: rank || null,
    board: doc.board,
    displayName: doc.displayName || displayNameForUser(doc.userId || ''),
    avatarUrl: doc.avatarUrl || '',
    isMe: !!userId && doc.userId === userId,
    updatedAt: Number(doc.updatedAt) || 0,
  };
  if (doc.board === BOARD_BOWL) {
    out.level = Number(doc.level) || 0;
    out.badgeLevel = Number(doc.badgeLevel) || 0;
  } else {
    out.score = Number(doc.score) || 0;
  }
  return out;
}

function orderedQuery(col, board) {
  let query = col.where({ board });
  if (board === BOARD_BOWL) {
    query = query.orderBy('level', 'desc').orderBy('badgeLevel', 'desc').orderBy('updatedAt', 'asc');
  } else {
    query = query.orderBy('score', 'desc').orderBy('updatedAt', 'asc');
  }
  return query;
}

async function findMineRank(col, board, userId) {
  const scanLimit = Math.max(getRankListMaxLimit(), getRankMineScanLimit());
  const res = await orderedQuery(col, board).limit(scanLimit).get();
  const list = (res && Array.isArray(res.data) ? res.data : []);
  const index = list.findIndex((item) => item.userId === userId);
  if (index < 0) {
    return null;
  }
  return {
    rank: index + 1,
    doc: list[index],
  };
}

function buildSubmitRecord(board, body) {
  if (board === BOARD_BOWL) {
    const level = normalizeNonNegativeInt(body.level, 'level');
    const badgeLevel = normalizeNonNegativeInt(body.badgeLevel || 0, 'badgeLevel');
    const maxLevel = getRankBowlMaxLevel();
    if (level > maxLevel) {
      throw httpError(400, 'LEVEL_TOO_HIGH', `level 超出上限: ${level} > ${maxLevel}`);
    }
    return { level, badgeLevel, score: 0 };
  }

  const score = normalizeNonNegativeInt(body.score, 'score');
  const maxScore = getRankFruitMaxScore();
  if (score > maxScore) {
    throw httpError(400, 'SCORE_TOO_HIGH', `score 超出上限: ${score} > ${maxScore}`);
  }
  return { score, level: 0, badgeLevel: 0 };
}

async function handleSubmit(req) {
  const { userId, platform } = requireUser(req);
  const body = req.body || {};
  const board = normalizeBoard(body.board);
  const incoming = buildSubmitRecord(board, body);
  if (RANK_SUBMIT_BLOCKED_USER_IDS.has(userId)) {
    console.log(`[rank.submit] uid=${userId} board=${board} blocked GM test account`);
    return {
      board,
      updated: false,
      reason: 'GM_TEST_ACCOUNT',
      record: null,
    };
  }
  const col = getRankingCollection();
  const existingRes = await col.where({ userId, board }).limit(1).get();
  const existing = (existingRes && Array.isArray(existingRes.data) && existingRes.data[0]) || null;
  const now = Date.now();
  const displayName = sanitizeDisplayName(body.displayName, (existing && existing.displayName) || displayNameForUser(userId));
  const avatarUrl = sanitizeAvatarUrl(body.avatarUrl, (existing && existing.avatarUrl) || '');

  // 排错关键日志：客户端真的把昵称/头像传上来了吗？sanitize 之后还剩什么？
  const rawAvatar = String(body.avatarUrl || '');
  console.log(
    `[rank.submit] uid=${userId} board=${board}` +
      ` rawDisplayName="${body.displayName || ''}" -> "${displayName}"` +
      ` rawAvatarUrl=${rawAvatar ? rawAvatar.slice(0, 48) + (rawAvatar.length > 48 ? '...' : '') : '(empty)'}` +
      ` sanitizedAvatar=${avatarUrl ? 'yes' : 'no'}` +
      ` hasExisting=${!!existing}`,
  );

  if (!isBetterRecord(board, incoming, existing)) {
    // 即使成绩不再更优，玩家也可能刚授权了新的微信昵称 / 头像 ——
    // 这种情况下做轻量字段更新即可，不动 score/level/badge。
    if (existing && existing._id) {
      const sameName = existing.displayName === displayName;
      const sameAvatar = (existing.avatarUrl || '') === avatarUrl;
      if (!sameName || !sameAvatar) {
        const patch = { displayName, avatarUrl, updatedAt: now };
        await col.doc(existing._id).update(patch);
        console.log(
          `[rank.submit] uid=${userId} profile_update` +
            ` nameChanged=${!sameName} avatarChanged=${!sameAvatar}`,
        );
        return {
          board,
          updated: true,
          mode: 'profile_update',
          record: publicRecord({ ...existing, ...patch }, userId, null),
        };
      }
      console.log(`[rank.submit] uid=${userId} NOT_BETTER, profile already up to date`);
    } else {
      console.log(`[rank.submit] uid=${userId} NOT_BETTER, no existing doc`);
    }
    return {
      board,
      updated: false,
      reason: 'NOT_BETTER',
      record: publicRecord(existing, userId, null),
    };
  }

  const docData = {
    userId,
    board,
    platform,
    displayName,
    avatarUrl,
    score: incoming.score,
    level: incoming.level,
    badgeLevel: incoming.badgeLevel,
    createdAt: (existing && existing.createdAt) || now,
    updatedAt: now,
  };

  if (existing && existing._id) {
    await col.doc(existing._id).update(docData);
    console.log(`[rank.submit] uid=${userId} update score-record id=${existing._id}`);
    return { board, updated: true, mode: 'update', record: publicRecord({ ...existing, ...docData }, userId, null) };
  }

  const addRes = await col.add(docData);
  console.log(`[rank.submit] uid=${userId} insert new score-record id=${addRes && (addRes.id || addRes._id)}`);
  return {
    board,
    updated: true,
    mode: 'insert',
    record: publicRecord({ ...docData, _id: addRes && (addRes.id || addRes._id) }, userId, null),
  };
}

async function handleList(req) {
  const { userId } = requireUser(req);
  const body = req.body || {};
  const board = normalizeBoard(body.board);
  const limit = normalizeLimit(body.limit);
  const offset = normalizeOffset(body.offset);
  const col = getRankingCollection();
  const res = await orderedQuery(col, board).skip(offset).limit(limit).get();
  const rows = (res && Array.isArray(res.data) ? res.data : []);
  const list = rows.map((doc, index) => publicRecord(doc, userId, offset + index + 1));
  const mineRank = await findMineRank(col, board, userId);
  const mine = mineRank ? publicRecord(mineRank.doc, userId, mineRank.rank) : null;
  return { board, limit, offset, list, mine };
}

async function handleMine(req) {
  const { userId } = requireUser(req);
  const board = normalizeBoard((req.body || {}).board);
  const col = getRankingCollection();
  const mineRank = await findMineRank(col, board, userId);
  return { board, mine: mineRank ? publicRecord(mineRank.doc, userId, mineRank.rank) : null };
}

module.exports = {
  BOARD_BOWL,
  BOARD_FRUIT,
  handleSubmit,
  handleList,
  handleMine,
};
