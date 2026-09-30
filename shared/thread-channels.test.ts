import { describe, expect, it } from 'vitest'
import {
  defaultThreadChannel,
  groupEventsByThreadChannel,
  threadChannelOf
} from './thread-channels'

describe('threadChannelOf', () => {
  it('mapuje kanały HubSpot na zakładki panelu', () => {
    expect(threadChannelOf('chat')).toBe('chat')
    expect(threadChannelOf('whatsapp')).toBe('chat')
    expect(threadChannelOf('email')).toBe('email')
    expect(threadChannelOf('form')).toBe('email')
    expect(threadChannelOf('phone')).toBe('phone')
  })
})

describe('groupEventsByThreadChannel', () => {
  it('rozdziela czat, mail i telefon', () => {
    const groups = groupEventsByThreadChannel([
      { channel: 'chat', id: '1' },
      { channel: 'email', id: '2' },
      { channel: 'phone', id: '3' },
      { channel: 'whatsapp', id: '4' }
    ])
    expect(groups.chat.map(e => e.id)).toEqual(['1', '4'])
    expect(groups.email.map(e => e.id)).toEqual(['2'])
    expect(groups.phone.map(e => e.id)).toEqual(['3'])
  })

  it('defaultThreadChannel bierze origin albo pierwszy niepusty', () => {
    const groups = groupEventsByThreadChannel([
      { channel: 'email', id: '2' }
    ])
    expect(defaultThreadChannel('chat', groups)).toBe('email')
    expect(defaultThreadChannel('email', groups)).toBe('email')
  })
})
