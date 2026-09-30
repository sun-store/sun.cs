-- Work queue denormalized timestamps + Sun Agent cache + queue indexes.
-- awaiting/reply_due_at already from 0009; staff.department from 0008.

alter table tickets add column if not exists last_customer_at timestamptz;
alter table tickets add column if not exists last_event_at timestamptz;

alter table tickets add column if not exists ai_summary text;
alter table tickets add column if not exists ai_need text;
alter table tickets add column if not exists ai_next_step text;
alter table tickets add column if not exists ai_summary_at timestamptz;
alter table tickets add column if not exists ai_summary_event_at timestamptz;

create index if not exists tickets_queue_idx
  on tickets (department, awaiting, reply_due_at)
  where status <> 'closed';

create index if not exists tickets_owner_open_idx
  on tickets (owner_id)
  where status <> 'closed';

-- Backfill event timestamps from ticket_events.
update tickets t
set last_event_at = s.last_event_at,
    last_customer_at = s.last_customer_at
from (
  select
    ticket_id,
    max(created_at) as last_event_at,
    max(created_at) filter (where sender_type = 'customer') as last_customer_at
  from ticket_events
  group by ticket_id
) s
where t.id = s.ticket_id
  and (
    t.last_event_at is distinct from s.last_event_at
    or t.last_customer_at is distinct from s.last_customer_at
  );
