import re
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:8777/'
results = []
def ok(name, cond):
    results.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    ctx.add_init_script("if(!sessionStorage.getItem('arkadios_platform_session')) sessionStorage.setItem('arkadios_platform_session', JSON.stringify({userId:'u1', at: Date.now()}))")
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)

    # nav
    pg.goto(B + 'index.html')
    for label, url in [('Transactions', 'transactions.html'), ('SMS', 'sms.html'), ('Access control', 'access.html')]:
        pg.get_by_role('link', name=label, exact=True).first.click(); pg.wait_for_load_state()
        ok('nav -> ' + label, pg.url.endswith(url))
    ok('8 sidebar links', pg.locator('.sidebar__link').count() == 8)

    # overview attention links to new pages
    pg.goto(B + 'index.html')
    ok('attention: failed payment item', 'failed payment' in pg.locator('#main').inner_text())
    pg.get_by_role('link', name='Open transactions').click(); pg.wait_for_load_state(); pg.wait_for_timeout(300)
    ok('deep link filters to failed', pg.locator('#x-body tr').count() == 1 and pg.input_value('#x-status') == 'failed')
    ok('failed row has Retry', pg.get_by_role('button', name=re.compile('^Retry')).count() == 1)
    pg.get_by_role('button', name=re.compile('^Retry')).click(); pg.wait_for_timeout(300)
    ok('retry -> no failed rows left', pg.locator('#x-body tr').count() == 1 and 'No transactions match' in pg.locator('#x-body').inner_text())
    pg.select_option('#x-status', 'all')
    ok('6 rows after clearing filter', pg.locator('#x-body tr').count() == 6)
    ok('stripe filter', (pg.select_option('#x-method', 'stripe') and pg.locator('#x-body tr').count()) == 3)
    pg.select_option('#x-method', 'all')
    pg.fill('#x-q', 'quillon'); ok('search tenant', pg.locator('#x-body tr').count() == 2); pg.fill('#x-q', '')

    # pending bank transfer -> received
    pg.get_by_role('button', name=re.compile('^Mark received')).click(); pg.wait_for_timeout(300)
    ok('mark received', pg.get_by_role('button', name=re.compile('^Mark received')).count() == 0)

    # receipt + download
    pg.locator('[data-receipt]').first.click(); pg.wait_for_timeout(300)
    ok('receipt opens', 'Net to you' in pg.locator('dialog[open]').inner_text())
    with pg.expect_download() as d:
        pg.locator('dialog[open] [data-dl]').click()
    ok('receipt downloads', d.value.suggested_filename.startswith('receipt-'))
    pg.locator('dialog[open] [data-close2]').click(); pg.wait_for_timeout(200)

    # refund -> bill back to pending
    before_paid = None
    pg.goto(B + 'billing.html'); before_paid = pg.locator('.badge--paid').count()
    pg.goto(B + 'transactions.html')
    pg.locator('[data-refund]').first.click(); pg.wait_for_timeout(250)
    pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(300)
    ok('refunded status shown', pg.locator('.badge--refunded').count() == 1)
    pg.goto(B + 'billing.html'); ok('bill returned to pending', pg.locator('.badge--paid').count() == before_paid - 1)

    # record a payment
    pg.goto(B + 'transactions.html'); n0 = pg.locator('#x-body tr').count()
    pg.get_by_role('button', name='Record a payment').click(); pg.wait_for_timeout(300)
    pg.locator('#rp-form button[type=submit]').click()
    ok('reference required', pg.locator('#rp-ref-err:not([hidden])').count() == 1)
    pg.fill('#rp-ref', 'TRF-90001'); pg.locator('#rp-form button[type=submit]').click(); pg.wait_for_timeout(300)
    ok('payment recorded', pg.locator('#x-body tr').count() == n0 + 1 and 'TRF-90001' in pg.locator('#x-body').inner_text())
    with pg.expect_download() as d2:
        pg.get_by_role('button', name='Export CSV').click()
    ok('csv export', d2.value.suggested_filename == 'transactions.csv')

    # SMS
    pg.goto(B + 'sms.html')
    ok('platform balance 48,200', '48,200' in pg.locator('.totals').inner_text())
    pg.get_by_role('button', name='Buy credits').click(); pg.wait_for_timeout(300)
    pg.get_by_label(re.compile('10,000 credits')).check(); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(300)
    ok('buy credits adds to balance', '58,200' in pg.locator('.totals').inner_text())
    pg.locator('[data-addcr="t3"]').click(); pg.wait_for_timeout(300)
    pg.fill('#ac-n', '999999'); pg.locator('#ac-form button[type=submit]').click()
    ok('add credits over balance blocked', pg.locator('#ac-n-err:not([hidden])').count() == 1)
    pg.fill('#ac-n', '600'); pg.locator('#ac-form button[type=submit]').click(); pg.wait_for_timeout(300)
    ok('tenant credits updated', '900' in pg.locator('tr', has_text='Cobalt Ridge').inner_text())
    pg.get_by_role('button', name='Send a message').click(); pg.wait_for_timeout(300)
    pg.locator('#sd-form button[type=submit]').click()
    ok('empty message blocked', pg.locator('#sd-text-err:not([hidden])').count() == 1)
    pg.select_option('#sd-aud', 'pick'); pg.fill('#sd-text', 'x' * 200); pg.locator('#sd-form button[type=submit]').click()
    ok('choose at least one tenant', 'Choose at least one' in pg.locator('#sd-text-err').inner_text())
    pg.locator('[data-pick]').first.check(); pg.locator('[data-pick]').nth(1).check()
    ok('summary counts credits (2 x 2)', '4 credits' in pg.locator('#sd-sum').inner_text())
    pg.locator('#sd-form button[type=submit]').click(); pg.wait_for_timeout(300)
    ok('balance reduced by 4 after the 600 moved to Cobalt', '57,596' in pg.locator('.totals').inner_text())
    ok('message logged', pg.locator('section', has_text='Messages sent').locator('tbody tr').count() == 4)

    # access control
    pg.goto(B + 'access.html')
    ok('5 staff rows', pg.locator('section').first.locator('tbody tr').count() == 5)
    ok('own role locked', pg.locator('#role-u1').is_disabled())
    pg.select_option('#role-u2', 'billing'); pg.wait_for_timeout(300)
    ok('role change saved', 'is now Billing manager' in pg.locator('#toast').inner_text())
    pg.locator('[data-deact="u4"]').click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(300)
    ok('deactivate', pg.locator('[data-react="u4"]').count() == 1)
    pg.locator('[data-react="u4"]').click(); pg.wait_for_timeout(300)
    ok('reactivate', pg.locator('[data-deact="u4"]').count() == 1)
    pg.locator('[data-resend="u5"]').click(); ok('resend invite toast', 'sent again' in pg.locator('#toast').inner_text())
    pg.get_by_role('button', name='Invite staff member').click(); pg.wait_for_timeout(300)
    pg.locator('#iv-form button[type=submit]').click(); ok('invite validation', pg.locator('dialog[open] .error:not([hidden])').count() == 2)
    pg.fill('#iv-name', 'Test Person'); pg.fill('#iv-email', 'liam.carter@platform.example'); pg.locator('#iv-form button[type=submit]').click()
    ok('duplicate email blocked', 'already has access' in pg.locator('#iv-email-err').inner_text())
    pg.fill('#iv-email', 'test.person@platform.example'); pg.locator('#iv-form button[type=submit]').click(); pg.wait_for_timeout(300)
    ok('invite adds a row', pg.locator('section').first.locator('tbody tr').count() == 6)
    ok('save disabled when clean', pg.locator('#pm-save').is_disabled())
    pg.select_option('#pm-sms-billing', 'view'); ok('save enabled when changed', pg.locator('#pm-save').is_enabled())
    pg.locator('#pm-discard').click(); pg.wait_for_timeout(200)
    ok('discard reverts', pg.input_value('#pm-sms-billing') == 'none')
    pg.select_option('#pm-sms-billing', 'view'); pg.locator('#pm-save').click(); pg.wait_for_timeout(200)
    pg.set_checked('#sec-mfa', False, force=True); pg.select_option('#sec-idle', '60'); pg.wait_for_timeout(200)
    pg.reload(); pg.wait_for_timeout(400)
    ok('permissions persist', pg.input_value('#pm-sms-billing') == 'view')
    ok('security persists', pg.input_value('#sec-idle') == '60' and not pg.is_checked('#sec-mfa'))
    ok('admin column locked', pg.locator('#pm-tenants-admin').is_disabled())

    # manage drawer shows SMS credits
    pg.goto(B + 'tenants.html'); pg.locator('[data-manage="t1"]').click(); pg.wait_for_timeout(300)
    ok('manage shows SMS credits', 'SMS credits' in pg.locator('dialog[open] .facts').inner_text())

    print('ERRORS:', errs)
    failed = [n for n, c in results if not c]
    print('TOTAL', len(results), 'FAILED', len(failed), failed)
    br.close()
