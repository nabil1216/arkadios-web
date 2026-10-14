import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, apiDownload, ApiError } from './api'

function respond(body: BodyInit | null, init: ResponseInit) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, init)))
}

afterEach(() => vi.unstubAllGlobals())

describe('api errors', () => {
  it('reads application/problem+json into an ApiError', async () => {
    respond(
      JSON.stringify({
        type: 'https://errors.example/validation',
        title: 'One or more validation errors occurred.',
        status: 400,
        traceId: 'abc-123',
        errors: { name: ['Name is required.'] },
      }),
      { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
    )
    const error = await api('/tenants', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      traceId: 'abc-123',
      errors: { name: ['Name is required.'] },
      message: 'One or more validation errors occurred.',
    })
  })

  it('uses detail as the message when the problem has one', async () => {
    respond(JSON.stringify({ title: 'Sign-in failed', status: 401, detail: 'Incorrect email or password.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/problem+json' },
    })
    await expect(api('/x', { anonymous: true })).rejects.toThrow('Incorrect email or password.')
  })

  it('falls back to the status text when the body is not a problem', async () => {
    respond('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway', headers: { 'Content-Type': 'text/html' } })
    await expect(api('/x', { anonymous: true })).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' })
  })

  it('falls back when a JSON body has no title', async () => {
    respond(JSON.stringify({ message: 'nope' }), { status: 500, statusText: 'Server Error', headers: { 'Content-Type': 'application/json' } })
    await expect(api('/x', { anonymous: true })).rejects.toMatchObject({ status: 500, message: 'Server Error' })
  })

  it('returns undefined for 204', async () => {
    respond(null, { status: 204 })
    await expect(api('/x', { method: 'POST', body: {}, anonymous: true })).resolves.toBeUndefined()
  })

  it('calls the platform base path', async () => {
    respond(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
    await api('/permissions', { anonymous: true })
    expect(fetch).toHaveBeenCalledWith('/api/platform/v1/permissions', expect.anything())
  })
})

describe('apiDownload', () => {
  it('returns the bytes and the file name the server sends', async () => {
    respond('<html>invoice</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html', 'Content-Disposition': 'attachment; filename="invoice-2026-09-abc.html"' },
    })
    const { blob, filename } = await apiDownload('/bills/abc/invoice')
    expect(filename).toBe('invoice-2026-09-abc.html')
    expect(await blob.text()).toBe('<html>invoice</html>')
    expect(fetch).toHaveBeenCalledWith('/api/platform/v1/bills/abc/invoice', expect.objectContaining({ method: 'GET', credentials: 'include' }))
  })

  it('has no file name when the server sends none', async () => {
    respond('x', { status: 200 })
    expect((await apiDownload('/x')).filename).toBeNull()
  })

  it('throws the problem when the server refuses', async () => {
    respond(JSON.stringify({ title: 'Conflict', status: 409, detail: 'Only a paid bill has an invoice.' }), {
      status: 409,
      headers: { 'Content-Type': 'application/problem+json' },
    })
    await expect(apiDownload('/bills/abc/invoice')).rejects.toMatchObject({ status: 409, message: 'Only a paid bill has an invoice.' })
  })
})
