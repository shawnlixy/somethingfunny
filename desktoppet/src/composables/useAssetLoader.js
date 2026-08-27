import { ref } from 'vue'

export function useAssetLoader() {
  const images = ref({})
  const loading = ref(true)
  async function loadAll() {
    loading.value = true
    try { images.value = await window.petAPI.getAllAssetPreviews() }
    finally { loading.value = false }
  }
  async function reloadState(stateId) {
    images.value = { ...images.value, [stateId]: await window.petAPI.getAssetDataUrl(stateId) }
  }
  return { images, loading, loadAll, reloadState }
}
