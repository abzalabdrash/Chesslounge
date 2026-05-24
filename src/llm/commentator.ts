import { streamChat, getFeatherlessKey, type ChatMessage } from './client'
import { getPersona, type PersonaConfig } from './personas'
import type { MoveAnalysis } from '../match/analysis'
import { pieceName } from '../match/analysis'

export type MoveTrigger =
  | 'opening'
  | 'player-move'
  | 'player-capture'
  | 'player-check'
  | 'player-blunder'
  | 'player-brilliant'
  | 'ai-move'
  | 'ai-capture'
  | 'ai-check'
  | 'ai-blunder'
  | 'player-wins'
  | 'ai-wins'
  | 'draw'

export interface CommentaryContext {
  trigger: MoveTrigger
  moveSan?: string
  /** Ply number AFTER this move (1-indexed). 0 = opening (no move yet). */
  moveNumber: number
  /** Last 8 moves SAN, oldest first. */
  recentHistory: string[]
  /** What was captured this ply ('p','n','b','r','q'), if anything. */
  capturedPiece?: string | null
  /** Engine analysis for the move just played. Null on opening / endgame jumps. */
  analysis?: MoveAnalysis | null
  /** True if move puts opponent in check (move SAN ends with + or #). */
  isCheck?: boolean
  /** True if move is checkmate. */
  isMate?: boolean
  /** Material balance description from analysis.materialDiff. */
  materialDescription?: string
  /** Opponent persona's label, used for grounding ambient lines. */
  opponentLabel?: string
}

export interface CommentaryHandlers {
  onToken: (token: string) => void
  onDone: (full: string, source: 'llm' | 'fallback') => void
  onError?: (err: unknown) => void
}

/**
 * Decide whether the persona should actually open their mouth for this ply.
 *
 * Strict policy: by default the persona STAYS QUIET. They only speak on:
 *  - game lifecycle (opening / mate / draw)
 *  - decisive tactical events (blunder / brilliant / mistake)
 *  - heavy material moments (queen capture, queen check)
 *
 * Caller passes lastCommentedMoveNumber so we enforce minimum spacing of
 * MIN_GAP_PLIES between non-decisive comments. Quiet positions stay quiet.
 */
const MIN_GAP_PLIES = 3 // ~1.5 ходов между обычными комментами

export function shouldComment(
  ctx: CommentaryContext,
  lastCommentedMoveNumber: number,
): boolean {
  // Game lifecycle — always speak.
  if (
    ctx.trigger === 'opening' ||
    ctx.trigger === 'player-wins' ||
    ctx.trigger === 'ai-wins' ||
    ctx.trigger === 'draw'
  ) {
    return true
  }
  if (ctx.isMate) return true

  const cls = ctx.analysis?.classification
  const gap = ctx.moveNumber - lastCommentedMoveNumber

  // Decisive events — always speak (they bypass the gap window).
  if (
    ctx.trigger === 'player-blunder' ||
    ctx.trigger === 'player-brilliant' ||
    ctx.trigger === 'ai-blunder'
  ) {
    return true
  }
  if (cls === 'mistake' || cls === 'brilliant' || cls === 'great') return true
  if (ctx.capturedPiece === 'q') return true

  // Below this point we MUST respect the minimum gap.
  if (gap < MIN_GAP_PLIES) return false

  // Worth speaking after a polite gap:
  if (ctx.capturedPiece === 'r') return true
  if (ctx.isCheck && cls !== 'best' && cls !== 'excellent') return true
  if (cls === 'inaccuracy' && gap >= MIN_GAP_PLIES) return true

  // Quiet positions: stay quiet. No "ambient" cadence anymore.
  return false
}

export class Commentator {
  private controller: AbortController | null = null

  cancel() {
    if (this.controller) {
      this.controller.abort()
      this.controller = null
    }
  }

