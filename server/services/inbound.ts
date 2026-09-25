import type { CallStatus, Channel, MessageDirection, SenderType } from '../../shared/domain'
import { shouldAttachToTicket } from '../../shared/inboundAttach'
import type { IdentifierInput } from '../../shared/resolveContact'
import { resolveContact } from './contacts'
import { neonQuery } from './neon-db'
import { addEvent, createTicket } from './tickets'

/** Wspólne wejście wszystkich złączników: mail, WhatsApp, telefon, agent AI. */
export type InboundEvent = {
  displayName: string
  identifiers: IdentifierInput[]
  channel: Channel
  body: string
  subject?: string
  occurredAt?: string
  relatedTransactionId?: string | null
  senderType?: SenderType
  direction?: MessageDirection
  callStatus?: CallStatus | null
  sunstoreUserId?: string | null
  hubspotContactId?: string | null
  externalThreadId?: string | null
}

export async function ingestInbound(event: InboundEvent) {
  const email = event.identifiers.find(item => item.type === 'email')?.value
  const phone = event.identifiers.find(item => item.type === 'phone')?.value
  const whatsapp = event.identifiers.find(item => item.type === 'whatsapp')?.value

  const resolved = await resolveContact({
    displayName: event.displayName,
    sunstoreUserId: event.sunstoreUserId,
    hubspotContactId: event.hubspotContactId,
    identifiers: event.identifiers,
    source: event.channel
  })

  const threadTicketId = event.externalThreadId
    ? await findTicketByThread(event.externalThreadId)
    : null
  const openTicketIds = await listOpenTicketIds(resolved.contact.id)
  const attach = shouldAttachToTicket({ threadTicketId, openTicketIds })

  if (attach.ticketId) {
    return addEvent(attach.ticketId, {
      channel: event.channel,
      direction: event.direction || (event.senderType === 'agent' ? 'to_customer' : 'to_customer'),
      senderType: event.senderType || 'customer',
      body: event.body,
      callStatus: event.callStatus,
      externalThreadId: event.externalThreadId,
      occurredAt: event.occurredAt ? new Date(event.occurredAt) : undefined
    })
  }

  return createTicket({
    displayName: event.displayName,
    email,
    phone,
    whatsapp,
    sunstoreUserId: event.sunstoreUserId,
    hubspotContactId: event.hubspotContactId,
    channel: event.channel,
    subject: event.subject,
    body: event.body,
    firstContactAt: event.occurredAt,
    relatedTransactionId: event.relatedTransactionId,
    callStatus: event.callStatus,
    senderType: event.senderType,
    externalThreadId: event.externalThreadId
  })
}

async function findTicketByThread(threadId: string): Promise<string | null> {
  const rows = await neonQuery<{ ticket_id: string }>(
    `select e.ticket_id
     from ticket_events e
     join tickets t on t.id = e.ticket_id
     where e.external_thread_id = $1
       and t.status <> 'closed'
     order by t.business_changed_at desc
     limit 1`,
    [threadId]
  )
  return rows[0]?.ticket_id ?? null
}

async function listOpenTicketIds(contactId: string): Promise<string[]> {
  const rows = await neonQuery<{ id: string }>(
    `select id from tickets
     where contact_id = $1 and status <> 'closed'
     order by business_changed_at desc`,
    [contactId]
  )
  return rows.map(row => row.id)
}
