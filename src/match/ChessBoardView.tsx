import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Move, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { createEngine, difficultyForElo, type Engine } from './engine'
import type { TableConfig } from '../scene/tables'
import { Commentator, type MoveTrigger } from '../llm/commentator'

interface Props {
  opponent: TableConfig
  onResult: (result: 'win' | 'loss' | 'draw' | 'aborted', detail: string) => void
}

interface PieceDropArgs {
  sourceSquare: string
  targetSquare: string | null
  piece?: unknown
}

function triggerForMove(move: Move, side: 'player' | 'ai'): MoveTrigger {
  const isCheck = move.san.includes('+') || move.san.includes('#')
  const isCapture = !!move.captured
  if (side === 'player') {
    if (isCapture) return 'player-capture'
    if (isCheck) return 'player-check'
    return 'player-move'
  }
  if (isCapture) return 'ai-capture'
  if (isCheck) return 'ai-check'
  return 'ai-move'
}

export function ChessBoardView({ opponent, onResult }: Props) {
  const chessRef = useRef(new Chess())
  const engineRef = useRef<Engine | null>(null)
  const commentatorRef = useRef<Commentator | null>(null)
  const [fen, setFen] = useState(chessRef.current.fen())
  const [thinking, setThinking] = useState(false)
  const [status, setStatus] = useState<string>('Your move')
  const [commentary, setCommentary] = useState<string>('')
  const [commentarySource, setCommentarySource] = useState<'idle' | 'llm' | 'fallback'>('idle')
  const difficulty = useMemo(() => difficultyForElo(opponent.elo), [opponent.elo])

  useEffect(() => {
    const engine = createEngine()
    engineRef.current = engine
    const commentator = new Commentator()
    commentatorRef.current = commentator

    // Opening line on mount
    triggerCommentary({
      trigger: 'opening',
      moveNumber: 0,
      totalMoves: 0,
      fenAfterMove: chessRef.current.fen(),
      recentHistory: [],
    })

    return () => {
      engine.dispose()
      engineRef.current = null
      commentator.cancel()
      commentatorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function triggerCommentary(ctx: {
    trigger: MoveTrigger
    moveSan?: string
    moveNumber: number
    totalMoves: number
    fenAfterMove: string
    recentHistory: string[]
  }) {
    const commentator = commentatorRef.current
    if (!commentator) return
    setCommentary('')
    setCommentarySource('idle')
    commentator.comment(opponent.id, ctx, {
      onToken: (token) => setCommentary((prev) => prev + token),
      onDone: (_full, source) => setCommentarySource(source),
      onError: () => {
        /* fallback runs automatically */
      },
    })
  }

  function buildCtx(move: Move | null, trigger: MoveTrigger) {
    const chess = chessRef.current
    const history = chess.history()
    const recent = history.slice(-8)
    return {
      trigger,
      moveSan: move?.san,
      moveNumber: history.length,
      totalMoves: history.length,
      fenAfterMove: chess.fen(),
      recentHistory: recent,
    }
  }

  function checkGameOver(): boolean {
    const chess = chessRef.current
    if (chess.isCheckmate()) {
      const playerWon = chess.turn() === 'b'
      setStatus(playerWon ? 'Checkmate. You win.' : 'Checkmate. You lose.')
      triggerCommentary(buildCtx(null, playerWon ? 'player-wins' : 'ai-wins'))
      onResult(playerWon ? 'win' : 'loss', playerWon ? 'Checkmate by player' : 'Checkmate by AI')
      return true
    }
    if (chess.isStalemate()) {
      setStatus('Stalemate.')
      triggerCommentary(buildCtx(null, 'draw'))
      onResult('draw', 'Stalemate')
      return true
    }
    if (chess.isDraw()) {
      setStatus('Draw.')
      triggerCommentary(buildCtx(null, 'draw'))
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
          if (!checkGameOver()) {
            setStatus('Your move')
            triggerCommentary(buildCtx(result, triggerForMove(result, 'ai')))
          }
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
      triggerCommentary(buildCtx(move, triggerForMove(move, 'player')))
      if (!checkGameOver()) {
        setTimeout(triggerAIMove, 700)
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

        <div className="bg-neutral-900/70 border border-neutral-800 rounded-lg p-4 min-h-[140px]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-amber-400/70 text-xs uppercase tracking-widest">
              Live commentary
            </p>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                commentarySource === 'llm'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : commentarySource === 'fallback'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-neutral-700/40 text-neutral-400'
              }`}
            >
              {commentarySource === 'llm'
                ? 'AI'
                : commentarySource === 'fallback'
                ? 'offline'
                : '...'}
            </span>
          </div>
          {commentary ? (
            <p className="text-amber-100 text-sm leading-relaxed font-medium">
              {commentary}
              {commentarySource === 'idle' && (
                <span className="inline-block w-1.5 h-3.5 bg-amber-300 ml-0.5 align-middle animate-pulse" />
              )}
            </p>
          ) : (
            <p className="text-neutral-500 text-sm italic">
              {thinking ? `${opponent.label} is thinking...` : status}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
