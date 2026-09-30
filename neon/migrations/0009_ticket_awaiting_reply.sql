-- Operacyjny termin odpowiedzi na każdą wiadomość klienta (kolejki „Na teraz” / „Po terminie”).
alter table tickets
  add column if not exists awaiting text;

alter table tickets
  add column if not exists reply_due_at timestamptz;

alter table tickets drop constraint if exists tickets_awaiting_check;
alter table tickets
  add constraint tickets_awaiting_check
  check (awaiting is null or awaiting in ('us', 'customer'));

create index if not exists tickets_awaiting_due_idx
  on tickets (awaiting, reply_due_at)
  where status <> 'closed';

-- Backfill otwartych spraw (due w godzinach zegarowych — nowe eventy liczą godziny pracy w appce).
with last_customer as (
  select distinct on (ticket_id)
    ticket_id, created_at, channel
  from ticket_events
  where sender_type = 'customer'
  order by ticket_id, created_at desc
),
last_agent as (
  select distinct on (ticket_id)
    ticket_id, created_at
  from ticket_events
  where sender_type in ('agent', 'bot') and direction = 'to_customer'
  order by ticket_id, created_at desc
)
update tickets t
set
  awaiting = case
    when la.created_at is null or lc.created_at > la.created_at then 'us'
    else 'customer'
  end,
  reply_due_at = case
    when la.created_at is null or lc.created_at > la.created_at
    then lc.created_at + case
      when coalesce(lc.channel, t.origin_channel) in ('email', 'form') then interval '2 hours'
      else interval '30 minutes'
    end
    else null
  end
from last_customer lc
left join last_agent la on la.ticket_id = lc.ticket_id
where t.id = lc.ticket_id
  and t.status <> 'closed';
