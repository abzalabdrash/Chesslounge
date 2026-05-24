import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { TABLES } from './tables'
import { MainCharacter } from './MainCharacter'
import { getMoveSpeed } from './playerControls'

const TABLE_PROXIMITY = 2.2
const ROOM_LIMIT_X = 10.5
const ROOM_LIMIT_Z_MIN = -8.4
const ROOM_LIMIT_Z_MAX = 8.4
const MOVING_EPS = 0.005

export function Player() {
  const ref = useRef<THREE.Group>(null!)
  const [moving, setMoving] = useState(false)
  const lastMoving = useRef(false)

  useFrame((_, dt) => {
    if (!ref.current) return
    const pos = ref.current.position
    const { scene, targetPos, nearTable, moveInput, sprinting } = useGameStore.getState()
    const isWorldInteractive = scene === 'world'
    const hasMoveInput = isWorldInteractive && (moveInput[0] !== 0 || moveInput[1] !== 0)

    let stepLen = 0

    if (hasMoveInput) {
      const speed = getMoveSpeed(sprinting)
      const dx = moveInput[0] * speed * dt
      const dz = moveInput[1] * speed * dt
      pos.x = THREE.MathUtils.clamp(pos.x + dx, -ROOM_LIMIT_X, ROOM_LIMIT_X)
      pos.z = THREE.MathUtils.clamp(pos.z + dz, ROOM_LIMIT_Z_MIN, ROOM_LIMIT_Z_MAX)
      const angle = Math.atan2(moveInput[0], moveInput[1])
      ref.current.rotation.y = angle
      stepLen = Math.hypot(dx, dz)
    } else if (isWorldInteractive && targetPos) {
      const target = new THREE.Vector3(targetPos[0], pos.y, targetPos[1])
      const direction = target.clone().sub(pos)
      const distance = direction.length()
      if (distance < 0.05) {
        useGameStore.setState({ targetPos: null })
      } else {
        direction.normalize()
        const step = Math.min(getMoveSpeed(false) * dt, distance)
        pos.add(direction.multiplyScalar(step))
        pos.x = THREE.MathUtils.clamp(pos.x, -ROOM_LIMIT_X, ROOM_LIMIT_X)
        pos.z = THREE.MathUtils.clamp(pos.z, ROOM_LIMIT_Z_MIN, ROOM_LIMIT_Z_MAX)
        const angle = Math.atan2(direction.x, direction.z)
        ref.current.rotation.y = angle
        stepLen = step
      }
    }

    const nowMoving = stepLen > MOVING_EPS
    if (nowMoving !== lastMoving.current) {
      lastMoving.current = nowMoving
      setMoving(nowMoving)
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
      <MainCharacter moving={moving} scale={1.0} />
      {/* warm aura under feet to make the player visible against dark floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.3, 0.42, 24]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} />
      </mesh>
    </group>
  )
}
