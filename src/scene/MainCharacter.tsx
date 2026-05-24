import { useEffect, useMemo, useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'

const IDLE_URL = '/models/maincharacter/Meshy_AI_Animation_Idle_3_withSkin.glb'
const WALK_URL = '/models/maincharacter/Meshy_AI_Animation_walking_2_withSkin.glb'
const RUN_URL = '/models/maincharacter/Meshy_AI_Animation_run_fast_3_inplace_withSkin.glb'
// Meshy clip plays "sit → stand". Play it in reverse and clamp on the final
// frame to leave the character in a stable seated pose.
const SIT_URL = '/models/maincharacter/Meshy_AI_Animation_Sit_to_Stand_Transition_F_withSkin.glb'

export type CharState = 'idle' | 'walk' | 'run' | 'sit'

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
  const runGltf = useGLTF(RUN_URL)
  const sitGltf = useGLTF(SIT_URL)
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
    const run = runGltf.animations.map((c) => {
      // run GLB is already exported "in_place" by Meshy, but strip just in case
      const cl = stripRootMotion(c)
      cl.name = 'run'
      return cl
    })
    const sit = sitGltf.animations.map((c) => {
      const cl = stripRootMotion(c)
      cl.name = 'sit'
      return cl
    })
    return [...idle, ...walk, ...run, ...sit]
  }, [idleGltf.animations, walkGltf.animations, runGltf.animations, sitGltf.animations])

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
    const runAction = actions.run
    const sitAction = actions.sit
    if (!idleAction || !walkAction) return

    const next =
      state === 'sit'
        ? (sitAction ?? idleAction)
        : state === 'idle'
        ? idleAction
        : state === 'run'
        ? (runAction ?? walkAction)
        : walkAction

    // Already on this action: ensure it's playing, don't re-fade or re-configure.
    if (currentRef.current === next) {
      if (!next.isRunning()) next.play()
      return
    }

    // Fade out the previous action (don't touch its config — leave for its
    // own next selection so we don't accidentally squash sit-specific state).
    if (currentRef.current) {
      currentRef.current.fadeOut(0.18)
    }

    // Configure & play the new action.
    next.reset()
    next.enabled = true
    next.paused = false
    if (sitAction && next === sitAction) {
      // Meshy clip plays "sit → stand". Reverse it and clamp on the seated frame.
      next.setLoop(THREE.LoopOnce, 1)
      next.clampWhenFinished = true
      next.timeScale = -1
      next.time = next.getClip().duration
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity)
      next.clampWhenFinished = false
      next.timeScale = 1.0
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
useGLTF.preload(RUN_URL)
useGLTF.preload(SIT_URL)
