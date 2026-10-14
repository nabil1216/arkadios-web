// Password reset (docs/ARCHITECTURE.md, section Password reset): the emailed link carries a
// single-use token in the URL fragment; the page moves it into memory and removes it from the address bar.
import { expect, test, type Page } from '@playwright/test'
import { accounts } from './helpers.ts'

const GOOD = 'correct horse battery'
const INVALID = 'This reset link is invalid or has expired.'

/** Requests a reset the way a user would. The mock API prints the "email" to the console. */
async function requestResetLink(page: Page, email: string = accounts.billing.email) {
  await page.goto('/login')
  return requestResetLinkOnThisPage(page, email)
}

/** Same, from the sign-in page that is already open (keeps the mock's in-memory state). */
async function requestResetLinkOnThisPage(page: Page, email: string = accounts.billing.email) {
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await page.getByLabel('Work email').fill(email)
  const emailPrinted = page.waitForEvent('console', (m) => m.text().includes('reset-password#token='))
  await page.getByRole('button', { name: 'Send reset link' }).click()
  const link = (await emailPrinted).text().split(': ').pop()!
  expect(new URL(link).hash).toMatch(/^#token=.+/) // the token is in the fragment, not the query
  expect(new URL(link).search).toBe('')
  return link
}

const tokenOf = (link: string) => new URL(link).hash.slice('#token='.length)

async function setPassword(page: Page, password: string, confirm = password) {
  await page.getByLabel('New password', { exact: true }).fill(password)
  await page.getByLabel('Confirm new password').fill(confirm)
  await page.getByRole('button', { name: 'Set new password' }).click()
}

test.describe('reset link', () => {
  test('sets a new password and links back to sign in without signing in', async ({ page }) => {
    const link = await requestResetLink(page)
    await page.goto(link)
    await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible()
    // the fragment is gone from the address bar as soon as the page has read it
    expect(new URL(page.url()).hash).toBe('')
    expect(page.url()).not.toContain(tokenOf(link))

    await setPassword(page, GOOD)
    await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible()
    await expect(page.getByText(/still be asked for an authentication code/)).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Platform' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  test('the token is in memory only: a reload loses it, and storage never holds it', async ({ page }) => {
    const link = await requestResetLink(page)
    await page.goto(link)
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible()
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
    expect(storage).not.toContain(tokenOf(link))

    await page.reload()
    await expect(page.getByRole('alert')).toHaveText(INVALID)
    await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0)
  })

  test('the token is never sent in a URL or a Referer header', async ({ page }) => {
    const link = await requestResetLink(page)
    const token = tokenOf(link)
    const seen: string[] = []
    page.on('request', (r) => seen.push(r.url(), r.headers().referer ?? ''))
    await page.goto(link)
    await setPassword(page, GOOD)
    await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible()
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.filter((s) => s.includes(token))).toEqual([])
  })

  test('a token works once', async ({ page }) => {
    const link = await requestResetLink(page)
    await page.goto(link)
    await setPassword(page, GOOD)
    await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible()

    const second = await page.evaluate(async (token) => {
      const res = await fetch('/api/platform/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: 'another correct horse' }),
      })
      return { status: res.status, body: await res.json() }
    }, tokenOf(link))
    expect(second.status).toBe(400)
    expect(second.body.detail).toBe(INVALID)
  })

  test('a newer request invalidates the earlier link', async ({ page }) => {
    // The mock remembers the newest token per user in page memory, so both requests and the
    // check happen in one page load (Vitest covers the rule across loads).
    const first = await requestResetLink(page)
    await page.waitForTimeout(20) // tokens are ordered by issue time
    const second = await requestResetLinkOnThisPage(page)
    const redeem = (token: string) =>
      page.evaluate(async (t) => {
        const res = await fetch('/api/platform/v1/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: t, newPassword: 'a correct horse battery' }),
        })
        return res.status
      }, token)
    expect(await redeem(tokenOf(first))).toBe(400)
    expect(await redeem(tokenOf(second))).toBe(204)
  })
})

test.describe('invalid links', () => {
  test('no token: a generic invalid-link state with a way back', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page.getByRole('alert')).toHaveText(INVALID)
    await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0)
    await page.getByRole('link', { name: 'Back to sign in' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  for (const [name, token] of [
    ['garbage', 'not-a-real-token'],
    ['expired', 'mock-reset.u3.1000.abc'],
    ['for an unknown user', 'mock-reset.u99.' + Date.now() + '.abc'],
  ] as const) {
    test(`a ${name} token ends in the same generic state`, async ({ page }) => {
      await page.goto(`/reset-password#token=${token}`)
      await setPassword(page, GOOD)
      await expect(page.getByRole('alert')).toHaveText(INVALID)
      await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0)
    })
  }
})

test.describe('new password rules', () => {
  test('needs 12 characters and a matching confirmation before asking the server', async ({ page }) => {
    let calls = 0
    page.on('request', (r) => {
      if (r.url().endsWith('/auth/reset-password')) calls++
    })
    await page.goto('/reset-password#token=whatever')

    await setPassword(page, 'too-short')
    await expect(page.getByText('Use at least 12 characters.')).toBeVisible()

    await setPassword(page, GOOD, GOOD + '!')
    await expect(page.getByText('Passwords do not match.')).toBeVisible()
    expect(calls).toBe(0)
  })

  test('a weak password from the server shows on the field and the link stays usable', async ({ page }) => {
    const link = await requestResetLink(page)
    await page.goto(link)

    await setPassword(page, 'Password1234')
    await expect(page.getByRole('alert')).toHaveText('This password has appeared in a data breach. Choose another.')
    await expect(page.getByLabel('New password', { exact: true })).toHaveAttribute('aria-invalid', 'true')

    await page.getByLabel('New password', { exact: true }).fill('')
    await page.getByLabel('Confirm new password').fill('')
    await setPassword(page, GOOD)
    await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible()
  })

  test('the account email is not accepted as the password', async ({ page }) => {
    const link = await requestResetLink(page, accounts.admin.email)
    await page.goto(link)
    await setPassword(page, accounts.admin.email)
    await expect(page.getByRole('alert')).toHaveText('Do not use your email address as your password.')
  })
})

test.describe('Referrer-Policy', () => {
  test('the dev server sends no-referrer with the reset page', async ({ page }) => {
    const response = await page.goto('/reset-password')
    expect(await response!.headerValue('referrer-policy')).toBe('no-referrer')
  })
})
