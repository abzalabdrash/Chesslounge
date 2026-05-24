import { useEffect } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'

const TABLE_RUGS = [
  { key: 'hustler', position: [-6, 0.012, -2] as [number, number, number], size: [5.4, 4.6] as [number, number], color: '#70413c', trim: '#b08a52' },
  { key: 'maestro', position: [0, 0.013, -4] as [number, number, number], size: [5.25, 4.7] as [number, number], color: '#273f5d', trim: '#c5a365' },
  { key: 'tilt', position: [6, 0.014, -2] as [number, number, number], size: [5.4, 4.6] as [number, number], color: '#536b57', trim: '#b99a63' },
]

function RugZone({
  position,
  size,
  color,
  trim,
  fabricMaps,
}: {
  position: [number, number, number]
  size: [number, number]
  color: string
  trim: string
  fabricMaps: THREE.Texture[]
}) {
  const [fabricColor, fabricNormal, fabricRoughness] = fabricMaps
  const [width, depth] = size
  const border = 0.08

  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={size} />
        <meshStandardMaterial
          map={fabricColor}
          normalMap={fabricNormal}
          roughnessMap={fabricRoughness}
          normalScale={new THREE.Vector2(0.35, 0.35)}
          color={color}
          roughness={0.94}
          metalness={0}
        />
      </mesh>
      {[
        [0, depth / 2, width + border * 2, border],
        [0, -depth / 2, width + border * 2, border],
        [-width / 2, 0, border, depth],
        [width / 2, 0, border, depth],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.006, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={trim} roughness={0.78} metalness={0.05} />
        </mesh>
      ))}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, 1.02, 64]} />
        <meshBasicMaterial color={trim} transparent opacity={0.22} />
      </mesh>
    </group>
  )
}

export function Floor() {
  const [colorMap, normalMap, roughnessMap, fabricColor, fabricNormal, fabricRoughness] = useTexture([
    '/assets/materials/WoodFloor051/WoodFloor051_1K-JPG_Color.jpg',
    '/assets/materials/WoodFloor051/WoodFloor051_1K-JPG_NormalGL.jpg',
    '/assets/materials/WoodFloor051/WoodFloor051_1K-JPG_Roughness.jpg',
    '/assets/materials/Fabric018/Fabric018_1K-JPG_Color.jpg',
    '/assets/materials/Fabric018/Fabric018_1K-JPG_NormalGL.jpg',
    '/assets/materials/Fabric018/Fabric018_1K-JPG_Roughness.jpg',
  ]) as THREE.Texture[]

  useEffect(() => {
    for (const texture of [colorMap, normalMap, roughnessMap]) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(4.2, 4.2)
      texture.needsUpdate = true
    }
    for (const texture of [fabricColor, fabricNormal, fabricRoughness]) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(3.5, 3.5)
      texture.needsUpdate = true
    }
  }, [colorMap, normalMap, roughnessMap, fabricColor, fabricNormal, fabricRoughness])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial
          map={colorMap}
          normalMap={normalMap}
          roughnessMap={roughnessMap}
          normalScale={new THREE.Vector2(0.22, 0.22)}
          color="#8b6746"
          roughness={0.9}
          metalness={0.0}
        />
      </mesh>

      {TABLE_RUGS.map((rug) => (
        <RugZone
          key={rug.key}
          position={rug.position}
          size={rug.size}
          color={rug.color}
          trim={rug.trim}
          fabricMaps={[fabricColor, fabricNormal, fabricRoughness]}
        />
      ))}

      <mesh position={[0, 0.011, 4.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[11.5, 2.2]} />
        <meshStandardMaterial
          map={fabricColor}
          normalMap={fabricNormal}
          roughnessMap={fabricRoughness}
          normalScale={new THREE.Vector2(0.25, 0.25)}
          color="#66524b"
          roughness={0.95}
        />
      </mesh>
      <mesh position={[0, 0.017, 3.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[11.5, 0.06]} />
        <meshStandardMaterial color="#b08a52" roughness={0.72} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.017, 5.45]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[11.5, 0.06]} />
        <meshStandardMaterial color="#b08a52" roughness={0.72} metalness={0.08} />
      </mesh>
    </group>
  )
}
