import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { TABLES } from '../scene/tables'
import { ChessBoardView } from './ChessBoardView'

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

  if (!opponent) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-neutral-900/95 border border-amber-500/20 rounded-xl p-6 md:p-8 w-full max-w-5xl shadow-2xl my-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-amber-400/60 text-xs uppercase tracking-widest mb-0.5">
              Sitting at the table of
            </p>
            <h2 className="text-3xl font-display font-bold text-amber-300">
              {opponent.label}
            </h2>
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

        {result && (
          <div className="mt-6 bg-neutral-800/70 border border-amber-500/30 rounded-lg p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-amber-400 font-display text-2xl font-bold capitalize">
                {result.outcome === 'win'
                  ? 'You won'
                  : result.outcome === 'loss'
                  ? 'You lost'
                  : result.outcome === 'draw'
                  ? 'Draw'
                  : 'Match aborted'}
              </p>
              <p className="text-neutral-400 text-sm">{result.detail}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setResult(null)
                  setMatchKey((k) => k + 1)
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-semibold"
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
          </div>
        )}
      </div>
    </motion.div>
  )
}
