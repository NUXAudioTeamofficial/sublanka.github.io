// SubRip (.srt) / WebVTT parsing, validation and deterministic timing fixes.
// Pure functions with no dependencies — used by the admin tools and covered by tests/.

const TIME = String.raw`(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})`
const TIMING_RE = new RegExp(String.raw`^\s*${TIME}\s*-->\s*${TIME}(?:\s+.*)?$`)
const SINHALA_RE = /[\u0D80-\u0DFF]/g
const LATIN_RE = /[A-Za-z]/g
const TAG_RE = /<[^>]+>|\{\\[^}]*\}/g

const toMs = (h, m, s, ms) => (Number(h || 0) * 3600 + Number(m) * 60 + Number(s)) * 1000 + Number(String(ms).padEnd(3, '0'))

export function parseTime(str) {
  const m = String(str || '').trim().match(new RegExp(`^${TIME}$`))
  return m ? toMs(m[1], m[2], m[3], m[4]) : null
}

export function formatTime(ms, sep = ',') {
  const t = Math.max(0, Math.round(ms))
  const h = Math.floor(t / 3600000)
  const m = Math.floor((t % 3600000) / 60000)
  const s = Math.floor((t % 60000) / 1000)
  const pad = (n, l = 2) => String(n).padStart(l, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(t % 1000, 3)}`
}

/** Tolerant parser for both .srt and .vtt. Returns { cues, errors, format }. */
export function parseSubtitle(input) {
  const text = String(input ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const format = /^WEBVTT/.test(text) ? 'vtt' : 'srt'
  const lines = text.split('\n')
  const errors = []
  const timing = []

  lines.forEach((line, i) => {
    if (!line.includes('-->')) return
    const m = line.match(TIMING_RE)
    if (m) timing.push({ i, start: toMs(m[1], m[2], m[3], m[4]), end: toMs(m[5], m[6], m[7], m[8]) })
    else errors.push({ line: i + 1, message: `Unreadable timestamp line: "${line.trim().slice(0, 60)}"` })
  })

  const cues = []
  timing.forEach((t, n) => {
    const prev = lines[t.i - 1]?.trim() ?? ''
    const index = /^\d+$/.test(prev) ? Number(prev) : null
    let endLine = n + 1 < timing.length ? timing[n + 1].i : lines.length
    if (n + 1 < timing.length) {
      // drop the next cue's identifier line (a number in SRT, any label in VTT)
      const before = lines[endLine - 1]?.trim() ?? ''
      if (before && (/^\d+$/.test(before) || (format === 'vtt' && (lines[endLine - 2] ?? '').trim() === ''))) endLine -= 1
    }
    const body = lines.slice(t.i + 1, endLine)
    while (body.length && !body[body.length - 1].trim()) body.pop()
    while (body.length && !body[0].trim()) body.shift()
    cues.push({ id: n + 1, index, start: t.start, end: t.end, text: body.join('\n'), line: t.i + 1 })
  })

  if (format === 'srt' && timing.length) {
    // anything before the first cue that is not blank / a number is junk
    const firstIdx = timing[0].i - (/^\d+$/.test(lines[timing[0].i - 1]?.trim() ?? '') ? 1 : 0)
    lines.slice(0, firstIdx).forEach((l, i) => {
      if (l.trim()) errors.push({ line: i + 1, message: `Unexpected text before the first cue: "${l.trim().slice(0, 60)}"` })
    })
  }
  if (!timing.length && text.trim()) errors.push({ line: 1, message: 'No timestamp lines (00:00:00,000 --> 00:00:00,000) were found.' })
  return { cues, errors, format }
}

export function toSrt(cues) {
  return cues.map((c, i) => `${i + 1}\n${formatTime(c.start)} --> ${formatTime(c.end)}\n${c.text}\n`).join('\n')
}

export function toVtt(cues) {
  return 'WEBVTT\n\n' + cues.map((c, i) => `${i + 1}\n${formatTime(c.start, '.')} --> ${formatTime(c.end, '.')}\n${c.text}\n`).join('\n')
}

const stripTags = (s) => String(s || '').replace(TAG_RE, '')

/** Visible length: counts user-perceived characters, so Sinhala vowel signs do not inflate the number. */
export function visibleLength(str) {
  const s = stripTags(str)
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    let n = 0
    for (const _ of new Intl.Segmenter('si', { granularity: 'grapheme' }).segment(s)) n++ // eslint-disable-line no-unused-vars
    return n
  }
  return s.replace(/[\u0DCA-\u0DDF\u0DF2\u0DF3\u200C\u200D]/g, '').length
}

export const DEFAULT_RULES = {
  lang: 'si',
  maxLineLength: 42,
  maxLines: 2,
  maxCps: 21, // characters per second (reading speed)
  minDuration: 700, // ms
  maxDuration: 7000,
  minGap: 40,
  suspiciousGap: 180000, // 3 minutes without any dialogue
}

/**
 * Quality check. Returns { summary, issues } where every issue is
 * { severity: 'error' | 'warning' | 'info', code, cue, message }.
 */
export function validateCues(cues, options = {}) {
  const rules = { ...DEFAULT_RULES, ...options }
  const issues = []
  const add = (severity, code, cue, message) => issues.push({ severity, code, cue, message })
  const { parseErrors = [], source = null, glossary = [] } = options

  parseErrors.forEach((e) => add('error', 'syntax', null, `Line ${e.line}: ${e.message}`))
  if (!cues.length) add('error', 'empty_file', null, 'The file contains no subtitle cues.')

  let sinhala = 0
  let latin = 0

  cues.forEach((c, i) => {
    const n = i + 1
    const text = stripTags(c.text).trim()
    const dur = c.end - c.start
    const prev = cues[i - 1]
    const next = cues[i + 1]

    if (c.index != null && c.index !== n) add('info', 'numbering', n, `Cue is numbered ${c.index} but is #${n} in the file.`)
    if (dur <= 0) add('error', 'negative_duration', n, 'End time is not after the start time.')
    if (prev && c.start < prev.start) add('error', 'out_of_order', n, 'Starts before the previous cue (timestamps out of order).')
    else if (prev && c.start < prev.end) add('error', 'overlap', n, `Overlaps the previous cue by ${prev.end - c.start} ms.`)
    if (!text) add('error', 'empty_text', n, 'Cue has no text.')

    if (dur > 0 && text) {
      if (dur < rules.minDuration) add('warning', 'too_short', n, `Shown for only ${dur} ms — hard to read.`)
      if (dur > rules.maxDuration) add('warning', 'too_long', n, `Stays on screen ${(dur / 1000).toFixed(1)} s.`)
      const cps = visibleLength(text.replace(/\n/g, ' ')) / (dur / 1000)
      if (cps > rules.maxCps) add('warning', 'reading_speed', n, `Reading speed ${cps.toFixed(0)} characters/second (max ${rules.maxCps}).`)
    }

    const textLines = text ? text.split('\n') : []
    if (textLines.length > rules.maxLines) add('warning', 'too_many_lines', n, `${textLines.length} lines (max ${rules.maxLines}).`)
    const longest = Math.max(0, ...textLines.map(visibleLength))
    if (longest > rules.maxLineLength) add('warning', 'long_line', n, `Line is ${longest} characters (max ${rules.maxLineLength}).`)

    if (next && next.start - c.end > rules.suspiciousGap && c.end > c.start)
      add('info', 'gap', n, `${Math.round((next.start - c.end) / 1000)} s without subtitles after this cue — check that nothing is missing.`)
    if (prev && text && stripTags(prev.text).trim() === text && c.start - prev.end < 2000) add('info', 'duplicate', n, 'Same text as the previous cue.')

    if (/\uFFFD|à¶|à·|â€|Ã¢/.test(c.text)) add('error', 'encoding', n, 'Broken characters — the file was probably not saved as UTF-8.')
    if (/<(?!\/?(i|b|u|font)\b)[^>]*>/i.test(c.text)) add('info', 'markup', n, 'Contains unusual markup tags.')

    const si = (text.match(SINHALA_RE) || []).length
    const la = (text.match(LATIN_RE) || []).length
    sinhala += si
    latin += la
    if (rules.lang === 'si' && text) {
      if (si === 0 && la >= 4) add('warning', 'untranslated', n, 'No Sinhala text — possibly not translated.')
      if (/(^|[\s"'(\-])[\u0DCA-\u0DDF\u0DF2\u0DF3]/.test(text)) add('warning', 'orphan_sign', n, 'A Sinhala vowel sign appears without a base letter (typing error).')
      if (/([\u0DCF-\u0DDF\u0DCA])\1/.test(text)) add('warning', 'double_sign', n, 'The same Sinhala vowel sign is repeated (typing error).')
    }
    if (/ {2,}/.test(text) || /\s+[,.!?](\s|$)/.test(text)) add('info', 'spacing', n, 'Irregular spacing or a space before punctuation.')
  })

  if (source && source.length) {
    if (source.length !== cues.length)
      add('warning', 'cue_count', null, `Source has ${source.length} cues but the translation has ${cues.length}.`)
    else {
      const terms = glossary.filter((g) => g.from && g.to)
      cues.forEach((c, i) => {
        const s = source[i]
        if (Math.abs(s.start - c.start) > 1500) add('info', 'timing_drift', i + 1, 'Start time differs from the source cue by more than 1.5 s.')
        for (const g of terms) {
          if (stripTags(s.text).toLowerCase().includes(g.from.toLowerCase()) && !c.text.includes(g.to))
            add('info', 'glossary', i + 1, `Source mentions "${g.from}" but the translation does not use "${g.to}".`)
        }
      })
    }
  }

  const sinhalaRatio = sinhala + latin ? sinhala / (sinhala + latin) : 0
  if (rules.lang === 'si' && cues.length && sinhalaRatio < 0.5)
    add('warning', 'low_sinhala', null, `Only ${Math.round(sinhalaRatio * 100)}% of the letters are Sinhala.`)

  const errors = issues.filter((x) => x.severity === 'error').length
  const warnings = issues.filter((x) => x.severity === 'warning').length
  const infos = issues.length - errors - warnings
  const score = cues.length ? Math.max(0, Math.min(100, Math.round(100 - ((errors * 4 + warnings) / cues.length) * 25))) : 0
  const last = cues[cues.length - 1]
  return {
    summary: {
      cues: cues.length,
      duration: last ? last.end : 0,
      errors,
      warnings,
      infos,
      sinhalaRatio: Math.round(sinhalaRatio * 100),
      score,
      verdict: errors ? 'fail' : warnings > Math.max(3, cues.length * 0.05) ? 'review' : 'pass',
      checkedAt: new Date().toISOString(),
    },
    issues,
  }
}

// ---------------------------------------------------------------------------
// Deterministic fixes. Every function returns NEW cue objects.
// ---------------------------------------------------------------------------

export const renumber = (cues) => cues.map((c, i) => ({ ...c, id: i + 1, index: i + 1 }))
export const sortCues = (cues) => [...cues].sort((a, b) => a.start - b.start || a.end - b.end)
export const removeEmpty = (cues) => cues.filter((c) => stripTags(c.text).trim())

export const shiftCues = (cues, ms) =>
  cues.map((c) => {
    const start = Math.max(0, c.start + ms)
    return { ...c, start, end: Math.max(start + 1, c.end + ms) }
  })

/** Linear re-sync from two reference points: time `a.from` should become `a.to`, `b.from` -> `b.to`. */
export function resyncCues(cues, a, b) {
  if (a.from === b.from) return cues
  const scale = (b.to - a.to) / (b.from - a.from)
  const map = (t) => Math.max(0, Math.round(a.to + (t - a.from) * scale))
  return cues.map((c) => ({ ...c, start: map(c.start), end: Math.max(map(c.start) + 1, map(c.end)) }))
}

export function fixOverlaps(cues, minGap = DEFAULT_RULES.minGap) {
  const out = cues.map((c) => ({ ...c }))
  for (let i = 0; i < out.length - 1; i++) {
    const limit = out[i + 1].start - minGap
    if (out[i].end > limit) out[i].end = Math.max(out[i].start + 1, limit)
  }
  return out
}

export function fixDurations(cues, rules = {}) {
  const r = { ...DEFAULT_RULES, ...rules }
  const out = cues.map((c) => ({ ...c }))
  out.forEach((c, i) => {
    const ceiling = out[i + 1] ? out[i + 1].start - r.minGap : Infinity
    if (c.end <= c.start) c.end = Math.min(c.start + 1500, Math.max(c.start + 1, ceiling))
    if (c.end - c.start < r.minDuration) c.end = Math.max(c.end, Math.min(c.start + r.minDuration, ceiling))
    if (c.end - c.start > r.maxDuration) c.end = c.start + r.maxDuration
  })
  return out
}

/** Re-wraps text into at most two balanced lines, breaking at spaces only. */
export function wrapText(text, maxLen = DEFAULT_RULES.maxLineLength) {
  const flat = String(text || '').replace(/\s*\n\s*/g, ' ').replace(/ {2,}/g, ' ').trim()
  if (visibleLength(flat) <= maxLen) return flat
  const words = flat.split(' ')
  if (words.length < 2) return flat
  let best = null
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const la = visibleLength(a)
    const lb = visibleLength(b)
    const over = Math.max(0, la - maxLen) + Math.max(0, lb - maxLen)
    const cost = over * 1000 + Math.abs(la - lb)
    if (!best || cost < best.cost) best = { cost, text: `${a}\n${b}` }
  }
  return best.text
}

