# Desktop Pet

基于 [BITNP/bitnp-desktop-pet](https://github.com/BITNP/bitnp-desktop-pet) 改造的互动版桌面宠物。

## 功能

- 透明无边框置顶窗口
- 透明区域鼠标穿透
- 宠物区域可拖拽
- 5 种状态静态图：idle / walk / click / sleep / follow
- 点击反应、随机漫步、打瞌睡、跟随鼠标
- 系统托盘：显示/隐藏、更换素材、暂停行为、锁定位置
- 设置面板热更换素材（无需重启）

## 快速开始

```bash
pnpm install

# 若 Electron 未正确安装，手动执行：
# cd node_modules/electron && node install.js

pnpm generate:assets   # 生成 5 张占位 PNG（可选，仓库已自带）
pnpm dev
```

若 `pnpm dev` 提示 `Ignored build scripts`，在本机执行：

```bash
pnpm approve-builds
# 选择 electron 和 esbuild
pnpm install
```

## 更换素材

1. 右键系统托盘图标
2. 点击「更换素材」
3. 为每个状态选择 PNG/WebP 图片
4. 保存后立即生效

## 素材规范

准备 **5 张** PNG（透明背景，建议 128x128 或 256x256）：

| 文件 | 状态 |
|------|------|
| idle.png | 待机 |
| walk.png | 走路 |
| click.png | 点击反应 |
| sleep.png | 睡觉 |
| follow.png | 跟随鼠标 |

## 打包

```bash
pnpm build
```

安装包输出在 `release/` 目录。
