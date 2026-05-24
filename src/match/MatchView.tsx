import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { TABLES } from '../scene/tables'
import { ChessBoardView } from './ChessBoardView'
import { PersonaAvatar } from '../ui/PersonaAvatar'
import { getPersona } from '../llm/personas'

interface MatchResult {
  outcome: 'win' | 'loss' | 'draw' | 'aborted'
  detail: string
}

export function MatchView() {
  const opponentId = useGameStore((s) => s.currentOpponent)
  const exitMatch = useGameStore((s) => s.exitMatch)
  const opponent = TABLES.find((t) => t.id === opponentId)
  const [matchKey, setMatchKey] = useState(0)
  const [result, setResult] = useState<MatchResult | null>(null)

  const reaction = useMemo(() => {
    if (!opponent || !result) return ''
    const persona = getPersona(opponent.id)
    const pool =
      result.outcome === 'win'
        ? persona.fallbacks.playerWins
        : result.outcome === 'loss'
        ? persona.fallbacks.aiWins
        : persona.fallbacks.draw
    return pool[Math.floor(Math.random() * pool.length)] ?? ''
  }, [opponent, result])

  if (!opponent) return null

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
      className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(245,158,11,0.12),rgba(0,0,0,0.58)_46%,rgba(0,0,0,0.74))] backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-neutral-950/78 backdrop-blur-md border border-amber-300/20 rounded-xl p-5 md:p-7 w-full max-w-6xl shadow-2xl my-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <PersonaAvatar persona={opponent} size={64} />
            <div>
              <p className="text-amber-400/60 text-xs uppercase tracking-widest mb-0.5">
                Sitting at the table of
              </p>
              <h2 className="text-3xl font-display font-bold text-amber-300 leading-tight">
                {opponent.label}
              </h2>
              <p className="text-neutral-500 text-xs italic">{opponent.bio}</p>
            </div>
          </div>
          <button
            onClick={exitMatch}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-sm border border-neutral-700"
          >
            Leave (Esc)
          </button>
        </div>

        <ChessBoardView
          key={matchKey}
          opponent={opponent}
          onResult={(outcome, detail) => setResult({ outcome, detail })}
        />

        <AnimatePresence>
          {result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 22 }}
              className="mt-6 relative overflow-hidden rounded-xl border p-6 flex flex-col md:flex-row items-start md:items-center gap-5"
              style={{
                borderColor: `${opponent.accent}55`,
                background: `radial-gradient(circle at 0% 0%, ${opponent.accent}22, transparent 60%), rgba(20,20,24,0.85)`,
              }}
            >
              <motion.div
                initial={{ scale: 0.5, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 14 }}
              >
                <PersonaAvatar persona={opponent} size={88} />
              </motion.div>
              <div className="flex-1 min-w-0">
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`font-display text-3xl md:text-4xl font-bold ${verdictAccent}`}
                >
                  {verdict}
                </motion.p>
                <p className="text-neutral-400 text-sm mt-0.5">{result.detail}</p>
                {reaction && (
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="mt-3 text-amber-100 text-lg italic leading-snug"
                  >
                    <span className="text-amber-400/70 text-xs uppercase tracking-widest not-italic mr-2">
                      {opponent.label}
                    </span>
                    "{reaction}"
                  </motion.p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    setResult(null)
                    setMatchKey((k) => k + 1)
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-semibold shadow-lg shadow-amber-500/30"
                >
                  Rematch
                </button>
                <button
                  onClick={exitMatch}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg"
                >
                  Back to lounge
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
