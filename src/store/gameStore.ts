import { create } from 'zustand'

export type Vec2 = [number, number]
export type Scene = 'world' | 'match'

export interface GameState {
  scene: Scene
  targetPos: Vec2 | null
  nearTable: string | null
  currentOpponent: string | null
  setTarget: (p: Vec2 | null) => void
  setNearTable: (id: string | null) => void
  enterMatch: (opponentId: string) => void
  exitMatch: () => void
}

export const useGameStore = create<GameState>((set) => ({
  scene: 'world',
  targetPos: null,
  nearTable: null,
  currentOpponent: null,
  setTarget: (p) => set({ targetPos: p }),
  setNearTable: (id) => set({ nearTable: id }),
  enterMatch: (opponentId) =>
    set({ scene: 'match', currentOpponent: opponentId, targetPos: null }),
  exitMatch: () => set({ scene: 'world', currentOpponent: null }),
}))

if (typeof window !== 'undefined') {
  ;(window as unknown as { __store: typeof useGameStore }).__store = useGameStore
}
