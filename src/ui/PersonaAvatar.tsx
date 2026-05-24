import type { TableConfig } from '../scene/tables'

interface Props {
  persona: TableConfig
  size?: number
}

interface AvatarStyle {
  gradient: [string, string]
  ring: string
  emoji: string
  initial: string
  bgPattern: string
}

const STYLES: Record<string, AvatarStyle> = {
  hustler: {
    gradient: ['#dc2626', '#581c1c'],
    ring: '#fbbf24',
    emoji: '🧢',
    initial: 'H',
    bgPattern:
      'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18) 0%, transparent 40%)',
  },
  maestro: {
    gradient: ['#1e40af', '#0b1d4f'],
    ring: '#cbd5e1',
    emoji: '♟️',
    initial: 'M',
    bgPattern:
      'radial-gradient(circle at 70% 30%, rgba(255,255,255,0.15) 0%, transparent 45%)',
  },
  tilt: {
    gradient: ['#db2777', '#5b1638'],
    ring: '#f9a8d4',
    emoji: '✨',
    initial: 'T',
    bgPattern:
      'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2) 0%, transparent 50%)',
  },
}

export function PersonaAvatar({ persona, size = 64 }: Props) {
  const style = STYLES[persona.id] ?? STYLES.hustler

  // If the persona ships a real avatar PNG, render it as the primary face
  // (cleaner than the generated initial/emoji combo). The colored ring + glow
  // are kept so the avatar still feels themed and pops against dark backdrops.
  if (persona.iconUrl) {
    return (
      <div
        className="relative inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${style.gradient[0]}, ${style.gradient[1]})`,
          border: `2px solid ${style.ring}`,
          boxShadow: `0 0 20px ${style.gradient[0]}55, inset 0 -8px 16px rgba(0,0,0,0.3)`,
        }}
      >
        <img
          src={persona.iconUrl}
          alt={persona.label}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>
    )
  }

  return (
    <div
      className="relative inline-flex items-center justify-center rounded-full font-display font-bold shadow-2xl shrink-0"
      style={{
        width: size,
        height: size,
        background: `${style.bgPattern}, linear-gradient(135deg, ${style.gradient[0]}, ${style.gradient[1]})`,
        border: `2px solid ${style.ring}`,
        boxShadow: `0 0 20px ${style.gradient[0]}40, inset 0 -8px 16px rgba(0,0,0,0.3)`,
      }}
    >
      <span
        className="text-white relative"
        style={{
          fontSize: size * 0.5,
          lineHeight: 1,
          textShadow: '0 2px 6px rgba(0,0,0,0.5)',
        }}
      >
        {style.initial}
      </span>
      <span
        className="absolute"
        style={{
          bottom: -size * 0.05,
          right: -size * 0.05,
          fontSize: size * 0.32,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
        }}
      >
        {style.emoji}
      </span>
    </div>
  )
}
