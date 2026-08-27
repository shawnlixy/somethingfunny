import { ref } from 'vue'
import { STATE_PRIORITY } from '@/config/petConfig.js'
export function usePetStateMachine(onStateChange) {
  const currentState = ref('idle')
  function setState(nextState, config, options = {}) {
    currentState.value = nextState
    onStateChange?.(nextState)
    return true
  }
  return { currentState, setState, resetToIdle: (c) => setState('idle', c), dispose: () => {} }
}
