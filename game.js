var _diagMsgs = [];
var _diagStart = Date.now();

function _diag(msg) {
  var line = '[' + (Date.now() - _diagStart) + 'ms] ' + msg;
  _diagMsgs.push(line);
  try { console.log(line); } catch (_) {}
}

function _showDiag() {
  try {
    if (typeof wx !== 'undefined' && wx.showModal) {
      wx.showModal({
        title: '启动诊断',
        content: _diagMsgs.join('\n'),
        showCancel: false
      });
    }
  } catch (_) {}
}

_diag('game.js start');

try {
  if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
    var _info = wx.getSystemInfoSync();
    _diag('platform:' + _info.platform + ' system:' + _info.system);
    _diag('brand:' + _info.brand + ' model:' + _info.model);
    _diag('SDK:' + _info.SDKVersion);
  }
} catch (e) {
  _diag('systemInfo failed:' + e);
}

try {
  if (typeof GameGlobal !== 'undefined') {
    GameGlobal.onError = function(msg) {
      _diag('onError:' + msg);
      _showDiag();
    };
    GameGlobal.onUnhandledRejection = function(ev) {
      _diag('unhandledRejection:' + (ev && ev.reason || ev));
      _showDiag();
    };
  }
} catch (_) {}

try {
  require('./minigame/pixi-adapter/index');
  _diag('pixi-adapter ok');
} catch (e) {
  _diag('pixi-adapter failed:' + e);
  _showDiag();
}

// 部分安卓/鸿蒙微信小游戏 JS 引擎没有 Intl，PixiJS 文本测量里直接访问 Intl 会导致启动阶段 ReferenceError。
if (typeof Intl === 'undefined') {
  _diag('Intl missing, install stub');
  try {
    if (typeof GameGlobal !== 'undefined') GameGlobal.Intl = {};
    if (typeof globalThis !== 'undefined') globalThis.Intl = {};
  } catch (_) {}
}

try {
  require('./minigame/game-bundle.js');
  _diag('game-bundle ok');
} catch (e) {
  _diag('game-bundle failed:' + e);
  _showDiag();
}

try {
  setTimeout(function() {
    if (typeof GameGlobal !== 'undefined' && !GameGlobal.__hotPotRendered) {
      _diag('5s timeout: game not rendered');
      _showDiag();
    }
  }, 5000);
} catch (_) {}
