import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Move, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { createEngine, difficultyForElo, type Engine } from './engine'
import type { TableConfig } from '../scene/tables'
import { Commentator, type MoveTrigger } from '../llm/commentator'
import { SoundManager } from '../ui/SoundManager'
import { MoveList } from './MoveList'
import { ReplayControls } from './ReplayControls'

interface Props {
  opponent: TableConfig
  onResult: (result: 'win' | 'loss' | 'draw' | 'aborted', detail: string) => void
}

interface PieceDropArgs {
  sourceSquare: string
  targetSquare: string | null
  piece?: { pieceType?: string }
}

interface SquareClickArgs {
  piece: { pieceType?: string } | null
  square: string
}

interface PieceHandlerArgs {
  isSparePiece: boolean
  piece: { pieceType?: string }
  square: string | null
}

interface Premove {
  from: Square
  to: Square
  promotion: 'q'
}

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

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

function playMoveSound(move: Move) {
  if (move.san.includes('#')) {
    SoundManager.play('checkmate')
    return
  }
  if (move.san.includes('+')) {
    SoundManager.play('check')
    return
  }
  if (move.captured) {
    SoundManager.play('capture')
    return
  }
  SoundManager.play('move')
}

/** True if piece at sourceSquare belongs to `side` in `fen`. */
function pieceBelongsTo(fen: string, square: string, side: 'w' | 'b'): boolean {
  try {
    const probe = new Chess(fen)
    const p = probe.get(square as Square)
    return !!p && p.color === side
  } catch {
    return false
  }
}

