import { select, insert } from '../lib/api.js'
import { DEFAULT_CATEGORIES } from '../lib/constants.js'

export const DEFAULT_SETTINGS = {
  site_name: 'SubLanka',
  tagline: 'සිංහල උපසිරැසි ලෝකය',
  description: 'චිත්‍රපට සඳහා සිංහල උපසිරැසි සොයන්න, ට්‍රේලර් නරඹන්න, බාගත කරගන්න.',
  logo_url: '',
  contact_email: '',
  facebook_url: '',
  telegram_url: '',
  categories: DEFAULT_CATEGORIES,
}

export async function loadSettings() {
  const rows = await select('site_settings', 'select=setting_key,setting_value')
  const out = { ...DEFAULT_SETTINGS }
  for (const r of rows) out[r.setting_key] = r.setting_value
  if (!Array.isArray(out.categories)) out.categories = DEFAULT_CATEGORIES
  return out
}

export const submitRequest = ({ name, email, kind, page_url, message }) =>
  insert('takedown_requests', { name: name.trim(), email: email.trim(), kind, page_url: page_url?.trim() || null, message: message.trim() })
