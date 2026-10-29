-- Apply manually in the external account project's SQL editor.
-- Invitations manage a roster only. No banking roles or wallet access are granted.
create table if not exists public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) <= 254),
  status text not null default 'pending' check (status in ('pending','revoked','delivery_failed')),
  delivery_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique(owner_id, email)
);
grant select on public.business_invitations to authenticated;
grant all on public.business_invitations to service_role;
alter table public.business_invitations enable row level security;
drop policy if exists "Owner reads invitation roster" on public.business_invitations;
create policy "Owner reads invitation roster" on public.business_invitations for select to authenticated using (owner_id = auth.uid());

create table if not exists public.account_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
grant select on public.account_security_events to authenticated;
grant all on public.account_security_events to service_role;
alter table public.account_security_events enable row level security;
drop policy if exists "Owner reads security events" on public.account_security_events;
create policy "Owner reads security events" on public.account_security_events for select to authenticated using (user_id = auth.uid());

create table if not exists public.account_security_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  window_started timestamptz not null default now()
);
grant all on public.account_security_attempts to service_role;
alter table public.account_security_attempts enable row level security;

create or replace function public.claim_security_attempt(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.account_security_attempts(user_id,attempts,window_started) values(p_user,1,now())
  on conflict(user_id) do update set
    attempts = case when account_security_attempts.window_started < now()-interval '15 minutes' then 1 else account_security_attempts.attempts+1 end,
    window_started = case when account_security_attempts.window_started < now()-interval '15 minutes' then now() else account_security_attempts.window_started end
  returning attempts into n;
  return n <= 5;
end; $$;
revoke all on function public.claim_security_attempt(uuid) from public, anon, authenticated;
grant execute on function public.claim_security_attempt(uuid) to service_role;

create or replace function public.replace_transaction_pin(p_user uuid,p_old_digest text,p_new_digest text,p_new_salt text)
returns boolean language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  update public.merchant_security set pin_digest=p_new_digest,pin_salt=p_new_salt where user_id=p_user and pin_digest=p_old_digest;
  get diagnostics changed = row_count;
  if changed <> 1 then return false; end if;
  insert into public.account_security_events(user_id,action) values(p_user,'Transaction PIN changed');
  return true;
end; $$;
revoke all on function public.replace_transaction_pin(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.replace_transaction_pin(uuid,text,text,text) to service_role;