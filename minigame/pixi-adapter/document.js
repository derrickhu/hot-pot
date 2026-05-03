const platform = require('./platform');
const { Element } = require('./element');

const listeners = {};
const body = new Element();
const documentElement = new Element();

const document = {
  body,
  documentElement,
  readyState: 'complete',

  createElement(tag) {
    switch (String(tag).toLowerCase()) {
      case 'canvas':
        return platform.createCanvas();
      case 'img':
      case 'image':
        return platform.createImage();
      default:
        return new Element();
    }
  },

  createElementNS(_ns, tag) {
    return this.createElement(tag);
  },

  createTextNode() {
    return new Element();
  },

  getElementById() {
    return null;
  },

  getElementsByTagName(tag) {
    if (tag === 'canvas') {
      const { canvas } = require('./canvas');
      return [canvas];
    }
    return [];
  },

  querySelector() {
    return null;
  },

  querySelectorAll() {
    return [];
  },

  elementFromPoint() {
    const { canvas } = require('./canvas');
    return canvas;
  },

  addEventListener(type, handler) {
    if (!listeners[type]) {
      listeners[type] = [];
    }
    listeners[type].push(handler);
  },

  removeEventListener(type, handler) {
    if (!listeners[type]) {
      return;
    }
    const index = listeners[type].indexOf(handler);
    if (index >= 0) {
      listeners[type].splice(index, 1);
    }
  },

  dispatchEvent(event) {
    const queue = listeners[event.type] || [];
    queue.forEach((handler) => handler(event));
  },

  fonts: {
    add() {},
    delete() {},
    has() {
      return false;
    },
    forEach() {},
  },

  hidden: false,
  visibilityState: 'visible',
};

module.exports = document;
