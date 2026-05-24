import { useEffect, useMemo, useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'

const IDLE_URL = '/models/maincharacter/Meshy_AI_Animation_Idle_3_withSkin.glb'
const WALK_URL = '/models/maincharacter/Meshy_AI_Animation_walking_2_withSkin.glb'

export type CharState = 'idle' | 'walk' | 'run'

// Meshy walk clips usually translate the root bone forward (root motion).
// We drive position in code, so strip the root position tracks to play "in place".
function stripRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  const out = clip.clone()
  out.tracks = out.tracks.filter((t) => !/\.position$/.test(t.name))
  return out
}

interface MainCharacterProps {
  state: CharState
  scale?: number
}

export function MainCharacter({ state, scale = 1 }: MainCharacterProps) {
  const idleGltf = useGLTF(IDLE_URL)
  const walkGltf = useGLTF(WALK_URL)
  const groupRef = useRef<THREE.Group>(null!)

  // Independent skeleton clone so multiple instances don't share bones.
  const scene = useMemo(() => {
    const cloned = SkeletonUtils.clone(idleGltf.scene) as THREE.Object3D
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.frustumCulled = false
      }
    })
    return cloned
  }, [idleGltf.scene])

  // Combine clips from both GLBs onto one rig. Meshy keeps bone names stable
  // across exports of the same model, so clips from walk.glb retarget cleanly
  // onto idle.glb's skeleton.
  const clips = useMemo(() => {
    const idle = idleGltf.animations.map((c) => {
      const cl = c.clone()
      cl.name = 'idle'
      return cl
    })
    const walk = walkGltf.animations.map((c) => {
      const cl = stripRootMotion(c)
      cl.name = 'walk'
      return cl
    })
    return [...idle, ...walk]
  }, [idleGltf.animations, walkGltf.animations])

  const { actions, mixer } = useAnimations(clips, groupRef)
  const currentRef = useRef<THREE.AnimationAction | null>(null)

  // Trigger once when actions become available — start in idle.
  useEffect(() => {
    if (!actions.idle) return
    actions.idle.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.2).play()
    currentRef.current = actions.idle
  }, [actions])

  // React to state changes — switch animation with crossfade.
  useEffect(() => {
    const idleAction = actions.idle
    const walkAction = actions.walk
    if (!idleAction || !walkAction) return

    const next = state === 'idle' ? idleAction : walkAction
    // run = walk played faster
    walkAction.timeScale = state === 'run' ? 1.65 : 1.0

    // Already on this action: ensure it's playing, don't re-fade.
    if (currentRef.current === next) {
      if (!next.isRunning()) next.play()
      return
    }

    next.reset()
    next.setLoop(THREE.LoopRepeat, Infinity)
    next.enabled = true
    next.paused = false

    if (currentRef.current) {
      currentRef.current.fadeOut(0.18)
    }
    next.fadeIn(0.18).play()
    currentRef.current = next
  }, [state, actions])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mixer.stopAllAction()
    }
  }, [mixer])

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={scale} />
    </group>
  )
}

useGLTF.preload(IDLE_URL)
useGLTF.preload(WALK_URL)
