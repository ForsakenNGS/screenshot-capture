
switch (process.platform) {
  case "linux":
    module.exports = require('./src/screenshot-linux.js');
    break;
  case "win32":
    module.exports = require('./src/screenshot-win32.js');
    break;
  default:
    // Unsupported platform
    module.exports = require('./src/screenshot-generic.js');
    break;
}


