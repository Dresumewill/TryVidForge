-- Migration 003: create videos storage bucket for merged final output
-- Run in: Supabase Dashboard → SQL Editor → New query

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  true,
  524288000,                      -- 500 MB per file
  array['video/mp4']
)
on conflict (id) do nothing;

-- Public read (final videos are meant to be played in the dashboard)
create policy "videos: public read"
  on storage.objects for select
  using (bucket_id = 'videos');

-- Only service_role (cron job via admin client) may write
create policy "videos: service role write"
  on storage.objects for insert
  with check (bucket_id = 'videos');
