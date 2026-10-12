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
    const selectedColor = ref<number | null>(null)
    const previewPos = ref({ x: 24, y: 24 })
    /** 仅在需要落盘时自增 */
    const revision = ref(0)

    const hasGame = computed(() => {
      const current = board.value
      return current !== null && cells.value.length === current.cols * current.rows
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
      }
      cells.value = new Uint8Array(cols * rows)
      selectedColor.value = palette.length > 0 ? 0 : null
      revision.value++
    }

    function selectColor(index: number) {
      selectedColor.value = index
    }

    /** 给格子填色，返回是否发生变化 */
    function paint(index: number): boolean {
      const color = selectedColor.value
      const data = cells.value
      if (color === null || index < 0 || index >= data.length) return false
      if (data[index] === color + 1) return false
      data[index] = color + 1
      return true
    }

    /** 提交一次持久化 */
    function commit() {
      revision.value++
    }

    function setPreviewPos(x: number, y: number) {
      previewPos.value = { x, y }
    }

    return {
      config,
      board,
      cells,
      selectedColor,
      previewPos,
      revision,
      hasGame,
      generate,
      selectColor,
      paint,
      commit,
      setPreviewPos,
    }
  },
  {
    persist: {
      key: 'perler-bead',
      storage: localStorage,
      serializer,
      pick: ['config', 'board', 'cells', 'selectedColor', 'previewPos'],
    },
  },
)
