import re
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:8801/'
results = []
def ok(name, cond):
    results.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
def session(br, uid, w=1440, h=900):
    c = br.new_context(viewport={'width': w, 'height': h}, accept_downloads=True)
    c.add_init_script("if(!sessionStorage.getItem('arkadios_ws_session')) sessionStorage.setItem('arkadios_ws_session', JSON.stringify({userId:'%s', at: Date.now()}))" % uid)
    pg = c.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: pg.errs.append('console: ' + m.text) if m.type == 'error' else None)
    return pg
def visit(pg, path):
    pg.goto(B + path); pg.wait_for_timeout(500)

with sync_playwright() as p:
    br = p.chromium.launch(); allerrs = []

    # ----- Read-only
    pg = session(br, 'u-rory')
    visit(pg, 'index.html'); ok('read-only: no New firm on Command Center', pg.locator('#h-new').count() == 0 and pg.locator('[data-done]:not([disabled])').count() == 0)
    visit(pg, 'firms.html'); ok('read-only: no New firm on Firms', pg.locator('#fm-new').count() == 0 and pg.locator('#fm-export').count() == 1)
    visit(pg, 'firm.html?id=f1'); ok('read-only: firm page has no action buttons', pg.locator('#fd-task, #fd-note, #fd-move, #fd-edit').count() == 0)
    ok('read-only: no billing details', 'Billing details' not in pg.locator('#main').inner_text())
    pg.locator('[data-tab="advisors"]').click(); pg.wait_for_timeout(250); ok('read-only: advisors list is view only', pg.locator('#av-add').count() == 0 and pg.locator('[data-adv]').count() == 0)
    pg.locator('[data-tab="service"]').click(); pg.wait_for_timeout(250); ok('read-only: cannot add notes', pg.locator('#sv-quick').count() == 0)
    visit(pg, 'pipeline.html'); ok('read-only: board cannot be changed', pg.locator('[data-moveto]').count() == 0 and pg.locator('.kcard[draggable="true"]').count() == 0 and 'Drag a firm' not in pg.locator('.page__head').inner_text())
    visit(pg, 'tasks.html'); pg.locator('[data-tab="all"]').click(); pg.wait_for_timeout(250)
    ok('read-only: tasks cannot be changed', pg.locator('#tk-quick').count() == 0 and pg.locator('#tk-new').count() == 0 and pg.locator('[data-status]:not([disabled])').count() == 0)
    pg.locator('[data-pick]').first.click(); pg.wait_for_timeout(200); ok('read-only: no bulk actions', pg.locator('.bulk').count() == 0)
    pg.locator('[data-open]').first.click(); pg.wait_for_timeout(300); ok('read-only: task panel says it cannot be changed', 'not change it' in pg.locator('dialog[open]').inner_text() and pg.locator('dialog[open] #tk-complete').count() == 0)
    allerrs += pg.errs

    # ----- Leader
    pg = session(br, 'u-elena'); visit(pg, 'firm.html?id=f1')
    ok('leader: sees billing details but cannot record funds or edit', 'Billing details' in pg.locator('#main').inner_text() and pg.locator('#fd-funds').count() == 0 and pg.locator('#fd-edit').count() == 0)
    allerrs += pg.errs

    # ----- Billing
    pg = session(br, 'u-priya'); visit(pg, 'firm.html?id=f9')
    ok('billing: sees billing details and can record funds', 'Billing details' in pg.locator('#main').inner_text() and pg.locator('#fd-funds').count() == 1)
    ok('billing: cannot move or edit the firm', pg.locator('#fd-move').count() == 0 and pg.locator('#fd-edit').count() == 0 and pg.locator('#fd-task').count() == 1)
    pg.locator('#fd-funds').click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(300)
    ok('billing: recording funds works', 'Billing tasks created' in pg.locator('#toast').inner_text())
    visit(pg, 'pipeline.html'); ok('billing: pipeline is view only', pg.locator('[data-moveto]').count() == 0)
    allerrs += pg.errs

    # ----- Compliance
    pg = session(br, 'u-noor'); visit(pg, 'firm.html?id=f1&tab=advisors')
    ok('compliance: no Add person (cannot edit advisors)', pg.locator('#av-add').count() == 0)
    visit(pg, 'firms.html'); ok('compliance: cannot create firms', pg.locator('#fm-new').count() == 0)
    allerrs += pg.errs

    # ----- Client Service
    pg = session(br, 'u-imani'); visit(pg, 'firm.html?id=f1&tab=advisors')
    pg.locator('[data-adv]').first.click(); pg.wait_for_timeout(250)
    ok('client service: can edit rep code but not licenses', not pg.locator('#ad-rep').is_disabled() and pg.locator('#ad-lic').is_disabled())
    pg.keyboard.press('Escape'); visit(pg, 'firm.html?id=f1')
    ok('client service: can edit the profile and move the firm', pg.locator('#fd-edit').count() == 1 and pg.locator('#fd-move').count() == 1)
    visit(pg, 'firms.html'); ok('client service: cannot create firms', pg.locator('#fm-new').count() == 0)
    allerrs += pg.errs

    # ----- Advisor Support
    pg = session(br, 'u-alex'); visit(pg, 'firm.html?id=f1')
    ok('advisor support: no edit profile, no move', pg.locator('#fd-edit').count() == 0 and pg.locator('#fd-move').count() == 0)
    pg.locator('[data-tab="advisors"]').click(); pg.wait_for_timeout(250); ok('advisor support: can add people', pg.locator('#av-add').count() == 1)
    allerrs += pg.errs

    # ----- Super admin and reset
    pg = session(br, 'u-avery'); visit(pg, 'index.html')
    ok('super admin: sees everything and the reset link', pg.locator('#h-new').count() == 1 and pg.locator('#reset-demo').count() == 1)
    pg.locator('#h-new').click(); pg.wait_for_timeout(250); pg.fill('#nf-name', 'Temp Firm'); pg.fill('#nf-city', 'Reno'); pg.fill('#nf-state', 'NV'); pg.locator('#nf-form button[type=submit]').click(); pg.wait_for_load_state(); pg.wait_for_timeout(400)
    visit(pg, 'firms.html'); ok('super admin: firm created', '17 firms' in pg.locator('.page__head').inner_text())
    pg.locator('#reset-demo').click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_load_state(); pg.wait_for_timeout(500)
    visit(pg, 'firms.html'); ok('reset restores the sample firms', '16 firms' in pg.locator('.page__head').inner_text())
    allerrs += pg.errs

    # ----- phone width and overflow
    for uid in ['u-dana']:
        for page in ['login.html', 'index.html', 'firms.html', 'firm.html?id=f1', 'pipeline.html', 'tasks.html']:
            m = session(br, uid, 390, 844); m.goto(B + page); m.wait_for_timeout(500)
            ok('phone: %s does not scroll sideways' % page, not m.evaluate('document.documentElement.scrollWidth > window.innerWidth + 2'))
            allerrs += m.errs
    pg = session(br, 'u-dana', 390, 844); visit(pg, 'index.html'); ok('phone: sign out is reachable', pg.locator('#sign-out').is_visible())
    # desktop tables fit
    pg = session(br, 'u-dana')
    for page in ['firms.html', 'tasks.html', 'firm.html?id=f1&tab=advisors']:
        visit(pg, page); ok('desktop: %s tables fit without scrolling' % page, pg.evaluate("Array.from(document.querySelectorAll('.table-wrap')).every(w => w.scrollWidth - w.clientWidth <= 1)"))
    allerrs += pg.errs

    print('ERRORS:', allerrs)
    failed = [n for n, c in results if not c]
    print('TOTAL', len(results), 'FAILED', len(failed), failed)
    br.close()
