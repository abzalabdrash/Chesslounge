import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { normalizeJoystickVector, vectorToVec2 } from '../scene/playerControls'

const RADIUS = 58

export function TouchJoystick() {
  const scene = useGameStore((s) => s.scene)
  const activePointerRef = useRef<number | null>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (scene !== 'world') {
      useGameStore.getState().setMoveInput([0, 0])
      useGameStore.getState().setSprinting(false)
    }
  }, [scene])

  function updateFromPointer(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const rawX = e.clientX - rect.left - rect.width / 2
    const rawY = e.clientY - rect.top - rect.height / 2
    const len = Math.hypot(rawX, rawY)
    const scale = len > RADIUS ? RADIUS / len : 1
    const x = rawX * scale
    const y = rawY * scale
    setKnob({ x, y })
    useGameStore.getState().setMoveInput(vectorToVec2(normalizeJoystickVector(x, y)))
  }

  function release(e: React.PointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== e.pointerId) return
    activePointerRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    setKnob({ x: 0, y: 0 })
    useGameStore.getState().setMoveInput([0, 0])
  }

  if (scene !== 'world') return null

  return (
    <div
      className="absolute bottom-6 left-6 z-20 hidden h-36 w-36 touch-none select-none items-center justify-center rounded-full border border-white/45 bg-white/15 shadow-2xl backdrop-blur-sm [@media(pointer:coarse)]:flex"
      onPointerDown={(e) => {
        activePointerRef.current = e.pointerId
        e.currentTarget.setPointerCapture(e.pointerId)
        updateFromPointer(e)
      }}
      onPointerMove={(e) => {
        if (activePointerRef.current === e.pointerId) updateFromPointer(e)
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div
        className="h-16 w-16 rounded-full border-2 border-white bg-cyan-300/85 shadow-[0_10px_25px_rgba(0,0,0,0.35)]"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  )
}
