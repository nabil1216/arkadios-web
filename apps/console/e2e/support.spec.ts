// Ported from docs/handoff/tests/console_ptest.py ("sign in as -> banner -> end session") and console_ptest3.py (the support
// lead signs in as a user and ends the session; the Auditor sees Support access). Differences from the demo, by design: the
// reason needs 20 characters, a length of 15, 30 or 60 minutes and read only or edit access are chosen, one-time handoff codes open
// the workspace in a new tab, a session can be revoked, and "persists after reload" is ported as navigate away and back, because
// the mock API keeps its data in the page.
import { expect, test, type Page } from '@playwright/test'
import { accounts, menuLinks, overlayBeforeContent, pageErrors, pressWithKeyboard, signIn, slowContentFade, switchTo, type Account } from './helpers.ts'

const REASON = 'Checklist did not create tasks after a stage move'
const NOTICE = "Do not type passwords or client personal data. The client's admins will see this reason."

const rows = (page: Page) => page.locator('tr[data-session]')
const startDialog = (page: Page) => page.getByRole('dialog', { name: 'Start a support session' })
const banner = (page: Page) => page.locator('[role="status"]').filter({ hasText: 'Support session:' })
const toast = (page: Page, text: string | RegExp) => expect(page.locator('[data-sonner-toast]').filter({ hasText: text })).toBeVisible()
const confirm = (page: Page, title: string | RegExp) => page.getByRole('alertdialog', { name: title })

async function openSupport(page: Page, account: Account = accounts.support) {
  await signIn(page, account, { next: '/support' })
  await expect(page.getByRole('heading', { name: 'Support access', level: 1 })).toBeVisible()
  await expect(rows(page).first()).toBeVisible()
}

async function goTo(page: Page, menu: string, heading: string) {
  await menuLinks(page).filter({ hasText: menu }).click()
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
}

/** Remembers the address window.open is given, so a test can use the one-time code the way a second tab would. */
async function recordOpenedUrl(page: Page) {
  await page.evaluate(() => {
    const real = window.open
    window.open = (...args: Parameters<typeof window.open>) => {
      ;(window as unknown as { __opened: string }).__opened = String(args[0])
      return real.apply(window, args)
    }
  })
}
const openedUrl = (page: Page) => page.evaluate(() => (window as unknown as { __opened?: string }).__opened ?? '')

/** Fills and sends the Start dialog that is open. */
async function submitStart(page: Page, opts: { reason?: string; minutes?: 15 | 30 | 60; edit?: boolean } = {}) {
  const dialog = startDialog(page)
  await dialog.getByLabel('Reason').fill(opts.reason ?? REASON)
  if (opts.minutes) await dialog.getByRole('radio', { name: `${opts.minutes} minutes` }).check()
  if (opts.edit) await dialog.getByRole('radio', { name: 'Can make changes' }).check()
  await dialog.getByRole('button', { name: 'Start support session' }).click()
}

/** From the Tenants page: Sign in as on a tenant, then start. Returns once the banner is up. */
async function startFromTenants(page: Page, tenant = 'Cobalt Ridge Wealth', opts: Parameters<typeof submitStart>[1] = {}) {
  await goTo(page, 'Tenants', 'Tenants')
  await page.getByRole('button', { name: `Sign in as a user of ${tenant}` }).click()
  await expect(startDialog(page).getByLabel('Sign in as')).not.toHaveValue('')
  await submitStart(page, opts)
  await expect(banner(page)).toBeVisible()
}

