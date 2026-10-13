/** Starts the mock API in dev, or in a build made with VITE_MSW=true. */
export async function enableMocking() {
  if (!import.meta.env.DEV && import.meta.env.VITE_MSW !== 'true') return
  const { worker } = await import('./browser')
  await worker.start({ quiet: true })
}
