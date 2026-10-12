import type { Rgb } from './color'

/** 加载图片 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片加载失败'))
    image.src = src
  })
}

/** 读取文件为 dataURL */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, width)
  canvas.height = Math.max(1, height)
  return canvas
}

/** 压缩原图到指定最长边，透明区域填白 */
export function shrinkImage(
  image: HTMLImageElement,
  maxSide: number,
): { dataUrl: string; width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, width, height)
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), width, height }
}

/** 按格子区域取平均色，返回 RGBA 像素 */
export function samplePixels(image: HTMLImageElement, cols: number, rows: number): Uint8ClampedArray {
  const sourceWidth = image.naturalWidth
  const sourceHeight = image.naturalHeight
  const canvas = createCanvas(sourceWidth, sourceHeight)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  const source = ctx.getImageData(0, 0, sourceWidth, sourceHeight).data

  const pixels = new Uint8ClampedArray(cols * rows * 4)
  for (let row = 0; row < rows; row++) {
    const y0 = Math.min(sourceHeight - 1, Math.floor((row * sourceHeight) / rows))
    const y1 = Math.max(y0 + 1, Math.floor(((row + 1) * sourceHeight) / rows))
    for (let col = 0; col < cols; col++) {
      const x0 = Math.min(sourceWidth - 1, Math.floor((col * sourceWidth) / cols))
      const x1 = Math.max(x0 + 1, Math.floor(((col + 1) * sourceWidth) / cols))
      let r = 0
      let g = 0
      let b = 0
      let total = 0
      for (let y = y0; y < y1; y++) {
        const offset = y * sourceWidth
        for (let x = x0; x < x1; x++) {
          const i = (offset + x) * 4
          r += source[i]!
          g += source[i + 1]!
          b += source[i + 2]!
          total++
        }
      }
      const out = (row * cols + col) * 4
      pixels[out] = r / total
      pixels[out + 1] = g / total
      pixels[out + 2] = b / total
      pixels[out + 3] = 255
    }
  }
  return pixels
}

/** 渲染效果图 */
export function renderEffect(indices: Uint8Array, palette: Rgb[], cols: number, rows: number): string {
  const canvas = createCanvas(cols, rows)
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(cols, rows)
  for (let i = 0; i < indices.length; i++) {
    const [r, g, b] = palette[indices[i]!] ?? [0, 0, 0]
    const offset = i * 4
    imageData.data[offset] = r
    imageData.data[offset + 1] = g
    imageData.data[offset + 2] = b
    imageData.data[offset + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

/** 把已填格子渲染成画布，0 表示留空 */
export function renderCells(
  cells: Uint8Array,
  palette: string[],
  cols: number,
  rows: number,
  background: string,
): HTMLCanvasElement {
  const canvas = createCanvas(cols, rows)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = background
  ctx.fillRect(0, 0, cols, rows)
  for (let i = 0; i < cells.length; i++) {
    const value = cells[i]!
    if (value === 0) continue
    const color = palette[value - 1]
    if (!color) continue
    const col = i % cols
    ctx.fillStyle = color
    ctx.fillRect(col, (i - col) / cols, 1, 1)
  }
  return canvas
}
