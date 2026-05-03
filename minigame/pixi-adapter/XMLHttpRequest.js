const platform = require('./platform');

class XMLHttpRequest {
  constructor() {
    this.readyState = 0;
    this.status = 0;
    this.statusText = '';
    this.response = null;
    this.responseText = '';
    this.responseType = '';
    this.onreadystatechange = null;
    this.onload = null;
    this.onerror = null;
    this._headers = {};
    this._method = 'GET';
    this._url = '';
  }

  open(method, url) {
    this._method = method;
    this._url = url;
    this.readyState = 1;
  }

  setRequestHeader(key, value) {
    this._headers[key] = value;
  }

  send(data) {
    platform.request({
      url: this._url,
      method: this._method,
      header: this._headers,
      data,
      responseType: this.responseType === 'arraybuffer' ? 'arraybuffer' : 'text',
      success: (response) => {
        this.status = response.statusCode;
        this.statusText = String(response.statusCode);
        this.readyState = 4;
        this.response = response.data;
        this.responseText = typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data);
        if (this.onreadystatechange) {
          this.onreadystatechange();
        }
        if (this.onload) {
          this.onload();
        }
      },
      fail: (error) => {
        this.readyState = 4;
        if (this.onreadystatechange) {
          this.onreadystatechange();
        }
        if (this.onerror) {
          this.onerror(error);
        }
      },
    });
  }

  abort() {}

  addEventListener(type, handler) {
    this[`on${type}`] = handler;
  }

  removeEventListener() {}
}

XMLHttpRequest.UNSENT = 0;
XMLHttpRequest.OPENED = 1;
XMLHttpRequest.HEADERS_RECEIVED = 2;
XMLHttpRequest.LOADING = 3;
XMLHttpRequest.DONE = 4;

module.exports = XMLHttpRequest;
