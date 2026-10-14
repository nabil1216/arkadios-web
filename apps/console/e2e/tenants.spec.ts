// Ported from docs/handoff/tests/console_ptest.py (tenants: rows, search, status filter) and
// console_ptest3.py (per-role buttons), limited to the list. Create, Manage and Sign in as are shown but do nothing yet.
import { expect, test, type Page } from '@playwright/test'
import { accounts, menuLinks, signIn, type Account } from './helpers.ts'

const NAMES = [
  'Arkadios Home Office',
  'Cobalt Ridge Wealth',
  'Marlow & Finch Partners',
  'Northwind Advisory Group',
  'Quillon Trust Company',
  'Sterling Hollow Family Office',
]
const NO_MATCH = 'No tenants match. Clear the search or choose another status.'

const rows = (page: Page) => page.locator('#t-body tr[data-id]')
const names = (page: Page) => page.locator('#t-body tr[data-id] strong')
const search = (page: Page) => page.getByLabel('Search tenants')
const status = (page: Page) => page.getByLabel('Filter by status')
const header = (page: Page, name: string) => page.getByRole('columnheader', { name })

async function openTenants(page: Page, account: Account = accounts.admin, query = '') {
  await signIn(page, account, { next: '/tenants' + query })
  await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible()
}

test.describe('tenants list', () => {
  test('the Tenants menu opens the page', async ({ page }) => {
    await signIn(page, accounts.admin)
    await menuLinks(page).filter({ hasText: 'Tenants' }).click()
    await expect(page).toHaveURL(/\/tenants$/)
    await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible()
    await expect(page.getByText('Each tenant has its own domain, database, plan, and user limit.')).toBeVisible()
  })

  test('shows the 6 tenants, sorted by name', async ({ page }) => {
    await openTenants(page)
    await expect(rows(page)).toHaveCount(6)
    await expect(names(page)).toHaveText(NAMES)
  })

  test('shows domain, database, plan, users and status for each tenant', async ({ page }) => {
    await openTenants(page)
    const quillon = rows(page).filter({ hasText: 'Quillon Trust Company' })
    await expect(quillon).toContainText('quillon.platform.example')
    await expect(quillon).toContainText('tenant_quillon')
    await expect(quillon).toContainText('Enterprise')
    await expect(quillon).toContainText('140 of 200')
    await expect(quillon).toContainText('Active')
    await expect(quillon).toContainText(/Created \w{3} \d{1,2}, \d{4}/)
    await expect(rows(page).filter({ hasText: 'Marlow & Finch' })).toContainText('Trial')
    await expect(rows(page).filter({ hasText: 'Sterling Hollow' })).toContainText('Suspended')
  })

  test('the page has real table headers', async ({ page }) => {
    await openTenants(page)
    for (const name of ['Tenant', 'Domain', 'Database', 'Plan', 'Users', 'Status']) {
      await expect(header(page, name)).toBeVisible()
    }
  })
})

test.describe('search and status filter', () => {
  test('search filters to the matching tenant', async ({ page }) => {
    await openTenants(page)
    await expect(rows(page)).toHaveCount(6)
    await search(page).fill('north')
    await expect(rows(page)).toHaveCount(1)
    await expect(names(page)).toHaveText(['Northwind Advisory Group'])
  })

  test('search also matches the domain and the database', async ({ page }) => {
    await openTenants(page)
    await search(page).fill('sterling-hollow.platform')
    await expect(names(page)).toHaveText(['Sterling Hollow Family Office'])
    await search(page).fill('tenant_cobalt')
    await expect(names(page)).toHaveText(['Cobalt Ridge Wealth'])
  })

  test('a search with no match shows the empty message, and clearing brings the list back', async ({ page }) => {
    await openTenants(page)
    await search(page).fill('zzz')
    await expect(page.locator('#t-body')).toContainText(NO_MATCH)
    await expect(rows(page)).toHaveCount(0)
    await search(page).fill('')
    await expect(rows(page)).toHaveCount(6)
  })

  test('the status filter narrows the list, and All statuses restores it', async ({ page }) => {
    await openTenants(page)
    await status(page).selectOption('suspended')
    await expect(rows(page)).toHaveCount(1)
    await expect(names(page)).toHaveText(['Sterling Hollow Family Office'])
    await status(page).selectOption('trial')
    await expect(names(page)).toHaveText(['Marlow & Finch Partners'])
    await status(page).selectOption('offboarding')
    await expect(page.locator('#t-body')).toContainText(NO_MATCH)
    await status(page).selectOption('all')
    await expect(rows(page)).toHaveCount(6)
  })

  test('the search and the status filter work together', async ({ page }) => {
    await openTenants(page)
    await status(page).selectOption('active')
    await search(page).fill('o')
    await expect(names(page)).toHaveText(['Arkadios Home Office', 'Cobalt Ridge Wealth', 'Northwind Advisory Group', 'Quillon Trust Company'])
    await status(page).selectOption('suspended')
    await expect(names(page)).toHaveText(['Sterling Hollow Family Office']) // it has an "o" too
    await search(page).fill('north')
    await expect(page.locator('#t-body')).toContainText(NO_MATCH)
  })

  test('the server does the filtering: the request carries the search and the status', async ({ page }) => {
    await openTenants(page)
    const request = page.waitForRequest((r) => /\/tenants\?/.test(r.url()) && r.url().includes('q=north'))
    await search(page).fill('north')
    const url = new URL((await request).url())
    expect(url.pathname).toBe('/api/platform/v1/tenants')
    expect(url.searchParams.get('q')).toBe('north')
    expect(url.searchParams.get('sort')).toBe('name')
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.get('pageSize')).toBe('25')
    expect(url.searchParams.has('status')).toBe(false) // "All statuses" sends no status

    const statusRequest = page.waitForRequest((r) => r.url().includes('status=trial'))
    await status(page).selectOption('trial')
    expect(new URL((await statusRequest).url()).searchParams.get('status')).toBe('trial')
  })
})

