import { useEffect, useMemo, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import * as THREE from 'three'
import type { ChessMatchController } from '../match/useChessMatch'
import type { TableConfig } from './tables'
import {
  BOARD_SIZE,
  BOARD_Y,
  SQUARE_SIZE,
  boardSquarePalette,
  boardSquareColor,
  squareToBoardPoint,
} from './physicalBoard'

interface Props {
  table: TableConfig
  match: ChessMatchController
}

const FILES = 'abcdefgh'
const PIECE_BASE_Y = BOARD_Y + 0.038
const MATERIAL_ROOT = '/assets/materials'

const ALL_SQUARES = Array.from({ length: 64 }, (_, index) => {
  const file = index % 8
  const rank = 8 - Math.floor(index / 8)
  return `${FILES[file]}${rank}` as Square
})

function piecesFromFen(fen: string): Array<{ square: Square; type: PieceSymbol; color: Color }> {
  const chess = new Chess(fen)
  const pieces: Array<{ square: Square; type: PieceSymbol; color: Color }> = []
  const board = chess.board()
  for (const row of board) {
    for (const piece of row) {
      if (piece) pieces.push({ square: piece.square, type: piece.type, color: piece.color })
    }
  }
  return pieces
}

function checkedKingSquare(fen: string): Square | null {
  const chess = new Chess(fen)
  if (!chess.inCheck()) return null
  const turn = chess.turn()
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece?.type === 'k' && piece.color === turn) return piece.square
    }
  }
  return null
}

