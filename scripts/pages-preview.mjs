// Local stand-in for GitHub Pages: serves ./dist under the same sub-path, with
// the same rules (folder -> index.html, missing file -> 404.html with status 404).
//   VITE_BASE_PATH=/sublanka/ npm run build && node scripts/pages-preview.mjs /sublanka/ 4173
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const base = (process.argv[2] || '/').replace(/\/*$/, '/')
const port = Number(process.argv[3] || 4173)
const root = path.resolve('dist')
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' }

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const send = async (file, status = 200) => {
    res.writeHead(status, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
    res.end(await readFile(file))
  }
  try {
    if (!url.pathname.startsWith(base)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      return res.end('Outside the site base path')
    }
    let file = path.join(root, decodeURIComponent(url.pathname.slice(base.length)))
    if (!file.startsWith(root)) throw new Error('bad path')
    const info = await stat(file).catch(() => null)
    if (info?.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        res.writeHead(301, { Location: url.pathname + '/' + url.search })
        return res.end()
      }
      file = path.join(file, 'index.html')
    }
    if (await stat(file).catch(() => null)) return await send(file)
    return await send(path.join(root, '404.html'), 404)
  } catch {
    res.writeHead(500)
    res.end('error')
  }
}).listen(port, '0.0.0.0', () => console.log(`GitHub Pages preview: http://localhost:${port}${base}`))
