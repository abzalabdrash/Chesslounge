import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'

describe('game store match transition', () => {
  beforeEach(() => {
    useGameStore.setState({
      scene: 'world',
      boardInteractionMode: 'world',
      cameraMode: 'tilt',
      targetPos: [2, 3],
      moveInput: [0, 0],
      sprinting: false,
      playerPos: [0, 5],
      nearTable: 'tilt',
      currentOpponent: null,
    })
  })

  it('starts with a table-focus camera transition before opening match', () => {
    useGameStore.getState().enterMatch('maestro')

    expect(useGameStore.getState()).toMatchObject({
      scene: 'tableFocus',
      boardInteractionMode: 'locked',
      currentOpponent: 'maestro',
      targetPos: null,
    })
  })

  it('opens match only after table focus completes', () => {
    useGameStore.getState().enterMatch('tilt')
    useGameStore.getState().finishTableFocus()

    expect(useGameStore.getState()).toMatchObject({
      scene: 'match',
      boardInteractionMode: 'locked',
      currentOpponent: 'tilt',
    })
  })

  it('defaults matches to tilt camera and lets the player switch to top view', () => {
    useGameStore.getState().enterMatch('tilt')

    expect(useGameStore.getState().cameraMode).toBe('tilt')

    useGameStore.getState().setCameraMode('top')
    expect(useGameStore.getState().cameraMode).toBe('top')

    useGameStore.getState().exitMatch()
    expect(useGameStore.getState().cameraMode).toBe('tilt')
  })

  it('manual movement cancels point-and-click pathing', () => {
    useGameStore.getState().setMoveInput([1, 0])

    expect(useGameStore.getState()).toMatchObject({
      moveInput: [1, 0],
      targetPos: null,
    })
  })
})
