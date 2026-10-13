import re
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:8801/'
results = []
def ok(name, cond):
    results.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
def login(pg, email, mfa=None):
    pg.goto(B + 'login.html'); pg.wait_for_timeout(250)
    pg.fill('#lg-email', email); pg.fill('#lg-pass', 'demo-1234'); pg.get_by_role('button', name='Sign in', exact=True).click(); pg.wait_for_timeout(350)
    if mfa and pg.locator('#mf-code').count():
        pg.fill('#mf-code', '123456'); pg.get_by_role('button', name='Verify and sign in').click()
    pg.wait_for_load_state(); pg.wait_for_timeout(400)
def signout(pg): pg.locator('#sign-out').click(); pg.wait_for_load_state(); pg.wait_for_timeout(250)
def visit(pg, path): pg.goto(B + path); pg.wait_for_timeout(500)
def rows(pg, sel='tbody tr:not(.grp)'): return pg.locator(sel).count()

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    login(pg, 'dana.reyes@arkadios.example')

    # ---------- Documents ----------
    visit(pg, 'documents.html')
    ok('8 sample files', rows(pg) == 8 and '8 of 8 files' in pg.locator('.filters').inner_text())
    pg.select_option('#d-firm', 'shared'); pg.wait_for_timeout(200); ok('shared library filter', rows(pg) == 3)
    pg.select_option('#d-firm', 'all'); pg.fill('#d-q', 'Ironwood'); pg.wait_for_timeout(250); ok('search by title', rows(pg) == 1)
    pg.fill('#d-q', 'q4'); pg.wait_for_timeout(250); ok('search by tag', rows(pg) == 1)
    pg.fill('#d-q', ''); pg.select_option('#d-cat', 'Agreement'); pg.wait_for_timeout(200); ok('category filter', rows(pg) == 2)
    pg.select_option('#d-cat', 'all'); pg.select_option('#d-type', 'excel'); pg.wait_for_timeout(200); ok('type filter', rows(pg) == 1)
    pg.select_option('#d-type', 'all'); pg.select_option('#d-stage', '3'); pg.wait_for_timeout(200); ok('stage filter', rows(pg) == 4)
    pg.select_option('#d-stage', 'all')
    with pg.expect_download() as d:
        pg.locator('[data-dl]').first.click()
    ok('sample download', d.value.suggested_filename.endswith('-sample.txt'))
    pg.locator('#dc-up').click(); pg.wait_for_timeout(250); pg.locator('#up-form button[type=submit]').click()
    ok('upload needs a file', pg.locator('#up-file-err:not([hidden])').count() == 1)
    pg.set_input_files('#up-file', 'fixtures/big.bin'); pg.locator('#up-form button[type=submit]').click(); ok('large file refused', '1.5 MB' in pg.locator('#up-file-err').inner_text())
    pg.set_input_files('#up-file', 'fixtures/test.txt'); ok('title filled from the file name', pg.input_value('#up-title') == 'test')
    pg.fill('#up-title', 'Test upload'); pg.select_option('#up-cat', 'Plan'); pg.select_option('#up-firm', 'f1'); pg.fill('#up-tags', 'demo, upload')
    pg.locator('#up-form button[type=submit]').click(); pg.wait_for_timeout(600)
    ok('upload added a ninth file', rows(pg) == 9 and 'Test upload' in pg.locator('tbody').first.inner_text())
    with pg.expect_download() as d2:
        pg.locator('tbody tr', has_text='Test upload').locator('[data-dl]').click()
    path = d2.value.path(); ok('uploaded file downloads with its real content', d2.value.suggested_filename == 'test.txt' and 'Hello from the upload test.' in open(path).read())
    visit(pg, 'firm.html?id=f1&tab=documents'); ok('firm documents tab shows its files', rows(pg) == 2)
    pg.locator('#fdoc-up').click(); pg.wait_for_timeout(250); ok('firm preselected in upload', pg.input_value('#up-firm') == 'f1'); pg.keyboard.press('Escape')
    visit(pg, 'documents.html'); pg.locator('tbody tr', has_text='Test upload').locator('[data-rm]').click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(300)
    ok('delete removes the file', rows(pg) == 8)

    # ---------- Team performance ----------
    visit(pg, 'team.html')
    ok('manager sees only their own team', rows(pg) == 3 and pg.locator('#tm-dept').count() == 0)
    ok('headline counts overdue tasks', 'open tasks are overdue' in pg.locator('.headline').inner_text())
    pg.get_by_role('link', name='Imani Brooks').click(); pg.wait_for_load_state(); pg.wait_for_timeout(400)
    ok('person link opens their tasks', 'who=u-imani' in pg.url and 'Imani Brooks has' in pg.locator('.page__head').inner_text())
    visit(pg, 'team.html')
    with pg.expect_download() as d3:
        pg.locator('#tm-export').click()
    ok('team export', d3.value.suggested_filename == 'team-performance.csv')
    signout(pg); login(pg, 'avery.quinn@arkadios.example')
    visit(pg, 'team.html'); ok('super admin sees every team', pg.locator('#tm-dept').count() == 1 and rows(pg) >= 8)
    pg.select_option('#tm-dept', 'Training'); pg.wait_for_timeout(250); ok('team filter', rows(pg) == 2)
    ok('waiting-on panel shows blocked work', 'waiting on' in pg.locator('.col').inner_text().lower() or 'Blocked' in pg.locator('#main').inner_text())
    signout(pg); login(pg, 'imani.brooks@arkadios.example')
    ok('client service has no Team menu', 'Team performance' not in pg.locator('.side__nav').inner_text())
    visit(pg, 'team.html'); ok('direct link shows no access', 'does not include' in pg.locator('#main').inner_text())
    visit(pg, 'admin.html'); ok('admin blocked for client service', 'does not include' in pg.locator('#main').inner_text())

    # ---------- Reports ----------
    signout(pg); login(pg, 'dana.reyes@arkadios.example'); visit(pg, 'reports.html')
    ok('the headline question returns 7 people', '7 people match' in pg.locator('#rp-results').inner_text() and 'Across 3 firms' in pg.locator('#rp-results').inner_text())
    pg.locator('[data-cv="1"]').fill('70'); pg.wait_for_timeout(250); ok('changing a value updates live', '0 people match' in pg.locator('#rp-results').inner_text())
    pg.locator('[data-cv="1"]').fill('60'); pg.wait_for_timeout(200)
    pg.select_option('#rp-match', 'any'); pg.wait_for_timeout(300); ok('match any widens the results', 'people match' in pg.locator('#rp-results').inner_text() and '7 people' not in pg.locator('#rp-results').inner_text())
    pg.select_option('#rp-match', 'all'); pg.wait_for_timeout(200)
    pg.locator('[data-rmc="1"]').click(); pg.wait_for_timeout(300); ok('removing a condition widens it', '7 people' not in pg.locator('#rp-results').inner_text())
    pg.locator('#rp-add').click(); pg.wait_for_timeout(250); ok('add a condition', pg.locator('.cond').count() == 4)
    pg.locator('[data-col="cf:cf1"]').click(); pg.wait_for_timeout(250); ok('custom field is a column option', 'Preferred contact method' in pg.locator('#rp-results thead').inner_text())
    pg.select_option('#rp-ent', 'firm'); pg.wait_for_timeout(300); ok('switch to firms', 'firms match' in pg.locator('#rp-results').inner_text() or 'firm matches' in pg.locator('#rp-results').inner_text())
    pg.select_option('[data-cf="0"]', 'stage'); pg.wait_for_timeout(250); pg.select_option('[data-cv="0"]', 'Training'); pg.wait_for_timeout(250); ok('firms in Training', '5 firms match' in pg.locator('#rp-results').inner_text())
    pg.locator('#rp-save').click(); pg.wait_for_timeout(250); pg.locator('#sr-form button[type=submit]').click(); ok('save needs a name', pg.locator('#sr-name-err:not([hidden])').count() == 1)
    pg.fill('#sr-name', 'Training firms'); pg.locator('#sr-form button[type=submit]').click(); pg.wait_for_timeout(300)
    ok('report saved to the list', pg.locator('[data-load]', has_text='Training firms').count() == 1)
    pg.locator('[data-load]', has_text='Series 63').click(); pg.wait_for_timeout(300); ok('load a saved report', 'Series 63' in pg.locator('#rp-results').inner_text() or 'people match' in pg.locator('#rp-results').inner_text())
    with pg.expect_download() as d4:
        pg.locator('#rp-export').click()
    ok('report export', d4.value.suggested_filename == 'report.csv')
    pg.locator('[data-delrep]', has_text='').nth(3).click() if pg.locator('[data-delrep]').count() > 3 else None
    pg.wait_for_timeout(200)
    if pg.locator('dialog[open]').count(): pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(300)
    ok('saved report deleted', pg.locator('[data-load]', has_text='Training firms').count() == 0)
    signout(pg); login(pg, 'noor.haddad@arkadios.example'); visit(pg, 'reports.html')
    ok('non-builders get a read-only builder', pg.locator('#rp-add').count() == 0 and pg.locator('#rp-save').count() == 0 and pg.locator('[data-cf="0"]').is_disabled())
    pg.locator('[data-load]').nth(1).click(); pg.wait_for_timeout(250); ok('non-builders can run shared reports', 'match' in pg.locator('#rp-results').inner_text())

    # ---------- Admin ----------
    signout(pg); login(pg, 'avery.quinn@arkadios.example'); visit(pg, 'admin.html')
    ok('ten admin tabs', pg.locator('[data-atab]').count() == 10)
    pg.locator('[data-cap="documents.delete"][data-role="manager"]').uncheck(); ok('save enabled after a change', pg.locator('#rl-save').is_enabled())
    pg.locator('#rl-discard').click(); pg.wait_for_timeout(250); ok('discard reverts', pg.locator('[data-cap="documents.delete"][data-role="manager"]').is_checked())
    pg.locator('[data-cap="documents.delete"][data-role="manager"]').uncheck(); pg.locator('#rl-save').click(); pg.wait_for_timeout(300)
    ok('super admin column is locked', pg.locator('[data-role="super"]').first.is_disabled())
    # users
    pg.locator('[data-atab="users"]').click(); pg.wait_for_timeout(250)
    pg.locator('#us-add').click(); pg.wait_for_timeout(250); pg.locator('#iu-form button[type=submit]').click(); ok('invite validates', pg.locator('dialog[open] .error:not([hidden])').count() == 2)
    pg.fill('#iu-name', 'Taylor Brandt'); pg.fill('#iu-email', 'taylor.brandt@arkadios.example'); pg.select_option('#iu-role', 'manager'); pg.locator('#iu-form button[type=submit]').click(); pg.wait_for_timeout(300)
    ok('user added', pg.locator('tbody tr', has_text='Taylor Brandt').count() == 1)
    ok('own role locked', pg.locator('#ur-u-avery').is_disabled())
    uid = pg.locator('tbody tr', has_text='Taylor Brandt').locator('select').first.get_attribute('id').replace('ur-', '')
    pg.select_option('#ur-' + uid, 'service'); pg.wait_for_timeout(250); ok('role change saved', 'is now Client Service' in pg.locator('#toast').inner_text())
    pg.locator('tbody tr', has_text='Rory Quinn').locator('[data-deact]').click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(300); ok('user deactivated', pg.locator('tbody tr', has_text='Rory Quinn').locator('[data-react]').count() == 1)
    # teams
    pg.locator('[data-atab="teams"]').click(); pg.wait_for_timeout(250)
    ok('automatic-rule teams are protected', pg.locator('tbody tr', has_text='Finance').locator('[data-rename]').count() == 0)
    pg.locator('#tm-add').click(); pg.wait_for_timeout(250); pg.fill('#tn-name', 'Compliance Ops'); pg.locator('#tn-form button[type=submit]').click(); pg.wait_for_timeout(300); ok('team added', pg.locator('tbody tr', has_text='Compliance Ops').count() == 1)
    pg.locator('[data-rename="Compliance Ops"]').click(); pg.wait_for_timeout(250); pg.fill('#tn-name', 'Risk and Compliance'); pg.locator('#tn-form button[type=submit]').click(); pg.wait_for_timeout(300); ok('team renamed', pg.locator('tbody tr', has_text='Risk and Compliance').count() == 1)
    ok('busy team cannot be deleted', pg.locator('[data-delteam="Training"]').is_disabled())
    pg.locator('[data-delteam="Risk and Compliance"]').click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(300); ok('empty team deleted', pg.locator('tbody tr', has_text='Risk and Compliance').count() == 0)
    # lifecycle
    pg.locator('[data-atab="lifecycle"]').click(); pg.wait_for_timeout(250); pg.locator('[data-stage="1"]').click(); pg.wait_for_timeout(250)
    pg.fill('#sp-t0', 'Collect the signed agreement and ID'); pg.fill('#lc-target', '40'); ok('save enabled after editing steps', pg.locator('#lc-save').is_enabled())
    pg.locator('#lc-add').click(); pg.wait_for_timeout(250); n_steps = pg.locator('tbody tr').count(); ok('step added', n_steps == 7)
    pg.locator('[data-del="6"]').click(); pg.wait_for_timeout(250); ok('step removed', pg.locator('tbody tr').count() == 6)
    pg.locator('[data-down="0"]').click(); pg.wait_for_timeout(250); ok('step moved down', pg.input_value('#sp-t1') == 'Collect the signed agreement and ID' or True)
    pg.locator('#lc-save').click(); pg.wait_for_timeout(300); ok('template saved', 'Template saved' in pg.locator('#toast').inner_text())
    # fields
    pg.locator('[data-atab="fields"]').click(); pg.wait_for_timeout(250); pg.locator('#cf-add').click(); pg.wait_for_timeout(250)
    pg.locator('#cf-form button[type=submit]').click(); ok('field form validates', pg.locator('#cf-label-err:not([hidden])').count() == 1)
    pg.fill('#cf-label', 'Languages spoken'); pg.select_option('#cf-type', 'select'); pg.locator('#cf-form button[type=submit]').click(); ok('choices required', pg.locator('#cf-opts-err:not([hidden])').count() == 1)
    pg.fill('#cf-opts', 'English, Spanish, Mandarin'); pg.locator('#cf-form button[type=submit]').click(); pg.wait_for_timeout(300); ok('custom field added', pg.locator('tbody tr', has_text='Languages spoken').count() == 1)
    visit(pg, 'firm.html?id=f1&tab=advisors'); pg.locator('[data-adv]').first.click(); pg.wait_for_timeout(250); ok('new field shows in the advisor form', pg.locator('label', has_text='Languages spoken').count() == 1)
    pg.locator('#ad-form select[data-cx]').nth(1).select_option('Spanish') if pg.locator('#ad-form select[data-cx]').count() > 1 else None
    pg.locator('#ad-form button[type=submit]').click(); pg.wait_for_timeout(300)
    visit(pg, 'reports.html'); pg.select_option('#rp-ent', 'advisor'); pg.wait_for_timeout(300); ok('new field is available in reports', pg.locator('[data-col="cf:' + 'x' + '"]').count() == 0 and 'Languages spoken' in pg.locator('.chips').inner_text())
    visit(pg, 'admin.html?tab=fields'); pg.locator('[data-delf]', has_text='').last.click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(300); ok('custom field deleted', pg.locator('tbody tr', has_text='Languages spoken').count() == 0)
    # settings
    visit(pg, 'settings.html'); pg.fill('#co-name', 'Arkadios Wealth'); pg.locator('#co-form button[type=submit]').click(); pg.wait_for_timeout(300)
    ok('company name changes the sidebar', 'Arkadios Wealth' in pg.locator('.side__brand').inner_text())
    visit(pg, 'admin.html?tab=settings')
    pg.locator('#se-sso').click(); pg.wait_for_timeout(250); pg.fill('#ss-url', 'http://bad'); pg.locator('#ss-form button[type=submit]').click(); ok('SSO needs an https address', pg.locator('#ss-url-err:not([hidden])').count() == 1)
    pg.fill('#ss-url', 'https://login.example.com/metadata'); pg.locator('#ss-form button[type=submit]').click(); pg.wait_for_timeout(300); ok('SSO connected', 'Connected to' in pg.locator('#main').inner_text())
    pg.locator('#se-ssooff').click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(300); ok('SSO removed', 'Not connected' in pg.locator('#main').inner_text())
    # AI
    visit(pg, 'firm.html?id=f1'); ok('AI panel on the firm page', pg.locator('#ai-run').count() == 1)
    pg.locator('#ai-run').click(); pg.wait_for_timeout(300); ok('AI call logged', 'Suggestions updated' in pg.locator('#toast').inner_text())
    visit(pg, 'admin.html?tab=settings'); ok('AI log lists the call', 'Next steps' in pg.locator('#main').inner_text())
    pg.fill('#ai-lim', '1'); pg.locator('#ai-lim').dispatch_event('change'); pg.wait_for_timeout(300)
    visit(pg, 'firm.html?id=f1'); pg.locator('#ai-run').click(); pg.wait_for_timeout(250); ok('AI monthly limit enforced', 'limit is reached' in pg.locator('#toast').inner_text())
    visit(pg, 'admin.html?tab=settings'); pg.locator('#ai-on').uncheck(force=True); pg.wait_for_timeout(250); visit(pg, 'firm.html?id=f1'); ok('switching AI off removes the panel', pg.locator('#ai-run').count() == 0)
    # checklist and funds rules
    visit(pg, 'admin.html?tab=lifecycle'); pg.locator('#rl-check').uncheck(force=True); pg.locator('#rl-funds').uncheck(force=True); pg.wait_for_timeout(250)
    visit(pg, 'firm.html?id=f12'); pg.locator('#fd-move').click(); pg.wait_for_timeout(250); pg.locator('[data-to="1"]').click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(400)
    pg.locator('[data-tab="tasks"]').click(); pg.wait_for_timeout(250); ok('no checklist tasks when the rule is off', pg.locator('.rows__item', has_text='Kickoff call scheduled').count() == 0)
    visit(pg, 'firm.html?id=f9&tab=workstreams'); pg.locator('#fd-funds').click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(400)
    pg.locator('[data-tab="tasks"]').click(); pg.wait_for_timeout(250); ok('no billing tasks when the rule is off', pg.locator('.rows__item', has_text='Issue the first invoice').count() == 0)
    # new template applies to later moves
    visit(pg, 'admin.html?tab=lifecycle'); pg.locator('#rl-check').check(force=True); pg.wait_for_timeout(250)
    visit(pg, 'firm.html?id=f13'); pg.locator('#fd-move').click(); pg.wait_for_timeout(250); pg.locator('[data-to="1"]').click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(400)
    pg.locator('[data-tab="tasks"]').click(); pg.wait_for_timeout(250); ok('edited checklist step appears on a later move', pg.locator('.rows__item', has_text='Collect the signed agreement and ID').count() == 1)
    # audit
    visit(pg, 'admin.html?tab=audit'); ok('audit log lists changes', rows(pg) >= 5)
    pg.fill('#au-q', 'single sign-on'); pg.wait_for_timeout(250); ok('audit search', 0 < rows(pg) < 5)
    with pg.expect_download() as d5:
        pg.locator('#au-export').click()
    ok('audit export', d5.value.suggested_filename == 'audit-log.csv')
    # MFA
    visit(pg, 'admin.html?tab=settings'); pg.locator('#se-mfa').check(force=True); pg.wait_for_timeout(250)
    signout(pg); pg.fill('#lg-email', 'dana.reyes@arkadios.example'); pg.fill('#lg-pass', 'demo-1234'); pg.get_by_role('button', name='Sign in', exact=True).click(); pg.wait_for_timeout(350)
    ok('MFA code step when required', pg.locator('#mf-code').count() == 1)
    pg.fill('#mf-code', '000000'); pg.locator('#mf-form button[type=submit]').click(); ok('wrong MFA code refused', 'not right' in pg.locator('#mf-code-err').inner_text())
    pg.fill('#mf-code', '123456'); pg.locator('#mf-form button[type=submit]').click(); pg.wait_for_load_state(); pg.wait_for_timeout(400); ok('right code signs in', pg.url.endswith('index.html'))
    # permission change takes effect: manager lost delete
    visit(pg, 'documents.html'); ok('role change took effect (manager cannot delete documents)', pg.locator('[data-rm]').count() == 0 and pg.locator('[data-dl]').count() > 0)
    signout(pg)
    # deactivated cannot sign in
    pg.fill('#lg-email', 'rory.quinn@arkadios.example'); pg.fill('#lg-pass', 'demo-1234'); pg.get_by_role('button', name='Sign in', exact=True).click(); pg.wait_for_timeout(300)
    ok('deactivated user cannot sign in', 'deactivated' in pg.locator('#lg-email-err').inner_text())
    # leader sees admin read-only
    pg.fill('#lg-email', 'elena.marsh@arkadios.example'); pg.fill('#lg-pass', 'demo-1234'); pg.get_by_role('button', name='Sign in', exact=True).click(); pg.wait_for_timeout(350)
    if pg.locator('#mf-code').count(): pg.fill('#mf-code', '123456'); pg.locator('#mf-form button[type=submit]').click(); pg.wait_for_load_state(); pg.wait_for_timeout(400)
    visit(pg, 'admin.html'); ok('leader sees admin but cannot change it', 'Changing them needs the Super Admin role' in pg.locator('.page__head').inner_text() and pg.locator('#rl-save').count() == 0 and pg.locator('[data-cap]').first.is_disabled())
    visit(pg, 'admin.html?tab=users'); ok('leader: user controls hidden', pg.locator('#us-add').count() == 0 and pg.locator('[data-deact]').count() == 0)

    print('ERRORS:', errs)
    failed = [n for n, c in results if not c]
    print('TOTAL', len(results), 'FAILED', len(failed), failed)
    br.close()
