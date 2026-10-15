import { expect, type Locator, type Page } from '@playwright/test'

export const PASSWORD = 'demo-1234'
export const CODE = '123456'

export const accounts = {
  admin: { email: 'dana.whitfield@platform.example', name: 'Dana Whitfield', label: 'Super admin' },
  support: { email: 'omar.haddad@platform.example', name: 'Omar Haddad', label: 'Support lead' },
  billing: { email: 'priya.nair@platform.example', name: 'Priya Nair', label: 'Billing manager' },
  auditor: { email: 'liam.carter@platform.example', name: 'Liam Carter', label: 'Auditor' },
} as const

export type Account = (typeof accounts)[keyof typeof accounts]

// Menus per role, from the demo (console_ptest3.py).
export const menus = {
  admin: ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'Transactions', 'SMS', 'Support access', 'Access control'],
  support: ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'SMS', 'Support access'],
  billing: ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'Transactions'],
  auditor: ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'Transactions', 'Support access', 'Access control'],
} as const

/** Signs in on the sign-in page that is already open (after a sign out), without reloading the page. */
export async function signInHere(page: Page, account: Account) {
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByLabel('Authentication code').fill(CODE)
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByRole('navigation', { name: 'Platform' })).toBeVisible()
}

export async function signIn(page: Page, account: Account, opts: { next?: string } = {}) {
  await page.goto('/login' + (opts.next ? `?next=${encodeURIComponent(opts.next)}` : ''))
  await signInHere(page, account)
}

/**
 * Signs out and signs in as someone else without reloading the page. The mock API keeps its data in the
 * page, so a reload would reset every change made so far; this is how a change is seen by another role.
 */
export async function switchTo(page: Page, account: Account) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)
  await signInHere(page, account)
}

/** Opens a path the way a pasted link would, but inside the running app (no reload, so the mock data stays). */
export async function openPath(page: Page, path: string) {
  await page.evaluate((to) => {
    history.pushState({}, '', to)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

export function menuLinks(page: Page) {
  return page.getByRole('navigation', { name: 'Platform' }).getByRole('link')
}

export function pageErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

/**
 * Radix fades a dialog's overlay (150ms) and its content (200ms) out separately. This stretches the content's fade
 * to 3s and leaves the overlay alone, so "the overlay is gone, the content is still there" lasts long enough to
 * reopen the dialog inside it, every time, instead of by luck.
 */
export async function slowContentFade(page: Page) {
  await page.addStyleTag({
    content: '[data-slot="dialog-content"][data-state="closed"], [data-slot="alert-dialog-content"][data-state="closed"] { animation-duration: 3s !important; }',
  })
}

/** True when the one open dialog has its overlay before its content, so the content sits on top and takes the clicks. */
export function overlayBeforeContent(page: Page, slot: 'dialog' | 'alert-dialog') {
  return page.evaluate((s) => {
    const overlays = document.querySelectorAll(`[data-slot="${s}-overlay"]`)
    const contents = document.querySelectorAll(`[data-slot="${s}-content"]`)
    if (overlays.length !== 1 || contents.length !== 1) return false
    return (overlays[0].compareDocumentPosition(contents[0]) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  }, slot)
}

/**
 * Presses a button with the keyboard. While a modal dialog is still fading out the page behind it ignores the mouse,
 * but a keypress still gets through, which is how a quick reopen reaches the dialog.
 */
export async function pressWithKeyboard(button: Locator) {
  await button.focus()
  await button.press('Enter')
}
