import type { AwaitingParty } from './reply-clock'
import { replyDueLabel, type ReplyDueLabel, type ReplyDueTone } from './reply-due-label'

export type SlaTone = 'late' | 'soon' | 'ok' | 'muted'

export type SlaBadge = {
  text: string
  tone: SlaTone
}

const TONE_MAP: Record<ReplyDueTone, SlaTone> = {
  overdue: 'late',
  urgent: 'soon',
  muted: 'ok'
}

/** Znacznik SLA liczony na serwerze — UI tylko wyświetla. */
export function slaBadge(
  replyDueAt: Date | string | null | undefined,
  awaiting: AwaitingParty | null | undefined,
  now = new Date()
): SlaBadge {
  const label: ReplyDueLabel = replyDueLabel(awaiting, replyDueAt, now)
  if (label.text === 'czeka na klienta' || label.text === '—') {
    return { text: label.text, tone: 'muted' }
  }
  return {
    text: label.text,
    tone: TONE_MAP[label.tone]
  }
}
