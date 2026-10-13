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
def visit(pg, path): pg.goto(B + path); pg.wait_for_timeout(500)
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    pg = session(br, 'u-rory'); visit(pg, 'documents.html')
    ok('read-only: cannot upload or delete, can download', pg.locator('#dc-up').count() == 0 and pg.locator('[data-rm]').count() == 0 and pg.locator('[data-dl]').count() == 8)
    ok('read-only: menus are Command Center to Documents and Reports', [t.strip() for t in pg.locator('.side__link span').all_inner_texts()] == ['Command Center', 'Firms', 'Pipeline', 'Tasks', 'Documents', 'Reports'])
    visit(pg, 'reports.html'); ok('read-only: can run shared reports only', pg.locator('#rp-add').count() == 0 and pg.locator('[data-load]').count() == 3)
    visit(pg, 'firm.html?id=f1&tab=documents'); ok('read-only: firm documents have no upload', pg.locator('#fdoc-up').count() == 0)
    errs += pg.errs
    pg = session(br, 'u-elena'); visit(pg, 'documents.html'); ok('leader: cannot upload', pg.locator('#dc-up').count() == 0)
    visit(pg, 'team.html'); ok('leader: sees every team', pg.locator('#tm-dept').count() == 1)
    visit(pg, 'admin.html?tab=roles'); ok('leader: admin is read only', pg.locator('#rl-save').count() == 0)
    ok('leader: menus include Team performance and Admin', 'Team performance' in pg.locator('.side__nav').inner_text() and 'Admin' in pg.locator('.side__nav').inner_text())
    errs += pg.errs
    pg = session(br, 'u-priya'); visit(pg, 'documents.html'); ok('billing: can upload but not delete', pg.locator('#dc-up').count() == 1 and pg.locator('[data-rm]').count() == 0)
    visit(pg, 'reports.html'); ok('billing: reports are shared-only', pg.locator('#rp-save').count() == 0)
    errs += pg.errs
    pg = session(br, 'u-noor'); visit(pg, 'documents.html'); ok('compliance: can upload', pg.locator('#dc-up').count() == 1)
    errs += pg.errs
    # phone and desktop checks on the new pages
    for uid, page in [('u-avery', 'documents.html'), ('u-avery', 'reports.html'), ('u-avery', 'team.html'), ('u-avery', 'admin.html'), ('u-avery', 'admin.html?tab=users'), ('u-avery', 'admin.html?tab=lifecycle'), ('u-avery', 'admin.html?tab=settings'), ('u-avery', 'admin.html?tab=audit'), ('u-avery', 'firm.html?id=f1&tab=documents')]:
        m = session(br, uid, 390, 844); visit(m, page)
        ok('phone: %s does not scroll the page sideways' % page, not m.evaluate('document.documentElement.scrollWidth > window.innerWidth + 2')); errs += m.errs
    pg = session(br, 'u-avery')
    for page in ['documents.html', 'team.html', 'reports.html', 'admin.html?tab=users', 'admin.html?tab=teams', 'admin.html?tab=fields', 'admin.html?tab=audit', 'firm.html?id=f1&tab=documents']:
        visit(pg, page); ok('desktop: %s tables fit' % page, pg.evaluate("Array.from(document.querySelectorAll('.table-wrap')).every(w => w.scrollWidth - w.clientWidth <= 1)"))
    errs += pg.errs
    print('ERRORS:', errs)
    failed = [n for n, c in results if not c]
    print('TOTAL', len(results), 'FAILED', len(failed), failed)
    br.close()