test.describe('the page', () => {
  test('the Support access menu opens it', async ({ page }) => {
    await signIn(page, accounts.support)
    await menuLinks(page).filter({ hasText: 'Support access' }).click()
    await expect(page).toHaveURL(/\/support$/)
    await expect(page.getByRole('heading', { name: 'Support access', level: 1 })).toBeVisible()
    await expect(page.getByText('Platform staff can sign in as a tenant user to troubleshoot, without ever seeing a password.')).toBeVisible()
  })

  test('shows the rules and the two past sessions, ended', async ({ page }) => {
    const errors = pageErrors(page)
    await openSupport(page)
    await expect(page.getByText("A reason is required, and it is saved with the session. The client's admins can see it.")).toBeVisible()
    await expect(page.getByText('A banner stays on screen for the whole session.')).toBeVisible()
    await expect(page.getByText(/cannot be extended\. Signing out of the console does not end it\./)).toBeVisible()
    await expect(rows(page)).toHaveCount(2)
    await expect(rows(page).first()).toContainText('Omar Haddad')
    await expect(rows(page).first()).toContainText('Arkadios Home Office')
    await expect(rows(page).first()).toContainText('Priya Okafor')
    await expect(rows(page).first()).toContainText('Checklist not creating tasks after a stage move')
    await expect(rows(page).first()).toContainText('Ended by Omar Haddad')
    await expect(page.getByRole('combobox', { name: 'Filter by status' })).toHaveValue('all')
    expect(errors).toEqual([])
  })

  test('filters by status and says when nothing matches', async ({ page }) => {
    await openSupport(page)
    await page.getByRole('combobox', { name: 'Filter by status' }).selectOption('revoked')
    await expect(page).toHaveURL(/status=revoked/)
    await expect(page.getByText('No sessions match. Choose another status.')).toBeVisible()
    await page.getByRole('combobox', { name: 'Filter by status' }).selectOption('ended')
    await expect(rows(page)).toHaveCount(2)
  })
})

