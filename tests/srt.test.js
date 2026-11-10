import { describe, it, expect } from 'vitest'
import {
  parseSubtitle, toSrt, toVtt, parseTime, formatTime, validateCues, shiftCues, resyncCues,
  fixOverlaps, fixDurations, wrapText, autoFix, visibleLength, splitLongCues, parseGlossary,
} from '../src/lib/srt.js'

const GOOD = `1
00:00:01,000 --> 00:00:03,500
ආයුබෝවන්, කොහොමද?

2
00:00:04,000 --> 00:00:06,000
මම හොඳින් ඉන්නවා.
ඔයාට කොහොමද?
`

describe('time helpers', () => {
  it('parses and formats', () => {
    expect(parseTime('00:01:02,345')).toBe(62345)
    expect(parseTime('01:02.5')).toBe(62500)
    expect(parseTime('nope')).toBeNull()
    expect(formatTime(3723004)).toBe('01:02:03,004')
    expect(formatTime(62345, '.')).toBe('00:01:02.345')
  })
})

describe('parseSubtitle', () => {
  it('parses a clean SRT and round-trips', () => {
    const { cues, errors, format } = parseSubtitle(GOOD)
    expect(format).toBe('srt')
    expect(errors).toEqual([])
    expect(cues).toHaveLength(2)
    expect(cues[1].text).toBe('මම හොඳින් ඉන්නවා.\nඔයාට කොහොමද?')
    expect(cues[0]).toMatchObject({ index: 1, start: 1000, end: 3500 })
    expect(parseSubtitle(toSrt(cues)).cues.map((c) => [c.start, c.end, c.text])).toEqual(cues.map((c) => [c.start, c.end, c.text]))
  })
  it('handles BOM, CRLF, dots as separators and missing numbers', () => {
    const { cues, errors } = parseSubtitle('\uFEFF00:00:01.000 --> 00:00:02.000\r\nHello\r\n\r\n00:00:03,000 --> 00:00:04,000\r\nWorld\r\n')
    expect(errors).toEqual([])
    expect(cues.map((c) => c.text)).toEqual(['Hello', 'World'])
    expect(cues[0].index).toBeNull()
  })
  it('parses WebVTT with header and cue settings', () => {
    const { cues, format } = parseSubtitle('WEBVTT\n\nNOTE hi\n\nintro\n00:01.000 --> 00:02.000 align:start\nHello\n\n00:00:03.000 --> 00:00:04.000\nWorld')
    expect(format).toBe('vtt')
    expect(cues.map((c) => [c.start, c.text])).toEqual([[1000, 'Hello'], [3000, 'World']])
    expect(toVtt(cues).startsWith('WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000')).toBe(true)
  })
  it('reports unreadable timestamps and files without cues', () => {
    expect(parseSubtitle('1\n00:00:01,000 --> banana\nHi').errors[0].message).toMatch(/Unreadable timestamp/)
    expect(parseSubtitle('just some text').errors[0].message).toMatch(/No timestamp/)
  })
})

