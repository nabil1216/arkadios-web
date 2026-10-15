// Ported from docs/handoff/tests/console_ptest2.py ("access control") and console_ptest3.py
// (access control blocked for Support, read only for the Auditor, a change applies to another role,
// a deactivated account cannot sign in). Differences from the demo, by design: there is no MFA switch
// and no inactivity select; a role change, a deactivation and a removal ask first; and "persist after
// reload" is ported as navigate away and back, because the mock API keeps its data in the page.
import { expect, test, type Page } from '@playwright/test'
import { accounts, menuLinks, menus, openPath, pageErrors, signIn, switchTo, type Account } from './helpers.ts'

const rows = (page: Page) => page.locator('tr[data-staff]')
const roleSelect = (page: Page, id: string) => page.locator(`#role-${id}`)
const toast = (page: Page, text: string | RegExp) => expect(page.locator('[data-sonner-toast]').filter({ hasText: text })).toBeVisible()
const confirm = (page: Page, title: string | RegExp) => page.getByRole('alertdialog', { name: title })
const save = (page: Page) => page.locator('#pm-save')
const discard = (page: Page) => page.locator('#pm-discard')

async function openAccess(page: Page, account: Account = accounts.admin) {
  await signIn(page, account, { next: '/access' })
  await expect(page.getByRole('heading', { name: 'Access control', level: 1 })).toBeVisible()
  await expect(rows(page)).toHaveCount(5)
  await expect(page.getByRole('columnheader', { name: /Super admin/ })).toBeVisible()
  if (account === accounts.admin) await expect(save(page)).toBeVisible() // the edit controls wait for the permissions
}

async function goToAccess(page: Page) {
  await menuLinks(page).filter({ hasText: 'Access control' }).click()
  await expect(page.getByRole('heading', { name: 'Access control', level: 1 })).toBeVisible()
  await expect(rows(page)).toHaveCount(5)
}

test.describe('the staff list', () => {
  test('the Access control menu opens the page', async ({ page }) => {
    await signIn(page, accounts.admin)
    await menuLinks(page).filter({ hasText: 'Access control' }).click()
    await expect(page).toHaveURL(/\/access$/)
    await expect(page.getByRole('heading', { name: 'Access control', level: 1 })).toBeVisible()
    await expect(page.getByText('Who can use the platform console, and what each role can do.')).toBeVisible()
  })

  test('shows the five staff with role, MFA, status and which row is you', async ({ page }) => {
    const errors = pageErrors(page)
    await openAccess(page) // ptest2: "5 staff rows"
    await expect(page.getByText('5 people')).toBeVisible()
    await expect(rows(page).filter({ hasText: 'Dana Whitfield' })).toContainText('(you)')
    await expect(rows(page).filter({ hasText: 'Dana Whitfield' })).toContainText('MFA on')
    await expect(rows(page).filter({ hasText: 'Sofia Reyes' })).toContainText('Invited')
    await expect(rows(page).filter({ hasText: 'Sofia Reyes' })).toContainText('MFA not set')
    await expect(roleSelect(page, 'u2')).toHaveValue('support')
    await expect(roleSelect(page, 'u3')).toHaveValue('billing')
    expect(errors).toEqual([])
  })

  test('your own role is locked and your row has no buttons', async ({ page }) => {
    await openAccess(page)
    await expect(roleSelect(page, 'u1')).toBeDisabled() // ptest2: "own role locked"
    await expect(rows(page).filter({ hasText: 'Dana Whitfield' }).getByRole('button')).toHaveCount(0)
    await expect(roleSelect(page, 'u2')).toBeEnabled()
  })

  test('MFA is required for everyone and the page gives no way to turn it off', async ({ page }) => {
    await openAccess(page)
    const panel = page.getByRole('region', { name: 'Sign-in security' })
    await expect(panel).toContainText('MFA is required for every staff member')
    await expect(panel).toContainText('Required')
    await expect(panel.getByRole('switch')).toHaveCount(0)
    await expect(panel.getByRole('checkbox')).toHaveCount(0)
    await expect(panel.getByRole('button')).toHaveCount(0)
    await expect(page.locator('#sec-mfa')).toHaveCount(0)
  })

  test('the inactivity time is the server\'s value, read only', async ({ page }) => {
    await openAccess(page)
    const panel = page.getByRole('region', { name: 'Sign-in security' })
    await expect(panel).toContainText('30 minutes')
    await expect(panel.getByRole('combobox')).toHaveCount(0)
    await expect(page.locator('#sec-idle')).toHaveCount(0)
  })
})

