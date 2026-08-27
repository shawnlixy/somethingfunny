import { ref } from 'vue'
import { STATE_PRIORITY } from '@/config/petConfig.js'

export function usePetStateMachine(onStateChange) {
  const currentState = ref('idle')
  let durationTimer = null
  function clearDurationTimer() { if (durationTimer) { clearTimeout(durationTimer); durationTimer = null } }
  function setState(nextState, config, options = {}) {
    const { force = false } = options
    if (!force && nextState !== 'idle' && (STATE_PRIORITY[nextState] ?? 0) < (STATE_PRIORITY[currentState.value] ?? 0)) return false
    if (currentState.value === nextState && !force) return true
    clearDurationTimer()
    currentState.value = nextState
    onStateChange?.(nextState)
    const sc = config?.states?.[nextState]
    if (sc?.duration > 0 && sc?.next) durationTimer = setTimeout(() => setState(sc.next, config, { force: true }), sc.duration)
    return true
  }
  return { currentState, setState, resetToIdle: (c) => setState('idle', c, { force: true }), dispose: clearDurationTimer }
}
