import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { createEngine, difficultyForElo, type Engine } from './engine'
import type { TableConfig } from '../scene/tables'

interface Props {
  opponent: TableConfig
  onResult: (result: 'win' | 'loss' | 'draw' | 'aborted', detail: string) => void
}

interface PieceDropArgs {
  sourceSquare: string
  targetSquare: string | null
  piece?: unknown
}

export function ChessBoardView({ opponent, onResult }: Props) {
  const chessRef = useRef(new Chess())
  const engineRef = useRef<Engine | null>(null)
  const [fen, setFen] = useState(chessRef.current.fen())
  const [thinking, setThinking] = useState(false)
  const [status, setStatus] = useState<string>('Your move')
  const difficulty = useMemo(() => difficultyForElo(opponent.elo), [opponent.elo])

  useEffect(() => {
    const engine = createEngine()
    engineRef.current = engine
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  function checkGameOver(): boolean {
    const chess = chessRef.current
    if (chess.isCheckmate()) {
      const playerWon = chess.turn() === 'b'
      setStatus(playerWon ? 'Checkmate. You win.' : 'Checkmate. You lose.')
      onResult(playerWon ? 'win' : 'loss', playerWon ? 'Checkmate by player' : 'Checkmate by AI')
      return true
    }
    if (chess.isStalemate()) {
      setStatus('Stalemate.')
      onResult('draw', 'Stalemate')
      return true
    }
    if (chess.isDraw()) {
      setStatus('Draw.')
      onResult('draw', 'Draw')
      return true
    }
    return false
  }

  function triggerAIMove() {
    const engine = engineRef.current
    if (!engine) return
    setThinking(true)
    setStatus(`${opponent.label} is thinking...`)
    engine.findMove(
      chessRef.current.fen(),
      { depth: difficulty.depth, skill: difficulty.skill, movetime: difficulty.movetime },
      (move) => {
        if (!move) {
          setThinking(false)
          if (!checkGameOver()) setStatus('Engine returned no move')
          return
        }
        try {
          const result = chessRef.current.move({
            from: move.slice(0, 2) as Square,
            to: move.slice(2, 4) as Square,
            promotion: move.length >= 5 ? (move[4] as 'q' | 'r' | 'b' | 'n') : 'q',
          })
          if (!result) {
            setThinking(false)
            return
          }
          setFen(chessRef.current.fen())
          setThinking(false)
          if (!checkGameOver()) setStatus('Your move')
        } catch (err) {
          console.error('Failed to apply AI move', err)
          setThinking(false)
        }
      },
    )
  }

  function handlePieceDrop({ sourceSquare, targetSquare }: PieceDropArgs): boolean {
    if (!targetSquare || thinking) return false
    if (chessRef.current.isGameOver()) return false
    try {
      const move = chessRef.current.move({
        from: sourceSquare as Square,
        to: targetSquare as Square,
        promotion: 'q',
      })
      if (!move) return false
      setFen(chessRef.current.fen())
      if (!checkGameOver()) {
        setTimeout(triggerAIMove, 250)
      }
      return true
    } catch {
      return false
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start w-full">
      <div className="w-full md:w-[460px] aspect-square shrink-0 rounded-lg overflow-hidden shadow-2xl ring-1 ring-amber-500/20">
        <Chessboard
          options={{
            position: fen,
            onPieceDrop: handlePieceDrop,
            boardOrientation: 'white',
            id: 'main-board',
          }}
        />
      </div>

      <div className="flex-1 min-w-[260px] flex flex-col gap-4">
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-lg p-4">
          <p className="text-amber-400/70 text-xs uppercase tracking-widest mb-1">
            Opponent
          </p>
          <h3 className="text-2xl font-display font-bold text-amber-300">
            {opponent.label}
          </h3>
          <p className="text-neutral-400 text-sm italic mt-1">{opponent.bio}</p>
          <p className="text-neutral-500 text-xs mt-2">
            ELO {opponent.elo} · Skill {difficulty.skill} · Depth {difficulty.depth}
          </p>
        </div>

        <div className="bg-neutral-900/70 border border-neutral-800 rounded-lg p-4 min-h-[120px]">
          <p className="text-amber-400/70 text-xs uppercase tracking-widest mb-2">
            Live commentary
          </p>
          <p className="text-neutral-300 text-sm leading-relaxed">
            {thinking ? 'engine cooking...' : status}
          </p>
        </div>
      </div>
    </div>
  )
}
