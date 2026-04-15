-- Migration 002: add audio_url to videos + create audio storage bucket
-- Run in: Supabase Dashboard → SQL Editor → New query

-- 1. Add audio_url column to videos
alter table public.videos
  add column if not exists audio_url text;

-- 2. Create the audio storage bucket (public — files are UUID-keyed, not guessable)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audio',
  'audio',
  true,
  10485760,                       -- 10 MB per file
  array['audio/mpeg', 'audio/mp4']
)
on conflict (id) do nothing;

-- 3. RLS: authenticated users can read any file in the audio bucket
create policy "audio: public read"
  on storage.objects for select
  using (bucket_id = 'audio');

-- 4. RLS: only service_role can insert/update/delete (cron job uses admin client)
create policy "audio: service role write"
  on storage.objects for insert
  with check (bucket_id = 'audio');
