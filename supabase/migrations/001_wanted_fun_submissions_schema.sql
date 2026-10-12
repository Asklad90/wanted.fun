-- Wanted.fun: off-chain submissions (money stays on-chain in WantedEscrow).
-- Applied to the Supabase project backing the `wanted-api` Edge Function.

-- Chains the backend is allowed to serve. `contracts` is an allowlist of WantedEscrow addresses (lowercase).
create table public.chains (
  chain_id bigint primary key,
  name text not null,
  rpc_url text not null,
  contracts text[] not null default '{}'
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  chain_id bigint not null references public.chains(chain_id),
  contract text not null check (contract = lower(contract)),
  bounty_id bigint not null,
  submitter text not null check (submitter = lower(submitter)),
  note text not null default '' check (char_length(note) <= 1000),
  links jsonb not null default '[]'::jsonb,
  files jsonb not null default '[]'::jsonb,
  signature text not null,
  signed_at bigint not null,
  status text not null default 'pending' check (status in ('pending','ready')),
  created_at timestamptz not null default now(),
  unique (chain_id, contract, bounty_id, submitter)
);

create index submissions_bounty_idx on public.submissions (chain_id, contract, bounty_id, status);
create index submissions_submitter_idx on public.submissions (chain_id, contract, submitter, status);

-- No policies: public roles cannot read or write. Only the Edge Function (service role) touches these tables.
alter table public.chains enable row level security;
alter table public.submissions enable row level security;

-- Private bucket: images and videos only, 25 MB max per file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 26214400,
  array['image/png','image/jpeg','image/webp','video/mp4','video/webm'])
on conflict (id) do update set public = false, file_size_limit = 26214400,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.chains (chain_id, name, rpc_url, contracts) values
  (5042002, 'Arc Testnet', 'https://rpc.testnet.arc.io', '{}'),
  (5042, 'Arc', 'https://rpc.mainnet.arc.io', '{}');

-- After deploying WantedEscrow, allow it (lowercase address):
-- update public.chains set contracts = array['0x...'] where chain_id = 5042;
