export function hasAiConfig(): boolean {
  return Boolean(String(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '').trim())
}

export type GenerateInput = {
  system: string
  messages: Array<{ role: 'user' | 'assistant', content: string }>
  maxTokens?: number
}

export async function generate(input: GenerateInput): Promise<string> {
  const anthropicKey = String(process.env.ANTHROPIC_API_KEY || '').trim()
  if (anthropicKey) {
    return generateAnthropic(anthropicKey, input)
  }
  const openAiKey = String(process.env.OPENAI_API_KEY || '').trim()
  if (openAiKey) {
    return generateOpenAi(openAiKey, input)
  }
  throw new Error('Brak klucza AI (ANTHROPIC_API_KEY lub OPENAI_API_KEY).')
}

async function generateAnthropic(apiKey: string, input: GenerateInput): Promise<string> {
  const model = String(process.env.AI_MODEL || 'claude-sonnet-4-20250514').trim()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens ?? 800,
        system: input.system,
        messages: input.messages
      }),
      signal: controller.signal
    })
    if (!res.ok) {
      throw new Error(`Model AI zwrócił ${res.status}.`)
    }
    const data = await res.json() as {
      content?: Array<{ type?: string, text?: string }>
    }
    const text = data.content?.find(part => part.type === 'text')?.text
    if (!text?.trim()) throw new Error('Pusta odpowiedź modelu.')
    return text.trim()
  } finally {
    clearTimeout(timer)
  }
}

async function generateOpenAi(apiKey: string, input: GenerateInput): Promise<string> {
  const model = String(process.env.AI_MODEL || 'gpt-4.1-mini').trim()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens ?? 800,
        messages: [
          { role: 'system', content: input.system },
          ...input.messages
        ]
      }),
      signal: controller.signal
    })
    if (!res.ok) {
      throw new Error(`Model AI zwrócił ${res.status}.`)
    }
    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = data.choices?.[0]?.message?.content
    if (!text?.trim()) throw new Error('Pusta odpowiedź modelu.')
    return text.trim()
  } finally {
    clearTimeout(timer)
  }
}
