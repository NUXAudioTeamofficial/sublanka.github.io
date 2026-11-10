// Every call here runs as the signed-in user. The database (RLS + CHECK
// constraints + triggers) is what actually decides whether it is allowed.
import { supabase } from '../lib/supabase.js'
import { clearCache } from '../lib/api.js'

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}
const done = (result) => {
  clearCache()
  return unwrap(result)
}
const clean = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : v]))

/** Turns database errors into something a human can act on. */
export function friendlyError(err) {
  const msg = err?.message || String(err)
  const code = err?.code
  if (code === '23505' && /tmdb/i.test(msg)) return 'A movie with this TMDB ID already exists. Open the existing one instead of adding it twice.'
  if (code === '23505') return 'That value already exists (duplicate).'
  if (/subtitles_publish_needs_rights/.test(msg)) return 'Cannot publish: set a publishable rights status first (own work, permission granted, licensed or public domain).'
  if (/subtitles_publish_needs_file/.test(msg)) return 'Cannot publish: add the Google Drive file first.'
  if (/subtitles_publish_needs_verified_link/.test(msg)) return 'Cannot publish: verify the Google Drive link first (or confirm it manually).'
  if (/jobs_approval_needs_rights/.test(msg)) return 'Cannot approve: confirm the rights / source of this job first.'
  if (/poster_url|backdrop_url/.test(msg) && code === '23514') return 'Image addresses must start with https://'
  if (/youtube_video_id/.test(msg) && code === '23514') return 'The YouTube video ID must be exactly 11 characters. Paste the full YouTube link and it will be extracted.'
  if (/release_year/.test(msg) && code === '23514') return 'The year looks wrong (1880–2100).'
  if (code === '23514') return `The database rejected a value: ${msg}`
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) return 'Not allowed. Your account is not an admin (or your session expired — sign in again).'
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Network problem — could not reach the database. Check your connection and try again.'
  return msg
}

// ---- dashboard -------------------------------------------------------------
export async function getDashboard() {
  const [stats, latest, popular, activity] = await Promise.all([
    supabase.rpc('admin_dashboard').then(unwrap),
    supabase.from('subtitles').select('id,version,format,published,created_at,download_count,movie:movies(id,title,release_year)').order('created_at', { ascending: false }).limit(6).then(unwrap),
    supabase.from('subtitles').select('id,version,format,published,download_count,movie:movies(id,title,release_year)').gt('download_count', 0).order('download_count', { ascending: false }).limit(6).then(unwrap),
    supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(12).then(unwrap),
  ])
  return { stats, latest, popular, activity }
}

// ---- movies ----------------------------------------------------------------
const MOVIE_LIST = 'id,tmdb_id,slug,title,original_title,release_year,language,poster_url,published,created_at,updated_at,subtitles(count)'

export async function listMovies({ q = '', status = 'all', page = 0, pageSize = 25 } = {}) {
  let query = supabase.from('movies').select(MOVIE_LIST, { count: 'exact' }).order('created_at', { ascending: false })
  const term = q.trim().replace(/[%,()]/g, ' ')
  if (term) query = /^\d{4}$/.test(term) ? query.eq('release_year', Number(term)) : query.or(`title.ilike.%${term}%,original_title.ilike.%${term}%`)
  if (status === 'published') query = query.eq('published', true)
  if (status === 'draft') query = query.eq('published', false)
  const { data, error, count } = await query.range(page * pageSize, page * pageSize + pageSize - 1)
  if (error) throw error
  return { rows: data, total: count ?? data.length }
}
export const getMovieAdmin = (id) => supabase.from('movies').select('*').eq('id', id).maybeSingle().then(unwrap)
export const findMovieByTmdb = (tmdbId) => supabase.from('movies').select('id,title').eq('tmdb_id', tmdbId).maybeSingle().then(unwrap)
export const saveMovie = (id, values) => {
  const row = clean(values)
  return (id ? supabase.from('movies').update(row).eq('id', id) : supabase.from('movies').insert(row)).select().single().then(done)
}
export const setMoviePublished = (id, published) => supabase.from('movies').update({ published }).eq('id', id).select('id,published').single().then(done)
export const deleteMovie = (id) => supabase.from('movies').delete().eq('id', id).then(done)

// ---- subtitles -------------------------------------------------------------
const SUB_LIST = '*,movie:movies(id,title,release_year,slug,published)'

