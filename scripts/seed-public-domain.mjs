#!/usr/bin/env node
/**
 * Turns content/public-domain/<slug>/movie.json into idempotent SQL that upserts the
 * movie and its subtitle into the database.
 *
 *   node scripts/seed-public-domain.mjs <drive-file-id-for-slug> …
 *   node scripts/seed-public-domain.mjs carnival-of-souls-1962=1V5WBBkatoFHPsENH8SS510-qOoIIeEca
 *
 * The Drive file id is required because a subtitle cannot be published without
 * one (the database enforces it). Re-running with the same ids updates the rows
 * instead of duplicating them.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'content', 'public-domain')
const ids = new Map(
  process.argv.slice(2)
    .map((a) => a.split('='))
    .filter(([k, v]) => k && v)
    .map(([k, v]) => [k, v]),
)

const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const arr = (a) => `'{${(a || []).map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(',')}}'`

const slugs = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'movie.json')))
  .map((d) => d.name)

if (!slugs.length) {
  console.error(`no movie.json found under content/public-domain/`)
  process.exit(2)
}

const out = []
for (const slug of slugs) {
  const m = JSON.parse(readFileSync(join(dir, slug, 'movie.json'), 'utf8'))
  const key = ids.get(slug) ?? ids.get(m.slug)
  if (!key) {
    console.error(`! skipping ${slug}: no drive file id given (${slug}=<id>)`)
    continue
  }
  const sub = m.subtitle || {}
  out.push(`
-- ${m.title} (${m.release_year})
with mov as (
  insert into public.movies
    (tmdb_id, slug, title, original_title, release_year, language, runtime, genres,
     poster_url, backdrop_url, overview, sinhala_description, watch_url, published, published_at)
  values
    (${m.tmdb_id ?? 'null'}, ${q(m.slug)}, ${q(m.title)}, ${q(m.original_title)}, ${m.release_year ?? 'null'},
     ${q(m.language)}, ${m.runtime ?? 'null'}, ${arr(m.genres)}, ${q(m.poster_url)}, ${q(m.backdrop_url)},
     ${q(m.overview)}, ${q(m.sinhala_description)}, ${q(m.watch_url)}, true, now())
  on conflict (tmdb_id) do update set
    slug = excluded.slug, title = excluded.title, original_title = excluded.original_title,
    release_year = excluded.release_year, language = excluded.language, runtime = excluded.runtime,
    genres = excluded.genres, poster_url = excluded.poster_url, backdrop_url = excluded.backdrop_url,
    overview = excluded.overview, sinhala_description = excluded.sinhala_description,
    watch_url = excluded.watch_url, published = true,
    published_at = coalesce(public.movies.published_at, now()), updated_at = now()
  returning id
)
insert into public.subtitles
  (movie_id, language, format, version, translator, description, drive_file_id, drive_url,
   permission_status, permission_note, link_status, link_verified_at, published)
select mov.id, ${q(sub.language)}, ${q(sub.format)}, ${q(sub.version)}, ${q(sub.translator)},
       ${q(sub.description)}, ${q(key)},
       ${q(`https://drive.google.com/file/d/${key}/view`)},
       ${q(sub.permission_status)}, ${q(sub.permission_note)},
       'manual', now(), true
from mov
where not exists (
  select 1 from public.subtitles s
  where s.movie_id = mov.id and s.language = ${q(sub.language)}
    and s.format = ${q(sub.format)} and coalesce(s.version, '') = ${q(sub.version ?? '')}
);`)
}

process.stdout.write(`begin;\n${out.join('\n')}\ncommit;\n`)
