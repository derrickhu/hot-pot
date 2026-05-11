/**
 * 别捞水果好友榜 openDataContext 入口
 * ---------------------------------------------------------------
 * 运行在独立 JS 上下文（WeChat Mini-Game openDataContext 沙箱）中，
 * 只能访问受限 wx API：
 *   - wx.getSharedCanvas()       获取共享 canvas（主域通过 PIXI Sprite 上屏）
 *   - wx.onMessage(cb)           接收主域发来的渲染参数
 *   - wx.getFriendCloudStorage() 拉好友（含自己）的 KVDataList
 *
 * 主域消息协议（见 src/utils/friendRanking.ts）：
 *   { action: 'render',  tab:'bowl'|'fruit', pixelRatio, width, height, scrollY, selfOpenId, force? }
 *   { action: 'invalidate' }   主域刚 setUserCloudStorage 完，让下次 render 重新拉
 *
 * UI 风格说明（重要）：
 *   微信不允许主域获取好友明文，绘制必须在子域 canvas API 上完成。
 *   为了让好友榜跟主域的世界榜（src/scenes/LeaderboardScene.ts 中 createRankRow）
 *   看起来完全一致，本文件里的颜色、行高、字号、圆角等全部按主域同名常量 1:1 复刻。
 */

/* eslint-disable */

var CANVAS = null;
var CTX = null;

try {
  CANVAS = wx.getSharedCanvas();
  CTX = CANVAS.getContext('2d');
} catch (e) {
  // 非小游戏环境（例如开发工具预览），无 sharedCanvas
}

// 跟主域 src/utils/friendRanking.ts:KV_KEY 保持一致
var TAB_META = {
  bowl: { key: 'hotpot_bowl_level', unit: '关' },
  fruit: { key: 'hotpot_fruit_score', unit: '分' },
};

var state = {
  tab: 'bowl',
  pixelRatio: 2,
  scrollY: 0,
  selfOpenId: '',
  listCache: {},
  loading: false,
  avatarImgs: {},
  pendingRender: null,
};

var CACHE_TTL_MS = 60 * 1000;
var FONT_FALLBACK = '"PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif';

// 与主域 LeaderboardScene 内同名常量对齐
var COLOR = {
  CARD_WHITE: '#fdf6ec',
  CARD_STROKE: '#eadbc5',
  ROW_BG: '#fff9ee',
  ROW_STROKE: '#e9d8b9',
  ME_BG: '#ffa743',
  ME_STROKE: '#d6791f',
  PILL_PURPLE: '#b086e1',
  PILL_PURPLE_STROKE: '#7c5bb0',
  PILL_PURPLE_TEXT_STROKE: '#6a4a99',
  PILL_ORANGE: '#f9852c',
  PILL_ORANGE_STROKE: '#b35a1a',
  TEXT_DARK: '#5a3318',
  TEXT_LIGHT: '#ffffff',
  TEXT_ME_STROKE: '#a14400',
  TEXT_RANK_NUM: '#9b8268',
  MEDAL_GOLD_CORE: '#f7c64a',
  MEDAL_GOLD_EDGE: '#c88517',
  MEDAL_SILVER_CORE: '#d8e2ec',
  MEDAL_SILVER_EDGE: '#8aa3b9',
  MEDAL_BRONZE_CORE: '#e79768',
  MEDAL_BRONZE_EDGE: '#a15a2a',
  MEDAL_RIBBON: '#d94b4b',
  HINT_TEXT: '#8a5a2b',
  HINT_SUB: '#b09060',
};

function _safeNum(v) {
  var n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}

/** kvList: [{key, value}]，value 是 JSON 字符串 `{ wxgame: { score, update_time } }` */
function _parseWxgameData(kvList, tabKey) {
  if (!kvList || !kvList.length) return 0;
  var target = null;
  for (var i = 0; i < kvList.length; i++) {
    if (kvList[i] && kvList[i].key === tabKey) {
      target = kvList[i];
      break;
    }
  }
  if (!target) return 0;
  try {
    var obj = JSON.parse(target.value || '{}');
    if (obj && obj.wxgame && obj.wxgame.score != null) return _safeNum(obj.wxgame.score);
    if (obj && obj.score != null) return _safeNum(obj.score);
    return _safeNum(target.value);
  } catch (_) {
    return _safeNum(target.value);
  }
}