export function PhysicalChessBoard({ table, match }: Props) {
  const dragFrom = useRef<Square | null>(null)
  const [woodColor, woodNormal, woodRoughness] = useTexture([
    `${MATERIAL_ROOT}/Wood027/Wood027_1K-JPG_Color.jpg`,
    `${MATERIAL_ROOT}/Wood027/Wood027_1K-JPG_NormalGL.jpg`,
    `${MATERIAL_ROOT}/Wood027/Wood027_1K-JPG_Roughness.jpg`,
  ]) as THREE.Texture[]
  const pieces = useMemo(() => piecesFromFen(match.displayFen), [match.displayFen])
  const checkSquare = useMemo(() => checkedKingSquare(match.displayFen), [match.displayFen])

  useEffect(() => {
    for (const texture of [woodColor, woodNormal, woodRoughness]) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(1.4, 1.4)
      texture.needsUpdate = true
    }
  }, [woodColor, woodNormal, woodRoughness])

  function handleSquarePointerDown(square: Square, e: ThreeEvent<PointerEvent>) {
    e.stopPropagation()
    if (!dragFrom.current) {
      match.handleSquareClick(square)
    }
  }

  function handleSquarePointerUp(square: Square, e: ThreeEvent<PointerEvent>) {
    e.stopPropagation()
    const from = dragFrom.current
    dragFrom.current = null
    if (from && from !== square) {
      if (match.thinking) {
        match.handleSquareClick(square)
        return
      }
      match.applyPlayerMove(from, square)
    }
  }

  function handlePiecePointerDown(square: Square, e: ThreeEvent<PointerEvent>) {
    e.stopPropagation()
    dragFrom.current = square
    match.handleSquareClick(square)
  }

  return (
    <group position={table.position}>
      <mesh position={[0, BOARD_Y - 0.035, 0]} castShadow receiveShadow>
        <boxGeometry args={[BOARD_SIZE + 0.28, 0.07, BOARD_SIZE + 0.28]} />
        <meshStandardMaterial
          map={woodColor}
          normalMap={woodNormal}
          roughnessMap={woodRoughness}
          color="#9a6332"
          roughness={0.58}
          metalness={0.02}
        />
      </mesh>
      <BoardRail axis="x" position={[0, BOARD_Y + 0.015, -(BOARD_SIZE / 2 + 0.065)]} wood={[woodColor, woodNormal, woodRoughness]} />
      <BoardRail axis="x" position={[0, BOARD_Y + 0.015, BOARD_SIZE / 2 + 0.065]} wood={[woodColor, woodNormal, woodRoughness]} />
      <BoardRail axis="z" position={[-(BOARD_SIZE / 2 + 0.065), BOARD_Y + 0.015, 0]} wood={[woodColor, woodNormal, woodRoughness]} />
      <BoardRail axis="z" position={[BOARD_SIZE / 2 + 0.065, BOARD_Y + 0.015, 0]} wood={[woodColor, woodNormal, woodRoughness]} />

      {ALL_SQUARES.map((square) => {
        const point = squareToBoardPoint(square)
        const tone = boardSquareColor(square)
        const highlight = match.squareHighlights[square]
        const isLast = match.lastMove?.from === square || match.lastMove?.to === square
        const isPremove = match.premove?.from === square || match.premove?.to === square
        const isCheck = checkSquare === square
        const color =
          tone === 'light'
            ? highlight
              ? '#fff0a8'
              : boardSquarePalette.light
            : highlight
            ? '#43a97d'
            : boardSquarePalette.dark

        return (
          <group key={square}>
            <mesh
              position={[point.x, BOARD_Y, point.z]}
              onPointerDown={(e) => handleSquarePointerDown(square, e)}
              onPointerUp={(e) => handleSquarePointerUp(square, e)}
              receiveShadow
            >
              <boxGeometry args={[SQUARE_SIZE, 0.012, SQUARE_SIZE]} />
              <meshStandardMaterial color={color} roughness={0.55} metalness={0.04} />
            </mesh>
            {(highlight || isLast || isPremove || isCheck) && (
              <mesh position={[point.x, BOARD_Y + 0.009, point.z]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[SQUARE_SIZE * 0.9, SQUARE_SIZE * 0.9]} />
                <meshBasicMaterial
                  color={
                    isCheck
                      ? '#ef4444'
                      : isPremove
                      ? '#818cf8'
                      : isLast
                      ? '#facc15'
                      : highlight === 'capture'
                      ? '#f472b6'
                      : '#22d3ee'
                  }
                  transparent
                  opacity={isCheck ? 0.55 : highlight === 'selected' ? 0.42 : 0.28}
                  depthWrite={false}
                />
              </mesh>
            )}
          </group>
        )
      })}

      {pieces.map((piece) => {
        const point = squareToBoardPoint(piece.square)
        return (
          <ChessPiece
            key={`${piece.square}-${piece.color}-${piece.type}`}
            type={piece.type}
            color={piece.color}
            position={[point.x, PIECE_BASE_Y, point.z]}
            selected={match.selected === piece.square}
            onPointerDown={(e) => handlePiecePointerDown(piece.square, e)}
          />
        )
      })}
    </group>
  )
}

interface PieceProps {
  type: PieceSymbol
  color: Color
  position: [number, number, number]
  selected: boolean
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void
}

