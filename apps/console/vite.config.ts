import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// public/mockServiceWorker.js is only for the dev mock API; keep it out of builds.
function dropMockServiceWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'drop-mock-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      await rm(path.join(outDir, 'mockServiceWorker.js'), { force: true })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), dropMockServiceWorker()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // The reset link carries its token in the URL fragment; no-referrer keeps it, and the page URL,
  // out of Referer headers. Production hosting must send the same header (docs/ARCHITECTURE.md).
  server: { headers: { 'Referrer-Policy': 'no-referrer' } },
  preview: { headers: { 'Referrer-Policy': 'no-referrer' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
