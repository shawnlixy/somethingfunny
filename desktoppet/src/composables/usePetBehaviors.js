import { ref } from 'vue'
import { DEFAULT_BEHAVIOR_OPTIONS } from '@/config/petConfig.js'

/**
 * 宠物行为调度：随机漫步、打瞌睡、跟随鼠标
 */
export function usePetBehaviors({ setState, getConfig, getWindowPosition, moveWindow }) {
  const paused = ref(false)
  const locked = ref(false)
  const walkDirection = ref(1)

  let walkTimer = null
  let sleepTimer = null
  let walkMoveTimer = null
  let followRaf = null
  let lastFollowMoveAt = 0
  const interacting = ref(false)

  const options = { ...DEFAULT_BEHAVIOR_OPTIONS }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min)
  }

  function clearWalkTimers() {
    if (walkTimer) {
      clearTimeout(walkTimer)
      walkTimer = null
    }
    if (walkMoveTimer) {
      clearInterval(walkMoveTimer)
      walkMoveTimer = null
    }
  }

  function clearSleepTimer() {
    if (sleepTimer) {
      clearTimeout(sleepTimer)
      sleepTimer = null
    }
  }

  function clearFollowRaf() {
    if (followRaf) {
      cancelAnimationFrame(followRaf)
      followRaf = null
    }
  }

  function clearAll() {
    clearWalkTimers()
    clearSleepTimer()
    clearFollowRaf()
  }

  /** 安排下一次随机漫步 */
  function scheduleWalk() {
    clearWalkTimers()
    if (paused.value || locked.value || interacting.value) return

    walkTimer = setTimeout(() => {
      if (paused.value || locked.value || interacting.value) return
      setState('walk', getConfig())

      const pos = getWindowPosition()
      const display = window.petAPI.getDisplayBounds?.() || {
        x: 0,
        y: 0,
        width: window.screen.width,
        height: window.screen.height,
      }

      walkMoveTimer = setInterval(() => {
        if (interacting.value) return
        const current = getWindowPosition()
        let nextX = current.x + walkDirection.value * options.walkSpeed

        const minX = display.x + 10
        const maxX = display.x + display.width - current.width - 10
        if (nextX <= minX || nextX >= maxX) {
          walkDirection.value *= -1
          nextX = Math.max(minX, Math.min(maxX, nextX))
        }

        moveWindow(nextX, current.y)
      }, 33)

      setTimeout(() => {
        clearWalkTimers()
        setState('idle', getConfig())
        scheduleWalk()
      }, options.walkDuration)
    }, randomBetween(options.walkIntervalMin, options.walkIntervalMax))
  }

  /** 安排下一次打瞌睡 */
  function scheduleSleep() {
    clearSleepTimer()
    if (paused.value || locked.value) return

    sleepTimer = setTimeout(() => {
      if (paused.value || locked.value) return
      setState('sleep', getConfig())
      scheduleSleep()
    }, randomBetween(options.sleepIntervalMin, options.sleepIntervalMax))
  }

  /** 跟随鼠标逻辑 */
  function startFollowLoop() {
    if (followRaf || paused.value || locked.value) return

    const tick = () => {
      followRaf = requestAnimationFrame(tick)

      if (interacting.value) return

      const cursor = window.__lastCursor
      if (!cursor) return

      const pos = getWindowPosition()
      const petCenterX = pos.x + pos.width / 2
      const petCenterY = pos.y + pos.height / 2
      const dx = cursor.x - petCenterX
      const dy = cursor.y - petCenterY
      const distance = Math.hypot(dx, dy)

      if (distance < options.followDistance && distance > 20) {
        setState('follow', getConfig())

        const now = performance.now()
        if (now - lastFollowMoveAt < 33) return
        lastFollowMoveAt = now

        const ratio = options.followSpeed / distance
        moveWindow(
          Math.round(pos.x + dx * ratio * 0.05),
          Math.round(pos.y + dy * ratio * 0.05)
        )
      }
    }

    followRaf = requestAnimationFrame(tick)
  }

  function updateCursor(cursor) {
    window.__lastCursor = cursor
  }

  function setInteracting(value) {
    interacting.value = value
    if (value) {
      clearWalkTimers()
    }
  }

  function setPaused(value) {
    paused.value = value
    if (value) {
      clearAll()
    } else {
      start()
    }
  }

  function setLocked(value) {
    locked.value = value
    if (value) {
      clearAll()
    } else {
      start()
    }
  }

  function start() {
    if (paused.value || locked.value) return
    scheduleWalk()
    scheduleSleep()
    startFollowLoop()
  }

  function stop() {
    clearAll()
  }

  return {
    paused,
    locked,
    setPaused,
    setLocked,
    setInteracting,
    updateCursor,
    start,
    stop,
  }
}
