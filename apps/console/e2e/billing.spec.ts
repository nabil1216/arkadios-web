// Ported from docs/handoff/tests/console_ptest.py ("billing: totals, extend, notice, invoice" and the
// overdue highlight) and console_ptest3.py (who can extend). Differences from the demo, on purpose:
// Pay now in the notice preview is labelled "Preview only" and does nothing (the demo showed a toast).
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { accounts, menuLinks, overlayBeforeContent, pressWithKeyboard, signIn, slowContentFade, type Account } from './helpers.ts'

const rows = (page: Page) => page.locator('#b-body tr[data-id]')
const tile = (page: Page, label: string) => page.locator('dt', { hasText: new RegExp(`^${label}$`) }).locator('xpath=..')
const dialog = (page: Page, name: string) => page.getByRole('dialog', { name })

async function openBilling(page: Page, account: Account = accounts.admin, query = '') {
  await signIn(page, account, { next: '/billing' + query })
  await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible()
  await expect(rows(page)).toHaveCount(10)
}

test.describe('the page', () => {
  test('the Billing menu opens it', async ({ page }) => {
    await signIn(page, accounts.admin)
    await menuLinks(page).filter({ hasText: 'Billing' }).click()
    await expect(page).toHaveURL(/\/billing$/)
    await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible()
    await expect(
      page.getByText('Monthly subscription bills for every tenant. Tenants pay online through Stripe or PayPal from their own bill notice.'),
    ).toBeVisible()
  })

  test('shows the totals strip, with Overdue as an alert', async ({ page }) => {
    await openBilling(page)
    await expect(tile(page, 'Billable')).toContainText('$33,512.40')
    await expect(tile(page, 'Collected')).toContainText('$15,893.78')
    await expect(tile(page, 'Not yet paid')).toContainText('$16,756.20')
    await expect(tile(page, 'Overdue')).toContainText('$862.42')
  })

  test('the first row is the overdue bill', async ({ page }) => {
    await openBilling(page)
    await expect(rows(page).first()).toContainText('Overdue') // ptest: "overdue first row"
    await expect(rows(page).first()).toContainText('Sterling Hollow Family Office')
    await expect(page.locator('#b-body').getByText('Overdue', { exact: true })).toHaveCount(1)
  })

  test('shows each bill with money from integer minor units', async ({ page }) => {
    await openBilling(page)
    const row = rows(page).filter({ hasText: 'Arkadios Home Office' }).filter({ hasText: 'Pending' })
    await expect(row).toContainText('Professional')
    await expect(row.getByRole('cell').nth(3)).toHaveText('64')
    await expect(row).toContainText('$26.00')
    await expect(row).toContainText('$1,664.00')
    await expect(row).toContainText('$116.48')
    await expect(row).toContainText('$1,780.48')
  })

  test('shows deadlines in the viewer\'s local time', async ({ browser }) => {
    for (const timezoneId of ['Pacific/Auckland', 'America/Los_Angeles']) {
      const context = await browser.newContext({ timezoneId })
      const page = await context.newPage()
      await openBilling(page)
      const time = rows(page).first().locator('time')
      const iso = (await time.getAttribute('datetime'))!
      expect(iso).toMatch(/Z$/) // the wire value is UTC
      const expected = new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: timezoneId })
      await expect(time).toHaveText(expected)
      await context.close()
    }
  })

  test('the Overview\'s #overdue link highlights the first overdue bill', async ({ page }) => {
    await openBilling(page, accounts.admin, '#overdue')
    await expect(page.locator('#b-body tr[data-highlighted]')).toHaveCount(1) // ptest: "overdue row highlighted"
    await expect(page.locator('#b-body tr[data-highlighted]')).toContainText('Overdue')
    await expect(page.locator('#b-body tr[data-highlighted]')).toBeInViewport()
  })
})

