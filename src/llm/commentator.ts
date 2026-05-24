import { streamChat, getFeatherlessKey, type ChatMessage } from './client'
import { getPersona, type PersonaConfig } from './personas'

export type MoveTrigger =
  | 'opening'
  | 'player-move'
  | 'player-capture'
  | 'player-check'
  | 'ai-move'
  | 'ai-capture'
  | 'ai-check'
  | 'player-wins'
  | 'ai-wins'
  | 'draw'

export interface CommentaryContext {
  trigger: MoveTrigger
  moveSan?: string
  moveNumber: number
  totalMoves: number
  fenAfterMove: string
  /** Last 6-10 moves SAN, oldest first */
  recentHistory: string[]
}

export interface CommentaryHandlers {
  onToken: (token: string) => void
  onDone: (full: string, source: 'llm' | 'fallback') => void
  onError?: (err: unknown) => void
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

    let full = ''
    ;(async () => {
      try {
        for await (const token of streamChat(messages, {
          signal: controller.signal,
          maxTokens: 70,
          temperature: 0.9,
        })) {
          full += token
          handlers.onToken(token)
        }
        handlers.onDone(full.trim(), 'llm')
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
  const userMsg = buildUserMessage(ctx)
  return [
    { role: 'system', content: persona.systemPrompt },
    { role: 'user', content: userMsg },
  ]
}

function buildUserMessage(ctx: CommentaryContext): string {
  const parts: string[] = []
  parts.push(`Trigger: ${ctx.trigger}`)
  if (ctx.moveSan) parts.push(`Move just played: ${ctx.moveSan}`)
  parts.push(`Move number: ${ctx.moveNumber}`)
  if (ctx.recentHistory.length > 0) {
    parts.push(`Recent moves (oldest first): ${ctx.recentHistory.join(' ')}`)
  }
  parts.push(`Position FEN: ${ctx.fenAfterMove}`)
  parts.push('')
  parts.push('Reply in your voice. ONE OR TWO short sentences. No markdown.')
  return parts.join('\n')
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
    case 'ai-move':
      pool.push(...persona.fallbacks.aiMove)
      break
    case 'ai-capture':
      pool.push(...persona.fallbacks.aiCapture)
      break
    case 'ai-check':
      pool.push(...persona.fallbacks.aiCheck)
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
