import { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import serve from 'electron-serve'
import Store from 'electron-store'
import { getAllAssetPreviews, getAssetDataUrl, getPetConfig, pickAssetForState, resetAssetForState } from './assetManager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isPackaged = app.isPackaged
const DIST_PATH = isPackaged ? path.join(process.resourcesPath, 'dist') : path.join(__dirname, '../dist')
const loadURL = serve({ directory: DIST_PATH, scheme: 'app' })
const store = new Store({ defaults: { paused: false, locked: false, windowPosition: null } })

let petWindow = null, settingsWindow = null, tray = null, mouseCheckInterval = null, dragOffset = null
const PET_WINDOW_SIZE = 220

function getDevServerUrl(route = '/') { return `${process.env.VITE_DEV_SERVER_URL || ''}#${route}` }
function loadRoute(win, route = '/') { return isPackaged ? loadURL(win).then(() => win.loadURL(`app://./index.html#${route}`)) : win.loadURL(getDevServerUrl(route)) }
function getTrayIcon() { return nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAJYSUBVEhLtZa9SgNBFMefJIQEC0ELwcJCG1sLQAAAABJRU5ErkJggg==') }
function broadcastToPetWindow(channel, payload) { if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send(channel, payload) }
function getInitialPetPosition() {
  const saved = store.get('windowPosition')
  if (saved) return saved
  const { workArea } = screen.getPrimaryDisplay()
  return { x: workArea.x + workArea.width - PET_WINDOW_SIZE - 20, y: workArea.y + workArea.height - PET_WINDOW_SIZE - 20 }
}
function savePetWindowPosition() { if (petWindow && !petWindow.isDestroyed()) { const b = petWindow.getBounds(); store.set('windowPosition', { x: b.x, y: b.y }) } }
function startMousePolling() {
  if (mouseCheckInterval) return
  mouseCheckInterval = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) return
    const cursor = screen.getCursorScreenPoint(), bounds = petWindow.getBounds()
    petWindow.webContents.send('update-focus', { windowX: bounds.x, windowY: bounds.y, cursorX: cursor.x, cursorY: cursor.y })
    const relX = cursor.x - bounds.x, relY = cursor.y - bounds.y
    if (relX >= 0 && relX <= bounds.width && relY >= 0 && relY <= bounds.height) petWindow.webContents.send('check-mouse-position', { x: relX, y: relY })
  }, 33)
}
function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.show(); settingsWindow.focus(); return }
  settingsWindow = new BrowserWindow({ width: 760, height: 680, title: '素材设置', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } })
  settingsWindow.on('closed', () => { settingsWindow = null })
  loadRoute(settingsWindow, '/settings')
}
function createTray() {
  tray = new Tray(getTrayIcon()); tray.setToolTip('Desktop Pet')
  const rebuildMenu = () => {
    const paused = store.get('paused'), locked = store.get('locked')
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: petWindow?.isVisible() ? '隐藏宠物' : '显示宠物', click: () => { if (!petWindow) return; petWindow.isVisible() ? petWindow.hide() : petWindow.show(); rebuildMenu() } },
      { type: 'separator' },
      { label: '更换素材', click: () => createSettingsWindow() },
      { label: paused ? '恢复行为' : '暂停行为', click: () => { const next = !paused; store.set('paused', next); broadcastToPetWindow('settings-changed', { paused: next, locked }); rebuildMenu() } },
      { label: locked ? '解锁位置' : '锁定位置', click: () => { const next = !locked; store.set('locked', next); broadcastToPetWindow('settings-changed', { paused, locked: next }); rebuildMenu() } },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]))
  }
  rebuildMenu(); tray.on('click', rebuildMenu)
}
function createPetWindow() {
  const initialPosition = getInitialPetPosition()
  petWindow = new BrowserWindow({ width: PET_WINDOW_SIZE, height: PET_WINDOW_SIZE, x: initialPosition.x, y: initialPosition.y, frame: false, transparent: true, alwaysOnTop: true, hasShadow: false, resizable: false, show: false, skipTaskbar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false, contextIsolation: true, nodeIntegration: false } })
  petWindow.on('ready-to-show', () => { petWindow.setIgnoreMouseEvents(true, { forward: true }); petWindow.show(); startMousePolling() })
  petWindow.on('move', savePetWindowPosition)
  petWindow.on('closed', () => { petWindow = null; if (mouseCheckInterval) { clearInterval(mouseCheckInterval); mouseCheckInterval = null } })
  loadRoute(petWindow, '/')
}
function setupIPC() {
  ipcMain.handle('get-pet-config', () => getPetConfig())
  ipcMain.handle('get-settings', () => ({ paused: store.get('paused'), locked: store.get('locked') }))
  ipcMain.handle('get-asset-data-url', (_e, id) => getAssetDataUrl(id))
  ipcMain.handle('get-all-asset-previews', () => getAllAssetPreviews())
  ipcMain.handle('pick-asset', async (_e, id) => { const r = await pickAssetForState(id, settingsWindow || petWindow); if (r) broadcastToPetWindow('asset-updated', { stateId: id }); return r })
  ipcMain.handle('reset-asset', (_e, id) => { const r = resetAssetForState(id); broadcastToPetWindow('asset-updated', { stateId: id }); return r })
  ipcMain.on('set-ignore-mouse-events', (e, ignore, opts) => BrowserWindow.fromWebContents(e.sender)?.setIgnoreMouseEvents(ignore, opts))
  ipcMain.on('drag-start', (e, x, y) => { const w = BrowserWindow.fromWebContents(e.sender); if (!w) return; const b = w.getBounds(); dragOffset = { x: x - b.x, y: y - b.y } })
  ipcMain.on('drag-move', (e, x, y) => { const w = BrowserWindow.fromWebContents(e.sender); if (!w || !dragOffset) return; w.setPosition(Math.round(x - dragOffset.x), Math.round(y - dragOffset.y)) })
  ipcMain.on('drag-end', () => { dragOffset = null; savePetWindowPosition() })
  ipcMain.on('move-window', (e, x, y) => { const w = BrowserWindow.fromWebContents(e.sender); if (!w) return; w.setPosition(Math.round(x), Math.round(y)); savePetWindowPosition() })
}
app.whenReady().then(() => { setupIPC(); createPetWindow(); createTray() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createPetWindow() })
