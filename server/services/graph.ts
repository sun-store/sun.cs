import { replyCommentHtml } from '../../shared/graph-mail'

/**
 * Microsoft Graph dla wspólnej skrzynki CS. Aplikacja Entra z uprawnieniami
 * Mail.Read (+ Mail.Send po przełączeniu z HubSpota) przez RBAC for Applications,
 * zawężona do jednej skrzynki (docs/OUTLOOK-MAIL.md).
 * Sekrety tylko z env serwera; nie logujemy ani tokenu, ani treści odpowiedzi błędu.
 */

const GRAPH = 'https://graph.microsoft.com/v1.0'

type GraphConfig = {
  tenantId: string
  clientId: string
  clientSecret: string
  mailbox: string
}

function env(name: string): string {
  return String(process.env[name] || '').trim()
}

function graphConfig(): GraphConfig | null {
  const config = {
    tenantId: env('GRAPH_TENANT_ID'),
    clientId: env('GRAPH_CLIENT_ID'),
    clientSecret: env('GRAPH_CLIENT_SECRET'),
    mailbox: env('OUTLOOK_MAILBOX').toLowerCase()
  }
  return Object.values(config).every(Boolean) ? config : null
}

export function hasGraphConfig(): boolean {
  return graphConfig() !== null
}

export function outlookMailbox(): string {
  return graphConfig()?.mailbox ?? ''
}

function requireConfig(): GraphConfig {
  const config = graphConfig()
  if (!config) throw new Error('Outlook nie jest skonfigurowany (GRAPH_* / OUTLOOK_MAILBOX).')
  return config
}

let cachedToken: { value: string, expiresAt: number } | null = null

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value
  const config = requireConfig()
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    })
  })
  if (!response.ok) {
    throw new Error(`Graph: token odrzucony (${response.status}).`)
  }
  const data = await response.json() as { access_token?: string, expires_in?: number }
  if (!data.access_token) throw new Error('Graph: brak access_token.')
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 }
  return cachedToken.value
}

async function graphRequest(url: string, init: { method?: string, body?: unknown, prefer?: string[] } = {}): Promise<Response> {
  if (!url.startsWith(GRAPH)) throw new Error('Graph: nieoczekiwany adres.')
  const headers: Record<string, string> = { authorization: `Bearer ${await accessToken()}` }
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  if (init.prefer?.length) headers.prefer = init.prefer.join(', ')
  const response = await fetch(url, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  })
  if (!response.ok) {
    const code = await response.json()
      .then((data: { error?: { code?: string } }) => data.error?.code ?? '')
      .catch(() => '')
    throw new Error(`Graph ${response.status}${code ? ` ${code}` : ''}.`)
  }
  return response
}

function mailboxPath(): string {
  return `${GRAPH}/users/${encodeURIComponent(requireConfig().mailbox)}`
}

export function inboxDeltaUrl(): string {
  const select = 'id,receivedDateTime,subject,from,conversationId,isDraft'
  return `${mailboxPath()}/mailFolders/inbox/messages/delta?$select=${select}`
}

export async function fetchDeltaPage(url: string) {
  const response = await graphRequest(url, { prefer: ['odata.maxpagesize=50'] })
  return response.json()
}

/** Sama nowa część maila (bez cytatu poprzednich), jako tekst. */
export async function fetchMessageBody(messageId: string) {
  const response = await graphRequest(
    `${mailboxPath()}/messages/${encodeURIComponent(messageId)}?$select=uniqueBody,body`,
    { prefer: ['outlook.body-content-type="text"'] }
  )
  const data = await response.json() as {
    uniqueBody?: { contentType?: string, content?: string }
    body?: { contentType?: string, content?: string }
  }
  return data.uniqueBody?.content?.trim() ? data.uniqueBody : data.body
}

/** Odpowiedź w wątku klienta. Graph dokłada cytat i nagłówki In-Reply-To. */
export async function replyToMessage(messageId: string, text: string): Promise<void> {
  await graphRequest(`${mailboxPath()}/messages/${encodeURIComponent(messageId)}/reply`, {
    method: 'POST',
    body: { comment: replyCommentHtml(text) }
  })
}

/** Nowy mail, gdy w sprawie nie ma jeszcze wiadomości z Outlooka (np. import HubSpot). */
export async function sendNewMail(input: { to: string, subject: string, text: string }): Promise<void> {
  await graphRequest(`${mailboxPath()}/sendMail`, {
    method: 'POST',
    body: {
      message: {
        subject: input.subject,
        body: { contentType: 'Text', content: input.text },
        toRecipients: [{ emailAddress: { address: input.to } }]
      },
      saveToSentItems: true
    }
  })
}
