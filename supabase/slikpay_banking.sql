-- Run in the SQL editor of the existing Slikpay account project (after slikpay_verification.sql).
-- Sandbox/live modes, KYC/KYB steps, per-user ledger, Paddle resource ownership, receipts and webhooks.

create table if not exists public.account_modes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null default 'sandbox' check (mode in ('sandbox', 'live')),
  review_status text not null default 'not_started' check (review_status in ('not_started', 'in_progress', 'submitted', 'approved', 'rejected')),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.account_modes to authenticated;
grant all on public.account_modes to service_role;
alter table public.account_modes enable row level security;
drop policy if exists "read own mode" on public.account_modes;
create policy "read own mode" on public.account_modes for select to authenticated using (auth.uid() = user_id);

create table if not exists public.kyc_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  step text not null,
  status text not null check (status in ('pending', 'verified', 'failed')),
  provider_reference text,
  summary text,
  created_at timestamptz not null default now(),
  unique (user_id, step)
);
grant select on public.kyc_steps to authenticated;
grant all on public.kyc_steps to service_role;
alter table public.kyc_steps enable row level security;
drop policy if exists "read own kyc" on public.kyc_steps;
create policy "read own kyc" on public.kyc_steps for select to authenticated using (auth.uid() = user_id);

-- Signed amounts: credits positive, debits negative. Held debits count against the balance.
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('sandbox', 'live')),
  currency text not null default 'NGN',
  amount numeric(18, 2) not null,
  status text not null check (status in ('held', 'posted', 'released')),
  operation text not null,
  reference text not null unique,
  created_at timestamptz not null default now()
);
grant select on public.ledger_entries to authenticated;
grant all on public.ledger_entries to service_role;
alter table public.ledger_entries enable row level security;
drop policy if exists "read own ledger" on public.ledger_entries;
create policy "read own ledger" on public.ledger_entries for select to authenticated using (auth.uid() = user_id);

create table if not exists public.paddle_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  resource_id text not null,
  operation text not null,
  created_at timestamptz not null default now(),
  unique (mode, resource_id)
);
grant select on public.paddle_resources to authenticated;
grant all on public.paddle_resources to service_role;
alter table public.paddle_resources enable row level security;
drop policy if exists "read own resources" on public.paddle_resources;
create policy "read own resources" on public.paddle_resources for select to authenticated using (auth.uid() = user_id);

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  operation text not null,
  idempotency_key text not null unique,
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  amount numeric(18, 2),
  currency text,
  provider_reference text,
  session_id text,
  summary jsonb,
  created_at timestamptz not null default now()
);
grant select on public.payment_receipts to authenticated;
grant all on public.payment_receipts to service_role;
alter table public.payment_receipts enable row level security;
drop policy if exists "read own receipts" on public.payment_receipts;
create policy "read own receipts" on public.payment_receipts for select to authenticated using (auth.uid() = user_id);

create table if not exists public.webhook_events (
  id text primary key,
  event_type text not null,
  payload jsonb not null,
  processed boolean not null default false,
  received_at timestamptz not null default now()
);
grant all on public.webhook_events to service_role;
revoke all on public.webhook_events from anon, authenticated;
alter table public.webhook_events enable row level security;

-- Every new account starts in sandbox.
create or replace function public.create_account_mode() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.account_modes (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists create_account_mode on auth.users;
create trigger create_account_mode after insert on auth.users for each row execute function public.create_account_mode();
insert into public.account_modes (user_id) select id from auth.users on conflict do nothing;

-- Atomically reserve funds: locks the user's mode row so parallel payouts cannot overspend.
create or replace function public.hold_funds(p_user uuid, p_mode text, p_currency text, p_amount numeric, p_operation text, p_reference text)
returns boolean language plpgsql security definer set search_path = public as $$
declare available numeric;
begin
  perform 1 from public.account_modes where user_id = p_user for update;
  select coalesce(sum(amount), 0) into available from public.ledger_entries
    where user_id = p_user and mode = p_mode and currency = p_currency and status in ('held', 'posted');
  if available < p_amount then return false; end if;
  insert into public.ledger_entries (user_id, mode, currency, amount, status, operation, reference)
    values (p_user, p_mode, p_currency, -p_amount, 'held', p_operation, p_reference);
  return true;
end $$;
revoke all on function public.hold_funds(uuid, text, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.hold_funds(uuid, text, text, numeric, text, text) to service_role;
