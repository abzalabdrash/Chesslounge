import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { World } from './scene/World'
import { MatchView } from './match/MatchView'
import { useChessMatch, type MatchResult } from './match/useChessMatch'
import { useGameStore } from './store/gameStore'
import { TABLES } from './scene/tables'
import { PersonaAvatar } from './ui/PersonaAvatar'
import { SoundManager, installAudioUnlock } from './ui/SoundManager'
import { useKeyboardMovement } from './scene/playerControls'
import { TouchJoystick } from './ui/TouchJoystick'

export default function App() {
  const scene = useGameStore((s) => s.scene)
  const nearTable = useGameStore((s) => s.nearTable)
  const currentOpponent = useGameStore((s) => s.currentOpponent)
  const enterMatch = useGameStore((s) => s.enterMatch)
  const exitMatch = useGameStore((s) => s.exitMatch)
  const [muted, setMuted] = useState(false)
  const [matchKey, setMatchKey] = useState(0)
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  useKeyboardMovement()

  const opponent = TABLES.find((t) => t.id === currentOpponent)
  const match = useChessMatch(opponent, setMatchResult, matchKey)

  const startMatch = useCallback(
    (tableId: string) => {
      setMatchResult(null)
      enterMatch(tableId)
    },
    [enterMatch],
  )

  const leaveMatch = useCallback(() => {
    setMatchResult(null)
    exitMatch()
  }, [exitMatch])

  const rematch = useCallback(() => {
    setMatchResult(null)
    setMatchKey((k) => k + 1)
  }, [])

  useEffect(() => {
    installAudioUnlock()
    SoundManager.preload()
    SoundManager.startAmbient()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (scene === 'world' && (key === 'e' || key === 'у') && nearTable) {
        startMatch(nearTable)
      }
      if ((scene === 'match' || scene === 'tableFocus') && e.key === 'Escape') {
        leaveMatch()
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
  }, [scene, nearTable, startMatch, leaveMatch])

  const nearPersona = TABLES.find((t) => t.id === nearTable)

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-neutral-950 text-neutral-100">
      <World match={match} />

      {scene === 'world' && (
        <div className="pointer-events-none absolute top-4 left-4 text-xs text-white/70 font-mono leading-relaxed bg-black/35 backdrop-blur-sm px-3 py-2 rounded-md">
          <div>WASD / Arrows — walk</div>
          <div>Shift — run</div>
          <div>E — sit at table</div>
          <div>Esc — leave table</div>
          <div>M — {muted ? 'unmute' : 'mute'} audio</div>
        </div>
      )}

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
        {scene === 'match' && opponent && (
          <MatchView
            key="match"
            opponent={opponent}
            match={match}
            result={matchResult}
            onLeave={leaveMatch}
            onRematch={rematch}
          />
        )}
      </AnimatePresence>
      <TouchJoystick />
    </div>
  )
}
