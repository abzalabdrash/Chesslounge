import { useGameStore } from '../store/gameStore'

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
        <meshStandardMaterial color="#3a2818" roughness={0.9} metalness={0.0} />
      </mesh>
      {/* Plank lines for floor texture */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh
          key={i}
          position={[0, 0.005, -8 + i * 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[24, 0.05]} />
          <meshStandardMaterial color="#1f1408" />
        </mesh>
      ))}
    </group>
  )
}
