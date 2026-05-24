import type { Square } from 'chess.js'

export const BOARD_SIZE = 1.12
export const BOARD_Y = 1.012
export const SQUARE_SIZE = BOARD_SIZE / 8
// Chess.com "Green" classic board — high-contrast, premium feel.
export const boardSquarePalette = {
  light: '#eeeed2',
  dark: '#769656',
}

const FILES = 'abcdefgh'

export interface BoardPoint {
  x: number
  z: number
}

export function squareToBoardPoint(square: Square): BoardPoint {
  const file = FILES.indexOf(square[0])
  const rank = Number(square[1])
  return {
    x: (file - 3.5) * SQUARE_SIZE,
    z: (3.5 - (rank - 1)) * SQUARE_SIZE,
  }
}

export function boardPointToSquare(x: number, z: number): Square | null {
  const half = BOARD_SIZE / 2
  if (x < -half || x >= half || z < -half || z >= half) return null

  const file = Math.floor((x + half) / SQUARE_SIZE)
  const rankFromTop = Math.floor((z + half) / SQUARE_SIZE)
  const rank = 8 - rankFromTop
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null

  return `${FILES[file]}${rank}` as Square
}

export function boardSquareColor(square: Square): 'light' | 'dark' {
  const file = FILES.indexOf(square[0])
  const rank = Number(square[1])
  return (file + rank) % 2 === 0 ? 'dark' : 'light'
}
