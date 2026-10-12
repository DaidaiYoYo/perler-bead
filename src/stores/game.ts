import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { StateTree } from 'pinia'
import { resolveColorCount, resolveGridSize, resolveLongestSide } from '@/constants'
import type { BoardData, GameConfig } from '@/types'
import { buildPalette, quantizePixels, rgbToHex } from '@/utils/color'
import { loadImage, renderEffect, samplePixels } from '@/utils/image'

/** 二进制转 base64 */
function encodeBytes(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** base64 转二进制 */
function decodeBytes(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** 填色数据体积大，单独按 base64 存取 */
const serializer = {
  serialize: (state: StateTree) =>
    JSON.stringify(state, (_key, value) =>
      value instanceof Uint8Array ? { bytes: encodeBytes(value) } : value,
    ),
  deserialize: (raw: string) =>
    JSON.parse(raw, (_key, value) =>
      value && typeof value === 'object' && 'bytes' in value ? decodeBytes(String(value.bytes)) : value,
    ) as StateTree,
}

export const useGameStore = defineStore(
  'perler-bead',
  () => {
    const config = ref<GameConfig | null>(null)
    const board = ref<BoardData | null>(null)
    /** 玩家填色，0 表示空，其余为调色板下标 + 1 */
    const cells = shallowRef<Uint8Array>(new Uint8Array(0))
    /** 当前选中的格子 */
    const selectedCell = ref<number | null>(null)
    /** 调色板中高亮的颜色 */
    const selectedColor = ref<number | null>(null)
    /** 是否显示颜色编号 */
    const showNumbers = ref(true)
    /** 提示动画进行中，此时拼盘不可编辑 */
    const hinting = ref(false)
    const previewPos = ref({ x: 24, y: 24 })
    /** 自增以触发持久化与画布重绘 */
    const revision = ref(0)

    const hasGame = computed(() => {
      const current = board.value
      if (!current || !(current.target instanceof Uint8Array)) return false
      const size = current.cols * current.rows
      return cells.value.length === size && current.target.length === size
    })

    async function generate(next: GameConfig) {
      const { cols, rows } = resolveGridSize(
        next.imageWidth,
        next.imageHeight,
        resolveLongestSide(next),
      )
      const image = await loadImage(next.imageUrl)
      const pixels = samplePixels(image, cols, rows)
      const palette = buildPalette(pixels, resolveColorCount(next))
      const indices = quantizePixels(pixels, palette)
      config.value = { ...next }
      board.value = {
        cols,
        rows,
        palette: palette.map(([r, g, b]) => rgbToHex(r, g, b)),
        effectUrl: renderEffect(indices, palette, cols, rows),
        target: indices,
      }
      cells.value = new Uint8Array(cols * rows)
      selectedCell.value = null
      selectedColor.value = palette.length > 0 ? 0 : null
      revision.value++
    }

    /** 选中格子，传 null 取消选中 */
    function selectCell(index: number | null) {
      if (hinting.value) return
      if (index === null) {
        selectedCell.value = null
        return
      }
      if (index < 0 || index >= cells.value.length) return
      selectedCell.value = index
      const value = cells.value[index] ?? 0
      if (value > 0) selectedColor.value = value - 1
    }

    /** 给选中的格子填色，返回是否发生变化 */
    function applyColor(colorIndex: number): boolean {
      const index = selectedCell.value
      const palette = board.value?.palette
      if (hinting.value || index === null || !palette) return false
      if (colorIndex < 0 || colorIndex >= palette.length) return false
      if (cells.value[index] === colorIndex + 1) return false
      cells.value[index] = colorIndex + 1
      selectedColor.value = colorIndex
      revision.value++
      return true
    }

    function requestHint() {
      if (hinting.value || !hasGame.value) return
      hinting.value = true
    }

    function finishHint() {
      hinting.value = false
    }

    function setPreviewPos(x: number, y: number) {
      previewPos.value = { x, y }
    }

    return {
      config,
      board,
      cells,
      selectedCell,
      selectedColor,
      showNumbers,
      hinting,
      previewPos,
      revision,
      hasGame,
      generate,
      selectCell,
      applyColor,
      requestHint,
      finishHint,
      setPreviewPos,
    }
  },
  {
    persist: {
      key: 'perler-bead',
      storage: localStorage,
      serializer,
      pick: ['config', 'board', 'cells', 'selectedColor', 'showNumbers', 'previewPos'],
    },
  },
)
