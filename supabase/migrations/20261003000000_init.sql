-- Offchain metadata only. Balances and statuses are read from the contract, never stored as truth.
-- RLS is enabled with no policies: anon/authenticated roles see nothing; server routes use the service role.

create table profiles (
  privy_id text primary key,
  email text,
  wallet text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index profiles_wallet_idx on profiles (wallet);

create table packages (
  id uuid primary key default gen_random_uuid(),
  chain_id integer not null,
  package_id bigint not null,
  agency_privy_id text not null references profiles (privy_id),
  title text not null,
  terms_text text not null default '',
  client_email text not null,
  created_at timestamptz not null default now(),
  unique (chain_id, package_id)
);

create table slots (
  package_ref uuid not null references packages (id) on delete cascade,
  slot_index integer not null,
  supplier_name text not null,
  supplier_email text not null,
  payout_address text not null,
  primary key (package_ref, slot_index)
);
create index slots_payout_idx on slots (payout_address);

create table invites (
  token text primary key,
  package_ref uuid not null references packages (id) on delete cascade,
  role text not null check (role in ('client', 'supplier')),
  slot_index integer,
  email text not null,
  status text not null default 'sent' check (status in ('sent', 'opened')),
  opened_by text references profiles (privy_id),
  created_at timestamptz not null default now(),
  check ((role = 'supplier') = (slot_index is not null))
);
create index invites_package_idx on invites (package_ref);

create table tx_log (
  hash text primary key,
  chain_id integer not null,
  package_id bigint,
  fn text not null,
  source text not null check (source in ('relayer', 'webhook')),
  status text not null default 'sent' check (status in ('sent', 'success', 'reverted')),
  created_at timestamptz not null default now()
);
create index tx_log_package_idx on tx_log (chain_id, package_id);

-- Dedupe for events seen via both relayer receipts and QuickNode webhooks.
create table processed_logs (
  chain_id integer not null,
  tx_hash text not null,
  log_index integer not null,
  event text not null,
  created_at timestamptz not null default now(),
  primary key (chain_id, tx_hash, log_index)
);

create table funnel_events (
  id bigint generated always as identity primary key,
  event text not null,
  privy_id text,
  chain_id integer,
  package_id bigint,
  created_at timestamptz not null default now()
);

create table email_log (
  id bigint generated always as identity primary key,
  to_email text not null,
  kind text not null,
  subject text not null,
  error text,
  ref jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

create function hit_rate_limit(p_key text, p_window_sec integer) returns integer
language sql security definer set search_path = public as $$
  insert into rate_limits (key, window_start, hits)
  values (p_key, to_timestamp(floor(extract(epoch from now()) / p_window_sec) * p_window_sec), 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits;
$$;
revoke execute on function hit_rate_limit(text, integer) from public, anon, authenticated;

alter table profiles enable row level security;
alter table packages enable row level security;
alter table slots enable row level security;
alter table invites enable row level security;
alter table tx_log enable row level security;
alter table processed_logs enable row level security;
alter table funnel_events enable row level security;
alter table email_log enable row level security;
alter table rate_limits enable row level security;
