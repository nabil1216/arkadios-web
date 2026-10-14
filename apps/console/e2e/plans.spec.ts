// Ported from docs/handoff/tests/console_ptest.py ("plans: toggle, discard, save") and
// console_ptest3.py ("plans are view only"). The demo's "plans persist after reload" is ported as
// navigate away and back: the mock API keeps its data in the page, so a full reload would reset it.
import { expect, test, type Page } from '@playwright/test'
import { accounts, menuLinks, signIn, type Account } from './helpers.ts'

const save = (page: Page) => page.locator('#pl-save')
const discard = (page: Page) => page.locator('#pl-discard')
const sw = (page: Page, module: string, plan: string) => page.locator(`input[data-mod="${module}"][data-plan="${plan}"]`)
const trial = (page: Page, plan: string) => page.locator(`#trial-${plan}`)
const confirmDialog = (page: Page) => page.getByRole('alertdialog', { name: 'Switch modules off for existing tenants?' })

async function openPlans(page: Page, account: Account = accounts.admin) {
  await signIn(page, account, { next: '/plans' })
  await expect(page.getByRole('heading', { name: 'Plans and modules' })).toBeVisible()
  await expect(sw(page, 'directory', 'essentials')).toBeVisible()
}

async function goTo(page: Page, menu: string, heading: string) {
  await menuLinks(page).filter({ hasText: menu }).click()
  await expect(page.getByRole('heading', { name: heading })).toBeVisible()
}

test.describe('the matrix', () => {
  test('the Plans and modules menu opens the page', async ({ page }) => {
    await signIn(page, accounts.admin)
    await menuLinks(page).filter({ hasText: 'Plans and modules' }).click() // ptest: nav -> Plans and modules
    await expect(page).toHaveURL(/\/plans$/)
    await expect(page.getByRole('heading', { name: 'Plans and modules' })).toBeVisible()
    await expect(
      page.getByText('Switch modules on or off per plan. Tenants see only what their plan includes; the rest shows locked with an upgrade prompt.'),
    ).toBeVisible()
  })

  test('shows the three plans with their tenant counts, trial lengths and 11 modules', async ({ page }) => {
    await openPlans(page)
    await expect(page.getByRole('columnheader', { name: /Essentials/ })).toContainText('1 tenant')
    await expect(page.getByRole('columnheader', { name: /Professional/ })).toContainText('3 tenants')
    await expect(page.getByRole('columnheader', { name: /Enterprise/ })).toContainText('2 tenants')
    await expect(trial(page, 'essentials')).toHaveValue('14')
    await expect(trial(page, 'professional')).toHaveValue('30')
    await expect(trial(page, 'enterprise')).toHaveValue('30')
    await expect(page.locator('tbody tr')).toHaveCount(12) // trial length and 11 modules
    await expect(page.locator('input[data-mod]')).toHaveCount(33)
  })

  test('switches on what each plan includes', async ({ page }) => {
    await openPlans(page)
    await expect(sw(page, 'reports', 'essentials')).not.toBeChecked()
    await expect(sw(page, 'reports', 'professional')).toBeChecked()
    await expect(sw(page, 'integrations', 'professional')).not.toBeChecked()
    await expect(sw(page, 'integrations', 'enterprise')).toBeChecked()
    await expect(page.getByRole('switch', { name: 'Report builder on Professional' })).toBeChecked()
  })

  test('Ticketing and Documents are coming later: off and disabled everywhere', async ({ page }) => {
    await openPlans(page)
    await expect(page.getByText('Coming later')).toHaveCount(2)
    for (const module of ['ticketing', 'documents']) {
      for (const plan of ['essentials', 'professional', 'enterprise']) {
        await expect(sw(page, module, plan)).toBeDisabled()
        await expect(sw(page, module, plan)).not.toBeChecked()
      }
    }
  })
})

