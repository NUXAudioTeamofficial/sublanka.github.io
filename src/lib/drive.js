// Google Drive helpers. Files must be shared as "Anyone with the link — Viewer".

const ID_RE = /^[A-Za-z0-9_-]{20,}$/

/** Accepts a sharing URL or a bare file id; returns the file id or null. */
export function parseDriveId(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  if (ID_RE.test(raw)) return raw
  let url
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (!/(^|\.)google\.com$/i.test(url.hostname) && !/(^|\.)googleusercontent\.com$/i.test(url.hostname)) return null
  if (/\/folders\//.test(url.pathname)) return null // folders cannot be downloaded as one file
  const fromPath = url.pathname.match(/\/(?:file\/)?d\/([A-Za-z0-9_-]{20,})/)
  if (fromPath) return fromPath[1]
  const fromQuery = url.searchParams.get('id')
  if (fromQuery && ID_RE.test(fromQuery)) return fromQuery
  return null
}

export const driveDownloadUrl = (id) => `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`
export const driveViewUrl = (id) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`
