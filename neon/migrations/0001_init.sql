create extension if not exists pgcrypto;

-- Better Auth (camelCase — domyślny adapter pg)
create table if not exists "user" (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists session (
  id text primary key,
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" (id) on delete cascade
);

create table if not exists account (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" (id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists verification (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);

create type app_role as enum ('admin', 'lead', 'agent');
create type customer_role as enum ('buyer', 'seller');
create type ticket_status as enum ('open', 'waiting', 'closed');
create type ticket_priority as enum ('low', 'medium', 'high', 'urgent');
create type channel as enum ('chat', 'email', 'phone', 'whatsapp', 'form');
create type message_direction as enum ('to_customer', 'to_seller', 'internal');
create type sender_type as enum ('customer', 'agent', 'bot', 'system');
create type identifier_type as enum (
  'email',
  'phone',
  'whatsapp',
  'chat_thread',
  'sunstore_user',
  'hubspot_contact'
);
create type call_status as enum ('answered', 'no_answer', 'callback');

create table allowlist (
  email text primary key,
  role app_role not null,
  created_at timestamptz not null default now()
);

create table staff (
  user_id text primary key references "user" (id) on delete cascade,
  role app_role not null,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table agents (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text unique,
  user_id text unique references "user" (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  customer_role customer_role,
  sunstore_user_id text unique,
  hubspot_contact_id text unique,
  created_at timestamptz not null default now(),
  business_changed_at timestamptz not null default now()
);

create table contact_identifiers (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  type identifier_type not null,
  value text not null,
  source text,
  created_at timestamptz not null default now(),
  unique (type, value)
);

create index contact_identifiers_contact_idx on contact_identifiers (contact_id);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id),
  origin_channel channel not null,
  status ticket_status not null default 'open',
  category text,
  priority ticket_priority,
  related_transaction_id text,
  owner_id uuid references agents (id) on delete set null,
  subject text,
  created_at timestamptz not null default now(),
  first_contact_at timestamptz not null,
  first_agent_reply_at timestamptz,
  closed_at timestamptz,
  business_changed_at timestamptz not null default now()
);

create index tickets_contact_idx on tickets (contact_id);
create index tickets_status_idx on tickets (status);
create index tickets_owner_idx on tickets (owner_id);
create index tickets_channel_idx on tickets (origin_channel);

create table ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets (id) on delete cascade,
  channel channel not null,
  direction message_direction not null,
  sender_type sender_type not null,
  body text not null default '',
  subject text,
  email_message_id text,
  external_thread_id text,
  call_status call_status,
  call_duration_seconds integer,
  created_at timestamptz not null default now()
);

create index ticket_events_ticket_idx on ticket_events (ticket_id, created_at);
