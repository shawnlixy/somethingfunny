import { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } from 'electron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import serve from 'electron-serve'
import Store from 'electron-store'
import {
  getAllAssetPreviews,
  getAssetDataUrl,
  getPetConfig,
  pickAssetForState,
  resetAssetForState,
} from './assetManager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isPackaged = app.isPackaged
const DIST_PATH = isPackaged
  ? path.join(process.resourcesPath, 'dist')
  : path.join(__dirname, '../dist')

const loadURL = serve({
  directory: DIST_PATH,
  scheme: 'app',
})

const store = new Store({
  defaults: {
    paused: false,
    locked: false,
    petHidden: false,
    windowPosition: null,
  },
})

let petWindow = null
let settingsWindow = null
let tray = null
let mouseCheckInterval = null
let savePositionTimer = null
let dragOffset = null
let dragMoveHandle = null

const PET_WINDOW_SIZE = 220
const MOUSE_POLL_INTERVAL = 50 // 降低轮询频率，减轻 IPC 压力

function getDevServerUrl(route = '/') {
  const base = process.env.VITE_DEV_SERVER_URL || ''
  return `${base}#${route}`
}

function loadRoute(win, route = '/') {
  if (isPackaged) {
    return loadURL(win).then(() => win.loadURL(`app://./index.html#${route}`))
  }
  return win.loadURL(getDevServerUrl(route))
}

function getTrayIcon() {
  const iconPath = path.join(__dirname, 'tray-icon.png')
  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath)
  }
  // 兜底：16x16 蓝色方块，确保托盘可见
  return nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR42mNk+M9Qz0BFYGBgYGBg+A8EGP8zUACmYQj5ZQhZAAAAAElFTkSuQmCC',
      'base64'
    )
  )
}

function broadcastToPetWindow(channel, payload) {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send(channel, payload)
  }
}

/** 安全移动窗口，避免 NaN/非法坐标触发 conversion failure */
function safeSetPosition(win, x, y) {
  if (!win || win.isDestroyed()) return false
  const px = Math.round(Number(x))
  const py = Math.round(Number(y))
  if (!Number.isFinite(px) || !Number.isFinite(py)) return false
  try {
    win.setPosition(px, py)
    return true
  } catch (error) {
    console.error('setPosition 失败:', px, py, error.message)
    return false
  }
}

/** 安全设置鼠标穿透，ignore=false 时不传 options */
function safeSetIgnoreMouseEvents(win, ignore) {
  if (!win || win.isDestroyed()) return
  try {
    if (ignore) {
      win.setIgnoreMouseEvents(true, { forward: true })
    } else {
      win.setIgnoreMouseEvents(false)
    }
  } catch (error) {
    console.error('setIgnoreMouseEvents 失败:', error.message)
  }
}

function getInitialPetPosition() {
  const saved = store.get('windowPosition')
  const { workArea } = screen.getPrimaryDisplay()
  const defaultPos = {
    x: workArea.x + workArea.width - PET_WINDOW_SIZE - 20,
    y: workArea.y + workArea.height - PET_WINDOW_SIZE - 20,
  }
  if (!saved) return defaultPos
  return clampPositionToWorkArea(saved.x, saved.y, PET_WINDOW_SIZE, PET_WINDOW_SIZE)
}

/** 把窗口坐标限制在当前显示器工作区内，避免跑到屏幕外看不见 */
function clampPositionToWorkArea(x, y, width, height) {
  const display = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) })
  const { workArea } = display
  return {
    x: Math.max(workArea.x, Math.min(Math.round(x), workArea.x + workArea.width - width)),
    y: Math.max(workArea.y, Math.min(Math.round(y), workArea.y + workArea.height - height)),
  }
}

/** 确保宠物窗口在可见区域内 */
function ensurePetWindowVisible() {
  if (!petWindow || petWindow.isDestroyed()) return
  const bounds = petWindow.getBounds()
  const clamped = clampPositionToWorkArea(bounds.x, bounds.y, bounds.width, bounds.height)
  if (clamped.x !== bounds.x || clamped.y !== bounds.y) {
    safeSetPosition(petWindow, clamped.x, clamped.y)
    savePetWindowPosition()
  }
}

function showPetWindow() {
  if (!petWindow || petWindow.isDestroyed()) return
  ensurePetWindowVisible()
  petWindow.show()
  petWindow.setAlwaysOnTop(true)
  petWindow.moveTop()
}

function savePetWindowPosition() {
  if (!petWindow || petWindow.isDestroyed()) return
  const bounds = petWindow.getBounds()
  store.set('windowPosition', { x: bounds.x, y: bounds.y })
}

/** 漫步/跟随等高频移动时合并写盘，避免每帧 fs 写入 */
function savePetWindowPositionDebounced(delay = 400) {
  clearTimeout(savePositionTimer)
  savePositionTimer = setTimeout(savePetWindowPosition, delay)
}

function stopDragTracking() {
  if (dragMoveHandle != null) {
    clearImmediate(dragMoveHandle)
    dragMoveHandle = null
  }
  dragOffset = null
}

/** 主进程高频跟踪光标移动窗口（透明窗下比 webkit-app-region 更可靠） */
function startDragTracking(win, screenX, screenY) {
  stopDragTracking()
  const sx = Math.round(Number(screenX))
  const sy = Math.round(Number(screenY))
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return

  const bounds = win.getBounds()
  dragOffset = { x: sx - bounds.x, y: sy - bounds.y }

  const tick = () => {
    if (!dragOffset || win.isDestroyed()) {
      stopDragTracking()
      return
    }
    const cursor = screen.getCursorScreenPoint()
    safeSetPosition(
      win,
      cursor.x - dragOffset.x,
      cursor.y - dragOffset.y
    )
    dragMoveHandle = setImmediate(tick)
  }

  dragMoveHandle = setImmediate(tick)
}

