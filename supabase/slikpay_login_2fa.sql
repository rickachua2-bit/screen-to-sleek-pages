-- Slikpay sign-in 2FA: email one-time codes for users without an authenticator app.
-- Run manually in the external Supabase project's SQL editor.

create table if not exists public.login_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  digest text not null,
  attempts integer not null default 0,
  consumed boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists login_challenges_user_idx on public.login_challenges (user_id, consumed, expires_at);

-- No client access: the service role manages rows; RLS blocks everyone else.
alter table public.login_challenges enable row level security;

-- Atomically count a verification attempt; returns false once 5 attempts are used.
create or replace function public.claim_login_attempt(challenge uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  update public.login_challenges
     set attempts = attempts + 1
   where id = challenge
     and consumed = false
     and attempts < 5
     and expires_at > now()
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

revoke all on function public.claim_login_attempt(uuid) from public, anon, authenticated;
