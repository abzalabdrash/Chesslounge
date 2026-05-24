import { Text } from '@react-three/drei'
import { useGameStore } from '../store/gameStore'
import type { TableConfig } from './tables'
import { Npc } from './Npc'

const LEG_OFFSETS: [number, number][] = [
  [-0.6, -0.6],
  [0.6, -0.6],
  [-0.6, 0.6],
  [0.6, 0.6],
]

const BOARD_SQUARES = Array.from({ length: 64 }, (_, i) => ({
  x: (i % 8 - 3.5) * 0.105,
  z: (Math.floor(i / 8) - 3.5) * 0.105,
  light: (i + Math.floor(i / 8)) % 2 === 0,
}))

export function Table({ config }: { config: TableConfig }) {
  const nearTable = useGameStore((s) => s.nearTable)
  const isActive = nearTable === config.id

  return (
    <group position={config.position}>
      <mesh position={[0, 0.68, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.72, 0.18, 1.72]} />
        <meshStandardMaterial color="#9a5f2e" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.82, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.52, 0.14, 1.52]} />
        <meshStandardMaterial color="#c9853e" roughness={0.68} />
      </mesh>
      <mesh position={[0, 0.91, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.34, 0.045, 1.34]} />
        <meshStandardMaterial color="#f0bf6a" roughness={0.7} />
      </mesh>

      {LEG_OFFSETS.map(([lx, lz], i) => (
        <mesh key={i} position={[lx * 0.76, 0.35, lz * 0.76]} castShadow>
          <boxGeometry args={[0.14, 0.7, 0.14]} />
          <meshStandardMaterial color="#74421f" roughness={0.8} />
        </mesh>
      ))}

      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.94, 0.035, 0.94]} />
        <meshStandardMaterial color="#5d4034" roughness={0.62} />
      </mesh>
      {BOARD_SQUARES.map((sq, i) => (
        <mesh key={i} position={[sq.x, 0.974, sq.z]}>
          <boxGeometry args={[0.105, 0.008, 0.105]} />
          <meshStandardMaterial color={sq.light ? '#ffe7b3' : '#5c7f64'} roughness={0.7} />
        </mesh>
      ))}

      <Npc
        url={config.model}
        position={[0, 0, -1.1]}
        rotationY={Math.PI}
        scale={0.95}
        tint={config.accent}
      />

      <mesh position={[0, 0.18, -1.1]} castShadow>
        <cylinderGeometry args={[0.32, 0.38, 0.36, 16]} />
        <meshStandardMaterial color="#86552b" roughness={0.74} />
      </mesh>
      <mesh position={[0, 0.54, 1.1]} castShadow>
        <cylinderGeometry args={[0.36, 0.42, 0.42, 16]} />
        <meshStandardMaterial color="#5b6fb8" roughness={0.74} />
      </mesh>
      <mesh position={[-0.58, 0.98, 0.5]} castShadow>
        <cylinderGeometry args={[0.08, 0.07, 0.12, 14]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.45} />
      </mesh>
      <mesh position={[-0.58, 1.06, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.08, 0.012, 8, 18]} />
        <meshStandardMaterial color={config.accent} roughness={0.45} />
      </mesh>
      <mesh position={[0.52, 1.0, -0.5]} rotation={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.32, 0.055, 0.22]} />
        <meshStandardMaterial color="#2b4f7d" roughness={0.7} />
      </mesh>
      <mesh position={[0.54, 1.04, -0.5]} rotation={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.3, 0.035, 0.2]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.7} />
      </mesh>

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
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
            <ringGeometry args={[1.68, 1.76, 48]} />
            <meshBasicMaterial color="#fff3a3" transparent opacity={0.95} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
            <ringGeometry args={[1.05, 1.22, 48]} />
            <meshBasicMaterial color={config.accent} transparent opacity={0.25} />
          </mesh>
        </group>
      )}
    </group>
  )
}
