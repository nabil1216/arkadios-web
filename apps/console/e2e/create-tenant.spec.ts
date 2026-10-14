// Ported from docs/handoff/tests/console_ptest.py ("create tenant: validation then success"):
// the drawer, validation errors, domain auto-fill, plan hint, provisioning steps and the ready note.
// Limit edit, suspend, export and offboard belong to the Manage drawer, which comes later.
import { expect, test, type Page } from '@playwright/test'
import { accounts, signIn } from './helpers.ts'

const rows = (page: Page) => page.locator('#t-body tr[data-id]')
const drawer = (page: Page) => page.getByRole('dialog', { name: 'Create tenant' })
const field = (page: Page, label: string) => drawer(page).getByLabel(label)
const READY = { timeout: 20_000 }

async function openDrawer(page: Page) {
  await signIn(page, accounts.admin, { next: '/tenants' })
  await expect(rows(page)).toHaveCount(6)
  await page.getByRole('button', { name: /Create tenant/ }).click()
  await expect(drawer(page)).toBeVisible()
  await expect(field(page, 'Company name')).toBeVisible()
}

async function fillValid(page: Page) {
  await field(page, 'Company name').fill('Harbor Lane Advisors')
  await field(page, 'Plan').selectOption('enterprise')
  await field(page, 'User limit').fill('80')
  await field(page, 'Hosting region').selectOption('us-west')
  await field(page, 'First admin email').fill('it@harborlane.example')
}

const submit = (page: Page) => drawer(page).getByRole('button', { name: 'Create tenant' }).click()

test.describe('the drawer', () => {
  test('opens from Create tenant with the demo form and its defaults', async ({ page }) => {
    await openDrawer(page)
    await expect(drawer(page).getByText('Each tenant gets its own domain and its own database.')).toBeVisible()
    await expect(field(page, 'Company name')).toHaveValue('')
    await expect(field(page, 'Domain')).toHaveValue('')
    await expect(drawer(page).getByText('.platform.example')).toBeVisible()
    await expect(field(page, 'Plan')).toHaveValue('professional')
    await expect(field(page, 'User limit')).toHaveValue('50')
    await expect(field(page, 'Hosting region')).toHaveValue('us-east')
    await expect(field(page, 'First admin email')).toHaveValue('')
    // plans and regions come from the server
    await expect(field(page, 'Plan').locator('option')).toHaveText(['Essentials', 'Professional', 'Enterprise'])
    await expect(field(page, 'Hosting region').locator('option')).toHaveText(['US East', 'US West', 'EU Frankfurt'])
  })

  test('closes with Cancel and with Escape, and opens empty again', async ({ page }) => {
    await openDrawer(page)
    await field(page, 'Company name').fill('Half typed')
    await drawer(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(drawer(page)).toHaveCount(0)

    await page.getByRole('button', { name: /Create tenant/ }).click()
    await expect(field(page, 'Company name')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer(page)).toHaveCount(0)
  })

  test('focus moves into the drawer, and returns to the button when it closes', async ({ page }) => {
    await openDrawer(page)
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: /Create tenant/ })).toBeFocused()
  })
})

test.describe('validation', () => {
  test('an empty form shows the errors, focuses the first, and sends nothing', async ({ page }) => {
    await openDrawer(page)
    let posts = 0
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/tenants')) posts++
    })
    await submit(page)
    await expect(drawer(page).getByText('Enter the company name.')).toBeVisible()
    await expect(drawer(page).getByText('Use 3 to 30 lowercase letters, numbers, or hyphens.')).toBeVisible()
    await expect(drawer(page).getByText('Enter a valid email address.')).toBeVisible()
    expect(await drawer(page).locator('[role="alert"]').count()).toBeGreaterThanOrEqual(3) // the demo checks 3 or more
    await expect(field(page, 'Company name')).toHaveAttribute('aria-invalid', 'true')
    await expect(field(page, 'Company name')).toBeFocused()
    expect(posts).toBe(0)
  })

  for (const limit of ['0', '1001']) {
    test(`a user limit of ${limit} is refused`, async ({ page }) => {
      await openDrawer(page)
      await fillValid(page)
      await field(page, 'User limit').fill(limit)
      await submit(page)
      await expect(drawer(page).getByText('Enter a number from 1 to 1000.')).toBeVisible()
      await expect(drawer(page).getByRole('list')).toHaveCount(0)
    })
  }

  test('a domain that is already taken is refused by the server and stays on the form', async ({ page }) => {
    await openDrawer(page)
    await fillValid(page)
    await field(page, 'Domain').fill('northwind')
    await submit(page)
    await expect(drawer(page).getByText('This domain is already taken.')).toBeVisible()
    await expect(field(page, 'Domain')).toHaveAttribute('aria-invalid', 'true')
    await expect(field(page, 'Domain')).toBeFocused()
    await expect(drawer(page).getByRole('list')).toHaveCount(0)
    await expect(field(page, 'Company name')).toHaveValue('Harbor Lane Advisors')
  })
})

