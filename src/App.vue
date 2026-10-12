<script setup lang="ts">
import { ref } from 'vue'
import BeadBoard from '@/components/BeadBoard.vue'
import ColorPalette from '@/components/ColorPalette.vue'
import ConfigDialog from '@/components/ConfigDialog.vue'
import PreviewPanel from '@/components/PreviewPanel.vue'
import { useGameStore } from '@/stores/game'

const store = useGameStore()
const showConfig = ref(!store.hasGame)
</script>

<template>
  <div class="app">
    <template v-if="store.hasGame">
      <BeadBoard />
      <PreviewPanel />
      <ColorPalette />
      <button type="button" class="settings" title="重新设置" @click="showConfig = true">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
      </button>
    </template>

    <ConfigDialog v-if="showConfig" :closable="store.hasGame" @close="showConfig = false" />
  </div>
</template>

<style scoped>
.app {
  position: relative;
  width: 100%;
  height: 100%;
}

.settings {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 12px;
  background: rgba(22, 28, 44, 0.86);
  color: rgba(232, 236, 244, 0.8);
  cursor: pointer;
  backdrop-filter: blur(14px);
}

.settings:hover {
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.22);
}
</style>
