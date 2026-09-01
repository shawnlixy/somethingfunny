<template>
  <div class="pet-sprite-host" :style="hostStyle">
    <canvas
      ref="canvasRef"
      class="pet-canvas"
      :width="canvasSize"
      :height="canvasSize"
    />
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  imageSrc: {
    type: String,
    default: '',
  },
  size: {
    type: Number,
    default: 128,
  },
})

const emit = defineEmits(['alpha-updated'])

const canvasRef = ref(null)
const canvasSize = ref(200)
const loadedImage = ref(null)
// 预缓存 alpha 通道，避免每次 getImageData 造成卡顿
let alphaBytes = null
let alphaWidth = 0
let alphaHeight = 0

const hostStyle = computed(() => ({
  width: `${canvasSize.value}px`,
  height: `${canvasSize.value}px`,
}))

/** 绘制后重建 alpha 缓存 */
function rebuildAlphaCache() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  alphaBytes = imageData.data
  alphaWidth = width
  alphaHeight = height
}

/** 绘制当前图片到 canvas */
function drawImage() {
  const canvas = canvasRef.value
  const image = loadedImage.value
  if (!canvas || !image) return

  const ctx = canvas.getContext('2d')
  const displaySize = props.size
  canvasSize.value = displaySize + 40

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const offset = (canvasSize.value - displaySize) / 2
  ctx.drawImage(image, offset, offset, displaySize, displaySize)
  rebuildAlphaCache()
  emit('alpha-updated')
}

/** 加载图片资源 */
function loadImage(src) {
  if (!src) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      loadedImage.value = image
      drawImage()
      resolve(image)
    }
    image.onerror = reject
    image.src = src
  })
}

watch(
  () => props.imageSrc,
  (src) => {
    loadImage(src)
  }
)

watch(
  () => props.size,
  () => {
    drawImage()
  }
)

/** 供父组件做 alpha 穿透检测（读缓存，O(1)） */
function getAlphaAt(x, y) {
  const canvas = canvasRef.value
  if (!canvas || !alphaBytes) return 0

  const rect = canvas.getBoundingClientRect()
  const canvasX = Math.floor(x - rect.left)
  const canvasY = Math.floor(y - rect.top)

  if (canvasX < 0 || canvasY < 0 || canvasX >= alphaWidth || canvasY >= alphaHeight) {
    return 0
  }

  return alphaBytes[(canvasY * alphaWidth + canvasX) * 4 + 3]
}

defineExpose({
  getAlphaAt,
  redraw: drawImage,
})

onMounted(() => {
  if (props.imageSrc) {
    loadImage(props.imageSrc)
  }
})

onUnmounted(() => {
  loadedImage.value = null
  alphaBytes = null
})
</script>

<style scoped>
.pet-sprite-host {
  position: relative;
  flex-shrink: 0;
}

.pet-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: default;
}
</style>
