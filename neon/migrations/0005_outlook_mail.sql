-- Żywy mail z Outlooka (Microsoft Graph).

-- Id wiadomości w Graph. Po nim nie importujemy tego samego maila dwa razy
-- i po nim odpowiadamy w tym samym wątku (/messages/{id}/reply).
alter table ticket_events
  add column if not exists graph_message_id text;

create unique index if not exists ticket_events_graph_message_id_uidx
  on ticket_events (graph_message_id)
  where graph_message_id is not null;

-- Stan synchronizacji skrzynki: kursor delta i dzierżawa, żeby dwa crony nie szły naraz.
create table if not exists mail_sync_state (
  mailbox text primary key,
  cursor text,
  since timestamptz not null default now(),
  locked_until timestamptz,
  last_run_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
