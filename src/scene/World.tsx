import { Canvas } from '@react-three/fiber'
import { Floor } from './Floor'
import { Player } from './Player'
import { Table } from './Table'
import { TABLES } from './tables'

export function World() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 14, 11], fov: 38 }}
      className="absolute inset-0"
    >
      <color attach="background" args={['#16121e']} />
      <fog attach="fog" args={['#16121e', 18, 40]} />

      <ambientLight intensity={0.45} />
      <directionalLight
        castShadow
        position={[8, 14, 6]}
        intensity={1.3}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[0, 6, 2]} intensity={0.5} color="#fbbf24" />

      <Floor />
      {TABLES.map((t) => (
        <Table key={t.id} config={t} />
      ))}
      <Player />
    </Canvas>
  )
}
