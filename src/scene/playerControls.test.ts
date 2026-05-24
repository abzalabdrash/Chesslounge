import { describe, expect, it } from 'vitest'
import {
  CAMERA_FORWARD,
  computeMoveIntent,
  getMoveSpeed,
  normalizeJoystickVector,
} from './playerControls'

describe('player controls', () => {
  it('combines WASD into a normalized camera-relative direction', () => {
    const intent = computeMoveIntent({ w: true, d: true })
    expect(intent.x).toBeCloseTo(Math.SQRT1_2)
    expect(intent.z).toBeCloseTo(-Math.SQRT1_2)
  })

  it('maps arrow keys to the same movement axes', () => {
    expect(computeMoveIntent({ arrowUp: true })).toEqual(CAMERA_FORWARD)
    const down = computeMoveIntent({ arrowDown: true })
    expect(down.x).toBeCloseTo(-CAMERA_FORWARD.x)
    expect(down.z).toBeCloseTo(-CAMERA_FORWARD.z)
  })

  it('applies the shift speed multiplier', () => {
    expect(getMoveSpeed(false)).toBe(4.8)
    expect(getMoveSpeed(true)).toBe(7.2)
  })

  it('normalizes joystick vectors and clamps oversized input', () => {
    expect(normalizeJoystickVector(0, 0)).toEqual({ x: 0, z: 0 })
    const joystick = normalizeJoystickVector(80, -80)
    expect(joystick.x).toBeCloseTo(Math.SQRT1_2)
    expect(joystick.z).toBeCloseTo(-Math.SQRT1_2)
  })
})
