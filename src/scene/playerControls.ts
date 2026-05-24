import { useEffect, useMemo } from 'react'
import { useGameStore, type Vec2 } from '../store/gameStore'

export interface MoveIntentKeys {
  w?: boolean
  a?: boolean
  s?: boolean
  d?: boolean
  arrowUp?: boolean
  arrowLeft?: boolean
  arrowDown?: boolean
  arrowRight?: boolean
}

export const CAMERA_FORWARD = { x: 0, z: -1 }
export const WALK_SPEED = 2.8
export const SPRINT_SPEED = 4.8

// Latin + Cyrillic equivalents so RU keyboard layout works without switching.
// ц→w, ф→a, ы→s, в→d
const KEY_MAP: Record<string, keyof MoveIntentKeys> = {
  w: 'w',
  a: 'a',
  s: 's',
  d: 'd',
  'ц': 'w',
  'ф': 'a',
  'ы': 's',
  'в': 'd',
  arrowup: 'arrowUp',
  arrowleft: 'arrowLeft',
  arrowdown: 'arrowDown',
  arrowright: 'arrowRight',
}

function normalize(x: number, z: number): { x: number; z: number } {
  const length = Math.hypot(x, z)
  if (length === 0) return { x: 0, z: 0 }
  return { x: x / length, z: z / length }
}

export function computeMoveIntent(keys: MoveIntentKeys): { x: number; z: number } {
  const x = Number(!!keys.d || !!keys.arrowRight) - Number(!!keys.a || !!keys.arrowLeft)
  const z = Number(!!keys.s || !!keys.arrowDown) - Number(!!keys.w || !!keys.arrowUp)
  return normalize(x, z)
}

export function normalizeJoystickVector(dx: number, dy: number): { x: number; z: number } {
  return normalize(dx, dy)
}

export function getMoveSpeed(sprinting: boolean): number {
  return sprinting ? SPRINT_SPEED : WALK_SPEED
}

export function vectorToVec2(v: { x: number; z: number }): Vec2 {
  return [v.x, v.z]
}

export function useKeyboardMovement() {
  const pressed = useMemo(() => new Set<string>(), [])

  useEffect(() => {
    function sync() {
      if (useGameStore.getState().scene !== 'world') {
        useGameStore.getState().setMoveInput([0, 0])
        useGameStore.getState().setSprinting(false)
        return
      }
      const keys: MoveIntentKeys = {}
      for (const key of pressed) {
        const mapped = KEY_MAP[key]
        if (mapped) keys[mapped] = true
      }
      const next = computeMoveIntent(keys)
      useGameStore.getState().setMoveInput(vectorToVec2(next))
      useGameStore.getState().setSprinting(pressed.has('shift'))
    }

    function onKeyDown(e: KeyboardEvent) {
      if (useGameStore.getState().scene !== 'world') return
      const key = e.key.toLowerCase()
      if (!(key in KEY_MAP) && key !== 'shift') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      e.preventDefault()
      pressed.add(key)
      sync()
    }

    function onKeyUp(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      if (!(key in KEY_MAP) && key !== 'shift') return
      pressed.delete(key)
      sync()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    function onBlur() {
      pressed.clear()
      sync()
    }

    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      pressed.clear()
      useGameStore.getState().setMoveInput([0, 0])
      useGameStore.getState().setSprinting(false)
    }
  }, [pressed])
}
