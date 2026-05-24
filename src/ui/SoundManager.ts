/**
 * Tiny audio dispatcher. Pools 3 HTMLAudioElement instances per sound so
 * rapid-fire moves don't cut each other off (chess.com-style overlap).
 */

export type SfxName =
  | 'move'
  | 'capture'
  | 'check'
  | 'checkmate'
  | 'game-start'
  | 'ambient'

const FILES: Record<SfxName, string> = {
  move: '/sounds/move.mp3',
  capture: '/sounds/capture.mp3',
  check: '/sounds/check.mp3',
  checkmate: '/sounds/checkmate.mp3',
  'game-start': '/sounds/game-start.mp3',
  ambient: '/sounds/ambient.mp3',
}

const VOLUMES: Record<SfxName, number> = {
  move: 0.55,
  capture: 0.7,
  check: 0.65,
  checkmate: 0.8,
  'game-start': 0.6,
  ambient: 0.18,
}

const POOL_SIZE = 3
const pools: Partial<Record<SfxName, HTMLAudioElement[]>> = {}
const cursors: Partial<Record<SfxName, number>> = {}
let ambientEl: HTMLAudioElement | null = null
let muted = false

function pool(name: SfxName): HTMLAudioElement[] {
  let p = pools[name]
  if (!p) {
    p = []
    for (let i = 0; i < POOL_SIZE; i++) {
      const el = new Audio(FILES[name])
      el.preload = 'auto'
      el.volume = VOLUMES[name]
      p.push(el)
    }
    pools[name] = p
    cursors[name] = 0
  }
  return p
}

export const SoundManager = {
  play(name: SfxName) {
    if (muted) return
    try {
      const p = pool(name)
      const idx = (cursors[name] ?? 0) % p.length
      cursors[name] = idx + 1
      const el = p[idx]
      el.currentTime = 0
      void el.play().catch(() => {
        /* autoplay blocked or interrupted, ignore */
      })
    } catch (err) {
      console.warn('SoundManager.play failed', name, err)
    }
  },

  startAmbient() {
    if (muted) return
    if (ambientEl) return
    try {
      const el = new Audio(FILES.ambient)
      el.loop = true
      el.volume = VOLUMES.ambient
      ambientEl = el
      void el.play().catch(() => {
        /* autoplay blocked — will start on first user gesture below */
      })
    } catch (err) {
      console.warn('SoundManager.startAmbient failed', err)
    }
  },

  stopAmbient() {
    if (!ambientEl) return
    try {
      ambientEl.pause()
      ambientEl.currentTime = 0
    } catch {
      /* noop */
    }
    ambientEl = null
  },

  setMuted(m: boolean) {
    muted = m
    if (m) this.stopAmbient()
  },

  isMuted() {
    return muted
  },

  /** Preload all sound buffers so first move plays without delay. */
  preload() {
    for (const name of Object.keys(FILES) as SfxName[]) {
      if (name === 'ambient') continue
      pool(name)
    }
  },
}

/**
 * Browsers block audio until user interacts. Attach a one-shot listener that
 * resumes ambient + flushes any pending plays after the first click/keypress.
 */
export function installAudioUnlock() {
  const unlock = () => {
    if (!ambientEl && !muted) {
      SoundManager.startAmbient()
    } else if (ambientEl && ambientEl.paused && !muted) {
      void ambientEl.play().catch(() => undefined)
    }
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock, { once: false })
  window.addEventListener('keydown', unlock, { once: false })
}
