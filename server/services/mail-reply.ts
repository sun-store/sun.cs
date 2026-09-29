import { replySubject } from '../../shared/graph-mail'
import { boundedText, TEXT_LIMITS } from '../../shared/text-bounds'
import { hasGraphConfig, replyToMessage, sendNewMail } from './graph'
import { neonQuery } from './neon-db'
import { getTicket, type TicketActor } from './tickets'

export type OutboundMail = { sent: boolean }

/**
 * Wysyła odpowiedź agenta mailem, zanim trafi na oś czasu.
 * Bez konfiguracji Outlooka zwraca sent: false i nic nie wysyła (dotychczasowe zachowanie: tylko zapis).
 * Zwraca null, gdy aktor nie widzi sprawy.
 */
export async function sendTicketMail(ticketId: string, rawText: string, actor: TicketActor): Promise<OutboundMail | null> {
  const text = boundedText(rawText, TEXT_LIMITS.body, 'Treść')
  const ticket = await getTicket(ticketId, actor)
  if (!ticket) return null
  if (ticket.closedAt) throw new Error('Nie można dopisać wydarzenia do zamkniętej sprawy.')
  if (!hasGraphConfig()) return { sent: false }

  const lastInbound = await neonQuery<{ graph_message_id: string }>(
    `select graph_message_id from ticket_events
     where ticket_id = $1 and graph_message_id is not null and sender_type = 'customer'
     order by created_at desc
     limit 1`,
    [ticketId]
  )
  const replyTo = lastInbound[0]?.graph_message_id
  if (replyTo) {
    await replyToMessage(replyTo, text)
    return { sent: true }
  }

  const to = ticket.contact?.identifiers.find(item => item.type === 'email')?.value
  if (!to) throw new Error('Klient nie ma adresu e-mail. Dopisz go w kontakcie albo wybierz inny kanał.')
  await sendNewMail({ to, subject: replySubject(ticket.subject), text })
  return { sent: true }
}
