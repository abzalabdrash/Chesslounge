import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import { TABLES } from './tables'

const SPEED = 6
const TABLE_PROXIMITY = 2.2

export function Player() {
  const ref = useRef<THREE.Group>(null!)

  useFrame((_, dt) => {
    if (!ref.current) return
    const pos = ref.current.position
    const { targetPos, nearTable } = useGameStore.getState()

    if (targetPos) {
      const target = new THREE.Vector3(targetPos[0], pos.y, targetPos[1])
      const direction = target.clone().sub(pos)
      const distance = direction.length()
      if (distance < 0.05) {
        useGameStore.setState({ targetPos: null })
      } else {
        direction.normalize()
        const step = Math.min(SPEED * dt, distance)
        pos.add(direction.multiplyScalar(step))
        const angle = Math.atan2(direction.x, direction.z)
        ref.current.rotation.y = angle
      }
    }

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
    <group ref={ref} position={[0, 0.6, 5]}>
      <mesh castShadow>
        <boxGeometry args={[0.5, 1.2, 0.4]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
      <mesh castShadow position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
      <mesh position={[0, 0, 0.27]}>
        <boxGeometry args={[0.1, 0.05, 0.05]} />
        <meshStandardMaterial color="#000" />
      </mesh>
    </group>
  )
}