function _ensureAvatar(url) {
  if (!url) return null;
  var cached = state.avatarImgs[url];
  if (cached) return cached;
  try {
    var img = wx.createImage();
    img.onload = function () {
      state.avatarImgs[url] = img;
      _renderIfReady();
    };
    img.onerror = function () {
      state.avatarImgs[url] = null;
    };
    img.src = url;
    state.avatarImgs[url] = img;
    return img;
  } catch (_) {
    return null;
  }
}

// ---------- 数据拉取 ----------
function _fetchFriendCloudStorage(tab, cb) {
  var meta = TAB_META[tab];
  if (!meta) {
    cb([]);
    return;
  }
  if (typeof wx === 'undefined' || !wx.getFriendCloudStorage) {
    cb([], { kind: 'unsupported', msg: 'wx.getFriendCloudStorage missing' });
    return;
  }
  state.loading = true;
  try {
    wx.getFriendCloudStorage({
      keyList: [meta.key],
      success: function (res) {
        state.loading = false;
        var rows = (res && res.data) || [];
        var list = [];
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i];
          var value = _parseWxgameData(r.KVDataList, meta.key);
          if (value <= 0) continue;
          list.push({
            openid: r.openid || '',
            nickname: r.nickname || '微信好友',
            avatarUrl: r.avatarUrl || '',
            value: value,
          });
        }
        list.sort(function (a, b) { return b.value - a.value; });
        _fetchMineCloudStorage(tab, function (mineValue) {
          state.listCache[tab] = { ts: Date.now(), list: list, mineValue: mineValue };
          cb(list, null, mineValue);
        });
      },
      fail: function (err) {
        state.loading = false;
        var errMsg = (err && (err.errMsg || err.message)) || '';
        var kind = 'empty';
        if (/privacy/i.test(errMsg)) kind = 'privacy';
        else if (/not support|unsupport/i.test(errMsg)) kind = 'unsupported';
        try { console.warn('[openData] getFriendCloudStorage fail', errMsg); } catch (_) {}
        state.listCache[tab] = { ts: Date.now(), list: [], mineValue: 0, err: { kind: kind, msg: errMsg } };
        cb([], { kind: kind, msg: errMsg }, 0);
      },
    });
  } catch (_) {
    state.loading = false;
    cb([]);
  }
}

/** 读取自己的微信 KV，用来在好友列表中定位“我”，并绘制底部固定个人信息行 */
function _fetchMineCloudStorage(tab, cb) {
  var meta = TAB_META[tab];
  if (!meta || typeof wx === 'undefined' || !wx.getUserCloudStorage) {
    cb(0);
    return;
  }
  try {
    wx.getUserCloudStorage({
      keyList: [meta.key],
      success: function (res) {
        cb(_parseWxgameData((res && res.KVDataList) || [], meta.key));
      },
      fail: function (err) {
        try { console.warn('[openData] getUserCloudStorage fail', err && (err.errMsg || err)); } catch (_) {}
        cb(0);
      },
    });
  } catch (_) {
    cb(0);
  }
}

function _getListForTab(tab, forceRefresh, cb) {
  var cached = state.listCache[tab];
  if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    cb(cached.list, cached.err, cached.mineValue || 0);
    return;
  }
  _fetchFriendCloudStorage(tab, function (list, err, mineValue) {
    cb(list, err, mineValue || 0);
  });
}

// ---------- 通用绘图 ----------
function _clear() {
  if (!CTX || !CANVAS) return;
  CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);
}

function _renderIfReady() {
  if (state.pendingRender) _render(state.pendingRender);
}

function _roundRect(x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  CTX.beginPath();
  CTX.moveTo(x + r, y);
  CTX.arcTo(x + w, y, x + w, y + h, r);
  CTX.arcTo(x + w, y + h, x, y + h, r);
  CTX.arcTo(x, y + h, x, y, r);
  CTX.arcTo(x, y, x + w, y, r);
  CTX.closePath();
}

/** 仿主域 PIXI.Text 的描边文字效果：先描边再填充 */
function _drawStrokedText(text, x, y, fontSize, weight, fill, stroke, strokeWidth) {
  CTX.font = weight + ' ' + fontSize + 'px ' + FONT_FALLBACK;
  if (strokeWidth > 0 && stroke) {
    CTX.lineWidth = strokeWidth;
    CTX.strokeStyle = stroke;
    CTX.lineJoin = 'round';
    CTX.strokeText(text, x, y);
  }
  CTX.fillStyle = fill;
  CTX.fillText(text, x, y);
}