test.describe('filters live in the URL', () => {
  test('search, status and sort are written to the address bar', async ({ page }) => {
    await openTenants(page)
    expect(new URL(page.url()).search).toBe('')
    await status(page).selectOption('active')
    await expect(page).toHaveURL(/[?]status=active$/)
    await search(page).fill('o')
    await expect(page).toHaveURL(/[?]q=o&status=active$/)
    await header(page, 'Users').getByRole('button').click()
    await expect(page).toHaveURL(/[?]q=o&status=active&sort=usersUsed$/)
  })

  test('a reload keeps the filters', async ({ page }) => {
    await openTenants(page, accounts.admin, '?q=o&status=active&sort=-usersUsed')
    await expect(names(page)).toHaveText(['Northwind Advisory Group', 'Quillon Trust Company', 'Arkadios Home Office', 'Cobalt Ridge Wealth'])
    await page.reload()
    await expect(names(page)).toHaveText(['Northwind Advisory Group', 'Quillon Trust Company', 'Arkadios Home Office', 'Cobalt Ridge Wealth'])
    await expect(search(page)).toHaveValue('o')
    await expect(status(page)).toHaveValue('active')
  })

  test('the back button restores the previous filter', async ({ page }) => {
    await openTenants(page)
    await status(page).selectOption('suspended')
    await expect(rows(page)).toHaveCount(1)
    await page.goBack()
    await expect(status(page)).toHaveValue('all')
    await expect(rows(page)).toHaveCount(6)
  })

  test('junk in the address bar falls back to the defaults', async ({ page }) => {
    await openTenants(page, accounts.admin, '?sort=id&status=bad&page=abc&pageSize=500')
    await expect(names(page)).toHaveText(NAMES)
    await expect(status(page)).toHaveValue('all')
  })
})

test.describe('sorting', () => {
  test('Tenant starts ascending and flips on click, with aria-sort', async ({ page }) => {
    await openTenants(page)
    await expect(header(page, 'Tenant')).toHaveAttribute('aria-sort', 'ascending')
    await header(page, 'Tenant').getByRole('button').click()
    await expect(header(page, 'Tenant')).toHaveAttribute('aria-sort', 'descending')
    await expect(names(page)).toHaveText([...NAMES].reverse())
    await expect(page).toHaveURL(/[?]sort=-name$/)
    await header(page, 'Tenant').getByRole('button').click()
    await expect(names(page)).toHaveText(NAMES)
    await expect(page).toHaveURL(/\/tenants$/)
  })

  test('Users sorts by number of users, both ways', async ({ page }) => {
    await openTenants(page)
    await header(page, 'Users').getByRole('button').click()
    await expect(header(page, 'Users')).toHaveAttribute('aria-sort', 'ascending')
    await expect(header(page, 'Tenant')).toHaveAttribute('aria-sort', 'none')
    await expect(names(page).first()).toHaveText('Marlow & Finch Partners') // 18
    await header(page, 'Users').getByRole('button').click()
    await expect(names(page).first()).toHaveText('Northwind Advisory Group') // 212
  })

  test('Plan and Status sort, and only the sortable headers are buttons', async ({ page }) => {
    await openTenants(page)
    await header(page, 'Status').getByRole('button').click()
    await expect(names(page).last()).toHaveText('Marlow & Finch Partners') // trial sorts last
    await header(page, 'Plan').getByRole('button').click()
    await expect(page).toHaveURL(/[?]sort=plan$/)
    await expect(header(page, 'Domain').getByRole('button')).toHaveCount(0)
    await expect(header(page, 'Database').getByRole('button')).toHaveCount(0)
  })
})

