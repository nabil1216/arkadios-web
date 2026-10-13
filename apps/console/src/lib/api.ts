export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface AuthHooks {
  getToken: () => string | null
  /** Try to get a fresh access token; resolves null when the session is gone. */
  refresh: () => Promise<string | null>
}

let hooks: AuthHooks = { getToken: () => null, refresh: async () => null }

export function configureApi(next: AuthHooks) {
  hooks = next
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Skip the bearer token and the 401 refresh retry (login, refresh). */
  anonymous?: boolean
}

async function send(path: string, opts: RequestOptions, token: string | null) {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`/api${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
  })
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await send(path, opts, opts.anonymous ? null : hooks.getToken())
  if (res.status === 401 && !opts.anonymous) {
    const token = await hooks.refresh()
    if (token) res = await send(path, opts, token)
  }
  if (!res.ok) {
    let message = res.statusText
    try {
      const data = (await res.json()) as { message?: string }
      if (data.message) message = data.message
    } catch {
      // no JSON body
    }
    throw new ApiError(res.status, message)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}
