// Supabase SDK client. Imported ONLY by the admin area, so it lives in the
// lazily loaded admin chunk and public visitors never download it.
// The key used here is the public "anon / publishable" key: every permission
// is enforced by Row Level Security in the database, not by this file.
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY } from './config.js'

export const supabase = createClient(SUPABASE_URL || 'https://invalid.localhost', SUPABASE_KEY || 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'sublanka-admin-auth' },
})