function ChessPiece({ type, color, position, selected, onPointerDown }: PieceProps) {
  // Classic ivory / ebony — single material per side, no contrast accents.
  // Silhouette has to do all the work.
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: color === 'w' ? '#f5f0e1' : '#1c1814',
        roughness: 0.42,
        metalness: 0.05,
        emissive: selected ? new THREE.Color('#facc15') : new THREE.Color('#000000'),
        emissiveIntensity: selected ? 0.22 : 0,
      }),
    [color, selected],
  )

  // Slim Staunton-style silhouette. Each piece is its own shape — pawn is
  // smallest with a clean ball, knight has a slanted profile, bishop has a
  // mitre slit, rook has battlements, queen has a crown of spikes, king has a
  // cross. NO text labels — silhouettes must be readable from above.
  const profile = pieceProfile(type)
  return (
    <group position={position} onPointerDown={onPointerDown}>
      {/* base disc */}
      <mesh castShadow material={material}>
        <cylinderGeometry args={[profile.baseR, profile.baseR + 0.008, 0.028, 24]} />
      </mesh>
      {/* collar */}
      <mesh castShadow position={[0, 0.022, 0]} material={material}>
        <torusGeometry args={[profile.baseR - 0.008, 0.006, 8, 24]} />
      </mesh>
      {/* main stem */}
      <mesh castShadow position={[0, 0.014 + profile.stemH / 2, 0]} material={material}>
        <cylinderGeometry args={[profile.topR, profile.bottomR, profile.stemH, 22]} />
      </mesh>
      {/* shoulder ring */}
      <mesh castShadow position={[0, 0.014 + profile.stemH + 0.004, 0]} material={material}>
        <torusGeometry args={[profile.topR + 0.004, 0.005, 8, 22]} />
      </mesh>
      <PieceCrown type={type} material={material} baseY={0.014 + profile.stemH + 0.012} />
      {selected && (
        <mesh position={[0, -0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[profile.baseR + 0.005, profile.baseR + 0.019, 24]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

interface PieceProfile {
  baseR: number
  bottomR: number
  topR: number
  stemH: number
}

function pieceProfile(type: PieceSymbol): PieceProfile {
  // Real Staunton-ish proportions: king ~3× pawn height for clear hierarchy.
  // Square = 0.14m → king height ~0.17m reads as "real" chess scale.
  switch (type) {
    case 'p':
      return { baseR: 0.052, bottomR: 0.04, topR: 0.028, stemH: 0.058 }
    case 'r':
      return { baseR: 0.058, bottomR: 0.045, topR: 0.042, stemH: 0.084 }
    case 'n':
      return { baseR: 0.058, bottomR: 0.045, topR: 0.036, stemH: 0.092 }
    case 'b':
      return { baseR: 0.058, bottomR: 0.042, topR: 0.034, stemH: 0.108 }
    case 'q':
      return { baseR: 0.062, bottomR: 0.046, topR: 0.036, stemH: 0.13 }
    case 'k':
      return { baseR: 0.062, bottomR: 0.047, topR: 0.038, stemH: 0.146 }
  }
}

function BoardRail({
  axis,
  position,
  wood,
}: {
  axis: 'x' | 'z'
  position: [number, number, number]
  wood: [THREE.Texture, THREE.Texture, THREE.Texture]
}) {
  const [woodColor, woodNormal, woodRoughness] = wood
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry
        args={axis === 'x' ? [BOARD_SIZE + 0.26, 0.045, 0.055] : [0.055, 0.045, BOARD_SIZE + 0.26]}
      />
      <meshStandardMaterial
        map={woodColor}
        normalMap={woodNormal}
        roughnessMap={woodRoughness}
        color="#c78a43"
        roughness={0.52}
      />
    </mesh>
  )
}

function PieceCrown({
  type,
  material,
  baseY,
}: {
  type: PieceSymbol
  material: THREE.MeshStandardMaterial
  baseY: number
}) {
  // PAWN — single ball on a tiny neck. Smallest piece.
  if (type === 'p') {
    return (
      <group position={[0, baseY, 0]}>
        <mesh castShadow material={material}>
          <cylinderGeometry args={[0.022, 0.03, 0.012, 18]} />
        </mesh>
        <mesh castShadow position={[0, 0.036, 0]} material={material}>
          <sphereGeometry args={[0.034, 18, 16]} />
        </mesh>
      </group>
    )
  }
  // ROOK — short fat tower with 4 battlements
  if (type === 'r') {
    return (
      <group position={[0, baseY, 0]}>
        <mesh castShadow material={material}>
          <cylinderGeometry args={[0.05, 0.046, 0.038, 18]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            castShadow
            position={[
              Math.cos((i * Math.PI) / 2 + Math.PI / 4) * 0.038,
              0.042,
              Math.sin((i * Math.PI) / 2 + Math.PI / 4) * 0.038,
            ]}
            material={material}
          >
            <boxGeometry args={[0.022, 0.038, 0.022]} />
          </mesh>
        ))}
      </group>
    )
  }
  // KNIGHT — chunky horse head with prominent snout & mane
  if (type === 'n') {
    return (
      <group position={[0, baseY + 0.028, 0]}>
        {/* main head */}
        <mesh castShadow position={[0, 0, 0.02]} rotation={[0.45, 0, 0]} material={material}>
          <boxGeometry args={[0.046, 0.084, 0.058]} />
        </mesh>
        {/* snout — angled forward */}
        <mesh castShadow position={[0, 0.022, 0.06]} rotation={[0.55, 0, 0]} material={material}>
          <boxGeometry args={[0.036, 0.034, 0.04]} />
        </mesh>
        {/* mane crest */}
        <mesh castShadow position={[0, 0.05, -0.012]} rotation={[0.25, 0, 0]} material={material}>
          <boxGeometry args={[0.014, 0.024, 0.044]} />
        </mesh>
        {/* ears */}
        <mesh castShadow position={[-0.018, 0.054, -0.018]} rotation={[-0.2, 0, -0.22]} material={material}>
          <coneGeometry args={[0.011, 0.028, 8]} />
        </mesh>
        <mesh castShadow position={[0.018, 0.054, -0.018]} rotation={[-0.2, 0, 0.22]} material={material}>
          <coneGeometry args={[0.011, 0.028, 8]} />
        </mesh>
      </group>
    )
  }
  // BISHOP — tall mitre cone + finial ball
  if (type === 'b') {
    return (
      <group position={[0, baseY, 0]}>
        <mesh castShadow material={material}>
          <sphereGeometry args={[0.036, 18, 16]} />
        </mesh>
        <mesh castShadow position={[0, 0.044, 0]} material={material}>
          <coneGeometry args={[0.038, 0.082, 22]} />
        </mesh>
        {/* small finial ball at the very tip */}
        <mesh castShadow position={[0, 0.104, 0]} material={material}>
          <sphereGeometry args={[0.014, 12, 10]} />
        </mesh>
      </group>
    )
  }
  // QUEEN — wide crown of 9 spikes around a ring
  if (type === 'q') {
    return (
      <group position={[0, baseY, 0]}>
        <mesh castShadow material={material}>
          <sphereGeometry args={[0.04, 18, 16]} />
        </mesh>
        <mesh castShadow position={[0, 0.028, 0]} material={material}>
          <torusGeometry args={[0.04, 0.008, 10, 26]} />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh
            key={i}
            castShadow
            position={[
              Math.cos((i * 2 * Math.PI) / 9) * 0.036,
              0.05,
              Math.sin((i * 2 * Math.PI) / 9) * 0.036,
            ]}
            material={material}
          >
            <coneGeometry args={[0.011, 0.03, 8]} />
          </mesh>
        ))}
        {/* center bead — visually the tallest point */}
        <mesh castShadow position={[0, 0.072, 0]} material={material}>
          <sphereGeometry args={[0.016, 12, 10]} />
        </mesh>
      </group>
    )
  }
  // KING — sphere + bold cross. Tallest piece.
  return (
    <group position={[0, baseY, 0]}>
      <mesh castShadow material={material}>
        <sphereGeometry args={[0.04, 18, 16]} />
      </mesh>
      <mesh castShadow position={[0, 0.028, 0]} material={material}>
        <torusGeometry args={[0.04, 0.008, 10, 26]} />
      </mesh>
      {/* cross vertical (taller than queen) */}
      <mesh castShadow position={[0, 0.074, 0]} material={material}>
        <boxGeometry args={[0.018, 0.084, 0.018]} />
      </mesh>
      {/* cross horizontal */}
      <mesh castShadow position={[0, 0.08, 0]} material={material}>
        <boxGeometry args={[0.05, 0.018, 0.018]} />
      </mesh>
    </group>
  )
}
