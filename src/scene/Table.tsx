import { useEffect } from 'react'
import { Text, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../store/gameStore'
import type { TableConfig } from './tables'
import { Npc } from './Npc'
import { Persona } from './Persona'

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
  const scene = useGameStore((s) => s.scene)
  const currentOpponent = useGameStore((s) => s.currentOpponent)
  const isActive = nearTable === config.id
  const isBoardLocked = scene === 'match' && currentOpponent === config.id
  const [woodColor, woodNormal, woodRoughness] = useTexture([
    '/assets/materials/Wood027/Wood027_1K-JPG_Color.jpg',
    '/assets/materials/Wood027/Wood027_1K-JPG_NormalGL.jpg',
    '/assets/materials/Wood027/Wood027_1K-JPG_Roughness.jpg',
  ]) as THREE.Texture[]

  useEffect(() => {
    for (const texture of [woodColor, woodNormal, woodRoughness]) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(1.5, 1.5)
      texture.needsUpdate = true
    }
  }, [woodColor, woodNormal, woodRoughness])

  return (
    <group position={config.position}>
      <mesh position={[0, 0.68, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.72, 0.18, 1.72]} />
        <meshStandardMaterial map={woodColor} normalMap={woodNormal} roughnessMap={woodRoughness} color="#a86f36" roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.82, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.52, 0.14, 1.52]} />
        <meshStandardMaterial map={woodColor} normalMap={woodNormal} roughnessMap={woodRoughness} color="#c9873e" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.91, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.34, 0.045, 1.34]} />
        <meshStandardMaterial map={woodColor} normalMap={woodNormal} roughnessMap={woodRoughness} color="#e7b860" roughness={0.64} />
      </mesh>

      {LEG_OFFSETS.map(([lx, lz], i) => (
        <mesh key={i} position={[lx * 0.76, 0.35, lz * 0.76]} castShadow>
          <boxGeometry args={[0.14, 0.7, 0.14]} />
          <meshStandardMaterial map={woodColor} normalMap={woodNormal} roughnessMap={woodRoughness} color="#74421f" roughness={0.72} />
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
      {/* Tabletop is always empty — no decorative pieces, no cups. The live
          match pieces are rendered by PhysicalChessBoard. */}

      {config.sitModel ? (
        <group position={[config.sitOffsetX ?? 0, 0, -(config.sitDistance ?? 1.35)]}>
          <Persona
            url={config.sitModel}
            yOffset={config.sitYOffset ?? 0}
            scale={config.sitScale ?? 1}
            rotationY={config.sitRotationY ?? 0}
          />
        </group>
      ) : (
        <Npc
          url={config.model}
          position={[0, 0, -1.1]}
          rotationY={Math.PI}
          scale={0.95}
          tint={config.accent}
        />
      )}

      {/* wooden stools on BOTH sides — NPC behind, player in front */}
      {(() => {
        const npcSeatTop = config.sitStoolHeight ?? 0.21
        const playerSeatTop = 0.46 // matches Meshy Sit_to_Stand seated hip height
        const seatThickness = 0.06

        const renderStool = (z: number, seatTop: number) => {
          const seatCenterY = seatTop - seatThickness / 2
          const legHeight = seatTop - seatThickness
          const legY = legHeight / 2
          return (
            <group position={[0, 0, z]}>
              <mesh position={[0, seatCenterY, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.55, seatThickness, 0.55]} />
                <meshStandardMaterial color="#86552b" roughness={0.74} />
              </mesh>
              {[
                [-0.22, -0.22],
                [0.22, -0.22],
                [-0.22, 0.22],
                [0.22, 0.22],
              ].map(([lx, lz], i) => (
                <mesh key={i} position={[lx, legY, lz]} castShadow>
                  <boxGeometry args={[0.05, legHeight, 0.05]} />
                  <meshStandardMaterial color="#5b3a1a" roughness={0.78} />
                </mesh>
              ))}
            </group>
          )
        }

        return (
          <>
            {renderStool(-(config.sitDistance ?? 1.35), npcSeatTop)}
            {renderStool(1.45, playerSeatTop)}
          </>
        )
      })()}

      {!isBoardLocked && (
        <>
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
        </>
      )}

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
