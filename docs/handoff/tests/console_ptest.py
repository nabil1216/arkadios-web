import re, json
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:8777/'
results = []
def ok(name, cond):
    results.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    ctx.add_init_script("if(!sessionStorage.getItem('arkadios_platform_session')) sessionStorage.setItem('arkadios_platform_session', JSON.stringify({userId:'u1', at: Date.now()}))")
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    pg.on('requestfailed', lambda r: errs.append('failed: ' + r.url))

    # ---- sidebar links
    pg.goto(B + 'index.html')
    ok('overview heading', pg.get_by_role('heading', name='Platform overview').is_visible())
    for label, url in [('Tenants', 'tenants.html'), ('Plans and modules', 'plans.html'), ('Billing', 'billing.html'), ('Support access', 'support.html'), ('Overview', 'index.html')]:
        pg.get_by_role('link', name=label).first.click(); pg.wait_for_load_state()
        ok('nav -> ' + label, pg.url.endswith(url))

    # ---- overview: retry migration, attention links
    pg.goto(B + 'index.html')
    ok('quillon shows Retry', pg.get_by_role('button', name=re.compile('Retry')).count() == 1)
    pg.get_by_role('button', name=re.compile('Retry')).click()
    ok('retry clears the failed migration', pg.get_by_role('button', name=re.compile('Retry')).count() == 0)
    ok('retry toast', 'is now on 2.4.0' in pg.locator('#toast').inner_text())
    pg.get_by_role('link', name='Open billing').click(); pg.wait_for_load_state()
    ok('Open billing link', pg.url.endswith('billing.html#overdue'))
    ok('overdue row highlighted', pg.locator('tr.highlight-row').count() == 1)
    pg.goto(B + 'index.html')
    pg.get_by_role('link', name='Review limit').click(); pg.wait_for_load_state(); pg.wait_for_timeout(400)
    ok('Review limit opens manage drawer', pg.locator('dialog[open]').count() == 1 and 'Cobalt Ridge' in pg.locator('dialog[open]').inner_text())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    ok('Escape closes drawer', pg.locator('dialog[open]').count() == 0)

    # ---- tenants: search and filter
    pg.goto(B + 'tenants.html')
    ok('6 rows at start', pg.locator('#t-body tr').count() == 6)
    pg.fill('#t-q', 'north'); ok('search filters to 1', pg.locator('#t-body tr').count() == 1)
    pg.fill('#t-q', 'zzz'); ok('empty state shown', 'No tenants match' in pg.locator('#t-body').inner_text())
    pg.fill('#t-q', ''); pg.select_option('#t-status', 'suspended'); ok('status filter', pg.locator('#t-body tr').count() == 1)
    pg.select_option('#t-status', 'all')

    # ---- create tenant: validation then success
    pg.get_by_role('button', name='Create tenant').first.click(); pg.wait_for_timeout(300)
    pg.locator('dialog[open] form button[type=submit]').click()
    ok('validation errors shown', pg.locator('dialog[open] .error:not([hidden])').count() >= 3)
    pg.fill('#ct-name', 'Harbor Lane Advisors')
    ok('domain auto-filled', pg.input_value('#ct-sub') == 'harbor-lane-advisors')
    pg.fill('#ct-email', 'it@harborlane.example')
    pg.select_option('#ct-plan', 'enterprise')
    ok('plan hint updates', 'Adds integrations' in pg.locator('#ct-plan-hint').inner_text())
    pg.locator('dialog[open] form button[type=submit]').click()
    pg.wait_for_selector('.done-note', timeout=15000)
    ok('provisioning finishes', 'Harbor Lane Advisors is ready' in pg.locator('.done-note').inner_text())
    pg.get_by_role('button', name='Manage tenant').click(); pg.wait_for_timeout(300)
    ok('manage opens from done panel', 'tenant_harbor_lane_advisors' in pg.locator('dialog[open]').inner_text())
    # limit edit
    pg.fill('#mt-limit', '80'); pg.get_by_role('button', name='Save limit').click(); pg.wait_for_timeout(200)
    ok('limit saved', pg.input_value('#mt-limit') == '80')
    # suspend with confirm
    pg.get_by_role('button', name='Suspend tenant').click(); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='Suspend tenant').last.click(); pg.wait_for_timeout(300)
    ok('suspended', 'Suspended' in pg.locator('dialog[open] .facts').inner_text())
    pg.get_by_role('button', name='Reactivate tenant').click(); pg.wait_for_timeout(200)
    ok('reactivated', 'Active' in pg.locator('dialog[open] .facts').inner_text())
    # export
    with pg.expect_download() as d:
        pg.get_by_role('button', name='Export all data').click()
    ok('export downloads a file', d.value.suggested_filename == 'export-harbor-lane-advisors.json')
    # offboard needs typed name
    pg.get_by_role('button', name='Offboard tenant').click(); pg.wait_for_timeout(200)
    btn = pg.get_by_role('button', name='Start offboarding')
    ok('offboard disabled until typed', btn.is_disabled())
    pg.fill('#cf-typed', 'Harbor Lane Advisors'); ok('offboard enabled after typing', btn.is_enabled())
    btn.click(); pg.wait_for_timeout(300)
    ok('offboarding status', 'Offboarding' in pg.locator('dialog[open] .facts').inner_text())
    pg.locator('dialog[open] [data-close]').first.click(); pg.wait_for_timeout(200)

    # ---- sign in as -> banner -> end session
    pg.locator('[data-signin]:not([disabled])').first.click(); pg.wait_for_timeout(300)
    pg.locator('#si-reason').fill('too short'); pg.locator('#si-form button[type=submit]').click()
    ok('reason required', pg.locator('#si-reason-err:not([hidden])').count() == 1)
    pg.fill('#si-reason', 'Checklist did not create tasks after a stage move')
    pg.locator('#si-form button[type=submit]').click(); pg.wait_for_timeout(300)
    ok('banner appears', pg.locator('.session-banner').count() == 1)
    pg.goto(B + 'support.html')
    ok('banner persists across pages', pg.locator('.session-banner').count() == 1)
    ok('start button opens message while active', True)
    pg.get_by_role('button', name='Start support session').click(); pg.wait_for_timeout(200)
    ok('second session blocked', 'already open' in pg.locator('dialog[open]').inner_text())
    pg.get_by_role('button', name='End that session').click(); pg.wait_for_timeout(300)
    ok('session ended', pg.locator('.session-banner').count() == 0)
    ok('sessions table has live->ended', pg.locator('tbody tr').count() == 3 and pg.locator('.badge--live').count() == 0)

    # ---- plans: toggle, discard, save
    pg.goto(B + 'plans.html')
    ok('save disabled when clean', pg.locator('#pl-save').is_disabled())
    sw = pg.locator('input[data-mod="integrations"][data-plan="professional"]')
    sw.check(force=True); ok('save enabled when dirty', pg.locator('#pl-save').is_enabled())
    pg.locator('#pl-discard').click(); pg.wait_for_timeout(200)
    ok('discard reverts', not pg.locator('input[data-mod="integrations"][data-plan="professional"]').is_checked() and pg.locator('#pl-save').is_disabled())
    pg.locator('input[data-mod="integrations"][data-plan="professional"]').check(force=True)
    pg.fill('#trial-essentials', '21')
    pg.locator('#pl-save').click(); pg.wait_for_timeout(200)
    ok('save persists', pg.locator('#pl-save').is_disabled() and 'saved' in pg.locator('#toast').inner_text())
    pg.reload(); pg.wait_for_timeout(300)
    ok('plans persist after reload', pg.locator('input[data-mod="integrations"][data-plan="professional"]').is_checked() and pg.input_value('#trial-essentials') == '21')

    # ---- billing: totals, extend, notice, invoice
    pg.goto(B + 'billing.html')
    ok('overdue first row', 'Overdue' in pg.locator('tbody tr').first.inner_text())
    pg.locator('[data-notice]').first.click(); pg.wait_for_timeout(200)
    ok('notice preview', 'is ready' in pg.locator('dialog[open]').inner_text())
    pg.get_by_role('button', name='Pay now').click(); ok('pay now toast', 'Stripe or PayPal' in pg.locator('#toast').inner_text())
    pg.locator('dialog[open] [data-close2]').click(); pg.wait_for_timeout(200)
    pg.locator('[data-extend]').first.click(); pg.wait_for_timeout(200)
    pg.get_by_label('30 days').check(); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(300)
    ok('extend clears overdue', pg.locator('.badge--overdue').count() == 0)
    with pg.expect_download() as d2:
        pg.locator('[data-invoice]').first.click()
    ok('invoice downloads', d2.value.suggested_filename.startswith('invoice-') and d2.value.suggested_filename.endswith('.html'))

    # ---- reset demo
    pg.get_by_role('button', name='Reset demo data').click(); pg.wait_for_timeout(200)
    pg.get_by_role('button', name='Reset demo data').last.click(); pg.wait_for_load_state(); pg.wait_for_timeout(500)
    pg.goto(B + 'tenants.html'); ok('reset restores 6 tenants', pg.locator('#t-body tr').count() == 6)

    print('ERRORS:', errs)
    failed = [n for n, c in results if not c]
    print('TOTAL', len(results), 'FAILED', len(failed), failed)
    br.close()
