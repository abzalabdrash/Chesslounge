import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { Floor } from './Floor'
import { Player } from './Player'
import { Table } from './Table'
import { TABLES, PLAYER_MODEL } from './tables'
import { preloadNpcs } from './Npc'
import { useGameStore } from '../store/gameStore'

preloadNpcs([...TABLES.map((t) => t.model), PLAYER_MODEL])

const WALL_COLOR = '#46352e'
const WALL_TRIM = '#7c5a39'
const CAMERA_FOCUS_TIME = 1.05

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function CameraRig() {
  const { camera } = useThree()
  const focusStartRef = useRef(new THREE.Vector3())
  const focusElapsedRef = useRef(0)
  const focusOpponentRef = useRef<string | null>(null)
  const lookTarget = useRef(new THREE.Vector3())

  useFrame((_, dt) => {
    const { scene, currentOpponent, playerPos, finishTableFocus } = useGameStore.getState()

    if (scene === 'tableFocus' && currentOpponent) {
      const table = TABLES.find((t) => t.id === currentOpponent)
      if (!table) {
        finishTableFocus()
        return
      }

      if (focusOpponentRef.current !== currentOpponent) {
        focusOpponentRef.current = currentOpponent
        focusElapsedRef.current = 0
        focusStartRef.current.copy(camera.position)
      }

      focusElapsedRef.current += dt
      const t = Math.min(1, focusElapsedRef.current / CAMERA_FOCUS_TIME)
      const eased = easeOutCubic(t)
      const targetPos = new THREE.Vector3(table.position[0], 5.2, table.position[2] + 4.1)
      lookTarget.current.set(table.position[0], 0.85, table.position[2] - 0.2)
      camera.position.lerpVectors(focusStartRef.current, targetPos, eased)
      camera.lookAt(lookTarget.current)
      if (t >= 1) {
        focusOpponentRef.current = null
        finishTableFocus()
      }
      return
    }

    focusOpponentRef.current = null
    const followPos = new THREE.Vector3(playerPos[0], 10.5, playerPos[1] + 8.2)
    const followLook = new THREE.Vector3(playerPos[0], 0.35, playerPos[1] - 0.8)
    camera.position.lerp(followPos, 1 - Math.exp(-dt * 3.8))
    lookTarget.current.lerp(followLook, 1 - Math.exp(-dt * 5.5))
    camera.lookAt(lookTarget.current)
  })

  return null
}

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

function DecorProps() {
  return (
    <group>
      {[-8.5, 8.5].map((x) => (
        <group key={x} position={[x, 0, -7.7]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[1.25, 1.1, 0.34]} />
            <meshStandardMaterial color="#8b5e34" roughness={0.72} />
          </mesh>
          {[0.28, 0.62, 0.94].map((y) => (
            <mesh key={y} position={[0, y, 0.2]} castShadow>
              <boxGeometry args={[1.35, 0.06, 0.14]} />
              <meshStandardMaterial color="#5b3a22" roughness={0.78} />
            </mesh>
          ))}
          {[-0.38, -0.1, 0.22, 0.44].map((bx, i) => (
            <mesh key={bx} position={[bx, 0.82, 0.34]} rotation={[0, 0, (i - 1.5) * 0.08]} castShadow>
              <boxGeometry args={[0.13, 0.34, 0.16]} />
              <meshStandardMaterial color={['#ef4444', '#38bdf8', '#facc15', '#a78bfa'][i]} roughness={0.62} />
            </mesh>
          ))}
        </group>
      ))}

      <group position={[0, 0, 6.2]}>
        <mesh position={[0, 0.24, 0]} castShadow>
          <boxGeometry args={[3.2, 0.48, 0.72]} />
          <meshStandardMaterial color="#65a30d" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.62, -0.26]} castShadow>
          <boxGeometry args={[3.25, 0.62, 0.18]} />
          <meshStandardMaterial color="#4d7c0f" roughness={0.8} />
        </mesh>
        {[-1.45, 1.45].map((x) => (
          <mesh key={x} position={[x, 0.48, 0]} castShadow>
            <boxGeometry args={[0.22, 0.55, 0.78]} />
            <meshStandardMaterial color="#3f6212" roughness={0.8} />
          </mesh>
        ))}
      </group>
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
      <CameraRig />

      <color attach="background" args={['#a7d8ff']} />
      <fog attach="fog" args={['#d9f3ff', 28, 58]} />

      <ambientLight intensity={0.72} color="#fff4d4" />
      <directionalLight
        castShadow
        position={[5, 14, 7]}
        intensity={1.6}
        color="#fff0c2"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      {/* Subtle blue rim from window */}
      <directionalLight position={[-8, 8, 4]} intensity={0.55} color="#8fd3ff" />

      <Walls />
      <Floor />
      <DecorProps />

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
