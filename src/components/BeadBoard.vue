<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'

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

const boardStyle = ref({ width: '0px', height: '0px' })

const cols = computed(() => store.board?.cols ?? 0)

let cellSize = 0
let boardWidth = 0
let boardHeight = 0
let hoverIndex = -1
let lastPainted = -1
let painting = false
let observer: ResizeObserver | null = null

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
      ctx.fillRect(
        start.x,
        start.y,
        Math.round(end * cellSize) - start.x,
        start.height,
      )
      col = end
    }
  }
}

/** 画悬停格子的突起效果 */
function drawHover() {
  const ctx = hoverCanvas.value?.getContext('2d')
  const board = store.board
  if (!ctx || !board) return
  ctx.clearRect(0, 0, boardWidth, boardHeight)
  if (hoverIndex < 0) return
  const col = hoverIndex % board.cols
  const row = (hoverIndex - col) / board.cols
  const bounds = cellBounds(col, row)
  const padding = Math.max(1, Math.min(bounds.width, bounds.height) * 0.18)
  const x = bounds.x - padding
  const y = bounds.y - padding
  const width = bounds.width + padding * 2
  const height = bounds.height + padding * 2
  const radius = Math.max(1, Math.min(width, height) * 0.22)
  const selected = store.selectedColor
  const color = selected === null ? null : board.palette[selected]
  ctx.save()
  ctx.shadowColor = 'rgba(15, 23, 42, 0.45)'
  ctx.shadowBlur = Math.max(4, Math.min(bounds.width, bounds.height) * 0.7)
  ctx.shadowOffsetY = Math.max(1, Math.min(bounds.width, bounds.height) * 0.2)
  ctx.fillStyle = color ?? CELL_COLOR
  roundRect(ctx, x, y, width, height, radius)
  ctx.fill()
  ctx.restore()
  ctx.lineWidth = Math.max(1, Math.min(bounds.width, bounds.height) * 0.12)
  ctx.strokeStyle = HIGHLIGHT_COLOR
  roundRect(ctx, x, y, width, height, radius)
  ctx.stroke()
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
  const raw = Math.min(
    (availableWidth * dpr) / board.cols,
    (availableHeight * dpr) / board.rows,
  )
  boardWidth = Math.max(board.cols, Math.round((Number.isFinite(raw) && raw > 0 ? raw : 1) * board.cols))
  boardHeight = Math.max(board.rows, Math.round((boardWidth / board.cols) * board.rows))
  cellSize = boardWidth / board.cols
  boardStyle.value = { width: `${boardWidth / dpr}px`, height: `${boardHeight / dpr}px` }
  for (const canvas of [baseCanvas.value, paintCanvas.value, hoverCanvas.value]) {
    if (!canvas) continue
    canvas.width = boardWidth
    canvas.height = boardHeight
  }
  drawBase()
  drawAllCells()
  drawHover()
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

function applyPaint(index: number) {
  if (store.paint(index)) drawCell(index)
}

/** 补齐两次移动之间被跳过的格子 */
function paintLine(from: number, to: number) {
  const board = store.board
  if (!board) return
  if (from < 0) {
    applyPaint(to)
    return
  }
  const startX = from % board.cols
  const startY = (from - startX) / board.cols
  const endX = to % board.cols
  const endY = (to - endX) / board.cols
  const stepX = startX < endX ? 1 : -1
  const stepY = startY < endY ? 1 : -1
  const spanX = Math.abs(endX - startX)
  const spanY = Math.abs(endY - startY)
  let error = spanX - spanY
  let x = startX
  let y = startY
  for (;;) {
    applyPaint(y * board.cols + x)
    if (x === endX && y === endY) break
    const doubled = error * 2
    if (doubled > -spanY) {
      error -= spanY
      x += stepX
    }
    if (doubled < spanX) {
      error += spanX
      y += stepY
    }
  }
}

function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const index = cellAt(event)
  if (index < 0) return
  painting = true
  hoverIndex = index
  lastPainted = index
  hoverCanvas.value?.setPointerCapture(event.pointerId)
  applyPaint(index)
  drawHover()
  event.preventDefault()
}

function handlePointerMove(event: PointerEvent) {
  const index = cellAt(event)
  if (index !== hoverIndex) {
    hoverIndex = index
    drawHover()
  }
  if (!painting || index < 0) return
  paintLine(lastPainted, index)
  lastPainted = index
}

function handlePointerUp(event: PointerEvent) {
  if (!painting) return
  painting = false
  lastPainted = -1
  const canvas = hoverCanvas.value
  if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
  store.commit()
}

function handlePointerLeave() {
  if (painting) return
  hoverIndex = -1
  drawHover()
}

watch(
  () => store.board,
  async () => {
    hoverIndex = -1
    lastPainted = -1
    await nextTick()
    measure()
  },
)

watch(() => store.selectedColor, drawHover)

onMounted(() => {
  observer = new ResizeObserver(() => measure())
  if (stage.value) observer.observe(stage.value)
  measure()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div ref="stage" class="stage">
    <div class="board" :style="boardStyle">
      <canvas ref="baseCanvas" class="layer" />
      <canvas ref="paintCanvas" class="layer" />
      <canvas
        ref="hoverCanvas"
        class="layer interactive"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointercancel="handlePointerUp"
        @pointerleave="handlePointerLeave"
        @contextmenu.prevent
      />
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
}

.board {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  background: #e8edf4;
  box-shadow:
    0 30px 70px rgba(3, 8, 22, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.07);
}

.layer {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.interactive {
  cursor: crosshair;
  touch-action: none;
}
</style>
