<template>
  <canvas
    ref="canvasRef"
    class="pet-canvas"
    :width="canvasSize"
    :height="canvasSize"
  />
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

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

/** 供父组件做 alpha 穿透检测 */
function getAlphaAt(x, y) {
  const canvas = canvasRef.value
  if (!canvas) return 0

  const rect = canvas.getBoundingClientRect()
  const canvasX = Math.floor(x - rect.left)
  const canvasY = Math.floor(y - rect.top)

  if (canvasX < 0 || canvasY < 0 || canvasX >= canvas.width || canvasY >= canvas.height) {
    return 0
  }

  const ctx = canvas.getContext('2d')
  const pixel = ctx.getImageData(canvasX, canvasY, 1, 1).data
  return pixel[3]
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
})
</script>

<style scoped>
.pet-canvas {
  display: block;
  margin: 0 auto;
}
</style>
