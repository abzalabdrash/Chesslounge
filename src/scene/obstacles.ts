import { TABLES } from './tables'

export interface Aabb {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

const PLAYER_RADIUS = 0.32

function box(cx: number, cz: number, halfX: number, halfZ: number): Aabb {
  return {
    minX: cx - halfX,
    maxX: cx + halfX,
    minZ: cz - halfZ,
    maxZ: cz + halfZ,
  }
}

// Hand-tuned to match the visible footprints in World.tsx + Table.tsx.
// Tables themselves are 1.72×1.72; the NPC stool sits at ~1.3 along -Z and
// the player stool at +1.45 along +Z. We only collide against the table top
// + the NPC-side stool — the player-side stool is *under* the player when
// seated, so blocking it would prevent walking up to sit down.
function tableObstacles(): Aabb[] {
  const out: Aabb[] = []
  for (const t of TABLES) {
    const cx = t.position[0]
    const cz = t.position[2]
    // table slab itself
    out.push(box(cx, cz, 0.92, 0.92))
    // NPC stool (on -Z side of table)
    const npcStoolZ = cz - (t.sitDistance ?? 1.35)
    out.push(box(cx, npcStoolZ, 0.34, 0.34))
  }
  return out
}

const FURNITURE_OBSTACLES: Aabb[] = [
  // bookcases (left + right of back wall)
  box(-9.2, -7.35, 0.9, 0.55),
  box(9.2, -7.35, 0.9, 0.55),
  // floor lamps
  box(-10.2, 2.4, 0.32, 0.32),
  box(10.2, 2.4, 0.32, 0.32),
  // plants
  box(-9.8, -5.7, 0.45, 0.45),
  box(9.8, -5.7, 0.45, 0.45),
  // side table + lamp (front-left)
  box(-4.25, 5.35, 0.55, 0.55),
  // coffee table + 2 reading chairs (front-right cozy nook)
  box(4.2, 5.25, 0.9, 0.7),
  box(6.2, 5.0, 0.45, 0.45),
  box(-6.2, 5.0, 0.45, 0.45),
  // big sofa-thing along +Z (DecorProps: position [0, 0, 6.2], 3.45×0.78)
  box(0, 6.2, 1.85, 0.5),
  // floor sculpture on back wall (DecorProps position [0, 0, -8.25])
  box(0, -8.25, 0.55, 0.55),
  // wall-side mini bookcase columns (DecorProps left/right at z=-7.7)
  box(-8.5, -7.7, 0.7, 0.25),
  box(8.5, -7.7, 0.7, 0.25),
]

// Walls = ring of thick AABBs we'll never let the player cross.
// Mirror the values in Walls() inside World.tsx.
const WALL_OBSTACLES: Aabb[] = [
  // back wall (z = -10, depth 0.4)
  box(0, -10, 12, 0.2),
  // left wall (x = -12)
  box(-12, -2, 0.2, 8),
  // right wall (x = 12)
  box(12, -2, 0.2, 8),
  // front wall (new — z = +8.6, thin)
  box(0, 8.6, 12, 0.2),
]

const ALL_OBSTACLES: Aabb[] = [
  ...tableObstacles(),
  ...FURNITURE_OBSTACLES,
  ...WALL_OBSTACLES,
]

export function getObstacles(): Aabb[] {
  return ALL_OBSTACLES
}

/** Returns true if a player capsule centered at (x,z) would intersect any obstacle. */
export function collidesAt(x: number, z: number, radius = PLAYER_RADIUS): boolean {
  for (const o of ALL_OBSTACLES) {
    if (
      x + radius > o.minX &&
      x - radius < o.maxX &&
      z + radius > o.minZ &&
      z - radius < o.maxZ
    ) {
      return true
    }
  }
  return false
}

/**
 * Slide along walls: try the full XZ move, fall back to X-only, then Z-only.
 * That gives the classic FPS feel where you slide along an obstacle instead
 * of sticking.
 */
export function resolveMove(
  fromX: number,
  fromZ: number,
  dx: number,
  dz: number,
  radius = PLAYER_RADIUS,
): { x: number; z: number } {
  let x = fromX
  let z = fromZ

  if (!collidesAt(fromX + dx, fromZ + dz, radius)) {
    return { x: fromX + dx, z: fromZ + dz }
  }
  if (!collidesAt(fromX + dx, fromZ, radius)) {
    x = fromX + dx
  }
  if (!collidesAt(x, fromZ + dz, radius)) {
    z = fromZ + dz
  }
  return { x, z }
}
