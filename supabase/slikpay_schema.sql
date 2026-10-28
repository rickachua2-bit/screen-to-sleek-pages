-- Slikpay schema: run once in the Supabase SQL editor of project gqbgdqkmdyvzgovugjku.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'merchant' check (role in ('merchant', 'personal')),
  company_name text,
  cac_rc_number text,
  nuban text default '9749891399',
  bank_name text default 'Sterling Bank',
  wallet_balance numeric not null default 0.00,
  created_at timestamptz not null default now(),
  constraint merchant_needs_company check (role <> 'merchant' or company_name is not null)
);

create table if not exists public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_name text not null,
  account_number text not null check (account_number ~ '^[0-9]{10}$'),
  bank_code text not null,
  bank_name text not null,
  initials text,
  created_at timestamptz not null default now(),
  unique (user_id, bank_code, account_number)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reference text unique not null,
  channel text check (channel in ('NIP', 'SoftPOS', 'Treasury Sweep', 'Card', 'Bills', 'SlikTag')),
  customer text not null,
  amount numeric not null,
  direction text not null check (direction in ('credit', 'debit')),
  status text not null default 'Pending' check (status in ('Successful', 'Pending', 'Failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_created on public.transactions (user_id, created_at desc);

-- Data API access (Supabase no longer grants these by default)
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.beneficiaries to authenticated;
grant select on public.transactions to authenticated;
grant all on public.profiles, public.beneficiaries, public.transactions to service_role;

alter table public.profiles enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.transactions enable row level security;

-- Profiles: own row only. Balance, NUBAN and role cannot be changed by the user.
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name, company_name, cac_rc_number) on public.profiles to authenticated;

-- Beneficiaries: full control of own rows.
drop policy if exists "own beneficiaries" on public.beneficiaries;
create policy "own beneficiaries" on public.beneficiaries for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Transactions: users read their own; only the server (service_role) writes money movements.
drop policy if exists "own transactions read" on public.transactions;
create policy "own transactions read" on public.transactions for select to authenticated using (user_id = auth.uid());

-- Auto-create a profile on sign-up from the sign-up metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role', 'merchant');
begin
  if r not in ('merchant', 'personal') then r := 'merchant'; end if;
  insert into public.profiles (id, email, full_name, role, company_name, cac_rc_number)
  values (
    new.id, new.email,
    new.raw_user_meta_data->>'full_name',
    r,
    case when r = 'merchant' then coalesce(nullif(new.raw_user_meta_data->>'company_name', ''), coalesce(new.raw_user_meta_data->>'full_name', new.email)) end,
    new.raw_user_meta_data->>'cac_rc_number'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
