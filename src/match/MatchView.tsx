import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PersonaAvatar } from '../ui/PersonaAvatar'
import { TableVoice } from '../ui/TableVoice'
import { getPersona } from '../llm/personas'
import { MoveList } from './MoveList'
import { ReplayControls } from './ReplayControls'
import { useGameStore, type CameraMode } from '../store/gameStore'
import type { TableConfig } from '../scene/tables'
import type { ChessMatchController, MatchResult } from './useChessMatch'
import { formatEval } from './analysis'
import type { MoveClass, SideSummary } from './analysis'
import type { EvalScore } from './engine'

interface Props {
  opponent: TableConfig
  match: ChessMatchController
  result: MatchResult | null
  onLeave: () => void
  onRematch: () => void
}

export function MatchView({ opponent, match, result, onLeave, onRematch }: Props) {
  const cameraMode = useGameStore((s) => s.cameraMode)
  const setCameraMode = useGameStore((s) => s.setCameraMode)
  const reaction = useMemo(() => {
    if (!result) return ''
    const persona = getPersona(opponent.id)
    const pool =
      result.outcome === 'win'
        ? persona.fallbacks.playerWins
        : result.outcome === 'loss'
        ? persona.fallbacks.aiWins
        : persona.fallbacks.draw
    return pickReaction(pool, `${opponent.id}:${result.outcome}:${result.detail}`)
  }, [opponent, result])

  const verdict =
    result?.outcome === 'win'
      ? 'Checkmate — you won'
      : result?.outcome === 'loss'
      ? `${opponent.label} wins`
      : result?.outcome === 'draw'
      ? 'Draw'
      : 'Match aborted'

  const verdictAccent =
    result?.outcome === 'win'
      ? 'text-emerald-300'
      : result?.outcome === 'loss'
      ? 'text-rose-300'
      : 'text-amber-300'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(245,158,11,0.06),transparent_35%,rgba(0,0,0,0.42))]"
    >
      <TableVoice
        table={opponent}
        text={match.commentary}
        streaming={match.commentarySource === 'idle' && !!match.commentary}
        thinking={match.thinking}
      />

      {/* NPC emoji reaction — pops above the table on capture/check/mate */}
      <AnimatePresence>
        {match.npcReaction && (
          <motion.div
            key={match.npcReaction.key}
            initial={{ opacity: 0, scale: 0.4, y: 30 }}
            animate={{ opacity: 1, scale: 1.15, y: 0 }}
            exit={{ opacity: 0, scale: 1.4, y: -40 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18 }}
            className="pointer-events-none absolute left-1/2 top-[18%] -translate-x-1/2 text-[7rem] drop-shadow-[0_4px_18px_rgba(0,0,0,0.65)] select-none"
            style={{ textShadow: '0 0 22px rgba(0,0,0,0.6)' }}
          >
            {match.npcReaction.emoji}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto absolute right-4 top-4 bottom-4 w-[min(390px,calc(100vw-2rem))] flex flex-col gap-3">
        <div
          className="bg-neutral-950/75 backdrop-blur-md rounded-lg p-4 shadow-2xl shadow-black/50"
          style={{ borderWidth: 1, borderStyle: 'solid', borderColor: `${opponent.accent}55` }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <PersonaAvatar persona={opponent} size={54} />
              <div className="min-w-0">
                <p className="text-amber-400/70 text-[10px] uppercase tracking-widest">
                  Sitting at the table of
                </p>
                <h2
                  className="text-2xl font-display font-bold leading-tight truncate"
                  style={{ color: opponent.accent }}
                >
                  {opponent.label}
                </h2>
                <p className="text-neutral-400 text-xs italic truncate">{opponent.bio}</p>
                <p className="text-neutral-500 text-[10px] font-mono mt-0.5">
                  ELO {opponent.elo} · depth {match.profile.depth}
                </p>
              </div>
            </div>
            <button
              onClick={onLeave}
              className="shrink-0 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md text-sm border border-neutral-700"
            >
              Leave
            </button>
          </div>
        </div>

        <div className="bg-neutral-950/62 backdrop-blur-md border border-white/10 rounded-lg p-2 shadow-lg shadow-black/30">
          <div className="grid grid-cols-2 gap-1">
            <CameraModeButton mode="tilt" active={cameraMode === 'tilt'} onClick={setCameraMode}>
              Tilt
            </CameraModeButton>
            <CameraModeButton mode="top" active={cameraMode === 'top'} onClick={setCameraMode}>
              Top
            </CameraModeButton>
          </div>
        </div>

        <EvalCard
          score={match.evalScore}
          analysis={match.lastAnalysis}
          lastMoveSan={match.lastMove?.san ?? null}
        />

        {match.premove && (
          <div className="bg-neutral-950/62 backdrop-blur-md border border-indigo-400/20 rounded-lg px-4 py-2 shadow-lg shadow-black/30">
            <p className="text-indigo-200 text-[11px] font-mono">
              queued premove: {match.premove.from} → {match.premove.to}
            </p>
          </div>
        )}

        <div className="min-h-0 flex flex-col gap-3">
          <MoveList
            history={match.history}
            viewPly={match.viewPly}
            onPick={(ply) => match.setViewPly(ply === match.totalPlies ? null : ply)}
          />
          <ReplayControls
            viewPly={match.viewPly}
            totalPlies={match.totalPlies}
            onStepBack={match.stepBack}
            onStepForward={match.stepForward}
            onJumpStart={match.jumpStart}
            onJumpLive={match.jumpLive}
          />
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 22 }}
              className="relative overflow-hidden rounded-lg border p-4 shadow-2xl shadow-black/50"
              style={{
                borderColor: `${opponent.accent}55`,
                background: `radial-gradient(circle at 0% 0%, ${opponent.accent}22, transparent 60%), rgba(20,20,24,0.88)`,
              }}
            >
              <div className="flex items-start gap-3">
                <PersonaAvatar persona={opponent} size={58} />
                <div className="flex-1 min-w-0">
                  <p className={`font-display text-2xl font-bold ${verdictAccent}`}>{verdict}</p>
                  <p className="text-neutral-400 text-xs mt-0.5">{result.detail}</p>
                  {reaction && (
                    <p className="mt-2 text-amber-100 text-sm italic leading-snug">
                      <span className="text-amber-400/70 text-[10px] uppercase tracking-widest not-italic mr-2">
                        {opponent.label}
                      </span>
                      {reaction}
                    </p>
                  )}
                </div>
              </div>

              <SummaryReport
                playerLabel="Вы"
                opponentLabel={opponent.label}
                player={match.summary.player}
                opponent={match.summary.opponent}
              />

              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={onRematch}
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-md font-semibold shadow-lg shadow-amber-500/20"
                >
                  Реванш
                </button>
                <button
                  onClick={onLeave}
                  className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-md"
                >
                  В лаунж
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function CameraModeButton({
  mode,
  active,
  onClick,
  children,
}: {
  mode: CameraMode
  active: boolean
  onClick: (mode: CameraMode) => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(mode)}
      className={`h-9 rounded-md text-xs font-semibold uppercase tracking-widest transition-colors ${
        active
          ? 'bg-amber-400 text-neutral-950 shadow-lg shadow-amber-400/20'
          : 'bg-neutral-900/70 text-amber-200/70 hover:bg-neutral-800'
      }`}
    >
      {children}
    </button>
  )
}