test.describe('change a role', () => {
  test('demoting asks first, naming the person and what they lose; Cancel is focused and changes nothing', async ({ page }) => {
    await openAccess(page)
    await roleSelect(page, 'u2').selectOption('billing')
    const dialog = confirm(page, 'Change Omar Haddad to Billing manager?')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Omar Haddad will lose:')
    await expect(dialog.getByRole('listitem')).toHaveText(['Change sms', 'Change support access'])
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    await expect(roleSelect(page, 'u2')).toHaveValue('support')
  })

  test('saves on confirm and says so', async ({ page }) => {
    await openAccess(page)
    await roleSelect(page, 'u2').selectOption('billing')
    await confirm(page, 'Change Omar Haddad to Billing manager?').getByRole('button', { name: 'Change role' }).click()
    await toast(page, 'Omar Haddad is now Billing manager') // ptest2: "role change saved"
    await expect(roleSelect(page, 'u2')).toHaveValue('billing')
  })

  test('handing out access.manage asks first, even though nothing is lost', async ({ page }) => {
    await openAccess(page)
    await roleSelect(page, 'u2').selectOption('admin')
    const dialog = confirm(page, 'Change Omar Haddad to Super admin?')
    await expect(dialog).toContainText('Omar Haddad will be able to do that too')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await dialog.getByRole('button', { name: 'Change role' }).click()
    await toast(page, 'Omar Haddad is now Super admin')
  })
})

test.describe('deactivate, reactivate, remove, resend', () => {
  test('deactivating asks first, then Reactivate brings the person back', async ({ page }) => {
    await openAccess(page)
    await page.getByRole('button', { name: 'Deactivate Liam Carter' }).click()
    const dialog = confirm(page, 'Deactivate Liam Carter?')
    await expect(dialog).toContainText('can no longer sign in')
    await expect(dialog).toContainText('Liam Carter will lose, as Auditor:')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await dialog.getByRole('button', { name: 'Deactivate' }).click()
    await expect(page.getByRole('button', { name: 'Reactivate Liam Carter' })).toBeVisible() // ptest2: "deactivate"
    await expect(rows(page).filter({ hasText: 'Liam Carter' })).toContainText('Deactivated')
    await expect(roleSelect(page, 'u4')).toBeDisabled()
    await page.getByRole('button', { name: 'Reactivate Liam Carter' }).click()
    await expect(page.getByRole('button', { name: 'Deactivate Liam Carter' })).toBeVisible() // ptest2: "reactivate"
    await toast(page, 'Liam Carter is active again')
  })

  test('cancelling a deactivation changes nothing', async ({ page }) => {
    await openAccess(page)
    await page.getByRole('button', { name: 'Deactivate Liam Carter' }).click()
    await confirm(page, 'Deactivate Liam Carter?').getByRole('button', { name: 'Cancel' }).click()
    await expect(rows(page).filter({ hasText: 'Liam Carter' })).toContainText('Active')
  })

  test('removing asks first and takes the person off the list', async ({ page }) => {
    await openAccess(page)
    await page.getByRole('button', { name: 'Remove Priya Nair' }).click()
    const dialog = confirm(page, 'Remove Priya Nair?')
    await expect(dialog).toContainText('loses access to this console for good')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await dialog.getByRole('button', { name: 'Remove' }).click()
    await toast(page, 'Priya Nair was removed')
    await expect(rows(page)).toHaveCount(4)
    await expect(page.getByText('4 people')).toBeVisible()
  })

  test('resends an invitation without asking', async ({ page }) => {
    await openAccess(page)
    await page.getByRole('button', { name: 'Resend invite Sofia Reyes' }).click()
    await toast(page, 'sent again') // ptest2: "resend invite toast"
  })
})

