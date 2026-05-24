import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { World } from './scene/World'
import { MatchView } from './match/MatchView'
import { useGameStore } from './store/gameStore'
import { TABLES } from './scene/tables'

export default function App() {
  const scene = useGameStore((s) => s.scene)
  const nearTable = useGameStore((s) => s.nearTable)
  const enterMatch = useGameStore((s) => s.enterMatch)
  const exitMatch = useGameStore((s) => s.exitMatch)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (scene === 'world' && key === 'e' && nearTable) {
        enterMatch(nearTable)
      }
      if (scene === 'match' && e.key === 'Escape') {
        exitMatch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scene, nearTable, enterMatch, exitMatch])

  const nearLabel = TABLES.find((t) => t.id === nearTable)?.label

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-neutral-950 text-neutral-100">
      <World />

      {/* HUD */}
      <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 text-center">
        <h1 className="text-amber-300 text-2xl font-display font-bold drop-shadow-lg tracking-wide">
          Chess Lounge
        </h1>
        <p className="text-amber-100/60 text-xs uppercase tracking-[0.3em]">
          AI opponents · with personality
        </p>
      </div>

      <div className="pointer-events-none absolute top-4 left-4 text-xs text-white/60 font-mono leading-relaxed bg-black/40 backdrop-blur-sm px-3 py-2 rounded-md">
        <div>🖱 Click floor — walk</div>
        <div>⌨ E — sit at table</div>
        <div>⌨ Esc — leave table</div>
      </div>

      {scene === 'world' && nearTable && (
        <div className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 px-6 py-3 bg-amber-400 text-black rounded-full font-bold shadow-2xl animate-pulse">
          Press [E] to play <span className="font-display">{nearLabel}</span>
        </div>
      )}

      <AnimatePresence>
        {scene === 'match' && <MatchView key="match" />}
      </AnimatePresence>
    </div>
  )
}
