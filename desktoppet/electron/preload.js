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

contextBridge.exposeInMainWorld('petAPI', {
  getPetConfig: () => invoke('get-pet-config'),
  getSettings: () => invoke('get-settings'),
  getAssetDataUrl: (stateId) => invoke('get-asset-data-url', stateId),
  getAllAssetPreviews: () => invoke('get-all-asset-previews'),
  pickAsset: (stateId) => invoke('pick-asset', stateId),
  resetAsset: (stateId) => invoke('reset-asset', stateId),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse-events', ignore, { forward: true }),
  dragStart: (x, y) => ipcRenderer.send('drag-start', x, y),
  dragMove: (x, y) => ipcRenderer.send('drag-move', x, y),
  dragEnd: () => ipcRenderer.send('drag-end'),
  moveWindow: (x, y) => ipcRenderer.send('move-window', x, y),
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
