import { describe, expect, it } from 'vitest'
import { seesAllTickets } from './access'

describe('seesAllTickets', () => {
  it('gives admin and lead the full inbox', () => {
    expect(seesAllTickets('admin')).toBe(true)
    expect(seesAllTickets('lead')).toBe(true)
  })

  it('limits an agent to owned tickets', () => {
    expect(seesAllTickets('agent')).toBe(false)
  })
})
