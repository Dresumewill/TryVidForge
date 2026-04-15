-- ── 006_analytics_events.sql ──────────────────────────────────────────────────
-- Server-side event log for key user and product actions.
-- Written by the backend (service role) only — never by the client.
--
-- Events tracked:
--   user.signup      — new user registered
--   video.queued     — video job created (credit deducted)
--   video.completed  — video reached "ready" status (cron phase 2)
--   video.failed     — video failed at any pipeline phase (credit refunded)

CREATE TABLE IF NOT EXISTS analytics_events (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event      text        NOT NULL,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  properties jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Efficient queries: by event type + time, and by user + time
CREATE INDEX IF NOT EXISTS analytics_events_event_time_idx
  ON analytics_events (event, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_user_time_idx
  ON analytics_events (user_id, created_at DESC);

-- Enable RLS — no row is readable by normal users; service role bypasses RLS.
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
-- (No policies added — service role is the only writer/reader.)
