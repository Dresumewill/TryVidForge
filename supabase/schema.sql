-- ============================================================
-- TryVidForge UCG — Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";


-- ------------------------------------------------------------
-- 1. users
--    Mirrors auth.users. Populated automatically via trigger.
-- ------------------------------------------------------------
create table if not exists public.users (
  id         uuid references auth.users (id) on delete cascade primary key,
  email      text        not null,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users: select own row"
  on public.users for select
  using (auth.uid() = id);

create policy "users: update own row"
  on public.users for update
  using (auth.uid() = id);


-- ------------------------------------------------------------
-- 2. videos
-- ------------------------------------------------------------
create table if not exists public.videos (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references public.users (id) on delete cascade,
  prompt     text        not null,
  script     text,
  audio_url  text,
  video_url  text,
  status     text        not null default 'pending'
               check (status in ('pending', 'processing', 'ready', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.videos enable row level security;

create policy "videos: all operations on own rows"
  on public.videos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists videos_user_id_idx on public.videos (user_id);


-- ------------------------------------------------------------
-- 3. credits
-- ------------------------------------------------------------
create table if not exists public.credits (
  user_id uuid    primary key references public.users (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0)
);

alter table public.credits enable row level security;

-- Users can only read their own balance.
-- All writes go through security-definer functions below (never direct UPDATE).
create policy "credits: select own row"
  on public.credits for select
  using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 4. credit_transactions  (audit log)
-- ------------------------------------------------------------
create table if not exists public.credit_transactions (
  id                 uuid        primary key default uuid_generate_v4(),
  user_id            uuid        not null references public.users (id) on delete cascade,
  delta              integer     not null,           -- negative = deduction, positive = top-up
  reason             text        not null,           -- e.g. 'video_generation', 'signup_bonus'
  video_id           uuid        references public.videos (id) on delete set null,
  stripe_session_id  text        unique,             -- Stripe checkout session ID for idempotency
  created_at         timestamptz not null default now()
);

alter table public.credit_transactions enable row level security;

create policy "credit_transactions: select own rows"
  on public.credit_transactions for select
  using (auth.uid() = user_id);

create index if not exists credit_transactions_user_id_idx
  on public.credit_transactions (user_id, created_at desc);


-- ------------------------------------------------------------
-- 5. deduct_credit()
--    Called by the app after queuing a video.
--    Uses security definer so it bypasses RLS and runs
--    atomically — no TOCTOU race between read and update.
-- ------------------------------------------------------------
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
  -- Caller must be the target user or service role (null uid = service role)
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

-- Only authenticated users can invoke this function for themselves.
revoke all on function public.deduct_credit(uuid, uuid, text) from public;
grant execute on function public.deduct_credit(uuid, uuid, text) to authenticated;


-- ------------------------------------------------------------
-- 6. refund_credit()
--    Called if video insertion fails after deduction,
--    or if a job errors out downstream.
-- ------------------------------------------------------------
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
  -- Caller must be the target user or service role (null uid = service role)
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


-- ------------------------------------------------------------
-- 7. grant_credits()  (service-role / admin only)
--    Top up a user's balance manually or as part of a payment.
-- ------------------------------------------------------------
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

  insert into public.credits (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id)
  do update set balance = public.credits.balance + excluded.balance;

  insert into public.credit_transactions (user_id, delta, reason, stripe_session_id)
  values (p_user_id, p_amount, p_reason, p_stripe_session_id);

  return jsonb_build_object('ok', true, 'duplicate', false);
end;
$$;

-- Only the service role (backend) may grant credits — not regular users.
revoke all on function public.grant_credits(uuid, integer, text, text) from public, authenticated;
grant execute on function public.grant_credits(uuid, integer, text, text) to service_role;


-- ------------------------------------------------------------
-- 8. Trigger — auto-provision user + 10 credits on auth sign-up
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.credits (user_id, balance)
  values (new.id, 10)
  on conflict (user_id) do nothing;

  -- Record the signup bonus in the audit log
  insert into public.credit_transactions (user_id, delta, reason)
  values (new.id, 10, 'signup_bonus');

  return new;
end;
$$;

-- Drop and recreate to pick up any changes
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
