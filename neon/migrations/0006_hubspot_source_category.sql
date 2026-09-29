-- Oryginalna kategoria HubSpot (Ticket category), przed mapowaniem na 5 bucketów CS.
alter table tickets
  add column if not exists source_category text;

-- Backfill z treści importu: „Kategoria źródłowa: …”.
update tickets t
set source_category = s.source_category
from (
  select distinct on (ticket_id)
    ticket_id,
    trim(both from substring(body from 'Kategoria źródłowa: ([^.\n]+)')) as source_category
  from ticket_events
  where body like '%Kategoria źródłowa:%'
  order by ticket_id, created_at asc
) s
where t.id = s.ticket_id
  and t.source_category is null
  and s.source_category is not null
  and s.source_category <> '';
