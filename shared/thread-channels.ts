import type { Channel } from './domain'
import { CHANNEL_LABELS } from './domain'

/** Kanały w panelu rozmowy — czat / mail / telefon osobno. */
export const THREAD_CHANNELS = ['chat', 'email', 'phone'] as const
export type ThreadChannel = typeof THREAD_CHANNELS[number]

export const THREAD_CHANNEL_LABELS: Record<ThreadChannel, string> = {
  chat: CHANNEL_LABELS.chat,
  email: CHANNEL_LABELS.email,
  phone: CHANNEL_LABELS.phone
}

/** Mapuje event.channel na jedną z trzech zakładek (whatsapp→czat, form→mail). */
export function threadChannelOf(channel: string | null | undefined): ThreadChannel | null {
  if (channel === 'chat' || channel === 'whatsapp') return 'chat'
  if (channel === 'email' || channel === 'form') return 'email'
  if (channel === 'phone') return 'phone'
  return null
}

export function groupEventsByThreadChannel<T extends { channel: string }>(
  events: T[]
): Record<ThreadChannel, T[]> {
  const groups: Record<ThreadChannel, T[]> = {
    chat: [],
    email: [],
    phone: []
  }
  for (const event of events) {
    const key = threadChannelOf(event.channel)
    if (key) groups[key].push(event)
  }
  return groups
}

export function defaultThreadChannel(
  originChannel: string | null | undefined,
  groups: Record<ThreadChannel, unknown[]>
): ThreadChannel {
  const preferred = threadChannelOf(originChannel)
  if (preferred && groups[preferred].length) return preferred
  for (const key of THREAD_CHANNELS) {
    if (groups[key].length) return key
  }
  return preferred || 'chat'
}

export function isChannel(value: string): value is Channel {
  return value in CHANNEL_LABELS
}
