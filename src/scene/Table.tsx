import { Text } from '@react-three/drei'
import { useGameStore } from '../store/gameStore'
import type { TableConfig } from './tables'

const LEG_OFFSETS: [number, number][] = [
  [-0.6, -0.6],
  [0.6, -0.6],
  [-0.6, 0.6],
  [0.6, 0.6],
]

export function Table({ config }: { config: TableConfig }) {
  const nearTable = useGameStore((s) => s.nearTable)
  const isActive = nearTable === config.id

  return (
    <group position={config.position}>
      {/* tabletop */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.08, 1.4]} />
        <meshStandardMaterial color="#3a2418" />
      </mesh>

      {/* legs */}
      {LEG_OFFSETS.map(([lx, lz], i) => (
        <mesh key={i} position={[lx * 0.65, 0.35, lz * 0.65]} castShadow>
          <boxGeometry args={[0.1, 0.7, 0.1]} />
          <meshStandardMaterial color="#2a1810" />
        </mesh>
      ))}

      {/* mini board on table */}
      <mesh position={[0, 0.795, 0]} castShadow>
        <boxGeometry args={[1.0, 0.02, 1.0]} />
        <meshStandardMaterial color="#f5deb3" />
      </mesh>
      <mesh position={[0, 0.81, 0]}>
        <boxGeometry args={[1.0, 0.005, 1.0]} />
        <meshBasicMaterial color="#000" wireframe opacity={0.15} transparent />
      </mesh>

      {/* opponent NPC sitting behind */}
      <group position={[0, 0, -1.1]}>
        <mesh castShadow position={[0, 0.6, 0]}>
          <boxGeometry args={[0.5, 1.2, 0.4]} />
          <meshStandardMaterial color={config.color} />
        </mesh>
        <mesh castShadow position={[0, 1.45, 0]}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial color={config.skinColor} />
        </mesh>
      </group>

      {/* floating label */}
      <Text
        position={[0, 2.6, 0]}
        fontSize={0.32}
        color={isActive ? '#fbbf24' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {config.label}
      </Text>
      <Text
        position={[0, 2.25, 0]}
        fontSize={0.18}
        color={isActive ? '#fbbf24' : '#a3a3a3'}
        anchorX="center"
        anchorY="middle"
      >
        {`ELO ${config.elo}`}
      </Text>

      {/* interaction ring */}
      {isActive && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[1.8, 2.0, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  )
}