test.describe('filters, sorting and paging', () => {
  test('search, status and month narrow the list and live in the address bar', async ({ page }) => {
    await openBilling(page)
    await page.getByLabel('Search bills by tenant').fill('sterling')
    await expect(rows(page)).toHaveCount(2)
    await expect(page).toHaveURL(/[?]q=sterling$/)
    await page.getByLabel('Filter by status').selectOption('overdue')
    await expect(rows(page)).toHaveCount(1)
    await expect(page).toHaveURL(/[?]q=sterling&status=overdue$/)
    await page.getByLabel('Filter by status').selectOption('all')
    await page.getByLabel('Search bills by tenant').fill('')
    const thisMonth = new Date().toISOString().slice(0, 7)
    await page.getByLabel('Filter by month').fill(thisMonth)
    await expect(rows(page)).toHaveCount(5)
    await expect(page).toHaveURL(new RegExp(`[?]month=${thisMonth}$`))
  })

  test('the totals follow the search and the month, but not the status', async ({ page }) => {
    await openBilling(page)
    await page.getByLabel('Search bills by tenant').fill('sterling')
    await expect(tile(page, 'Billable')).toContainText('$1,724.84')
    await expect(tile(page, 'Overdue')).toContainText('$862.42')
    await page.getByLabel('Filter by status').selectOption('paid')
    await expect(rows(page)).toHaveCount(0)
    await expect(tile(page, 'Billable')).toContainText('$1,724.84') // unchanged by the status
  })

  test('the server does the filtering: the requests carry the filters', async ({ page }) => {
    await openBilling(page)
    const list = page.waitForRequest((r) => /\/bills\?/.test(r.url()) && r.url().includes('q=north'))
    const summary = page.waitForRequest((r) => /\/bills\/summary\?/.test(r.url()) && r.url().includes('q=north'))
    await page.getByLabel('Search bills by tenant').fill('north')
    const url = new URL((await list).url())
    expect(url.pathname).toBe('/api/platform/v1/bills')
    expect(url.searchParams.get('sort')).toBe('status')
    expect(url.searchParams.get('pageSize')).toBe('25')
    expect(new URL((await summary).url()).searchParams.get('status')).toBeNull()
  })

  test('sorts by Payable both ways, with aria-sort', async ({ page }) => {
    await openBilling(page)
    const header = page.getByRole('columnheader', { name: 'Payable' })
    await expect(page.getByRole('columnheader', { name: 'Status' })).toHaveAttribute('aria-sort', 'ascending')
    await header.getByRole('button').click()
    await expect(header).toHaveAttribute('aria-sort', 'ascending')
    await expect(rows(page).first()).toContainText('$862.42')
    await header.getByRole('button').click()
    await expect(header).toHaveAttribute('aria-sort', 'descending')
    await expect(rows(page).first()).toContainText('$7,712.56')
    await expect(page).toHaveURL(/[?]sort=-payable$/)
  })

  test('pages through the list with ?pageSize=4', async ({ page }) => {
    await signIn(page, accounts.admin, { next: '/billing?pageSize=4' })
    await expect(rows(page)).toHaveCount(4)
    const pager = page.getByRole('navigation', { name: 'Pages' })
    await expect(pager).toContainText('Showing 1 to 4 of 10')
    await pager.getByRole('button', { name: 'Next' }).click()
    await expect(pager).toContainText('Showing 5 to 8 of 10')
    await expect(page).toHaveURL(/[?]page=2&pageSize=4$/)
  })

  test('says so when nothing matches', async ({ page }) => {
    await openBilling(page)
    await page.getByLabel('Search bills by tenant').fill('zzz')
    await expect(page.locator('#b-body')).toContainText('No bills match. Clear the search or choose another status or month.')
  })
})

