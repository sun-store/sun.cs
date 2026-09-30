import { describe, expect, it } from 'vitest'
import {
  defaultDepartmentFilter,
  resolveTicketAccess,
  seesAllDepartments,
  seesAllTickets
} from './access'

describe('seesAllTickets', () => {
  it('gives admin and lead the full inbox', () => {
    expect(seesAllTickets('admin')).toBe(true)
    expect(seesAllTickets('lead')).toBe(true)
  })

  it('does not treat role=agent as all-tickets by itself', () => {
    expect(seesAllTickets('agent')).toBe(false)
  })
})

describe('department access', () => {
  it('lets Support agents and leads see every department', () => {
    expect(seesAllDepartments('admin', 'finance')).toBe(true)
    expect(seesAllDepartments('lead', 'cs')).toBe(true)
    expect(seesAllDepartments('agent', 'cs')).toBe(true)
    expect(defaultDepartmentFilter('agent', 'cs')).toBe('all')
  })

  it('scopes logistics and finance agents to their department', () => {
    expect(seesAllDepartments('agent', 'logistics')).toBe(false)
    expect(resolveTicketAccess({ role: 'agent', department: 'logistics' })).toEqual({
      type: 'department',
      department: 'logistics'
    })
    expect(resolveTicketAccess({ role: 'agent', department: 'finance' })).toEqual({
      type: 'department',
      department: 'finance'
    })
  })

  it('drops a case from logistics after it moves to finance', () => {
    const logistics = resolveTicketAccess({ role: 'agent', department: 'logistics' })
    const finance = resolveTicketAccess({ role: 'agent', department: 'finance' })
    expect(logistics).toEqual({ type: 'department', department: 'logistics' })
    expect(finance).toEqual({ type: 'department', department: 'finance' })
    expect(logistics).not.toEqual(finance)
  })

  it('gives import/cron paths unrestricted access when actor is omitted', () => {
    expect(resolveTicketAccess(undefined)).toEqual({ type: 'all' })
  })
})
