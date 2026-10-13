from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:8801/'
results = []
def ok(name, cond):
    results.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
def session(br, uid, w=1440, h=900):
    c = br.new_context(viewport={'width': w, 'height': h}, accept_downloads=True)
    c.add_init_script("if(!sessionStorage.getItem('arkadios_ws_session')) sessionStorage.setItem('arkadios_ws_session', JSON.stringify({userId:'%s', at: Date.now()}))" % uid)
    pg = c.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append('pageerror: ' + str(e))); pg.on('console', lambda m: pg.errs.append('console: ' + m.text) if m.type == 'error' else None)
    return pg
def visit(pg, path): pg.goto(B + path); pg.wait_for_timeout(550)
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    pages = ['dashboards.html', 'map.html', 'people.html', 'approvals.html', 'tickets.html', 'communications.html', 'notifications.html', 'account.html', 'settings.html', 'settings.html#', 'admin.html?tab=approvals', 'admin.html?tab=integrations', 'admin.html?tab=data', 'admin.html?tab=roles', 'import.html', 'tasks.html?view=calendar', 'team.html', 'documents.html']
    for page in pages:
        m = session(br, 'u-avery', 390, 844); visit(m, page)
        ok('phone: %s does not scroll sideways' % page, not m.evaluate('document.documentElement.scrollWidth > window.innerWidth + 2')); errs += m.errs
    pg = session(br, 'u-avery')
    for page in ['people.html', 'tickets.html', 'approvals.html', 'documents.html', 'admin.html?tab=approvals', 'admin.html?tab=roles', 'admin.html?tab=integrations', 'team.html', 'notifications.html']:
        visit(pg, page); ok('desktop: %s tables fit' % page, pg.evaluate("Array.from(document.querySelectorAll('.table-wrap')).every(w => w.scrollWidth - w.clientWidth <= 1)"))
    for tab in ['plan', 'sla']:
        visit(pg, 'team.html'); pg.locator('[data-tmtab="%s"]' % tab).click(); pg.wait_for_timeout(350)
        ok('team tab %s renders' % tab, pg.locator('.stat').count() == 4 if tab == 'plan' else pg.locator('.donut').count() == 1)
        with pg.expect_download() as d:
            pg.locator('#tm-export').click()
        ok('team tab %s exports' % tab, d.value.suggested_filename.endswith('.csv'))
    visit(pg, 'team.html'); pg.locator('[data-tmtab="sla"]').click(); pg.wait_for_timeout(300); pg.fill('#sla-t', '60'); pg.locator('#sla-t').dispatch_event('change'); pg.wait_for_timeout(350); ok('SLA target can be changed by an admin', 'Target saved' in pg.locator('#toast').inner_text())
    errs += pg.errs
    # role views of the new pages
    for uid, path, check, name in [('u-rory', 'documents.html', lambda q: q.locator('[data-sig]').count() >= 1 and q.locator('#dc-up').count() == 0, 'read-only sees signature status but cannot request'),
                                   ('u-rory', 'dashboards.html', lambda q: q.locator('#d-add').count() == 1, 'everyone can build their own dashboards'),
                                   ('u-noor', 'tickets.html', lambda q: q.locator('#tk-new').count() == 0, 'compliance cannot work tickets'),
                                   ('u-priya', 'communications.html', lambda q: q.locator('#cm-form button[type=submit]').count() == 1, 'billing can send messages'),
                                   ('u-elena', 'approvals.html', lambda q: q.locator('tr[data-ap]').count() == 0, 'a leader has nothing waiting')]:
        q = session(br, uid); visit(q, path); ok(name, check(q)); errs += q.errs
    print('ERRORS:', errs)
    failed = [n for n, c in results if not c]
    print('TOTAL', len(results), 'FAILED', len(failed), failed)
    br.close()
