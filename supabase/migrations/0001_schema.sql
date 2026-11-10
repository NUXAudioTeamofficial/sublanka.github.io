-- =====================================================================
-- SubLanka — database schema, security (RLS) and helper functions
-- Run once in Supabase SQL Editor (or `supabase db push`). Safe to read
-- top-to-bottom: tables -> functions -> triggers -> RLS -> grants -> seed.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- One row per auth user. `role` can only be changed from the SQL editor
-- (see grant_admin below) — there is deliberately NO API policy for writes.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now()
);

create table public.movies (
  id                   bigint generated always as identity primary key,
  tmdb_id              integer unique,
  slug                 text not null default '',
  title                text not null check (char_length(title) between 1 and 300),
  original_title       text,
  release_year         smallint check (release_year between 1880 and 2100),
  language             text not null default 'en' check (language ~ '^[a-z]{2,3}$'), -- ISO 639-1 original language
  poster_url           text check (poster_url is null or poster_url ~ '^https://'),
  backdrop_url         text check (backdrop_url is null or backdrop_url ~ '^https://'),
  overview             text,          -- verified source overview (TMDB) kept as the factual basis
  sinhala_description  text,
  genres               text[] not null default '{}',
  rating               numeric(3,1) check (rating is null or rating between 0 and 10),
  vote_count           integer,
  runtime              integer,
  youtube_video_id     text check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  published            boolean not null default false,
  published_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.subtitles (
  id                 bigint generated always as identity primary key,
  movie_id           bigint not null references public.movies (id) on delete cascade,
  language           text not null default 'si' check (language ~ '^[a-z]{2,3}$'),
  format             text not null default 'srt' check (format in ('srt', 'vtt', 'ass', 'zip')),
  version            text,           -- release / rip the timing matches, e.g. 'WEB-DL 1080p'
  translator         text,
  description        text,
  drive_file_id      text check (drive_file_id is null or drive_file_id ~ '^[A-Za-z0-9_-]{20,}$'),
  drive_url          text,
  download_count     integer not null default 0 check (download_count >= 0),
  permission_status  text not null default 'pending_review'
                     check (permission_status in ('own_work', 'licensed', 'permission_granted',
                                                  'public_domain', 'pending_review', 'disputed')),
  permission_note    text,           -- short public statement of source / permission
  link_status        text not null default 'unverified' check (link_status in ('unverified', 'ok', 'manual', 'failed')),
  link_verified_at   timestamptz,
  published          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Legal + quality gates enforced by the database itself, not just the UI:
  constraint subtitles_publish_needs_rights check (
    not published or permission_status in ('own_work', 'licensed', 'permission_granted', 'public_domain')),
  constraint subtitles_publish_needs_file check (not published or drive_file_id is not null),
  constraint subtitles_publish_needs_verified_link check (
    not published or (link_verified_at is not null and link_status in ('ok', 'manual')))
);

-- AI-assisted subtitle workflow. Admin-only. Nothing here is ever public.
create table public.subtitle_jobs (
  id                bigint generated always as identity primary key,
  movie_id          bigint references public.movies (id) on delete set null,
  title             text not null default '',
  source_type       text not null default 'own_transcript'
                    check (source_type in ('own_transcript', 'own_recording', 'licensed', 'permission_granted', 'public_domain')),
  source_reference  text,
  rights_confirmed  boolean not null default false,
  status            text not null default 'draft'
                    check (status in ('draft', 'translated', 'needs_review', 'approved', 'rejected', 'published')),
  glossary          text,
  source_srt        text,
  sinhala_srt       text,
  quality_report    jsonb,
  approved_by       uuid references auth.users (id) on delete set null,
  approved_at       timestamptz,
  created_by        uuid references auth.users (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint jobs_approval_needs_rights check (status not in ('approved', 'published') or rights_confirmed)
);

create table public.site_settings (
  id             bigint generated always as identity primary key,
  setting_key    text not null unique check (setting_key ~ '^[a-z0-9_]{1,60}$'),
  setting_value  jsonb not null,
  updated_at     timestamptz not null default now()
);

create table public.activity_log (
  id          bigint generated always as identity primary key,
  actor       uuid,
  action      text not null,
  entity      text not null,
  entity_id   bigint,
  label       text,
  created_at  timestamptz not null default now()
);

-- Copyright / takedown requests submitted from the public contact page.
create table public.takedown_requests (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(name) between 2 and 120),
  email       text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' and char_length(email) <= 200),
  kind        text not null default 'copyright' check (kind in ('copyright', 'correction', 'general')),
  page_url    text check (page_url is null or char_length(page_url) <= 500),
  message     text not null check (char_length(message) between 10 and 4000),
  status      text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'rejected')),
  admin_note  text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------
