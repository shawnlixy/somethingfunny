import { ref } from 'vue'
import { STATE_PRIORITY } from '@/config/petConfig.js'

/**
 * 宠物状态机：管理状态切换与优先级
 */
export function usePetStateMachine(onStateChange) {
  const currentState = ref('idle')
  let durationTimer = null

  /** 清除定时状态计时器 */
  function clearDurationTimer() {
    if (durationTimer) {
      clearTimeout(durationTimer)
      durationTimer = null
    }
  }

  /** 切换到新状态 */
  function setState(nextState, config, options = {}) {
    const { force = false } = options
    const currentPriority = STATE_PRIORITY[currentState.value] ?? 0
    const nextPriority = STATE_PRIORITY[nextState] ?? 0

    if (!force && nextState !== 'idle' && nextPriority < currentPriority) {
      return false
    }

    if (currentState.value === nextState && !force) {
      return true
    }

    clearDurationTimer()
    currentState.value = nextState
    onStateChange?.(nextState)

    const stateConfig = config?.states?.[nextState]
    if (stateConfig?.duration > 0 && stateConfig?.next) {
      durationTimer = setTimeout(() => {
        setState(stateConfig.next, config, { force: true })
      }, stateConfig.duration)
    }

    return true
  }

  /** 强制回到 idle */
  function resetToIdle(config) {
    return setState('idle', config, { force: true })
  }

  function dispose() {
    clearDurationTimer()
  }

  return {
    currentState,
    setState,
    resetToIdle,
    dispose,
  }
}
