import { useEffect, useMemo, useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'

/** Append ?debug=axes to the URL to draw axes/forward arrow on each Persona. */
const DEBUG_AXES =
  typeof window !== 'undefined' && /[?&]debug=axes/.test(window.location.search)

interface PersonaProps {
  url: string
  /** y position of the seated rig root — tweaked per model so butt sits on stool */
  yOffset?: number
  scale?: number
  rotationY?: number
}

/**
 * NPC sitting at a table. The GLB already contains a sit-idle animation
 * (Meshy "Chair Sit Idle" or "Sit Cross Legged"). We just play whatever
 * clip the file ships with on a loop.
 */
export function Persona({ url, yOffset = 0, scale = 1, rotationY = Math.PI }: PersonaProps) {
  const gltf = useGLTF(url)
  const groupRef = useRef<THREE.Group>(null!)

  const scene = useMemo(() => {
    const cloned = SkeletonUtils.clone(gltf.scene) as THREE.Object3D
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = false
        mesh.frustumCulled = false
      }
    })
    if (DEBUG_AXES) {
      // local axes (red=+X green=+Y blue=+Z) at the model root
      cloned.add(new THREE.AxesHelper(0.8))
      // magenta arrow along local -Z (GLTF "forward" by spec)
      cloned.add(
        new THREE.ArrowHelper(
          new THREE.Vector3(0, 0, -1),
          new THREE.Vector3(0, 1.2, 0),
          1.0,
          0xff00ff,
        ),
      )
    }
    return cloned
  }, [gltf.scene])

  // Whatever animation came with the file — play it on loop.
  const clips = useMemo(
    () => gltf.animations.map((c) => c.clone()),
    [gltf.animations],
  )
  const { actions } = useAnimations(clips, groupRef)

  useEffect(() => {
    // Merged Meshy GLBs ship several clips. Prefer a sit-idle clip if present,
    // otherwise fall back to clip 0 so single-anim files still work.
    const names = Object.keys(actions)
    const preferred =
      names.find((n) => /sit.*idle|chair.*idle|idle.*sit/i.test(n)) ??
      names.find((n) => /sit|chair/i.test(n)) ??
      names.find((n) => /idle/i.test(n)) ??
      names[0]
    const action = preferred ? actions[preferred] : undefined
    if (!action) return
    action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.4).play()
    return () => {
      action.fadeOut(0.2)
    }
  }, [actions])

  return (
    <group ref={groupRef} position={[0, yOffset, 0]} rotation={[0, rotationY, 0]}>
      <primitive object={scene} scale={scale} />
    </group>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function preloadPersona(url: string) {
  useGLTF.preload(url)
}
