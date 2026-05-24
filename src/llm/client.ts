const FEATHERLESS_BASE_URL = 'https://api.featherless.ai/v1'
const FEATHERLESS_MODEL = 'mistralai/Mistral-Nemo-Instruct-2407'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function getFeatherlessKey(): string | null {
  const key = (import.meta.env.VITE_FEATHERLESS_API_KEY as string | undefined)?.trim()
  return key && key.length > 0 ? key : null
}

export interface StreamOptions {
  signal?: AbortSignal
  maxTokens?: number
  temperature?: number
}

/**
 * Call Featherless chat completions in streaming mode. Yields content tokens
 * as they arrive. Throws on HTTP error or abort.
 */
export async function* streamChat(
  messages: ChatMessage[],
  opts: StreamOptions = {},
): AsyncGenerator<string, void, unknown> {
  const key = getFeatherlessKey()
  if (!key) throw new Error('VITE_FEATHERLESS_API_KEY not configured')

  const response = await fetch(`${FEATHERLESS_BASE_URL}/chat/completions`, {
    method: 'POST',
    signal: opts.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: FEATHERLESS_MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 80,
      temperature: opts.temperature ?? 0.85,
      top_p: 0.92,
      frequency_penalty: 0.3,
      presence_penalty: 0.2,
      stream: true,
    }),
  })

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '')
    throw new Error(`Featherless ${response.status}: ${text.slice(0, 200)}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const chunk = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>
        }
        const piece = chunk.choices?.[0]?.delta?.content
        if (piece) yield piece
      } catch {
        // Featherless emits keepalives — ignore non-JSON.
      }
    }
  }
}
