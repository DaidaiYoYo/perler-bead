import type { ColorPreset, Difficulty, GameConfig, GridSize } from '@/types'

/** 难度对应的最长边格子数 */
export const DIFFICULTY_SIDES: Record<Exclude<Difficulty, 'custom'>, number> = {
  low: 100,
  medium: 300,
  high: 500,
}

/** 难度选项 */
export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'low', label: '低（最长边 100 格）' },
  { value: 'medium', label: '中（最长边 300 格）' },
  { value: 'high', label: '高（最长边 500 格）' },
  { value: 'custom', label: '自定义' },
]

/** 颜色数量选项 */
export const COLOR_PRESET_OPTIONS: { value: ColorPreset; label: string }[] = [
  { value: 12, label: '12 色' },
  { value: 48, label: '48 色' },
  { value: 120, label: '120 色' },
  { value: 'custom', label: '自定义' },
]

/** 原图最长边压缩上限 */
export const MAX_SOURCE_SIDE = 1024

/** 自定义最长边格子数范围 */
export const MIN_CUSTOM_SIDE = 8
export const MAX_CUSTOM_SIDE = 800

/** 自定义颜色数量范围 */
export const MIN_CUSTOM_COLORS = 3
export const MAX_CUSTOM_COLORS = 300

/** 取最长边格子数 */
export function resolveLongestSide(config: GameConfig): number {
  if (config.difficulty === 'custom') {
    return config.customLongestSide ?? DIFFICULTY_SIDES.medium
  }
  return DIFFICULTY_SIDES[config.difficulty]
}

/** 取颜色数量 */
export function resolveColorCount(config: GameConfig): number {
  if (config.colorPreset === 'custom') {
    return config.customColorCount ?? 12
  }
  return config.colorPreset
}

/** 按原图长宽比换算格子尺寸 */
export function resolveGridSize(width: number, height: number, longestSide: number): GridSize {
  if (width <= 0 || height <= 0) {
    return { cols: longestSide, rows: longestSide }
  }
  if (width >= height) {
    return { cols: longestSide, rows: Math.max(1, Math.round((longestSide * height) / width)) }
  }
  return { cols: Math.max(1, Math.round((longestSide * width) / height)), rows: longestSide }
}