create index movies_published_created_idx on public.movies (published, created_at desc);
create index movies_language_idx          on public.movies (language);
create index movies_release_year_idx      on public.movies (release_year);
create index movies_genres_idx            on public.movies using gin (genres);
create index movies_title_trgm_idx        on public.movies using gin (title extensions.gin_trgm_ops);
create index movies_otitle_trgm_idx       on public.movies using gin (original_title extensions.gin_trgm_ops);
create index subtitles_movie_idx          on public.subtitles (movie_id);
create index subtitles_published_idx      on public.subtitles (published, created_at desc);
create index subtitles_downloads_idx      on public.subtitles (download_count desc);
create index subtitle_jobs_movie_idx      on public.subtitle_jobs (movie_id);
create index activity_log_created_idx     on public.activity_log (created_at desc);
create index takedown_status_idx          on public.takedown_requests (status, created_at desc);

-- ---------------------------------------------------------------------
-- 3. FUNCTIONS
-- ---------------------------------------------------------------------

-- The single source of truth for 'is the caller an admin?'. Used by every policy.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

-- Creates the profile row (always role = 'user') when an auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

-- FIRST-ADMIN SETUP. Callable ONLY from the SQL editor / service role:
--   select public.grant_admin('you@example.com');
create or replace function public.grant_admin(target_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  select u.id into uid from auth.users u where lower(u.email) = lower(target_email);
  if uid is null then
    raise exception 'No auth user with e-mail %. Create the user first (Authentication > Users > Add user).', target_email;
  end if;
  insert into public.profiles (id, email, role) values (uid, lower(target_email), 'admin')
  on conflict (id) do update set role = 'admin', email = excluded.email;
  return target_email || ' is now an admin';
end $$;

create or replace function public.revoke_admin(target_email text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p set role = 'user'
  from auth.users u where u.id = p.id and lower(u.email) = lower(target_email);
  return target_email || ' is no longer an admin';
end $$;

create or replace function public.slugify(txt text)
returns text language sql immutable set search_path = '' as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(txt, '')), '[^a-z0-9]+', '-', 'g')), ''), 'movie');
$$;

create or replace function public.movies_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.slug := left(public.slugify(new.title || case when new.release_year is null then '' else '-' || new.release_year end), 80);
  if new.published and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;

create or replace function public.subtitles_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    -- a download-counter bump is not an edit
    if new.download_count is distinct from old.download_count then return new; end if;
    -- changing the file invalidates the previous link verification
    if new.drive_file_id is distinct from old.drive_file_id
       and new.link_verified_at is not distinct from old.link_verified_at then
      new.link_status := 'unverified'; new.link_verified_at := null; new.published := false;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create or replace function public.log_movie_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare act text;
begin
  if tg_op = 'INSERT' then act := 'created';
  elsif tg_op = 'DELETE' then act := 'deleted';
  elsif new.published is distinct from old.published then act := case when new.published then 'published' else 'unpublished' end;
  else act := 'updated'; end if;
  insert into public.activity_log (actor, action, entity, entity_id, label)
  values ((select auth.uid()), act, 'movie', coalesce(new.id, old.id), coalesce(new.title, old.title));
  return coalesce(new, old);
end $$;

create or replace function public.log_subtitle_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare act text; movie_title text;
begin
  if tg_op = 'INSERT' then act := 'created';
  elsif tg_op = 'DELETE' then act := 'deleted';
  elsif new.published is distinct from old.published then act := case when new.published then 'published' else 'unpublished' end;
  elsif new.download_count is distinct from old.download_count then return new;
  else act := 'updated'; end if;
  select m.title into movie_title from public.movies m where m.id = coalesce(new.movie_id, old.movie_id);
  insert into public.activity_log (actor, action, entity, entity_id, label)
  values ((select auth.uid()), act, 'subtitle', coalesce(new.id, old.id),
          coalesce(movie_title, 'movie #' || coalesce(new.movie_id, old.movie_id)) ||
          coalesce(' — ' || nullif(coalesce(new.version, old.version), ''), ''));
  return coalesce(new, old);
end $$;