test.describe('the notice preview', () => {
  test('shows what the tenant sees, and Pay now is a preview that does nothing', async ({ page }) => {
    await openBilling(page)
    await rows(page).filter({ hasText: 'Arkadios Home Office' }).filter({ hasText: 'Pending' }).getByRole('button', { name: /Preview the bill notice/ }).click()
    const notice = dialog(page, 'What the tenant sees')
    await expect(notice).toContainText("The notice shown at the top of Arkadios Home Office’s workspace.")
    await expect(notice.getByTestId('notice-message')).toContainText('is ready') // ptest: "notice preview"
    await expect(notice.getByTestId('notice-message')).toContainText(/Your bill for \w+ \d{4} is ready\. Pay your bill before \w{3} \d{1,2}, \d{4}\./)
    await expect(notice).toContainText('Amount due $1,780.48. The tenant picks Stripe or PayPal on the payment page.')

    const pay = notice.getByRole('button', { name: 'Pay now' })
    await expect(notice.getByText('Preview only')).toBeVisible()
    await expect(pay).toHaveAttribute('aria-disabled', 'true')
    await pay.click({ force: true }) // Playwright will not click aria-disabled controls otherwise
    await page.waitForTimeout(300)
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0) // the demo showed a toast here
    await expect(notice).toBeVisible()

    await notice.getByRole('button', { name: 'Close' }).click()
    await expect(notice).toHaveCount(0)
  })

  test('is only for unpaid bills', async ({ page }) => {
    await openBilling(page)
    await expect(page.getByRole('button', { name: /Preview the bill notice/ })).toHaveCount(6)
    await expect(page.getByRole('button', { name: /Download invoice for/ })).toHaveCount(4)
  })
})

test.describe('extending a deadline', () => {
  async function openExtend(page: Page, tenant = 'Sterling Hollow Family Office', status = 'Overdue') {
    await rows(page).filter({ hasText: tenant }).filter({ hasText: status }).getByRole('button', { name: `Extend deadline for ${tenant}` }).click()
    const extend = dialog(page, 'Extend the deadline')
    await expect(extend).toBeVisible()
    return extend
  }

  test('opens with the bill described and 14 days chosen', async ({ page }) => {
    await openBilling(page)
    const extend = await openExtend(page)
    await expect(extend).toContainText(/Sterling Hollow Family Office, \w+ \d{4} bill\. Currently due \w{3} \d{1,2}, \d{4}\./)
    await expect(extend.getByRole('radio', { name: '14 days' })).toBeChecked()
    await expect(extend.getByRole('radio')).toHaveCount(3)
  })

  test('extending an overdue bill by 30 days makes it pending again', async ({ page }) => {
    await openBilling(page)
    const extend = await openExtend(page)
    await extend.getByRole('radio', { name: '30 days' }).check() // ptest: "30 days"
    await extend.getByRole('button', { name: 'Extend deadline' }).click()
    await expect(page.getByText('Deadline extended by 30 days')).toBeVisible()
    await expect(extend).toHaveCount(0)
    await expect(page.locator('#b-body').getByText('Overdue', { exact: true })).toHaveCount(0) // ptest: "extend clears overdue"
    await expect(tile(page, 'Overdue')).toContainText('$0.00')
    await expect(tile(page, 'Not yet paid')).toContainText('$17,618.62')
    await expect(rows(page).first()).toContainText('Pending')
  })

  test('sends the chosen days as a whole number', async ({ page }) => {
    await openBilling(page)
    const posted = page.waitForRequest((r) => r.method() === 'POST' && /\/bills\/[0-9a-f-]{36}\/extend$/.test(r.url()))
    const extend = await openExtend(page, 'Arkadios Home Office', 'Pending')
    await extend.getByRole('radio', { name: '7 days' }).check()
    await extend.getByRole('button', { name: 'Extend deadline' }).click()
    expect((await posted).postDataJSON()).toEqual({ days: 7 })
  })

  test('cannot be sent twice: a double click makes one request, and the page is locked while it runs', async ({ page }) => {
    await openBilling(page)
    let posts = 0
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/extend')) posts++
    })
    const extend = await openExtend(page)
    await extend.getByRole('button', { name: 'Extend deadline' }).dblclick()
    await expect(page.getByText('Deadline extended by 14 days')).toBeVisible()
    expect(posts).toBe(1)
  })

  test('Cancel and Escape close it without sending anything, and it opens fresh', async ({ page }) => {
    await openBilling(page)
    let posts = 0
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/extend')) posts++
    })
    let extend = await openExtend(page)
    await extend.getByRole('radio', { name: '30 days' }).check()
    await extend.getByRole('button', { name: 'Cancel' }).click()
    await expect(extend).toHaveCount(0)
    extend = await openExtend(page)
    await expect(extend.getByRole('radio', { name: '14 days' })).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(extend).toHaveCount(0)
    expect(posts).toBe(0)
  })

  test('the extension survives navigating away and back', async ({ page }) => {
    await openBilling(page)
    const extend = await openExtend(page)
    await extend.getByRole('button', { name: 'Extend deadline' }).click()
    await expect(page.getByText('Deadline extended by 14 days')).toBeVisible()
    await menuLinks(page).filter({ hasText: 'Tenants' }).click()
    await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible()
    await menuLinks(page).filter({ hasText: 'Billing' }).click()
    await expect(rows(page)).toHaveCount(10)
    await expect(page.locator('#b-body').getByText('Overdue', { exact: true })).toHaveCount(0)
  })
})

