const exec = require('child_process').exec;
const ScreenshotGeneric = require('./screenshot-generic.js');

const regexpScreen = /^(.+) connected (primary )?([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+) \((.+)\)( ([0-9]+)([^\s]+) x ([0-9]+)([^\s]+))?/;
const regexpResolution = /^\s+([0-9]+)x([0-9]+)\s+(.+)$/;
const regexpWindow = /^(\s+)0x([0-9a-f]+) (\(has no name\)|"(.+)"): \(("([^"]*)")?\s?("([^"]*)")\)\s+([0-9]+)x([0-9]+)\+([0-9-]+)\+([0-9-]+)\s+\+([0-9-]+)\+([0-9-]+)/;

let screenshotTools = null;

class ScreenshotLinux extends ScreenshotGeneric {

  /**
   * Get the string version of the given crop object for use with ImageMagick
   * @param cropObject
   * @returns {string}
   */
  static getCropStringImagick(cropObject) {
    return cropObject.size.width+'x'+cropObject.size.height+'+'+cropObject.offset.x+'+'+cropObject.offset.y;
  }

  /**
   * Get the string version of the given crop object for use with Scrot
   * @param cropObject
   * @returns {string}
   */
  static getCropStringScrot(cropObject) {
    return cropObject.offset.x+','+cropObject.offset.y+','+cropObject.size.width+','+cropObject.size.height;
  }

  /**
   * Get a list of all available screens
   * @returns {Promise<unknown>}
   */
  static getScreens() {
    return new Promise((resolve, reject) => {
      exec('xrandr', (error, output) => {
        let screens = [];
        let outputLines = output.split('\n');
        for (let i = 0; i < outputLines.length; i++) {
          let line = outputLines[i];
          // DVI-D-0 connected primary 1920x1080+0+0 (normal left inverted right x axis y axis) 531mm x 298mm
          let matchScreen = line.match(regexpScreen);
          if (matchScreen) {
            // Fill screen settings
            let screen = super.getScreenDummy();
            screen.ident = matchScreen[1];
            screen.primary = (matchScreen[2] === 'primary ');
            screen.size.width = parseInt(matchScreen[3]);
            screen.size.height = parseInt(matchScreen[4]);
            screen.offset.x = parseInt(matchScreen[5]);
            screen.offset.y = parseInt(matchScreen[6]);
            screen.extra.flags = matchScreen[7];
            screen.extra.resolutions = [];
            // Detect possible resolutions and refresh rates
            while (++i < outputLines.length) {
              line = outputLines[i];
              let matchResolution = line.match(regexpResolution);
              if (matchResolution) {
                let resolution = {
                  width: parseInt(matchResolution[1]),
                  height: parseInt(matchResolution[2]),
                  active: false,
                  refreshRates: []
                };
                let regexpRefreshRate = /([0-9.]+)([\s*])([\s+])/g;
                let refreshRateMatch;
                while ((refreshRateMatch = regexpRefreshRate.exec(matchResolution[3])) !== null) {
                  let refreshRate = {
                    hz: parseFloat(refreshRateMatch[1]),
                    active: (refreshRateMatch[2] === '*'),
                    default: (refreshRateMatch[3] === '+')
                  };
                  if (refreshRate.active) {
                    screen.refreshRate = refreshRate.hz;
                    resolution.active = true;
                  }
                  resolution.refreshRates.push(refreshRate);
                }
                screen.extra.resolutions.push(resolution);
              } else {
                i--;
                break;
              }
            }
            screens.push(screen);
          }
        }
        if (screens.length > 0) {
          resolve(screens);
        } else {
          reject(new Error('No screens detected!'));
        }
      });
    });
  }

  /**
   * Get a list of all available windows
   * @returns {Promise<[]>}
   */
  static getWindows() {
    return ScreenshotLinux.getWindowActive().then((windowActiveId) => {
      return new Promise((resolve, reject) => {
        exec('xwininfo -root -children -tree', (error, output) => {
          let windows = [];
          let outputLines = output.split('\n');
          for (let i = 0; i < outputLines.length; i++) {
            let line = outputLines[i];
            let matchWindow = line.match(regexpWindow);
            if (matchWindow) {
              // Top-Level window
              let window = super.getWindowDummy();
              window.ident = parseInt(matchWindow[2], 16);
              window.foreground = (window.ident === windowActiveId);
              window.title = matchWindow[4];
              window.command = matchWindow[6];
              window.name = matchWindow[8];
              window.size.width = parseInt(matchWindow[9]);
              window.size.height = parseInt(matchWindow[10]);
              window.offset.x = parseInt(matchWindow[11]);
              window.offset.y = parseInt(matchWindow[12]);
              windows.push(window);
            }
          }
          if (windows.length > 0) {
            resolve(windows);
          } else {
            reject(new Error('No windows detected!'));
          }
        });
      });
    });
  }

  static getWindowActive() {
    return new Promise((resolve, reject) => {
      exec('xdotool getwindowfocus', (error, output) => {
        let windowId = null;
        let windowActiveMatch = output.match(/^([0-9]+)\n$/);
        if (windowActiveMatch) {
          windowId = parseInt(windowActiveMatch[1]);
        }
        resolve(windowId);
      });
    });
  }

  static detectTools() {
    if (screenshotTools === null) {
      screenshotTools = [];
      let tests = [];
      tests.push(new Promise((resolve, reject) => {
        exec("import --version", (error, output) => {
          // TODO: Check version requirements?
          if (!error) {
            screenshotTools.push("Imagick");
          }
          resolve();
        });
      }));
      tests.push(new Promise((resolve, reject) => {
        exec("scrot --version", (error, output) => {
          // TODO: Check version requirements?
          if (!error) {
            screenshotTools.push("Scrot");
          }
          resolve();
        });
      }));
      return Promise.all(tests);
    } else {
      return Promise.resolve();
    }
  }

  /**
   * Capture a screenshot
   * @param options
   * @returns {Promise<Buffer>}
   */
  static capture(options = {}, targetTool = null) {
    // Default format
    if (!options.hasOwnProperty("format")) {
      options.format = "PNG";
    }
    // Screenshot tool
    return this.detectTools().then(() => {
      if (targetTool === null) {
        if (screenshotTools.indexOf("Scrot") >= 0) {
          targetTool = "Scrot";
        } else if (screenshotTools.length > 0) {
          targetTool = screenshotTools[0];
        }
      }
      if (targetTool === "Scrot") {
        if ((options.target.type === "window") && !options.target.foreground) {
          // Options not supported by Scrot! Switch to Imagick.
          if (screenshotTools.indexOf("Imagick") >= 0) {
            targetTool = "Imagick";
          }
        }
      }
      switch (targetTool) {
        case "Imagick":
          return this.captureImagick(options);
        case "Scrot":
          return this.captureScrot(options);
        default:
          return Promise.reject(new Error("No usable screenshot tool available!"));
      }
    });
  }

  /**
   * Capture a screenshot
   * @param options
   * @returns {Promise<Buffer>}
   */
  static captureScrot(options = {}) {
    return new Promise((resolve, reject) => {
      let crop = null;
      // Build command
      let execCmd = 'scrot';
      // -> Target
      switch (options.target.type) {
        case 'window':
          if (!options.target.foreground) {
            reject(new Error("Cannot take screenshots of background windows using 'scrot'"));
            return;
          }
        case 'screen':
          crop = super.getCropObject(options.target.size.width, options.target.size.height, options.target.offset.x, options.target.offset.y);
          break;
      }
      // -> Crop
      if (typeof options.crop !== 'undefined') {
        crop.size.width = options.crop.size.width;
        crop.size.height = options.crop.size.height;
        crop.offset.x += options.crop.offset.x;
        crop.offset.y += options.crop.offset.y;
      }
      execCmd += ' -a '+ScreenshotLinux.getCropStringScrot(crop);
      // -> Format and Filename
      let filename = ((new Date()).getTime() * 1000)+"."+options.format.toLowerCase();
      execCmd += ' /tmp/'+filename+' && cat /tmp/'+filename+' && rm /tmp/'+filename; // Output to stdout
      // Set exec options
      let execOptions = {
        encoding: 'buffer',
        maxBuffer: super.getBufferSize(crop.size.width, crop.size.height, 32)
      };
      // Run now
      exec(execCmd, execOptions, (error, output) => {
        if (error) {
          reject(error);
        } else {
          resolve(output);
        }
      });
    });
  }

  /**
   * Capture a screenshot
   * @param options
   * @returns {Promise<Buffer>}
   */
  static captureImagick(options = {}) {
    return new Promise((resolve, reject) => {
      let crop = null;
      // Build command
      let execCmd = 'import -silent';
      // -> Target
      switch (options.target.type) {
        case 'window':
          if (options.target.foreground) {
            // Window is in foreground, use faster method via "-window root"
            execCmd += ' -window root';
            crop = super.getCropObject(options.target.size.width, options.target.size.height, options.target.offset.x, options.target.offset.y);
          } else {
            // Window is in background, use slower method
            execCmd += ' -window ' + options.target.ident;
            crop = super.getCropObject(options.target.size.width, options.target.size.height);
          }
          break;
        case 'screen':
          execCmd += ' -window root';
          crop = super.getCropObject(options.target.size.width, options.target.size.height, options.target.offset.x, options.target.offset.y);
          break;
      }
      // -> Crop
      if (typeof options.crop !== 'undefined') {
        crop.size.width = options.crop.size.width;
        crop.size.height = options.crop.size.height;
        crop.offset.x += options.crop.offset.x;
        crop.offset.y += options.crop.offset.y;
      }
      execCmd += ' -crop '+ScreenshotLinux.getCropStringImagick(crop);
      // -> Format and Filename
      execCmd += ' "'+options.format.toUpperCase()+'":"-"'; // Output to stdout
      // Set exec options
      let execOptions = {
        encoding: 'buffer',
        maxBuffer: super.getBufferSize(crop.size.width, crop.size.height, 32)
      };
      // Run now
      exec(execCmd, execOptions, (error, output) => {
        if (error) {
          reject(error);
        } else {
          resolve(output);
        }
      });
    });
  }


}

module.exports = ScreenshotLinux;
