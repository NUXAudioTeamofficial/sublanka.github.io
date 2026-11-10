-- SubLanka — migration 0002
-- Adds a link to a legal, free copy of the film (usually the Internet Archive).
-- SubLanka never hosts or links to film files; it links to the film's own legal
-- home so a visitor can watch it and attach one of our subtitles.
-- Additive only: nullable column, no existing row or policy changes.

alter table public.movies
  add column if not exists watch_url text
  check (watch_url is null or watch_url ~ '^https://');

comment on column public.movies.watch_url is
  'Optional link to a legal free copy of the film (e.g. archive.org). Never a download of the film itself.';

-- The view the public pages read has to expose it too.
create or replace view public.movie_cards with (security_invoker = true) as
select m.id, m.tmdb_id, m.slug, m.title, m.original_title, m.release_year, m.language,
       m.poster_url, m.backdrop_url, m.sinhala_description, m.genres, m.rating, m.runtime,
       m.youtube_video_id, m.published, m.published_at, m.created_at, m.updated_at,
       coalesce(s.subtitle_count, 0)::int      as subtitle_count,
       coalesce(s.total_downloads, 0)::bigint  as total_downloads,
       s.latest_subtitle_at,
       coalesce(s.subtitle_languages, '{}')    as subtitle_languages,
       m.watch_url   -- appended last: CREATE OR REPLACE VIEW may only add columns at the end
from public.movies m
left join lateral (
  select count(*) as subtitle_count, sum(st.download_count) as total_downloads,
         max(st.created_at) as latest_subtitle_at, array_agg(distinct st.language) as subtitle_languages
  from public.subtitles st
  where st.movie_id = m.id and st.published
) s on true;