test.describe('Sign in as, and Start support session', () => {
  test('the support lead can sign in as a user, and cannot create a tenant', async ({ page }) => {
    await signIn(page, accounts.support)
    await expect(page.getByRole('button', { name: /^Sign in as a user of / }).first()).toBeEnabled() // ptest3: "support can sign in as a user"
    await expect(page.getByRole('button', { name: /Create tenant/ })).toHaveCount(0)
  })

  test('is turned off for a suspended tenant, with a hint, and does nothing', async ({ page }) => {
    await signIn(page, accounts.support)
    const off = page.getByRole('button', { name: 'Sign in as a user of Sterling Hollow Family Office' })
    await expect(off).toHaveAttribute('aria-disabled', 'true')
    await expect(off).toHaveAttribute('title', 'Support sessions are only available for active and trial tenants.')
    await off.click({ force: true })
    await expect(startDialog(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sign in as a user of Marlow & Finch Partners' })).not.toHaveAttribute('aria-disabled') // trial is allowed
  })

  test('opens for the tenant of the row, with the demo\'s fields and the notice about the reason', async ({ page }) => {
    await signIn(page, accounts.support)
    await page.getByRole('button', { name: 'Sign in as a user of Northwind Advisory Group' }).click()
    const dialog = startDialog(page)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Tenant')).toHaveValue(/.+/)
    await expect(dialog.getByLabel('Tenant').locator('option:checked')).toHaveText('Northwind Advisory Group')
    await expect(dialog.getByLabel('Sign in as').locator('option')).toHaveText(['Elena Marsh', 'Tom Hadley'])
    await expect(dialog.getByText("You act with this user's permissions, without their password.")).toBeVisible()
    await expect(dialog.getByText(NOTICE)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  })

  test('offers 15, 30 and 60 minutes with 30 chosen, read only chosen, and no custom time', async ({ page }) => {
    await openSupport(page)
    await page.getByRole('button', { name: 'Start support session' }).click()
    const dialog = startDialog(page)
    await expect(dialog.getByRole('radiogroup', { name: 'Length' }).getByRole('radio')).toHaveCount(3)
    await expect(dialog.getByRole('radio', { name: '30 minutes' })).toBeChecked()
    await expect(dialog.getByRole('radio', { name: 'Read only' })).toBeChecked()
    await expect(dialog.getByRole('spinbutton')).toHaveCount(0)
    await expect(dialog.getByLabel('Tenant').locator('option')).toHaveCount(5) // active and trial tenants only
  })

  test('needs a reason of 20 characters', async ({ page }) => {
    await signIn(page, accounts.support)
    await page.getByRole('button', { name: 'Sign in as a user of Cobalt Ridge Wealth' }).click()
    await startDialog(page).getByLabel('Reason').fill('too short')
    await startDialog(page).getByRole('button', { name: 'Start support session' }).click()
    await expect(startDialog(page).getByText('Describe why you need access, in at least 20 characters.')).toBeVisible() // ptest: "reason required"
    await expect(startDialog(page).getByLabel('Reason')).toBeFocused()
    await expect(banner(page)).toHaveCount(0)
  })

  test('starts a session: the banner appears on every page, and Start asks to end the first', async ({ page }) => {
    await openSupport(page)
    await startFromTenants(page)
    await expect(banner(page)).toContainText('signed in as')
    await expect(banner(page)).toContainText('at Cobalt Ridge Wealth (Read only)')
    await expect(banner(page)).toContainText(/Time left (29|30):\d\d/)
    await goTo(page, 'Support access', 'Support access')
    await expect(banner(page)).toHaveCount(1) // ptest: "banner persists across pages"
    await expect(rows(page)).toHaveCount(3)
    await expect(rows(page).first()).toContainText('Active')

    await page.getByRole('button', { name: 'Start support session' }).click()
    const dialog = startDialog(page)
    await expect(dialog).toContainText('already open') // ptest: "second session blocked"
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await dialog.getByRole('button', { name: 'End that session' }).click() // ptest: "session ended"
    await expect(dialog.getByLabel('Reason')).toBeVisible() // and the form carries on
    await expect(banner(page)).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(rows(page).first()).toContainText('Ended by Omar Haddad')
    await expect(page.locator('tr[data-status="active"]')).toHaveCount(0) // ptest: "sessions table has live->ended"
    await expect(rows(page)).toHaveCount(3)
  })

  test('the support lead ends the session from the banner', async ({ page }) => {
    await openSupport(page)
    await startFromTenants(page)
    await expect(banner(page).getByRole('button', { name: 'End session' })).toBeVisible() // ptest3: "banner with End session"
    await banner(page).getByRole('button', { name: 'End session' }).click()
    await toast(page, 'Support session ended')
    await expect(banner(page)).toHaveCount(0) // ptest3: "support lead ends the session"
  })

  test('the owner ends it from its row, without a question', async ({ page }) => {
    await openSupport(page)
    await startFromTenants(page)
    await goTo(page, 'Support access', 'Support access')
    await page.getByRole('button', { name: 'End session on Cobalt Ridge Wealth' }).click()
    await toast(page, 'Support session ended')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(banner(page)).toHaveCount(0)
  })

  test('a session that can make changes asks first, and says what stays blocked', async ({ page }) => {
    await openSupport(page)
    await goTo(page, 'Tenants', 'Tenants')
    await page.getByRole('button', { name: 'Sign in as a user of Cobalt Ridge Wealth' }).click()
    await expect(startDialog(page).getByLabel('Sign in as')).not.toHaveValue('')
    await submitStart(page, { edit: true })
    const ask = confirm(page, 'Start a session that can make changes?')
    await expect(ask).toBeVisible()
    await expect(ask.getByRole('listitem')).toHaveCount(6)
    await expect(ask).toContainText('Exporting data')
    await expect(ask).toContainText('Changing passwords or MFA')
    await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await ask.getByRole('button', { name: 'Cancel' }).click()
    await expect(startDialog(page).getByLabel('Reason')).toHaveValue(REASON) // back in the form with what was typed
    await expect(banner(page)).toHaveCount(0)
    await startDialog(page).getByRole('button', { name: 'Start support session' }).click()
    await confirm(page, 'Start a session that can make changes?').getByRole('button', { name: 'Start with edit access' }).click()
    await expect(banner(page)).toContainText('(Can edit)')
  })
})

test.describe('the handoff to the workspace', () => {
  test('opens the workspace in a new tab with the code in the fragment, which is cleared at once; the token is never in an address', async ({ page, context }) => {
    const requests: string[] = []
    context.on('request', (r) => requests.push(r.url()))
    await openSupport(page)
    await recordOpenedUrl(page)
    await goTo(page, 'Tenants', 'Tenants')
    await page.getByRole('button', { name: 'Sign in as a user of Northwind Advisory Group' }).click()
    await expect(startDialog(page).getByLabel('Sign in as')).not.toHaveValue('')
    const popup = context.waitForEvent('page')
    await submitStart(page, { minutes: 15 })
    const workspace = await popup

    const url = await openedUrl(page)
    expect(new URL(url).pathname).toBe('/mock-workspace/support-handoff')
    expect(new URL(url).hash).toMatch(/^#code=mock-handoff\./)
    expect(new URL(url).search).toBe('')

    const workspaceBanner = workspace.locator('[role="status"]')
    await expect(workspaceBanner).toContainText('Omar Haddad is signed in as Elena Marsh (Read only). Reason: Checklist did not create tasks after a stage move')
    await expect(workspaceBanner).toContainText(/Time left (14|15):\d\d/) // the chosen 15 minutes
    await expect(workspaceBanner.getByRole('button', { name: 'End session' })).toBeVisible()
    expect(workspace.url()).not.toContain('#') // the fragment is cleared
    expect(workspace.url()).not.toContain('mock-handoff')
    expect(page.url()).not.toContain('mock-handoff')
    expect(requests.filter((u) => u.includes('mock-support.') || u.includes('access_token'))).toEqual([]) // no token in any address
    expect(await workspace.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/mock-support|mock-handoff/)
    await expect(banner(page)).toContainText('at Northwind Advisory Group (Read only)')
  })

  test('ending the session from the console stops the workspace', async ({ page, context }) => {
    await openSupport(page)
    const popup = context.waitForEvent('page')
    await startFromTenants(page)
    const workspace = await popup
    await expect(workspace.locator('[role="status"]')).toContainText('is signed in as')
    await banner(page).getByRole('button', { name: 'End session' }).click()
    await expect(workspace.locator('[role="status"]')).toContainText('This support session has ended.', { timeout: 10_000 })
    await expect(workspace.getByRole('button', { name: 'End session' })).toHaveCount(0)
  })

  test('ending it from the workspace banner shows in the console', async ({ page, context }) => {
    await openSupport(page)
    const popup = context.waitForEvent('page')
    await startFromTenants(page)
    const workspace = await popup
    await workspace.getByRole('button', { name: 'End session' }).click()
    await expect(workspace.locator('[role="status"]')).toContainText('This support session has ended.')
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange'))) // the console tab is looked at again
    await expect(banner(page)).toHaveCount(0, { timeout: 10_000 })
    await goTo(page, 'Support access', 'Support access')
    await expect(rows(page).first()).toContainText('Ended by Omar Haddad')
  })

  test('a code works once: a second tab with the same address gets the one generic message, and the session ends', async ({ page, context }) => {
    await openSupport(page)
    await recordOpenedUrl(page)
    const popup = context.waitForEvent('page')
    await startFromTenants(page)
    const workspace = await popup
    await expect(workspace.locator('[role="status"]')).toContainText('is signed in as')

    const replay = await context.newPage()
    await replay.goto(await openedUrl(page))
    await expect(replay.getByRole('alert')).toHaveText('This support link is invalid or has expired.')
    expect(replay.url()).not.toContain('#')

    await expect(workspace.locator('[role="status"]')).toContainText('This support session has ended.', { timeout: 10_000 }) // the reuse revoked it
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange'))) // the console tab is looked at again
    await expect(banner(page)).toHaveCount(0, { timeout: 10_000 })
  })

  test('a made-up address gets the same message', async ({ page, context }) => {
    await signIn(page, accounts.support)
    const stranger = await context.newPage()
    await stranger.goto('/mock-workspace/support-handoff#code=mock-handoff.not-a-real-code')
    await expect(stranger.getByRole('alert')).toHaveText('This support link is invalid or has expired.')
    const none = await context.newPage()
    await none.goto('/mock-workspace/support-handoff')
    await expect(none.getByRole('alert')).toHaveText('This support link is invalid or has expired.')
  })

  test('Open workspace gives a new code until the workspace has been opened once', async ({ page, context }) => {
    await openSupport(page)
    await recordOpenedUrl(page)
    const first = context.waitForEvent('page')
    await startFromTenants(page)
    const workspace = await first
    await expect(workspace.locator('[role="status"]')).toContainText('is signed in as') // the workspace took the first code
    await banner(page).getByRole('button', { name: 'Open workspace' }).click()
    await toast(page, 'This session has already been opened in the workspace.')
  })
})

test.describe('time and other people', () => {
  test('a session runs out at the end of its time: the banner goes and the list says Expired', async ({ page }) => {
    await page.clock.install()
    await openSupport(page)
    await startFromTenants(page, 'Cobalt Ridge Wealth', { minutes: 15 })
    await page.clock.fastForward('16:00')
    await expect(banner(page)).toHaveCount(0, { timeout: 10_000 })
    await goTo(page, 'Support access', 'Support access')
    await expect(page.locator('tr[data-status="expired"]')).toHaveCount(1)
    await expect(page.locator('tr[data-status="expired"]')).toContainText('Expired')
  })

  test('signing out does not end a session, and a Super admin can revoke it', async ({ page }) => {
    await openSupport(page)
    await startFromTenants(page)
    await switchTo(page, accounts.admin) // Omar signs out, Dana signs in
    await goTo(page, 'Support access', 'Support access')
    const mine = page.locator('tr[data-status="active"]')
    await expect(mine).toHaveCount(1)
    await expect(mine).toContainText('Omar Haddad')
    await expect(banner(page)).toHaveCount(0) // it is not Dana's session
    await mine.getByRole('button', { name: /^Revoke/ }).click()
    const ask = confirm(page, "Revoke Omar Haddad's session?")
    await expect(ask).toContainText('signed in as')
    await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await ask.getByRole('button', { name: 'Revoke session' }).click()
    await toast(page, "Omar Haddad's session was revoked")
    await expect(page.locator('tr[data-status="revoked"]')).toContainText('Revoked by Dana Whitfield')
  })

  test('the owner finds the banner again after signing back in', async ({ page }) => {
    await openSupport(page)
    await startFromTenants(page)
    await switchTo(page, accounts.admin)
    await switchTo(page, accounts.support)
    await expect(banner(page)).toContainText('at Cobalt Ridge Wealth')
  })

  test('disabling a staff member ends their session as revoked', async ({ page }) => {
    await openSupport(page)
    await startFromTenants(page)
    await switchTo(page, accounts.admin)
    await goTo(page, 'Access control', 'Access control')
    await page.getByRole('button', { name: 'Deactivate Omar Haddad' }).click()
    await confirm(page, 'Deactivate Omar Haddad?').getByRole('button', { name: 'Deactivate' }).click()
    await expect(page.getByRole('button', { name: 'Reactivate Omar Haddad' })).toBeVisible()
    await goTo(page, 'Support access', 'Support access')
    await expect(page.locator('tr[data-status="revoked"]')).toContainText('Revoked by Dana Whitfield')
    await expect(page.locator('tr[data-status="active"]')).toHaveCount(0)
  })
})

test.describe('who sees what', () => {
  test('the Auditor sees the sessions and can start or end nothing', async ({ page }) => {
    await signIn(page, accounts.auditor)
    await expect(menuLinks(page)).toContainText(['Support access'])
    await goTo(page, 'Support access', 'Support access')
    await expect(rows(page)).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Start support session' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^(End session|Revoke)/ })).toHaveCount(0)
    await goTo(page, 'Tenants', 'Tenants')
    await expect(page.getByRole('button', { name: /^Sign in as / })).toHaveCount(0)
  })

  test('the Billing manager has no Support access page', async ({ page }) => {
    await signIn(page, accounts.billing, { next: '/support' })
    await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible()
    await expect(page.getByText('does not include Support access')).toBeVisible()
  })

  test('the Super admin can start a session too', async ({ page }) => {
    await openSupport(page, accounts.admin)
    await expect(page.getByRole('button', { name: 'Start support session' })).toBeVisible()
  })
})

test.describe('reopening a dialog while it fades out', () => {
  test('Start a support session reopens with its overlay behind it and takes clicks', async ({ page }) => {
    await openSupport(page)
    await slowContentFade(page)
    await page.locator('#su-start').click()
    const dialog = startDialog(page)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    // The overlay has faded out and was removed; the content is still fading for 3s.
    await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0)
    await pressWithKeyboard(page.locator('#su-start'))
    await expect.poll(() => overlayBeforeContent(page, 'dialog')).toBe(true)
    await dialog.getByRole('button', { name: 'Cancel' }).click({ timeout: 2000 })
    await expect(dialog).toBeHidden()
  })
})
