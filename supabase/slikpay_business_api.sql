-- Run manually in the existing Slikpay account project's SQL editor.
-- pgcrypto encrypts unclaimed credentials. Only service-only functions can decrypt.
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.business_api_vault (
  id boolean primary key default true check(id),
  secret text not null
);
grant all on public.business_api_vault to service_role;
revoke all on public.business_api_vault from anon, authenticated;
alter table public.business_api_vault enable row level security;
insert into public.business_api_vault(id,secret) values(true,encode(extensions.gen_random_bytes(32),'hex')) on conflict do nothing;

create table if not exists public.business_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check(mode in ('sandbox','live')),
  key_hash text not null unique,
  encrypted_secret bytea,
  scopes text[] not null default array['balances:read','receipts:read','banks:read'],
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '365 days',
  claimed_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  window_start timestamptz not null default now(),
  window_requests integer not null default 0
);
grant all on public.business_api_keys to service_role;
revoke all on public.business_api_keys from anon, authenticated;
alter table public.business_api_keys enable row level security;
create unique index if not exists business_api_one_active_mode on public.business_api_keys(user_id,mode) where revoked_at is null;

create or replace function public.issue_business_api_key(p_user uuid,p_mode text,p_rotate boolean default false)
returns uuid language plpgsql security definer set search_path = public,extensions as $$
declare k text; key_id uuid; encryption_secret text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':api:' || p_mode,0));
  if p_mode not in ('sandbox','live') or not exists(select 1 from merchant_security where user_id=p_user) then raise exception 'Business key not eligible'; end if;
  if p_mode='live' and not exists(select 1 from account_modes where user_id=p_user and review_status='approved' and approved_at is not null) then raise exception 'KYB approval required'; end if;
  select id into key_id from business_api_keys where user_id=p_user and mode=p_mode order by created_at desc limit 1;
  if key_id is not null and not p_rotate then return key_id; end if;
  if p_rotate then update business_api_keys set revoked_at=coalesce(revoked_at,now()),encrypted_secret=null where user_id=p_user and mode=p_mode and revoked_at is null; end if;
  select secret into encryption_secret from business_api_vault where id=true;
  k := case when p_mode='live' then 'slk_live_' else 'slk_test_' end || encode(gen_random_bytes(32),'hex');
  insert into business_api_keys(user_id,mode,key_hash,encrypted_secret) values(p_user,p_mode,encode(digest(k,'sha256'),'hex'),pgp_sym_encrypt(k,encryption_secret)) returning id into key_id;
  return key_id;
end $$;
revoke all on function public.issue_business_api_key(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.issue_business_api_key(uuid,text,boolean) to service_role;

create or replace function public.auto_business_api_keys() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
begin
  if tg_table_name='merchant_security' then
    perform issue_business_api_key(new.user_id,'sandbox',false);
  elsif new.review_status='approved' and new.approved_at is not null and exists(select 1 from merchant_security where user_id=new.user_id) then
    perform issue_business_api_key(new.user_id,'live',false);
  end if;
  return new;
end $$;
revoke all on function public.auto_business_api_keys() from public,anon,authenticated;
drop trigger if exists auto_sandbox_business_api on public.merchant_security;
create trigger auto_sandbox_business_api after insert on public.merchant_security for each row execute function public.auto_business_api_keys();
drop trigger if exists auto_live_business_api on public.account_modes;
create trigger auto_live_business_api after insert or update of review_status,approved_at on public.account_modes for each row execute function public.auto_business_api_keys();

create or replace function public.claim_business_api_key(p_user uuid,p_id uuid)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare row_key business_api_keys; encryption_secret text; raw_key text;
begin
  select * into row_key from business_api_keys where id=p_id and user_id=p_user for update;
  if row_key.id is null or row_key.revoked_at is not null or row_key.expires_at<=now() or row_key.encrypted_secret is null then raise exception 'Key unavailable; rotate to replace'; end if;
  if row_key.mode='live' and not exists(select 1 from account_modes where user_id=p_user and review_status='approved' and approved_at is not null) then raise exception 'KYB approval required'; end if;
  select secret into encryption_secret from business_api_vault where id=true;
  raw_key := pgp_sym_decrypt(row_key.encrypted_secret,encryption_secret);
  update business_api_keys set claimed_at=now(),encrypted_secret=null where id=p_id;
  return raw_key;
end $$;
revoke all on function public.claim_business_api_key(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_business_api_key(uuid,uuid) to service_role;

-- Atomic verifier, expiry/revocation, current KYB and per-key 60 requests/minute.
create or replace function public.authenticate_business_api(p_hash text,p_scope text)
returns table(owner_id uuid,environment text,key_id uuid) language plpgsql security definer set search_path=public as $$
declare k business_api_keys;
begin
  select * into k from business_api_keys where key_hash=p_hash for update;
  if k.id is null or k.revoked_at is not null or k.expires_at<=now() or not p_scope=any(k.scopes) then return; end if;
  if not exists(select 1 from merchant_security where user_id=k.user_id) then return; end if;
  if k.mode='live' and not exists(select 1 from account_modes where user_id=k.user_id and review_status='approved' and approved_at is not null) then return; end if;
  if k.window_start > now()-interval '1 minute' and k.window_requests>=60 then raise exception 'API_RATE_LIMIT'; end if;
  update business_api_keys set last_used_at=now(),window_start=case when window_start<=now()-interval '1 minute' then now() else window_start end,window_requests=case when window_start<=now()-interval '1 minute' then 1 else window_requests+1 end where id=k.id;
  return query select k.user_id,k.mode,k.id;
end $$;
revoke all on function public.authenticate_business_api(text,text) from public,anon,authenticated;
grant execute on function public.authenticate_business_api(text,text) to service_role;

-- Idempotent backfill; revoked keys are never silently reissued.
do $$ declare m record; begin
  for m in select user_id from merchant_security loop perform issue_business_api_key(m.user_id,'sandbox',false); end loop;
  for m in select s.user_id from merchant_security s join account_modes a using(user_id) where a.review_status='approved' and a.approved_at is not null loop perform issue_business_api_key(m.user_id,'live',false); end loop;
end $$;