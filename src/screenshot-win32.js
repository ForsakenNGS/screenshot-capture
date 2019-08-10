const path = require('path');
const exec = require('child_process').exec;
const ScreenshotGeneric = require('./screenshot-generic.js');

const screenshotTool = path.resolve( path.join(__dirname, "..", "lib", "win32", "ScreenshotTool.exe") );
const regexpScreen = /^Screen ([0-9]+): "(.*)"\s+([0-9]+)x([0-9]+)\+([0-9-]+)\+([0-9-]+)$/;
const regexpWindow = /^Window ([0-9]+): "(.*)"\s\((.+)\)\s+([0-9]+)x([0-9]+)\+([0-9-]+)\+([0-9-]+)$/;

class ScreenshotWindows extends ScreenshotGeneric {

  /**
   * Get the string version of the given crop object for use with ImageMagick
   * @param cropObject
   * @returns {string}
   */
  static getCropString(cropObject) {
    return "-width "+cropObject.size.width+" -height "+cropObject.size.height
      +" -offsetX "+cropObject.offset.x+" -offsetY "+cropObject.offset.y;
  }

  static getScreenshotCommand(args) {
    return "\""+screenshotTool+"\" "+args;
  }

  /**
   * Get a list of all available screens
   * @returns {Promise<unknown>}
   */
  static getScreens() {
    return new Promise((resolve, reject) => {
      exec(ScreenshotWindows.getScreenshotCommand("-getScreens"), (error, output) => {
        let screens = [];
        let outputLines = output.split('\r\n');
        for (let i = 0; i < outputLines.length; i++) {
          let line = outputLines[i];
          // Screen 65537: "" 1440x900+0+0
          let matchScreen = line.match(regexpScreen);
          if (matchScreen) {
            // Fill screen settings
            let screen = super.getScreenDummy();
            screen.ident = matchScreen[1];
            screen.extra.name = matchScreen[2];
            screen.primary = (i === 0);
            screen.size.width = parseInt(matchScreen[3]);
            screen.size.height = parseInt(matchScreen[4]);
            screen.offset.x = parseInt(matchScreen[5]);
            screen.offset.y = parseInt(matchScreen[6]);
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
    return new Promise((resolve, reject) => {
      exec(ScreenshotWindows.getScreenshotCommand("-getWindows"), (error, output) => {
        let windows = [];
        let outputLines = output.split('\r\n');
        for (let i = 0; i < outputLines.length; i++) {
          let line = outputLines[i];
          // Window 1050236: "Windows PowerShell" 1233x839+161+16
          let matchWindow = line.match(regexpWindow);
          if (matchWindow) {
            let window = super.getWindowDummy();
            window.ident = parseInt(matchWindow[1]);
            window.title = matchWindow[2];
            window.extra.flags = matchWindow[3].split(",");
            window.foreground = (window.extra.flags.indexOf("ACTIVE") >= 0);
            window.size.width = parseInt(matchWindow[4]);
            window.size.height = parseInt(matchWindow[5]);
            window.offset.x = parseInt(matchWindow[6]);
            window.offset.y = parseInt(matchWindow[7]);
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
      let execCmd = '';
      // -> Target
      switch (options.target.type) {
        case 'window':
          execCmd += ' -captureWindow '+options.target.ident;
          crop = super.getCropObject(options.target.size.width, options.target.size.height);
          break;
        case 'screen':
          execCmd += ' -captureScreen '+options.target.ident;
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
      execCmd += ' '+ScreenshotWindows.getCropString(crop);
      // -> Format and Filename
      let format = 'PNG';
      if (typeof options.format !== 'undefined') {
        format = options.format.toUpperCase();
      }
      execCmd += ' -format '+format;
      // Set exec options
      let execOptions = {
        encoding: 'buffer',
        maxBuffer: super.getBufferSize(crop.size.width, crop.size.height, 32)
      };
      // Run now
      exec(ScreenshotWindows.getScreenshotCommand(execCmd), execOptions, (error, output) => {
        if (error) {
          reject(error);
        } else {
          resolve(output);
        }
      });
    });
  }


}

module.exports = ScreenshotWindows;
