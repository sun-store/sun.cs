import type { AppRole } from './domain'

/** Admin i lead widzą wszystkie sprawy. Agent — tylko te, gdzie jest właścicielem. */
export function seesAllTickets(role: AppRole): boolean {
  return role === 'admin' || role === 'lead'
}
