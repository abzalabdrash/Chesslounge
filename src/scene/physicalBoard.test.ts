import { describe, expect, it } from 'vitest'
import type { Square } from 'chess.js'
import { BOARD_SIZE, boardPointToSquare, boardSquarePalette, squareToBoardPoint } from './physicalBoard'

describe('physical chess board mapping', () => {
  it('places white home rank at the player side of the table', () => {
    const a1 = squareToBoardPoint('a1')
    const h8 = squareToBoardPoint('h8')

    expect(a1.x).toBeLessThan(0)
    expect(a1.z).toBeGreaterThan(0)
    expect(h8.x).toBeGreaterThan(0)
    expect(h8.z).toBeLessThan(0)
  })

  it('round-trips every square through local board coordinates', () => {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

    for (const file of files) {
      for (let rank = 1; rank <= 8; rank++) {
        const square = `${file}${rank}` as Square
        const point = squareToBoardPoint(square)

        expect(boardPointToSquare(point.x, point.z)).toBe(square)
      }
    }
  })

  it('ignores points outside the playable board', () => {
    expect(boardPointToSquare(BOARD_SIZE, 0)).toBeNull()
    expect(boardPointToSquare(0, -BOARD_SIZE)).toBeNull()
  })

  it('uses a green and cream playable palette', () => {
    expect(boardSquarePalette.light).toBe('#eeeed2')
    expect(boardSquarePalette.dark).toBe('#769656')
  })
})
