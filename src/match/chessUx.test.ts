import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import {
  getPieceAtSquare,
  getReplayStatusLabel,
  getSquareHighlights,
  pieceBelongsTo,
} from './chessUx'

describe('chess UX helpers', () => {
  it('detects whether a square contains a piece for the requested side', () => {
    const fen = new Chess().fen()

    expect(pieceBelongsTo(fen, 'e2', 'w')).toBe(true)
    expect(pieceBelongsTo(fen, 'e7', 'w')).toBe(false)
    expect(pieceBelongsTo(fen, 'nope', 'w')).toBe(false)
  })

  it('returns compact replay labels without noisy live/debug copy', () => {
    expect(getReplayStatusLabel(null, 12)).toEqual({ text: 'At board', tone: 'live' })
    expect(getReplayStatusLabel(12, 12)).toEqual({ text: 'At board', tone: 'live' })
    expect(getReplayStatusLabel(4, 12)).toEqual({ text: 'Move 2...', tone: 'review' })
    expect(getReplayStatusLabel(5, 12)).toEqual({ text: 'Move 3.', tone: 'review' })
  })

  it('marks possible moves as quiet or capture destinations', () => {
    const chess = new Chess('rnbqkbnr/pppppppp/8/4p3/3P4/8/PPP2PPP/RNBQKBNR w KQkq - 0 3')
    const moves = chess.moves({ square: 'd4', verbose: true })
    const highlights = getSquareHighlights(chess.fen(), 'd4', moves)

    expect(highlights.d4).toBe('selected')
    expect(highlights.d5).toBe('quiet')
    expect(highlights.e5).toBe('capture')
    expect(getPieceAtSquare(chess.fen(), 'e5')).toEqual({ color: 'b', type: 'p' })
  })
})
