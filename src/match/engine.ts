export interface FindMoveOptions {
  depth?: number
  skill?: number
  movetime?: number
}

export interface Engine {
  findMove: (fen: string, opts: FindMoveOptions, cb: (move: string | null) => void) => void
  dispose: () => void
}

export function createEngine(): Engine {
  let worker: Worker | null = null
  let currentCallback: ((move: string | null) => void) | null = null
  let configuredSkill = -1

  try {
    worker = new Worker('/stockfish/stockfish.js')
  } catch (err) {
    console.error('Stockfish worker failed to load', err)
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
    worker.onerror = (err) => {
      console.error('Stockfish error', err)
    }
    worker.postMessage('uci')
    worker.postMessage('isready')
  }

  return {
    findMove(fen, opts, cb) {
      if (!worker) {
        cb(null)
        return
      }
      currentCallback = cb
      const skill = Math.max(0, Math.min(20, opts.skill ?? 12))
      if (skill !== configuredSkill) {
        worker.postMessage(`setoption name Skill Level value ${skill}`)
        configuredSkill = skill
      }
      worker.postMessage('position fen ' + fen)
      if (opts.movetime) {
        worker.postMessage(`go movetime ${opts.movetime}`)
      } else {
        worker.postMessage(`go depth ${opts.depth ?? 12}`)
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

// Persona difficulty knobs — derived from ELO bands.
export interface PersonaDifficulty {
  skill: number
  depth: number
  movetime: number
}

export function difficultyForElo(elo: number): PersonaDifficulty {
  if (elo >= 2300) return { skill: 20, depth: 16, movetime: 1500 }
  if (elo >= 1850) return { skill: 14, depth: 12, movetime: 900 }
  return { skill: 8, depth: 8, movetime: 500 }
}
