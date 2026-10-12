/** 难度 */
export type Difficulty = 'low' | 'medium' | 'high' | 'custom'

/** 颜色数量预设 */
export type ColorPreset = 12 | 48 | 120 | 'custom'

/** 游戏配置 */
export interface GameConfig {
  /** 原图（压缩后的 dataURL） */
  imageUrl: string
  /** 原图宽度（像素） */
  imageWidth: number
  /** 原图高度（像素） */
  imageHeight: number
  difficulty: Difficulty
  /** 自定义最长边格子数 */
  customLongestSide: number | null
  colorPreset: ColorPreset
  /** 自定义颜色数量 */
  customColorCount: number | null
}

/** 棋盘 */
export interface BoardData {
  cols: number
  rows: number
  /** 调色板（#rrggbb） */
  palette: string[]
  /** 效果图 dataURL */
  effectUrl: string
}

/** 网格尺寸 */
export interface GridSize {
  cols: number
  rows: number
}
