import { contextBridge, ipcRenderer } from 'electron'

const listeners = {
  'check-mouse-position': new Set(),
  'update-focus': new Set(),
  'asset-updated': new Set(),
  'settings-changed': new Set(),
}

function subscribe(channel, callback) {
  listeners[channel]?.add(callback)
}

function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args)
}

/** 仅发送可结构化克隆的原始值，避免 IPC 转换失败 */
function sendSafePosition(channel, x, y) {
  const px = Math.round(Number(x))
  const py = Math.round(Number(y))
  if (!Number.isFinite(px) || !Number.isFinite(py)) return
  ipcRenderer.send(channel, px, py)
}

contextBridge.exposeInMainWorld('petAPI', {
  getPetConfig: () => invoke('get-pet-config'),
  getSettings: () => invoke('get-settings'),
  getAssetDataUrl: (stateId) => invoke('get-asset-data-url', stateId),
  getAllAssetPreviews: () => invoke('get-all-asset-previews'),
  pickAsset: (stateId) => invoke('pick-asset', stateId),
  resetAsset: (stateId) => invoke('reset-asset', stateId),
  // 只传 boolean，forward 选项在主进程内处理
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse-events', Boolean(ignore)),
  dragStart: (x, y) => sendSafePosition('drag-start', x, y),
  dragEnd: () => ipcRenderer.send('drag-end'),
  saveWindowPosition: () => ipcRenderer.send('save-window-position'),
  moveWindow: (x, y) => sendSafePosition('move-window', x, y),
  onCheckMousePosition: (callback) => subscribe('check-mouse-position', callback),
  onUpdateFocus: (callback) => subscribe('update-focus', callback),
  onAssetUpdated: (callback) => subscribe('asset-updated', callback),
  onSettingsChanged: (callback) => subscribe('settings-changed', callback),
})

ipcRenderer.on('check-mouse-position', (_event, payload) => {
  listeners['check-mouse-position'].forEach((cb) => cb(payload))
})

ipcRenderer.on('update-focus', (_event, payload) => {
  listeners['update-focus'].forEach((cb) => cb(payload))
})

ipcRenderer.on('asset-updated', (_event, payload) => {
  listeners['asset-updated'].forEach((cb) => cb(payload))
})

ipcRenderer.on('settings-changed', (_event, payload) => {
  listeners['settings-changed'].forEach((cb) => cb(payload))
})
