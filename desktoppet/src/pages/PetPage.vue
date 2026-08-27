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

let mouseDown = false
let dragging = false
let prevShouldIgnoreMouse = true

function getConfig() {
  return petConfig.value
}

function getWindowPosition() {
  return window.__petWindowBounds || {
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  }
}

function moveWindow(x, y) {
  window.petAPI.moveWindow(x, y)
}

const behaviors = usePetBehaviors({
  setState,
  getConfig,
  getWindowPosition,
  moveWindow,
})

/** 鼠标穿透：透明区域让点击落到桌面 */
async function checkMousePosition(data) {
  const { x, y } = data
  let shouldIgnoreMouse = true

  const alpha = petSpriteRef.value?.getAlphaAt(x, y) ?? 0
  if (alpha > 10) {
    shouldIgnoreMouse = false
  }

  if (shouldIgnoreMouse !== prevShouldIgnoreMouse) {
    prevShouldIgnoreMouse = shouldIgnoreMouse
    window.petAPI.setIgnoreMouseEvents(shouldIgnoreMouse)
  }
}

function handleMouseDown(event) {
  mouseDown = true
  dragging = false
  window.petAPI.dragStart(event.screenX, event.screenY)
}

function handleMouseUp() {
  if (mouseDown && !dragging) {
    setState('click', getConfig())
  }
  mouseDown = false
  dragging = false
  window.petAPI.dragEnd()
}

function handleMouseMove(event) {
  if (mouseDown) {
    dragging = true
    window.petAPI.dragMove(event.screenX, event.screenY)
  }
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

  document.addEventListener('mousedown', handleMouseDown)
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('mousemove', handleMouseMove)

  window.petAPI.setIgnoreMouseEvents(true)
})

onUnmounted(() => {
  behaviors.stop()
  dispose()
  document.removeEventListener('mousedown', handleMouseDown)
  document.removeEventListener('mouseup', handleMouseUp)
  document.removeEventListener('mousemove', handleMouseMove)
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
}
</style>