function startMousePolling() {
  if (mouseCheckInterval) return

  mouseCheckInterval = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) return
    if (dragOffset) return

    try {
      const cursor = screen.getCursorScreenPoint()
      const bounds = petWindow.getBounds()

      petWindow.webContents.send('update-focus', {
        windowX: bounds.x,
        windowY: bounds.y,
        cursorX: cursor.x,
        cursorY: cursor.y,
      })

      const relX = cursor.x - bounds.x
      const relY = cursor.y - bounds.y
      if (relX >= 0 && relX <= bounds.width && relY >= 0 && relY <= bounds.height) {
        petWindow.webContents.send('check-mouse-position', { x: relX, y: relY })
      }
    } catch (error) {
      console.error('鼠标轮询失败:', error)
    }
  }, MOUSE_POLL_INTERVAL)
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 760,
    height: 680,
    title: '素材设置',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  loadRoute(settingsWindow, '/settings')
}

function createTray() {
  tray = new Tray(getTrayIcon())
  tray.setToolTip('Desktop Pet')

  const rebuildMenu = () => {
    const paused = store.get('paused')
    const locked = store.get('locked')

    const menu = Menu.buildFromTemplate([
      {
        label: petWindow?.isVisible() ? '隐藏宠物' : '显示宠物',
        click: () => {
          if (!petWindow) return
          if (petWindow.isVisible()) {
            petWindow.hide()
            store.set('petHidden', true)
          } else {
            showPetWindow()
            store.set('petHidden', false)
          }
          rebuildMenu()
        },
      },
      {
        label: '重置宠物位置',
        click: () => {
          if (!petWindow) return
          const { workArea } = screen.getPrimaryDisplay()
          safeSetPosition(
            petWindow,
            workArea.x + workArea.width - PET_WINDOW_SIZE - 20,
            workArea.y + workArea.height - PET_WINDOW_SIZE - 20
          )
          savePetWindowPosition()
          showPetWindow()
          store.set('petHidden', false)
        },
      },
      { type: 'separator' },
      {
        label: '更换素材',
        click: () => createSettingsWindow(),
      },
      {
        label: paused ? '恢复行为' : '暂停行为',
        click: () => {
          const next = !store.get('paused')
          store.set('paused', next)
          broadcastToPetWindow('settings-changed', { paused: next, locked: store.get('locked') })
          rebuildMenu()
        },
      },
      {
        label: locked ? '解锁位置' : '锁定位置',
        click: () => {
          const next = !store.get('locked')
          store.set('locked', next)
          broadcastToPetWindow('settings-changed', { paused: store.get('paused'), locked: next })
          rebuildMenu()
        },
      },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ])

    tray.setContextMenu(menu)
  }

  rebuildMenu()
  // 左键/右键都弹出菜单（Windows 托盘常规交互）
  tray.on('click', () => {
    rebuildMenu()
    tray.popUpContextMenu()
  })
  tray.on('right-click', () => {
    rebuildMenu()
    tray.popUpContextMenu()
  })
}

function createPetWindow() {
  const initialPosition = getInitialPetPosition()

  petWindow = new BrowserWindow({
    width: PET_WINDOW_SIZE,
    height: PET_WINDOW_SIZE,
    x: initialPosition.x,
    y: initialPosition.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  petWindow.on('ready-to-show', () => {
    safeSetIgnoreMouseEvents(petWindow, true)
    ensurePetWindowVisible()

    // 上次若隐藏则保持隐藏；否则显示（并校正到可见区域）
    if (store.get('petHidden')) {
      petWindow.hide()
    } else {
      showPetWindow()
    }

    startMousePolling()
  })

  petWindow.on('move', () => savePetWindowPositionDebounced())
  petWindow.on('closed', () => {
    petWindow = null
    stopDragTracking()
    if (mouseCheckInterval) {
      clearInterval(mouseCheckInterval)
      mouseCheckInterval = null
    }
  })

  loadRoute(petWindow, '/')
}

function setupIPC() {
  ipcMain.handle('get-pet-config', () => getPetConfig())
  ipcMain.handle('get-settings', () => ({
    paused: store.get('paused'),
    locked: store.get('locked'),
  }))
  ipcMain.handle('get-asset-data-url', (_event, stateId) => getAssetDataUrl(stateId))
  ipcMain.handle('get-all-asset-previews', () => getAllAssetPreviews())
  ipcMain.handle('pick-asset', async (_event, stateId) => {
    const result = await pickAssetForState(stateId, settingsWindow || petWindow)
    if (result) {
      broadcastToPetWindow('asset-updated', { stateId })
    }
    return result
  })
  ipcMain.handle('reset-asset', (_event, stateId) => {
    const result = resetAssetForState(stateId)
    broadcastToPetWindow('asset-updated', { stateId })
    return result
  })

  ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    safeSetIgnoreMouseEvents(win, Boolean(ignore))
  })

  ipcMain.on('save-window-position', () => {
    savePetWindowPosition()
  })

  ipcMain.on('drag-start', (event, screenX, screenY) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    startDragTracking(win, screenX, screenY)
  })

  ipcMain.on('drag-end', () => {
    stopDragTracking()
    savePetWindowPosition()
  })

  ipcMain.on('move-window', (event, x, y) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (safeSetPosition(win, x, y)) {
      savePetWindowPositionDebounced()
    }
  })
}

app.whenReady().then(() => {
  setupIPC()
  createPetWindow()
  createTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createPetWindow()
  }
})