  comment(personaId: string, ctx: CommentaryContext, handlers: CommentaryHandlers) {
    this.cancel()
    const persona = getPersona(personaId)

    if (!getFeatherlessKey()) {
      this.runFallback(persona, ctx, handlers)
      return
    }

    const controller = new AbortController()
    this.controller = controller
    const messages = buildMessages(persona, ctx)

    let raw = ''
    let lastDisplayed = ''
    ;(async () => {
      try {
        for await (const token of streamChat(messages, {
          signal: controller.signal,
          maxTokens: 60,
          // Lower temperature now that we feed FACTS — we want grounded reactions,
          // not creative chess fiction.
          temperature: 0.75,
        })) {
          raw += token
          // Always display the cleaned-so-far view so leading quotes never flash
          // on screen even mid-stream. We push only the diff so the existing
          // setCommentary((prev) => prev + delta) path keeps working.
          const cleaned = cleanReply(raw)
          if (cleaned.startsWith(lastDisplayed)) {
            const delta = cleaned.slice(lastDisplayed.length)
            if (delta) handlers.onToken(delta)
          } else {
            // Cleaning removed something earlier — replay the whole cleaned text.
            // Caller treats this as a reset by emitting the raw replacement.
            handlers.onToken(cleaned.slice(lastDisplayed.length))
          }
          lastDisplayed = cleaned
        }
        handlers.onDone(cleanReply(raw), 'llm')
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return
        console.warn('Commentator LLM failed, using fallback', err)
        handlers.onError?.(err)
        this.runFallback(persona, ctx, handlers)
      } finally {
        if (this.controller === controller) this.controller = null
      }
    })()
  }

  private runFallback(
    persona: PersonaConfig,
    ctx: CommentaryContext,
    handlers: CommentaryHandlers,
  ) {
    const text = pickFallback(persona, ctx)
    handlers.onToken(text)
    handlers.onDone(text, 'fallback')
  }
}

function buildMessages(persona: PersonaConfig, ctx: CommentaryContext): ChatMessage[] {
  return [
    { role: 'system', content: persona.systemPrompt },
    { role: 'user', content: buildUserMessage(ctx) },
  ]
}

const PIECE_NAME_RU: Record<string, string> = {
  p: 'пешку',
  n: 'коня',
  b: 'слона',
  r: 'ладью',
  q: 'ферзя',
  k: 'короля',
}

const PHASE_RU: Record<string, string> = {
  opening: 'дебют',
  middlegame: 'миттельшпиль',
  endgame: 'эндшпиль',
}

/**
 * Build a FACTS-only user message in Russian. The system prompt forbids the
 * model from inventing chess content; everything it can reference lives here.
 */
function buildUserMessage(ctx: CommentaryContext): string {
  const lines: string[] = ['ФАКТЫ:']

  if (ctx.trigger === 'opening') {
    lines.push('- Фаза: дебют')
    lines.push('- Партия только начинается. Ходов ещё нет.')
    lines.push('')
    lines.push('Поприветствуй игрока в характере. ОДНО-ДВА коротких предложения. Только обычный текст.')
    return lines.join('\n')
  }
  if (ctx.trigger === 'player-wins') {
    lines.push('- Игрок только что поставил тебе мат. Партия окончена. Ты проиграл.')
    lines.push('')
    lines.push('Отреагируй в характере — сдайся, обиженно или с достоинством. ОДНО-ДВА коротких предложения.')
    return lines.join('\n')
  }
  if (ctx.trigger === 'ai-wins') {
    lines.push('- Ты только что поставил мат игроку. Партия окончена. Ты выиграл.')
    lines.push('')
    lines.push('Отреагируй в характере — поторжествуй или с достоинством. ОДНО-ДВА коротких предложения.')
    return lines.join('\n')
  }
  if (ctx.trigger === 'draw') {
    lines.push('- Партия закончилась ничьёй.')
    lines.push('')
    lines.push('Отреагируй в характере. ОДНО-ДВА коротких предложения.')
    return lines.join('\n')
  }

  const mover =
    ctx.trigger.startsWith('player-') ? 'игрок (белые)' : 'ты (чёрные)'
  lines.push(`- Сыгранный ход: ${ctx.moveSan ?? '(неизвестно)'} — ${mover}`)
  if (ctx.capturedPiece) {
    const cap = PIECE_NAME_RU[ctx.capturedPiece.toLowerCase()] ?? pieceName(ctx.capturedPiece)
    if (cap) lines.push(`- Взятие: ${cap}`)
  }
  if (ctx.isMate) lines.push('- Это мат.')
  else if (ctx.isCheck) lines.push('- Король соперника под шахом.')
  if (ctx.analysis) {
    const a = ctx.analysis
    lines.push(`- Классификация движка: ${a.classification}`)
    lines.push(`- Оценка позиции после хода: ${a.evalDisplay} (плюс = белые, минус = чёрные)`)
    if (a.cpLoss >= 80 && a.bestMoveSan) {
      lines.push(`- Движок предпочёл бы: ${a.bestMoveSan}`)
    }
    if (a.walkedIntoMate) lines.push('- Этот ход ведёт в форсированный мат.')
    lines.push(`- Фаза: ${PHASE_RU[a.phase] ?? a.phase}`)
  }
  if (ctx.materialDescription) {
    lines.push(`- Материал: ${ctx.materialDescription}`)
  }
  if (ctx.recentHistory.length > 0) {
    lines.push(`- Последние ходы: ${ctx.recentHistory.join(' ')}`)
  }

  lines.push('')
  lines.push(
    'Реагируй В ХАРАКТЕРЕ. Используй ТОЛЬКО факты из блока ФАКТЫ. ОДНО-ДВА коротких предложения. Только обычный текст. Без кавычек вокруг ответа. ПИШИ НА РУССКОМ.',
  )
  return lines.join('\n')
}

