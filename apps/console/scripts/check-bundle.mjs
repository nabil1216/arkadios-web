// Fails the build when the mock API (MSW, handlers, seed data) ends up in dist.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist', import.meta.url))
const markers = ['mock-access.', 'mock-refresh.', 'mock-reset.', 'mock-support.', 'mock-handoff.', 'tenant_northwind', 'Sample invoice from the platform console demo', '[mock email]', '__msw-cookie-store__', 'demo-1234', 'mockServiceWorker', 'msw/browser']

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* walk(path)
    else yield path
  }
}

const problems = []
for (const file of walk(dist)) {
  if (/mockServiceWorker/i.test(file)) problems.push(`${file}: mock service worker script`)
  if (!/\.(js|css|html|map)$/.test(file)) continue
  const text = readFileSync(file, 'utf8')
  for (const m of markers) if (text.includes(m)) problems.push(`${file}: contains "${m}"`)
}

if (problems.length) {
  console.error('Mock API found in the production bundle:\n' + problems.map((p) => '  ' + p).join('\n'))
  process.exit(1)
}
console.log('check-bundle: no mock API in dist')
