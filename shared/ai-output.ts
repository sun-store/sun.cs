export type AiSummaryOutput = {
  summary: string
  need: string
  nextStep: string
}

export type AiDraftOutput = {
  text: string
  language: string
  needsReview: boolean
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function clipped(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max)
}

export function parseAiSummary(raw: string): AiSummaryOutput {
  let parsed: unknown
  try {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw)
  } catch {
    throw new Error('Model nie zwrócił poprawnego JSON.')
  }
  const obj = asObject(parsed)
  if (!obj) throw new Error('Model nie zwrócił obiektu podsumowania.')
  const summary = clipped(obj.summary, 300)
  const need = clipped(obj.need ?? obj.need_pl, 200)
  const nextStep = clipped(obj.next_step ?? obj.nextStep, 200)
  if (!summary || !need || !nextStep) {
    throw new Error('Podsumowanie AI jest niekompletne.')
  }
  return { summary, need, nextStep }
}

export function parseAiDraft(raw: string, needsReview: boolean): AiDraftOutput {
  let text = raw.trim()
  let language = 'unknown'
  try {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) {
      const obj = asObject(JSON.parse(raw.slice(start, end + 1)))
      if (obj?.text) {
        text = clipped(obj.text, 4000)
        language = clipped(obj.language, 40) || 'unknown'
      }
    }
  } catch {
    // plain text draft
  }
  if (!text) throw new Error('Pusty szkic odpowiedzi.')
  return { text, language, needsReview }
}
