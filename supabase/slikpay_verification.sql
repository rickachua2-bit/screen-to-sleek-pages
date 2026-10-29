-- Run in the SQL editor of the existing Slikpay account project.
-- Private, server-only challenges; never grant browser access.
create table if not exists public.merchant_verification_challenges (
  id uuid primary key,
  email text not null,
  phone text not null,
  email_digest text not null,
  phone_pin_id text not null,
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  email_attempts integer not null default 0,
  phone_attempts integer not null default 0,
  country text,
  rc_number text,
  company_name text,
  expires_at timestamptz not null,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);
grant all on public.merchant_verification_challenges to service_role, anon, authenticated;
alter table public.merchant_verification_challenges disable row level security;

create table if not exists public.merchant_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_digest text not null,
  pin_salt text not null,
  email_verified boolean not null,
  phone_verified boolean not null,
  country text not null,
  rc_number text not null,
  company_name text not null
);
grant all on public.merchant_security to service_role, anon, authenticated;
alter table public.merchant_security disable row level security;

-- Atomically count attempts; parallel requests cannot bypass the limit.
create or replace function public.claim_merchant_verification_attempt(challenge uuid, channel text)
returns boolean language plpgsql security definer set search_path = public as $$
declare accepted uuid;
begin
  if channel = 'email' then
    update merchant_verification_challenges set email_attempts = email_attempts + 1
      where id = challenge and expires_at > now() and not consumed and email_attempts < 5
      returning id into accepted;
  elsif channel = 'phone' then
    update merchant_verification_challenges set phone_attempts = phone_attempts + 1
      where id = challenge and expires_at > now() and not consumed and phone_attempts < 5
      returning id into accepted;
  end if;
  return accepted is not null;
end $$;
grant execute on function public.claim_merchant_verification_attempt(uuid, text) to service_role, anon, authenticated;

-- Remove the old sample account number default. Account issuance remains separate.
alter table public.profiles alter column nuban drop default;

-- Require server-verified proof for merchant creation, including direct Auth calls.
create or replace function public.enforce_merchant_verification()
returns trigger language plpgsql security definer set search_path = public as $$
declare proof public.merchant_verification_challenges;
begin
  if coalesce(new.raw_user_meta_data->>'role', 'merchant') = 'merchant' then
    select * into proof from public.merchant_verification_challenges
      -- Auth writes app metadata after insert, so read the id from user metadata too.
      where id::text = coalesce(new.raw_app_meta_data->>'merchant_verification_id', new.raw_user_meta_data->>'merchant_verification_id') for update;
    if proof.id is null or not proof.consumed or not proof.email_verified or not proof.phone_verified
      or proof.expires_at <= now() or proof.email <> lower(new.email) or proof.company_name is null then
      raise exception 'Merchant phone, email and business verification required';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists enforce_merchant_verification on auth.users;
create trigger enforce_merchant_verification before insert on auth.users
  for each row execute function public.enforce_merchant_verification();