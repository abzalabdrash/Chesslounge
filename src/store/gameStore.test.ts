import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from './gameStore'

describe('game store match transition', () => {
  beforeEach(() => {
    useGameStore.setState({
      scene: 'world',
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
      currentOpponent: 'maestro',
      targetPos: null,
    })
  })

  it('opens match only after table focus completes', () => {
    useGameStore.getState().enterMatch('tilt')
    useGameStore.getState().finishTableFocus()

    expect(useGameStore.getState()).toMatchObject({
      scene: 'match',
      currentOpponent: 'tilt',
    })
  })

  it('manual movement cancels point-and-click pathing', () => {
    useGameStore.getState().setMoveInput([1, 0])

    expect(useGameStore.getState()).toMatchObject({
      moveInput: [1, 0],
      targetPos: null,
    })
  })
})
