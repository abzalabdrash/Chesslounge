import { Chess, type Move, type Square } from 'chess.js'

export type Side = 'w' | 'b'
export type ReplayTone = 'live' | 'review'
export type SquareHighlight = 'selected' | 'quiet' | 'capture'

export function getPieceAtSquare(fen: string, square: string) {
  try {
    const probe = new Chess(fen)
    const piece = probe.get(square as Square)
    return piece ? { color: piece.color, type: piece.type } : null
  } catch {
    return null
  }
}

export function pieceBelongsTo(fen: string, square: string, side: Side): boolean {
  return getPieceAtSquare(fen, square)?.color === side
}

export function getReplayStatusLabel(viewPly: number | null, totalPlies: number): {
  text: string
  tone: ReplayTone
} {
  if (viewPly === null || viewPly === totalPlies) {
    return { text: 'At board', tone: 'live' }
  }

  const moveNumber = Math.floor((viewPly + 1) / 2)
  return {
    text: `Move ${moveNumber}${viewPly % 2 === 0 ? '...' : '.'}`,
    tone: 'review',
  }
}

export function getSquareHighlights(
  fen: string,
  selected: Square | null,
  legalMoves: Move[],
): Record<string, SquareHighlight> {
  if (!selected) return {}

  const highlights: Record<string, SquareHighlight> = { [selected]: 'selected' }
  for (const move of legalMoves) {
    highlights[move.to] = getPieceAtSquare(fen, move.to) ? 'capture' : 'quiet'
  }
  return highlights
}
