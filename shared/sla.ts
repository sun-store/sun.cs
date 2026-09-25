import type { CallStatus, Channel, HeadlineSlaChannel, Message, Ticket } from './domain'
import { HEADLINE_SLA_CHANNELS, SLA_THRESHOLD_MS } from './domain'
import {
  businessSecondsBetween,
  DEFAULT_WORK_CALENDAR,
  holidayOn,
  isWithinBusinessHours,
  type WorkCalendar
} from './workingHours'

export type SlaExclusion = 'off_hours' | 'holiday' | 'channel' | 'missing_reply' | 'reply_before_contact'

export type SlaResult = {
  eligible: boolean
  exclusion: SlaExclusion | null
  holidayName: string | null
  firstContactAt: Date
  firstAgentReplyAt: Date | null
  businessMs: number | null
  thresholdMs: number | null
  met: boolean | null
}

export function firstAgentReplyToCustomer(messages: Message[]): Date | null {
  const first = messages
    .filter(message => message.senderType === 'agent' && message.direction === 'to_customer')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
  return first?.createdAt ?? null
}

export function lockFirstAgentReply(current: Date | null, candidate: Date): Date {
  return current ?? candidate
}

export function isHeadlineSlaChannel(channel: Channel): channel is HeadlineSlaChannel {
  return (HEADLINE_SLA_CHANNELS as readonly string[]).includes(channel)
}

export type SlaTicket = Pick<Ticket, 'firstContactAt' | 'firstAgentReplyAt' | 'channel'> & {
  callStatus?: CallStatus | null
}

function thresholdMsFor(ticket: SlaTicket): number | null {
  if (isHeadlineSlaChannel(ticket.channel)) return SLA_THRESHOLD_MS[ticket.channel]
  if (ticket.channel === 'phone' && ticket.callStatus) return SLA_THRESHOLD_MS.phone
  return null
}

export function evaluateSla(
  ticket: SlaTicket,
  calendar: WorkCalendar = DEFAULT_WORK_CALENDAR
): SlaResult {
  const holiday = holidayOn(ticket.firstContactAt, calendar)
  const thresholdMs = thresholdMsFor(ticket)

  if (thresholdMs === null) {
    return baseResult(ticket, { eligible: false, exclusion: 'channel', holidayName: holiday?.name ?? null, thresholdMs })
  }
  if (!ticket.firstAgentReplyAt) {
    return baseResult(ticket, { eligible: false, exclusion: 'missing_reply', holidayName: holiday?.name ?? null, thresholdMs })
  }
  if (ticket.firstAgentReplyAt < ticket.firstContactAt) {
    return baseResult(ticket, { eligible: false, exclusion: 'reply_before_contact', holidayName: holiday?.name ?? null, thresholdMs })
  }
  if (holiday) {
    return baseResult(ticket, { eligible: false, exclusion: 'holiday', holidayName: holiday.name, thresholdMs })
  }
  if (!isWithinBusinessHours(ticket.firstContactAt, calendar)) {
    return baseResult(ticket, { eligible: false, exclusion: 'off_hours', holidayName: null, thresholdMs })
  }

  const seconds = businessSecondsBetween(ticket.firstContactAt, ticket.firstAgentReplyAt, calendar)
  const businessMs = seconds === null ? null : seconds * 1000
  const met = businessMs === null ? null : businessMs <= thresholdMs

  return {
    eligible: true,
    exclusion: null,
    holidayName: null,
    firstContactAt: ticket.firstContactAt,
    firstAgentReplyAt: ticket.firstAgentReplyAt,
    businessMs,
    thresholdMs,
    met
  }
}

function baseResult(
  ticket: Pick<Ticket, 'firstContactAt' | 'firstAgentReplyAt'>,
  extra: Pick<SlaResult, 'eligible' | 'exclusion' | 'holidayName' | 'thresholdMs'>
): SlaResult {
  return {
    ...extra,
    firstContactAt: ticket.firstContactAt,
    firstAgentReplyAt: ticket.firstAgentReplyAt,
    businessMs: null,
    met: null
  }
}
