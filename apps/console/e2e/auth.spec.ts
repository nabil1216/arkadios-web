// Ported from docs/handoff/tests/console_ptest3.py, limited to what the
// console has now: sign-in, MFA, role menus, No access and the next redirect.
import { expect, test } from '@playwright/test'
import { accounts, CODE, menuLinks, menus, pageErrors, PASSWORD, signIn } from './helpers.ts'

test.describe('guard and sign-in', () => {
  test('a signed-out visit goes to sign in and remembers the page', async ({ page }) => {
    await page.goto('/overview')
    await expect(page).toHaveURL(/\/login\?next=%2Foverview$/)
  })

  test('a wrong password shows a message and stays on sign in', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(accounts.admin.email)
    await page.getByLabel('Password').fill('wrong')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('the form validates before it asks the server', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Enter a valid email address')).toBeVisible()
    await expect(page.getByText('Enter your password')).toBeVisible()
  })

  test('sign out returns to sign in and protected pages need sign in again', async ({ page }) => {
    await signIn(page, accounts.auditor)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/billing')
    await expect(page).toHaveURL(/\/login\?next=%2Fbilling$/)
  })

  test('a reload keeps the session (refresh cookie) and sign out ends it', async ({ page }) => {
    await signIn(page, accounts.billing)
    await page.reload()
    await expect(page.getByRole('navigation', { name: 'Platform' })).toBeVisible()
    await expect(page).toHaveURL(/\/billing$/)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.reload()
    await expect(page.getByLabel('Email')).toBeVisible()
  })

  test('the refresh cookie rotates: several reloads in a row keep the session', async ({ page }) => {
    await signIn(page, accounts.support)
    for (let i = 0; i < 3; i++) {
      await page.reload()
      await expect(page.getByRole('navigation', { name: 'Platform' })).toBeVisible()
    }
    await expect(page).toHaveURL(/\/tenants$/)
  })

  test('refresh and logout send X-Requested-With: arkadios-web', async ({ page }) => {
    const seen: Record<string, string | undefined> = {}
    page.on('request', (r) => {
      if (/\/auth\/(refresh|logout)$/.test(r.url())) seen[new URL(r.url()).pathname.split('/').pop()!] = r.headers()['x-requested-with']
    })
    await signIn(page, accounts.admin)
    await page.reload()
    await expect(page.getByRole('navigation', { name: 'Platform' })).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
    expect(seen).toEqual({ refresh: 'arkadios-web', logout: 'arkadios-web' })
  })

  test('the session is never written to sessionStorage or localStorage by the app', async ({ page }) => {
    await signIn(page, accounts.admin)
    const storage = await page.evaluate(() => ({
      session: Object.keys(sessionStorage),
      local: Object.keys(localStorage).filter((k) => k !== '__msw-cookie-store__'),
    }))
    expect(storage).toEqual({ session: [], local: [] })
  })
})

test.describe('forgot password', () => {
  test('opens from the sign-in page, validates, and confirms without naming the account', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    const dialog = page.getByRole('dialog', { name: 'Reset your password' })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Work email').fill('nope')
    await dialog.getByRole('button', { name: 'Send reset link' }).click()
    await expect(dialog.getByRole('alert')).toHaveText('Enter a valid email address.')

    await dialog.getByLabel('Work email').fill(accounts.billing.email)
    await dialog.getByRole('button', { name: 'Send reset link' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('If that email has an account, a reset link is on its way')).toBeVisible()
    // the sign-in form is untouched: still on step one, not asking for a code
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  test('shows the same message for an email with no account', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await page.getByLabel('Work email').fill('nobody@platform.example')
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByText('If that email has an account, a reset link is on its way')).toBeVisible()
  })

  test('carries over the email typed on the sign-in form, and Escape closes it', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(accounts.auditor.email)
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await expect(page.getByLabel('Work email')).toHaveValue(accounts.auditor.email)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('does not submit the sign-in form', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await page.getByLabel('Work email').fill(accounts.admin.email)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByText('Enter your password')).toHaveCount(0)
    await expect(page.getByText('Enter a valid email address')).toHaveCount(0)
  })
})

