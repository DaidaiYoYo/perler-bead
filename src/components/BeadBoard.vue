<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { useGameStore } from '@/stores/game'
import { contrastColor } from '@/utils/color'

const EMPTY_COLOR = '#e8edf4'
const CELL_COLOR = '#ffffff'
const BORDER_COLOR = '#bfc9d8'
const SOFT_BORDER_COLOR = '#cdd6e2'
const HIGHLIGHT_COLOR = '#4f8cff'

const store = useGameStore()

const stage = ref<HTMLElement | null>(null)
const baseCanvas = ref<HTMLCanvasElement | null>(null)
const paintCanvas = ref<HTMLCanvasElement | null>(null)
const hoverCanvas = ref<HTMLCanvasElement | null>(null)
const hintCanvas = ref<HTMLCanvasElement | null>(null)

const boardStyle = ref({ width: '0px', height: '0px' })

const cols = computed(() => store.board?.cols ?? 0)

let cellSize = 0
let boardWidth = 0
let boardHeight = 0
let hoverIndex = -1
let observer: ResizeObserver | null = null
let popTween: gsap.core.Tween | null = null

/** 选中格子的弹入进度，由 gsap 驱动 */
const selectionPop = { value: 0 }

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.arcTo(x + width, y, x + width, y + r, r)
  ctx.lineTo(x + width, y + height - r)
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r)
  ctx.lineTo(x + r, y + height)
  ctx.arcTo(x, y + height, x, y + height - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/** 格子边界取整到设备像素，避免小数格边长出现缝隙 */
function cellBounds(col: number, row: number) {
  const x = Math.round(col * cellSize)
  const y = Math.round(row * cellSize)
  return {
    x,
    y,
    width: Math.max(1, Math.round((col + 1) * cellSize) - x),
    height: Math.max(1, Math.round((row + 1) * cellSize) - y),
  }
}

/** 画空网格 */
function drawBase() {
  const ctx = baseCanvas.value?.getContext('2d')
  const board = store.board
  if (!ctx || !board) return
  ctx.clearRect(0, 0, boardWidth, boardHeight)
  ctx.fillStyle = EMPTY_COLOR
  ctx.fillRect(0, 0, boardWidth, boardHeight)
  if (cellSize >= 8) {
    ctx.lineWidth = 1
    ctx.strokeStyle = BORDER_COLOR
    for (let row = 0; row < board.rows; row++) {
      for (let col = 0; col < board.cols; col++) {
        const bounds = cellBounds(col, row)
        const width = Math.max(1, bounds.width - 1)
        const height = Math.max(1, bounds.height - 1)
        roundRect(ctx, bounds.x + 0.5, bounds.y + 0.5, width, height, Math.min(width, height) * 0.22)
        ctx.fillStyle = CELL_COLOR
        ctx.fill()
        ctx.stroke()
      }
    }
    return
  }
  if (cellSize >= 2.5) {
    ctx.lineWidth = 1
    ctx.strokeStyle = SOFT_BORDER_COLOR
    ctx.beginPath()
    for (let col = 1; col < board.cols; col++) {
      const x = Math.round(col * cellSize) + 0.5
      ctx.moveTo(x, 0)
      ctx.lineTo(x, boardHeight)
    }
    for (let row = 1; row < board.rows; row++) {
      const y = Math.round(row * cellSize) + 0.5
      ctx.moveTo(0, y)
      ctx.lineTo(boardWidth, y)
    }
    ctx.stroke()
  }
}

/** 格子够大时在色块中间标注颜色编号 */
function drawCellLabel(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
  label: string,
  background: string,
) {
  if (!store.showNumbers || cellSize < 12) return
  const size = Math.max(6, Math.min(22, Math.round(cellSize * 0.46)))
  ctx.font = `600 ${size}px system-ui, -apple-system, 'Segoe UI', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = contrastColor(background)
  ctx.fillText(label, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
}

/** 按格子边长决定圆角还是方角 */
function fillCellRect(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
  color: string,
) {
  ctx.fillStyle = color
  if (cellSize >= 8) {
    const width = Math.max(1, bounds.width - 1)
    const height = Math.max(1, bounds.height - 1)
    roundRect(ctx, bounds.x + 0.5, bounds.y + 0.5, width, height, Math.min(width, height) * 0.22)
    ctx.fill()
    return
  }
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
}

/** 重画单个格子 */
function drawCell(index: number) {
  const ctx = paintCanvas.value?.getContext('2d')
  const board = store.board
  const value = store.cells[index]
  if (!ctx || !board || value === undefined) return
  const col = index % board.cols
  const row = (index - col) / board.cols
  const bounds = cellBounds(col, row)
  ctx.clearRect(bounds.x, bounds.y, bounds.width, bounds.height)
  if (value === 0) return
  const color = board.palette[value - 1]
  if (!color) return
  fillCellRect(ctx, bounds, color)
  drawCellLabel(ctx, bounds, String(value), color)
}

/** 重画全部已填格子 */
function drawAllCells() {
  const ctx = paintCanvas.value?.getContext('2d')
  const board = store.board
  if (!ctx || !board) return
  ctx.clearRect(0, 0, boardWidth, boardHeight)
  if (cellSize >= 8) {
    for (let i = 0; i < store.cells.length; i++) {
      if (store.cells[i] !== 0) drawCell(i)
    }
    return
  }
  const data = store.cells
  for (let row = 0; row < board.rows; row++) {
    const offset = row * board.cols
    let col = 0
    while (col < board.cols) {
      const value = data[offset + col]!
      if (value === 0) {
        col++
        continue
      }
      let end = col + 1
      while (end < board.cols && data[offset + end] === value) end++
      const start = cellBounds(col, row)
      ctx.fillStyle = board.palette[value - 1] ?? '#000000'
      ctx.fillRect(start.x, start.y, Math.round(end * cellSize) - start.x, start.height)
      col = end
    }
  }
}

/** 把正确颜色画到提示层 */
function drawHintCells() {
  const ctx = hintCanvas.value?.getContext('2d')
  const board = store.board
  if (!ctx || !board) return
  ctx.clearRect(0, 0, boardWidth, boardHeight)
  const target = board.target
  if (cellSize >= 8) {
    for (let row = 0; row < board.rows; row++) {
      for (let col = 0; col < board.cols; col++) {
        const value = target[row * board.cols + col]
        if (value === undefined) continue
        const color = board.palette[value]
        if (!color) continue
        const bounds = cellBounds(col, row)
        fillCellRect(ctx, bounds, color)
        drawCellLabel(ctx, bounds, String(value + 1), color)
      }
    }
    return
  }
  for (let row = 0; row < board.rows; row++) {
    const offset = row * board.cols
    let col = 0
    while (col < board.cols) {
      const value = target[offset + col]
      if (value === undefined) {
        col++
        continue
      }
      let end = col + 1
      while (end < board.cols && target[offset + end] === value) end++
      const start = cellBounds(col, row)
      ctx.fillStyle = board.palette[value] ?? '#000000'
      ctx.fillRect(start.x, start.y, Math.round(end * cellSize) - start.x, start.height)
      col = end
    }
  }
}

/** 悬停格子的轻微突起 */
function drawHoverCell(ctx: CanvasRenderingContext2D, index: number) {
  const board = store.board!
  const col = index % board.cols
  const row = (index - col) / board.cols
  const bounds = cellBounds(col, row)
  const min = Math.min(bounds.width, bounds.height)
  const grow = Math.max(1, min * 0.16)
  const x = bounds.x - grow
  const y = bounds.y - grow
  const width = bounds.width + grow * 2
  const height = bounds.height + grow * 2
  const radius = Math.max(1, Math.min(width, height) * 0.24)
  ctx.save()
  ctx.shadowColor = 'rgba(15, 23, 42, 0.4)'
  ctx.shadowBlur = Math.max(4, min * 0.6)
  ctx.shadowOffsetY = Math.max(1, min * 0.18)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  roundRect(ctx, x, y, width, height, radius)
  ctx.fill()
  ctx.restore()
  ctx.lineWidth = Math.max(1, min * 0.1)
  ctx.strokeStyle = 'rgba(79, 140, 255, 0.7)'
  roundRect(ctx, x, y, width, height, radius)
  ctx.stroke()
}

/** 选中格子的高亮 */
function drawSelectedCell(ctx: CanvasRenderingContext2D, index: number) {
  const board = store.board!
  const col = index % board.cols
  const row = (index - col) / board.cols
  const bounds = cellBounds(col, row)
  const min = Math.min(bounds.width, bounds.height)
  const grow = Math.max(2, min * 0.28) * (0.35 + 0.65 * selectionPop.value)
  const x = bounds.x - grow
  const y = bounds.y - grow
  const width = bounds.width + grow * 2
  const height = bounds.height + grow * 2
  const radius = Math.max(1, Math.min(width, height) * 0.26)
  const ring = Math.max(2, min * 0.26)

  ctx.save()
  ctx.shadowColor = 'rgba(79, 140, 255, 0.95)'
  ctx.shadowBlur = Math.max(12, min * 1.5)
  ctx.lineWidth = ring
  ctx.strokeStyle = HIGHLIGHT_COLOR
  roundRect(ctx, x, y, width, height, radius)
  ctx.stroke()
  ctx.restore()

  const inset = ring * 0.9
  const innerWidth = Math.max(1, width - inset * 2)
  const innerHeight = Math.max(1, height - inset * 2)
  const innerRadius = Math.max(1, Math.min(innerWidth, innerHeight) * 0.26)
  ctx.lineWidth = Math.max(1, ring * 0.5)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
  roundRect(ctx, x + inset, y + inset, innerWidth, innerHeight, innerRadius)
  ctx.stroke()

  ctx.fillStyle = 'rgba(79, 140, 255, 0.15)'
  roundRect(
    ctx,
    x + inset * 2,
    y + inset * 2,
    Math.max(1, width - inset * 4),
    Math.max(1, height - inset * 4),
    innerRadius,
  )
  ctx.fill()
}

/** 悬浮层：悬停提示 + 选中高亮 */
function drawOverlay() {
  const ctx = hoverCanvas.value?.getContext('2d')
  const board = store.board
  if (!ctx || !board) return
  ctx.clearRect(0, 0, boardWidth, boardHeight)
  if (store.hinting) return
  if (hoverIndex >= 0 && hoverIndex !== store.selectedCell) drawHoverCell(ctx, hoverIndex)
  if (store.selectedCell !== null) drawSelectedCell(ctx, store.selectedCell)
}

/** 提示：正确颜色以 0 → 50% 透明度闪烁三次，结束后恢复原样 */
function runHint() {
  const el = hintCanvas.value
  if (!el) return
  hoverIndex = -1
  drawOverlay()
  drawHintCells()
  gsap.killTweensOf(el)
  gsap.set(el, { opacity: 0 })
  gsap.to(el, {
    opacity: 0.5,
    duration: 1,
    repeat: 5,
    yoyo: true,
    ease: 'power1.inOut',
    onComplete: () => {
      gsap.set(el, { opacity: 0 })
      store.finishHint()
    },
  })
}

/** 按可用空间换算格子边长与画布尺寸 */
function measure() {
  const element = stage.value
  const board = store.board
  if (!element || !board) return
  const style = getComputedStyle(element)
  const availableWidth =
    element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  const availableHeight =
    element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
  const dpr = window.devicePixelRatio || 1
  const raw = Math.min((availableWidth * dpr) / board.cols, (availableHeight * dpr) / board.rows)
  boardWidth = Math.max(
    board.cols,
    Math.round((Number.isFinite(raw) && raw > 0 ? raw : 1) * board.cols),
  )
  boardHeight = Math.max(board.rows, Math.round((boardWidth / board.cols) * board.rows))
  cellSize = boardWidth / board.cols
  boardStyle.value = { width: `${boardWidth / dpr}px`, height: `${boardHeight / dpr}px` }
  for (const canvas of [
    baseCanvas.value,
    paintCanvas.value,
    hoverCanvas.value,
    hintCanvas.value,
  ]) {
    if (!canvas) continue
    canvas.width = boardWidth
    canvas.height = boardHeight
  }
  drawBase()
  drawAllCells()
  drawOverlay()
  if (store.hinting) drawHintCells()
}

function cellAt(event: PointerEvent): number {
  const canvas = hoverCanvas.value
  const board = store.board
  if (!canvas || !board) return -1
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return -1
  const col = Math.floor((((event.clientX - rect.left) / rect.width) * boardWidth) / cellSize)
  const row = Math.floor((((event.clientY - rect.top) / rect.height) * boardHeight) / cellSize)
  if (col < 0 || col >= board.cols || row < 0 || row >= board.rows) return -1
  return row * board.cols + col
}

function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0 || store.hinting) return
  const index = cellAt(event)
  store.selectCell(index < 0 ? null : index)
}

function handlePointerMove(event: PointerEvent) {
  if (store.hinting) return
  const index = cellAt(event)
  if (index === hoverIndex) return
  hoverIndex = index
  drawOverlay()
}

function handlePointerLeave() {
  if (hoverIndex < 0) return
  hoverIndex = -1
  drawOverlay()
}

watch(
  () => store.board,
  async () => {
    hoverIndex = -1
    selectionPop.value = 0
    await nextTick()
    measure()
  },
)

watch(
  () => store.selectedCell,
  (index) => {
    popTween?.kill()
    if (index === null) {
      selectionPop.value = 0
      drawOverlay()
      return
    }
    selectionPop.value = 0
    popTween = gsap.to(selectionPop, {
      value: 1,
      duration: 0.5,
      ease: 'elastic.out(1, 0.6)',
      onUpdate: drawOverlay,
    })
  },
)

watch(
  () => store.revision,
  () => {
    if (store.selectedCell !== null) drawCell(store.selectedCell)
  },
)

watch(() => store.showNumbers, drawAllCells)

watch(
  () => store.hinting,
  (on) => {
    if (on) runHint()
    else drawOverlay()
  },
)

onMounted(() => {
  observer = new ResizeObserver(() => measure())
  if (stage.value) observer.observe(stage.value)
  measure()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  popTween?.kill()
})
</script>

<template>
  <div
    ref="stage"
    class="stage"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave"
    @contextmenu.prevent
  >
    <div class="board" :class="{ locked: store.hinting }" :style="boardStyle">
      <canvas ref="baseCanvas" class="layer" />
      <canvas ref="paintCanvas" class="layer" />
      <canvas ref="hoverCanvas" class="layer" />
      <canvas ref="hintCanvas" class="layer" />
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 108px 28px 176px;
  user-select: none;
  touch-action: none;
}

.board {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  background: #e8edf4;
  cursor: pointer;
  box-shadow:
    0 30px 70px rgba(3, 8, 22, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.07);
}

.board.locked {
  cursor: not-allowed;
}

.layer {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
</style>