export const wrapCues = (cues, maxLen) =>
  cues.map((c) => {
    const lines = c.text.split('\n')
    const needs = lines.length > 2 || lines.some((l) => visibleLength(l) > (maxLen || DEFAULT_RULES.maxLineLength))
    // dialogue cues ("- Hi\n- Hello") keep their line structure
    return needs && !lines.every((l) => /^\s*-/.test(l)) ? { ...c, text: wrapText(c.text, maxLen) } : c
  })

/** Splits cues whose text cannot fit in two lines into two consecutive cues (time shared by text length). */
export function splitLongCues(cues, maxLen = DEFAULT_RULES.maxLineLength) {
  const out = []
  for (const c of cues) {
    const flat = c.text.replace(/\s*\n\s*/g, ' ').trim()
    const words = flat.split(' ')
    if (visibleLength(flat) <= maxLen * 2 || words.length < 4 || c.end - c.start < 2000) {
      out.push(c)
      continue
    }
    const total = visibleLength(flat)
    let cut = 1
    let bestDiff = Infinity
    for (let i = 1; i < words.length; i++) {
      const la = visibleLength(words.slice(0, i).join(' '))
      const bonus = /[.!?…,;:]$/.test(words[i - 1]) ? total * 0.15 : 0 // prefer breaking after punctuation
      const diff = Math.abs(la - total / 2) - bonus
      if (diff < bestDiff) {
        bestDiff = diff
        cut = i
      }
    }
    const a = words.slice(0, cut).join(' ')
    const b = words.slice(cut).join(' ')
    const mid = Math.round(c.start + (c.end - c.start) * (visibleLength(a) / total))
    out.push({ ...c, end: mid - 20, text: wrapText(a, maxLen) }, { ...c, start: mid + 20, text: wrapText(b, maxLen) })
  }
  return out
}

