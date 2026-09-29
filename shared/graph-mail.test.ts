import { describe, expect, it } from 'vitest'
import {
  htmlToText,
  mailBodyText,
  replyCommentHtml,
  replySubject,
  runDeltaPages,
  toInboundMail,
  type GraphMessage
} from './graph-mail'

const mailbox = 'support@sun.store'
const since = new Date('2026-09-29T08:00:00Z')

function msg(over: Partial<GraphMessage> = {}): GraphMessage {
  return {
    id: 'AAMk-1',
    receivedDateTime: '2026-09-29T09:00:00Z',
    subject: 'Brak CMR',
    conversationId: 'AAQk-conv',
    isDraft: false,
    from: { emailAddress: { address: 'Jan@Firma.DE', name: 'Jan Kowalski' } },
    ...over
  }
}

describe('toInboundMail', () => {
  it('maps a customer mail', () => {
    expect(toInboundMail(msg(), { mailbox, since })).toEqual({
      mail: {
        graphMessageId: 'AAMk-1',
        fromAddress: 'jan@firma.de',
        fromName: 'Jan Kowalski',
        subject: 'Brak CMR',
        receivedAt: '2026-09-29T09:00:00.000Z',
        conversationId: 'AAQk-conv'
      }
    })
  })

  it('skips removed, drafts and mail without sender', () => {
    expect(toInboundMail(msg({ '@removed': { reason: 'deleted' } }), { mailbox, since })).toEqual({ skip: 'removed' })
    expect(toInboundMail(msg({ isDraft: true }), { mailbox, since })).toEqual({ skip: 'draft' })
    expect(toInboundMail(msg({ from: null }), { mailbox, since })).toEqual({ skip: 'no_sender' })
  })

  it('skips our own mailbox regardless of case', () => {
    const own = msg({ from: { emailAddress: { address: 'Support@Sun.Store' } } })
    expect(toInboundMail(own, { mailbox, since })).toEqual({ skip: 'own_mailbox' })
  })

  it('skips mail received before the sync start', () => {
    expect(toInboundMail(msg({ receivedDateTime: '2026-09-28T09:00:00Z' }), { mailbox, since })).toEqual({ skip: 'before_start' })
    expect(toInboundMail(msg({ receivedDateTime: null }), { mailbox, since })).toEqual({ skip: 'before_start' })
  })

  it('skips auto replies and bounces', () => {
    expect(toInboundMail(msg({ subject: 'Automatic reply: Brak CMR' }), { mailbox, since })).toEqual({ skip: 'auto_reply' })
    expect(toInboundMail(msg({ subject: 'Out of Office' }), { mailbox, since })).toEqual({ skip: 'auto_reply' })
    const bounce = msg({ from: { emailAddress: { address: 'MAILER-DAEMON@firma.de' } } })
    expect(toInboundMail(bounce, { mailbox, since })).toEqual({ skip: 'auto_reply' })
  })

  it('falls back to the address when the name is empty', () => {
    const result = toInboundMail(msg({ from: { emailAddress: { address: 'a@b.pl', name: ' ' } } }), { mailbox, since })
    expect(result).toMatchObject({ mail: { fromName: 'a@b.pl' } })
  })
})

describe('mail body', () => {
  it('keeps text and trims blank runs', () => {
    expect(mailBodyText({ contentType: 'text', content: 'Hej\r\n\r\n\r\n\r\nCMR w załączniku  ' })).toBe('Hej\n\nCMR w załączniku')
  })

  it('converts html as a fallback', () => {
    expect(htmlToText('<p>A &amp; B</p><br>C<style>x{}</style>')).toBe('A & B\n\nC')
    expect(mailBodyText({ contentType: 'html', content: '<div>Hi</div>' })).toBe('Hi')
  })

  it('never returns an empty body', () => {
    expect(mailBodyText(null)).toBe('(pusta wiadomość)')
  })
})

describe('reply helpers', () => {
  it('escapes agent text for the Graph comment', () => {
    expect(replyCommentHtml('<b>1 & 2</b>\nok')).toBe('&lt;b&gt;1 &amp; 2&lt;/b&gt;<br>ok')
  })

  it('prefixes Re: once', () => {
    expect(replySubject('Brak CMR')).toBe('Re: Brak CMR')
    expect(replySubject('RE: Brak CMR')).toBe('RE: Brak CMR')
    expect(replySubject(null)).toBe('sun.support')
  })
})

describe('runDeltaPages', () => {
  it('follows nextLink until deltaLink and saves each cursor after handling', async () => {
    const pages: Record<string, object> = {
      start: { 'value': [msg({ id: '1' })], '@odata.nextLink': 'p2' },
      p2: { 'value': [msg({ id: '2' })], '@odata.deltaLink': 'delta' }
    }
    const log: string[] = []
    const result = await runDeltaPages({
      startUrl: 'start',
      fetchPage: async url => pages[url] ?? {},
      handleMessages: async (messages) => {
        log.push(`handle:${messages.map(m => m.id).join(',')}`)
      },
      saveCursor: async (cursor) => {
        log.push(`save:${cursor}`)
      },
      maxPages: 10,
      deadline: Number.POSITIVE_INFINITY
    })
    expect(result).toEqual({ pages: 2, caughtUp: true })
    expect(log).toEqual(['handle:1', 'save:p2', 'handle:2', 'save:delta'])
  })

  it('stops at the page budget and leaves nextLink as the cursor', async () => {
    const saved: string[] = []
    const result = await runDeltaPages({
      startUrl: 'start',
      fetchPage: async url => ({ 'value': [], '@odata.nextLink': `${url}+` }),
      handleMessages: async () => {},
      saveCursor: async (cursor) => {
        saved.push(cursor)
      },
      maxPages: 2,
      deadline: Number.POSITIVE_INFINITY
    })
    expect(result).toEqual({ pages: 2, caughtUp: false })
    expect(saved.at(-1)).toBe('start++')
  })

  it('does not save the cursor when handling fails', async () => {
    const saved: string[] = []
    await expect(runDeltaPages({
      startUrl: 'start',
      fetchPage: async () => ({ 'value': [msg()], '@odata.deltaLink': 'delta' }),
      handleMessages: async () => {
        throw new Error('db down')
      },
      saveCursor: async (cursor) => {
        saved.push(cursor)
      },
      maxPages: 5,
      deadline: Number.POSITIVE_INFINITY
    })).rejects.toThrow('db down')
    expect(saved).toEqual([])
  })

  it('respects the time budget', async () => {
    const result = await runDeltaPages({
      startUrl: 'start',
      fetchPage: async () => ({ '@odata.deltaLink': 'delta' }),
      handleMessages: async () => {},
      saveCursor: async () => {},
      maxPages: 5,
      deadline: 100,
      now: () => 200
    })
    expect(result).toEqual({ pages: 0, caughtUp: false })
  })
})