export async function listSubtitles({ movieId = null, status = 'all', page = 0, pageSize = 30 } = {}) {
  let query = supabase.from('subtitles').select(SUB_LIST, { count: 'exact' }).order('created_at', { ascending: false })
  if (movieId) query = query.eq('movie_id', movieId)
  if (status === 'published') query = query.eq('published', true)
  if (status === 'draft') query = query.eq('published', false)
  if (status === 'disputed') query = query.eq('permission_status', 'disputed')
  if (status === 'unverified') query = query.in('link_status', ['unverified', 'failed'])
  const { data, error, count } = await query.range(page * pageSize, page * pageSize + pageSize - 1)
  if (error) throw error
  return { rows: data, total: count ?? data.length }
}
export const saveSubtitle = (id, values) => {
  const row = clean(values)
  return (id ? supabase.from('subtitles').update(row).eq('id', id) : supabase.from('subtitles').insert(row)).select(SUB_LIST).single().then(done)
}
export const setSubtitlePublished = (id, published) => supabase.from('subtitles').update({ published }).eq('id', id).select(SUB_LIST).single().then(done)
/** One click: take a subtitle offline immediately and mark it as disputed. */
export const disputeSubtitle = (id) => supabase.from('subtitles').update({ published: false, permission_status: 'disputed' }).eq('id', id).select(SUB_LIST).single().then(done)
export const deleteSubtitle = (id) => supabase.from('subtitles').delete().eq('id', id).then(done)

// ---- AI subtitle jobs ------------------------------------------------------
const JOB_LIST = 'id,movie_id,title,source_type,rights_confirmed,status,quality_report,approved_at,created_at,updated_at,movie:movies(id,title,release_year)'
export const listJobs = () => supabase.from('subtitle_jobs').select(JOB_LIST).order('updated_at', { ascending: false }).limit(100).then(unwrap)
export const getJob = (id) => supabase.from('subtitle_jobs').select('*,movie:movies(id,title,original_title,release_year,language,tmdb_id)').eq('id', id).maybeSingle().then(unwrap)
export const saveJob = (id, values) =>
  (id ? supabase.from('subtitle_jobs').update(values).eq('id', id) : supabase.from('subtitle_jobs').insert(values)).select('*,movie:movies(id,title,original_title,release_year,language,tmdb_id)').single().then(unwrap)
export const deleteJob = (id) => supabase.from('subtitle_jobs').delete().eq('id', id).then(unwrap)
export const searchMovieOptions = (q) => {
  const term = q.trim().replace(/[%,()]/g, ' ')
  let query = supabase.from('movies').select('id,title,original_title,release_year,language,tmdb_id').order('created_at', { ascending: false }).limit(12)
  if (term) query = query.or(`title.ilike.%${term}%,original_title.ilike.%${term}%`)
  return query.then(unwrap)
}

// ---- contact / takedown requests ------------------------------------------
export const listRequests = (status = 'open') => {
  let query = supabase.from('takedown_requests').select('*').order('created_at', { ascending: false }).limit(200)
  if (status === 'open') query = query.in('status', ['new', 'reviewing'])
  else if (status !== 'all') query = query.eq('status', status)
  return query.then(unwrap)
}
export const updateRequest = (id, values) => supabase.from('takedown_requests').update(values).eq('id', id).select().single().then(unwrap)
export const deleteRequest = (id) => supabase.from('takedown_requests').delete().eq('id', id).then(unwrap)

// ---- site settings ---------------------------------------------------------
export const getSettingsAdmin = () => supabase.from('site_settings').select('setting_key,setting_value').then(unwrap)
export const saveSettings = (values) =>
  supabase
    .from('site_settings')
    .upsert(Object.entries(values).map(([setting_key, setting_value]) => ({ setting_key, setting_value })), { onConflict: 'setting_key' })
    .then(done)
export const changePassword = (password) => supabase.auth.updateUser({ password }).then(unwrap)

// ---- Edge Functions (server-side keys: TMDB, Gemini, Drive check) ----------
export async function callFn(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (!error) return data
  let message = error.message
  let status = error.context?.status
  try {
    const payload = await error.context?.json?.()
    if (payload?.error) message = payload.error
    else if (payload?.message) message = payload.message
  } catch {
    /* response was not JSON */
  }
  if (status === 404) message = `The "${name}" Edge Function is not deployed yet. See README → Edge Functions.`
  const e = new Error(message)
  e.status = status
  throw e
}

export const tmdbStatus = () => callFn('tmdb', { action: 'status' })
export const tmdbSearch = (query, year) => callFn('tmdb', { action: 'search', query, year: year || undefined })
export const tmdbDetails = (id) => callFn('tmdb', { action: 'details', id })
export const aiStatus = () => callFn('ai', { action: 'status' })
export const aiDescribe = (movie) => callFn('ai', { action: 'describe', movie })
export const aiTranslate = (payload) => callFn('ai', { action: 'translate', ...payload })
export const aiProofread = (cues) => callFn('ai', { action: 'proofread', cues })
export const driveCheck = (file_id, want_text = false) => callFn('drive-check', { file_id, want_text })
