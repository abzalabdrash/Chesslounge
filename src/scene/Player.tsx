import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { TABLES } from './tables'
import { MainCharacter, type CharState } from './MainCharacter'
import { getMoveSpeed } from './playerControls'
import { resolveMove } from './obstacles'

const TABLE_PROXIMITY = 2.2
// Room limits hug the walls so the player can reach them but can't pass through.
const ROOM_LIMIT_X = 11.4
const ROOM_LIMIT_Z_MIN = -9.4
const ROOM_LIMIT_Z_MAX = 8.2
const MOVING_EPS = 0.005

// Player seat across the table from the NPC. NPC sits at -sitDistance on local
// z-axis; player mirrors to +sitDistance. Tuned a bit larger so knees don't clip
// the table-leg bracket on the player side.
const PLAYER_SEAT_DISTANCE = 1.45
const PLAYER_SEAT_Y_OFFSET = 0.0 // override here if Meshy sit pose floats

export function Player() {
  const ref = useRef<THREE.Group>(null!)
  const [charState, setCharState] = useState<CharState>('idle')
  const lastState = useRef<CharState>('idle')

  // Teleport to the player-side seat the moment we enter a match.
  const scene = useGameStore((s) => s.scene)
  const currentOpponent = useGameStore((s) => s.currentOpponent)
  useEffect(() => {
    if (!ref.current) return
    if ((scene === 'tableFocus' || scene === 'match') && currentOpponent) {
      const table = TABLES.find((t) => t.id === currentOpponent)
      if (!table) return
      ref.current.position.set(
        table.position[0],
        PLAYER_SEAT_Y_OFFSET,
        table.position[2] + PLAYER_SEAT_DISTANCE,
      )
      // face the table (NPC is on the opposite side at -sitDistance)
      ref.current.rotation.y = Math.PI
      setCharState('sit')
      lastState.current = 'sit'
    } else if (scene === 'world') {
      // returning to world: spawn just outside the last table so we can see the player
      setCharState('idle')
      lastState.current = 'idle'
    }
  }, [scene, currentOpponent])

  useFrame((_, dt) => {
    if (!ref.current) return
    const pos = ref.current.position
    const { scene, nearTable, moveInput, sprinting } = useGameStore.getState()
    const isWorldInteractive = scene === 'world'
    const hasMoveInput = isWorldInteractive && (moveInput[0] !== 0 || moveInput[1] !== 0)

    // Lock movement & animation while seated.
    if (!isWorldInteractive) {
      useGameStore.getState().setPlayerPos([pos.x, pos.z])
      return
    }

    let stepLen = 0

    if (hasMoveInput) {
      const speed = getMoveSpeed(sprinting)
      const dx = moveInput[0] * speed * dt
      const dz = moveInput[1] * speed * dt
      const next = resolveMove(pos.x, pos.z, dx, dz)
      const clampedX = THREE.MathUtils.clamp(next.x, -ROOM_LIMIT_X, ROOM_LIMIT_X)
      const clampedZ = THREE.MathUtils.clamp(next.z, ROOM_LIMIT_Z_MIN, ROOM_LIMIT_Z_MAX)
      stepLen = Math.hypot(clampedX - pos.x, clampedZ - pos.z)
      pos.x = clampedX
      pos.z = clampedZ
      const angle = Math.atan2(moveInput[0], moveInput[1])
      ref.current.rotation.y = angle
    }

    const nowMoving = stepLen > MOVING_EPS
    const nextState: CharState = !nowMoving ? 'idle' : sprinting ? 'run' : 'walk'
    if (nextState !== lastState.current) {
      lastState.current = nextState
      setCharState(nextState)
    }

    useGameStore.getState().setPlayerPos([pos.x, pos.z])

    let near: string | null = null
    let bestDist = TABLE_PROXIMITY
    for (const t of TABLES) {
      const dx = pos.x - t.position[0]
      const dz = pos.z - t.position[2]
      const d = Math.hypot(dx, dz)
      if (d < bestDist) {
        bestDist = d
        near = t.id
      }
    }
    if (near !== nearTable) {
      useGameStore.setState({ nearTable: near })
    }
  })

  return (
    <group ref={ref} position={[0, 0, 5]}>
      <MainCharacter state={charState} scale={1.0} />
      {/* warm aura under feet to make the player visible against dark floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.3, 0.42, 24]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} />
      </mesh>
    </group>
  )
}
