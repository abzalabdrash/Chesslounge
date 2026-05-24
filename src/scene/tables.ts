export interface TableConfig {
  id: string
  label: string
  bio: string
  elo: number
  position: [number, number, number]
  color: string
  skinColor: string
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
  },
  {
    id: 'maestro',
    label: 'Maestro',
    bio: 'Old-school grandmaster. Quotes Capablanca mid-move.',
    elo: 2400,
    position: [0, 0, -4],
    color: '#1e40af',
    skinColor: '#fde68a',
  },
  {
    id: 'tilt',
    label: 'Tilt',
    bio: '1700-rated streamer. Vibes high until the queen drops.',
    elo: 1700,
    position: [6, 0, -2],
    color: '#db2777',
    skinColor: '#fed7aa',
  },
]
