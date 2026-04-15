-- Migration 001 — add rendering_job_id to videos
-- Run in: Supabase Dashboard → SQL Editor

alter table public.videos
  add column if not exists rendering_job_id text;

comment on column public.videos.rendering_job_id is
  'External job ID returned by the video rendering service (e.g. Runway ML). '
  'Used by the background processor to poll for completion.';
