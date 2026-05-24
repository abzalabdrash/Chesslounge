import { Suspense, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'

interface NpcProps {
  url: string
  scale?: number
  position?: [number, number, number]
  rotationY?: number
  tint?: string
}

function NpcModel({ url, scale = 1, position = [0, 0, 0], rotationY = 0, tint }: NpcProps) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => {
    const c = SkeletonUtils.clone(scene) as THREE.Object3D
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = false
        if (tint && mesh.material) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone()
          if ('color' in mat && mat.color) {
            mat.color.lerp(new THREE.Color(tint), 0.18)
          }
          mesh.material = mat
        }
      }
    })
    return c
  }, [scene, tint])
  return (
    <primitive
      object={cloned}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
    />
  )
}

export function Npc(props: NpcProps) {
  return (
    <Suspense fallback={<NpcFallback {...props} />}>
      <NpcModel {...props} />
    </Suspense>
  )
}

function NpcFallback({ position = [0, 0, 0], tint }: NpcProps) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.6, 0]}>
        <boxGeometry args={[0.5, 1.2, 0.4]} />
        <meshStandardMaterial color={tint ?? '#888'} />
      </mesh>
      <mesh castShadow position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#fde68a" />
      </mesh>
    </group>
  )
}

// preload helper so models start fetching as soon as the module is imported
export function preloadNpcs(urls: string[]) {
  for (const u of urls) {
    useGLTF.preload(u)
  }
}
