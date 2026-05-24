import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { TableConfig } from '../scene/tables'
import { PersonaAvatar } from './PersonaAvatar'

interface Props {
  table: TableConfig
  text: string
  streaming: boolean
  thinking: boolean
}

/**
 * Always-mounted "table voice" panel anchored top-left during a match.
 *
 * Reliability rules (no flicker, no status leakage):
 *  - The card is mounted as soon as we have ANY commentary, and never
 *    unmounts again — re-renders just swap the inner text. Earlier we
 *    re-keyed on every text change, which forced AnimatePresence to
 *    fully exit + remount, producing the disappearing-bubble flicker.
 *  - We persist the last non-empty commentary in local state so that the
 *    transient gap between `setCommentary('')` and the first streamed
 *    token of the next reply doesn't blank the bubble.
 *  - We never substitute status strings ("Your move", "thinking…") for
 *    real commentary — those would only confuse the player. While the
 *    persona is computing a reply we keep showing the previous line.
 */
export function TableVoice({ table, text, streaming, thinking }: Props) {
  const [persisted, setPersisted] = useState('')

  useEffect(() => {
    if (text) setPersisted(text)
  }, [text])

  // Reset when we switch tables — otherwise we'd briefly show the previous
  // persona's words under the new persona's avatar.
  useEffect(() => {
    setPersisted('')
  }, [table.id])

  const display = text || persisted
  if (!display) return null

  return (
    <div className="pointer-events-none absolute top-4 left-4 z-30 w-[min(440px,30vw)] min-w-[300px]">
      <motion.div
        layout
        initial={{ opacity: 0, y: -10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        className="relative rounded-2xl px-5 py-4 backdrop-blur-md"
        style={{
          background: 'linear-gradient(180deg, rgba(20,16,12,0.94), rgba(8,6,5,0.91))',
          border: `1.5px solid ${table.accent}aa`,
          boxShadow: `0 22px 60px -10px ${table.accent}66, 0 8px 28px rgba(0,0,0,0.7)`,
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <PersonaAvatar persona={table} size={44} />
          <div className="min-w-0 flex-1">
            <p
              className="font-display font-bold text-lg leading-tight truncate"
              style={{ color: table.accent }}
            >
              {table.label}
            </p>
            <p className="text-amber-100/55 text-[10px] uppercase tracking-[0.22em] leading-tight mt-0.5">
              {thinking ? 'thinking…' : 'table voice'}
            </p>
          </div>
          <span
            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
              streaming
                ? 'bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.95)] animate-pulse'
                : 'bg-neutral-600'
            }`}
          />
        </div>
        <p className="text-amber-50 leading-snug font-medium" style={{ fontSize: '17px' }}>
          {display}
          {streaming && (
            <span
              className="inline-block w-[2px] ml-1 align-middle animate-pulse"
              style={{ height: '17px', background: table.accent }}
            />
          )}
        </p>
      </motion.div>
    </div>
  )
}
