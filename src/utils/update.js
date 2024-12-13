import { autoUpdater } from 'electron-updater'
import { ipcMain } from 'electron'

let mainWindow = null;
export function updateHandle(window) {
  mainWindow = window;
  autoUpdater.autoDownload = false // 关闭自动更新
  autoUpdater.autoInstallOnAppQuit = true // APP退出的时候自动安装
  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('Checking for update...')
  })
  autoUpdater.on('update-available', (info) => {
    // 能够更新版本
    sendStatusToWindow('autoUpdater-canUpdate', info)
  })
  autoUpdater.on('error', (err) => {
    // 更新错误
    sendStatusToWindow('autoUpdater-error', err)
  })
  autoUpdater.on('download-progress', (progressObj) => {
    // 正在下载的下载进度
    sendStatusToWindow('autoUpdater-progress', progressObj)
  })
  autoUpdater.on('update-downloaded', (info) => {
    // 下载完成
    sendStatusToWindow('autoUpdater-downloaded', info)
  })
  // 发起更新程序
  ipcMain.on('autoUpdater-toDownload', () => {
    autoUpdater.downloadUpdate()
  })
  // 退出程序
  ipcMain.on('exit-app', () => {
    autoUpdater.quitAndInstall()
  })

  // 发送消息给渲染线程
  function sendStatusToWindow(status, params) {
    mainWindow.webContents.send(status, params)
  }
}



