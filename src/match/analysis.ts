import { Chess, type Move } from 'chess.js'
import type { EvalScore } from './engine'

// Chess.com-style move classifications. Order roughly matches their UI.
export type MoveClass =
  | 'book'
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'

export type GamePhase = 'opening' | 'middlegame' | 'endgame'

export interface MoveAnalysis {
  classification: MoveClass
  /** Pawn-units loss from the mover's perspective. 0 = best, big = blunder. */
  cpLoss: number
  /** Whole-board eval AFTER the move, from white's perspective, in pawns. */
  evalAfterPawns: number
  /** Pretty "+1.4" / "-0.6" / "M3" string from white's perspective. */
  evalDisplay: string
  /** Engine's preferred move from the position BEFORE this move was played. */
  bestMoveSan: string | null
  /** True if the mover hung mate-in-N as a result of this move. */
  walkedIntoMate: boolean
  phase: GamePhase
}

const MATE_CP = 100_000

function scoreToCp(score: EvalScore | null): number {
  if (!score) return 0
  if (score.mate !== null) {
    if (score.mate === 0) return score.cp ?? 0
    return score.mate > 0 ? MATE_CP - score.mate : -MATE_CP - score.mate
  }
  return score.cp ?? 0
}

export function formatEval(score: EvalScore | null): string {
  if (!score) return '0.0'
  if (score.mate !== null) {
    const sign = score.mate > 0 ? '+' : '-'
    return `${sign}M${Math.abs(score.mate)}`
  }
  const pawns = (score.cp ?? 0) / 100
  const sign = pawns >= 0 ? '+' : ''
  return `${sign}${pawns.toFixed(1)}`
}

/**
 * Resolve UCI bestmove (e2e4 / e7e8q) to SAN given the *prior* FEN.
 * Returns null if the move can't be applied (engine returned garbage, etc).
 */
export function uciToSan(fenBefore: string, uci: string | null): string | null {
  if (!uci || uci.length < 4) return null
  try {
    const chess = new Chess(fenBefore)
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length >= 5 ? (uci[4] as 'q') : undefined,
    })
    return move ? move.san : null
  } catch {
    return null
  }
}

export function phaseFor(fen: string, moveNumber: number): GamePhase {
  if (moveNumber <= 12) return 'opening'
  const board = fen.split(' ')[0]
  // Count non-pawn non-king material on either side.
  let heavy = 0
  for (const ch of board) {
    if ('QRBNqrbn'.includes(ch)) heavy++
  }
  if (heavy <= 6) return 'endgame'
  return 'middlegame'
}

/**
 * Classify a single ply using chess.com-style thresholds.
 *
 * `evalBefore` / `evalAfter` are EvalScore objects from white's perspective.
 * `move` is the chess.js Move actually played.
 * `engineBestUci` is what Stockfish would have preferred at `evalBefore`.
 * `fenBefore` is needed to convert that UCI to SAN.
 */
export function classifyMove(args: {
  move: Move
  fenBefore: string
  evalBefore: EvalScore | null
  evalAfter: EvalScore | null
  engineBestUci: string | null
  moveNumber: number
}): MoveAnalysis {
  const { move, fenBefore, evalBefore, evalAfter, engineBestUci, moveNumber } = args

  const mover: 'w' | 'b' = move.color
  const sign = mover === 'w' ? 1 : -1
  const cpBefore = scoreToCp(evalBefore) * sign
  const cpAfter = scoreToCp(evalAfter) * sign
  // Loss in centipawns from mover's perspective. Positive = move was bad.
  let cpLoss = Math.max(0, cpBefore - cpAfter)
  // Clamp blunder noise when one side is already lost.
  if (cpBefore > 800) cpLoss = Math.min(cpLoss, 500)

  const walkedIntoMate =
    evalAfter?.mate !== null &&
    evalAfter?.mate !== undefined &&
    ((mover === 'w' && evalAfter.mate < 0) || (mover === 'b' && evalAfter.mate > 0))

  const wasBest = !!engineBestUci && engineBestUci === move.from + move.to + (move.promotion ?? '')

  let classification: MoveClass
  if (moveNumber <= 12 && cpLoss < 60) {
    classification = 'book'
  } else if (walkedIntoMate) {
    classification = 'blunder'
  } else if (wasBest) {
    classification = 'best'
  } else if (cpLoss < 20) {
    classification = 'excellent'
  } else if (cpLoss < 60) {
    classification = 'good'
  } else if (cpLoss < 150) {
    classification = 'inaccuracy'
  } else if (cpLoss < 300) {
    classification = 'mistake'
  } else {
    classification = 'blunder'
  }

  // Sacrifice detection: capturing player gave up more material than they
  // gained, but eval still favors them. That's "brilliant".
  if (
    (classification === 'best' || classification === 'excellent') &&
    detectSacrifice(move) &&
    cpAfter >= 50
  ) {
    classification = 'brilliant'
  }
  // "Great" move: only move that holds the eval, and it's clearly forcing.
  if (classification === 'best' && cpLoss === 0 && Math.abs(cpAfter - cpBefore) > 200) {
    classification = 'great'
  }

  return {
    classification,
    cpLoss,
    evalAfterPawns: scoreToCp(evalAfter) / 100,
    evalDisplay: formatEval(evalAfter),
    bestMoveSan: uciToSan(fenBefore, engineBestUci),
    walkedIntoMate,
    phase: phaseFor(fenBefore, moveNumber),
  }
}