/**
 * Strip surrounding (and stray inner) quotes the model loves to add. We try
 * several common quote pairs since Mistral Nemo will sometimes mix Russian
 * « », curly “ ”, regular " ", apostrophes, etc.
 */
const QUOTE_PAIRS: Array<[string, string]> = [
  ['"', '"'],
  ['“', '”'],
  ['«', '»'],
  ['„', '“'],
  ["'", "'"],
  ['‘', '’'],
]

function cleanReply(text: string): string {
  let out = text.trim()
  // Some models prefix with "Ответ: ..." or similar. Strip a single leading
  // label up to a colon if it doesn't look like content.
  const labelMatch = out.match(/^[^\p{L}\p{N}]{0,3}(ответ|реплика|комментарий|коуч|reply|response)\s*:\s*/iu)
  if (labelMatch) out = out.slice(labelMatch[0].length)

  // Strip matching surrounding quotes — repeat in case the model double-wraps.
  for (let i = 0; i < 3; i++) {
    let stripped = false
    for (const [open, close] of QUOTE_PAIRS) {
      if (out.length >= open.length + close.length && out.startsWith(open) && out.endsWith(close)) {
        out = out.slice(open.length, out.length - close.length).trim()
        stripped = true
        break
      }
    }
    if (!stripped) break
  }
  return out
}

function pickFallback(persona: PersonaConfig, ctx: CommentaryContext): string {
  const pool: string[] = []
  switch (ctx.trigger) {
    case 'opening':
      return persona.openingLine
    case 'player-capture':
      pool.push(...persona.fallbacks.playerCapture)
      break
    case 'player-check':
      pool.push(...persona.fallbacks.playerCheck)
      break
    case 'player-move':
      pool.push(...persona.fallbacks.playerMove)
      break
    case 'player-blunder':
      pool.push(...persona.fallbacks.playerBlunder)
      break
    case 'player-brilliant':
      pool.push(...persona.fallbacks.playerBrilliant)
      break
    case 'ai-move':
      pool.push(...persona.fallbacks.aiMove)
      break
    case 'ai-capture':
      pool.push(...persona.fallbacks.aiCapture)
      break
    case 'ai-check':
      pool.push(...persona.fallbacks.aiCheck)
      break
    case 'ai-blunder':
      pool.push(...persona.fallbacks.aiBlunder)
      break
    case 'player-wins':
      pool.push(...persona.fallbacks.playerWins)
      break
    case 'ai-wins':
      pool.push(...persona.fallbacks.aiWins)
      break
    case 'draw':
      pool.push(...persona.fallbacks.draw)
      break
  }
  if (pool.length === 0) return persona.openingLine
  return pool[Math.floor(Math.random() * pool.length)]
}
