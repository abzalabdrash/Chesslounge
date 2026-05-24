import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { World } from './scene/World'
import { MatchView } from './match/MatchView'
import { useGameStore } from './store/gameStore'
import { TABLES } from './scene/tables'
import { PersonaAvatar } from './ui/PersonaAvatar'
import { SoundManager, installAudioUnlock } from './ui/SoundManager'

export default function App() {
  const scene = useGameStore((s) => s.scene)
  const nearTable = useGameStore((s) => s.nearTable)
  const enterMatch = useGameStore((s) => s.enterMatch)
  const exitMatch = useGameStore((s) => s.exitMatch)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    installAudioUnlock()
    SoundManager.preload()
    SoundManager.startAmbient()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (scene === 'world' && key === 'e' && nearTable) {
        enterMatch(nearTable)
      }
      if (scene === 'match' && e.key === 'Escape') {
        exitMatch()
      }
      if (key === 'm') {
        setMuted((m) => {
          const next = !m
          SoundManager.setMuted(next)
          if (!next) SoundManager.startAmbient()
          return next
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scene, nearTable, enterMatch, exitMatch])

  const nearPersona = TABLES.find((t) => t.id === nearTable)

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-neutral-950 text-neutral-100">
      <World />

      {/* HUD */}
      <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 text-center">
        <h1 className="text-amber-300 text-2xl font-display font-bold drop-shadow-lg tracking-wide">
          Chess Lounge
        </h1>
        <p className="text-amber-100/60 text-xs uppercase tracking-[0.3em]">
          Personality opponents · cozy tactics
        </p>
      </div>

      <div className="pointer-events-none absolute top-4 left-4 text-xs text-white/60 font-mono leading-relaxed bg-black/40 backdrop-blur-sm px-3 py-2 rounded-md">
        <div>Click floor — walk</div>
        <div>E — sit at table</div>
        <div>Esc — leave table</div>
        <div>M — {muted ? 'unmute' : 'mute'} audio</div>
      </div>

      <button
        onClick={() => {
          setMuted((m) => {
            const next = !m
            SoundManager.setMuted(next)
            if (!next) SoundManager.startAmbient()
            return next
          })
        }}
        className="absolute top-4 right-4 z-20 px-3 py-2 rounded-md bg-black/50 hover:bg-black/70 text-amber-300 text-xs font-mono border border-amber-500/20"
      >
        {muted ? 'Audio: off' : 'Audio: on'}
      </button>

      {scene === 'world' && nearPersona && (
        <div className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 bg-amber-400/95 text-black rounded-full font-bold shadow-2xl animate-pulse">
          <PersonaAvatar persona={nearPersona} size={42} />
          <span>
            Press <kbd className="bg-black text-amber-300 px-1.5 py-0.5 rounded text-xs">E</kbd>{' '}
            to play <span className="font-display">{nearPersona.label}</span>
          </span>
        </div>
      )}

      <AnimatePresence>
        {scene === 'match' && <MatchView key="match" />}
      </AnimatePresence>
    </div>
  )
}
