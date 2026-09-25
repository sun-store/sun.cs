alter table tickets
  add column if not exists hubspot_ticket_id text;

alter table tickets
  add column if not exists hubspot_thread_id text;

create unique index if not exists tickets_hubspot_ticket_id_uidx
  on tickets (hubspot_ticket_id)
  where hubspot_ticket_id is not null;

create unique index if not exists tickets_hubspot_thread_id_uidx
  on tickets (hubspot_thread_id)
  where hubspot_thread_id is not null;
