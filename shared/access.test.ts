import { describe, expect, it } from 'vitest'
import { canBrowseAllDepartments, defaultDepartmentFilter, seesAllTickets } from './access'

describe('seesAllTickets', () => {
  it('gives admin and lead the full inbox', () => {
    expect(seesAllTickets('admin')).toBe(true)
    expect(seesAllTickets('lead')).toBe(true)
  })

  it('limits an agent to owned tickets', () => {
    expect(seesAllTickets('agent')).toBe(false)
  })
})

describe('department browse defaults', () => {
  it('lets Support and leads see all departments by default', () => {
    expect(canBrowseAllDepartments('admin', 'finance')).toBe(true)
    expect(canBrowseAllDepartments('agent', 'cs')).toBe(true)
    expect(defaultDepartmentFilter('lead', 'cs')).toBe('all')
  })

  it('pins logistics/finance agents to their own queue', () => {
    expect(canBrowseAllDepartments('agent', 'logistics')).toBe(false)
    expect(defaultDepartmentFilter('agent', 'logistics')).toBe('logistics')
    expect(defaultDepartmentFilter('agent', 'finance')).toBe('finance')
  })
})