-- Public download counter. Returns the Drive file id ONLY when both the subtitle
-- and its movie are published; otherwise returns null and counts nothing.
create or replace function public.register_download(p_subtitle_id bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare fid text;
begin
  update public.subtitles s
     set download_count = s.download_count + 1
   where s.id = p_subtitle_id
     and s.published
     and exists (select 1 from public.movies m where m.id = s.movie_id and m.published)
  returning s.drive_file_id into fid;
  return fid;
end $$;

-- ---------------------------------------------------------------------
-- 4. VIEW + SEARCH (security_invoker => RLS of the caller applies)
-- ---------------------------------------------------------------------
create view public.movie_cards with (security_invoker = true) as
select m.id, m.tmdb_id, m.slug, m.title, m.original_title, m.release_year, m.language,
       m.poster_url, m.backdrop_url, m.sinhala_description, m.genres, m.rating, m.runtime,
       m.youtube_video_id, m.published, m.published_at, m.created_at, m.updated_at,
       coalesce(s.subtitle_count, 0)::int      as subtitle_count,
       coalesce(s.total_downloads, 0)::bigint  as total_downloads,
       s.latest_subtitle_at,
       coalesce(s.subtitle_languages, '{}')    as subtitle_languages
from public.movies m
left join lateral (
  select count(*) as subtitle_count, sum(st.download_count) as total_downloads,
         max(st.created_at) as latest_subtitle_at, array_agg(distinct st.language) as subtitle_languages
  from public.subtitles st
  where st.movie_id = m.id and st.published
) s on true;

create or replace function public.search_movies(
  q              text    default null,
  langs          text[]  default null,   -- include only these original languages
  exclude_langs  text[]  default null,   -- 'Other languages' = everything except these
  genre          text    default null,
  year           integer default null,
  sort           text    default 'recent', -- recent | latest | popular | rating | year
  only_with_subs boolean default false,
  page_size      integer default 24,
  page_offset    integer default 0
) returns setof public.movie_cards
language sql stable security invoker set search_path = '' as $$
  with needle as (
    -- escape LIKE wildcards typed by the visitor (chr(92) = backslash, the LIKE escape character)
    select nullif(replace(replace(replace(btrim(coalesce(q, '')), chr(92), chr(92) || chr(92)),
                                  '%', chr(92) || '%'), '_', chr(92) || '_'), '') as t
  )
  select mc.*
  from public.movie_cards mc, needle n
  where mc.published
    and (n.t is null
         or mc.title ilike '%' || n.t || '%'
         or mc.original_title ilike '%' || n.t || '%'
         or exists (select 1 from unnest(mc.genres) g where g ilike '%' || n.t || '%'))
    and (langs is null or mc.language = any (langs))
    and (exclude_langs is null or not (mc.language = any (exclude_langs)))
    and (genre is null or genre = '' or exists (select 1 from unnest(mc.genres) g where lower(g) = lower(genre)))
    and (year is null or mc.release_year = year)
    and (not only_with_subs or mc.subtitle_count > 0)
  order by
    case when sort = 'popular' then mc.total_downloads end desc nulls last,
    case when sort = 'rating'  then mc.rating end desc nulls last,
    case when sort = 'year'    then mc.release_year end desc nulls last,
    case when sort = 'latest'  then mc.latest_subtitle_at end desc nulls last,
    coalesce(mc.published_at, mc.created_at) desc,
    mc.id desc
  limit least(greatest(coalesce(page_size, 24), 1), 60)
  offset greatest(coalesce(page_offset, 0), 0);
$$;

-- Admin dashboard numbers in one round-trip. Refuses non-admins.
create or replace function public.admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'movies',            (select count(*) from public.movies),
    'movies_published',  (select count(*) from public.movies where published),
    'subtitles',         (select count(*) from public.subtitles),
    'subtitles_published', (select count(*) from public.subtitles where published),
    'downloads',         (select coalesce(sum(download_count), 0) from public.subtitles),
    'open_requests',     (select count(*) from public.takedown_requests where status in ('new', 'reviewing')),
    'jobs_waiting',      (select count(*) from public.subtitle_jobs where status in ('translated', 'needs_review'))
  );
end $$;

-- ---------------------------------------------------------------------
-- 5. TRIGGERS
-- ---------------------------------------------------------------------
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger movies_before_write before insert or update on public.movies
  for each row execute function public.movies_before_write();
create trigger subtitles_before_write before insert or update on public.subtitles
  for each row execute function public.subtitles_before_write();
create trigger subtitle_jobs_touch before update on public.subtitle_jobs
  for each row execute function public.touch_updated_at();
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

create trigger movies_activity after insert or update or delete on public.movies
  for each row execute function public.log_movie_activity();
create trigger subtitles_activity after insert or update or delete on public.subtitles
  for each row execute function public.log_subtitle_activity();

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.movies            enable row level security;
alter table public.subtitles         enable row level security;
alter table public.subtitle_jobs     enable row level security;
alter table public.site_settings     enable row level security;
alter table public.activity_log      enable row level security;
alter table public.takedown_requests enable row level security;

