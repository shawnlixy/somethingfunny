export function usePetBehaviors({ setState, getConfig, getWindowPosition, moveWindow }) {
  let walkTimer = null
  const start = () => {}
  const stop = () => {}
  const setPaused = () => {}
  const setLocked = () => {}
  const updateCursor = () => {}
  return { setPaused, setLocked, updateCursor, start, stop }
}