test.describe('MFA', () => {
  test('asks for a code, rejects a wrong one, and lands on the requested page', async ({ page }) => {
    const errors = pageErrors(page)
    await page.goto(`/login?next=${encodeURIComponent('/tenants')}`)
    await page.getByLabel('Email').fill(accounts.admin.email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByLabel('Authentication code')).toBeVisible()

    await page.getByLabel('Authentication code').fill('000000')
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByRole('alert')).toHaveText('That code is not right.')

    await page.getByLabel('Authentication code').fill(CODE)
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page).toHaveURL(/\/tenants$/)
    expect(errors).toEqual([])
  })

  test('the code must be six digits', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(accounts.admin.email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByLabel('Authentication code').fill('12')
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByText('Enter the 6-digit code')).toBeVisible()
  })

  for (const [role, account] of Object.entries(accounts)) {
    test(`${role} is asked for a code`, async ({ page }) => {
      await page.goto('/login')
      await page.getByLabel('Email').fill(account.email)
      await page.getByLabel('Password').fill(PASSWORD)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page.getByLabel('Authentication code')).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Platform' })).toHaveCount(0)
    })
  }
})

test.describe('role menus and landing pages', () => {
  test('super admin sees all 8 menus and who is signed in', async ({ page }) => {
    await signIn(page, accounts.admin)
    await expect(page).toHaveURL(/\/overview$/)
    await expect(menuLinks(page)).toHaveText([...menus.admin])
    const sidebar = page.getByRole('complementary', { name: 'Platform console' })
    await expect(sidebar).toContainText('Dana Whitfield')
    await expect(sidebar).toContainText('Super admin')
  })

  test('billing manager lands on Billing with the billing menus', async ({ page }) => {
    await signIn(page, accounts.billing)
    await expect(page).toHaveURL(/\/billing$/)
    await expect(menuLinks(page)).toHaveText([...menus.billing])
  })

  test('support lead lands on Tenants with the support menus', async ({ page }) => {
    await signIn(page, accounts.support)
    await expect(page).toHaveURL(/\/tenants$/)
    await expect(menuLinks(page)).toHaveText([...menus.support])
  })

  test('auditor sees the read-only menus', async ({ page }) => {
    await signIn(page, accounts.auditor)
    await expect(menuLinks(page)).toHaveText([...menus.auditor])
  })

  test('clicking a menu item opens its page', async ({ page }) => {
    await signIn(page, accounts.admin)
    await menuLinks(page).filter({ hasText: 'Plans and modules' }).click()
    await expect(page).toHaveURL(/\/plans$/)
    await expect(page.getByRole('heading', { name: 'Plans and modules' })).toBeVisible()
  })
})

test.describe('No access', () => {
  test('support lead is blocked from Transactions and Access control', async ({ page }) => {
    await signIn(page, accounts.support)
    await page.goto('/transactions')
    await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible()
    await expect(page.getByText('does not include Transactions')).toBeVisible()
    await page.goto('/access')
    await expect(page.getByText('does not include Access control')).toBeVisible()
  })

  test('the No access page links back to the role home page', async ({ page }) => {
    await signIn(page, accounts.support)
    await page.goto('/transactions')
    await page.getByRole('link', { name: 'Go to your home page' }).click()
    await expect(page).toHaveURL(/\/tenants$/)
  })

  test('a next that the role cannot open ends on No access', async ({ page }) => {
    await signIn(page, accounts.billing, { next: '/sms' })
    await expect(page).toHaveURL(/\/sms$/)
    await expect(page.getByText('does not include SMS')).toBeVisible()
  })
})

test.describe('next redirect', () => {
  test('goes to a safe relative next after sign in', async ({ page }) => {
    await signIn(page, accounts.auditor, { next: '/plans' })
    await expect(page).toHaveURL(/\/plans$/)
  })

  for (const evil of ['https://evil.example/', '//evil.example', '/\\evil.example', 'javascript:alert(1)']) {
    test(`ignores an unsafe next: ${evil}`, async ({ page }) => {
      await signIn(page, accounts.auditor, { next: evil })
      await expect(page).toHaveURL(/\/overview$/)
      expect(new URL(page.url()).origin).toBe('http://localhost:5174')
    })
  }

  test('a sign-in redirect keeps the query string of the page you asked for', async ({ page }) => {
    await page.goto('/tenants?status=trial')
    await expect(page).toHaveURL(/\/login\?next=%2Ftenants%3Fstatus%3Dtrial$/)
    await page.getByLabel('Email').fill(accounts.auditor.email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByLabel('Authentication code').fill(CODE)
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page).toHaveURL(/\/tenants\?status=trial$/)
  })
})