-- profiles: read own row (admins read all). No write policies at all.
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_admin());

-- movies: the public sees published rows only; admins do everything.
create policy movies_public_read_published on public.movies
  for select to anon, authenticated using (published);
create policy movies_admin_select on public.movies
  for select to authenticated using (public.is_admin());
create policy movies_admin_insert on public.movies
  for insert to authenticated with check (public.is_admin());
create policy movies_admin_update on public.movies
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy movies_admin_delete on public.movies
  for delete to authenticated using (public.is_admin());

-- subtitles: public sees a row only if it AND its movie are published.
create policy subtitles_public_read_published on public.subtitles
  for select to anon, authenticated
  using (published and exists (select 1 from public.movies m where m.id = movie_id and m.published));
create policy subtitles_admin_select on public.subtitles
  for select to authenticated using (public.is_admin());
create policy subtitles_admin_insert on public.subtitles
  for insert to authenticated with check (public.is_admin());
create policy subtitles_admin_update on public.subtitles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy subtitles_admin_delete on public.subtitles
  for delete to authenticated using (public.is_admin());

-- subtitle_jobs: admin only.
create policy jobs_admin_all on public.subtitle_jobs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- site_settings: public read, admin write.
create policy settings_public_read on public.site_settings
  for select to anon, authenticated using (true);
create policy settings_admin_insert on public.site_settings
  for insert to authenticated with check (public.is_admin());
create policy settings_admin_update on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy settings_admin_delete on public.site_settings
  for delete to authenticated using (public.is_admin());

-- activity_log: admin read only. Rows are written by SECURITY DEFINER triggers.
create policy activity_admin_read on public.activity_log
  for select to authenticated using (public.is_admin());

-- takedown_requests: anyone may submit a NEW request; only admins can read/manage.
create policy takedown_public_insert on public.takedown_requests
  for insert to anon, authenticated with check (status = 'new' and admin_note is null);
create policy takedown_admin_select on public.takedown_requests
  for select to authenticated using (public.is_admin());
create policy takedown_admin_update on public.takedown_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy takedown_admin_delete on public.takedown_requests
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 7. GRANTS (least privilege; RLS above still applies on top of these)
-- ---------------------------------------------------------------------
revoke all on public.profiles, public.movies, public.subtitles, public.subtitle_jobs,
              public.site_settings, public.activity_log, public.takedown_requests, public.movie_cards
  from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.movies, public.subtitles, public.site_settings, public.movie_cards to anon;
grant insert (name, email, kind, page_url, message) on public.takedown_requests to anon;

grant select on public.profiles, public.activity_log, public.movie_cards to authenticated;
grant select, insert, update, delete on public.movies, public.subtitles, public.subtitle_jobs,
      public.site_settings, public.takedown_requests to authenticated;

revoke all on function public.grant_admin(text), public.revoke_admin(text), public.handle_new_user(),
              public.log_movie_activity(), public.log_subtitle_activity(), public.movies_before_write(),
              public.subtitles_before_write(), public.touch_updated_at()
  from public, anon, authenticated;
revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.is_admin(), public.register_download(bigint), public.slugify(text),
      public.search_movies(text, text[], text[], text, integer, text, boolean, integer, integer)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. SEED: default site settings (edit later in Admin > Settings)
-- ---------------------------------------------------------------------
insert into public.site_settings (setting_key, setting_value) values
  ('site_name',     to_jsonb('SubLanka'::text)),
  ('tagline',       to_jsonb('සිංහල උපසිරැසි ලෝකය'::text)),
  ('description',   to_jsonb('චිත්‍රපට සඳහා සිංහල උපසිරැසි සොයන්න, ට්‍රේලර් නරඹන්න, බාගත කරගන්න.'::text)),
  ('logo_url',      to_jsonb(''::text)),
  ('contact_email', to_jsonb(''::text)),
  ('facebook_url',  to_jsonb(''::text)),
  ('telegram_url',  to_jsonb(''::text)),
  ('categories',    jsonb_build_array(
     jsonb_build_object('code', 'ta', 'en', 'Tamil',   'si', 'දෙමළ'),
     jsonb_build_object('code', 'te', 'en', 'Telugu',  'si', 'තෙලිඟු'),
     jsonb_build_object('code', 'en', 'en', 'English', 'si', 'ඉංග්‍රීසි'),
     jsonb_build_object('code', 'hi', 'en', 'Hindi',   'si', 'හින්දි')))
on conflict (setting_key) do nothing;
