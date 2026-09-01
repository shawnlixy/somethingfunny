/**
 * 安装 Electron 二进制（Windows 下 extract-zip 可能解压失败，改用 Expand-Archive）
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

function findElectronDir() {
  const pnpmRoot = path.join(__dirname, '../node_modules/.pnpm')
  const entries = fs.readdirSync(pnpmRoot)
  const electronFolder = entries.find((name) => name.startsWith('electron@'))
  if (!electronFolder) {
    throw new Error('未找到 electron 包，请先执行 pnpm install')
  }
  return path.join(pnpmRoot, electronFolder, 'node_modules/electron')
}

function readVersion(electronDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(electronDir, 'package.json'), 'utf8'))
  return pkg.version
}

function findCachedZip(version) {
  const cacheRoot = path.join(process.env.LOCALAPPDATA || '', 'electron', 'Cache')
  if (!fs.existsSync(cacheRoot)) return null

  for (const hashDir of fs.readdirSync(cacheRoot)) {
    const zipPath = path.join(cacheRoot, hashDir, `electron-v${version}-win32-x64.zip`)
    if (fs.existsSync(zipPath)) return zipPath
  }
  return null
}

function downloadViaInstallJs(electronDir) {
  const result = spawnSync(process.execPath, ['install.js'], {
    cwd: electronDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/',
    },
  })
  if (result.status !== 0) {
    throw new Error('node install.js 执行失败')
  }
}

function extractOnWindows(zipPath, distDir) {
  fs.mkdirSync(distDir, { recursive: true })
  const ps = [
    `$ErrorActionPreference='Stop'`,
    `if (Test-Path '${distDir.replace(/'/g, "''")}') { Remove-Item -Recurse -Force '${distDir.replace(/'/g, "''")}' }`,
    `New-Item -ItemType Directory -Path '${distDir.replace(/'/g, "''")}' -Force | Out-Null`,
    `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${distDir.replace(/'/g, "''")}' -Force`,
  ].join('; ')

  const result = spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error('Expand-Archive 解压失败')
  }
}

function main() {
  const electronDir = findElectronDir()
  const version = readVersion(electronDir)
  const distDir = path.join(electronDir, 'dist')
  const exePath = path.join(distDir, process.platform === 'win32' ? 'electron.exe' : 'electron')

  if (fs.existsSync(exePath)) {
    console.log('[install:electron] 已安装:', exePath)
    return
  }

  console.log('[install:electron] 正在安装 Electron', version)

  // 先尝试官方 install.js 下载缓存
  try {
    downloadViaInstallJs(electronDir)
  } catch {
    // 忽略，后续走手动解压
  }

  if (!fs.existsSync(exePath) && process.platform === 'win32') {
    let zipPath = findCachedZip(version)
    if (!zipPath) {
      downloadViaInstallJs(electronDir)
      zipPath = findCachedZip(version)
    }
    if (!zipPath) {
      throw new Error('未找到 Electron 缓存 zip，请检查网络或镜像配置')
    }
    console.log('[install:electron] 使用 Expand-Archive 解压:', zipPath)
    extractOnWindows(zipPath, distDir)
  }

  if (!fs.existsSync(exePath)) {
    throw new Error('Electron 安装失败，缺少可执行文件')
  }

  fs.writeFileSync(path.join(electronDir, 'path.txt'), process.platform === 'win32' ? 'electron.exe' : 'electron')
  if (!fs.existsSync(path.join(distDir, 'version'))) {
    fs.writeFileSync(path.join(distDir, 'version'), `v${version}`)
  }

  console.log('[install:electron] 完成:', exePath)
}

main()
