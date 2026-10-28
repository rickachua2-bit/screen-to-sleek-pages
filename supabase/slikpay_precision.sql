-- Run once in the Slikpay project's SQL editor.
-- 1) Full precision for crypto balances (USDT/USDC carry 6 decimals).
alter table public.ledger_entries alter column amount type numeric(30, 8);
alter table public.payment_receipts alter column amount type numeric(30, 8);
-- 2) Live dashboard updates: stream new rows to signed-in owners (RLS still applies).
do $$ begin
  begin alter publication supabase_realtime add table public.transactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.ledger_entries; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.payment_receipts; exception when duplicate_object then null; end;
end $$;
