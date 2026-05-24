export interface TableConfig {
  id: string
  label: string
  bio: string
  elo: number
  position: [number, number, number]
  color: string
  skinColor: string
  model: string
  accent: string
}

export const TABLES: TableConfig[] = [
  {
    id: 'hustler',
    label: 'The Hustler',
    bio: 'NYC park-chess legend. Trash talks first, plays second.',
    elo: 1900,
    position: [-6, 0, -2],
    color: '#dc2626',
    skinColor: '#a16207',
    model: '/models/kenney/character-male-a.glb',
    accent: '#ef4444',
  },
  {
    id: 'maestro',
    label: 'Maestro',
    bio: 'Old-school grandmaster. Quotes Capablanca mid-move.',
    elo: 2400,
    position: [0, 0, -4],
    color: '#1e40af',
    skinColor: '#fde68a',
    model: '/models/kenney/character-male-b.glb',
    accent: '#60a5fa',
  },
  {
    id: 'tilt',
    label: 'Tilt',
    bio: '1700-rated streamer. Vibes high until the queen drops.',
    elo: 1700,
    position: [6, 0, -2],
    color: '#db2777',
    skinColor: '#fed7aa',
    model: '/models/kenney/character-female-a.glb',
    accent: '#f472b6',
  },
]

export const PLAYER_MODEL = '/models/kenney/character-female-c.glb'
