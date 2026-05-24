import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Clone, useGLTF } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'
import { Floor } from './Floor'
import { Player } from './Player'
import { Table } from './Table'
import { PhysicalChessBoard } from './PhysicalChessBoard'
import { TABLES, PLAYER_MODEL } from './tables'
import { preloadNpcs } from './Npc'
import { useGameStore } from '../store/gameStore'
import type { ChessMatchController } from '../match/useChessMatch'

preloadNpcs([...TABLES.map((t) => t.model), PLAYER_MODEL])

const WALL_COLOR = '#382a25'
const WALL_TRIM = '#9b7444'
const CAMERA_FOCUS_TIME = 1.05
const FURNITURE = {
  bookcase: '/models/furniture/bookcaseOpen.glb',
  books: '/models/furniture/books.glb',
  chair: '/models/furniture/chairModernCushion.glb',
  floorLamp: '/models/furniture/lampSquareFloor.glb',
  tableLamp: '/models/furniture/lampRoundTable.glb',
  plant: '/models/furniture/plantSmall2.glb',
  rug: '/models/furniture/rugRound.glb',
  sideTable: '/models/furniture/sideTable.glb',
  coffeeTable: '/models/furniture/tableCoffeeSquare.glb',
}

Object.values(FURNITURE).forEach((url) => useGLTF.preload(url))

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
    const { scene, currentOpponent, playerPos, finishTableFocus, cameraMode } = useGameStore.getState()

    if ((scene === 'tableFocus' || scene === 'match') && currentOpponent) {
      const table = TABLES.find((t) => t.id === currentOpponent)
      if (!table) {
        finishTableFocus()
        return
      }

      const focusKey = `${currentOpponent}:${cameraMode}`
      if (focusOpponentRef.current !== focusKey) {
        focusOpponentRef.current = focusKey
        focusElapsedRef.current = 0
        focusStartRef.current.copy(camera.position)
      }

      focusElapsedRef.current += dt
      const t = Math.min(1, focusElapsedRef.current / CAMERA_FOCUS_TIME)
      const eased = easeOutCubic(t)
      const targetPos =
        cameraMode === 'top'
          ? new THREE.Vector3(table.position[0], 4.35, table.position[2])
          : // tilt: pulled up + slightly closer for clearer piece silhouettes
            new THREE.Vector3(table.position[0], 3.95, table.position[2] + 1.75)
      lookTarget.current.set(table.position[0], 0.98, table.position[2])
      if (cameraMode === 'top') {
        camera.up.set(0, 0, -1)
      } else {
        camera.up.set(0, 1, 0)
      }
      camera.position.lerpVectors(focusStartRef.current, targetPos, eased)
      camera.lookAt(lookTarget.current)
      if (scene === 'tableFocus' && t >= 1) {
        focusOpponentRef.current = null
        finishTableFocus()
      }
      return
    }

    focusOpponentRef.current = null
    camera.up.set(0, 1, 0)
    const followPos = new THREE.Vector3(playerPos[0], 9.7, playerPos[1] + 7.4)
    const followLook = new THREE.Vector3(playerPos[0], 0.45, playerPos[1] - 0.55)
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
      {/* Front wall — full height to match the back wall so the room is
          properly closed. Top-down camera looks straight down so this no
          longer blocks the gameplay view. */}
      <mesh position={[0, 2.5, 8.6]} receiveShadow castShadow>
        <boxGeometry args={[24, 5, 0.4]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.2, 8.4]}>
        <boxGeometry args={[24, 0.06, 0.05]} />
        <meshStandardMaterial color="#c49a52" emissive="#c49a52" emissiveIntensity={0.08} />
      </mesh>
      {/* Wainscoting trim on back wall */}
      <mesh position={[0, 1.2, -9.78]}>
        <boxGeometry args={[24, 0.06, 0.05]} />
        <meshStandardMaterial color="#c49a52" emissive="#c49a52" emissiveIntensity={0.08} />
      </mesh>
      {[-9, -6, -3, 0, 3, 6, 9].map((x) => (
        <group key={x} position={[x, 0, -9.76]}>
          <mesh position={[0, 2.35, 0]}>
            <boxGeometry args={[1.85, 1.55, 0.045]} />
            <meshStandardMaterial color="#2f211d" roughness={0.88} />
          </mesh>
          <mesh position={[0, 2.35, 0.035]}>
            <boxGeometry args={[1.58, 1.25, 0.035]} />
            <meshStandardMaterial color="#463026" roughness={0.82} />
          </mesh>
        </group>
      ))}
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
        intensity={5.5}
        color="#fbbf24"
        distance={6}
        decay={1.6}
        castShadow={false}
      />
      <spotLight
        position={[0, 0.45, 0]}
        target-position={[0, -1.2, 0]}
        intensity={3.6}
        angle={0.7}
        penumbra={0.72}
        distance={5.4}
        color="#ffe6a3"
        castShadow
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
              <meshStandardMaterial color={['#5b2333', '#233a5b', '#b08a52', '#3f5c4a'][i]} roughness={0.72} />
            </mesh>
          ))}
        </group>
      ))}

      <group position={[0, 0, 6.2]}>
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.45, 0.5, 0.78]} />
          <meshStandardMaterial color="#4a1f25" roughness={0.86} />
        </mesh>
        <mesh position={[0, 0.68, -0.3]} castShadow receiveShadow>
          <boxGeometry args={[3.55, 0.68, 0.2]} />
          <meshStandardMaterial color="#32181b" roughness={0.88} />
        </mesh>
        {[-1.45, 1.45].map((x) => (
          <mesh key={x} position={[x, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.26, 0.62, 0.86]} />
            <meshStandardMaterial color="#2a1417" roughness={0.88} />
          </mesh>
        ))}
      </group>

      <group position={[0, 0, -8.25]}>
        <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.42, 0.52, 0.72, 18]} />
          <meshStandardMaterial color="#4c3328" roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.8, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.28, 0.18, 18]} />
          <meshStandardMaterial color="#c79a45" roughness={0.38} metalness={0.35} />
        </mesh>
        <mesh position={[0, 1.08, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.2, 0.42, 18]} />
          <meshStandardMaterial color="#d7aa55" roughness={0.34} metalness={0.38} />
        </mesh>
        <mesh position={[0, 1.34, 0]} castShadow>
          <sphereGeometry args={[0.15, 18, 12]} />
          <meshStandardMaterial color="#f0c86a" roughness={0.3} metalness={0.42} />
        </mesh>
        <pointLight position={[0, 1.5, 0.35]} intensity={1.1} distance={3.2} color="#ffde8a" />
      </group>

      {[-3.6, 3.6].map((x) => (
        <group key={x} position={[x, 1.95, -9.72]}>
          <mesh>
            <boxGeometry args={[1.18, 0.82, 0.04]} />
            <meshStandardMaterial color="#7a5733" roughness={0.72} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <boxGeometry args={[0.96, 0.6, 0.035]} />
            <meshStandardMaterial color="#ead7b1" roughness={0.82} />
          </mesh>
          {[-0.27, -0.09, 0.09, 0.27].map((gx) => (
            <mesh key={gx} position={[gx, 0, 0.06]}>
              <boxGeometry args={[0.025, 0.55, 0.025]} />
              <meshStandardMaterial color="#8c744f" roughness={0.78} />
            </mesh>
          ))}
          {[-0.18, 0.18].map((gy) => (
            <mesh key={gy} position={[0, gy, 0.06]}>
              <boxGeometry args={[0.86, 0.025, 0.025]} />
              <meshStandardMaterial color="#8c744f" roughness={0.78} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function FurnitureModel({
  url,
  position,
  rotationY = 0,
  scale = 1,
}: {
  url: string
  position: [number, number, number]
  rotationY?: number
  scale?: number | [number, number, number]
}) {
  const { scene } = useGLTF(url)
  return (
    <Clone
      object={scene}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
      castShadow
      receiveShadow
    />
  )
}

function LuxeFurniture() {
  return (
    <group>
      <FurnitureModel url={FURNITURE.bookcase} position={[-9.2, 0, -7.35]} rotationY={0.02} scale={1.2} />
      <FurnitureModel url={FURNITURE.bookcase} position={[9.2, 0, -7.35]} rotationY={-0.02} scale={1.2} />
      <FurnitureModel url={FURNITURE.books} position={[-8.45, 1.15, -7.05]} rotationY={0.08} scale={0.8} />
      <FurnitureModel url={FURNITURE.books} position={[8.45, 1.15, -7.05]} rotationY={-0.08} scale={0.8} />

      <FurnitureModel url={FURNITURE.floorLamp} position={[-10.2, 0, 2.4]} scale={1.1} />
      <FurnitureModel url={FURNITURE.floorLamp} position={[10.2, 0, 2.4]} rotationY={Math.PI} scale={1.1} />

      {/* Hand-built couch lives in DecorProps; small chairs + side coffee
          table removed (they cluttered the floor between the player and the
          tables). Floor lamps stay so the lounge still feels furnished. */}
    </group>
  )
}

export function World({ match }: { match?: ChessMatchController }) {
  const activeTable = match?.active
    ? TABLES.find((t) => t.id === useGameStore.getState().currentOpponent)
    : undefined

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
      camera={{ position: [0, 13, 10], fov: 35 }}
      className="absolute inset-0"
    >
      <CameraRig />

      <color attach="background" args={['#15100c']} />
      <fog attach="fog" args={['#1a130d', 18, 42]} />

      <ambientLight intensity={0.43} color="#fff1d3" />
      <hemisphereLight args={['#d8edff', '#3b241c', 0.58]} />
      <directionalLight
        castShadow
        position={[4, 12, 5]}
        intensity={1.18}
        color="#ffe0a3"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      {/* Subtle blue rim from window */}
      <directionalLight position={[-9, 7, 3]} intensity={0.45} color="#8fd3ff" />
      <spotLight
        position={[-9.5, 5.2, -5.6]}
        intensity={1.8}
        angle={0.34}
        penumbra={0.8}
        distance={15}
        color="#fff0c2"
        castShadow
      />

      <Walls />
      <Floor />
      <DecorProps />
      <LuxeFurniture />

      {TABLES.map((t) => (
        <PendantLamp
          key={`lamp-${t.id}`}
          position={[t.position[0], 4.2, t.position[2]]}
        />
      ))}

      {TABLES.map((t) => (
        <Table key={t.id} config={t} />
      ))}
      {activeTable && match && <PhysicalChessBoard table={activeTable} match={match} />}
      <Player />
    </Canvas>
  )
}
