import { ref } from 'vue'
import { DEFAULT_BEHAVIOR_OPTIONS } from '@/config/petConfig.js'

export function usePetBehaviors({ setState, getConfig, getWindowPosition, moveWindow }) {
  const paused = ref(false)
  const locked = ref(false)
  const walkDirection = ref(1)
  let walkTimer = null, sleepTimer = null, walkMoveTimer = null, followRaf = null
  const options = { ...DEFAULT_BEHAVIOR_OPTIONS }
  const randomBetween = (min, max) => min + Math.random() * (max - min)
  const clearWalkTimers = () => { if (walkTimer) clearTimeout(walkTimer); if (walkMoveTimer) clearInterval(walkMoveTimer); walkTimer = walkMoveTimer = null }
  const clearSleepTimer = () => { if (sleepTimer) clearTimeout(sleepTimer); sleepTimer = null }
  const clearFollowRaf = () => { if (followRaf) cancelAnimationFrame(followRaf); followRaf = null }
  const clearAll = () => { clearWalkTimers(); clearSleepTimer(); clearFollowRaf() }
  const scheduleWalk = () => {
    clearWalkTimers(); if (paused.value || locked.value) return
    walkTimer = setTimeout(() => {
      if (paused.value || locked.value) return
      setState('walk', getConfig())
      const display = { x: 0, y: 0, width: window.screen.width, height: window.screen.height }
      walkMoveTimer = setInterval(() => {
        const current = getWindowPosition()
        let nextX = current.x + walkDirection.value * options.walkSpeed
        const minX = display.x + 10, maxX = display.x + display.width - current.width - 10
        if (nextX <= minX || nextX >= maxX) { walkDirection.value *= -1; nextX = Math.max(minX, Math.min(maxX, nextX)) }
        moveWindow(nextX, current.y)
      }, 16)
      setTimeout(() => { clearWalkTimers(); setState('idle', getConfig()); scheduleWalk() }, options.walkDuration)
    }, randomBetween(options.walkIntervalMin, options.walkIntervalMax))
  }
  const scheduleSleep = () => {
    clearSleepTimer(); if (paused.value || locked.value) return
    sleepTimer = setTimeout(() => { if (!paused.value && !locked.value) setState('sleep', getConfig()); scheduleSleep() }, randomBetween(options.sleepIntervalMin, options.sleepIntervalMax))
  }
  const startFollowLoop = () => {
    if (followRaf || paused.value || locked.value) return
    const tick = () => {
      followRaf = requestAnimationFrame(tick)
      const cursor = window.__lastCursor; if (!cursor) return
      const pos = getWindowPosition()
      const dx = cursor.x - (pos.x + pos.width / 2), dy = cursor.y - (pos.y + pos.height / 2)
      const distance = Math.hypot(dx, dy)
      if (distance < options.followDistance && distance > 20) {
        setState('follow', getConfig())
        moveWindow(Math.round(pos.x + dx * 0.05 * options.followSpeed / distance), Math.round(pos.y + dy * 0.05 * options.followSpeed / distance))
      }
    }
    followRaf = requestAnimationFrame(tick)
  }
  const updateCursor = (cursor) => { window.__lastCursor = cursor }
  const setPaused = (value) => { paused.value = value; value ? clearAll() : start() }
  const setLocked = (value) => { locked.value = value; value ? clearAll() : start() }
  const start = () => { if (paused.value || locked.value) return; scheduleWalk(); scheduleSleep(); startFollowLoop() }
  const stop = () => clearAll()
  return { paused, locked, setPaused, setLocked, updateCursor, start, stop }
}
