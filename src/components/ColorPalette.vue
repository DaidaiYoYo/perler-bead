<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { useGameStore } from '@/stores/game'
import { contrastColor } from '@/utils/color'

const store = useGameStore()

const panel = ref<HTMLElement | null>(null)
let tween: gsap.core.Tween | null = null

/** 色块多时缩小尺寸，避免模板占掉太多屏幕 */
const compact = computed(() => (store.board?.palette.length ?? 0) > 48)

function slideIn() {
  const el = panel.value
  if (!el) return
  tween?.kill()
  gsap.set(el, { visibility: 'visible' })
  tween = gsap.to(el, { yPercent: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' })
}

function slideOut() {
  const el = panel.value
  if (!el) return
  tween?.kill()
  tween = gsap.to(el, {
    yPercent: 130,
    autoAlpha: 0,
    duration: 0.32,
    ease: 'power2.in',
    onComplete: () => gsap.set(el, { visibility: 'hidden' }),
  })
}

onMounted(() => {
  const el = panel.value
  if (!el) return
  gsap.set(el, { xPercent: -50, yPercent: 130, autoAlpha: 0, visibility: 'hidden' })
  if (store.selectedCell !== null) slideIn()
})

watch(
  () => store.selectedCell !== null,
  (visible) => {
    if (visible) slideIn()
    else slideOut()
  },
)
</script>

<template>
  <div v-if="store.board" ref="panel" class="palette" :class="{ compact }">
    <button
      v-for="(color, index) in store.board.palette"
      :key="index"
      type="button"
      class="swatch"
      :class="{ active: store.selectedColor === index }"
      :style="{ backgroundColor: color, color: contrastColor(color) }"
      :title="color"
      @click="store.applyColor(index)"
    >
      <span v-if="store.showNumbers">{{ index + 1 }}</span>
    </button>
  </div>
</template>

<style scoped>
.palette {
  position: fixed;
  bottom: 24px;
  left: 50%;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  width: min(880px, calc(100vw - 48px));
  max-height: 30vh;
  padding: 14px 16px;
  overflow-y: auto;
  border-radius: 18px;
  background: rgba(22, 28, 44, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow: 0 20px 45px rgba(3, 8, 22, 0.5);
  backdrop-filter: blur(14px);
  will-change: transform;
}

.palette::-webkit-scrollbar {
  width: 8px;
}

.palette::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.18);
}

.palette.compact {
  gap: 6px;
  padding: 12px 14px;
  max-height: 22vh;
}

.swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.16);
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease;
}

.palette.compact .swatch {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  font-size: 9px;
}

.swatch:hover {
  transform: translateY(-2px);
}

.swatch.active {
  transform: translateY(-3px) scale(1.08);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.16),
    0 0 0 2px #161c2c,
    0 0 0 4px #4f8cff;
}
</style>
