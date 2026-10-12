/** RGB 颜色 */
export type Rgb = [number, number, number]

/** 打包为 0xRRGGBB */
function packColor(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b
}

/** 转十六进制颜色 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

/** 按底色明度取可读的文字颜色 */
export function contrastColor(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16)
  const r = (value >> 16) & 0xff
  const g = (value >> 8) & 0xff
  const b = value & 0xff
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#1b2436' : '#ffffff'
}

/** 红均值加权色差 */
function distance(r: number, g: number, b: number, r2: number, g2: number, b2: number): number {
  const dr = r - r2
  const dg = g - g2
  const db = b - b2
  const rMean = (r + r2) / 2
  return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db
}

interface Bucket {
  start: number
  end: number
  weight: number
  range: number
  channel: 0 | 1 | 2
}

/** 统计一段颜色在最长通道上的跨度 */
function createBucket(
  colors: Uint32Array,
  weights: Uint32Array,
  order: Uint32Array,
  start: number,
  end: number,
): Bucket {
  let rMin = 255
  let rMax = 0
  let gMin = 255
  let gMax = 0
  let bMin = 255
  let bMax = 0
  let weight = 0
  for (let i = start; i < end; i++) {
    const color = colors[order[i]!]!
    const r = (color >> 16) & 0xff
    const g = (color >> 8) & 0xff
    const b = color & 0xff
    if (r < rMin) rMin = r
    if (r > rMax) rMax = r
    if (g < gMin) gMin = g
    if (g > gMax) gMax = g
    if (b < bMin) bMin = b
    if (b > bMax) bMax = b
    weight += weights[order[i]!]!
  }
  const dr = rMax - rMin
  const dg = gMax - gMin
  const db = bMax - bMin
  const channel: 0 | 1 | 2 = dr >= dg && dr >= db ? 0 : dg >= db ? 1 : 2
  return { start, end, weight, range: Math.max(dr, dg, db), channel }
}

/** 沿最长通道按权重中位切分 */
function splitBucket(
  bucket: Bucket,
  colors: Uint32Array,
  weights: Uint32Array,
  order: Uint32Array,
): Bucket {
  const shift = bucket.channel === 0 ? 16 : bucket.channel === 1 ? 8 : 0
  order
    .subarray(bucket.start, bucket.end)
    .sort((a, b) => ((colors[a]! >> shift) & 0xff) - ((colors[b]! >> shift) & 0xff))
  const half = bucket.weight / 2
  let acc = 0
  let mid = bucket.start + 1
  for (let i = bucket.start; i < bucket.end - 1; i++) {
    acc += weights[order[i]!]!
    mid = i + 1
    if (acc >= half) break
  }
  return createBucket(colors, weights, order, mid, bucket.end)
}

/** 中位切分法生成调色板 */
export function buildPalette(pixels: Uint8ClampedArray, count: number): Rgb[] {
  const histogram = new Map<number, number>()
  for (let i = 0; i < pixels.length; i += 4) {
    const key = packColor(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!)
    histogram.set(key, (histogram.get(key) ?? 0) + 1)
  }
  const size = histogram.size
  if (size === 0 || count < 1) return []

  const colors = new Uint32Array(size)
  const weights = new Uint32Array(size)
  const order = new Uint32Array(size)
  let index = 0
  histogram.forEach((weight, key) => {
    colors[index] = key
    weights[index] = weight
    order[index] = index
    index++
  })

  const buckets: Bucket[] = [createBucket(colors, weights, order, 0, size)]
  while (buckets.length < count) {
    let target = -1
    let widest = 0
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i]!
      if (bucket.end - bucket.start > 1 && bucket.range > widest) {
        widest = bucket.range
        target = i
      }
    }
    if (target < 0) break
    const bucket = buckets[target]!
    const next = splitBucket(bucket, colors, weights, order)
    buckets[target] = createBucket(colors, weights, order, bucket.start, next.start)
    buckets.push(next)
  }

  return buckets.map((bucket) => {
    let r = 0
    let g = 0
    let b = 0
    let weight = 0
    for (let i = bucket.start; i < bucket.end; i++) {
      const color = colors[order[i]!]!
      const w = weights[order[i]!]!
      r += ((color >> 16) & 0xff) * w
      g += ((color >> 8) & 0xff) * w
      b += (color & 0xff) * w
      weight += w
    }
    return [Math.round(r / weight), Math.round(g / weight), Math.round(b / weight)] as Rgb
  })
}

/** 找最接近的颜色下标 */
function nearestIndex(r: number, g: number, b: number, palette: Rgb[]): number {
  let best = 0
  let bestDistance = Infinity
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i]!
    const current = distance(r, g, b, pr, pg, pb)
    if (current < bestDistance) {
      bestDistance = current
      best = i
    }
  }
  return best
}

/** 量化像素，返回每个像素的调色板下标 */
export function quantizePixels(pixels: Uint8ClampedArray, palette: Rgb[]): Uint8Array {
  const result = new Uint8Array(pixels.length / 4)
  if (palette.length === 0) return result
  const cache = new Map<number, number>()
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    const r = pixels[i]!
    const g = pixels[i + 1]!
    const b = pixels[i + 2]!
    const key = packColor(r, g, b)
    let index = cache.get(key)
    if (index === undefined) {
      index = nearestIndex(r, g, b, palette)
      cache.set(key, index)
    }
    result[p] = index
  }
  return result
}
