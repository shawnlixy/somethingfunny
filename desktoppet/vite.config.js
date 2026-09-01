import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import electron from 'vite-plugin-electron/simple'
import vue from '@vitejs/plugin-vue'

/** 构建时复制托盘图标到 dist-electron */
function copyTrayIconPlugin() {
  return {
    name: 'copy-tray-icon',
    closeBundle() {
      const src = path.join(__dirname, 'electron/tray-icon.png')
      const dest = path.join(__dirname, 'dist-electron/tray-icon.png')
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'electron/main.js',
        vite: {
          plugins: [copyTrayIconPlugin()],
          build: {
            // electron-store 被打包时会误走浏览器分支（window 未定义），保持 external
            rollupOptions: {
              external: ['electron-store'],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.js'),
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': '/src'
    },
  },
})