export function ChessBoardView({ opponent, onResult }: Props) {
  const chessRef = useRef(new Chess())
  const engineRef = useRef<Engine | null>(null)
  const commentatorRef = useRef<Commentator | null>(null)

  // Live game state
  const [liveFen, setLiveFen] = useState(chessRef.current.fen())
  const [history, setHistory] = useState<Move[]>([])
  const [thinking, setThinking] = useState(false)
  const [status, setStatus] = useState<string>('Your move')
  const [lastMove, setLastMove] = useState<Move | null>(null)
  const [gameOver, setGameOver] = useState(false)

  // UX state
  const [selected, setSelected] = useState<Square | null>(null)
  const [premove, setPremove] = useState<Premove | null>(null)
  const [viewPly, setViewPly] = useState<number | null>(null)

  // Commentary state
  const [commentary, setCommentary] = useState<string>('')
  const [commentarySource, setCommentarySource] = useState<'idle' | 'llm' | 'fallback'>('idle')

  const difficulty = useMemo(() => difficultyForElo(opponent.elo), [opponent.elo])

  const totalPlies = history.length
  const isLiveView = viewPly === null || viewPly === totalPlies

  const displayFen = useMemo(() => {
    if (viewPly === null || viewPly === totalPlies) return liveFen
    if (viewPly === 0) return STARTING_FEN
    return history[viewPly - 1].after
  }, [viewPly, totalPlies, liveFen, history])

  // Cache legal moves from `selected` for highlight dots
  const legalTargets = useMemo(() => {
    if (!selected || !isLiveView) return new Set<string>()
    try {
      const moves = chessRef.current.moves({ square: selected, verbose: true }) as Move[]
      return new Set(moves.map((m) => m.to))
    } catch {
      return new Set<string>()
    }
  }, [selected, isLiveView, liveFen])

  // ---------- Commentary ----------
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
      onToken: (t) => setCommentary((prev) => prev + t),
      onDone: (_full, source) => setCommentarySource(source),
      onError: () => {},
    })
  }

  function buildCtx(move: Move | null, trigger: MoveTrigger) {
    const chess = chessRef.current
    const recent = chess.history().slice(-8)
    return {
      trigger,
      moveSan: move?.san,
      moveNumber: chess.history().length,
      totalMoves: chess.history().length,
      fenAfterMove: chess.fen(),
      recentHistory: recent,
    }
  }

  // ---------- Boot ----------
  useEffect(() => {
    const engine = createEngine()
    engineRef.current = engine
    const commentator = new Commentator()
    commentatorRef.current = commentator

    SoundManager.preload()
    SoundManager.play('game-start')

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

  // ---------- Game over check ----------
  function checkGameOver(): boolean {
    const chess = chessRef.current
    if (chess.isCheckmate()) {
      const playerWon = chess.turn() === 'b'
      setStatus(playerWon ? 'Checkmate. You win.' : 'Checkmate. You lose.')
      setGameOver(true)
      triggerCommentary(buildCtx(null, playerWon ? 'player-wins' : 'ai-wins'))
      onResult(playerWon ? 'win' : 'loss', playerWon ? 'Checkmate by player' : 'Checkmate by AI')
      return true
    }
    if (chess.isStalemate()) {
      setStatus('Stalemate.')
      setGameOver(true)
      triggerCommentary(buildCtx(null, 'draw'))
      onResult('draw', 'Stalemate')
      return true
    }
    if (chess.isDraw()) {
      setStatus('Draw.')
      setGameOver(true)
      triggerCommentary(buildCtx(null, 'draw'))
      onResult('draw', 'Draw')
      return true
    }
    return false
  }

  // ---------- Apply player move (called from drop or click) ----------
  const applyPlayerMove = useCallback(
    (from: Square, to: Square, promotion: 'q' = 'q'): boolean => {
      if (thinking || gameOver) return false
      if (!isLiveView) {
        // Scrubbed back; snap to live then ignore this move
        setViewPly(null)
        return false
      }
      try {
        const move = chessRef.current.move({ from, to, promotion })
        if (!move) return false
        setLiveFen(chessRef.current.fen())
        setHistory(chessRef.current.history({ verbose: true }) as Move[])
        setLastMove(move)
        setSelected(null)
        playMoveSound(move)
        triggerCommentary(buildCtx(move, triggerForMove(move, 'player')))
        if (!checkGameOver()) {
          setTimeout(triggerAIMove, 700)
        }
        return true
      } catch {
        return false
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thinking, gameOver, isLiveView],
  )

  // ---------- Trigger AI ----------
  const triggerAIMove = useCallback(() => {
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
          setLiveFen(chessRef.current.fen())
          setHistory(chessRef.current.history({ verbose: true }) as Move[])
          setLastMove(result)
          setThinking(false)
          playMoveSound(result)
          if (checkGameOver()) {
            setPremove(null)
            return
          }
          setStatus('Your move')
          triggerCommentary(buildCtx(result, triggerForMove(result, 'ai')))

          // Try premove
          const pm = premoveRef.current
          if (pm) {
            premoveRef.current = null
            setPremove(null)
            try {
              const pmRes = chessRef.current.move({ from: pm.from, to: pm.to, promotion: pm.promotion })
              if (pmRes) {
                setLiveFen(chessRef.current.fen())
                setHistory(chessRef.current.history({ verbose: true }) as Move[])
                setLastMove(pmRes)
                playMoveSound(pmRes)
                triggerCommentary(buildCtx(pmRes, triggerForMove(pmRes, 'player')))
                if (!checkGameOver()) {
                  setTimeout(triggerAIMove, 700)
                }
              }
            } catch {
              /* premove illegal — silently discard */
            }
          }
        } catch (err) {
          console.error('Failed to apply AI move', err)
          setThinking(false)
        }
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty.depth, difficulty.skill, difficulty.movetime, opponent.label])

  // Keep latest premove in a ref so triggerAIMove sees it without re-binding
  const premoveRef = useRef<Premove | null>(null)
  useEffect(() => {
    premoveRef.current = premove
  }, [premove])

  // ---------- Drag handler ----------
  function handlePieceDrop({ sourceSquare, targetSquare }: PieceDropArgs): boolean {
    if (!targetSquare) return false
    if (gameOver) return false
    if (!isLiveView) {
      setViewPly(null)
      return false
    }
    // AI is thinking — queue a premove if source is a player piece
    if (thinking) {
      if (pieceBelongsTo(liveFen, sourceSquare, 'w')) {
        setPremove({ from: sourceSquare as Square, to: targetSquare as Square, promotion: 'q' })
        // snap piece back to source; premove is shown via squareStyles overlay
        return false
      }
      return false
    }
    return applyPlayerMove(sourceSquare as Square, targetSquare as Square)
  }

  // ---------- Click handler ----------
  function handleSquareClick({ square }: SquareClickArgs) {
    if (gameOver) return
    if (!isLiveView) {
      setViewPly(null)
      return
    }
    if (thinking) {
      // Two-click premove: if a piece already selected and target clicked, set premove
      if (selected && square !== selected) {
        if (pieceBelongsTo(liveFen, selected, 'w')) {
          setPremove({ from: selected, to: square as Square, promotion: 'q' })
          setSelected(null)
          return
        }
      }
      if (pieceBelongsTo(liveFen, square, 'w')) {
        setSelected(square as Square)
      } else {
        setSelected(null)
      }
      return
    }
    // Live + player's turn
    if (selected) {
      if (square === selected) {
        setSelected(null)
        return
      }
      if (legalTargets.has(square)) {
        applyPlayerMove(selected, square as Square)
        return
      }
      // re-select if friendly piece clicked
      if (pieceBelongsTo(liveFen, square, 'w')) {
        setSelected(square as Square)
        return
      }
      setSelected(null)
      return
    }
    if (pieceBelongsTo(liveFen, square, 'w')) {
      setSelected(square as Square)
    }
  }

  // Right-click clears premove / selection
  function handleSquareRightClick() {
    if (premove) {
      setPremove(null)
      return
    }
    setSelected(null)
  }

  // ---------- Square styles ----------
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}

    if (lastMove && isLiveView) {
      styles[lastMove.from] = { background: 'rgba(251, 191, 36, 0.32)' }
      styles[lastMove.to] = { background: 'rgba(251, 191, 36, 0.45)' }
    }

    if (selected && isLiveView) {
      styles[selected] = {
        background: 'rgba(250, 204, 21, 0.55)',
        boxShadow: 'inset 0 0 0 3px rgba(253, 224, 71, 0.85)',
      }
    }

    if (isLiveView) {
      for (const sq of legalTargets) {
        const occupied = chessRef.current.get(sq as Square)
        styles[sq] = {
          ...(styles[sq] ?? {}),
          background: occupied
            ? 'radial-gradient(circle, transparent 60%, rgba(220, 38, 38, 0.55) 62%)'
            : 'radial-gradient(circle, rgba(34, 197, 94, 0.55) 18%, transparent 22%)',
        }
      }
    }

    if (premove && isLiveView) {
      styles[premove.from] = {
        ...(styles[premove.from] ?? {}),
        background: 'rgba(99, 102, 241, 0.55)',
        boxShadow: 'inset 0 0 0 3px rgba(165, 180, 252, 0.9)',
      }
      styles[premove.to] = {
        ...(styles[premove.to] ?? {}),
        background: 'rgba(99, 102, 241, 0.4)',
        boxShadow: 'inset 0 0 0 3px rgba(165, 180, 252, 0.7)',
      }
    }

    // Check indicator
    if (isLiveView) {
      try {
        if (chessRef.current.inCheck()) {
          const turn = chessRef.current.turn()
          const board = chessRef.current.board()
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              const p = board[r][c]
              if (p && p.type === 'k' && p.color === turn) {
                styles[p.square] = {
                  ...(styles[p.square] ?? {}),
                  background:
                    'radial-gradient(circle, rgba(239, 68, 68, 0.85) 0%, rgba(239, 68, 68, 0.0) 70%)',
                }
              }
            }
          }
        }
      } catch {
        /* noop */
      }
    }

    return styles
  }, [lastMove, selected, legalTargets, premove, isLiveView, liveFen])

  // ---------- Replay nav ----------
  const stepBack = useCallback(() => {
    setViewPly((vp) => {
      const cur = vp ?? totalPlies
      if (cur <= 0) return vp
      SoundManager.play('move')
      return cur - 1
    })
  }, [totalPlies])

  const stepForward = useCallback(() => {
    setViewPly((vp) => {
      const cur = vp ?? totalPlies
      if (cur >= totalPlies) return vp
      const next = cur + 1
      SoundManager.play('move')
      return next === totalPlies ? null : next
    })
  }, [totalPlies])

  const jumpStart = useCallback(() => {
    if (totalPlies === 0) return
    SoundManager.play('move')
    setViewPly(0)
  }, [totalPlies])

  const jumpLive = useCallback(() => {
    setViewPly(null)
    SoundManager.play('move')
  }, [])

  // Allow dragging player (white) pieces even during AI thinking (for premove)
  function canDragPiece({ piece }: PieceHandlerArgs): boolean {
    if (gameOver) return false
    if (!isLiveView) return false
    const t = piece.pieceType
    return !!t && t.startsWith('w')
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start w-full">
      <div className="w-full md:w-[460px] aspect-square shrink-0 rounded-lg overflow-hidden shadow-2xl ring-1 ring-amber-500/20">
        <Chessboard
          options={{
            position: displayFen,
            onPieceDrop: handlePieceDrop,
            onSquareClick: handleSquareClick,
            onSquareRightClick: handleSquareRightClick,
            squareStyles,
            canDragPiece,
            boardOrientation: 'white',
            allowDrawingArrows: true,
            clearArrowsOnPositionChange: false,
            animationDurationInMs: 220,
            id: 'main-board',
          }}
        />
      </div>

      <div className="flex-1 min-w-[260px] flex flex-col gap-3">
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-lg p-4">
          <p className="text-amber-400/70 text-xs uppercase tracking-widest mb-1">Opponent</p>
          <h3 className="text-2xl font-display font-bold text-amber-300">{opponent.label}</h3>
          <p className="text-neutral-400 text-sm italic mt-1">{opponent.bio}</p>
          <p className="text-neutral-500 text-xs mt-2">
            ELO {opponent.elo} · Skill {difficulty.skill} · Depth {difficulty.depth}
          </p>
        </div>

        <div className="bg-neutral-900/70 border border-neutral-800 rounded-lg p-4 min-h-[120px]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-amber-400/70 text-xs uppercase tracking-widest">Live commentary</p>
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
          {premove && (
            <p className="text-indigo-300 text-[11px] mt-2 font-mono">
              Premove queued: {premove.from} → {premove.to} (right-click to cancel)
            </p>
          )}
        </div>

        <MoveList
          history={history}
          viewPly={viewPly}
          onPick={(ply) => setViewPly(ply === totalPlies ? null : ply)}
        />

        <ReplayControls
          viewPly={viewPly}
          totalPlies={totalPlies}
          onStepBack={stepBack}
          onStepForward={stepForward}
          onJumpStart={jumpStart}
          onJumpLive={jumpLive}
        />
      </div>
    </div>
  )
}
