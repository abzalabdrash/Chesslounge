import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Move, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { createEngine, difficultyForElo, type Engine } from './engine'
import type { TableConfig } from '../scene/tables'
import { Commentator, type MoveTrigger } from '../llm/commentator'
import { SoundManager } from '../ui/SoundManager'
import { MoveList } from './MoveList'
import { ReplayControls } from './ReplayControls'
import { getSquareHighlights, pieceBelongsTo } from './chessUx'

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

export function ChessBoardView({ opponent, onResult }: Props) {
  const chessRef = useRef(new Chess())
  const engineRef = useRef<Engine | null>(null)
  const commentatorRef = useRef<Commentator | null>(null)

  // Live game state
  const [liveFen, setLiveFen] = useState(STARTING_FEN)
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

  // Cache legal moves from `selected` for highlight markers.
  const legalMoves = useMemo(() => {
    if (!selected || !isLiveView) return [] as Move[]
    try {
      return new Chess(liveFen).moves({ square: selected, verbose: true }) as Move[]
    } catch {
      return [] as Move[]
    }
  }, [selected, isLiveView, liveFen])

  const legalTargets = useMemo(() => new Set(legalMoves.map((m) => m.to)), [legalMoves])

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
      onResult(playerWon ? 'win' : 'loss', playerWon ? 'Checkmate by player' : `Checkmate by ${opponent.label}`)
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
      if (legalTargets.has(square as Square)) {
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
      styles[lastMove.from] = {
        background:
          'linear-gradient(135deg, rgba(253, 224, 71, 0.26), rgba(217, 119, 6, 0.26))',
        boxShadow: 'inset 0 0 0 2px rgba(251, 191, 36, 0.34)',
      }
      styles[lastMove.to] = {
        background:
          'linear-gradient(135deg, rgba(253, 224, 71, 0.34), rgba(217, 119, 6, 0.34))',
        boxShadow: 'inset 0 0 0 2px rgba(251, 191, 36, 0.46)',
      }
    }

    if (isLiveView) {
      const highlights = getSquareHighlights(liveFen, selected, legalMoves)
      for (const [sq, kind] of Object.entries(highlights)) {
        if (kind === 'selected') {
          styles[sq] = {
            ...(styles[sq] ?? {}),
            background:
              'radial-gradient(circle at 50% 52%, rgba(251, 191, 36, 0.32), rgba(20, 184, 166, 0.12) 58%, transparent 72%)',
            boxShadow: 'inset 0 0 0 3px rgba(250, 204, 21, 0.78)',
          }
        } else if (kind === 'capture') {
          styles[sq] = {
            ...(styles[sq] ?? {}),
            background:
              'radial-gradient(circle, transparent 52%, rgba(244, 114, 182, 0.74) 55%, rgba(251, 191, 36, 0.32) 70%, transparent 73%)',
          }
        } else {
          styles[sq] = {
            ...(styles[sq] ?? {}),
            background:
              'radial-gradient(circle, rgba(34, 211, 238, 0.78) 0 12%, rgba(251, 191, 36, 0.32) 13% 20%, transparent 21%)',
          }
        }
      }
    }

    if (premove && isLiveView) {
      styles[premove.from] = {
        ...(styles[premove.from] ?? {}),
        background: 'rgba(99, 102, 241, 0.55)',
        boxShadow:
          'inset 0 0 0 3px rgba(165, 180, 252, 0.9), inset 0 0 22px rgba(129, 140, 248, 0.35)',
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
        const liveGame = new Chess(liveFen)
        if (liveGame.inCheck()) {
          const turn = liveGame.turn()
          const board = liveGame.board()
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
  }, [lastMove, selected, legalMoves, premove, isLiveView, liveFen])

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
    <div className="flex flex-col xl:flex-row gap-5 items-start w-full">
      <div className="w-full xl:w-[560px] shrink-0">
        <div className="relative rounded-lg border border-amber-300/25 bg-[radial-gradient(circle_at_50%_20%,rgba(245,158,11,0.20),transparent_44%),linear-gradient(135deg,rgba(28,18,12,0.96),rgba(8,10,14,0.96))] p-3 shadow-2xl shadow-black/60">
          <div className="absolute inset-3 rounded-md bg-[url('/boards/wikimedia-chessboard480.svg')] bg-cover opacity-[0.08] mix-blend-screen pointer-events-none" />
          <div className="relative aspect-square overflow-hidden rounded-md ring-1 ring-black/70 shadow-[0_18px_55px_rgba(0,0,0,0.55)]">
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
                boardStyle: {
                  borderRadius: '6px',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                },
                lightSquareStyle: {
                  background:
                    'linear-gradient(135deg, rgba(234, 211, 164, 0.98), rgba(196, 157, 98, 0.98))',
                },
                darkSquareStyle: {
                  background:
                    'linear-gradient(135deg, rgba(93, 76, 57, 0.98), rgba(42, 54, 62, 0.98))',
                },
                dropSquareStyle: {
                  boxShadow: 'inset 0 0 0 4px rgba(34, 211, 238, 0.45)',
                },
                draggingPieceStyle: {
                  transform: 'scale(1)',
                  filter: 'drop-shadow(0 12px 14px rgba(0,0,0,0.38))',
                },
                draggingPieceGhostStyle: {
                  opacity: 0,
                },
                darkSquareNotationStyle: {
                  color: 'rgba(234, 211, 164, 0.78)',
                  fontWeight: 700,
                },
                lightSquareNotationStyle: {
                  color: 'rgba(67, 54, 41, 0.62)',
                  fontWeight: 700,
                },
                alphaNotationStyle: { fontSize: '0.74rem' },
                numericNotationStyle: { fontSize: '0.74rem' },
                id: 'main-board',
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-[280px] flex flex-col gap-3">
        <div className="bg-neutral-950/62 backdrop-blur-md border border-white/10 rounded-lg p-4 shadow-lg shadow-black/30">
          <p className="text-amber-400/70 text-xs uppercase tracking-widest mb-1">Opponent</p>
          <h3 className="text-2xl font-display font-bold text-amber-300">{opponent.label}</h3>
          <p className="text-neutral-400 text-sm italic mt-1">{opponent.bio}</p>
          <p className="text-neutral-500 text-xs mt-2">
            ELO {opponent.elo} · Skill {difficulty.skill} · Depth {difficulty.depth}
          </p>
        </div>

        <div className="bg-neutral-950/62 backdrop-blur-md border border-white/10 rounded-lg p-4 min-h-[120px] shadow-lg shadow-black/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-amber-400/70 text-xs uppercase tracking-widest">Table voice</p>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                commentarySource === 'llm'
                  ? 'bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.8)]'
                  : commentarySource === 'fallback'
                  ? 'bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.65)]'
                  : 'bg-neutral-500'
              }`}
              title={
                commentarySource === 'llm'
                  ? 'Streaming persona voice'
                  : commentarySource === 'fallback'
                  ? 'Persona fallback voice'
                  : 'Waiting'
              }
            />
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
            <p className="text-indigo-200 text-[11px] mt-2 font-mono">
              queued: {premove.from} to {premove.to} · right-click cancels
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
