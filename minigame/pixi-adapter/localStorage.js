const platform = require('./platform');

module.exports = {
  getItem(key) {
    try {
      return platform.getStorageSync(key) || null;
    } catch (error) {
      return null;
    }
  },

  setItem(key, value) {
    try {
      platform.setStorageSync(key, value);
    } catch (error) {
      console.warn('[pixi-adapter] localStorage.setItem failed', key, error);
    }
  },

  removeItem(key) {
    try {
      platform.removeStorageSync(key);
    } catch (error) {
      console.warn('[pixi-adapter] localStorage.removeItem failed', key, error);
    }
  },

  clear() {},
  key() {
    return null;
  },
  get length() {
    return 0;
  },
};
