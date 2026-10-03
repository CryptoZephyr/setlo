-- Drafts and setup invitations (collect payout accounts before onchain creation), stored versions for
-- change comparisons, and payment attribution for verified credits and transfers.

create table drafts (
  id uuid primary key default gen_random_uuid(),
  agency_privy_id text not null references profiles (privy_id),
  chain_id integer not null,
  data jsonb not null,
  package_ref uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index drafts_agency_idx on drafts (agency_privy_id);

-- One per participant. Either for a draft (before creation) or a package (replacement supplier).
create table setup_invites (
  token text primary key,
  draft_id uuid references drafts (id) on delete cascade,
  package_ref uuid references packages (id) on delete cascade,
  role text not null check (role in ('client', 'supplier')),
  participant_key text not null,
  email text not null,
  registered_privy_id text references profiles (privy_id),
  registered_wallet text,
  registered_at timestamptz,
  created_at timestamptz not null default now(),
  check ((draft_id is null) <> (package_ref is null))
);
create unique index setup_invites_draft_key on setup_invites (draft_id, participant_key) where draft_id is not null;
create index setup_invites_package_idx on setup_invites (package_ref);

alter table packages add column draft_id uuid references drafts (id);
alter table drafts add constraint drafts_package_fk foreign key (package_ref) references packages (id);

alter table slots add column category text not null default 'other';
alter table slots add column terms_text text not null default '';

alter table invites drop constraint invites_status_check;
alter table invites add constraint invites_status_check check (status in ('sent', 'opened', 'revoked'));

-- Snapshot of the full human-readable configuration each time it changes onchain.
create table package_versions (
  id bigint generated always as identity primary key,
  package_ref uuid not null references packages (id) on delete cascade,
  config_hash text not null,
  snapshot jsonb not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index package_versions_pkg_idx on package_versions (package_ref, id);

alter table processed_logs add column package_id bigint;
alter table processed_logs add column recipient text;
alter table processed_logs add column amount numeric;
create index processed_logs_recipient_idx on processed_logs (chain_id, recipient);

alter table drafts enable row level security;
alter table setup_invites enable row level security;
alter table package_versions enable row level security;
