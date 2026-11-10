import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE_PATH is "/" locally and "/<repo-name>/" on GitHub Pages
// (the deploy workflow sets it automatically from the repository name).
/**
 * Fonts are the biggest asset on the site, and swapping them in after the text has
 * already been painted is what pushes the footer down (CLS). `font-display: optional`
 * removes the swap entirely: the browser uses the font only if it is ready in time,
 * otherwise it keeps the fallback for that page view. The faces we rely on are
 * preloaded by scripts/postbuild.mjs so they normally do arrive in time.
 * @fontsource ships `swap`, so it is rewritten here on the built CSS.
 */
function fontDisplay(mode) {
  return {
    name: 'sublanka:font-display',
    generateBundle(_options, bundle) {
      if (mode !== 'optional') return
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.css') && typeof file.source === 'string') {
          file.source = file.source.replace(/font-display:\s*swap/gi, 'font-display: optional')
        }
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  let base = env.VITE_BASE_PATH || '/'
  if (!base.startsWith('/')) base = '/' + base
  if (!base.endsWith('/')) base += '/'
  return {
    base,
    plugins: [react(), fontDisplay(env.VITE_FONT_DISPLAY || 'optional')],
    server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
    preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
    build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 700 },
    test: { environment: 'node', include: ['tests/**/*.test.js'] },
  }
})
