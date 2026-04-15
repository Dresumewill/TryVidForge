-- Migration 004: add Stripe idempotency to credit_transactions
-- Run in: Supabase Dashboard → SQL Editor → New query
--
-- Problem: Stripe retries webhooks if it doesn't receive a 200 within ~30s.
-- Without idempotency, a slow DB write + Stripe retry = credits granted twice.
-- Fix: store the Stripe checkout session ID and reject duplicate processing.

-- 1. Add stripe_session_id column
alter table public.credit_transactions
  add column if not exists stripe_session_id text;

-- 2. Unique partial index — only enforces uniqueness where the column is set
--    (video generation rows have NULL here and are unaffected)
create unique index if not exists credit_transactions_stripe_session_id_idx
  on public.credit_transactions (stripe_session_id)
  where stripe_session_id is not null;


-- 3. Replace grant_credits() with an idempotent version
--    New param: p_stripe_session_id (optional) — used as the idempotency key.
--    Returns { ok: true, duplicate: false } on first call.
--    Returns { ok: true, duplicate: true  } on any subsequent call with the
--    same session ID — safe to return 200 to Stripe without re-granting credits.

create or replace function public.grant_credits(
  p_user_id           uuid,
  p_amount            integer,
  p_reason            text    default 'top_up',
  p_stripe_session_id text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'amount_must_be_positive');
  end if;

  -- Idempotency guard: if this Stripe session was already processed, skip
  if p_stripe_session_id is not null then
    if exists (
      select 1 from public.credit_transactions
      where stripe_session_id = p_stripe_session_id
    ) then
      return jsonb_build_object('ok', true, 'duplicate', true);
    end if;
  end if;

  -- Upsert balance (create row if first purchase, otherwise add to existing)
  insert into public.credits (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id)
  do update set balance = public.credits.balance + excluded.balance;

  -- Audit log
  insert into public.credit_transactions (user_id, delta, reason, stripe_session_id)
  values (p_user_id, p_amount, p_reason, p_stripe_session_id);

  return jsonb_build_object('ok', true, 'duplicate', false);
end;
$$;

-- Permission unchanged: service_role only
revoke all on function public.grant_credits(uuid, integer, text, text) from public, authenticated;
grant execute on function public.grant_credits(uuid, integer, text, text) to service_role;
