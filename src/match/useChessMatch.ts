import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Move, type Square } from 'chess.js'
import {
  createEvalEngine,
  createPlayingEngine,
  profileForElo,
  type EvalEngine,
  type EvalScore,
  type PlayingEngine,
} from './engine'
import {
  classifyMove,
  materialDiff,
  summarize,
  type MoveAnalysis,
  type SideSummary,
} from './analysis'
import type { TableConfig } from '../scene/tables'
import { Commentator, shouldComment, type MoveTrigger } from '../llm/commentator'
import { SoundManager } from '../ui/SoundManager'
import { getSquareHighlights, pieceBelongsTo, type SquareHighlight } from './chessUx'

export interface Premove {
  from: Square
  to: Square
  promotion: 'q'
}

export interface MatchResult {
  outcome: 'win' | 'loss' | 'draw' | 'aborted'
  detail: string
}

export type CommentarySource = 'idle' | 'llm' | 'fallback'

export interface NpcReaction {
  key: string
  emoji: string
}

export interface ChessMatchController {
  active: boolean
  liveFen: string
  displayFen: string
  history: Move[]
  thinking: boolean
  status: string
  lastMove: Move | null
  gameOver: boolean
  selected: Square | null
  legalTargets: Set<string>
  squareHighlights: Record<string, SquareHighlight>
  premove: Premove | null
  commentary: string
  commentarySource: CommentarySource
  /** Persona ELO + thinking budget actually applied to Stockfish. */
  profile: ReturnType<typeof profileForElo> & { elo: number }
  /** Latest position eval, white's perspective. Drives the eval bar. */
  evalScore: EvalScore | null
  /** Chess.com-style classification of the most recent ply, if any. */
  lastAnalysis: MoveAnalysis | null
  /** Optional one-shot emoji reaction for the NPC bubble (capture / check / mate). */
  npcReaction: NpcReaction | null
  /** Per-side accuracy + classification counts for the post-game report. */
  summary: { player: SideSummary; opponent: SideSummary }
  viewPly: number | null
  totalPlies: number
  isLiveView: boolean
  applyPlayerMove: (from: Square, to: Square, promotion?: 'q') => boolean
  handleSquareClick: (square: Square) => void
  clearSelection: () => void
  setViewPly: (ply: number | null) => void
  stepBack: () => void
  stepForward: () => void
  jumpStart: () => void
  jumpLive: () => void
}

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const IDLE_PROFILE = profileForElo(1700)
const EVAL_DEPTH = 12
// Minimum spacing between non-decisive emoji bubbles. The NPC stays calm.
const REACTION_COOLDOWN_MS = 5000

/**
 * Map an event to a short emoji bubble. Returns null for quiet events so the
 * NPC stays silent and the screen isn't littered with cartoonish reactions.
 */
