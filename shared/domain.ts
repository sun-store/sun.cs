export const CHANNELS = ['chat', 'email', 'phone', 'whatsapp', 'form'] as const
export type Channel = typeof CHANNELS[number]

export const MESSAGE_DIRECTIONS = ['to_customer', 'to_seller', 'internal'] as const
export type MessageDirection = typeof MESSAGE_DIRECTIONS[number]

export const SENDER_TYPES = ['customer', 'agent', 'bot', 'system'] as const
export type SenderType = typeof SENDER_TYPES[number]

export const CUSTOMER_ROLES = ['buyer', 'seller'] as const
export type CustomerRole = typeof CUSTOMER_ROLES[number]

export const APP_ROLES = ['admin', 'lead', 'agent'] as const
export type AppRole = typeof APP_ROLES[number]

export const TICKET_STATUSES = ['open', 'waiting', 'closed'] as const
export type TicketStatus = typeof TICKET_STATUSES[number]

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type TicketPriority = typeof TICKET_PRIORITIES[number]

export const CALL_STATUSES = ['answered', 'no_answer', 'callback'] as const
export type CallStatus = typeof CALL_STATUSES[number]

export const IDENTIFIER_TYPES = [
  'email',
  'phone',
  'whatsapp',
  'chat_thread',
  'sunstore_user',
  'hubspot_contact'
] as const
export type IdentifierType = typeof IDENTIFIER_TYPES[number]

export const CHANNEL_LABELS: Record<Channel, string> = {
  chat: 'Czat',
  email: 'E-mail',
  phone: 'Telefon',
  whatsapp: 'WhatsApp',
  form: 'Formularz'
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Otwarta',
  waiting: 'Czeka',
  closed: 'Zamknięta'
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Niski',
  medium: 'Średni',
  high: 'Wysoki',
  urgent: 'Pilny'
}

export const CATEGORIES = [
  'delivery',
  'payment',
  'account',
  'product',
  'other'
] as const
export type Category = typeof CATEGORIES[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  delivery: 'Dostawa',
  payment: 'Płatność',
  account: 'Konto',
  product: 'Produkt',
  other: 'Inne'
}

export const HEADLINE_SLA_CHANNELS = ['chat', 'email'] as const
export type HeadlineSlaChannel = typeof HEADLINE_SLA_CHANNELS[number]

export const SLA_THRESHOLD_MS = {
  chat: 30 * 60 * 1000,
  email: 2 * 60 * 60 * 1000,
  phone: 30 * 60 * 1000
} as const

export type Ticket = {
  id: string
  contactId: string
  createdAt: Date
  firstContactAt: Date
  firstAgentReplyAt: Date | null
  channel: Channel
  category: string | null
  priority: TicketPriority | null
  relatedTransactionId: string | null
  closedAt: Date | null
  ownerId: string | null
  status: TicketStatus
  subject: string | null
  callStatus?: CallStatus | null
}

export type Message = {
  id: string
  ticketId: string
  createdAt: Date
  direction: MessageDirection
  senderType: SenderType
  body: string
}

export type ContactIdentifier = {
  type: IdentifierType
  value: string
  source?: string
}

export type CustomerOrder = {
  transactionId: string
  status: string | null
  pickupAt: string | null
  deliveryAt: string | null
  trackingUrl: string | null
  issue: boolean
  clientClaim: boolean
  logisticsUrl: string | null
}
