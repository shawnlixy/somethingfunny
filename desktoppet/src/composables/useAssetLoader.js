import { ref } from 'vue'

/**
 * 素材加载器：从主进程读取各状态图片
 */
export function useAssetLoader() {
  const images = ref({})
  const loading = ref(true)

  /** 加载单个状态素材 */
  async function loadState(stateId) {
    const dataUrl = await window.petAPI.getAssetDataUrl(stateId)
    images.value = {
      ...images.value,
      [stateId]: dataUrl,
    }
    return dataUrl
  }

  /** 加载全部状态素材 */
  async function loadAll(stateIds) {
    loading.value = true
    try {
      const previews = await window.petAPI.getAllAssetPreviews()
      images.value = previews
    } finally {
      loading.value = false
    }
  }

  /** 热更换单个状态素材 */
  async function reloadState(stateId) {
    return loadState(stateId)
  }

  return {
    images,
    loading,
    loadAll,
    loadState,
    reloadState,
  }
}
