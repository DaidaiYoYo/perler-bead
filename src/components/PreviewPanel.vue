<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'

const store = useGameStore()

const panel = ref<HTMLElement | null>(null)
const pos = ref({ ...store.previewPos })
const zoom = ref(false)

let dragging = false
let moved = false
let startX = 0
let startY = 0
let originX = 0
let originY = 0

/** 放大视图按整数倍缩放，保证格子边缘清晰 */
const zoomStyle = computed(() => {
  const board = store.board
  if (!board || !zoom.value) return {}
  const scale = Math.max(
    1,
    Math.floor(
      Math.min((window.innerWidth * 0.88) / board.cols, (window.innerHeight * 0.88) / board.rows),
    ),
  )
  return { width: `${board.cols * scale}px`, height: `${board.rows * scale}px` }
})

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

watch(
  () => store.previewPos,
  (value) => {
    if (!dragging) pos.value = { ...value }
  },
)

function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  dragging = true
  moved = false
  startX = event.clientX
  startY = event.clientY
  originX = pos.value.x
  originY = pos.value.y
  panel.value?.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent) {
  if (!dragging) return
  const dx = event.clientX - startX
  const dy = event.clientY - startY
  if (Math.abs(dx) + Math.abs(dy) > 4) moved = true
  const width = panel.value?.offsetWidth ?? 0
  const height = panel.value?.offsetHeight ?? 0
  pos.value = {
    x: clamp(originX + dx, 8, Math.max(8, window.innerWidth - width - 8)),
    y: clamp(originY + dy, 8, Math.max(8, window.innerHeight - height - 8)),
  }
}

function handlePointerUp(event: PointerEvent) {
  if (!dragging) return
  dragging = false
  if (panel.value?.hasPointerCapture(event.pointerId)) {
    panel.value.releasePointerCapture(event.pointerId)
  }
  if (moved) {
    store.setPreviewPos(pos.value.x, pos.value.y)
    return
  }
  zoom.value = true
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') zoom.value = false
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div
    ref="panel"
    class="preview"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
  >
    <img
      v-if="store.board"
      class="thumb"
      :src="store.board.effectUrl"
      alt="效果图"
      draggable="false"
    />
    <span class="tip">拖拽移动 · 点击放大</span>
  </div>

  <Teleport to="body">
    <div v-if="zoom && store.board" class="zoom-mask" @click="zoom = false">
      <img
        class="zoom-image"
        :style="zoomStyle"
        :src="store.board.effectUrl"
        alt="效果图"
        draggable="false"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.preview {
  position: fixed;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 168px;
  padding: 8px;
  border-radius: 14px;
  background: rgba(22, 28, 44, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 18px 40px rgba(3, 8, 22, 0.5);
  backdrop-filter: blur(14px);
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.preview:active {
  cursor: grabbing;
}

.thumb {
  display: block;
  width: 100%;
  max-height: 180px;
  border-radius: 8px;
  background: #ffffff;
  object-fit: contain;
}

.tip {
  font-size: 11px;
  text-align: center;
  color: rgba(232, 236, 244, 0.55);
}

.zoom-mask {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(6, 10, 20, 0.84);
  backdrop-filter: blur(6px);
  cursor: zoom-out;
}

.zoom-image {
  border-radius: 6px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
  image-rendering: pixelated;
}
</style>