function pickReaction(pool: string[], key: string) {
  if (pool.length === 0) return ''
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i) * (i + 1)) % pool.length
  }
  return pool[hash] ?? ''
}

/**
 * Big in-match eval card — chess.com-style. Shows the live engine evaluation
 * with a fat horizontal bar and the most recent move's classification badge
 * (BRILLIANT / BEST / BLUNDER…) front-and-centre.
 */
function EvalCard({
  score,
  analysis,
  lastMoveSan,
}: {
  score: EvalScore | null
  analysis: import('./analysis').MoveAnalysis | null
  lastMoveSan: string | null
}) {
  if (!score && !analysis) return null

  const klass = analysis?.classification ?? null
  const accent = klass ? CLASS_ACCENT[klass] : '#fbbf24'
  const label = klass ? CLASS_LABEL[klass] : null

  return (
    <div
      className="rounded-lg p-3 shadow-lg shadow-black/40"
      style={{
        background: `radial-gradient(circle at 0% 0%, ${accent}1f, transparent 55%), rgba(12,12,16,0.78)`,
        border: `1px solid ${accent}55`,
        backdropFilter: 'blur(10px)',
      }}
    >
      {label && lastMoveSan && (
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-neutral-400 text-[10px] uppercase tracking-[0.2em]">last move</p>
            <p className="font-display text-2xl font-bold text-neutral-100 leading-none mt-0.5 truncate">
              {lastMoveSan}
            </p>
          </div>
          <div
            className="shrink-0 rounded-md px-3 py-1.5 font-display font-bold text-sm uppercase tracking-[0.18em]"
            style={{
              color: accent,
              background: `${accent}22`,
              border: `1px solid ${accent}66`,
              boxShadow: `0 0 14px ${accent}44`,
            }}
          >
            {label}
          </div>
        </div>
      )}
      {score && <BigEvalBar score={score} accent={accent} />}
    </div>
  )
}