test.describe('invite a staff member', () => {
  const open = async (page: Page) => {
    await openAccess(page)
    await page.getByRole('button', { name: 'Invite staff member' }).click()
    const dialog = page.getByRole('dialog', { name: 'Invite a staff member' })
    await expect(dialog).toBeVisible()
    return dialog
  }

  test('has a name, an email and a role, and no password: Cancel is focused first', async ({ page }) => {
    const dialog = await open(page)
    await expect(dialog.getByLabel('Full name')).toBeVisible()
    await expect(dialog.getByLabel('Work email')).toBeVisible()
    await expect(dialog.getByLabel('Role')).toHaveValue('support')
    await expect(dialog.locator('input[type="password"]')).toHaveCount(0)
    await expect(dialog.getByLabel(/password/i)).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  })

  test('shows both errors for an empty form and refuses an email that already has access', async ({ page }) => {
    const dialog = await open(page)
    await dialog.getByRole('button', { name: 'Send invitation' }).click()
    await expect(dialog.getByRole('alert')).toHaveCount(2) // ptest2: "invite validation"
    await dialog.getByLabel('Full name').fill('Test Person')
    await dialog.getByLabel('Work email').fill('liam.carter@platform.example')
    await dialog.getByRole('button', { name: 'Send invitation' }).click()
    await expect(dialog.getByText('This person already has access.')).toBeVisible() // ptest2: "duplicate email blocked"
  })

  test('invites a person: a new Invited row, and no password anywhere', async ({ page }) => {
    const dialog = await open(page)
    await dialog.getByLabel('Full name').fill('Test Person')
    await dialog.getByLabel('Work email').fill('test.person@platform.example')
    await dialog.getByLabel('Role').selectOption('auditor')
    await dialog.getByRole('button', { name: 'Send invitation' }).click()
    await toast(page, 'Invitation sent to test.person@platform.example')
    await expect(rows(page)).toHaveCount(6) // ptest2: "invite adds a row"
    const row = rows(page).filter({ hasText: 'Test Person' })
    await expect(row).toContainText('Invited')
    await expect(row).toContainText('MFA not set')
    await expect(page.getByLabel('Role for Test Person')).toHaveValue('auditor')
    await expect(page.getByRole('button', { name: 'Invite staff member' })).toBeFocused()
  })

  test('inviting into a role with access.manage asks first', async ({ page }) => {
    const dialog = await open(page)
    await dialog.getByLabel('Full name').fill('Test Person')
    await dialog.getByLabel('Work email').fill('test.person@platform.example')
    await dialog.getByLabel('Role').selectOption('admin')
    await dialog.getByRole('button', { name: 'Send invitation' }).click()
    const ask = confirm(page, 'Invite Test Person as Super admin?')
    await expect(ask).toBeVisible()
    await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await expect(rows(page)).toHaveCount(5)
    await ask.getByRole('button', { name: 'Send invitation' }).click()
    await toast(page, 'Invitation sent to test.person@platform.example')
    await expect(rows(page)).toHaveCount(6)
  })
})

test.describe('what each role can do', () => {
  test('shows a column per role with its people, and the Super admin column is locked', async ({ page }) => {
    await openAccess(page)
    await expect(page.getByRole('columnheader', { name: /Support lead/ })).toContainText('2 people')
    await expect(page.getByRole('columnheader', { name: /Super admin/ })).toContainText('Locked')
    await expect(page.locator('#pm-tenants-admin')).toBeDisabled() // ptest2: "admin column locked"
    await expect(page.locator('#pm-sms-billing')).toHaveValue('none')
    await expect(page.locator('#pm-billing-support')).toHaveValue('view')
    await expect(page.locator('#pm-access-auditor')).toHaveValue('view')
  })

  test('Save is off while clean, on once something changes, and Discard puts it back', async ({ page }) => {
    await openAccess(page)
    await expect(save(page)).toBeDisabled() // ptest2: "save disabled when clean"
    await page.locator('#pm-sms-billing').selectOption('view')
    await expect(save(page)).toBeEnabled() // ptest2: "save enabled when changed"
    await discard(page).click()
    await expect(page.locator('#pm-sms-billing')).toHaveValue('none') // ptest2: "discard reverts"
    await expect(save(page)).toBeDisabled()
  })

  test('saves a change that adds, and it is still there after navigating away and back', async ({ page }) => {
    await openAccess(page)
    await page.locator('#pm-sms-billing').selectOption('view')
    await save(page).click()
    await toast(page, 'Role changes saved')
    await menuLinks(page).filter({ hasText: 'Overview' }).click()
    await expect(page.getByRole('heading', { name: /Platform overview/ })).toBeVisible()
    await goToAccess(page)
    await expect(page.locator('#pm-sms-billing')).toHaveValue('view') // ptest2: "permissions persist"
  })

  test('taking permissions away asks first, with how many people it affects', async ({ page }) => {
    await openAccess(page)
    await page.locator('#pm-billing-support').selectOption('none')
    await save(page).click()
    const dialog = confirm(page, 'Take permissions away from these roles?')
    await expect(dialog).toContainText('Support lead (2 people) will lose:')
    await expect(dialog.getByRole('listitem')).toHaveText(['View billing'])
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.locator('#pm-billing-support')).toHaveValue('none') // the edit is kept to change its mind
    await save(page).click()
    await confirm(page, 'Take permissions away from these roles?').getByRole('button', { name: 'Save changes' }).click()
    await toast(page, 'Role changes saved')
  })

  test('giving a role Access control asks first', async ({ page }) => {
    await openAccess(page)
    await page.locator('#pm-access-auditor').selectOption('manage')
    await save(page).click()
    const dialog = confirm(page, 'Give these roles access to Access control?')
    await expect(dialog).toContainText('Auditor (1 person) will be able to change who has access')
  })
})

