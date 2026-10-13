import re, json, datetime
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:8801/'
results = []
def ok(name, cond):
    results.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
def login(pg, email, pw='demo-1234'):
    pg.goto(B + 'login.html'); pg.wait_for_timeout(250)
    pg.fill('#lg-email', email); pg.fill('#lg-pass', pw); pg.get_by_role('button', name='Sign in', exact=True).click(); pg.wait_for_load_state(); pg.wait_for_timeout(450)
def signout(pg): pg.locator('#sign-out').click(); pg.wait_for_load_state(); pg.wait_for_timeout(250)
def visit(pg, path): pg.goto(B + path); pg.wait_for_timeout(550)
def toast(pg): return pg.locator('#toast').inner_text()
def state(pg): return pg.evaluate("JSON.parse(localStorage.getItem('arkadios_ws_v1'))")

with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    login(pg, 'dana.reyes@arkadios.example')

    # ---------- Notifications ----------
    ok('bell counts unread plus overdue', '4 unread' in pg.locator('#bell').get_attribute('aria-label'))
    pg.locator('#bell').click(); pg.wait_for_load_state(); pg.wait_for_timeout(450)
    tabs = pg.locator('.tabs').inner_text().replace('\n', ' '); ok('notification tabs are counted', 'All 6' in tabs and 'Unread 4' in tabs and 'Mentions 1' in tabs and 'Overdue 1' in tabs)
    pg.locator('[data-nt="mentions"]').click(); pg.wait_for_timeout(250); pg.locator('[data-go]').first.click(); pg.wait_for_load_state(); pg.wait_for_timeout(500)
    ok('opening an item goes to it and marks it read', 'firm.html?id=f1' in pg.url)
    visit(pg, 'notifications.html'); ok('the mention is now read', 'Unread 3' in pg.locator('.tabs').inner_text().replace('\n', ' '))
    pg.locator('#nf-all').click(); pg.wait_for_timeout(300); ok('mark all as read leaves only overdue work', '1 unread' in pg.locator('#bell').get_attribute('aria-label'))
    pg.locator('[data-nt="overdue"]').click(); pg.wait_for_timeout(250); ok('overdue tab lists my overdue task', 'Confirm platform access' in pg.locator('#main').inner_text())
    signout(pg); login(pg, 'imani.brooks@arkadios.example'); visit(pg, 'tasks.html'); pg.locator('[data-tab="all"]').click(); pg.wait_for_timeout(300)
    row = pg.locator('tbody tr:not(.grp)').filter(has_not_text='Dana Reyes').first; row.locator('[data-open]').first.click(); pg.wait_for_timeout(300); pg.locator('dialog[open] [data-f="assigneeId"]').select_option('u-dana'); pg.wait_for_timeout(300); pg.keyboard.press('Escape')
    visit(pg, 'firm.html?id=f1&tab=service'); pg.fill('#sq-text', 'Please review this, @Dana Reyes.'); pg.locator('#sv-quick button[type=submit]').click(); pg.wait_for_timeout(300)
    signout(pg); login(pg, 'dana.reyes@arkadios.example'); ok('assignment and mention notify the person', int(re.search(r'(\d+) unread', pg.locator('#bell').get_attribute('aria-label')).group(1)) >= 3)
    visit(pg, 'notifications.html'); txt = pg.locator('#main').inner_text(); ok('the notifications say who did it', 'Imani Brooks assigned you' in txt and 'Imani Brooks mentioned you' in txt)

    # ---------- My account ----------
    visit(pg, 'account.html'); pg.locator('[data-nk="assigned"]').uncheck(); pg.wait_for_timeout(250)
    ok('turning a notification off is saved', state(pg)['userNotif']['u-dana']['assigned'] is False)
    pg.fill('#pw-cur', 'wrong'); pg.fill('#pw-new', 'short'); pg.fill('#pw-conf', 'other'); pg.locator('#pw-form button[type=submit]').click()
    ok('password form checks every field', all(pg.locator(i).count() == 1 for i in ['#pw-cur-err:not([hidden])', '#pw-new-err:not([hidden])', '#pw-conf-err:not([hidden])']))
    pg.fill('#pw-cur', 'demo-1234'); pg.fill('#pw-new', 'Better-Pass-2026'); pg.fill('#pw-conf', 'Better-Pass-2026'); pg.locator('#pw-form button[type=submit]').click(); pg.wait_for_timeout(350); ok('password changed', 'Password changed' in toast(pg))
    pg.select_option('#pr-start', 'tasks.html'); pg.select_option('#pr-tasks', 'team'); pg.locator('#pr-form button[type=submit]').click(); pg.wait_for_timeout(300); ok('preferences saved', 'Preferences saved' in toast(pg))
    signout(pg); pg.fill('#lg-email', 'dana.reyes@arkadios.example'); pg.fill('#lg-pass', 'demo-1234'); pg.get_by_role('button', name='Sign in', exact=True).click(); pg.wait_for_timeout(300)
    ok('the old password no longer works', 'not right' in pg.locator('#lg-pass-err').inner_text())
    pg.fill('#lg-pass', 'Better-Pass-2026'); pg.get_by_role('button', name='Sign in', exact=True).click(); pg.wait_for_load_state(); pg.wait_for_timeout(500)
    ok('the new password works and the start page is used', pg.url.endswith('tasks.html') and 'My team' in pg.locator('.tab.is-on').inner_text())
    second = ctx.new_page(); second.goto(B + 'login.html'); second.wait_for_timeout(300); second.fill('#lg-email', 'dana.reyes@arkadios.example'); second.fill('#lg-pass', 'Better-Pass-2026'); second.get_by_role('button', name='Sign in', exact=True).click(); second.wait_for_load_state(); second.wait_for_timeout(500)
    visit(pg, 'account.html'); ok('two sessions are listed', pg.locator('[data-so]').count() >= 1 and 'This browser' in pg.locator('#main').inner_text())
    pg.locator('#so-all').click(); pg.wait_for_timeout(300); second.goto(B + 'index.html'); second.wait_for_timeout(500)
    ok('signing out everywhere else signs the other device out', 'login.html' in second.url and 'another device' in second.locator('#login').inner_text()); second.close()

    # ---------- Settings (Super Admin) ----------
    signout(pg); login(pg, 'avery.quinn@arkadios.example')
    visit(pg, 'settings.html'); ok('four settings tabs', pg.locator('[data-stab]').count() == 4)
    # terminology
    pg.locator('[data-stab="terms"]').click(); pg.wait_for_timeout(300); pg.fill('#tm-s-firm', 'Partner 2'); pg.locator('#tm-save').click(); ok('terminology rejects digits', pg.locator('#tm-s-firm-err:not([hidden])').count() == 1)
    pg.fill('#tm-s-firm', 'Partner'); pg.fill('#tm-p-firm', 'Partners'); ok('the preview follows as you type', 'Partners' in pg.locator('#tm-prev').inner_text()); pg.locator('#tm-save').click(); pg.wait_for_load_state(); pg.wait_for_timeout(700)
    ok('the menu uses the new word', 'Partners' in pg.locator('.side__nav').inner_text() and 'Firms' not in pg.locator('.side__nav').inner_text())
    visit(pg, 'firms.html'); ok('headings, tabs, and counts follow', 'Partners' in pg.locator('h1').inner_text() and 'partners' in pg.locator('.page__head').inner_text())
    pg.locator('#fm-new').click(); pg.wait_for_timeout(300); ok('dialogs follow too', 'New partner' in pg.locator('dialog[open]').inner_text()); pg.keyboard.press('Escape')
    visit(pg, 'settings.html'); pg.locator('[data-stab="terms"]').click(); pg.wait_for_timeout(300); pg.locator('#tm-reset').click(); pg.wait_for_load_state(); pg.wait_for_timeout(700); ok('reset restores the defaults', 'Firms' in pg.locator('.side__nav').inner_text())
    # menu
    visit(pg, 'settings.html'); pg.locator('[data-stab="menu"]').click(); pg.wait_for_timeout(300)
    ok('Command Center and Admin cannot be hidden', pg.locator('[data-mshow="home"]').is_disabled() and pg.locator('[data-mshow="admin"]').is_disabled())
    pg.locator('[data-mshow="reports"]').uncheck(); pg.wait_for_timeout(250); pg.locator('[data-mup="3"]').click(); pg.wait_for_timeout(250); pg.locator('#mn-save').click(); pg.wait_for_timeout(350)
    nav = pg.locator('.side__nav').inner_text(); ok('menu saved: Reports hidden and Tasks moved up', 'Reports' not in nav and nav.index('Tasks') < nav.index('Pipeline'))
    visit(pg, 'settings.html'); pg.locator('[data-stab="menu"]').click(); pg.wait_for_timeout(300); pg.locator('[data-mshow="reports"]').check(); pg.locator('[data-mdn="2"]').click(); pg.wait_for_timeout(250); pg.locator('#mn-save').click(); pg.wait_for_timeout(300)
    # general
    pg.locator('[data-stab="general"]').click(); pg.wait_for_timeout(300)
    for i in range(7):
        b = pg.locator('[data-wd="%d"]' % i)
        if 'is-on' in (b.get_attribute('class') or ''): b.click()
    pg.locator('#wk-form button[type=submit]').click(); ok('at least one working day is required', pg.locator('#wd-err:not([hidden])').count() == 1)
    for i in [1, 2, 3, 4, 5]: pg.locator('[data-wd="%d"]' % i).click()
    pg.locator('#wk-form button[type=submit]').click(); pg.wait_for_timeout(350); ok('working hours saved', 'Working hours saved' in toast(pg))
    def add_workdays(n):
        d = datetime.date.today(); left = n
        while left > 0:
            d += datetime.timedelta(days=1)
            if d.weekday() < 5: left -= 1
        return d.isoformat()
    visit(pg, 'tasks.html'); pg.locator('#tk-new').click(); pg.wait_for_timeout(300); ok('default due date counts working days', pg.input_value('#nt-due') == add_workdays(3)); pg.keyboard.press('Escape')
    visit(pg, 'settings.html'); pg.locator('#wk-wd').uncheck(); pg.locator('#wk-form button[type=submit]').click(); pg.wait_for_timeout(300)
    visit(pg, 'tasks.html'); pg.locator('#tk-new').click(); pg.wait_for_timeout(300); ok('with working days off it is plain calendar days', pg.input_value('#nt-due') == (datetime.date.today() + datetime.timedelta(days=3)).isoformat()); pg.keyboard.press('Escape')
    visit(pg, 'settings.html'); pg.select_option('#wk-df', 'uk'); pg.locator('#wk-wd').check(); pg.locator('#wk-form button[type=submit]').click(); pg.wait_for_timeout(300)
    visit(pg, 'tasks.html'); pg.locator('[data-tab="all"]').click(); pg.wait_for_timeout(300); ok('UK date format shows the day first', re.search(r'\b\d{1,2} [A-Z][a-z]{2}\b', pg.locator('tbody').inner_text()) is not None and not re.search(r'[A-Z][a-z]{2} \d{1,2}\b(?!,)', pg.locator('tbody .nowrap').first.inner_text()))
    visit(pg, 'settings.html'); pg.select_option('#wk-df', 'us'); pg.locator('#wk-form button[type=submit]').click(); pg.wait_for_timeout(300)
    pg.locator('#rc-ex').uncheck(); pg.wait_for_timeout(250); n0 = len(state(pg)['audit']); visit(pg, 'people.html'); pg.locator('#pp-export').click(); pg.wait_for_timeout(300); ok('exports are not recorded when switched off', len([a for a in state(pg)['audit'] if 'Exported people.csv' in a['text']]) == 0)
    visit(pg, 'settings.html'); pg.locator('#rc-ex').check(); pg.wait_for_timeout(250); visit(pg, 'people.html'); pg.locator('#pp-export').click(); pg.wait_for_timeout(300); ok('exports are recorded when switched on', len([a for a in state(pg)['audit'] if 'Exported people.csv' in a['text']]) == 1)
    signout(pg); login(pg, 'avery.quinn@arkadios.example'); ok('sign-ins are recorded', any(a['text'] == 'Signed in' for a in state(pg)['audit']))
    visit(pg, 'settings.html'); pg.locator('[data-stab="notif"]').click(); pg.wait_for_timeout(300)
    pg.locator('[data-nd="stage"][data-ch="app"]').uncheck(); pg.wait_for_timeout(250); n1 = len(state(pg)['notifs'])
    visit(pg, 'firm.html?id=f9'); pg.locator('#fd-move').click(); pg.wait_for_timeout(250); pg.locator('[data-to="2"]').click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(400)
    ok('a notification type switched off is not created', len(state(pg)['notifs']) == n1)
    visit(pg, 'settings.html'); pg.locator('[data-stab="notif"]').click(); pg.wait_for_timeout(300); pg.locator('[data-nd="stage"][data-ch="app"]').check(); pg.wait_for_timeout(250)

    # ---------- Admin: who sees what ----------
    visit(pg, 'admin.html'); pg.select_option('#sc-firms-service', 'dept'); pg.wait_for_timeout(250); ok('scope change enables Save', pg.locator('#rl-save').is_enabled()); pg.locator('#rl-save').click(); pg.wait_for_timeout(350)
    signout(pg); login(pg, 'imani.brooks@arkadios.example'); visit(pg, 'firms.html')
    ok('a role limited to its team sees only that team\'s firms', '8 firms' in pg.locator('.page__head').inner_text())
    visit(pg, 'people.html'); ok('people follow the same limit', 'across 8 firms' in pg.locator('.page__head').inner_text())
    visit(pg, 'map.html'); ok('the map follows the same limit', int(re.search(r'(\d+) advisors and staff in', pg.locator('.filters__r').inner_text()).group(1)) < 203)
    pg.fill('#g-search', 'Ironwood'); pg.wait_for_timeout(300); ok('search does not find firms outside the scope', 'No firms or advisors' in pg.locator('#g-results').inner_text())
    signout(pg); login(pg, 'avery.quinn@arkadios.example'); visit(pg, 'admin.html'); pg.select_option('#sc-firms-service', 'own'); pg.locator('#rl-save').click(); pg.wait_for_timeout(350)
    signout(pg); login(pg, 'imani.brooks@arkadios.example'); visit(pg, 'firms.html'); ok('own records only: none owned', 'No firms match' in pg.locator('tbody').inner_text() or '0 firms' in pg.locator('.page__head').inner_text())
    signout(pg); login(pg, 'avery.quinn@arkadios.example'); visit(pg, 'admin.html'); pg.select_option('#sc-firms-service', 'all'); pg.locator('#rl-save').click(); pg.wait_for_timeout(350)

    # ---------- Admin: lifecycle, approvals, recurring ----------
    visit(pg, 'admin.html?tab=lifecycle'); pg.fill('#lc-name', 'Lead'); pg.locator('#lc-save').click(); pg.wait_for_timeout(350); visit(pg, 'pipeline.html'); ok('a renamed stage shows everywhere', pg.locator('.kcol__head', has_text='Lead').count() == 1)
    visit(pg, 'admin.html?tab=lifecycle'); pg.locator('[data-stage="1"]').click(); pg.wait_for_timeout(300); pg.fill('#lc-name', 'Lead'); pg.locator('#lc-save').click(); pg.wait_for_timeout(300); ok('two stages cannot share a name', 'different name' in toast(pg))
    pg.locator('#lc-discard').click(); pg.wait_for_timeout(300); pg.locator('[data-stage="0"]').click(); pg.wait_for_timeout(300); pg.fill('#lc-name', 'Prospect'); pg.locator('#lc-save').click(); pg.wait_for_timeout(300)
    visit(pg, 'admin.html?tab=approvals'); ok('approval rules are listed with sign-off roles', pg.locator('[data-rs]').count() >= 20 and pg.locator('[data-rs]:checked').count() == 3)
    pg.locator('input[aria-label="Needs approval: Verify billing setup"]').check(); pg.wait_for_timeout(350); ok('a step can be made to need approval', 'now needs approval' in toast(pg))
    signout(pg); login(pg, 'priya.okafor@arkadios.example'); visit(pg, 'firm.html?id=f8&tab=tasks'); pg.locator('.rows__item', has_text='Verify billing setup').locator('[data-tdone]').click(); pg.wait_for_timeout(350)
    ok('that step now goes for approval', 'Submitted for approval' in toast(pg))
    signout(pg); login(pg, 'avery.quinn@arkadios.example'); visit(pg, 'admin.html?tab=approvals'); pg.locator('input[aria-label="Needs approval: Verify billing setup"]').uncheck(); pg.wait_for_timeout(300)
    signout(pg); login(pg, 'priya.okafor@arkadios.example'); visit(pg, 'firm.html?id=f15&tab=tasks'); pg.locator('.rows__item', has_text='Verify billing setup').locator('[data-tdone]').click(); pg.wait_for_timeout(350)
    ok('with the rule off it completes straight away', pg.locator('.rows__item', has_text='Verify billing setup').locator('.box--on').count() == 1)
    signout(pg); login(pg, 'avery.quinn@arkadios.example'); visit(pg, 'admin.html?tab=approvals'); pg.locator('#rc-add').click(); pg.wait_for_timeout(300); pg.locator('#rc-form button[type=submit]').click(); ok('recurring work form validates', pg.locator('#rc-title-err:not([hidden])').count() == 1)
    pg.fill('#rc-title', 'Annual license review'); pg.fill('#rc-every', '100'); pg.fill('#rc-win', '10'); pg.select_option('#rc-dept', 'Operations'); pg.locator('#rc-form button[type=submit]').click(); pg.wait_for_timeout(400)
    ok('recurring tasks are created for firms in Lifetime', len([t for t in state(pg)['tasks'] if t['title'] == 'Annual license review']) == 3)
    pg.locator('[data-rdel]', has_text='').last.click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(300); ok('recurring work can be deleted', pg.locator('tbody tr', has_text='Annual license review').count() == 0)
    pg.locator('input[aria-label="Active: License check"]').uncheck(); pg.wait_for_timeout(250); ok('recurring work can be paused', 'Paused' in toast(pg))

    # ---------- Admin: integrations and data ----------
    visit(pg, 'admin.html?tab=integrations'); ok('six integrations', pg.locator('.icard').count() == 6 and 'Connected' in pg.locator('.icard').first.inner_text())
    pg.locator('[data-imanage="outlook"]').click(); pg.wait_for_timeout(300); pg.locator('[data-itg="emails"]').uncheck(); pg.wait_for_timeout(200); pg.locator('#it-sync').click(); pg.wait_for_timeout(350); ok('with emails off a sync brings nothing in', 'Nothing new' in toast(pg))
    pg.locator('[data-itg="emails"]').check(); pg.wait_for_timeout(200); pg.locator('#it-sync').click(); pg.wait_for_timeout(350); ok('Outlook sync saves emails to firms', 'brought in' in toast(pg) and any('saved from Outlook' in n['text'] for n in state(pg)['notes']))
    pg.locator('#it-off').click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(300); ok('disconnect', 'Not connected' in pg.locator('.icard').first.inner_text())
    pg.locator('[data-iconnect="salesforce"]').click(); pg.wait_for_timeout(250); pg.fill('#ic-a', 'http://nope'); pg.locator('#ic-form button[type=submit]').click(); ok('Salesforce needs an https address', pg.locator('#ic-a-err:not([hidden])').count() == 1)
    pg.fill('#ic-a', 'https://arkadios.my.salesforce.com'); pg.locator('#ic-form button[type=submit]').click(); pg.wait_for_timeout(350); pg.locator('#it-sync').click(); pg.wait_for_timeout(350); ok('Salesforce sync adds external IDs', 'brought in' in toast(pg))
    visit(pg, 'firm.html?id=f1'); ok('the firm shows its Salesforce ID', 'Salesforce ID' in pg.locator('#main').inner_text())
    visit(pg, 'admin.html?tab=integrations'); pg.locator('[data-iconnect="wealthbox"]').click(); pg.wait_for_timeout(250); pg.fill('#ic-a', 'abc'); pg.locator('#ic-form button[type=submit]').click(); ok('Wealthbox needs a real token', pg.locator('#ic-a-err:not([hidden])').count() == 1); pg.keyboard.press('Escape')
    pg.locator('[data-ireview="blackdiamond"]').click(); pg.wait_for_timeout(250); pg.locator('#rv-form button[type=submit]').click(); pg.wait_for_timeout(350); ok('plan an API review', 'Review planned' in pg.locator('.icard', has_text='Black Diamond').inner_text())
    n_t = len(state(pg)['tickets']); pg.locator('[data-imove]').click(); pg.wait_for_timeout(250); pg.locator('dialog[open] [data-ok]').click(); pg.wait_for_timeout(400); ok('Zendesk tickets move into Tickets', len(state(pg)['tickets']) == n_t + 3 and 'Tickets moved' in pg.locator('.icard', has_text='Zendesk').inner_text())
    visit(pg, 'admin.html?tab=data'); ok('import link is offered', pg.locator('a[href="import.html"]').count() == 1)
    with pg.expect_download() as d1:
        pg.locator('#dt-tpl').click()
    ok('CSV template downloads', d1.value.suggested_filename == 'import-template.csv')
    with pg.expect_download() as d2:
        pg.locator('#dt-all').click()
    data = json.load(open(d2.value.path())); ok('export all data is valid JSON with firms and tasks', len(data['firms']) >= 16 and len(data['tasks']) > 20 and 'password' not in json.dumps(data['users']).lower())

    # ---------- Import wizard ----------
    visit(pg, 'import.html'); pg.locator('#im-next1').click(); ok('a file is required', pg.locator('#im-file-err:not([hidden])').count() == 1)
    pg.set_input_files('#im-file', 'fixtures/import.csv'); pg.locator('#im-next1').click(); pg.wait_for_timeout(500)
    ok('columns are matched automatically', pg.input_value('#mp-0') == 'firm' and pg.input_value('#mp-2') == 'state' and pg.input_value('#mp-3') == 'adv' and pg.input_value('#mp-4') == 'rep' and pg.input_value('#mp-9') == 'ignore')
    pg.select_option('#mp-0', 'ignore'); pg.locator('#im-next2').click(); ok('Firm name must be matched', pg.locator('#mp-err:not([hidden])').count() == 1); pg.select_option('#mp-0', 'firm'); pg.locator('#im-next2').click(); pg.wait_for_timeout(400)
    t = pg.locator('.panel__body').first.inner_text().replace('\n', ' '); ok('review counts the rows', re.search(r'Rows ready\s*3', t) and re.search(r'New firms\s*1', t) and re.search(r'already have\s*1', t) and re.search(r'cannot be imported\s*1', t))
    ok('problems say which row and why', 'Row 5' in pg.locator('#main').inner_text() and 'State' in pg.locator('#main').inner_text())
    nf = len(state(pg)['firms']); na = len(state(pg)['advisors']); pg.locator('#im-go').click(); pg.wait_for_timeout(600)
    ok('import adds firms and people', '1 new firms and 3 people' in pg.locator('#main').inner_text() and len(state(pg)['firms']) == nf + 1 and len(state(pg)['advisors']) == na + 3)
    visit(pg, 'people.html'); pg.fill('#pp-q', 'Lena Park'); pg.wait_for_timeout(300); ok('imported people can be found', pg.locator('[data-prow]').count() == 1)
    visit(pg, 'firm.html?id=' + [f for f in state(pg)['firms'] if f['name'] == 'Bayview Capital'][0]['id'] + '&tab=tasks'); ok('a new firm gets its Prospect checklist', pg.locator('.rows__item').count() == 5)

    # ---------- gating ----------
    signout(pg); login(pg, 'rory.quinn@arkadios.example'); visit(pg, 'settings.html'); ok('read-only cannot open Settings', 'does not include' in pg.locator('#main').inner_text()); visit(pg, 'import.html'); ok('read-only cannot open Import', 'does not include' in pg.locator('#main').inner_text())
    visit(pg, 'communications.html'); ok('read-only cannot send messages', pg.locator('#cm-form button[type=submit]').count() == 0); visit(pg, 'tickets.html'); ok('read-only cannot work tickets', pg.locator('#tk-new').count() == 0 and pg.locator('#tk-reply').count() == 0)
    signout(pg); login(pg, 'elena.marsh@arkadios.example'); visit(pg, 'settings.html'); ok('a leader sees Settings read only', pg.locator('#co-form button[type=submit]').count() == 0 and pg.locator('#co-name').is_disabled())
    visit(pg, 'admin.html?tab=approvals'); ok('a leader sees approval rules read only', pg.locator('[data-rs]').first.is_disabled() and pg.locator('#rc-add').count() == 0)
    visit(pg, 'admin.html?tab=integrations'); ok('a leader sees integrations without buttons', pg.locator('[data-iconnect]').count() == 0)

    print('ERRORS:', errs)
    failed = [n for n, c in results if not c]
    print('TOTAL', len(results), 'FAILED', len(failed), failed)
    br.close()
