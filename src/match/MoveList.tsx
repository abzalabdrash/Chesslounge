import { useEffect, useRef } from 'react'
import type { Move } from 'chess.js'

interface Props {
  history: Move[]
  viewPly: number | null
  onPick: (ply: number) => void
}

export function MoveList({ history, viewPly, onPick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const totalPlies = history.length

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [totalPlies])

  const rows: Array<{ n: number; white?: Move; black?: Move; whitePly: number; blackPly?: number }> = []
  for (let i = 0; i < history.length; i += 2) {
    rows.push({
      n: i / 2 + 1,
      white: history[i],
      whitePly: i + 1,
      black: history[i + 1],
      blackPly: history[i + 1] ? i + 2 : undefined,
    })
  }

  const livePly = totalPlies
  const effectivePly = viewPly ?? livePly

  return (
    <div className="bg-neutral-950/62 backdrop-blur-md border border-white/10 rounded-lg flex flex-col min-h-0 h-44 shadow-lg shadow-black/30">
      <div className="px-3 py-1.5 border-b border-white/10 text-amber-400/70 text-[10px] uppercase tracking-widest font-mono">
        Moves
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-1">
        {rows.length === 0 ? (
          <p className="text-neutral-500 text-xs italic px-3 py-2">No moves yet.</p>
        ) : (
          <ol className="px-1 font-mono text-[12px]">
            {rows.map((row) => (
              <li
                key={row.n}
                className="grid grid-cols-[1.6rem_1fr_1fr] items-center gap-1 px-1 py-0.5"
              >
                <span className="text-neutral-500 text-[10px] text-right pr-1">{row.n}.</span>
                <Cell
                  move={row.white}
                  ply={row.whitePly}
                  active={effectivePly === row.whitePly}
                  onPick={onPick}
                />
                <Cell
                  move={row.black}
                  ply={row.blackPly}
                  active={row.blackPly !== undefined && effectivePly === row.blackPly}
                  onPick={onPick}
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

interface CellProps {
  move?: Move
  ply?: number
  active: boolean
  onPick: (ply: number) => void
}

function Cell({ move, ply, active, onPick }: CellProps) {
  if (!move || ply === undefined) {
    return <span className="text-neutral-700">·</span>
  }
  return (
    <button
      type="button"
      onClick={() => onPick(ply)}
      className={`rounded px-1.5 py-0.5 text-left transition-colors ${
        active
          ? 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-300/40'
          : 'text-neutral-200 hover:bg-cyan-500/10'
      }`}
    >
      {move.san}
    </button>
  )
}
