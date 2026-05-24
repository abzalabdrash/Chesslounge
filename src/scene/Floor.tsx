import { useGameStore } from '../store/gameStore'

export function Floor() {
  const setTarget = useGameStore((s) => s.setTarget)

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onPointerDown={(e) => {
        e.stopPropagation()
        setTarget([e.point.x, e.point.z])
      }}
    >
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#241f2e" />
    </mesh>
  )
}
