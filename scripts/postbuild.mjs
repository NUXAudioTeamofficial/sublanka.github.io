// Runs after `vite build`.
// GitHub Pages only serves static files, so this script writes one real HTML
// file per public page (correct <title>, description, Open Graph, canonical,
// JSON-LD and a small readable fallback) plus sitemap.xml, robots.txt and 404.html.
// The React app then takes over in the browser.
//
// It must never break the build: if Supabase cannot be reached, the static
// pages are still written and movie pages fall back to 404.html (which loads
// the same app and shows the movie client-side).
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { readdirSync } from 'node:fs'
import { searchArgs, searchKey, movieKey, subsKey, HOME_QUERIES, BROWSE_QUERY, SUBTITLE_COLUMNS, SUBTITLE_ORDER, BACKDROP_SIZES, DETAIL_POSTER_SIZES, CARD_POSTER_SIZES } from '../src/lib/queries.js'

const DIST = path.resolve('dist')

function loadDotEnv() {
  if (!existsSync('.env')) return
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadDotEnv()

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''
const BASE = (process.env.VITE_BASE_PATH || '/').replace(/\/*$/, '/')
const SITE_URL = (process.env.VITE_SITE_URL || `http://localhost:4173${BASE}`).replace(/\/*$/, '/')
const abs = (p = '') => SITE_URL + String(p).replace(/^\/+/, '')

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const ldSafe = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c')

async function api(pathAndQuery) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

// Same public RPC the browser calls; the result is embedded in the page as a first-paint snapshot.
async function search(options) {
  const { args } = searchArgs(options)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_movies`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  // list cards never show the long description, so keep it out of the snapshot
  const rows = (await res.json()).map(({ sinhala_description, ...row }) => row)
  return [searchKey(args), rows]
}

async function loadData() {
  const fallback = { settings: {}, movies: [], subtitles: new Map(), lists: null, ok: false }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[postbuild] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — writing static pages only.')
    return fallback
  }
  try {
    const rows = await api('site_settings?select=setting_key,setting_value')
    const settings = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]))
    const movies = []
    for (let from = 0; from < 20000; from += 1000) {
      const page = await api(
        `movie_cards?select=*&published=is.true&order=id.asc&limit=1000&offset=${from}`,
      )
      movies.push(...page)
      if (page.length < 1000) break
    }
    // First-paint snapshots. Optional: if any of this fails the pages simply load their data in the browser as before.
    let lists = null
    const subtitles = new Map()
    try {
      const [latest, popular, recent, browse] = await Promise.all([search(HOME_QUERIES.latest), search(HOME_QUERIES.popular), search(HOME_QUERIES.recent), search(BROWSE_QUERY)])
      lists = { latest, popular, recent, browse }
      for (let from = 0; from < 50000; from += 1000) {
        const page = await api(`subtitles?published=is.true&select=movie_id,${SUBTITLE_COLUMNS}&order=${SUBTITLE_ORDER}&limit=1000&offset=${from}`)
        for (const { movie_id, ...sub } of page) subtitles.set(movie_id, [...(subtitles.get(movie_id) || []), sub])
        if (page.length < 1000) break
      }
    } catch (err) {
      lists = null
      subtitles.clear()
      console.warn(`[postbuild] First-paint snapshots skipped (${err.message}).`)
    }
    return { settings, movies, subtitles, lists, ok: true }
  } catch (err) {
    console.warn(`[postbuild] Could not read from Supabase (${err.message}). Writing static pages only.`)
    return fallback
  }
}

function head({ title, description, url, image, type = 'website', siteName, noindex = false, jsonLd }) {
  const lines = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    noindex ? '<meta name="robots" content="noindex, nofollow" />' : `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" />`,
    `<meta property="og:type" content="${esc(type)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    noindex ? '' : `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    '<meta property="og:locale" content="si_LK" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    jsonLd ? `<script type="application/ld+json" data-seo-ld="1">${ldSafe(jsonLd)}</script>` : '',
  ]
  return lines.filter(Boolean).join('\n    ')
}

const isTmdb = (url) => Boolean(url && url.includes('image.tmdb.org/t/p/'))
const tmdbSize = (url, size) => (isTmdb(url) ? url.replace(/\/t\/p\/[^/]+\//, `/t/p/${size}/`) : url)

// <link rel="preload"> for the image that will be the largest thing on screen, with the
// same srcset / sizes the app uses, so the browser fetches exactly one file — early.
const preloadBackdrop = (url) =>
  isTmdb(url) ? `<link rel="preload" as="image" href="${esc(tmdbSize(url, 'w780'))}" imagesrcset="${esc(`${tmdbSize(url, 'w780')} 780w, ${tmdbSize(url, 'w1280')} 1280w`)}" imagesizes="${esc(BACKDROP_SIZES)}" fetchpriority="high" />` : ''
const preloadPoster = (url, sizes) =>
  isTmdb(url) ? `<link rel="preload" as="image" href="${esc(tmdbSize(url, 'w342'))}" imagesrcset="${esc(`${tmdbSize(url, 'w185')} 185w, ${tmdbSize(url, 'w342')} 342w, ${tmdbSize(url, 'w500')} 500w`)}" imagesizes="${esc(sizes)}" fetchpriority="high" />` : ''

async function main() {
  const template = await readFile(path.join(DIST, 'index.html'), 'utf8')
  if (!template.includes('<!--seo:start-->') || !template.includes('<!--prerender-->')) throw new Error('index.html is missing the seo / prerender markers')

  const { settings, movies, subtitles, lists, ok } = await loadData()

  // Tags every page gets: early connection to the database, and the two fonts that draw the first screen.
  const assetBase = (template.match(/(?:src|href)="([^"]*assets\/)[^"]+\.js"/) || [])[1] || `${BASE}assets/`
  const fontFile = (re) => (existsSync(path.join(DIST, 'assets')) ? readdirSync(path.join(DIST, 'assets')).find((f) => re.test(f)) : null)
  const fonts = [fontFile(/^manrope-latin-wght-normal-.*\.woff2$/), fontFile(/^noto-sans-sinhala-sinhala-700-normal-.*\.woff2$/)].filter(Boolean)
  const commonHead = [
    SUPABASE_URL ? `<link rel="preconnect" href="${esc(new URL(SUPABASE_URL).origin)}" crossorigin />` : '',
    ...fonts.map((f) => `<link rel="preload" as="font" type="font/woff2" href="${assetBase}${f}" crossorigin />`),
  ].filter(Boolean)
  const seedTag = (cache) => {
    const data = { at: new Date().toISOString(), settings: ok ? settings : undefined, cache: cache && Object.keys(cache).length ? cache : undefined }
    return data.settings || data.cache ? `<script id="sl-seed" type="application/json">${ldSafe(data)}</script>` : ''
  }
  const siteName = settings.site_name || 'SubLanka'
  const tagline = settings.tagline || 'සිංහල උපසිරැසි ලෝකය'
  const siteDescription = settings.description || 'චිත්‍රපට සඳහා සිංහල උපසිරැසි සොයන්න, ට්‍රේලර් නරඹන්න, බාගත කරගන්න.'
  const ogImage = abs('og-image.png')

  const render = (seo, body = '', { cache = null, preload = [], bare = false } = {}) =>
    template
      .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, () => head({ siteName, image: ogImage, ...seo }))
      .replace('<!--head-extra-->', () => [...commonHead, ...preload].filter(Boolean).join('\n    '))
      .replace('<!--seed-->', () => (bare ? '' : seedTag(cache)))
      .replace('<!--prerender-->', () => (body ? `<div class="boot" data-prerender>${body}</div>` : ''))

  async function write(route, html) {
    const file = path.join(DIST, route, route.endsWith('.html') ? '' : 'index.html')
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, html)
  }

  const nav = `<nav><a href="${BASE}">මුල් පිටුව</a> · <a href="${BASE}browse/">සියලු චිත්‍රපට</a> · <a href="${BASE}copyright/">Copyright &amp; Contact</a></nav>`
  const pages = [
    {
      route: '',
      title: `${siteName} — ${tagline}`,
      description: siteDescription,
      body: `<h1>${esc(siteName)} — ${esc(tagline)}</h1><p>${esc(siteDescription)}</p>${nav}`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'WebSite', name: siteName, url: abs(''), inLanguage: 'si',
        potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${abs('browse/')}?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
      },
      priority: '1.0', changefreq: 'daily',
    },
    { route: 'browse/', title: `සියලු චිත්‍රපට — Browse movies | ${siteName}`, description: 'දෙමළ, තෙලිඟු, ඉංග්‍රීසි, හින්දි සහ වෙනත් භාෂාවල චිත්‍රපට සඳහා සිංහල උපසිරැසි සොයන්න.', priority: '0.8', changefreq: 'daily' },
    { route: 'about/', title: `අප ගැන — About | ${siteName}`, description: `${siteName} යනු සිංහල උපසිරැසි සොයා බාගත කරගැනීමට ඇති නොමිලේ වෙබ් අඩවියකි. චිත්‍රපට වීඩියෝ මෙහි නැත.`, priority: '0.4', changefreq: 'monthly' },
    { route: 'copyright/', title: `Copyright, Takedown & Contact | ${siteName}`, description: 'හිමිකම් ප්‍රතිපත්තිය, ඉවත් කිරීමේ ඉල්ලීම් (takedown) සහ සම්බන්ධ වීම.', priority: '0.4', changefreq: 'monthly' },
    { route: 'privacy/', title: `Privacy Policy | ${siteName}`, description: `${siteName} පෞද්ගලිකත්ව ප්‍රතිපත්තිය — අප රැස් කරන සහ නොකරන දත්ත.`, priority: '0.3', changefreq: 'yearly' },
    { route: 'terms/', title: `Terms of Use | ${siteName}`, description: `${siteName} භාවිත කිරීමේ කොන්දේසි.`, priority: '0.3', changefreq: 'yearly' },
  ]

  // First-paint snapshots for the two list pages (same cache keys the app computes).
  const extras = {}
  if (lists) {
    const all = [...lists.latest[1], ...lists.recent[1]]
    extras[''] = {
      cache: Object.fromEntries([lists.latest, lists.popular, lists.recent]),
      preload: [preloadBackdrop(all.find((m) => m.backdrop_url)?.backdrop_url)],
    }
    extras['browse/'] = { cache: Object.fromEntries([lists.browse]), preload: [preloadPoster(lists.browse[1][0]?.poster_url, CARD_POSTER_SIZES)] }
  }

  // The text pages live in their own small script: ask for it straight away on those pages.
  const staticChunk = fontFile(/^StaticPages-.*\.js$/)
  const textPage = { preload: staticChunk ? [`<link rel="modulepreload" href="${assetBase}${staticChunk}" />`] : [] }
  for (const p of pages) if (!extras[p.route] && p.route !== '' && p.route !== 'browse/') extras[p.route] = textPage

  for (const p of pages) {
    const body = p.body || `<h1>${esc(p.title)}</h1><p>${esc(p.description)}</p>${nav}`
    await write(p.route, render({ title: p.title, description: p.description, url: abs(p.route), jsonLd: p.jsonLd }, body, extras[p.route]))
  }

  for (const m of movies) {
    const route = `movie/${m.id}-${m.slug || 'movie'}/`
    const year = m.release_year ? ` (${m.release_year})` : ''
    const title = `${m.title}${year} සිංහල උපසිරැසි | Sinhala Subtitles | ${siteName}`
    const description = (m.sinhala_description || `${m.title}${year} චිත්‍රපටය සඳහා සිංහල උපසිරැසි බාගන්න.`).replace(/\s+/g, ' ').trim().slice(0, 300)
    const image = m.backdrop_url ? tmdbSize(m.backdrop_url, 'w1280') : m.poster_url || ogImage
    const jsonLd = {
      '@context': 'https://schema.org', '@type': 'Movie', name: m.title, url: abs(route), inLanguage: m.language,
      ...(m.original_title && m.original_title !== m.title ? { alternateName: m.original_title } : {}),
      ...(m.release_year ? { datePublished: String(m.release_year) } : {}),
      ...(m.poster_url ? { image: m.poster_url } : {}),
      ...(m.genres?.length ? { genre: m.genres } : {}),
      ...(m.runtime ? { duration: `PT${m.runtime}M` } : {}),
      ...(m.sinhala_description ? { description } : {}),
    }
    const body = `<h1>${esc(m.title)}${esc(year)} — සිංහල උපසිරැසි</h1><p>${esc(description)}</p>${nav}`
    const cache = lists ? { [movieKey(m.id)]: [m], [subsKey(m.id)]: subtitles.get(m.id) || [] } : null
    await write(route, render({ title, description, url: abs(route), image, type: 'video.movie', jsonLd }, body, { cache, preload: [preloadPoster(m.poster_url, DETAIL_POSTER_SIZES)] }))
  }

  // Admin shell: real file so /admin/ answers 200, never indexed.
  await write('admin/', render({ title: `Admin | ${siteName}`, description: 'Administration.', noindex: true }, '', { bare: true }))
  // Any other address (e.g. a movie added after the last build, /admin/movies/…) gets this app shell.
  await writeFile(path.join(DIST, '404.html'), render({ title: `${siteName} — ${tagline}`, description: siteDescription, noindex: true }))
  // (404.html also serves deep links to pages created after this build, so it carries no page-specific data)

  const today = new Date().toISOString().slice(0, 10)
  const urls = [
    ...pages.map((p) => ({ loc: abs(p.route), lastmod: today, changefreq: p.changefreq, priority: p.priority })),
    ...movies.map((m) => ({
      loc: abs(`movie/${m.id}-${m.slug || 'movie'}/`),
      lastmod: String(m.latest_subtitle_at && m.latest_subtitle_at > m.updated_at ? m.latest_subtitle_at : m.updated_at || today).slice(0, 10),
      changefreq: 'weekly', priority: m.subtitle_count > 0 ? '0.9' : '0.6',
    })),
  ]
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n') +
    '\n</urlset>\n'
  await writeFile(path.join(DIST, 'sitemap.xml'), sitemap)
  // Note: on a project site (username.github.io/<repo>/) crawlers only read robots.txt at the
  // domain root, so this file takes full effect once a custom domain is used. The sitemap can
  // be submitted directly in Google Search Console either way.
  await writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: ${BASE}admin/\n\nSitemap: ${abs('sitemap.xml')}\n`)
  await writeFile(path.join(DIST, '.nojekyll'), '')

  console.log(`[postbuild] ${pages.length} static pages, ${movies.length} movie pages, sitemap with ${urls.length} URLs${ok ? '' : ' (Supabase not reachable — movies skipped)'}.`)
}

main().catch((err) => {
  console.error('[postbuild] failed:', err)
  process.exit(1)
})
