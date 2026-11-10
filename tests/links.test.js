import { describe, it, expect } from 'vitest'
import { parseDriveId, driveDownloadUrl } from '../src/lib/drive.js'
import { parseYouTubeId } from '../src/lib/youtube.js'
import { parseQuery, moviePath, posterSrcSet } from '../src/lib/format.js'

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'

describe('parseDriveId', () => {
  it('accepts every common sharing-link shape', () => {
    for (const link of [
      ID,
      `https://drive.google.com/file/d/${ID}/view?usp=sharing`,
      `https://drive.google.com/file/d/${ID}/view?usp=drive_link`,
      `https://drive.google.com/open?id=${ID}`,
      `https://drive.google.com/uc?export=download&id=${ID}`,
      `https://drive.usercontent.google.com/download?id=${ID}&export=download`,
      `  https://drive.google.com/file/d/${ID}/edit  `,
    ]) expect(parseDriveId(link), link).toBe(ID)
  })
  it('rejects folders, other hosts and junk', () => {
    expect(parseDriveId(`https://drive.google.com/drive/folders/${ID}`)).toBeNull()
    expect(parseDriveId(`https://evil.example.com/file/d/${ID}/view`)).toBeNull()
    expect(parseDriveId(`https://drive.google.com.evil.io/file/d/${ID}/view`)).toBeNull()
    expect(parseDriveId('short')).toBeNull()
    expect(parseDriveId('')).toBeNull()
  })
  it('builds the direct download URL', () => {
    expect(driveDownloadUrl(ID)).toBe(`https://drive.google.com/uc?export=download&id=${ID}`)
  })
})

describe('parseYouTubeId', () => {
  it('accepts ids and URLs', () => {
    for (const v of ['dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s', 'https://youtu.be/dQw4w9WgXcQ?si=abc', 'youtube.com/embed/dQw4w9WgXcQ', 'https://m.youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'])
      expect(parseYouTubeId(v), v).toBe('dQw4w9WgXcQ')
  })
  it('rejects other sites and malformed ids', () => {
    expect(parseYouTubeId('https://vimeo.com/123456789')).toBeNull()
    expect(parseYouTubeId('https://youtube.com.evil.io/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseYouTubeId('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(parseYouTubeId('"><script>')).toBeNull()
  })
})

describe('search query parsing', () => {
  it('pulls out year and language', () => {
    expect(parseQuery('leo 2023 tamil')).toEqual({ text: 'leo', year: 2023, lang: 'ta' })
    expect(parseQuery('හින්දි')).toEqual({ text: '', year: null, lang: 'hi' })
    expect(parseQuery('  spider man  ')).toEqual({ text: 'spider man', year: null, lang: null })
    expect(parseQuery('2019')).toEqual({ text: '', year: 2019, lang: null })
  })
  it('builds paths and srcsets', () => {
    expect(moviePath({ id: 7, slug: 'leo-2023' })).toBe('/movie/7-leo-2023/')
    expect(posterSrcSet('https://image.tmdb.org/t/p/w500/abc.jpg')).toContain('/t/p/w185/abc.jpg 185w')
    expect(posterSrcSet('https://example.com/p.jpg')).toBeUndefined()
  })
})
