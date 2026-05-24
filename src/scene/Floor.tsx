import { useGameStore } from '../store/gameStore'

const PLANK_LINES = Array.from({ length: 13 }, (_, i) => -12 + i * 2)

export function Floor() {
  const setTarget = useGameStore((s) => s.setTarget)

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerDown={(e) => {
          e.stopPropagation()
          setTarget([e.point.x, e.point.z])
        }}
      >
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#d7aa67" roughness={0.78} metalness={0.0} />
      </mesh>
      {PLANK_LINES.map((z) => (
        <mesh
          key={z}
          position={[0, 0.006, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[24, 0.045]} />
          <meshStandardMaterial color="#b98246" />
        </mesh>
      ))}
      <mesh position={[-6, 0.01, -2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.4, 4.6]} />
        <meshStandardMaterial color="#aadf7a" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.011, -4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.2, 4.7]} />
        <meshStandardMaterial color="#ffd37c" roughness={0.85} />
      </mesh>
      <mesh position={[6, 0.012, -2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.4, 4.6]} />
        <meshStandardMaterial color="#75d9c7" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.013, 4.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[11, 2.4]} />
        <meshStandardMaterial color="#8fd3ff" roughness={0.9} />
      </mesh>
    </group>
  )
}
