import { create } from 'zustand'

export type Vec2 = [number, number]
export type Scene = 'world' | 'tableFocus' | 'match'
export type BoardInteractionMode = 'world' | 'locked'
export type CameraMode = 'top' | 'tilt'

export interface GameState {
  scene: Scene
  boardInteractionMode: BoardInteractionMode
  cameraMode: CameraMode
  targetPos: Vec2 | null
  moveInput: Vec2
  sprinting: boolean
  playerPos: Vec2
  nearTable: string | null
  currentOpponent: string | null
  setTarget: (p: Vec2 | null) => void
  setMoveInput: (p: Vec2) => void
  setSprinting: (sprinting: boolean) => void
  setPlayerPos: (p: Vec2) => void
  setNearTable: (id: string | null) => void
  setCameraMode: (mode: CameraMode) => void
  enterMatch: (opponentId: string) => void
  finishTableFocus: () => void
  exitMatch: () => void
}

export const useGameStore = create<GameState>((set) => ({
  scene: 'world',
  boardInteractionMode: 'world',
  cameraMode: 'tilt',
  targetPos: null,
  moveInput: [0, 0],
  sprinting: false,
  playerPos: [0, 5],
  nearTable: null,
  currentOpponent: null,
  setTarget: (p) => set({ targetPos: p }),
  setMoveInput: (p) =>
    set((state) => ({
      moveInput: p,
      targetPos: p[0] !== 0 || p[1] !== 0 ? null : state.targetPos,
    })),
  setSprinting: (sprinting) => set({ sprinting }),
  setPlayerPos: (p) => set({ playerPos: p }),
  setNearTable: (id) => set({ nearTable: id }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  enterMatch: (opponentId) =>
    set({
      scene: 'tableFocus',
      boardInteractionMode: 'locked',
      cameraMode: 'tilt',
      currentOpponent: opponentId,
      targetPos: null,
      moveInput: [0, 0],
      sprinting: false,
    }),
  finishTableFocus: () => set({ scene: 'match' }),
  exitMatch: () =>
    set({
      scene: 'world',
      boardInteractionMode: 'world',
      cameraMode: 'tilt',
      currentOpponent: null,
      moveInput: [0, 0],
    }),
}))

if (typeof window !== 'undefined') {
  ;(window as unknown as { __store: typeof useGameStore }).__store = useGameStore
}