test.describe('invoices', () => {
  test('downloads a paid bill\'s invoice, named by the server', async ({ page }) => {
    await openBilling(page)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /^Download invoice for Arkadios Home Office, / }).click()
    const file = await download // ptest: "invoice downloads"
    expect(file.suggestedFilename()).toMatch(/^invoice-\d{4}-\d{2}-[0-9a-f-]{36}\.html$/)
    expect(file.suggestedFilename().startsWith('invoice-')).toBe(true)
    expect(file.suggestedFilename().endsWith('.html')).toBe(true)
    await expect(page.getByText('Invoice downloaded')).toBeVisible()
    const body = await readFile((await file.path())!, 'utf8')
    expect(body).toContain('Arkadios Home Office')
    expect(body).toContain('$1,780.48')
  })
})

test.describe('who can do what', () => {
  test('the billing manager can extend deadlines', async ({ page }) => {
    await openBilling(page, accounts.billing)
    await expect(page.getByRole('button', { name: /^Extend deadline for/ })).toHaveCount(6) // ptest3: "can extend deadlines"
    await expect(page.getByRole('button', { name: /^Preview the bill notice/ })).toHaveCount(6)
  })

  test('the super admin can extend deadlines', async ({ page }) => {
    await openBilling(page, accounts.admin)
    await expect(page.getByRole('button', { name: /^Extend deadline for/ })).toHaveCount(6)
  })

  for (const role of ['support', 'auditor'] as const) {
    test(`${role} can preview and download but cannot extend`, async ({ page }) => {
      await openBilling(page, accounts[role])
      await expect(page.getByRole('button', { name: /^Preview the bill notice/ })).toHaveCount(6) // ptest3: notice yes
      await expect(page.getByRole('button', { name: /^Download invoice for/ })).toHaveCount(4)
      await expect(page.getByRole('button', { name: /^Extend/ })).toHaveCount(0) // ptest3: "cannot extend deadlines"
    })
  }
})

test.describe('reopening a dialog while it fades out', () => {
  test('Extend the deadline reopens with its overlay behind it and takes clicks', async ({ page }) => {
    await openBilling(page)
    await slowContentFade(page)
    // By text, not by role: while a modal fades out the page behind it is aria-hidden, and a role locator would wait for it to go.
    const opener = rows(page).filter({ hasText: 'Sterling Hollow Family Office' }).filter({ hasText: 'Overdue' }).locator('button', { hasText: 'Extend' })
    await opener.click()
    const extend = dialog(page, 'Extend the deadline')
    await extend.getByRole('button', { name: 'Cancel' }).click()
    // The overlay has faded out and was removed; the content is still fading for 3s.
    await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0)
    await pressWithKeyboard(opener)
    await expect.poll(() => overlayBeforeContent(page, 'dialog')).toBe(true)
    await extend.getByRole('button', { name: 'Cancel' }).click({ timeout: 2000 })
    await expect(extend).toBeHidden()
  })
})
