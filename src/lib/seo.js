import { useEffect } from 'react'
import { SITE_URL } from './config.js'

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!content) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!href) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export const absoluteUrl = (path = '/') => SITE_URL + String(path).replace(/^\/+/, '')

/**
 * Per-page <title>, description, Open Graph, canonical and (optional) JSON-LD.
 * The same tags are also written into static HTML at build time by scripts/postbuild.mjs
 * so that crawlers and chat-app link previews that do not run JavaScript still see them.
 */
export function useSeo({ title, description, path, image, type = 'website', jsonLd, noindex = false, siteName = 'SubLanka' }) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : ''
  useEffect(() => {
    const fullTitle = title ? `${title} | ${siteName}` : `${siteName} — සිංහල උපසිරැසි ලෝකය`
    document.title = fullTitle
    const url = path != null ? absoluteUrl(path) : null
    const img = image || absoluteUrl('og-image.png')
    setMeta('name', 'description', description)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : null)
    setMeta('property', 'og:site_name', siteName)
    setMeta('property', 'og:type', type)
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:image', img)
    setMeta('name', 'twitter:card', 'summary_large_image')
    setLink('canonical', noindex ? null : url)

    document.head.querySelectorAll('script[data-seo-ld]').forEach((n) => n.remove())
    if (ld) {
      const s = document.createElement('script')
      s.type = 'application/ld+json'
      s.dataset.seoLd = '1'
      s.textContent = ld
      document.head.appendChild(s)
    }
  }, [title, description, path, image, type, ld, noindex, siteName])
}
