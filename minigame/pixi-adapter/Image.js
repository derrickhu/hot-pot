const platform = require('./platform');

function Image() {
  return platform.createImage();
}

module.exports = Image;
