// Stockfish engine wrapper. Two flavors:
// - createPlayingEngine: throttled by UCI_Elo so the bot actually plays at the
//   advertised rating (chess.com-style "1700 plays like 1700, not like 3000").
// - createEvalEngine: a second Stockfish worker dedicated to position analysis.
//   It runs MultiPV=1 at a fixed depth and reports centipawn / mate scores
//   plus the engine's best move. We use this to classify each ply (Best /
//   Inaccuracy / Mistake / Blunder / Brilliant) and to feed the commentator
//   real facts instead of letting the LLM hallucinate from a raw FEN.

const STOCKFISH_URL = '/stockfish/stockfish.js'

// Stockfish's UCI_Elo range. Older Multi-variant builds clamp to 1320..3190.
const MIN_ELO = 1320
const MAX_ELO = 3190

function clampElo(elo: number): number {
  if (!Number.isFinite(elo)) return 1500
  return Math.round(Math.min(MAX_ELO, Math.max(MIN_ELO, elo)))
}

// ---------------------------------------------------------------------------
// Playing engine
// ---------------------------------------------------------------------------

export interface FindMoveOptions {
  movetime?: number
  depth?: number
}

export interface PlayingEngine {
  setElo: (elo: number) => void
  findMove: (fen: string, opts: FindMoveOptions, cb: (move: string | null) => void) => void
  dispose: () => void
}

export function createPlayingEngine(): PlayingEngine {
  let worker: Worker | null = null
  let currentCallback: ((move: string | null) => void) | null = null
  let configuredElo = -1
  let limitStrengthSet = false

  try {
    worker = new Worker(STOCKFISH_URL)
  } catch (err) {
    console.error('Stockfish playing worker failed to load', err)
  }

  if (worker) {
    worker.onmessage = (e: MessageEvent) => {
      const line: string = typeof e.data === 'string' ? e.data : ''
      if (line.startsWith('bestmove') && currentCallback) {
        const parts = line.split(/\s+/)
        const move = parts[1] && parts[1] !== '(none)' ? parts[1] : null
        const cb = currentCallback
        currentCallback = null
        cb(move)
      }
    }
    worker.onerror = (err) => console.error('Stockfish playing error', err)
    worker.postMessage('uci')
    worker.postMessage('isready')
  }

  return {
    setElo(elo) {
      if (!worker) return
      const target = clampElo(elo)
      if (target === configuredElo) return
      if (!limitStrengthSet) {
        worker.postMessage('setoption name UCI_LimitStrength value true')
        limitStrengthSet = true
      }
      worker.postMessage(`setoption name UCI_Elo value ${target}`)
      configuredElo = target
    },
    findMove(fen, opts, cb) {
      if (!worker) {
        cb(null)
        return
      }
      currentCallback = cb
      worker.postMessage('position fen ' + fen)
      if (opts.movetime) {
        worker.postMessage(`go movetime ${opts.movetime}`)
      } else {
        worker.postMessage(`go depth ${opts.depth ?? 14}`)
      }
    },
    dispose() {
      if (worker) {
        worker.terminate()
        worker = null
      }
    },
  }
}

// Persona timing knobs. Strength itself comes from UCI_Elo, but we still
// modulate thinking time so weaker bots feel snappy and the GM feels deliberate.
export interface PlayingProfile {
  movetime: number
  depth: number
}

export function profileForElo(elo: number): PlayingProfile {
  if (elo >= 2300) return { movetime: 1400, depth: 18 }
  if (elo >= 1850) return { movetime: 900, depth: 14 }
  return { movetime: 500, depth: 10 }
}

// ---------------------------------------------------------------------------
// Evaluation engine (chess.com-style analysis)
// ---------------------------------------------------------------------------

export interface EvalScore {
  /** Centipawns from white's perspective. +100 = white is up ~1 pawn. */
  cp: number | null
  /** Mate-in-N from white's perspective, signed. +3 = white mates in 3. */
  mate: number | null
  /** Engine's preferred move from this position, UCI notation (e2e4 / e7e8q). */
  bestMove: string | null
  /** Side to move at the analysed position. */
  sideToMove: 'w' | 'b'
}

export interface EvalEngine {
  /**
   * Evaluate a position. Resolves with the score from WHITE's perspective.
   * Returns null only if the worker failed to boot.
   */
  evaluate: (fen: string, depth?: number) => Promise<EvalScore | null>
  dispose: () => void
}

interface PendingEval {
  resolve: (score: EvalScore) => void
  sideToMove: 'w' | 'b'
  latestCp: number | null
  latestMate: number | null
  latestBest: string | null
}

export function createEvalEngine(): EvalEngine {
  let worker: Worker | null = null
  let pending: PendingEval | null = null
  let queue: Array<() => void> = []
  let busy = false

  try {
    worker = new Worker(STOCKFISH_URL)
  } catch (err) {
    console.error('Stockfish eval worker failed to load', err)
  }

  if (worker) {
    worker.onmessage = (e: MessageEvent) => {
      const line: string = typeof e.data === 'string' ? e.data : ''
      if (!pending) return

      if (line.startsWith('info')) {
        // Only consume the deepest "info" line with a score before bestmove.
        const scoreMatch = line.match(/score (cp|mate) (-?\d+)/)
        const pvMatch = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/)
        if (scoreMatch) {
          const fromWhite = pending.sideToMove === 'w' ? 1 : -1
          if (scoreMatch[1] === 'cp') {
            pending.latestCp = parseInt(scoreMatch[2], 10) * fromWhite
            pending.latestMate = null
          } else {
            pending.latestMate = parseInt(scoreMatch[2], 10) * fromWhite
            pending.latestCp = null
          }
        }
        if (pvMatch) pending.latestBest = pvMatch[1]
        return
      }

      if (line.startsWith('bestmove')) {
        const parts = line.split(/\s+/)
        const move = parts[1] && parts[1] !== '(none)' ? parts[1] : null
        const score: EvalScore = {
          cp: pending.latestCp,
          mate: pending.latestMate,
          bestMove: pending.latestBest ?? move,
          sideToMove: pending.sideToMove,
        }
        const resolve = pending.resolve
        pending = null
        busy = false
        resolve(score)
        const next = queue.shift()
        if (next) next()
      }
    }
    worker.onerror = (err) => console.error('Stockfish eval error', err)
    worker.postMessage('uci')
    worker.postMessage('setoption name MultiPV value 1')
    worker.postMessage('isready')
  }

  function run(fen: string, depth: number): Promise<EvalScore | null> {
    return new Promise((resolve) => {
      if (!worker) {
        resolve(null)
        return
      }
      const sideToMove = fen.split(' ')[1] === 'b' ? 'b' : 'w'
      pending = {
        resolve,
        sideToMove,
        latestCp: null,
        latestMate: null,
        latestBest: null,
      }
      busy = true
      worker.postMessage('position fen ' + fen)
      worker.postMessage(`go depth ${depth}`)
    })
  }

  return {
    evaluate(fen, depth = 12) {
      if (busy) {
        return new Promise((resolve) => {
          queue.push(() => {
            run(fen, depth).then(resolve)
          })
        })
      }
      return run(fen, depth)
    },
    dispose() {
      if (worker) {
        worker.terminate()
        worker = null
      }
      queue = []
      pending = null
    },
  }
}
