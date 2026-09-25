export function shouldAttachToTicket(input: {
  threadTicketId: string | null
  openTicketIds: string[]
}): { ticketId: string | null, reason: 'thread' | 'single_open' | 'new' } {
  if (input.threadTicketId) {
    return { ticketId: input.threadTicketId, reason: 'thread' }
  }
  const unique = [...new Set(input.openTicketIds.filter(Boolean))]
  if (unique.length === 1) {
    return { ticketId: unique[0], reason: 'single_open' }
  }
  return { ticketId: null, reason: 'new' }
}