const PIECE_VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }

function detectSacrifice(move: Move): boolean {
  // Capturing piece is worth more than what's captured, OR moving a major
  // piece into an attacked square. Cheap approximation; we don't have full
  // SEE here, but eval guards against false positives.
  if (!move.captured) {
    // Quiet sacrifices (Bxh7! style) — skip, hard to detect without SEE.
    return false
  }
  const attackerValue = PIECE_VALUE[move.piece] ?? 0
  const victimValue = PIECE_VALUE[move.captured] ?? 0
  return attackerValue >= victimValue + 200
}

// ---------------------------------------------------------------------------
// Match summary — counts classifications per side and computes a chess.com-
// style accuracy score (0-100). Used by the post-game report modal.
// ---------------------------------------------------------------------------

export interface SideSummary {
  /** Classification counts so the modal can list "12 best · 2 mistakes · 1 blunder". */
  counts: Record<MoveClass, number>
  /** Average centipawn loss per move on this side. */
  avgCpLoss: number
  /** 0..100 chess.com-style accuracy. Higher = better. */
  accuracy: number
  /** How many plies this side actually played. */
  total: number
}

const ZERO_COUNTS: Record<MoveClass, number> = {
  book: 0,
  brilliant: 0,
  great: 0,
  best: 0,
  excellent: 0,
  good: 0,
  inaccuracy: 0,
  mistake: 0,
  blunder: 0,
}

export function summarize(analyses: MoveAnalysis[]): SideSummary {
  if (analyses.length === 0) {
    return { counts: { ...ZERO_COUNTS }, avgCpLoss: 0, accuracy: 100, total: 0 }
  }
  const counts = { ...ZERO_COUNTS }
  let totalLoss = 0
  for (const a of analyses) {
    counts[a.classification] = (counts[a.classification] ?? 0) + 1
    totalLoss += a.cpLoss
  }
  const avgCpLoss = totalLoss / analyses.length
  // Cheap, reasonable accuracy mapping. Calibrated so that:
  //   avgCpLoss = 0   -> 100 (perfect)
  //   avgCpLoss = 30  -> ~85
  //   avgCpLoss = 80  -> ~70
  //   avgCpLoss = 200 -> ~40
  //   avgCpLoss = 400 -> ~10
  // Matches the "feel" of chess.com numbers without their full WDL machinery.
  const acc = 100 * Math.exp(-Math.max(0, avgCpLoss) / 200)
  return {
    counts,
    avgCpLoss,
    accuracy: Math.max(0, Math.min(100, acc)),
    total: analyses.length,
  }
}

// ---------------------------------------------------------------------------
// Material balance — used in FACTS for the LLM.
// ---------------------------------------------------------------------------

export interface MaterialDiff {
  /** Sum of pawn-equivalents. + = white up, - = black up. */
  pawns: number
  description: string
}

export function materialDiff(fen: string): MaterialDiff {
  const board = fen.split(' ')[0]
  let whiteCp = 0
  let blackCp = 0
  for (const ch of board) {
    if (ch >= 'A' && ch <= 'Z') {
      whiteCp += PIECE_VALUE[ch.toLowerCase()] ?? 0
    } else if (ch >= 'a' && ch <= 'z') {
      blackCp += PIECE_VALUE[ch] ?? 0
    }
  }
  const diff = whiteCp - blackCp
  const pawns = diff / 100
  let description: string
  if (Math.abs(pawns) < 0.5) description = 'материал равный'
  else if (pawns >= 5) description = 'у белых лишняя фигура или больше'
  else if (pawns >= 2) description = `у белых перевес в ${pawns.toFixed(1)} пешки`
  else if (pawns >= 0.5) description = 'у белых лёгкое преимущество'
  else if (pawns > -2) description = 'у чёрных лёгкое преимущество'
  else if (pawns > -5) description = `у чёрных перевес в ${Math.abs(pawns).toFixed(1)} пешки`
  else description = 'у чёрных лишняя фигура или больше'
  return { pawns, description }
}

// ---------------------------------------------------------------------------
// Captured piece labels — chess.js gives us single letters.
// ---------------------------------------------------------------------------

const PIECE_NAME: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

export function pieceName(letter: string | undefined | null): string | null {
  if (!letter) return null
  return PIECE_NAME[letter.toLowerCase()] ?? null
}
