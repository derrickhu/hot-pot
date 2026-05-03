const platform = require('./platform');

class Element {
  constructor() {
    this.childNodes = [];
    this.style = {};
    this.clientWidth = 0;
    this.clientHeight = 0;
    this._listeners = {};
  }

  appendChild(child) {
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
    }
    return child;
  }

  addEventListener(type, handler) {
    if (!this._listeners[type]) {
      this._listeners[type] = [];
    }
    this._listeners[type].push(handler);
  }

  removeEventListener(type, handler) {
    if (!this._listeners[type]) {
      return;
    }
    const index = this._listeners[type].indexOf(handler);
    if (index >= 0) {
      this._listeners[type].splice(index, 1);
    }
  }

  getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width: this.clientWidth,
      height: this.clientHeight,
      right: this.clientWidth,
      bottom: this.clientHeight,
    };
  }
}

const HTMLCanvasElement = platform.createCanvas().constructor;
const HTMLImageElement = platform.createImage().constructor;

class HTMLVideoElement extends Element {}

module.exports = {
  Element,
  HTMLCanvasElement,
  HTMLImageElement,
  HTMLVideoElement,
};
