<template>
  <div class="settings-page">
    <header class="settings-header">
      <h1>素材设置</h1>
      <p>为每个状态选择一张 PNG/WebP 图片，保存后立即生效。</p>
    </header>

    <div class="state-list">
      <div v-for="stateId in STATE_IDS" :key="stateId" class="state-row">
        <div class="state-info">
          <strong>{{ STATE_LABELS[stateId] }}</strong>
          <span class="state-id">{{ stateId }}</span>
        </div>

        <div class="preview-box">
          <img v-if="previews[stateId]" :src="previews[stateId]" :alt="stateId" />
          <span v-else class="empty-preview">暂无预览</span>
        </div>

        <div class="actions">
          <button type="button" @click="pickAsset(stateId)">选择图片</button>
          <button type="button" class="secondary" @click="resetAsset(stateId)">恢复默认</button>
        </div>
      </div>
    </div>

    <p v-if="message" class="message">{{ message }}</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { STATE_IDS, STATE_LABELS } from '@/config/petConfig.js'

const previews = ref({})
const message = ref('')

async function refreshPreviews() {
  previews.value = await window.petAPI.getAllAssetPreviews()
}

async function pickAsset(stateId) {
  try {
    const result = await window.petAPI.pickAsset(stateId)
    if (result) {
      previews.value[stateId] = result.dataUrl
      message.value = `${STATE_LABELS[stateId]} 素材已更新`
    }
  } catch (error) {
    message.value = error.message || '选择图片失败'
  }
}

async function resetAsset(stateId) {
  try {
    const result = await window.petAPI.resetAsset(stateId)
    previews.value[stateId] = result.dataUrl
    message.value = `${STATE_LABELS[stateId]} 已恢复默认`
  } catch (error) {
    message.value = error.message || '恢复默认失败'
  }
}

onMounted(async () => {
  await refreshPreviews()
})
</script>

<style scoped>
.settings-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px;
  font-family: "Segoe UI", sans-serif;
  color: #1f2937;
}

.settings-header h1 {
  margin: 0 0 8px;
  font-size: 24px;
}

.settings-header p {
  margin: 0 0 20px;
  color: #6b7280;
}

.state-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.state-row {
  display: grid;
  grid-template-columns: 120px 96px 1fr;
  gap: 16px;
  align-items: center;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
}

.state-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.state-id {
  font-size: 12px;
  color: #9ca3af;
}

.preview-box {
  width: 96px;
  height: 96px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  overflow: hidden;
}

.preview-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.empty-preview {
  font-size: 12px;
  color: #9ca3af;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

button {
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
}

button.secondary {
  background: #e5e7eb;
  color: #374151;
}

.message {
  margin-top: 16px;
  color: #059669;
}
</style>
