const { noop } = require('./util');
const platform = require('./platform');
const Image = require('./Image');
const { canvas } = require('./canvas');
const location = require('./location');
const document = require('./document');
const navigator = require('./navigator');
const localStorage = require('./localStorage');
const XMLHttpRequest = require('./XMLHttpRequest');
const { TouchEvent, registerTouchEvents } = require('./TouchEvent');
const {
  Element,
  HTMLCanvasElement,
  HTMLImageElement,
  HTMLVideoElement,
} = require('./element');

const realGlobal = typeof globalThis !== 'undefined' ? globalThis : GameGlobal;
const sysInfo = platform.getSystemInfoSync();

function safeAssign(target, key, value) {
  try {
    target[key] = value;
    return true;
  } catch (error) {}

  try {
    const desc = Object.getOwnPropertyDescriptor(target, key);
    if (!desc || desc.configurable) {
      Object.defineProperty(target, key, {
        value,
        configurable: true,
        writable: true,
      });
      return true;
    }
  } catch (error) {}

  return false;
}

function PointerEvent(type, options) {
  this.type = type;
  Object.assign(this, options || {});
}

function MouseEvent(type, options) {
  this.type = type;
  Object.assign(this, options || {});
}

safeAssign(realGlobal, 'window', realGlobal);
safeAssign(realGlobal, 'self', realGlobal);
safeAssign(realGlobal, 'global', realGlobal);
safeAssign(realGlobal, 'OffscreenCanvas', undefined);
safeAssign(realGlobal, 'document', document);
safeAssign(realGlobal, 'navigator', navigator);
safeAssign(realGlobal, 'location', location);
safeAssign(realGlobal, 'localStorage', localStorage);
safeAssign(realGlobal, 'XMLHttpRequest', XMLHttpRequest);
safeAssign(realGlobal, 'Image', Image);
safeAssign(realGlobal, 'TouchEvent', TouchEvent);
safeAssign(realGlobal, 'PointerEvent', PointerEvent);
safeAssign(realGlobal, 'MouseEvent', MouseEvent);
safeAssign(realGlobal, 'Element', Element);
safeAssign(realGlobal, 'HTMLCanvasElement', HTMLCanvasElement);
safeAssign(realGlobal, 'HTMLImageElement', HTMLImageElement);
safeAssign(realGlobal, 'HTMLVideoElement', HTMLVideoElement);
safeAssign(realGlobal, 'canvas', canvas);
safeAssign(realGlobal, 'ontouchstart', noop);
safeAssign(realGlobal, 'performance', realGlobal.performance || { now: Date.now.bind(Date) });
safeAssign(realGlobal, 'DOMParser', class DOMParser {
  parseFromString() {
    return { documentElement: new Element() };
  }
});
safeAssign(realGlobal, 'URL', realGlobal.URL || {
  createObjectURL() {
    return '';
  },
  revokeObjectURL() {},
});
safeAssign(realGlobal, 'Blob', realGlobal.Blob || function Blob() {});

safeAssign(GameGlobal, 'window', realGlobal);
safeAssign(GameGlobal, 'self', realGlobal);
safeAssign(GameGlobal, 'OffscreenCanvas', undefined);
safeAssign(GameGlobal, 'document', document);
safeAssign(GameGlobal, 'navigator', navigator);
safeAssign(GameGlobal, 'location', location);
safeAssign(GameGlobal, 'localStorage', localStorage);
safeAssign(GameGlobal, 'XMLHttpRequest', XMLHttpRequest);
safeAssign(GameGlobal, 'Image', Image);
safeAssign(GameGlobal, 'TouchEvent', TouchEvent);
safeAssign(GameGlobal, 'PointerEvent', PointerEvent);
safeAssign(GameGlobal, 'MouseEvent', MouseEvent);
safeAssign(GameGlobal, 'canvas', canvas);

[
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
].forEach((key) => {
  if (typeof realGlobal[key] === 'undefined' && typeof globalThis[key] !== 'undefined') {
    safeAssign(realGlobal, key, globalThis[key]);
  }
  if (typeof GameGlobal[key] === 'undefined' && typeof realGlobal[key] !== 'undefined') {
    safeAssign(GameGlobal, key, realGlobal[key]);
  }
});

try {
  canvas.width = (sysInfo.screenWidth || 375) * (sysInfo.pixelRatio || 2);
  canvas.height = (sysInfo.screenHeight || 667) * (sysInfo.pixelRatio || 2);
} catch (error) {}

registerTouchEvents();