test.describe('who sees what', () => {
  test('the Auditor sees the page, read only', async ({ page }) => {
    await signIn(page, accounts.auditor)
    await expect(menuLinks(page)).toHaveText([...menus.auditor])
    await menuLinks(page).filter({ hasText: 'Access control' }).click()
    await expect(rows(page)).toHaveCount(5)
    await expect(page.getByRole('combobox').first()).toBeDisabled() // ptest3: "read only for auditor"
    for (const select of await page.getByRole('combobox').all()) await expect(select).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Invite staff member' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^(Deactivate|Reactivate|Remove|Resend)/ })).toHaveCount(0)
    await expect(save(page)).toHaveCount(0)
    await expect(discard(page)).toHaveCount(0)
  })

  for (const key of ['support', 'billing'] as const) {
    test(`${accounts[key].label} has no Access control: no menu item, and the direct link says so`, async ({ page }) => {
      await signIn(page, accounts[key], { next: '/access' })
      await expect(menuLinks(page).filter({ hasText: 'Access control' })).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible() // ptest3: "access control blocked for support"
      await expect(page.getByText(`does not include Access control`)).toBeVisible()
    })
  }
})

test.describe('a change takes effect for the next person', () => {
  test('a role loses a permission and a person is deactivated: the next sign-in sees both', async ({ page }) => {
    await openAccess(page)
    await page.locator('#pm-tenants-billing').selectOption('none')
    await save(page).click()
    await confirm(page, 'Take permissions away from these roles?').getByRole('button', { name: 'Save changes' }).click()
    await toast(page, 'Role changes saved')
    await page.getByRole('button', { name: 'Deactivate Liam Carter' }).click()
    await confirm(page, 'Deactivate Liam Carter?').getByRole('button', { name: 'Deactivate' }).click()
    await expect(page.getByRole('button', { name: 'Reactivate Liam Carter' })).toBeVisible()

    await switchTo(page, accounts.billing)
    await expect(menuLinks(page).filter({ hasText: 'Tenants' })).toHaveCount(0) // ptest3: "permission change applies to the billing role"
    await openPath(page, '/tenants')
    await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible() // ptest3: "direct link to a removed area shows no access"
    await expect(page.getByText('does not include Tenants')).toBeVisible()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login/)
    await page.getByLabel('Email').fill(accounts.auditor.email)
    await page.getByLabel('Password').fill('demo-1234')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Incorrect email or password.')).toBeVisible() // ptest3: "deactivated account cannot sign in", with the generic message
  })

  test('a manager cannot touch someone who can do more than they can, nor hand out a role they do not hold', async ({ page }) => {
    await openAccess(page)
    await page.locator('#pm-access-support').selectOption('manage')
    await save(page).click()
    await confirm(page, 'Give these roles access to Access control?').getByRole('button', { name: 'Save changes' }).click()
    await toast(page, 'Role changes saved')

    await switchTo(page, accounts.support)
    await menuLinks(page).filter({ hasText: 'Access control' }).click()
    await expect(rows(page)).toHaveCount(5)
    // Out of reach: Dana (Super admin), Priya (Billing manager) and Liam (Auditor) hold permissions Omar lacks.
    for (const id of ['u1', 'u3', 'u4']) {
      await expect(roleSelect(page, id)).toBeDisabled()
      await expect(page.locator(`tr[data-staff="${id}"]`).getByRole('button')).toHaveCount(0)
    }
    // Within reach: Sofia is a Support lead too. Omar still cannot make her a Super admin, which he is not.
    await expect(roleSelect(page, 'u5')).toBeEnabled()
    await roleSelect(page, 'u5').selectOption('admin')
    await expect(page.getByRole('alert')).toContainText('You cannot grant what you do not hold yourself')
    await expect(roleSelect(page, 'u5')).toHaveValue('support')
  })
})