function _drawHint(text, sub) {
  if (!CTX) return;
  var w = CANVAS.width;
  var h = CANVAS.height;
  var S = state.pixelRatio || 2;
  _clear();
  CTX.save();
  CTX.textAlign = 'center';
  CTX.textBaseline = 'middle';
  _drawStrokedText(
    text || '暂无好友数据',
    w / 2,
    h / 2 - 14 * S,
    26 * S,
    '900',
    COLOR.TEXT_DARK,
    COLOR.TEXT_LIGHT,
    3 * S
  );
  if (sub) {
    CTX.fillStyle = COLOR.HINT_SUB;
    CTX.font = '700 ' + (20 * S) + 'px ' + FONT_FALLBACK;
    CTX.fillText(sub, w / 2, h / 2 + 24 * S);
  }
  CTX.restore();
}

// ---------- 主行渲染：对齐主域 createRankRow / createRankBadge / createValuePill ----------

/** 圆形头像：白色底盘 + 描边，未加载时只剩底盘（自动 emoji 兜底放主域，子域只画图） */
function _drawAvatar(cx, cy, S, url, isSelf) {
  var r = 30 * S;
  // 白色底盘
  CTX.beginPath();
  CTX.arc(cx, cy, r, 0, Math.PI * 2);
  CTX.fillStyle = '#ffffff';
  CTX.fill();
  CTX.lineWidth = 3 * S;
  CTX.strokeStyle = isSelf ? COLOR.TEXT_ME_STROKE : COLOR.ROW_STROKE;
  CTX.stroke();

  var img = _ensureAvatar(url);
  if (img && img.width > 0) {
    CTX.save();
    CTX.beginPath();
    CTX.arc(cx, cy, r - 3 * S, 0, Math.PI * 2);
    CTX.clip();
    try {
      CTX.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    } catch (_) {}
    CTX.restore();
  } else {
    // 加载未完成时给一个透明米色填充，避免行间空白
    CTX.save();
    CTX.beginPath();
    CTX.arc(cx, cy, r - 3 * S, 0, Math.PI * 2);
    CTX.fillStyle = 'rgba(245,185,74,0.2)';
    CTX.fill();
    CTX.restore();
  }
}

/** 名次徽章：前 3 名画"丝带 + 圆盘 + 数字"；4+ 名显示纯数字 */
function _drawBadge(cx, cy, S, rank, isSelf) {
  if (rank <= 3) {
    var palette = rank === 1
      ? { core: COLOR.MEDAL_GOLD_CORE, edge: COLOR.MEDAL_GOLD_EDGE }
      : rank === 2
        ? { core: COLOR.MEDAL_SILVER_CORE, edge: COLOR.MEDAL_SILVER_EDGE }
        : { core: COLOR.MEDAL_BRONZE_CORE, edge: COLOR.MEDAL_BRONZE_EDGE };

    // 丝带（两条三角形），跟主域 createRankBadge 内坐标比例对齐
    CTX.fillStyle = COLOR.MEDAL_RIBBON;
    CTX.beginPath();
    CTX.moveTo(cx - 18 * S, cy - 24 * S);
    CTX.lineTo(cx - 6 * S, cy - 24 * S);
    CTX.lineTo(cx - 2 * S, cy + 10 * S);
    CTX.lineTo(cx - 14 * S, cy + 6 * S);
    CTX.closePath();
    CTX.fill();
    CTX.beginPath();
    CTX.moveTo(cx + 18 * S, cy - 24 * S);
    CTX.lineTo(cx + 6 * S, cy - 24 * S);
    CTX.lineTo(cx + 2 * S, cy + 10 * S);
    CTX.lineTo(cx + 14 * S, cy + 6 * S);
    CTX.closePath();
    CTX.fill();

    // 圆盘：外圈 + 内圈
    var diskCy = cy + 10 * S;
    CTX.beginPath();
    CTX.arc(cx, diskCy, 26 * S, 0, Math.PI * 2);
    CTX.fillStyle = palette.edge;
    CTX.fill();
    CTX.beginPath();
    CTX.arc(cx, diskCy, 22 * S, 0, Math.PI * 2);
    CTX.fillStyle = palette.core;
    CTX.fill();

    // 名次数字
    CTX.textAlign = 'center';
    CTX.textBaseline = 'middle';
    _drawStrokedText(
      String(rank),
      cx,
      diskCy,
      26 * S,
      '900',
      COLOR.TEXT_DARK,
      COLOR.TEXT_LIGHT,
      3 * S
    );
    return;
  }

  // 4+ 名：纯数字（自己行白字 + 深橙描边，其他玩家米色字 + 白描边）
  var display = isSelf && rank > 99 ? '99+' : String(rank);
  CTX.textAlign = 'center';
  CTX.textBaseline = 'middle';
  _drawStrokedText(
    display,
    cx,
    cy,
    (display === '99+' ? 26 : 32) * S,
    '900',
    isSelf ? COLOR.TEXT_LIGHT : COLOR.TEXT_RANK_NUM,
    isSelf ? COLOR.TEXT_ME_STROKE : COLOR.TEXT_LIGHT,
    (isSelf ? 4 : 3) * S
  );
}

