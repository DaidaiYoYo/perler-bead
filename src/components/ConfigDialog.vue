<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  COLOR_PRESET_OPTIONS,
  DIFFICULTY_OPTIONS,
  MAX_CUSTOM_COLORS,
  MAX_CUSTOM_SIDE,
  MAX_SOURCE_SIDE,
  MIN_CUSTOM_COLORS,
  MIN_CUSTOM_SIDE,
  resolveColorCount,
  resolveGridSize,
  resolveLongestSide,
} from '@/constants'
import { useGameStore } from '@/stores/game'
import type { GameConfig } from '@/types'
import { loadImage, readFileAsDataURL, shrinkImage } from '@/utils/image'

defineProps<{ closable: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useGameStore()

const form = reactive<GameConfig>(
  store.config
    ? { ...store.config }
    : {
        imageUrl: '',
        imageWidth: 0,
        imageHeight: 0,
        difficulty: 'low',
        customLongestSide: 200,
        colorPreset: 48,
        customColorCount: 24,
      },
)

const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const uploading = ref(false)
const loading = ref(false)
const message = ref('')

const gridSize = computed(() =>
  form.imageWidth > 0 && form.imageHeight > 0
    ? resolveGridSize(form.imageWidth, form.imageHeight, resolveLongestSide(form))
    : null,
)

const colorCount = computed(() => resolveColorCount(form))

const error = computed(() => {
  if (!form.imageUrl) return '请先上传原图'
  if (form.difficulty === 'custom') {
    const value = form.customLongestSide ?? 0
    if (!Number.isInteger(value) || value < MIN_CUSTOM_SIDE || value > MAX_CUSTOM_SIDE) {
      return `最长边格子数量需为 ${MIN_CUSTOM_SIDE} ~ ${MAX_CUSTOM_SIDE} 的整数`
    }
  }
  if (form.colorPreset === 'custom') {
    const value = form.customColorCount ?? 0
    if (!Number.isInteger(value) || value < MIN_CUSTOM_COLORS || value > MAX_CUSTOM_COLORS) {
      return `颜色数量需为 ${MIN_CUSTOM_COLORS} ~ ${MAX_CUSTOM_COLORS} 的整数`
    }
    if (value % 3 !== 0) return '颜色数量需为 3 的倍数'
  }
  return ''
})

function toNumber(raw: string): number | null {
  return raw === '' ? null : Number(raw)
}

function handleSideInput(event: Event) {
  form.customLongestSide = toNumber((event.target as HTMLInputElement).value)
}

function handleColorInput(event: Event) {
  form.customColorCount = toNumber((event.target as HTMLInputElement).value)
}

async function applyFile(file: File) {
  if (!file.type.startsWith('image/')) {
    message.value = '请选择图片文件'
    return
  }
  uploading.value = true
  message.value = ''
  try {
    const image = await loadImage(await readFileAsDataURL(file))
    const shrunk = shrinkImage(image, MAX_SOURCE_SIDE)
    form.imageUrl = shrunk.dataUrl
    form.imageWidth = shrunk.width
    form.imageHeight = shrunk.height
  } catch {
    message.value = '图片解析失败，请换一张试试'
  } finally {
    uploading.value = false
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) applyFile(file)
  input.value = ''
}

function handleDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) applyFile(file)
}

