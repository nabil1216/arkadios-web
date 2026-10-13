import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'demo-1234'
export const CODE = '123456'

export const accounts = {
  admin: { email: 'dana.whitfield@platform.example', name: 'Dana Whitfield', label: 'Super admin', mfa: true },
  support: { email: 'omar.haddad@platform.example', name: 'Omar Haddad', label: 'Support lead', mfa: true },
  billing: { email: 'priya.nair@platform.example', name: 'Priya Nair', label: 'Billing manager', mfa: true },
  auditor: { email: 'liam.carter@platform.example', name: 'Liam Carter', label: 'Auditor', mfa: false },
} as const

export type Account = (typeof accounts)[keyof typeof accounts]

// Menus per role, from the demo (console_ptest3.py).
export const menus = {
  admin: ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'Transactions', 'SMS', 'Support access', 'Access control'],
  support: ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'SMS', 'Support access'],
  billing: ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'Transactions'],
  auditor: ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'Transactions', 'Support access', 'Access control'],
} as const

export async function signIn(page: Page, account: Account, opts: { next?: string } = {}) {
  await page.goto('/login' + (opts.next ? `?next=${encodeURIComponent(opts.next)}` : ''))
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  if (account.mfa) {
    await page.getByLabel('Authentication code').fill(CODE)
    await page.getByRole('button', { name: 'Verify' }).click()
  }
  await expect(page.getByRole('navigation', { name: 'Platform' })).toBeVisible()
}

export function menuLinks(page: Page) {
  return page.getByRole('navigation', { name: 'Platform' }).getByRole('link')
}

export function pageErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}
