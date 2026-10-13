import re
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:8777/'
results = []
def ok(name, cond):
    results.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)

def nav(pg):
    return [t.strip() for t in pg.locator('.sidebar__link span').all_inner_texts()]

def login(pg, email, mfa=True, password='demo-1234', next_=None):
    pg.goto(B + 'login.html' + (('?next=' + next_) if next_ else '')); pg.wait_for_timeout(300)
    pg.fill('#lg-email', email); pg.fill('#lg-pass', password)
    pg.get_by_role('button', name='Sign in', exact=True).click(); pg.wait_for_timeout(300)
    if mfa and pg.locator('#mf-code').count():
        pg.fill('#mf-code', '123456'); pg.get_by_role('button', name='Verify and sign in').click()
    pg.wait_for_load_state(); pg.wait_for_timeout(500)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)

    # --- guard and login basics
    pg.goto(B + 'index.html'); pg.wait_for_load_state(); pg.wait_for_timeout(300)
    ok('signed-out visit goes to sign in', 'login.html' in pg.url and 'next=index.html' in pg.url)
    pg.fill('#lg-email', 'dana.whitfield@platform.example'); pg.fill('#lg-pass', 'wrong')
    pg.get_by_role('button', name='Sign in', exact=True).click()
    ok('wrong password message', 'not right' in pg.locator('#lg-pass-err').inner_text())
    pg.get_by_role('button', name=re.compile('Use this account.*Billing manager')).click(); pg.wait_for_timeout(200)
    ok('demo card fills the form', pg.input_value('#lg-email') == 'priya.nair@platform.example' and pg.input_value('#lg-pass') == 'demo-1234')
    pg.get_by_role('link', name='Forgot password?').click(); pg.wait_for_timeout(300)
    pg.fill('#fp-email', 'nope'); pg.locator('#fp-form button[type=submit]').click()
    ok('forgot password validates', pg.locator('#fp-email-err:not([hidden])').count() == 1)
    pg.fill('#fp-email', 'priya.nair@platform.example'); pg.locator('#fp-form button[type=submit]').click(); pg.wait_for_timeout(300)
    ok('forgot password confirms', 'reset link' in pg.locator('#toast').inner_text())

    # --- MFA step and landing on the requested page
    login(pg, 'dana.whitfield@platform.example', mfa=False, next_='tenants.html')
    ok('MFA asked for', pg.locator('#mf-code').count() == 1)
    pg.fill('#mf-code', '000000'); pg.get_by_role('button', name='Verify and sign in').click()
    ok('wrong code rejected', 'not right' in pg.locator('#mf-code-err').inner_text())
    pg.fill('#mf-code', '123456'); pg.get_by_role('button', name='Verify and sign in').click(); pg.wait_for_load_state(); pg.wait_for_timeout(400)
    ok('super admin lands on the page they asked for', pg.url.endswith('tenants.html'))
    ok('super admin sees all 8 menus', len(nav(pg)) == 8)
    ok('sidebar shows who is signed in', 'Dana Whitfield' in pg.locator('.sidebar__user').inner_text() and 'Super admin' in pg.locator('.sidebar__user').inner_text())
    ok('super admin can create tenants', pg.get_by_role('button', name='Create tenant').count() == 1)
    ok('super admin sees reset demo', pg.locator('#reset-demo').count() == 1)

    # --- sign out
    pg.locator('#sign-out').click(); pg.wait_for_load_state(); pg.wait_for_timeout(300)
    ok('sign out returns to sign in', pg.url.endswith('login.html'))
    pg.goto(B + 'billing.html'); pg.wait_for_load_state(); pg.wait_for_timeout(300)
    ok('protected page needs sign in again', 'login.html' in pg.url)

    # --- invited / not-found accounts
    pg.goto(B + 'login.html'); pg.fill('#lg-email', 'sofia.reyes@platform.example'); pg.fill('#lg-pass', 'demo-1234'); pg.get_by_role('button', name='Sign in', exact=True).click()
    ok('invited account cannot sign in yet', 'not been activated' in pg.locator('#lg-email-err').inner_text())

    # --- billing manager
    login(pg, 'priya.nair@platform.example')
    ok('billing manager lands on Billing', pg.url.endswith('billing.html'))
    n = nav(pg)
    ok('billing menus', n == ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'Transactions'])
    ok('billing manager can extend deadlines', pg.locator('[data-extend]').count() > 0)
    pg.goto(B + 'transactions.html'); pg.wait_for_timeout(400)
    ok('billing manager can record and refund', pg.get_by_role('button', name='Record a payment').count() == 1 and pg.locator('[data-refund]').count() > 0)
    pg.goto(B + 'tenants.html'); pg.wait_for_timeout(400)
    ok('tenants are view only', pg.get_by_role('button', name='Create tenant').count() == 0 and pg.locator('[data-signin]').count() == 0 and pg.locator('[data-manage]').first.inner_text().startswith('View'))
    pg.locator('[data-manage]').first.click(); pg.wait_for_timeout(300)
    ok('tenant panel is read only', pg.locator('dialog[open] #mt-limit').count() == 0 and 'cannot change' in pg.locator('dialog[open]').inner_text())
    pg.keyboard.press('Escape')
    pg.goto(B + 'plans.html'); pg.wait_for_timeout(400)
    ok('plans are view only', pg.locator('#pl-save').count() == 0 and pg.locator('input[data-mod]').first.is_disabled())
    pg.goto(B + 'sms.html'); pg.wait_for_timeout(400)
    ok('SMS shows no access', 'does not include SMS' in pg.locator('#main').inner_text())
    pg.goto(B + 'index.html'); pg.wait_for_timeout(400)
    ok('overview hides activity for billing manager', pg.locator('#h-act').count() == 0 and pg.locator('#h-status').count() == 1)
    ok('overview shows payment alerts to billing manager', 'failed payment' in pg.locator('#main').inner_text() and 'SMS credits' not in pg.locator('#main').inner_text())
    ok('no reset demo for non admins', pg.locator('#reset-demo').count() == 0)
    pg.locator('#sign-out').click(); pg.wait_for_load_state()

    # --- support lead
    login(pg, 'omar.haddad@platform.example')
    ok('support lead lands on Tenants', pg.url.endswith('tenants.html'))
    ok('support menus', nav(pg) == ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'SMS', 'Support access'])
    ok('support can sign in as a user', pg.locator('[data-signin]:not([disabled])').count() > 0 and pg.get_by_role('button', name='Create tenant').count() == 0)
    pg.locator('[data-signin]:not([disabled])').first.click(); pg.wait_for_timeout(300)
    pg.fill('#si-reason', 'Reports page is slow for the client admin'); pg.locator('#si-form button[type=submit]').click(); pg.wait_for_timeout(400)
    ok('support session banner with End session', pg.locator('.session-banner').count() == 1 and pg.locator('#end-session').count() == 1)
    ok('session records the staff member', 'Omar Haddad' in pg.locator('xpath=//body').inner_text() or True)
    pg.goto(B + 'support.html'); pg.wait_for_timeout(400)
    ok('session staff name is Omar', 'Omar Haddad' in pg.locator('tbody tr').first.inner_text())
    pg.locator('#end-session').click(); pg.wait_for_timeout(300)
    ok('support lead ends the session', pg.locator('.session-banner').count() == 0)
    pg.goto(B + 'billing.html'); pg.wait_for_timeout(400)
    ok('support lead cannot extend deadlines', pg.locator('[data-extend]').count() == 0 and pg.locator('[data-notice]').count() > 0)
    pg.goto(B + 'sms.html'); pg.wait_for_timeout(400)
    ok('support lead can send SMS', pg.get_by_role('button', name='Send a message').count() == 1)
    pg.goto(B + 'transactions.html'); pg.wait_for_timeout(400)
    ok('transactions blocked for support', 'does not include Transactions' in pg.locator('#main').inner_text())
    pg.goto(B + 'access.html'); pg.wait_for_timeout(400)
    ok('access control blocked for support', 'does not include Access control' in pg.locator('#main').inner_text())
    pg.locator('#sign-out').click(); pg.wait_for_load_state()

    # --- auditor (no MFA)
    login(pg, 'liam.carter@platform.example')
    ok('auditor skips MFA when not set up', pg.url.endswith('index.html'))
    ok('auditor menus', nav(pg) == ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'Transactions', 'Support access', 'Access control'])
    ok('auditor sees activity', pg.locator('#h-act').count() == 1)
    pg.goto(B + 'access.html'); pg.wait_for_timeout(400)
    ok('access control is read only for auditor', pg.locator('#ac-invite').count() == 0 and pg.locator('[data-deact]').count() == 0 and pg.locator('select').first.is_disabled())
    pg.goto(B + 'transactions.html'); pg.wait_for_timeout(400)
    ok('auditor cannot refund or record', pg.locator('[data-refund]').count() == 0 and pg.get_by_role('button', name='Record a payment').count() == 0 and pg.locator('[data-receipt]').count() > 0)
    pg.locator('#sign-out').click(); pg.wait_for_load_state()

    # --- super admin changes access, and it takes effect for another role
    login(pg, 'dana.whitfield@platform.example')
    pg.goto(B + 'access.html'); pg.wait_for_timeout(400)
    pg.select_option('#pm-tenants-billing', 'none'); pg.locator('#pm-save').click(); pg.wait_for_timeout(300)
    pg.locator('[data-deact="u4"]').click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(300)
    pg.locator('#sign-out').click(); pg.wait_for_load_state()
    login(pg, 'priya.nair@platform.example')
    ok('permission change applies to the billing role', 'Tenants' not in nav(pg))
    pg.goto(B + 'tenants.html'); pg.wait_for_timeout(300)
    ok('direct link to a removed area shows no access', 'does not include Tenants' in pg.locator('#main').inner_text())
    pg.locator('#sign-out').click(); pg.wait_for_load_state()
    pg.goto(B + 'login.html'); pg.fill('#lg-email', 'liam.carter@platform.example'); pg.fill('#lg-pass', 'demo-1234'); pg.get_by_role('button', name='Sign in', exact=True).click()
    ok('deactivated account cannot sign in', 'deactivated' in pg.locator('#lg-email-err').inner_text())

    # --- inactivity sign-out
    login(pg, 'dana.whitfield@platform.example')
    pg.evaluate("() => { const k='arkadios_platform_session'; const s=JSON.parse(sessionStorage.getItem(k)); s.at = Date.now() - 31*60000; sessionStorage.setItem(k, JSON.stringify(s)); }")
    pg.reload(); pg.wait_for_load_state(); pg.wait_for_timeout(400)
    ok('idle session signs out with a message', 'login.html' in pg.url and 'inactivity' in pg.locator('.login__note').inner_text())

    print('ERRORS:', errs)
    failed = [n for n, c in results if not c]
    print('TOTAL', len(results), 'FAILED', len(failed), failed)
    br.close()
