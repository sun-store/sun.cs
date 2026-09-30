import type { AppRole } from './domain'
import type { Department } from './departments'

/** Admin i lead widzą wszystkie sprawy. Agent — tylko te, gdzie jest właścicielem. */
export function seesAllTickets(role: AppRole): boolean {
  return role === 'admin' || role === 'lead'
}

/** Support (cs) oraz admin/lead przeglądają wszystkie działy; reszta — swój. */
export function canBrowseAllDepartments(role: AppRole, department: Department | null | undefined): boolean {
  return seesAllTickets(role) || !department || department === 'cs'
}

export function defaultDepartmentFilter(
  role: AppRole,
  department: Department | null | undefined
): Department | 'all' {
  if (canBrowseAllDepartments(role, department)) return 'all'
  return department || 'cs'
}
