import { useCallback, useEffect, useRef } from 'react'
import { getReplayStatusLabel } from './chessUx'

interface Props {
  viewPly: number | null
  totalPlies: number
  onStepBack: () => void
  onStepForward: () => void
  onJumpStart: () => void
  onJumpLive: () => void
}

const REPEAT_DELAY = 280
const REPEAT_INTERVAL = 90

export function ReplayControls({
  viewPly,
  totalPlies,
  onStepBack,
  onStepForward,
  onJumpStart,
  onJumpLive,
}: Props) {
  const isLive = viewPly === null || viewPly === totalPlies
  const displayPly = viewPly ?? totalPlies
  const atStart = displayPly === 0
  const atEnd = isLive
  const status = getReplayStatusLabel(viewPly, totalPlies)

  const repeatRef = useRef<{
    timeout: ReturnType<typeof setTimeout> | null
    interval: ReturnType<typeof setInterval> | null
  }>({ timeout: null, interval: null })

  const stopRepeat = useCallback(() => {
    const s = repeatRef.current
    if (s.timeout) {
      clearTimeout(s.timeout)
      s.timeout = null
    }
    if (s.interval) {
      clearInterval(s.interval)
      s.interval = null
    }
  }, [])

  const startRepeat = useCallback(
    (action: () => void) => {
      stopRepeat()
      const s = repeatRef.current
      s.timeout = setTimeout(() => {
        s.interval = setInterval(action, REPEAT_INTERVAL)
      }, REPEAT_DELAY)
    },
    [stopRepeat],
  )

  useEffect(() => stopRepeat, [stopRepeat])

  // Keyboard arrows when not typing
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      const typing =
        t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (typing) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          onStepBack()
          break
        case 'ArrowRight':
          e.preventDefault()
          onStepForward()
          break
        case 'ArrowUp':
          e.preventDefault()
          if (!e.repeat) onJumpStart()
          break
        case 'ArrowDown':
          e.preventDefault()
          if (!e.repeat) onJumpLive()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onStepBack, onStepForward, onJumpStart, onJumpLive])

  return (
    <div className="bg-neutral-950/62 backdrop-blur-md border border-white/10 rounded-lg p-2 flex flex-col gap-2 shadow-lg shadow-black/30">
      <div className="flex items-center justify-between px-1 text-xs">
        <span
          className={
            status.tone === 'live'
              ? 'text-cyan-200/90'
              : 'text-amber-300/90'
          }
        >
          {status.text}
        </span>
        {!isLive && (
          <button
            onClick={onJumpLive}
            className="text-amber-400 hover:text-amber-300 text-[10px] uppercase tracking-widest"
          >
            Back to board
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1">
        <ReplayBtn onClick={onJumpStart} disabled={atStart} label="⏮" title="Jump to start (↑)" />
        <ReplayBtn
          onClick={onStepBack}
          onHoldStart={() => startRepeat(onStepBack)}
          onHoldEnd={stopRepeat}
          disabled={atStart}
          label="◀"
          title="Back (←)"
        />
        <ReplayBtn
          onClick={onStepForward}
          onHoldStart={() => startRepeat(onStepForward)}
          onHoldEnd={stopRepeat}
          disabled={atEnd}
          label="▶"
          title="Forward (→)"
        />
        <ReplayBtn onClick={onJumpLive} disabled={atEnd} label="⏭" title="Jump to board (Down)" />
      </div>
    </div>
  )
}

interface BtnProps {
  onClick: () => void
  onHoldStart?: () => void
  onHoldEnd?: () => void
  disabled?: boolean
  label: string
  title: string
}

function ReplayBtn({ onClick, onHoldStart, onHoldEnd, disabled, label, title }: BtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onHoldStart}
      onPointerUp={onHoldEnd}
      onPointerLeave={onHoldEnd}
      onPointerCancel={onHoldEnd}
      disabled={disabled}
      title={title}
      className="h-9 rounded-md bg-neutral-800/70 hover:bg-neutral-700/80 active:bg-neutral-600/80 text-amber-300 font-mono text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-neutral-800/70 select-none"
    >
      {label}
    </button>
  )
}
