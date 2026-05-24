import { create } from 'zustand'

export type Vec2 = [number, number]
export type Scene = 'world' | 'tableFocus' | 'match'

export interface GameState {
  scene: Scene
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
  enterMatch: (opponentId: string) => void
  finishTableFocus: () => void
  exitMatch: () => void
}

export const useGameStore = create<GameState>((set) => ({
  scene: 'world',
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
  enterMatch: (opponentId) =>
    set({
      scene: 'tableFocus',
      currentOpponent: opponentId,
      targetPos: null,
      moveInput: [0, 0],
      sprinting: false,
    }),
  finishTableFocus: () => set({ scene: 'match' }),
  exitMatch: () => set({ scene: 'world', currentOpponent: null, moveInput: [0, 0] }),
}))

if (typeof window !== 'undefined') {
  ;(window as unknown as { __store: typeof useGameStore }).__store = useGameStore
}
