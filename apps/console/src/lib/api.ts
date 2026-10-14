import { filenameFromDisposition } from './download'

/** Sent on refresh and logout; the server answers 403 without it (on top of SameSite cookies). */
export const CSRF_HEADER = { name: 'X-Requested-With', value: 'arkadios-web' } as const

/** Platform API base (docs/ARCHITECTURE.md, Wire conventions). */
export const API_BASE = '/api/platform/v1'

/** RFC 9457 problem details, as the API returns them (docs/ARCHITECTURE.md, Wire conventions). */
export interface ProblemDetails {
  type?: string
  title: string
  status: number
  detail?: string
  traceId?: string
  /** Validation errors: field name to messages. */
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly problem: ProblemDetails
  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title)
    this.name = 'ApiError'
    this.problem = problem
  }
  get status() {
    return this.problem.status
  }
  get errors() {
    return this.problem.errors
  }
  get traceId() {
    return this.problem.traceId
  }
}

async function readProblem(res: Response): Promise<ProblemDetails> {
  const fallback: ProblemDetails = { title: res.statusText || 'Request failed', status: res.status }
  if (!res.headers.get('Content-Type')?.includes('json')) return fallback
  try {
    const body = (await res.json()) as Partial<ProblemDetails>
    if (typeof body.title !== 'string') return fallback
    return { ...body, title: body.title, status: typeof body.status === 'number' ? body.status : res.status }
  } catch {
    return fallback
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
  /** Add the CSRF header (refresh, logout). */
  csrf?: boolean
}

async function send(path: string, opts: RequestOptions, token: string | null) {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts.csrf) headers[CSRF_HEADER.name] = CSRF_HEADER.value
  return fetch(`${API_BASE}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
  })
}

/** Sends the request with the bearer token, retries once after a 401, and throws an ApiError for any failure. */
async function request(path: string, opts: RequestOptions): Promise<Response> {
  let res = await send(path, opts, opts.anonymous ? null : hooks.getToken())
  if (res.status === 401 && !opts.anonymous) {
    const token = await hooks.refresh()
    if (token) res = await send(path, opts, token)
  }
  if (!res.ok) throw new ApiError(await readProblem(res))
  return res
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await request(path, opts)
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

/**
 * A file the server sends: the bytes and the name from Content-Disposition (null when it sends none).
 * A browser link cannot carry the bearer token, so the console fetches the file and saves it itself.
 */
export async function apiDownload(path: string, opts: RequestOptions = {}): Promise<{ blob: Blob; filename: string | null }> {
  const res = await request(path, opts)
  return { blob: await res.blob(), filename: filenameFromDisposition(res.headers.get('Content-Disposition')) }
}
