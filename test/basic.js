const fs = require('fs');
const Screenshot = require('../index.js');

async function runTests() {
  let screenList = null;
  let windowList = null;

  let timeStart = (new Date()).getTime();

  for (let i = 0; i < 10; i++) {
    await Screenshot.getScreens().then((screens) => {
      console.log("Listed screens after "+((new Date()).getTime() - timeStart)+"ms");
      screenList = screens;
      timeStart = (new Date()).getTime();
      return Screenshot.getWindows();
    }).then((windows) => {
      console.log("Listed windows after "+((new Date()).getTime() - timeStart)+"ms");
      windowList = windows;
      for (let i = 0; i < windows.length; i++) {
        if (windows[i].foreground) {
          timeStart = (new Date()).getTime();
          return Screenshot.capture({ target: windows[i] });
        }
      }
      return Promise.reject(new Error("Failed to detect any window with a usable size. (at least 10x10 pixels)"))
    }).then((screenshot) => {
      console.log("Captured window screenshot after "+((new Date()).getTime() - timeStart)+"ms");
      fs.writeFileSync("./test_window.png", screenshot);
      timeStart = (new Date()).getTime();
      return Screenshot.capture({
        target: screenList[0],
        crop: Screenshot.getCropObject(100, 100, 50, 50)
      })
    }).then((screenshot) => {
      console.log("Captured monitor screenshot after "+((new Date()).getTime() - timeStart)+"ms");
      fs.writeFileSync("./test_screen.png", screenshot);
    });
  }
}

runTests();
