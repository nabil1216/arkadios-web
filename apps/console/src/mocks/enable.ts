/**
 * Starts the mock API in the dev server only. `import.meta.env.DEV` is a
 * build-time constant, so production builds drop the dynamic import and the
 * whole src/mocks tree; scripts/check-bundle.mjs fails the build if it leaks.
 */
export async function enableMocking() {
  if (!import.meta.env.DEV) return
  const { worker } = await import('./browser')
  await worker.start({
    quiet: true,
    // Page navigations are not API calls; only warn about unmocked /api requests.
    onUnhandledFrame({ frame, defaults }) {
      const request = (frame.data as { request?: Request } | undefined)?.request
      if (request && new URL(request.url).pathname.startsWith('/api/')) defaults.warn()
    },
  })
}
