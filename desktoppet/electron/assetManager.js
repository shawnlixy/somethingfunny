import fs from 'fs'
import path from 'path'
import { app, dialog } from 'electron'

/** 宠物状态 ID 列表 */
export const STATE_IDS = ['idle', 'walk', 'click', 'sleep', 'follow']

/** 内置默认配置 */
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

/** 用户素材目录 */
export function getUserAssetsDir() {
  return path.join(app.getPath('userData'), 'assets')
}

/** 用户配置文件路径 */
export function getUserConfigPath() {
  return path.join(app.getPath('userData'), 'petConfig.json')
}

/** 内置默认素材目录 */
export function getDefaultAssetsDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'dist', 'assets', 'pet', 'default')
  }
  return path.join(app.getAppPath(), 'public', 'assets', 'pet', 'default')
}

/** 确保用户素材目录存在 */
export function ensureUserAssetsDir() {
  const dir = getUserAssetsDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/** 读取宠物配置（用户配置优先，否则使用默认） */
export function getPetConfig() {
  const configPath = getUserConfigPath()
  if (fs.existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      return {
        ...DEFAULT_PET_CONFIG,
        ...userConfig,
        states: {
          ...DEFAULT_PET_CONFIG.states,
          ...(userConfig.states || {}),
        },
      }
    } catch (error) {
      console.error('读取用户配置失败，回退到默认配置:', error)
    }
  }
  return structuredClone(DEFAULT_PET_CONFIG)
}

/** 保存用户配置 */
export function savePetConfig(config) {
  ensureUserAssetsDir()
  fs.writeFileSync(getUserConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
}

/** 获取某状态素材的绝对路径（用户自定义优先） */
export function getAssetFilePath(stateId) {
  const config = getPetConfig()
  const stateConfig = config.states[stateId]
  if (!stateConfig) {
    throw new Error(`未知状态: ${stateId}`)
  }

  const userAssetsDir = getUserAssetsDir()
  for (const ext of ['.png', '.webp']) {
    const userFile = path.join(userAssetsDir, `${stateId}${ext}`)
    if (fs.existsSync(userFile)) {
      return userFile
    }
  }

  const defaultFile = path.join(getDefaultAssetsDir(), stateConfig.image)
  if (fs.existsSync(defaultFile)) {
    return defaultFile
  }

  throw new Error(`找不到状态 ${stateId} 的素材文件`)
}

/** 读取素材并转为 data URL，供渲染进程显示 */
export function getAssetDataUrl(stateId) {
  const filePath = getAssetFilePath(stateId)
  const buffer = fs.readFileSync(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const mime = ext === '.webp' ? 'image/webp' : 'image/png'
  return `data:${mime};base64,${buffer.toString('base64')}`
}

/** 校验图片文件 */
function validateImageFile(filePath) {
  const stat = fs.statSync(filePath)
  if (!stat.isFile()) {
    throw new Error('请选择有效的图片文件')
  }
  if (stat.size > 2 * 1024 * 1024) {
    throw new Error('图片不能超过 2MB')
  }

  const ext = path.extname(filePath).toLowerCase()
  if (!['.png', '.webp'].includes(ext)) {
    throw new Error('仅支持 PNG 或 WebP 格式')
  }
}

/** 打开文件选择器并复制素材到 userData */
export async function pickAssetForState(stateId, browserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, {
    title: `选择 ${stateId} 状态图片`,
    filters: [{ name: 'Images', extensions: ['png', 'webp'] }],
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const sourcePath = result.filePaths[0]
  validateImageFile(sourcePath)

  ensureUserAssetsDir()
  const ext = path.extname(sourcePath).toLowerCase()
  const targetPath = path.join(getUserAssetsDir(), `${stateId}${ext}`)

  fs.copyFileSync(sourcePath, targetPath)

  const config = getPetConfig()
  config.states[stateId] = {
    ...config.states[stateId],
    image: `${stateId}${ext}`,
  }
  savePetConfig(config)

  return {
    stateId,
    filePath: targetPath,
    dataUrl: getAssetDataUrl(stateId),
  }
}

/** 恢复某状态为内置默认素材 */
export function resetAssetForState(stateId) {
  const config = getPetConfig()
  const defaultState = DEFAULT_PET_CONFIG.states[stateId]
  if (!defaultState) {
    throw new Error(`未知状态: ${stateId}`)
  }

  const userAssetsDir = getUserAssetsDir()
  for (const ext of ['.png', '.webp']) {
    const userFile = path.join(userAssetsDir, `${stateId}${ext}`)
    if (fs.existsSync(userFile)) {
      fs.unlinkSync(userFile)
    }
  }

  config.states[stateId] = { ...defaultState }
  savePetConfig(config)

  return {
    stateId,
    dataUrl: getAssetDataUrl(stateId),
  }
}

/** 列出所有状态的预览 data URL */
export function getAllAssetPreviews() {
  const previews = {}
  for (const stateId of STATE_IDS) {
    try {
      previews[stateId] = getAssetDataUrl(stateId)
    } catch (error) {
      previews[stateId] = null
      console.warn(`预览 ${stateId} 失败:`, error.message)
    }
  }
  return previews
}