describe('validateCues', () => {
  it('passes a clean Sinhala file', () => {
    const { cues, errors } = parseSubtitle(GOOD)
    const { summary, issues } = validateCues(cues, { parseErrors: errors })
    expect(summary.errors).toBe(0)
    expect(summary.verdict).toBe('pass')
    expect(summary.sinhalaRatio).toBe(100)
    expect(issues.filter((i) => i.severity !== 'info')).toEqual([])
  })
  it('detects overlap, order, empty text, bad duration and untranslated text', () => {
    const { cues } = parseSubtitle(`1
00:00:05,000 --> 00:00:08,000
පළමු පේළිය

2
00:00:07,000 --> 00:00:09,000
This line was never translated

3
00:00:02,000 --> 00:00:03,000
තුන්වන

4
00:00:20,000 --> 00:00:19,000

`)
    const codes = validateCues(cues).issues.map((i) => `${i.cue}:${i.code}`)
    expect(codes).toContain('2:overlap')
    expect(codes).toContain('2:untranslated')
    expect(codes).toContain('3:out_of_order')
    expect(codes).toContain('4:negative_duration')
    expect(codes).toContain('4:empty_text')
    expect(validateCues(cues).summary.verdict).toBe('fail')
  })
  it('flags reading speed, long lines, gaps, encoding damage and Sinhala typing errors', () => {
    const cues = [
      { start: 0, end: 800, text: 'මෙය ඉතා දිගු වාක්‍යයක් වන අතර එය කියවීමට කිසිසේත්ම ප්‍රමාණවත් කාලයක් නොමැති තරම් දිගය' },
      { start: 400000, end: 402000, text: 'à¶¸à¶¸' },
      { start: 403000, end: 405000, text: 'මම ා යනවා' },
    ]
    const codes = validateCues(cues).issues.map((i) => `${i.cue}:${i.code}`)
    expect(codes).toEqual(expect.arrayContaining(['1:reading_speed', '1:long_line', '1:gap', '2:encoding', '3:orphan_sign']))
  })
  it('compares with the source and the glossary', () => {
    const source = [{ start: 0, end: 1000, text: 'Hello John' }, { start: 2000, end: 3000, text: 'Bye' }]
    const one = validateCues([{ start: 0, end: 1000, text: 'හෙලෝ' }], { source })
    expect(one.issues.map((i) => i.code)).toContain('cue_count')
    const two = validateCues([{ start: 0, end: 1000, text: 'හෙලෝ' }, { start: 2000, end: 3000, text: 'ගිහින් එන්නම්' }], { source, glossary: parseGlossary('John = ජෝන්') })
    expect(two.issues.map((i) => `${i.cue}:${i.code}`)).toContain('1:glossary')
  })
  it('counts Sinhala by visible characters, not code points', () => {
    expect(visibleLength('ක්‍රියා')).toBeLessThan('ක්‍රියා'.length)
    expect(visibleLength('<i>abc</i>')).toBe(3)
  })
})

describe('fixes', () => {
  const cues = [
    { start: 1000, end: 5000, text: 'A' },
    { start: 4000, end: 4200, text: 'B' },
    { start: 9000, end: 30000, text: 'C' },
  ]
  it('shifts without going below zero', () => {
    expect(shiftCues(cues, -2000).map((c) => c.start)).toEqual([0, 2000, 7000])
    expect(shiftCues(cues, 500)[0]).toMatchObject({ start: 1500, end: 5500 })
  })
  it('re-syncs linearly from two anchors', () => {
    const out = resyncCues(cues, { from: 1000, to: 2000 }, { from: 9000, to: 18000 })
    expect(out.map((c) => c.start)).toEqual([2000, 8000, 18000])
  })
  it('removes overlaps and repairs durations', () => {
    const noOverlap = fixOverlaps(cues)
    expect(noOverlap[0].end).toBe(3960)
    const fixed = fixDurations(noOverlap)
    expect(fixed[1].end - fixed[1].start).toBe(700)
    expect(fixed[2].end - fixed[2].start).toBe(7000)
    expect(validateCues(fixed, { lang: 'en' }).summary.errors).toBe(0)
  })
  it('wraps into two balanced lines at spaces only', () => {
    const wrapped = wrapText('මෙය දිගු උපසිරැසි පේළියක් වන අතර එය පේළි දෙකකට බෙදිය යුතුය', 30)
    expect(wrapped.split('\n')).toHaveLength(2)
    expect(wrapped.replace('\n', ' ')).toBe('මෙය දිගු උපසිරැසි පේළියක් වන අතර එය පේළි දෙකකට බෙදිය යුතුය')
    expect(wrapText('short')).toBe('short')
  })
  it('splits a cue that cannot fit in two lines and keeps all the words', () => {
    const long = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen'
    const out = splitLongCues([{ start: 0, end: 6000, text: long }], 20)
    expect(out).toHaveLength(2)
    expect(out.map((c) => c.text.replace(/\n/g, ' ')).join(' ')).toBe(long)
    expect(out[0].end).toBeLessThan(out[1].start)
  })
  it('autoFix produces a file with no errors and lists what it changed', () => {
    const messy = parseSubtitle(`3
00:00:07,000 --> 00:00:09,000
දෙවන  පේළිය .

1
00:00:01,000 --> 00:00:08,000
පළමු පේළිය

2
00:00:10,000 --> 00:00:11,000

`).cues
    const { cues: fixed, changes } = autoFix(messy)
    expect(fixed).toHaveLength(2)
    expect(fixed.map((c) => c.index)).toEqual([1, 2])
    expect(fixed[1].text).toBe('දෙවන පේළිය.')
    expect(changes.length).toBeGreaterThanOrEqual(3)
    expect(validateCues(fixed).summary.errors).toBe(0)
    expect(autoFix(fixed).changes).toEqual([])
  })
})