/** 单行：跟世界榜风格完全一致 */
function _drawRow(rowX, rowY, rowW, rowH, S, meta, item, rank, isSelf) {
  var rowR = 20 * S;

  // 行底色 + 描边
  _roundRect(rowX, rowY, rowW, rowH, rowR);
  CTX.fillStyle = isSelf ? COLOR.ME_BG : COLOR.ROW_BG;
  CTX.fill();
  CTX.lineWidth = (isSelf ? 3 : 2) * S;
  CTX.strokeStyle = isSelf ? COLOR.ME_STROKE : COLOR.ROW_STROKE;
  CTX.stroke();

  // 名次徽章 / 圆形头像 / 名字 / 分数 pill 的水平偏移：
  // 主域 createRankRow 内左基 = -w/2 + offset；下面把它转成行左边距 + offset
  var badgeCx = rowX + 50 * S;
  var badgeCy = rowY + rowH / 2;
  _drawBadge(badgeCx, badgeCy, S, rank, isSelf);

  var avatarCx = rowX + 124 * S;
  var avatarCy = rowY + rowH / 2;
  _drawAvatar(avatarCx, avatarCy, S, item.avatarUrl, isSelf);

  // 昵称 —— 主域 fontSize 26, 自己行白字 + 深橙描边，其他黑棕字 + 白描边
  var nameX = rowX + 178 * S;
  var nameY = rowY + rowH / 2;
  CTX.textAlign = 'left';
  CTX.textBaseline = 'middle';
  var nick = (item.nickname || '微信好友').substring(0, 8);
  _drawStrokedText(
    nick,
    nameX,
    nameY,
    26 * S,
    '900',
    isSelf ? COLOR.TEXT_LIGHT : COLOR.TEXT_DARK,
    isSelf ? COLOR.TEXT_ME_STROKE : COLOR.TEXT_LIGHT,
    (isSelf ? 4 : 3) * S
  );

  // 分数 pill —— 主域 132x64 圆角 18，紫色 / 自己行橙色
  var pillW = 132 * S;
  var pillH = 64 * S;
  var pillRight = rowX + rowW - 8 * S;
  var pillX = pillRight - pillW;
  var pillY = rowY + rowH / 2 - pillH / 2;
  _roundRect(pillX, pillY, pillW, pillH, 18 * S);
  CTX.fillStyle = isSelf ? COLOR.PILL_ORANGE : COLOR.PILL_PURPLE;
  CTX.fill();
  CTX.lineWidth = 2 * S;
  CTX.strokeStyle = isSelf ? COLOR.PILL_ORANGE_STROKE : COLOR.PILL_PURPLE_STROKE;
  CTX.stroke();

  var unit = meta.unit || '';
  var valText = item.value + unit;
  CTX.textAlign = 'center';
  CTX.textBaseline = 'middle';
  _drawStrokedText(
    valText,
    pillX + pillW / 2,
    pillY + pillH / 2,
    26 * S,
    '900',
    COLOR.TEXT_LIGHT,
    isSelf ? COLOR.TEXT_ME_STROKE : COLOR.PILL_PURPLE_TEXT_STROKE,
    3 * S
  );
}

