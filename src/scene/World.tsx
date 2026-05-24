import { Canvas } from '@react-three/fiber'
import { Floor } from './Floor'
import { Player } from './Player'
import { Table } from './Table'
import { TABLES } from './tables'

const WALL_COLOR = '#1a1320'
const WALL_TRIM = '#2a1d33'

function Walls() {
  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 2.5, -10]} receiveShadow>
        <boxGeometry args={[24, 5, 0.4]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.85} />
      </mesh>
      {/* Wainscoting trim on back wall */}
      <mesh position={[0, 1.2, -9.78]}>
        <boxGeometry args={[24, 0.06, 0.05]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.15} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-12, 2.5, -2]} receiveShadow>
        <boxGeometry args={[0.4, 5, 16]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.85} />
      </mesh>
      {/* Right wall */}
      <mesh position={[12, 2.5, -2]} receiveShadow>
        <boxGeometry args={[0.4, 5, 16]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.85} />
      </mesh>
      {/* Floor border accent */}
      <mesh position={[0, 0.02, -9.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 0.6]} />
        <meshStandardMaterial color={WALL_TRIM} />
      </mesh>
    </group>
  )
}

function PendantLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Cord */}
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.6, 6]} />
        <meshBasicMaterial color="#222" />
      </mesh>
      {/* Lamp shade */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <coneGeometry args={[0.45, 0.45, 16, 1, true]} />
        <meshStandardMaterial
          color="#3a2418"
          side={2}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>
      {/* Bulb glow */}
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial color="#fde68a" toneMapped={false} />
      </mesh>
      {/* Warm point light */}
      <pointLight
        position={[0, 0.55, 0]}
        intensity={4}
        color="#fbbf24"
        distance={6}
        decay={1.6}
        castShadow={false}
      />
    </group>
  )
}

export function World() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 14, 11], fov: 38 }}
      className="absolute inset-0"
    >
      <color attach="background" args={['#0e0a14']} />
      <fog attach="fog" args={['#0e0a14', 16, 38]} />

      <ambientLight intensity={0.25} color="#5a4a3a" />
      <directionalLight
        castShadow
        position={[6, 16, 6]}
        intensity={0.8}
        color="#ffe4b5"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      {/* Subtle blue rim from window */}
      <directionalLight position={[-8, 8, 4]} intensity={0.2} color="#8b9dc3" />

      <Walls />
      <Floor />

      {TABLES.map((t) => (
        <PendantLamp
          key={`lamp-${t.id}`}
          position={[t.position[0], 4.2, t.position[2]]}
        />
      ))}

      {TABLES.map((t) => (
        <Table key={t.id} config={t} />
      ))}
      <Player />
    </Canvas>
  )
}