test.describe('paging', () => {
  test('there is no pager while everything fits on one page', async ({ page }) => {
    await openTenants(page)
    await expect(page.getByRole('navigation', { name: 'Pages' })).toHaveCount(0)
  })

  test('pages through the list with ?pageSize=2', async ({ page }) => {
    await openTenants(page, accounts.admin, '?pageSize=2')
    const pager = page.getByRole('navigation', { name: 'Pages' })
    await expect(names(page)).toHaveText(['Arkadios Home Office', 'Cobalt Ridge Wealth'])
    await expect(pager).toContainText('Showing 1 to 2 of 6')
    await expect(pager).toContainText('Page 1 of 3')
    await expect(pager.getByRole('button', { name: 'Previous' })).toBeDisabled()

    await pager.getByRole('button', { name: 'Next' }).click()
    await expect(names(page)).toHaveText(['Marlow & Finch Partners', 'Northwind Advisory Group'])
    await expect(page).toHaveURL(/[?]page=2&pageSize=2$/)

    await pager.getByRole('button', { name: 'Next' }).click()
    await expect(names(page)).toHaveText(['Quillon Trust Company', 'Sterling Hollow Family Office'])
    await expect(pager).toContainText('Page 3 of 3')
    await expect(pager.getByRole('button', { name: 'Next' })).toBeDisabled()

    await pager.getByRole('button', { name: 'Previous' }).click()
    await expect(pager).toContainText('Page 2 of 3')
  })

  test('a filter or a sort goes back to page 1', async ({ page }) => {
    await openTenants(page, accounts.admin, '?pageSize=2&page=2')
    await status(page).selectOption('active')
    await expect(page).toHaveURL(/[?]status=active&pageSize=2$/)
    await expect(page.getByRole('navigation', { name: 'Pages' })).toContainText('Page 1 of 2')
  })

  test('a page past the end moves to the last page', async ({ page }) => {
    await openTenants(page, accounts.admin, '?page=9&pageSize=4')
    await expect(page).toHaveURL(/[?]page=2&pageSize=4$/)
    await expect(names(page)).toHaveText(['Quillon Trust Company', 'Sterling Hollow Family Office'])
  })
})

test.describe('buttons by role', () => {
  const later = async (button: ReturnType<Page['getByRole']>) => {
    await expect(button).toHaveAttribute('aria-disabled', 'true')
    await expect(button).toHaveAttribute('title', 'Coming in a later step')
    await button.click({ force: true }) // Playwright will not click aria-disabled controls otherwise
  }

  test('super admin sees Manage, Sign in as and Create tenant, all marked as coming later', async ({ page }) => {
    await openTenants(page, accounts.admin)
    await expect(rows(page)).toHaveCount(6)
    const create = page.getByRole('button', { name: /Create tenant/ })
    await expect(create).toBeVisible()
    await expect(page.getByRole('button', { name: /^Manage / })).toHaveCount(6)
    await expect(page.getByRole('button', { name: /^Sign in as a user of / })).toHaveCount(6)
    await expect(page.getByRole('button', { name: 'Manage Northwind Advisory Group' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in as a user of Northwind Advisory Group' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^View / })).toHaveCount(0)

    for (const button of [
      create,
      page.getByRole('button', { name: 'Manage Cobalt Ridge Wealth' }),
      page.getByRole('button', { name: 'Sign in as a user of Cobalt Ridge Wealth' }),
    ]) {
      await later(button)
    }
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/\/tenants$/)
  })

  test('the row buttons sit at the right end of each row, next to each other', async ({ page }) => {
    await openTenants(page, accounts.admin)
    const row = rows(page).filter({ hasText: 'Quillon Trust Company' })
    const manage = await row.getByRole('button', { name: /^Manage / }).boundingBox()
    const signIn = await row.getByRole('button', { name: /^Sign in as / }).boundingBox()
    const status = await row.getByText('Active', { exact: true }).boundingBox()
    expect(manage && signIn && status).toBeTruthy()
    expect(manage!.x).toBeGreaterThan(status!.x) // after the status badge
    expect(signIn!.x).toBeGreaterThan(manage!.x) // Manage, then Sign in as
  })

  test('support lead sees View and Sign in as, and no Create tenant', async ({ page }) => {
    await openTenants(page, accounts.support)
    await expect(rows(page)).toHaveCount(6)
    await expect(page.getByRole('button', { name: /^View / })).toHaveCount(6)
    await expect(page.getByRole('button', { name: /^Sign in as a user of / })).toHaveCount(6)
    await expect(page.getByRole('button', { name: /^Manage / })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Create tenant/ })).toHaveCount(0)
    await later(page.getByRole('button', { name: 'Sign in as a user of Quillon Trust Company' }))
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  for (const role of ['billing', 'auditor'] as const) {
    test(`${role} sees View only: no Create tenant, no Sign in as`, async ({ page }) => {
      await openTenants(page, accounts[role])
      await expect(rows(page)).toHaveCount(6)
      await expect(page.getByRole('button', { name: /^View / })).toHaveCount(6)
      await expect(page.getByRole('button', { name: 'View Northwind Advisory Group' })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Manage / })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /Create tenant/ })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /Sign in as/i })).toHaveCount(0)
    })
  }
})
