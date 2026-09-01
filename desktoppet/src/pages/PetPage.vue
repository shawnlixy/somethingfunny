<template>
  <div class="pet-page">
    <PetSprite
      ref="petSpriteRef"
      :image-src="currentImageSrc"
      :size="petSize"
      @alpha-updated="handleAlphaUpdated"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import PetSprite from '@/components/PetSprite.vue'
import { STATE_IDS } from '@/config/petConfig.js'
import { useAssetLoader } from '@/composables/useAssetLoader.js'
import { usePetStateMachine } from '@/composables/usePetStateMachine.js'
import { usePetBehaviors } from '@/composables/usePetBehaviors.js'

const petSpriteRef = ref(null)
const petConfig = ref(null)
const petSize = ref(128)

const { images, loadAll, reloadState } = useAssetLoader()

const { currentState, setState, resetToIdle, dispose } = usePetStateMachine()

const currentImageSrc = computed(() => images.value[currentState.value] || '')

let isInteracting = false
let prevShouldIgnoreMouse = true
let lastAlphaCheckAt = 0
let pointerDownAt = null
let windowPosAtDown = null
const ALPHA_CHECK_INTERVAL = 50
const CLICK_MOVE_THRESHOLD = 8

function getConfig() {
  return petConfig.value
}

function getWindowPosition() {
  const bounds = window.__petWindowBounds || {
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  }
  return {
    x: Number(bounds.x) || 0,
    y: Number(bounds.y) || 0,
    width: Number(bounds.width) || 200,
    height: Number(bounds.height) || 200,
  }
}

function moveWindow(x, y) {
  const px = Math.round(Number(x))
  const py = Math.round(Number(y))
  if (!Number.isFinite(px) || !Number.isFinite(py)) return
  window.petAPI.moveWindow(px, py)
}

const behaviors = usePetBehaviors({
  setState,
  getConfig,
  getWindowPosition,
  moveWindow,
})

/** 鼠标穿透：透明区域让点击落到桌面（带节流与滞回，减少光标闪烁） */
function checkMousePosition(data) {
  if (isInteracting) return

  const now = performance.now()
  if (now - lastAlphaCheckAt < ALPHA_CHECK_INTERVAL) return
  lastAlphaCheckAt = now

  const { x, y } = data
  const alpha = petSpriteRef.value?.getAlphaAt(x, y) ?? 0

  // 滞回阈值：进入与离开不同，避免边缘反复切换穿透状态
  let shouldIgnoreMouse = prevShouldIgnoreMouse
  if (prevShouldIgnoreMouse) {
    if (alpha > 24) shouldIgnoreMouse = false
  } else if (alpha < 10) {
    shouldIgnoreMouse = true
  }

  if (shouldIgnoreMouse !== prevShouldIgnoreMouse) {
    prevShouldIgnoreMouse = shouldIgnoreMouse
    window.petAPI.setIgnoreMouseEvents(shouldIgnoreMouse)
  }
}

function handlePointerDown(event) {
  const alpha = petSpriteRef.value?.getAlphaAt(event.clientX, event.clientY) ?? 0
  if (alpha <= 24) return

  const sx = Number(event.screenX)
  const sy = Number(event.screenY)
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return

  isInteracting = true
  behaviors.setInteracting(true)
  pointerDownAt = { x: sx, y: sy }
  windowPosAtDown = getWindowPosition()
  window.petAPI.dragStart(sx, sy)
}

function handlePointerUp(event) {
  if (!isInteracting && !pointerDownAt) return

  const pos = getWindowPosition()
  const hasPointerCoords = event?.screenX != null && event?.screenY != null
  const pointerMoved = pointerDownAt && hasPointerCoords
    ? Math.hypot(event.screenX - pointerDownAt.x, event.screenY - pointerDownAt.y)
    : CLICK_MOVE_THRESHOLD
  const windowMoved = windowPosAtDown
    ? Math.abs(pos.x - windowPosAtDown.x) > 2 || Math.abs(pos.y - windowPosAtDown.y) > 2
    : false

  if (pointerDownAt && hasPointerCoords && !windowMoved && pointerMoved < CLICK_MOVE_THRESHOLD) {
    setState('click', getConfig())
  }

  pointerDownAt = null
  windowPosAtDown = null
  isInteracting = false
  behaviors.setInteracting(false)
  lastAlphaCheckAt = 0
  window.petAPI.dragEnd()
}

function handlePointerCancel(event) {
  handlePointerUp(event)
}

function handleAlphaUpdated() {
  // 图片更新后重新检测穿透
}

function handleUpdateFocus(data) {
  window.__petWindowBounds = {
    x: data.windowX,
    y: data.windowY,
    width: window.innerWidth,
    height: window.innerHeight,
  }
  behaviors.updateCursor({ x: data.cursorX, y: data.cursorY })
}

async function handleAssetUpdated({ stateId }) {
  await reloadState(stateId)
}

function handleSettingsChanged(settings) {
  behaviors.setPaused(settings.paused)
  behaviors.setLocked(settings.locked)
}

async function bootstrap() {
  petConfig.value = await window.petAPI.getPetConfig()
  petSize.value = petConfig.value.defaultSize || 128
  await loadAll(STATE_IDS)
  resetToIdle(petConfig.value)
  behaviors.start()

  const settings = await window.petAPI.getSettings()
  handleSettingsChanged(settings)
}

onMounted(async () => {
  await bootstrap()

  window.petAPI.onCheckMousePosition(checkMousePosition)
  window.petAPI.onUpdateFocus(handleUpdateFocus)
  window.petAPI.onAssetUpdated(handleAssetUpdated)
  window.petAPI.onSettingsChanged(handleSettingsChanged)

  window.petAPI.setIgnoreMouseEvents(true)

  window.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerCancel)
  window.addEventListener('blur', handlePointerCancel)
})

onUnmounted(() => {
  behaviors.stop()
  dispose()
  window.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('pointercancel', handlePointerCancel)
  window.removeEventListener('blur', handlePointerCancel)
})
</script>

<style scoped>
.pet-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: default;
}
</style>
