/**
 * 生成 5 张占位 PNG 素材（128x128，透明底 + 彩色圆形）
 * 运行: node scripts/generate-placeholders.js
 */
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(__dirname, '../public/assets/pet/default')

const states = {
  idle: [100, 180, 255],
  walk: [80, 200, 120],
  click: [255, 170, 70],
  sleep: [160, 140, 220],
  follow: [255, 120, 160],
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i]
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crcInput = Buffer.concat([typeBuffer, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([length, typeBuffer, data, crc])
}

function createCirclePng(size, rgb) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const center = size / 2
  const radius = size * 0.34

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0
    for (let x = 0; x < size; x += 1) {
      const idx = rowStart + 1 + x * 4
      const dx = x + 0.5 - center
      const dy = y + 0.5 - center
      const dist = Math.hypot(dx, dy)
      if (dist <= radius) {
        raw[idx] = rgb[0]
        raw[idx + 1] = rgb[1]
        raw[idx + 2] = rgb[2]
        raw[idx + 3] = 230
      } else {
        raw[idx] = 0
        raw[idx + 1] = 0
        raw[idx + 2] = 0
        raw[idx + 3] = 0
      }
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = zlib.deflateSync(raw, { level: 9 })
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

fs.mkdirSync(outputDir, { recursive: true })

for (const [name, color] of Object.entries(states)) {
  const png = createCirclePng(128, color)
  fs.writeFileSync(path.join(outputDir, `${name}.png`), png)
  console.log(`generated ${name}.png`)
}

console.log('placeholder assets ready')
