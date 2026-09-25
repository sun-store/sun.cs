import type { CustomerRole, IdentifierType } from '../../shared/domain'
import { detectContactConflict, lookupOrder, type IdentifierInput } from '../../shared/resolveContact'
import { neonQuery } from './neon-db'

export type ContactRow = {
  id: string
  display_name: string
  customer_role: CustomerRole | null
  sunstore_user_id: string | null
  hubspot_contact_id: string | null
}

export type ResolvedContact = {
  contact: ContactRow
  created: boolean
  conflictIds: string[]
}

export async function resolveContact(input: {
  displayName?: string
  customerRole?: CustomerRole | null
  sunstoreUserId?: string | null
  hubspotContactId?: string | null
  identifiers: IdentifierInput[]
  source?: string
}): Promise<ResolvedContact> {
  const identifiers = lookupOrder(input.identifiers)
  if (input.sunstoreUserId) {
    identifiers.unshift({ type: 'sunstore_user', value: input.sunstoreUserId, source: input.source })
  }
  if (input.hubspotContactId) {
    identifiers.unshift({ type: 'hubspot_contact', value: input.hubspotContactId, source: input.source })
  }
  const ordered = lookupOrder(identifiers)
  if (!ordered.length) {
    throw new Error('Kontakt wymaga przynajmniej jednego identyfikatora.')
  }

  const matches: string[] = []
  for (const identifier of ordered) {
    const rows = await neonQuery<{ contact_id: string }>(
      'select contact_id from contact_identifiers where type = $1 and value = $2',
      [identifier.type, identifier.value]
    )
    if (rows[0]) matches.push(rows[0].contact_id)
    if (identifier.type === 'sunstore_user') {
      const byUser = await neonQuery<{ id: string }>(
        'select id from contacts where sunstore_user_id = $1',
        [identifier.value]
      )
      if (byUser[0]) matches.push(byUser[0].id)
    }
    if (identifier.type === 'hubspot_contact') {
      const byHs = await neonQuery<{ id: string }>(
        'select id from contacts where hubspot_contact_id = $1',
        [identifier.value]
      )
      if (byHs[0]) matches.push(byHs[0].id)
    }
  }

  const { contactId, conflictIds } = detectContactConflict(matches)
  const now = new Date()

  if (!contactId) {
    const created = await neonQuery<ContactRow>(
      `insert into contacts (display_name, customer_role, sunstore_user_id, hubspot_contact_id, business_changed_at)
       values ($1, $2, $3, $4, $5)
       returning id, display_name, customer_role, sunstore_user_id, hubspot_contact_id`,
      [
        input.displayName?.trim() || ordered[0].value,
        input.customerRole ?? null,
        input.sunstoreUserId ?? null,
        input.hubspotContactId ?? null,
        now
      ]
    )
    const contact = created[0]
    await attachIdentifiers(contact.id, ordered, input.source, now)
    await recordConflicts(contact.id, conflictIds)
    return { contact, created: true, conflictIds }
  }

  const existing = await neonQuery<ContactRow>(
    'select id, display_name, customer_role, sunstore_user_id, hubspot_contact_id from contacts where id = $1',
    [contactId]
  )
  const contact = existing[0]
  await neonQuery(
    `update contacts
     set display_name = coalesce(nullif($2, ''), display_name),
         customer_role = coalesce($3, customer_role),
         sunstore_user_id = coalesce($4, sunstore_user_id),
         hubspot_contact_id = coalesce($5, hubspot_contact_id),
         business_changed_at = $6
     where id = $1`,
    [
      contact.id,
      input.displayName?.trim() || '',
      input.customerRole ?? null,
      input.sunstoreUserId ?? null,
      input.hubspotContactId ?? null,
      now
    ]
  )
  await attachIdentifiers(contact.id, ordered, input.source, now)
  await recordConflicts(contact.id, conflictIds)
  const refreshed = await neonQuery<ContactRow>(
    'select id, display_name, customer_role, sunstore_user_id, hubspot_contact_id from contacts where id = $1',
    [contact.id]
  )
  return { contact: refreshed[0], created: false, conflictIds }
}

export async function getContact(id: string) {
  const contacts = await neonQuery<ContactRow>(
    'select id, display_name, customer_role, sunstore_user_id, hubspot_contact_id from contacts where id = $1',
    [id]
  )
  if (!contacts[0]) return null
  const identifiers = await neonQuery<{ type: IdentifierType, value: string, source: string | null }>(
    'select type, value, source from contact_identifiers where contact_id = $1 order by created_at',
    [id]
  )
  const conflicts = await neonQuery<{ other_id: string }>(
    'select other_id from contact_conflicts where contact_id = $1',
    [id]
  )
  return { ...contacts[0], identifiers, conflictIds: conflicts.map(row => row.other_id) }
}

async function recordConflicts(contactId: string, conflictIds: string[]) {
  const others = conflictIds.filter(id => id && id !== contactId)
  for (const otherId of others) {
    await neonQuery(
      `insert into contact_conflicts (contact_id, other_id)
       values ($1, $2)
       on conflict do nothing`,
      [contactId, otherId]
    )
    await neonQuery(
      `insert into contact_conflicts (contact_id, other_id)
       values ($1, $2)
       on conflict do nothing`,
      [otherId, contactId]
    )
  }
}

async function attachIdentifiers(
  contactId: string,
  identifiers: IdentifierInput[],
  source: string | undefined,
  changedAt: Date
) {
  for (const identifier of identifiers) {
    await neonQuery(
      `insert into contact_identifiers (contact_id, type, value, source)
       values ($1, $2, $3, $4)
       on conflict (type, value) do nothing`,
      [contactId, identifier.type, identifier.value, identifier.source || source || null]
    )
  }
  await neonQuery(
    'update contacts set business_changed_at = $2 where id = $1',
    [contactId, changedAt]
  )
}