test.describe('toggle, discard, save', () => {
  test('Save is off while nothing has changed, and on once a switch is flipped', async ({ page }) => {
    await openPlans(page)
    await expect(save(page)).toBeDisabled() // ptest: "save disabled when clean"
    await expect(discard(page)).toBeDisabled()
    await sw(page, 'integrations', 'professional').check()
    await expect(save(page)).toBeEnabled() // ptest: "save enabled when dirty"
    await expect(discard(page)).toBeEnabled()
  })

  test('Discard puts everything back', async ({ page }) => {
    await openPlans(page)
    await sw(page, 'integrations', 'professional').check()
    await trial(page, 'essentials').fill('21')
    await discard(page).click()
    await expect(sw(page, 'integrations', 'professional')).not.toBeChecked() // ptest: "discard reverts"
    await expect(trial(page, 'essentials')).toHaveValue('14')
    await expect(save(page)).toBeDisabled()
    await expect(page.getByText('Changes discarded')).toBeVisible()
  })

  test('flipping a switch back leaves nothing to save', async ({ page }) => {
    await openPlans(page)
    await sw(page, 'integrations', 'professional').check()
    await sw(page, 'integrations', 'professional').uncheck()
    await expect(save(page)).toBeDisabled()
  })

  test('saves a switch and a trial length, says so, and keeps them when you come back', async ({ page }) => {
    await openPlans(page)
    await sw(page, 'integrations', 'professional').check()
    await trial(page, 'essentials').fill('21')
    await save(page).click()
    await expect(save(page)).toBeDisabled() // ptest: "save persists"
    await expect(page.getByText('Plan changes saved')).toBeVisible()

    await goTo(page, 'Tenants', 'Tenants') // ptest: "plans persist after reload", as navigate away and back
    await goTo(page, 'Plans and modules', 'Plans and modules')
    await expect(sw(page, 'integrations', 'professional')).toBeChecked()
    await expect(trial(page, 'essentials')).toHaveValue('21')
    await expect(save(page)).toBeDisabled()
  })

  test('sends only the plans that changed, with the version they were loaded at', async ({ page }) => {
    await openPlans(page)
    const puts: Array<{ url: string; body: Record<string, unknown> }> = []
    page.on('request', (r) => {
      if (r.method() === 'PUT' && /\/plans\//.test(r.url())) puts.push({ url: new URL(r.url()).pathname, body: r.postDataJSON() })
    })
    await sw(page, 'integrations', 'professional').check()
    await trial(page, 'essentials').fill('21')
    await save(page).click()
    await expect(page.getByText('Plan changes saved')).toBeVisible()

    expect(puts.map((p) => p.url).sort()).toEqual(['/api/platform/v1/plans/essentials', '/api/platform/v1/plans/professional'])
    const professional = puts.find((p) => p.url.endsWith('/professional'))!.body
    expect(professional).toMatchObject({ trialDays: 30, version: 1 })
    expect(Object.keys(professional.modules as object)).toHaveLength(11)
    expect((professional.modules as Record<string, boolean>).integrations).toBe(true)
    expect(puts.find((p) => p.url.endsWith('/essentials'))!.body).toMatchObject({ trialDays: 21, version: 1 })
  })

  test('refuses a trial length outside 0 to 90 and blocks Save', async ({ page }) => {
    await openPlans(page)
    await trial(page, 'essentials').fill('91')
    await expect(page.getByText('Enter a number from 0 to 90.')).toBeVisible()
    await expect(trial(page, 'essentials')).toHaveAttribute('aria-invalid', 'true')
    await expect(save(page)).toBeDisabled()
    await trial(page, 'essentials').fill('90')
    await expect(page.getByText('Enter a number from 0 to 90.')).toHaveCount(0)
    await expect(save(page)).toBeEnabled()
  })
})

test.describe('switching modules off', () => {
  test('switching on never asks', async ({ page }) => {
    await openPlans(page)
    await sw(page, 'reports', 'essentials').check()
    await save(page).click()
    await expect(page.getByText('Plan changes saved')).toBeVisible()
    await expect(confirmDialog(page)).toHaveCount(0)
  })

  test('switching off on a plan with tenants asks first, naming the tenants and the modules', async ({ page }) => {
    await openPlans(page)
    await sw(page, 'reports', 'professional').uncheck()
    await sw(page, 'ai', 'professional').uncheck()
    await sw(page, 'directory', 'essentials').uncheck()
    await save(page).click()

    const dialog = confirmDialog(page)
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('hidden and become read-only for these tenants')
    await expect(dialog).toContainText('Their data is not deleted')
    const professional = dialog.locator('li', { hasText: 'Professional' }).first()
    await expect(professional).toContainText('3 tenants will lose')
    await expect(professional).toContainText('Report builder')
    await expect(professional).toContainText('AI next steps')
    await expect(dialog.locator('li', { hasText: 'Essentials' }).first()).toContainText('1 tenant will lose')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  })

  test('Cancel saves nothing and keeps the edits; confirming saves', async ({ page }) => {
    await openPlans(page)
    let puts = 0
    page.on('request', (r) => {
      if (r.method() === 'PUT' && /\/plans\//.test(r.url())) puts++
    })
    await sw(page, 'reports', 'professional').uncheck()
    await save(page).click()
    await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(confirmDialog(page)).toHaveCount(0)
    expect(puts).toBe(0)
    await expect(sw(page, 'reports', 'professional')).not.toBeChecked()
    await expect(save(page)).toBeEnabled()

    await save(page).click()
    await confirmDialog(page).getByRole('button', { name: 'Switch off and save' }).click()
    await expect(page.getByText('Plan changes saved')).toBeVisible()
    await expect(confirmDialog(page)).toHaveCount(0)
    expect(puts).toBe(1)
    await expect(sw(page, 'reports', 'professional')).not.toBeChecked()
    await expect(save(page)).toBeDisabled()
  })

  test('Escape cancels too', async ({ page }) => {
    await openPlans(page)
    await sw(page, 'reports', 'professional').uncheck()
    await save(page).click()
    await expect(confirmDialog(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(confirmDialog(page)).toHaveCount(0)
    await expect(sw(page, 'reports', 'professional')).not.toBeChecked()
  })
})

test.describe('view-only roles', () => {
  for (const role of ['support', 'billing', 'auditor'] as const) {
    test(`${role} sees the plans but cannot change them`, async ({ page }) => {
      await openPlans(page, accounts[role])
      await expect(save(page)).toHaveCount(0) // ptest3: "plans are view only"
      await expect(discard(page)).toHaveCount(0)
      await expect(page.locator('input[data-mod]').first()).toBeDisabled()
      const enabled = await page.locator('input[data-mod]:not([disabled]), input[id^="trial-"]:not([disabled])').count()
      expect(enabled).toBe(0)
      // still shows what is on
      await expect(sw(page, 'reports', 'professional')).toBeChecked()
      await expect(sw(page, 'integrations', 'professional')).not.toBeChecked()
      await expect(trial(page, 'professional')).toHaveValue('30')
    })
  }

  test('the super admin can edit', async ({ page }) => {
    await openPlans(page, accounts.admin)
    await expect(save(page)).toBeVisible()
    await expect(sw(page, 'reports', 'professional')).toBeEnabled()
    await expect(trial(page, 'essentials')).toBeEnabled()
  })
})

test.describe('plans and the rest of the console', () => {
  test('a saved trial length shows in the create-tenant form', async ({ page }) => {
    await openPlans(page)
    await trial(page, 'essentials').fill('21')
    await save(page).click()
    await expect(page.getByText('Plan changes saved')).toBeVisible()

    await goTo(page, 'Tenants', 'Tenants')
    await page.getByRole('button', { name: /Create tenant/ }).click()
    const drawer = page.getByRole('dialog', { name: 'Create tenant' })
    await drawer.getByLabel('Plan').selectOption('essentials')
    await expect(drawer.getByText('Directory and service history. Starts with a 21-day trial.')).toBeVisible()
  })

  test('a tenant created on a plan is counted on the Plans page', async ({ page }) => {
    await signIn(page, accounts.admin, { next: '/tenants' })
    await page.getByRole('button', { name: /Create tenant/ }).click()
    const drawer = page.getByRole('dialog', { name: 'Create tenant' })
    await drawer.getByLabel('Company name').fill('Harbor Lane Advisors')
    await drawer.getByLabel('Plan').selectOption('enterprise')
    await drawer.getByLabel('First admin email').fill('it@harborlane.example')
    await drawer.getByRole('button', { name: 'Create tenant' }).click()
    await expect(drawer.getByRole('heading', { name: 'Harbor Lane Advisors is ready' })).toBeVisible({ timeout: 20_000 })
    await drawer.getByRole('button', { name: 'Done' }).click()

    await goTo(page, 'Plans and modules', 'Plans and modules')
    await expect(page.getByRole('columnheader', { name: /Enterprise/ })).toContainText('3 tenants')
    await expect(page.getByRole('columnheader', { name: /Professional/ })).toContainText('3 tenants')
  })
})