function _resolveMineRow(list, mineValue) {
  if (!list || !list.length) {
    return {
      item: { nickname: '自己', avatarUrl: '', value: mineValue || 0 },
      rank: mineValue > 0 ? 1 : 100,
    };
  }

  if (state.selfOpenId) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].openid === state.selfOpenId) {
        return { item: list[i], rank: i + 1 };
      }
    }
  }

  // 主域拿不到好友明文 openid 时，用自己的 KV 分数回定位。
  // 极少数同分会命中第一个同分好友，但底部仍能保持世界榜同款“个人信息”布局。
  if (mineValue > 0) {
    for (var j = 0; j < list.length; j++) {
      if (list[j].value === mineValue) {
        return { item: list[j], rank: j + 1 };
      }
    }
    var rank = 1;
    for (var k = 0; k < list.length; k++) {
      if (list[k].value > mineValue) rank += 1;
    }
    return {
      item: { nickname: '自己', avatarUrl: '', value: mineValue },
      rank: rank,
    };
  }

  return {
    item: { nickname: '自己', avatarUrl: '', value: 0 },
    rank: 100,
  };
}

function _drawBoard(list, mineValue) {
  var S = state.pixelRatio || 2;
  var w = CANVAS.width;
  var h = CANVAS.height;
  // 与主域 drawList + drawMineRow 完全一致：上方列表预留底部个人信息行。
  var rowH = 84 * S;
  var gap = 10 * S;
  var startY = 0;
  var mineGap = 26 * S;
  var listH = Math.max(0, h - rowH - mineGap);
  var rawScrollY = state.scrollY || 0;
  var totalH = list.length * (rowH + gap);
  var minScrollY = Math.min(0, listH - startY - totalH);
  var scrollY = Math.max(minScrollY, Math.min(0, rawScrollY));
  var meta = TAB_META[state.tab] || TAB_META.bowl;
  var mine = _resolveMineRow(list, mineValue);

  _clear();

  CTX.save();
  CTX.beginPath();
  CTX.rect(0, 0, w, listH);
  CTX.clip();

  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var ry = startY + i * (rowH + gap) + scrollY;
    if (ry + rowH < 0 || ry > listH) continue;
    var isSelf = (state.selfOpenId && item.openid === state.selfOpenId)
      || (mineValue > 0 && item.value === mineValue && i + 1 === mine.rank);
    _drawRow(0, ry, w, rowH, S, meta, item, i + 1, isSelf);
  }

  CTX.restore();

  // 底部固定个人信息行：位置、尺寸、橙色高亮都按世界榜 drawMineRow 对齐。
  _drawRow(0, h - rowH, w, rowH, S, meta, mine.item, mine.rank, true);
}

function _render(msg) {
  state.pendingRender = msg;
  if (!CTX || !CANVAS) return;

  state.tab = msg.tab || state.tab;
  state.pixelRatio = msg.pixelRatio || state.pixelRatio;
  state.scrollY = msg.scrollY != null ? msg.scrollY : state.scrollY;
  state.selfOpenId = msg.selfOpenId || state.selfOpenId;
  // 新基础库下 sharedCanvas 的 width/height 在 openDataContext 内只读，
  // 必须由主域写入（见 src/utils/friendRanking.ts:ensureSharedCanvasSize）。

  _getListForTab(state.tab, !!msg.force, function (list, err, mineValue) {
    if (err && err.kind === 'privacy') {
      _drawHint('好友榜暂不可用', '请检查小程序后台隐私协议配置');
      return;
    }
    if (err && err.kind === 'unsupported') {
      _drawHint('好友榜暂不可用', '请升级微信到最新版本重试');
      return;
    }
    if (!list || !list.length) {
      if (mineValue > 0) {
        _drawBoard([], mineValue);
      } else {
        _drawHint('暂无好友上榜', '邀请微信好友一起来玩即可上榜');
      }
      return;
    }
    _drawBoard(list, mineValue || 0);
  });
}

// ---------- 消息入口 ----------
if (typeof wx !== 'undefined' && wx.onMessage) {
  wx.onMessage(function (data) {
    if (!data || !data.action) return;
    if (data.action === 'render' || data.action === 'refresh') {
      _render(data);
    } else if (data.action === 'invalidate') {
      // 主域刚 setUserCloudStorage 完，下次 render 时强制重新拉
      state.listCache = {};
    }
  });
}
