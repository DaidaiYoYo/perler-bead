<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import gsap from 'gsap'
import { useGameStore } from '@/stores/game'
import { renderCells } from '@/utils/image'

const store = useGameStore()

const expanded = ref(false)
const list = ref<HTMLElement | null>(null)
const previewUrl = ref('')
const previewOpen = ref(false)

/** 预览按整数倍放大，保证格子边缘清晰 */
const previewStyle = computed(() => {
  const board = store.board
  if (!board || !previewOpen.value) return {}
  const scale = Math.max(
    1,
    Math.floor(
      Math.min((window.innerWidth * 0.86) / board.cols, (window.innerHeight * 0.86) / board.rows),
    ),
  )
  return { width: `${board.cols * scale}px`, height: `${board.rows * scale}px` }
})

function toggle() {
  const el = list.value
  if (!el) return
  expanded.value = !expanded.value
  const items = Array.from(el.children)
  gsap.killTweensOf([el, ...items])
  if (!expanded.value) {
    gsap.to(el, { height: 0, autoAlpha: 0, duration: 0.24, ease: 'power2.in' })
    return
  }
  gsap.to(el, { height: 'auto', autoAlpha: 1, duration: 0.34, ease: 'power2.out' })
  gsap.fromTo(
    items,
    { y: -10, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.3, stagger: 0.06, delay: 0.05 },
  )
}

function collapse() {
  if (expanded.value) toggle()
}

function openPreview() {
  const board = store.board
  if (!board) return
  previewUrl.value = renderCells(
    store.cells,
    board.palette,
    board.cols,
    board.rows,
    '#ffffff',
  ).toDataURL('image/png')
  previewOpen.value = true
  collapse()
}

function download() {
  const board = store.board
  if (!board) return
  const canvas = renderCells(store.cells, board.palette, board.cols, board.rows, '#ffffff')
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `perler-bead-${board.cols}x${board.rows}.png`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
  collapse()
}

function requestHint() {
  store.requestHint()
  collapse()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') previewOpen.value = false
}

onMounted(() => {
  if (list.value) gsap.set(list.value, { height: 0, autoAlpha: 0 })
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="tools">
    <button
      type="button"
      class="icon-btn"
      :class="{ active: expanded }"
      title="工具"
      @click="toggle"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      >
        <path d="M4 7h8" />
        <path d="M18 7h2" />
        <circle cx="15" cy="7" r="2.2" />
        <path d="M4 12h2" />
        <path d="M12 12h8" />
        <circle cx="9" cy="12" r="2.2" />
        <path d="M4 17h7" />
        <path d="M17 17h3" />
        <circle cx="14" cy="17" r="2.2" />
      </svg>
    </button>

    <div ref="list" class="tool-list">
      <button type="button" class="tool-item" @click="openPreview">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z" />
          <circle cx="12" cy="12" r="2.8" />
        </svg>
        <span>预览</span>
      </button>

      <button type="button" class="tool-item" @click="download">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3v11" />
          <path d="M7.5 10L12 14.5 16.5 10" />
          <path d="M4 19.5h16" />
        </svg>
        <span>下载</span>
      </button>

      <button type="button" class="tool-item" :disabled="store.hinting" @click="requestHint">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .8 1.6v.6h5.6v-.6c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z" />
          <path d="M10 19h4" />
          <path d="M11 21.5h2" />
        </svg>
        <span>提示</span>
      </button>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="previewOpen" class="mask" @click="previewOpen = false">
      <img class="result" :style="previewStyle" :src="previewUrl" alt="当前效果" draggable="false" />
      <span class="mask-tip">点击任意处关闭</span>
    </div>
  </Teleport>
</template>

<style scoped>
.tools {
  position: fixed;
  top: 72px;
  right: 20px;
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.icon-btn {
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
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}

.icon-btn:hover {
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.22);
}

.icon-btn.active {
  color: #ffffff;
  background: rgba(79, 140, 255, 0.22);
  border-color: rgba(79, 140, 255, 0.5);
}

.tool-list {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  height: 0;
  overflow: hidden;
  visibility: hidden;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 12px;
  background: rgba(22, 28, 44, 0.86);
  color: rgba(232, 236, 244, 0.82);
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  backdrop-filter: blur(14px);
  transition:
    color 0.15s ease,
    border-color 0.15s ease;
}

.tool-item:hover:not(:disabled) {
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.22);
}

.tool-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mask {
  position: fixed;
  inset: 0;
  z-index: 140;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: rgba(6, 10, 20, 0.86);
  backdrop-filter: blur(6px);
  cursor: zoom-out;
}

.result {
  border-radius: 6px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
  image-rendering: pixelated;
}

.mask-tip {
  font-size: 12px;
  color: rgba(232, 236, 244, 0.5);
}
</style>
