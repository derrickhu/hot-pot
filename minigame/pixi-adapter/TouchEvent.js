const platform = require('./platform');
const { canvas } = require('./canvas');

class TouchEvent {
  constructor(type, touches) {
    this.type = type;
    this.target = canvas;
    this.currentTarget = canvas;
    this.touches = touches || [];
    this.changedTouches = touches || [];
    this.targetTouches = touches || [];
    this.timeStamp = Date.now();
    this.bubbles = true;
    this.cancelable = true;
  }

  preventDefault() {}
  stopPropagation() {}
  stopImmediatePropagation() {}
}

function normalizeTouches(rawTouches) {
  if (!rawTouches) {
    return [];
  }

  return Array.prototype.map.call(rawTouches, (touch) => ({
    identifier: touch.identifier || 0,
    clientX: touch.clientX,
    clientY: touch.clientY,
    pageX: touch.clientX,
    pageY: touch.clientY,
    screenX: touch.clientX,
    screenY: touch.clientY,
    target: canvas,
  }));
}

function registerTouchEvents() {
  const listeners = {};
  const windowListeners = {};
  const realGlobal = typeof globalThis !== 'undefined' ? globalThis : GameGlobal;

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

  canvas.addEventListener = function addEventListener(type, handler) {
    if (!listeners[type]) {
      listeners[type] = [];
    }
    listeners[type].push(handler);
  };

  canvas.removeEventListener = function removeEventListener(type, handler) {
    if (!listeners[type]) {
      return;
    }
    const index = listeners[type].indexOf(handler);
    if (index >= 0) {
      listeners[type].splice(index, 1);
    }
  };

  const addEventListener = function addEventListener(type, handler) {
    if (!windowListeners[type]) {
      windowListeners[type] = [];
    }
    windowListeners[type].push(handler);
  };

  const removeEventListener = function removeEventListener(type, handler) {
    if (!windowListeners[type]) {
      return;
    }
    const index = windowListeners[type].indexOf(handler);
    if (index >= 0) {
      windowListeners[type].splice(index, 1);
    }
  };

  safeAssign(realGlobal, 'addEventListener', addEventListener);
  safeAssign(realGlobal, 'removeEventListener', removeEventListener);
  safeAssign(GameGlobal, 'addEventListener', addEventListener);
  safeAssign(GameGlobal, 'removeEventListener', removeEventListener);

  function dispatch(type, rawEvent) {
    const touches = normalizeTouches(rawEvent.touches || rawEvent.changedTouches);
    const event = new TouchEvent(type, touches);
    event.changedTouches = normalizeTouches(rawEvent.changedTouches);

    (listeners[type] || []).forEach((handler) => {
      handler(event);
    });
  }

  function dispatchPointer(type, rawEvent, pressed) {
    const touches = rawEvent.changedTouches || rawEvent.touches || [];
    if (!touches.length) {
      return;
    }

    const touch = touches[0];
    const pointerEvent = {
      type,
      pointerId: touch.identifier || 0,
      pointerType: 'touch',
      clientX: touch.clientX,
      clientY: touch.clientY,
      pageX: touch.clientX,
      pageY: touch.clientY,
      screenX: touch.clientX,
      screenY: touch.clientY,
      offsetX: touch.clientX,
      offsetY: touch.clientY,
      x: touch.clientX,
      y: touch.clientY,
      width: 1,
      height: 1,
      pressure: pressed ? 0.5 : 0,
      button: 0,
      buttons: pressed ? 1 : 0,
      isPrimary: true,
      target: canvas,
      currentTarget: canvas,
      timeStamp: Date.now(),
      preventDefault() {},
      stopPropagation() {},
      stopImmediatePropagation() {},
    };

    (listeners[type] || []).forEach((handler) => {
      handler(pointerEvent);
    });

    (windowListeners[type] || []).forEach((handler) => {
      handler(pointerEvent);
    });
  }

  const sysInfo = platform.getSystemInfoSync();
  const screenWidth = sysInfo.screenWidth || sysInfo.windowWidth || 375;
  const screenHeight = sysInfo.screenHeight || sysInfo.windowHeight || 667;

  canvas.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width: screenWidth,
      height: screenHeight,
      right: screenWidth,
      bottom: screenHeight,
    };
  };

  try {
    Object.defineProperty(canvas, 'clientWidth', {
      get() {
        return screenWidth;
      },
      configurable: true,
    });
    Object.defineProperty(canvas, 'clientHeight', {
      get() {
        return screenHeight;
      },
      configurable: true,
    });
  } catch (error) {}

  try {
    canvas.style = canvas.style || {};
    canvas.style.width = `${screenWidth}px`;
    canvas.style.height = `${screenHeight}px`;
    canvas.style.touchAction = 'none';
  } catch (error) {}

  const fakeParent = {
    addEventListener() {},
    removeEventListener() {},
  };

  try {
    canvas.parentElement = fakeParent;
    canvas.parentNode = fakeParent;
  } catch (error) {}

  if (!canvas.focus) {
    canvas.focus = function focus() {};
  }

  platform.onTouchStart((event) => {
    dispatch('touchstart', event);
    dispatchPointer('pointerdown', event, true);
  });

  platform.onTouchMove((event) => {
    dispatch('touchmove', event);
    dispatchPointer('pointermove', event, true);
  });

  platform.onTouchEnd((event) => {
    dispatch('touchend', event);
    dispatchPointer('pointerup', event, false);
  });

  platform.onTouchCancel((event) => {
    dispatch('touchcancel', event);
    dispatchPointer('pointercancel', event, false);
  });
}

module.exports = { TouchEvent, registerTouchEvents };
