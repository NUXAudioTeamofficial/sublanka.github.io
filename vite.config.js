import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE_PATH is "/" locally and "/<repo-name>/" on GitHub Pages
// (the deploy workflow sets it automatically from the repository name).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  let base = env.VITE_BASE_PATH || '/'
  if (!base.startsWith('/')) base = '/' + base
  if (!base.endsWith('/')) base += '/'
  return {
    base,
    plugins: [react()],
    server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
    preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
    build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 700 },
    test: { environment: 'node', include: ['tests/**/*.test.js'] },
  }
})