function emojiForTrigger(trigger: MoveTrigger, analysis: MoveAnalysis | null): string | null {
  switch (trigger) {
    case 'player-wins':
      return '😵'
    case 'ai-wins':
      return '😈'
    case 'draw':
      return '🤝'
    case 'player-blunder':
      return '😏'
    case 'ai-blunder':
      return '😱'
    case 'player-brilliant':
      return '🤯'
    case 'player-check':
    case 'ai-check':
      // Only flash on a check that actually shifted the eval (genuine threat),
      // never on routine "spite check" patterns.
      return analysis && analysis.cpLoss < 100 ? null : '😬'
    case 'player-capture':
    case 'ai-capture':
      // Only react to major captures (queens/rooks) — pawn trades are silent.
      return null
    default:
      return null
  }
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

/**
 * Pick the most informative trigger for a ply. Analysis-driven categories
 * (blunder / brilliant) outrank surface ones (capture / check) because the
 * persona reacts very differently to "you just hung your queen" vs "you took
 * a pawn".
 */
function triggerForMove(
  move: Move,
  side: 'player' | 'ai',
  analysis: MoveAnalysis | null,
): MoveTrigger {
  const cls = analysis?.classification
  if (side === 'player') {
    if (cls === 'blunder') return 'player-blunder'
    if (cls === 'brilliant' || cls === 'great') return 'player-brilliant'
  } else {
    if (cls === 'blunder') return 'ai-blunder'
  }
  const isCheck = move.san.includes('+') || move.san.includes('#')
  if (move.captured) return side === 'player' ? 'player-capture' : 'ai-capture'
  if (isCheck) return side === 'player' ? 'player-check' : 'ai-check'
  return side === 'player' ? 'player-move' : 'ai-move'
}

export function useChessMatch(
  opponent: TableConfig | undefined,
  onResult: (result: MatchResult) => void,
  resetKey = 0,
): ChessMatchController {
  const chessRef = useRef(new Chess())
  const engineRef = useRef<PlayingEngine | null>(null)
  const evalEngineRef = useRef<EvalEngine | null>(null)
  const commentatorRef = useRef<Commentator | null>(null)
  const premoveRef = useRef<Premove | null>(null)
  const triggerAIMoveRef = useRef<() => void>(() => {})
  // Eval of the position currently on the board, white's perspective.
  // Becomes the "evalBefore" for the next move played.
  const currentEvalRef = useRef<EvalScore | null>(null)
  // Move number (in plies) of the last persona reaction. Used by shouldComment
  // to space out ambient lines when the position is quiet.
  const lastCommentPlyRef = useRef(-99)
  const evalSeqRef = useRef(0)

  const [liveFen, setLiveFen] = useState(STARTING_FEN)
  const [history, setHistory] = useState<Move[]>([])
  const [thinking, setThinking] = useState(false)
  const [status, setStatus] = useState<string>('Your move')
  const [lastMove, setLastMove] = useState<Move | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [selected, setSelected] = useState<Square | null>(null)
  const [premove, setPremove] = useState<Premove | null>(null)
  const [viewPly, setViewPlyState] = useState<number | null>(null)
  const [commentary, setCommentary] = useState<string>('')
  const [commentarySource, setCommentarySource] = useState<CommentarySource>('idle')
  const [evalScore, setEvalScore] = useState<EvalScore | null>(null)
  const [lastAnalysis, setLastAnalysis] = useState<MoveAnalysis | null>(null)
  const [npcReaction, setNpcReaction] = useState<NpcReaction | null>(null)
  const [playerAnalyses, setPlayerAnalyses] = useState<MoveAnalysis[]>([])
  const [opponentAnalyses, setOpponentAnalyses] = useState<MoveAnalysis[]>([])
  const reactionTimeoutRef = useRef<number | null>(null)
  // Throttle the emoji bubble. We never want it to spam — at most one bubble
  // per REACTION_COOLDOWN_MS unless the event is decisive (mate / game-end /
  // blunder), in which case we always speak.
  const lastReactionAtRef = useRef(0)

  const active = !!opponent
  const profile = useMemo(
    () => (opponent ? { ...profileForElo(opponent.elo), elo: opponent.elo } : { ...IDLE_PROFILE, elo: 1700 }),
    [opponent],
  )
  const totalPlies = history.length
  const isLiveView = viewPly === null || viewPly === totalPlies
  const summary = useMemo(
    () => ({ player: summarize(playerAnalyses), opponent: summarize(opponentAnalyses) }),
    [playerAnalyses, opponentAnalyses],
  )

  const displayFen = useMemo(() => {
    if (viewPly === null || viewPly === totalPlies) return liveFen
    if (viewPly === 0) return STARTING_FEN
    return history[viewPly - 1]?.after ?? liveFen
  }, [viewPly, totalPlies, liveFen, history])

  const legalMoves = useMemo(() => {
    if (!selected || !isLiveView) return [] as Move[]
    try {
      return new Chess(liveFen).moves({ square: selected, verbose: true }) as Move[]
    } catch {
      return [] as Move[]
    }
  }, [selected, isLiveView, liveFen])

  const legalTargets = useMemo(() => new Set(legalMoves.map((m) => m.to)), [legalMoves])

  const squareHighlights = useMemo(
    () => (isLiveView ? getSquareHighlights(liveFen, selected, legalMoves) : {}),
    [isLiveView, liveFen, selected, legalMoves],
  )

  useEffect(() => {
    premoveRef.current = premove
  }, [premove])

  /**
   * Pop a single emoji bubble above the table for visual feedback. Auto-clears
   * after 2.2s. Each call replaces any in-flight reaction (latest wins).
   *
   * Strict cooldown: at most one bubble per REACTION_COOLDOWN_MS. Decisive
   * events (mate, game-end, blunder, brilliant) bypass the cooldown — those
   * are the moments where you really want to see the NPC's face change.
   */
  const triggerNpcReaction = useCallback((trigger: MoveTrigger, analysis: MoveAnalysis | null) => {
    const emoji = emojiForTrigger(trigger, analysis)
    if (!emoji) return
    const decisive =
      trigger === 'player-wins' ||
      trigger === 'ai-wins' ||
      trigger === 'draw' ||
      trigger === 'player-blunder' ||
      trigger === 'ai-blunder' ||
      trigger === 'player-brilliant'
    const now = Date.now()
    if (!decisive && now - lastReactionAtRef.current < REACTION_COOLDOWN_MS) return
    lastReactionAtRef.current = now
    setNpcReaction({ key: `${now}-${trigger}`, emoji })
    if (reactionTimeoutRef.current) window.clearTimeout(reactionTimeoutRef.current)
    reactionTimeoutRef.current = window.setTimeout(() => {
      setNpcReaction(null)
      reactionTimeoutRef.current = null
    }, 2200) as unknown as number
  }, [])

  const runCommentary = useCallback(
    (
      trigger: MoveTrigger,
      move: Move | null,
      analysis: MoveAnalysis | null,
      forceSpeak = false,
    ) => {
      if (!opponent) return
      const commentator = commentatorRef.current
      if (!commentator) return
      const chess = chessRef.current
      const isCheck = move ? move.san.includes('+') || move.san.includes('#') : false
      const isMate = move ? move.san.includes('#') : false
      const ply = chess.history().length
      const ctx = {
        trigger,
        moveSan: move?.san,
        moveNumber: ply,
        recentHistory: chess.history().slice(-8),
        capturedPiece: move?.captured ?? null,
        analysis,
        isCheck,
        isMate,
        materialDescription: materialDiff(chess.fen()).description,
        opponentLabel: opponent.label,
      }
      if (!forceSpeak && !shouldComment(ctx, lastCommentPlyRef.current)) return

      lastCommentPlyRef.current = ply
      setCommentary('')
      setCommentarySource('idle')
      commentator.comment(opponent.id, ctx, {
        onToken: (t) => setCommentary((prev) => prev + t),
        onDone: (_full, source) => setCommentarySource(source),
        onError: () => {},
      })
    },
    [opponent],
  )

  // Kick off a fresh eval of the live position. Updates currentEvalRef +
  // evalScore state. Discards stale runs if the player moved again.
  const refreshEval = useCallback(async () => {
    const evalEngine = evalEngineRef.current
    if (!evalEngine) return
    const seq = ++evalSeqRef.current
    const fen = chessRef.current.fen()
    const score = await evalEngine.evaluate(fen, EVAL_DEPTH)
    if (seq !== evalSeqRef.current) return
    if (score) {
      currentEvalRef.current = score
      setEvalScore(score)
    }
  }, [])

  useEffect(() => {
    chessRef.current = new Chess()
    setLiveFen(STARTING_FEN)
    setHistory([])
    setThinking(false)
    setStatus('Your move')
    setLastMove(null)
    setGameOver(false)
    setSelected(null)
    setPremove(null)
    setViewPlyState(null)
    setCommentary('')
    setCommentarySource('idle')
    setEvalScore(null)
    setLastAnalysis(null)
    setPlayerAnalyses([])
    setOpponentAnalyses([])
    currentEvalRef.current = null
    lastCommentPlyRef.current = -99

    if (!opponent) return

    const engine = createPlayingEngine()
    engine.setElo(opponent.elo)
    const evalEngine = createEvalEngine()
    const commentator = new Commentator()
    engineRef.current = engine
    evalEngineRef.current = evalEngine
    commentatorRef.current = commentator

    SoundManager.preload()
    SoundManager.play('game-start')

    // Opening greeting and initial eval kick off in parallel.
    commentator.comment(
      opponent.id,
      {
        trigger: 'opening',
        moveNumber: 0,
        recentHistory: [],
        opponentLabel: opponent.label,
      },
      {
        onToken: (t) => setCommentary((prev) => prev + t),
        onDone: (_full, source) => setCommentarySource(source),
        onError: () => {},
      },
    )
    lastCommentPlyRef.current = 0
    void refreshEval()

    return () => {
      engine.dispose()
      evalEngine.dispose()
      engineRef.current = null
      evalEngineRef.current = null
      commentator.cancel()
      commentatorRef.current = null
    }
  }, [opponent, resetKey, refreshEval])

  const checkGameOver = useCallback((): boolean => {
    if (!opponent) return false
    const chess = chessRef.current
    if (chess.isCheckmate()) {
      const playerWon = chess.turn() === 'b'
      setStatus(playerWon ? 'Checkmate. You win.' : 'Checkmate. You lose.')
      setGameOver(true)
      const winTrigger: MoveTrigger = playerWon ? 'player-wins' : 'ai-wins'
      triggerNpcReaction(winTrigger, null)
      runCommentary(winTrigger, null, null, true)
      onResult({
        outcome: playerWon ? 'win' : 'loss',
        detail: playerWon ? 'Checkmate by player' : `Checkmate by ${opponent.label}`,
      })
      return true
    }
    if (chess.isStalemate()) {
      setStatus('Stalemate.')
      setGameOver(true)
      triggerNpcReaction('draw', null)
      runCommentary('draw', null, null, true)
      onResult({ outcome: 'draw', detail: 'Stalemate' })
      return true
    }
    if (chess.isDraw()) {
      setStatus('Draw.')
      setGameOver(true)
      triggerNpcReaction('draw', null)
      runCommentary('draw', null, null, true)
      onResult({ outcome: 'draw', detail: 'Draw' })
      return true
    }
    return false
  }, [onResult, opponent, runCommentary, triggerNpcReaction])

  /**
   * After a move lands on the board:
   *  - re-evaluate the new position (this becomes the next "evalBefore")
   *  - classify the move that just happened against the prior eval
   *  - dispatch persona commentary if gating allows
   */
  const finalizeMove = useCallback(
    async (move: Move, fenBefore: string, side: 'player' | 'ai') => {
      const evalBefore = currentEvalRef.current
      const engineBestUci = evalBefore?.bestMove ?? null
      const seq = ++evalSeqRef.current
      const evalEngine = evalEngineRef.current
      let evalAfter: EvalScore | null = null
      if (evalEngine) {
        evalAfter = await evalEngine.evaluate(chessRef.current.fen(), EVAL_DEPTH)
      }
      if (seq !== evalSeqRef.current) return
      if (evalAfter) {
        currentEvalRef.current = evalAfter
        setEvalScore(evalAfter)
      }
      const analysis = classifyMove({
        move,
        fenBefore,
        evalBefore,
        evalAfter,
        engineBestUci,
        moveNumber: chessRef.current.history().length,
      })
      setLastAnalysis(analysis)
      // Skip "book" early moves from the accuracy tally so the player isn't
      // graded on their first 4 routine pawn pushes.
      const tallyable = analysis.classification !== 'book'
      if (tallyable) {
        if (side === 'player') setPlayerAnalyses((prev) => [...prev, analysis])
        else setOpponentAnalyses((prev) => [...prev, analysis])
      }
      const trigger = triggerForMove(move, side, analysis)
      triggerNpcReaction(trigger, analysis)
      runCommentary(trigger, move, analysis)
    },
    [runCommentary, triggerNpcReaction],
  )

  const triggerAIMove = useCallback(() => {
    if (!opponent) return
    const engine = engineRef.current
    if (!engine) return
    setThinking(true)
    setStatus(`${opponent.label} is thinking...`)
    const fenBefore = chessRef.current.fen()
    engine.findMove(
      fenBefore,
      { depth: profile.depth, movetime: profile.movetime },
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
          void finalizeMove(result, fenBefore, 'ai')

          const pm = premoveRef.current
          if (pm) {
            premoveRef.current = null
            setPremove(null)
            try {
              const pmFenBefore = chessRef.current.fen()
              const pmRes = chessRef.current.move({
                from: pm.from,
                to: pm.to,
                promotion: pm.promotion,
              })
              if (pmRes) {
                setLiveFen(chessRef.current.fen())
                setHistory(chessRef.current.history({ verbose: true }) as Move[])
                setLastMove(pmRes)
                playMoveSound(pmRes)
                void finalizeMove(pmRes, pmFenBefore, 'player')
                if (!checkGameOver()) {
                  setTimeout(() => triggerAIMoveRef.current(), 700)
                }
              }
            } catch {
              // Premove no longer legal — silently discard.
            }
          }
        } catch (err) {
          console.error('Failed to apply AI move', err)
          setThinking(false)
        }
      },
    )
  }, [checkGameOver, finalizeMove, opponent, profile])

  useEffect(() => {
    triggerAIMoveRef.current = triggerAIMove
  }, [triggerAIMove])

  const applyPlayerMove = useCallback(
    (from: Square, to: Square, promotion: 'q' = 'q'): boolean => {
      if (!opponent || thinking || gameOver) return false
      if (!isLiveView) {
        setViewPlyState(null)
        return false
      }
      try {
        const fenBefore = chessRef.current.fen()
        const move = chessRef.current.move({ from, to, promotion })
        if (!move) return false
        setLiveFen(chessRef.current.fen())
        setHistory(chessRef.current.history({ verbose: true }) as Move[])
        setLastMove(move)
        setSelected(null)
        playMoveSound(move)
        void finalizeMove(move, fenBefore, 'player')
        if (!checkGameOver()) {
          setTimeout(() => triggerAIMoveRef.current(), 700)
        }
        return true
      } catch {
        return false
      }
    },
    [checkGameOver, finalizeMove, gameOver, isLiveView, opponent, thinking],
  )

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (gameOver) return
      if (!isLiveView) {
        setViewPlyState(null)
        return
      }
      if (thinking) {
        if (selected && square !== selected && pieceBelongsTo(liveFen, selected, 'w')) {
          setPremove({ from: selected, to: square, promotion: 'q' })
          setSelected(null)
          return
        }
        setSelected(pieceBelongsTo(liveFen, square, 'w') ? square : null)
        return
      }
      if (selected) {
        if (square === selected) {
          setSelected(null)
          return
        }
        if (legalTargets.has(square)) {
          applyPlayerMove(selected, square)
          return
        }
        setSelected(pieceBelongsTo(liveFen, square, 'w') ? square : null)
        return
      }
      if (pieceBelongsTo(liveFen, square, 'w')) {
        setSelected(square)
      }
    },
    [applyPlayerMove, gameOver, isLiveView, legalTargets, liveFen, selected, thinking],
  )

  const setViewPly = useCallback((ply: number | null) => {
    setSelected(null)
    setPremove(null)
    setViewPlyState((prev) => {
      if (prev !== ply) SoundManager.play('move')
      return ply
    })
  }, [])

  const stepBack = useCallback(() => {
    setViewPlyState((vp) => {
      const cur = vp ?? totalPlies
      if (cur <= 0) return vp
      SoundManager.play('move')
      return cur - 1
    })
  }, [totalPlies])

  const stepForward = useCallback(() => {
    setViewPlyState((vp) => {
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
  }, [setViewPly, totalPlies])

  const jumpLive = useCallback(() => {
    SoundManager.play('move')
    setViewPly(null)
  }, [setViewPly])

  return {
    active,
    liveFen,
    displayFen,
    history,
    thinking,
    status,
    lastMove,
    gameOver,
    selected,
    legalTargets,
    squareHighlights,
    premove,
    commentary,
    commentarySource,
    profile,
    evalScore,
    lastAnalysis,
    npcReaction,
    summary,
    viewPly,
    totalPlies,
    isLiveView,
    applyPlayerMove,
    handleSquareClick,
    clearSelection: () => {
      setPremove(null)
      setSelected(null)
    },
    setViewPly,
    stepBack,
    stepForward,
    jumpStart,
    jumpLive,
  }
}
