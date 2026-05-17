var _diagMsgs = [];
var _diagStart = Date.now();
var _diagModalShowing = false;
var _diagModalShown = false;

function _diag(msg) {
  var line = '[' + (Date.now() - _diagStart) + 'ms] ' + msg;
  _diagMsgs.push(line);
  try { console.log(line); } catch (_) {}
}

function _showDiag() {
  try {
    if (_diagModalShowing || _diagModalShown) {
      return;
    }
    if (typeof wx !== 'undefined' && wx.showModal) {
      _diagModalShowing = true;
      _diagModalShown = true;
      wx.showModal({
        title: '启动诊断',
        content: _diagMsgs.join('\n'),
        showCancel: false,
        fail: function(err) {
          try { console.warn('[diag] showModal failed', err); } catch (_) {}
        },
        complete: function() {
          _diagModalShowing = false;
        }
      });
    }
  } catch (_) {}
}

_diag('game.js start');

try {
  if (typeof wx !== 'undefined' && typeof wx.createCanvas === 'function' && typeof GameGlobal !== 'undefined') {
    // 借鉴 xiao_chu 的好友榜方案：第一个 createCanvas 作为真正上屏 Canvas，并锁定 2D context。
    // 微信开放数据域 sharedCanvas 只能 drawImage 到上屏 Canvas，不能进 WebGL/普通离屏 Canvas。
    // pixi-adapter 会在后面再创建一个 canvas 给 Pixi/WebGL 使用，Game.ts 每帧把 Pixi 离屏画面
    // 与 sharedCanvas 合成到这个 2D 上屏 Canvas。
    var _mainCanvas = wx.createCanvas();
    var _mainCtx = _mainCanvas.getContext('2d');
    var _screenInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : null;
    var _dpr = (_screenInfo && _screenInfo.pixelRatio) || 2;
    var _screenW = (_screenInfo && (_screenInfo.windowWidth || _screenInfo.screenWidth)) || 375;
    var _screenH = (_screenInfo && (_screenInfo.windowHeight || _screenInfo.screenHeight)) || 667;
    _mainCanvas.width = _screenW * _dpr;
    _mainCanvas.height = _screenH * _dpr;
    if (_mainCtx) {
      _mainCtx.fillStyle = '#f7e4c4';
      _mainCtx.fillRect(0, 0, _mainCanvas.width, _mainCanvas.height);
    }
    GameGlobal.__mainCanvas = _mainCanvas;
    _diag('main 2d canvas ready:' + _mainCanvas.width + 'x' + _mainCanvas.height);
  }
} catch (e) {
  _diag('main 2d canvas failed:' + e);
}

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