export const tidyText = (cues) =>
  cues.map((c) => ({
    ...c,
    text: c.text
      .split('\n')
      .map((l) => l.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim())
      .filter(Boolean)
      .join('\n'),
  }))

/** Runs every safe fix in a sensible order and reports what changed. */
export function autoFix(cues, rules = {}) {
  const r = { ...DEFAULT_RULES, ...rules }
  const changes = []
  const step = (label, fn, input) => {
    const out = fn(input)
    const changed = out.length !== input.length || out.some((c, i) => c.start !== input[i].start || c.end !== input[i].end || c.text !== input[i].text)
    if (changed) changes.push(label)
    return out
  }
  let out = cues
  out = step('Sorted cues by start time', sortCues, out)
  out = step('Removed empty cues', removeEmpty, out)
  out = step('Cleaned spacing', tidyText, out)
  out = step('Split cues too long for two lines', (x) => splitLongCues(x, r.maxLineLength), out)
  out = step('Re-wrapped long lines', (x) => wrapCues(x, r.maxLineLength), out)
  out = step('Removed overlaps', (x) => fixOverlaps(x, r.minGap), out)
  out = step('Adjusted very short / very long durations', (x) => fixDurations(x, r), out)
  out = renumber(out)
  return { cues: out, changes }
}

/** "Name = නම" lines -> [{ from, to }] */
export const parseGlossary = (text) =>
  String(text || '')
    .split('\n')
    .map((l) => l.split(/=|→|->/))
    .filter((p) => p.length >= 2 && p[0].trim() && p[1].trim())
    .map((p) => ({ from: p[0].trim(), to: p[1].trim() }))
