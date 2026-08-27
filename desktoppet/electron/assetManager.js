import fs from 'fs'
import path from 'path'
import { app, dialog } from 'electron'

export const STATE_IDS = ['idle', 'walk', 'click', 'sleep', 'follow']

export const DEFAULT_PET_CONFIG = {
  name: 'MyPet',
  defaultSize: 128,
  states: {
    idle: { image: 'idle.png', duration: 0 },
    walk: { image: 'walk.png', duration: 0 },
    click: { image: 'click.png', duration: 1500, next: 'idle' },
    sleep: { image: 'sleep.png', duration: 10000, next: 'idle' },
    follow: { image: 'follow.png', duration: 0 },
  },
}

export function getUserAssetsDir() { return path.join(app.getPath('userData'), 'assets') }
export function getUserConfigPath() { return path.join(app.getPath('userData'), 'petConfig.json') }
export function getDefaultAssetsDir() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'dist', 'assets', 'pet', 'default')
  return path.join(app.getAppPath(), 'public', 'assets', 'pet', 'default')
}
export function ensureUserAssetsDir() {
  const dir = getUserAssetsDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}
export function getPetConfig() {
  const configPath = getUserConfigPath()
  if (fs.existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      return { ...DEFAULT_PET_CONFIG, ...userConfig, states: { ...DEFAULT_PET_CONFIG.states, ...(userConfig.states || {}) } }
    } catch (e) { console.error(e) }
  }
  return structuredClone(DEFAULT_PET_CONFIG)
}
export function savePetConfig(config) {
  ensureUserAssetsDir()
  fs.writeFileSync(getUserConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
}
export function getAssetFilePath(stateId) {
  const config = getPetConfig()
  const stateConfig = config.states[stateId]
  if (!stateConfig) throw new Error(`未知状态: ${stateId}`)
  for (const ext of ['.png', '.webp']) {
    const userFile = path.join(getUserAssetsDir(), `${stateId}${ext}`)
    if (fs.existsSync(userFile)) return userFile
  }
  const defaultFile = path.join(getDefaultAssetsDir(), stateConfig.image)
  if (fs.existsSync(defaultFile)) return defaultFile
  throw new Error(`找不到状态 ${stateId} 的素材文件`)
}
export function getAssetDataUrl(stateId) {
  const filePath = getAssetFilePath(stateId)
  const buffer = fs.readFileSync(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const mime = ext === '.webp' ? 'image/webp' : 'image/png'
  return `data:${mime};base64,${buffer.toString('base64')}`
}
export async function pickAssetForState(stateId, browserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, { filters: [{ name: 'Images', extensions: ['png', 'webp'] }], properties: ['openFile'] })
  if (result.canceled || !result.filePaths.length) return null
  const sourcePath = result.filePaths[0]
  ensureUserAssetsDir()
  const ext = path.extname(sourcePath).toLowerCase()
  const targetPath = path.join(getUserAssetsDir(), `${stateId}${ext}`)
  fs.copyFileSync(sourcePath, targetPath)
  const config = getPetConfig()
  config.states[stateId] = { ...config.states[stateId], image: `${stateId}${ext}` }
  savePetConfig(config)
  return { stateId, filePath: targetPath, dataUrl: getAssetDataUrl(stateId) }
}
export function resetAssetForState(stateId) {
  const config = getPetConfig()
  for (const ext of ['.png', '.webp']) {
    const userFile = path.join(getUserAssetsDir(), `${stateId}${ext}`)
    if (fs.existsSync(userFile)) fs.unlinkSync(userFile)
  }
  config.states[stateId] = { ...DEFAULT_PET_CONFIG.states[stateId] }
  savePetConfig(config)
  return { stateId, dataUrl: getAssetDataUrl(stateId) }
}
export function getAllAssetPreviews() {
  const previews = {}
  for (const stateId of STATE_IDS) {
    try { previews[stateId] = getAssetDataUrl(stateId) } catch { previews[stateId] = null }
  }
  return previews
}