async function submit() {
  if (error.value || loading.value) return
  loading.value = true
  message.value = ''
  try {
    await store.generate({ ...form })
    emit('close')
  } catch {
    message.value = '生成失败，请调整配置后重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mask">
    <div class="dialog">
      <header class="head">
        <h2>拼豆设置</h2>
        <p>上传一张图片，设置好格子与颜色数量，就可以开始拼豆了</p>
        <button v-if="closable" type="button" class="close" @click="emit('close')">✕</button>
      </header>

      <div class="body">
        <section class="field">
          <span class="label">原图</span>
          <div
            class="drop"
            :class="{ dragging, filled: !!form.imageUrl }"
            @click="fileInput?.click()"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="handleDrop"
          >
            <input ref="fileInput" type="file" accept="image/*" hidden @change="handleFileChange" />
            <template v-if="form.imageUrl">
              <img class="thumb" :src="form.imageUrl" alt="原图" />
              <span class="drop-hint">点击或拖拽替换</span>
            </template>
            <template v-else>
              <span class="drop-icon">＋</span>
              <span class="drop-hint">{{ uploading ? '解析中…' : '拖拽图片到此处，或点击选择文件' }}</span>
            </template>
          </div>
        </section>

        <section class="field">
          <label class="label" for="difficulty">难度</label>
          <select id="difficulty" v-model="form.difficulty" class="control">
            <option v-for="option in DIFFICULTY_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </section>

        <section v-if="form.difficulty === 'custom'" class="field">
          <label class="label" for="side">最长边格子数量</label>
          <input
            id="side"
            class="control"
            type="number"
            step="1"
            :min="MIN_CUSTOM_SIDE"
            :max="MAX_CUSTOM_SIDE"
            :value="form.customLongestSide ?? ''"
            @input="handleSideInput"
          />
        </section>

        <section class="field">
          <label class="label" for="preset">颜色数量</label>
          <select id="preset" v-model="form.colorPreset" class="control">
            <option
              v-for="option in COLOR_PRESET_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </section>

        <section v-if="form.colorPreset === 'custom'" class="field">
          <label class="label" for="colorCount">自定义颜色数量</label>
          <input
            id="colorCount"
            class="control"
            type="number"
            step="3"
            :min="MIN_CUSTOM_COLORS"
            :max="MAX_CUSTOM_COLORS"
            :value="form.customColorCount ?? ''"
            @input="handleColorInput"
          />
          <span class="note">需为 3 的倍数</span>
        </section>

        <p v-if="gridSize" class="summary">
          将生成 {{ gridSize.cols }} × {{ gridSize.rows }} 个格子 · {{ colorCount }} 种颜色
        </p>
      </div>

      <footer class="foot">
        <span class="message">{{ message || error }}</span>
        <button type="button" class="primary" :disabled="!!error || loading" @click="submit">
          {{ loading ? '生成中…' : '开始拼豆' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(5, 9, 18, 0.72);
  backdrop-filter: blur(8px);
}

.dialog {
  display: flex;
  flex-direction: column;
  width: min(520px, 100%);
  max-height: min(780px, calc(100vh - 48px));
  overflow: hidden;
  border-radius: 20px;
  background: linear-gradient(180deg, #1c2334, #141a28);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
}

.head {
  position: relative;
  padding: 22px 24px 14px;
}

.head h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.head p {
  margin: 0;
  font-size: 12.5px;
  color: rgba(232, 236, 244, 0.55);
}

.close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(232, 236, 244, 0.7);
  cursor: pointer;
}

.close:hover {
  background: rgba(255, 255, 255, 0.12);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 24px 4px;
  overflow-y: auto;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  font-size: 13px;
  color: rgba(232, 236, 244, 0.78);
}

.control {
  height: 42px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
  font: inherit;
  outline: none;
}

.control:focus {
  border-color: #4f8cff;
}

.control option {
  background: #1c2334;
  color: #e8ecf4;
}

.note {
  font-size: 12px;
  color: rgba(232, 236, 244, 0.45);
}

.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 136px;
  padding: 12px;
  border: 1.5px dashed rgba(255, 255, 255, 0.18);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.drop:hover,
.drop.dragging {
  border-color: #4f8cff;
  background: rgba(79, 140, 255, 0.12);
}

.drop.filled {
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.1);
}

.drop-icon {
  font-size: 26px;
  color: rgba(232, 236, 244, 0.45);
}

.drop-hint {
  font-size: 12.5px;
  color: rgba(232, 236, 244, 0.5);
}

.thumb {
  max-width: 100%;
  max-height: 180px;
  border-radius: 8px;
}

.summary {
  margin: 0 0 6px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(79, 140, 255, 0.1);
  font-size: 12.5px;
  color: rgba(180, 205, 255, 0.95);
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 24px 22px;
}

.message {
  font-size: 12.5px;
  color: #ff8f8f;
}

.primary {
  flex: none;
  height: 42px;
  padding: 0 22px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #5b8cff, #7b6cff);
  color: #ffffff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
