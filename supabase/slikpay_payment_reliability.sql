-- Apply manually in the existing account project's SQL editor after banking/precision scripts.
begin;
create table if not exists public.payment_batches (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 mode text not null check(mode in ('sandbox','live')),
 fingerprint text not null,
 rows jsonb not null,
 created_at timestamptz not null default now(),
 unique(user_id,mode,fingerprint)
);
grant select on public.payment_batches to authenticated;
grant all on public.payment_batches to service_role;
alter table public.payment_batches enable row level security;
create policy "read own payment batches" on public.payment_batches for select to authenticated using(auth.uid()=user_id);

-- Receipt uniqueness is checked BEFORE any reservation. All writes share one transaction.
create or replace function public.begin_wallet_payment(p_user uuid,p_mode text,p_currency text,p_amount numeric,p_operation text,p_reference text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if p_amount <= 0 or p_amount > 1000000000000 or p_mode not in ('sandbox','live') then raise exception 'invalid payment'; end if;
 perform 1 from public.account_modes where user_id=p_user and mode=p_mode for update;
 if not found then raise exception 'mode changed'; end if;
 insert into public.payment_receipts(user_id,mode,operation,idempotency_key,status,amount,currency)
 values(p_user,p_mode,p_operation,p_reference,'pending',p_amount,p_currency);
 if p_mode='live' then
   if not public.hold_funds(p_user,p_mode,p_currency,p_amount,p_operation,p_reference) then
     update public.payment_receipts set status='failed' where user_id=p_user and idempotency_key=p_reference;
     return false;
   end if;
 else
   insert into public.ledger_entries(user_id,mode,currency,amount,status,operation,reference)
   values(p_user,p_mode,p_currency,-p_amount,'held',p_operation,p_reference);
 end if;
 return true;
end $$;
revoke all on function public.begin_wallet_payment(uuid,text,text,numeric,text,text) from public,anon,authenticated;
grant execute on function public.begin_wallet_payment(uuid,text,text,numeric,text,text) to service_role;

create or replace function public.finish_wallet_payment(p_user uuid,p_mode text,p_reference text,p_status text,p_provider_ref text,p_summary jsonb,p_credit_currency text default null,p_credit_amount numeric default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare receipt public.payment_receipts;
begin
 if p_status not in ('pending','succeeded','failed') then raise exception 'invalid status'; end if;
 select * into receipt from public.payment_receipts where user_id=p_user and mode=p_mode and idempotency_key=p_reference for update;
 if not found then raise exception 'missing receipt'; end if;
 if receipt.status <> 'pending' then return receipt.status=p_status; end if;
 if p_status='succeeded' and p_credit_currency is not null then
   if p_credit_amount is null or p_credit_amount <= 0 then raise exception 'invalid credit'; end if;
   insert into public.ledger_entries(user_id,mode,currency,amount,status,operation,reference)
   values(p_user,p_mode,p_credit_currency,p_credit_amount,'posted',receipt.operation,p_reference||':in');
 end if;
 update public.payment_receipts set status=p_status,provider_reference=p_provider_ref,summary=p_summary where id=receipt.id;
 if p_status <> 'pending' then
   update public.ledger_entries set status=case when p_status='succeeded' then 'posted' else 'released' end
   where user_id=p_user and mode=p_mode and reference=p_reference and status='held';
   if not found then raise exception 'missing reserved debit'; end if;
 end if;
 return true;
end $$;
revoke all on function public.finish_wallet_payment(uuid,text,text,text,text,jsonb,text,numeric) from public,anon,authenticated;
grant execute on function public.finish_wallet_payment(uuid,text,text,text,text,jsonb,text,numeric) to service_role;
commit;