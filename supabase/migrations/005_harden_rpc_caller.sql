-- Migration 005: harden deduct_credit() and refund_credit() caller checks
-- Run in: Supabase Dashboard → SQL Editor → New query
--
-- Problem: both functions are security-definer and bypass table-level RLS.
-- Any authenticated user can call deduct_credit(victim_id, ...) via the
-- Supabase API and drain another user's credits.
-- Fix: verify auth.uid() matches the target user inside each function.
--
-- Service role (cron job) has auth.uid() = NULL — the guard allows NULL so
-- server-side admin calls (refund after rendering failure) still work.


-- ── 1. deduct_credit — enforce caller owns the credits row ──────────────────

create or replace function public.deduct_credit(
  p_user_id uuid,
  p_video_id uuid,
  p_reason  text default 'video_generation'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  -- Caller must either be the target user or the service role (null uid)
  if auth.uid() is not null and auth.uid() != p_user_id then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  -- Lock the row for the duration of this transaction (prevents TOCTOU races)
  select balance into v_balance
  from public.credits
  where user_id = p_user_id
  for update;

  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'credits_not_found');
  end if;

  if v_balance < 1 then
    return jsonb_build_object('ok', false, 'error', 'insufficient_credits');
  end if;

  update public.credits
  set balance = balance - 1
  where user_id = p_user_id;

  insert into public.credit_transactions (user_id, delta, reason, video_id)
  values (p_user_id, -1, p_reason, p_video_id);

  return jsonb_build_object('ok', true, 'balance', v_balance - 1);
end;
$$;

revoke all on function public.deduct_credit(uuid, uuid, text) from public;
grant execute on function public.deduct_credit(uuid, uuid, text) to authenticated;


-- ── 2. refund_credit — enforce caller owns the row ───────────────────────────
-- Called by: pipeline (authenticated user) AND cron job (service role / null uid).
-- The null-uid guard keeps admin refunds working.

create or replace function public.refund_credit(
  p_user_id uuid,
  p_video_id uuid,
  p_reason  text default 'refund'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Caller must either be the target user or the service role (null uid)
  if auth.uid() is not null and auth.uid() != p_user_id then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  update public.credits
  set balance = balance + 1
  where user_id = p_user_id;

  insert into public.credit_transactions (user_id, delta, reason, video_id)
  values (p_user_id, 1, p_reason, p_video_id);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.refund_credit(uuid, uuid, text) from public;
grant execute on function public.refund_credit(uuid, uuid, text) to authenticated;