test.describe('form behaviour', () => {
  test('the domain follows the company name until it is edited', async ({ page }) => {
    await openDrawer(page)
    await field(page, 'Company name').fill('Harbor Lane Advisors')
    await expect(field(page, 'Domain')).toHaveValue('harbor-lane-advisors') // ptest: "domain auto-filled"
    await field(page, 'Company name').fill('Marlow & Finch Partners')
    await expect(field(page, 'Domain')).toHaveValue('marlow-and-finch-partners')

    await field(page, 'Domain').fill('My-Firm')
    await expect(field(page, 'Domain')).toHaveValue('my-firm') // lowercased
    await field(page, 'Company name').fill('Something else')
    await expect(field(page, 'Domain')).toHaveValue('my-firm') // no longer follows
  })

  test('the plan hint follows the plan', async ({ page }) => {
    await openDrawer(page)
    await expect(drawer(page).getByText('Adds workflows, reports, AI. Starts with a 30-day trial.')).toBeVisible()
    await field(page, 'Plan').selectOption('enterprise')
    await expect(drawer(page).getByText('Adds integrations and audit.')).toBeVisible() // ptest: "plan hint updates"
    await field(page, 'Plan').selectOption('essentials')
    await expect(drawer(page).getByText('Directory and service history. Starts with a 14-day trial.')).toBeVisible()
  })
})

test.describe('creating a tenant', () => {
  test('provisions it step by step, shows the ready note, and the tenant joins the list', async ({ page }) => {
    await openDrawer(page)
    const posted = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/api/platform/v1/tenants'))
    const polls: string[] = []
    page.on('request', (r) => {
      if (/\/tenants\/[0-9a-f-]{36}\/provisioning$/.test(r.url())) polls.push(r.url())
    })

    await fillValid(page)
    await submit(page)

    // what was sent: ids and numbers, not display text
    expect((await posted).postDataJSON()).toEqual({
      name: 'Harbor Lane Advisors',
      domain: 'harbor-lane-advisors',
      planId: 'enterprise',
      userLimit: 80,
      region: 'us-west',
      adminEmail: 'it@harborlane.example',
    })

    // the five steps, with the first one running
    const steps = drawer(page).getByRole('listitem')
    await expect(steps).toHaveCount(5)
    await expect(steps.first()).toContainText('Creating the database tenant_harbor_lane_advisors')
    await expect(steps.nth(1)).toContainText('Running migrations for release 2.4.0')
    await expect(steps.nth(2)).toContainText('Seeding default stages, checklists, and roles')
    await expect(steps.nth(3)).toContainText('Setting up the domain harbor-lane-advisors.platform.example')
    await expect(steps.nth(4)).toContainText('Inviting it@harborlane.example as the first admin')
    await expect(steps.first()).toHaveAttribute('data-state', /running|done/)
    await expect(field(page, 'Company name')).toHaveCount(0)

    // locked while the server works: no close button, Escape and a click outside do nothing
    await expect(drawer(page).getByRole('button', { name: 'Close' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.mouse.click(40, 450)
    await expect(drawer(page)).toBeVisible()

    // ready note (ptest: "provisioning finishes: Harbor Lane Advisors is ready")
    await expect(drawer(page).getByRole('heading', { name: 'Harbor Lane Advisors is ready' })).toBeVisible(READY)
    await expect(drawer(page).locator('li[data-state="done"]')).toHaveCount(5)
    const note = drawer(page).getByRole('status')
    await expect(note).toContainText('Workspace at harbor-lane-advisors.platform.example')
    await expect(note).toContainText('An invitation went to it@harborlane.example')
    await expect(note).toContainText('The trial runs for 30 days.')
    expect(polls.length).toBeGreaterThanOrEqual(2) // progress is polled, not guessed

    const manage = drawer(page).getByRole('button', { name: 'Manage tenant' })
    await expect(manage).toHaveAttribute('aria-disabled', 'true')
    await expect(manage).toHaveAttribute('title', 'Coming in a later step')

    // now it can be closed, and the list already has the tenant
    await expect(drawer(page).getByRole('button', { name: 'Close' })).toBeVisible()
    await drawer(page).getByRole('button', { name: 'Done' }).click()
    await expect(drawer(page)).toHaveCount(0)
    await expect(rows(page)).toHaveCount(7)
    const row = rows(page).filter({ hasText: 'Harbor Lane Advisors' })
    await expect(row).toContainText('harbor-lane-advisors.platform.example')
    await expect(row).toContainText('tenant_harbor_lane_advisors')
    await expect(row).toContainText('Enterprise')
    await expect(row).toContainText('1 of 80')
    await expect(row).toContainText('Trial')

    // and the next time the drawer opens empty
    await page.getByRole('button', { name: /Create tenant/ }).click()
    await expect(field(page, 'Company name')).toHaveValue('')
    await expect(drawer(page).getByRole('heading', { name: /is ready/ })).toHaveCount(0)
  })

  test('a second tenant cannot take the same domain', async ({ page }) => {
    await openDrawer(page)
    await fillValid(page)
    await submit(page)
    await expect(drawer(page).getByRole('heading', { name: 'Harbor Lane Advisors is ready' })).toBeVisible(READY)
    await drawer(page).getByRole('button', { name: 'Done' }).click()

    await page.getByRole('button', { name: /Create tenant/ }).click()
    await field(page, 'Company name').fill('Harbor Lane Again')
    await field(page, 'Domain').fill('harbor-lane-advisors')
    await field(page, 'First admin email').fill('other@harborlane.example')
    await submit(page)
    await expect(drawer(page).getByText('This domain is already taken.')).toBeVisible()
  })
})
