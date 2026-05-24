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
  /** Optional path to a square avatar icon used in HUD panels. */
  iconUrl?: string
  /** Seated NPC GLB with built-in sit animation (Meshy). Optional — falls back to `model`. */
  sitModel?: string
  /** Per-model tweaks for the seated rig: scale + y-offset so butt lands on stool. */
  sitScale?: number
  sitYOffset?: number
  /** Yaw (radians). Each Meshy model has its own base forward direction. */
  sitRotationY?: number
  /** Distance from table center along -Z (where the stool is). Larger = further away. */
  sitDistance?: number
  /** Optional lateral shift along X — some Meshy sit poses lean to one side. */
  sitOffsetX?: number
  /** Stool seat-top Y. Higher chair for poses where Meshy puts hips high. */
  sitStoolHeight?: number
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
    iconUrl: '/models/blackjacket/blackicon.png',
    // Hustler now uses a Meshy "Sit Cross Legged" rig (the user swapped this
    // model in so it matches the other personas' seated style). Settings are
    // copied from the Tilt persona which uses the same animation source.
    sitModel: '/models/blackjacket/Meshy_AI_Animation_Sit_Cross_Legged_withSkin.glb',
    sitScale: 0.9,
    sitYOffset: 0.0,
    sitRotationY: 0,
    sitDistance: 1.35,
    sitOffsetX: 0,
    sitStoolHeight: 0.21,
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
    iconUrl: '/models/ata/ataicon.png',
    sitModel: '/models/ata/Meshy_AI_Meshy_Merged_Animations.glb',
    sitScale: 0.95,
    sitYOffset: 0,
    sitRotationY: 0,
    sitDistance: 1.3,
    sitOffsetX: 0,
    sitStoolHeight: 0.46,
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
    iconUrl: '/models/girl/girlicon.png',
    sitModel: '/models/girl/Meshy_AI_Animation_Sit_Cross_Legged_withSkin.glb',
    sitScale: 0.9,
    sitYOffset: 0.0,
    sitRotationY: 0,
    sitDistance: 1.35,
    sitStoolHeight: 0.21, // cross-legged sits low — small stool
    accent: '#f472b6',
  },
]

export const PLAYER_MODEL = '/models/kenney/character-female-c.glb'
