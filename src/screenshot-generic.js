class ScreenshotGeneric {

  /**
   * Capture a screenshot
   * @param options
   * @returns {Promise<never>}
   */
  static capture(options = {}) {
    return Promise.reject(
      new Error("Function 'capture()' for platform '"+process.platform+"' is currently not supported.")
    );
  }

  /**
   * Get a list of windows by title
   * @param {string|RegExp} title
   * @returns {Promise<[]>}
   */
  static findWindowsByTitle(title) {
    return this.getWindows().then((windows) => {
      let windowsMatching = [];
      if (title instanceof RegExp) {
        for (let i = 0; i < windows.length; i++) {
          if (windows[i].title.match(title)) {
            windowsMatching.push(windows[i]);
          }
        }
      } else {
        for (let i = 0; i < windows.length; i++) {
          if (windows[i].title === title) {
            windowsMatching.push(windows[i]);
          }
        }
      }
      return windowsMatching;
    });
  }

  /**
   * Get an object describing the area to crop
   * @param {number} width
   * @param {number} height
   * @param {number} offsetX
   * @param {number} offsetY
   * @returns {{size: {width: *, height: *}, offset: {x: *, y: *}}}
   */
  static getCropObject(width, height, offsetX = 0, offsetY = 0) {
    return {
      size: {
        width: width,
        height: height
      },
      offset: {
        x: offsetX,
        y: offsetY
      }
    };
  }

  /**
   * Get an empty object for a screen
   * @returns {{size: {width: null, height: null}, offset: {x: null, y: null}, refreshRate: null, ident: null, extra: {}, type: string, dpi: null, primary: null}}
   */
  static getScreenDummy() {
    return {
      type: "screen",
      ident: null,
      primary: null,
      size: {
        width: null,
        height: null
      },
      offset: {
        x: null,
        y: null
      },
      refreshRate: null,
      dpi: null,
      extra: {}
    };
  }

  /**
   * Get a list of available screens
   * @returns {Promise<never>}
   */
  static getScreens() {
    return Promise.reject(
      new Error("Function 'getDesktops()' for platform '"+process.platform+"' is currently not supported.")
    );
  }

  /**
   * Get an empty object for a window
   * @returns {{size: {width: null, height: null}, offset: {x: null, y: null}, ident: null, name: null, foreground: null, type: string, title: null, command: null}}
   */
  static getWindowDummy() {
    return {
      type: "window",
      ident: null,
      foreground: null,
      title: null,
      command: null,
      name: null,
      size: {
        width: null,
        height: null
      },
      offset: {
        x: null,
        y: null
      },
      extra: {}
    };
  }

  /**
   * Get a list of available windows
   * @returns {Promise<never>}
   */
  static getWindows() {
    return Promise.reject(
      new Error("Function 'getWindows()' for platform '"+process.platform+"' is currently not supported.")
    );
  }

  /**
   * Get the maximum expected byte size
   * @param {number} width
   * @param {number} height
   * @param {number} depth
   * @returns {number}
   */
  static getBufferSize(width, height, depth) {
    return 1024 * 1024 + width * height * depth / 8;
  }

}

module.exports = ScreenshotGeneric;