/** Fat eval bar with prominent score readout. */
function BigEvalBar({ score, accent }: { score: EvalScore; accent: string }) {
  const cp = score.cp ?? 0
  const mate = score.mate
  let whiteShare: number
  if (mate !== null && mate !== undefined) {
    whiteShare = mate > 0 ? 100 : 0
  } else {
    const clamped = Math.max(-1000, Math.min(1000, cp))
    whiteShare = 50 + (clamped / 1000) * 50
  }
  const label = formatEval(score)
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-3.5 rounded-full overflow-hidden bg-neutral-800/80 border border-white/10 shadow-inner shadow-black/40">
          <div
            className="h-full transition-[width] duration-500"
            style={{
              width: `${whiteShare}%`,
              background: `linear-gradient(90deg, #fef9c3, ${accent})`,
              boxShadow: `0 0 12px ${accent}88`,
            }}
          />
        </div>
        <span
          className="font-display font-bold text-xl min-w-[3.2rem] text-right"
          style={{ color: accent }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

const CLASS_LABEL: Record<MoveClass, string> = {
  brilliant: 'Brilliant',
  great: 'Great',
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  book: 'Book',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}

const CLASS_ACCENT: Record<MoveClass, string> = {
  brilliant: '#22d3ee',
  great: '#7dd3fc',
  best: '#34d399',
  excellent: '#86efac',
  good: '#e5e5e5',
  book: '#fcd34d',
  inaccuracy: '#facc15',
  mistake: '#fb923c',
  blunder: '#fb7185',
}

/**
 * Post-game report — accuracy + classification counts for both sides, in the
 * spirit of chess.com / checkers.damadojo.me. Shown inside the result modal.
 */
function SummaryReport({
  playerLabel,
  opponentLabel,
  player,
  opponent,
}: {
  playerLabel: string
  opponentLabel: string
  player: SideSummary
  opponent: SideSummary
}) {
  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-black/35 p-3">
      <p className="text-amber-400/70 text-[10px] uppercase tracking-widest mb-2">Отчёт партии</p>
      <div className="grid grid-cols-2 gap-3">
        <SideColumn label={playerLabel} summary={player} accent="emerald" />
        <SideColumn label={opponentLabel} summary={opponent} accent="rose" />
      </div>
    </div>
  )
}

function SideColumn({
  label,
  summary,
  accent,
}: {
  label: string
  summary: SideSummary
  accent: 'emerald' | 'rose'
}) {
  const accuracyColor =
    summary.accuracy >= 85
      ? 'text-emerald-300'
      : summary.accuracy >= 65
      ? 'text-amber-300'
      : 'text-rose-300'
  const accentBorder = accent === 'emerald' ? 'border-emerald-400/30' : 'border-rose-400/30'
  return (
    <div className={`rounded-md border ${accentBorder} bg-neutral-950/40 p-2.5`}>
      <p className="text-neutral-400 text-[10px] uppercase tracking-widest">{label}</p>
      <p className={`font-display text-2xl font-bold leading-none mt-1 ${accuracyColor}`}>
        {summary.total === 0 ? '—' : `${summary.accuracy.toFixed(0)}%`}
      </p>
      <p className="text-[10px] text-neutral-500 mt-0.5">точность</p>
      <div className="mt-2 space-y-1 text-[11px] font-mono">
        <StatRow label="brilliant" value={summary.counts.brilliant} className="text-cyan-300" />
        <StatRow label="best" value={summary.counts.best} className="text-emerald-300" />
        <StatRow label="excellent" value={summary.counts.excellent} className="text-emerald-200" />
        <StatRow label="good" value={summary.counts.good} className="text-neutral-200" />
        <StatRow label="inaccuracy" value={summary.counts.inaccuracy} className="text-yellow-300" />
        <StatRow label="mistake" value={summary.counts.mistake} className="text-orange-300" />
        <StatRow label="blunder" value={summary.counts.blunder} className="text-rose-400" />
      </div>
    </div>
  )
}

function StatRow({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  if (value === 0) return null
  return (
    <div className={`flex justify-between ${className ?? 'text-neutral-300'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

