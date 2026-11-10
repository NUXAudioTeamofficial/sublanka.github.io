#!/usr/bin/env node
/**
 * Subtitle build helper — turns a reference soundtrack file into a published
 * Sinhala .srt/.vtt pair without ever re-typing a timestamp.
 *
 *   node scripts/subtitle-build.mjs content/public-domain/<slug> [--dump]
 *
 * Reads  <dir>/source.<lang>.srt   reference cues (timings only are used)
 *        <dir>/<out>.srt.txt       "<cue number><TAB>one or two lines of text"
 * Writes <dir>/<out>.srt, <dir>/<out>.vtt and prints the repo's own
 * quality report (src/lib/srt.js). Exits non-zero when the file has errors.
 *
 * --dump prints the reference text in the same "<number><TAB>text" shape,
 * ready to be translated.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseSubtitle, toSrt, toVtt, validateCues } from '../src/lib/srt.js'

const dir = process.argv[2]
const out = process.argv[3] && !process.argv[3].startsWith('-') ? process.argv[3] : 'si'
if (!dir) {
  console.error('usage: node scripts/subtitle-build.mjs <content-dir> [out-name] [--dump]')
  process.exit(2)
}

const sourceFile = join(dir, 'source.en.srt')
if (!existsSync(sourceFile)) {
  console.error(`missing ${sourceFile}`)
  process.exit(2)
}
const source = parseSubtitle(readFileSync(sourceFile, 'utf8'))
if (source.errors.length) {
  console.error('reference file could not be parsed:')
  source.errors.forEach((e) => console.error(`  line ${e.line}: ${e.message}`))
  process.exit(2)
}

if (process.argv.includes('--dump')) {
  process.stdout.write(source.cues.map((c) => `${c.id}\t${c.text.replace(/\n/g, ' ⏎ ')}`).join('\n') + '\n')
  process.exit(0)
}

const translations = new Map()
const txt = readFileSync(join(dir, `${out}.srt.txt`), 'utf8').replace(/\r\n?/g, '\n')
for (const line of txt.split('\n')) {
  if (!line.trim()) continue
  const tab = line.indexOf('\t')
  if (tab < 0) {
    console.error(`bad line (expected "number<TAB>text"): ${line.slice(0, 60)}`)
    process.exit(2)
  }
  const n = Number(line.slice(0, tab).trim())
  if (!Number.isInteger(n)) {
    console.error(`bad cue number: ${line.slice(0, 60)}`)
    process.exit(2)
  }
  translations.set(n, line.slice(tab + 1).split(' ⏎ ').join('\n'))
}

/**
 * Re-flow a cue onto at most `maxLines` balanced lines. Splitting happens at the
 * space nearest the middle, so a three-line cue becomes two lines that read well
 * on a phone instead of three cramped ones.
 */
export function balanceCue(text, maxLines = 2) {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length <= maxLines) return lines.join('\n')
  const words = lines.join(' ').split(/\s+/)
  if (words.length < 3) return lines.join(' ')
  const perLine = Math.ceil(words.length / maxLines)
  const out = []
  for (let i = 0; i < words.length; i += perLine) out.push(words.slice(i, i + perLine).join(' '))
  return out.join('\n')
}

const missing = source.cues.filter((c) => !translations.has(c.id)).map((c) => c.id)
const extra = [...translations.keys()].filter((n) => n > source.cues.length)
if (missing.length) console.warn(`! ${missing.length} cue(s) not translated: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? '…' : ''}`)
if (extra.length) console.warn(`! translations for cues that do not exist: ${extra.join(', ')}`)

const cues = source.cues.map((c) => ({ ...c, text: balanceCue(translations.get(c.id) ?? '') }))
const report = validateCues(cues, { lang: out === 'si' ? 'si' : 'en', source: source.cues })

writeFileSync(join(dir, `${out}.srt`), toSrt(cues))
writeFileSync(join(dir, `${out}.vtt`), toVtt(cues))

const s = report.summary
console.log(`${dir}/${out}.srt — ${s.cues} cues, ${Math.round(s.duration / 60000)} min`)
console.log(`score ${s.score}/100 · ${s.errors} errors · ${s.warnings} warnings · ${s.infos} notes · Sinhala ${s.sinhalaRatio}% · ${s.verdict.toUpperCase()}`)
const byCode = new Map()
for (const i of report.issues) {
  const key = `${i.severity} ${i.code}`
  if (!byCode.has(key)) byCode.set(key, [])
  byCode.get(key).push(i.cue ?? '—')
}
for (const [key, cues_] of [...byCode].sort()) {
  console.log(`  ${key.padEnd(24)} ${cues_.length}${cues_.length <= 12 ? ` (cue ${cues_.join(', ')})` : ''}`)
}
process.exit(s.errors ? 1 : 0)
