"use strict";

import { app, protocol, BrowserWindow, ipcMain } from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";
import { autoUpdater } from 'electron-updater'
import { updateHandle } from './utils/update.js'
const isDevelopment = process.env.NODE_ENV !== "production";
require('@electron/remote/main').initialize()

import path from 'path'
import sq3 from 'sqlite3'
const sqlite3 = sq3.verbose()
const db = new sqlite3.Database(path.join(__static, 'database.db'))

ipcMain.handle('updateDB', async (event, arg) => {
  return new Promise((resolve, reject) => {
    for (let movie in arg) {
      let movieObj = arg[movie]
      for (let number in movieObj) {
        let subtitleObj = movieObj[number]
        let { timeline, subtitle } = subtitleObj
        db.all(`insert into subtitle values(?,?,?,?)`, [movie, subtitle, timeline, number], (err, res) => {
          if (err) reject(err)
          else resolve(res)
        })
      }
    }
  })
})

ipcMain.handle('movieListSearch', async (event, arg) => {
  return new Promise((resolve, reject) => {
    db.all(`select distinct movie from subtitle`, (err, res) => {
      if (err) reject(err.message)
      else resolve(res)
    })
  })
})

ipcMain.handle('search', async (event, arg) => {
  return new Promise((resolve, reject) => {
    db.all(`select * from subtitle where subtitle like ?`, ['%' + arg + '%'], (err, res) => {
      if (err) reject(err.message)
      else resolve(res)
    })
  })
})

ipcMain.handle('contextSearch', async (event, arg) => {
  let { movie, number } = arg
  return new Promise((resolve, reject) => {
    db.all(`select * from subtitle where movie = ? and number >= ${number - 5} and number <= ${number + 5} order by number`, [movie], (err, res) => {
      if (err) reject(err.message)
      else resolve(res)
    })
  })
})

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true } },
]);

async function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    webPreferences: {
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
      enableRemoteModule: true,
    },
  });

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL);
    if (!process.env.IS_TEST) win.webContents.openDevTools();
  } else {
    createProtocol("app");
    // Load the index.html when not in development
    win.loadURL("app://./index.html");
  }

  updateHandle(win)

  setTimeout(() => {
    autoUpdater.checkForUpdates()
  }, 3000)
}

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS_DEVTOOLS);
    } catch (e) {
      console.error("Vue Devtools failed to install:", e.toString());
    }
  }
  createWindow();
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === "win32") {
    process.on("message", (data) => {
      if (data === "graceful-exit") {
        app.quit();
      }
    });
  } else {
    process.on("SIGTERM", () => {
      app.quit();
    });
  }
}
