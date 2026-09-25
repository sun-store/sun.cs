create or replace function lock_first_agent_reply()
returns trigger
language plpgsql
as $$
begin
  if old.first_agent_reply_at is not null
     and new.first_agent_reply_at is distinct from old.first_agent_reply_at then
    new.first_agent_reply_at := old.first_agent_reply_at;
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_lock_first_agent_reply on tickets;
create trigger tickets_lock_first_agent_reply
before update on tickets
for each row
execute function lock_first_agent_reply();

create table if not exists contact_conflicts (
  contact_id uuid not null references contacts (id) on delete cascade,
  other_id uuid not null references contacts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, other_id),
  check (contact_id <> other_id)
);
