import type { AppRole } from './domain'
import type { Department } from './departments'

/** Admin i lead widzą wszystkie sprawy (KPI / nadzór). */
export function seesAllTickets(role: AppRole): boolean {
  return role === 'admin' || role === 'lead'
}

/**
 * Pełny dostęp do spraw wszystkich działów:
 * admin, lead oraz osoby z działu Support (`cs`).
 */
export function seesAllDepartments(
  role: AppRole,
  department: Department | null | undefined
): boolean {
  return seesAllTickets(role) || !department || department === 'cs'
}

/** @deprecated Używaj seesAllDepartments — nazwa historyczna z UI filtrów. */
export function canBrowseAllDepartments(
  role: AppRole,
  department: Department | null | undefined
): boolean {
  return seesAllDepartments(role, department)
}

export function defaultDepartmentFilter(
  role: AppRole,
  department: Department | null | undefined
): Department | 'all' {
  if (seesAllDepartments(role, department)) return 'all'
  return department || 'cs'
}

export type TicketAccess
  = { type: 'all' }
    | { type: 'department', department: Department }
    | { type: 'none' }

/** Zakres wierszy w SQL (bez RLS — filtr w aplikacji). */
export function resolveTicketAccess(actor: {
  role: AppRole
  department?: Department | null
} | undefined): TicketAccess {
  if (!actor) return { type: 'all' }
  if (seesAllDepartments(actor.role, actor.department)) return { type: 'all' }
  if (actor.department) return { type: 'department', department: actor.department }
  return { type: 'none' }
}
