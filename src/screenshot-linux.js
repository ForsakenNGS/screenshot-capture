const exec = require('child_process').exec;
const ScreenshotGeneric = require('./screenshot-generic.js');

const regexpScreen = /^(.+) connected (primary )?([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+) \((.+)\)( ([0-9]+)([^\s]+) x ([0-9]+)([^\s]+))?/;
const regexpResolution = /^\s+([0-9]+)x([0-9]+)\s+(.+)$/;
const regexpWindow = /^(\s+)0x([0-9a-f]+) (\(has no name\)|"(.+)"): \(("([^"]*)")?\s?("([^"]*)")\)\s+([0-9]+)x([0-9]+)\+([0-9-]+)\+([0-9-]+)\s+\+([0-9-]+)\+([0-9-]+)/;

class ScreenshotLinux extends ScreenshotGeneric {

  /**
   * Get the string version of the given crop object for use with ImageMagick
   * @param cropObject
   * @returns {string}
   */
  static getCropString(cropObject) {
    return cropObject.size.width+'x'+cropObject.size.height+'+'+cropObject.offset.x+'+'+cropObject.offset.y;
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

  /**
   * Capture a screenshot
   * @param options
   * @returns {Promise<Buffer>}
   */
  static capture(options = {}) {
    return new Promise((resolve, reject) => {
      let crop = null;
      // Build command
      let execCmd = 'import -silent';
      // -> Target
      switch (options.target.type) {
        case 'window':
          execCmd += ' -window ' + options.target.ident;
          crop = super.getCropObject(options.target.size.width, options.target.size.height);
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
      execCmd += ' -crop '+ScreenshotLinux.getCropString(crop);
      // -> Format and Filename
      let format = 'PNG';
      if (typeof options.format !== 'undefined') {
        format = options.format.toUpperCase();
      }
      execCmd += ' "'+format+'":"-"'; // Output to stdout
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
