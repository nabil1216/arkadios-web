/* Platform console (mother UI). Plain JavaScript, no build step.
   State is kept in localStorage, so changes carry across pages until "Reset demo data". */
(function () {
  'use strict';

  var KEY = 'arkadios_platform_v1';
  var DOMAIN = 'platform.example';
  var LATEST = '2.4.0';
  var STAFF = 'Super admin';
  var PLANS = {
    essentials: { name: 'Essentials', unit: 18, blurb: 'Directory and service history' },
    professional: { name: 'Professional', unit: 26, blurb: 'Adds workflows, reports, AI' },
    enterprise: { name: 'Enterprise', unit: 34, blurb: 'Adds integrations and audit' }
  };
  var PLAN_IDS = ['essentials', 'professional', 'enterprise'];
  var MODULES = [
    { id: 'directory', name: 'Firm and advisor directory', note: 'Firms, advisors, staff, custom fields' },
    { id: 'lifetime', name: 'Lifetime and service history', note: 'Notes, tasks, hand-offs' },
    { id: 'workstreams', name: 'Parallel department workstreams', note: 'Onboarding, service, billing in parallel' },
    { id: 'reports', name: 'Report builder', note: 'Ad-hoc questions over any field' },
    { id: 'dashboards', name: 'Personalized dashboards', note: 'Each user arranges their own' },
    { id: 'ai', name: 'AI next steps', note: 'Per-tenant switch and call log' },
    { id: 'sso', name: 'SSO and MFA', note: 'Per-tenant identity provider' },
    { id: 'audit', name: 'Audit log and exports', note: 'Who did what, and every export' },
    { id: 'integrations', name: 'Integrations', note: 'Outlook, Salesforce, Wealthbox' },
    { id: 'ticketing', name: 'Ticketing', note: 'Service requests and queues', later: true },
    { id: 'documents', name: 'Documents and e-signature', note: 'Approvals and signing', later: true }
  ];
  var REGIONS = ['US East', 'US West', 'EU Frankfurt'];

  var ICONS = {
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    building: 'M4 21V7l8-4 8 4v14M9 21v-6h6v6',
    layers: 'M12 3l9 5-9 5-9-5 9-5zM3 12.5l9 5 9-5',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    headset: 'M4 14v-2a8 8 0 0116 0v2M4 14h3v5H5a1 1 0 01-1-1zM20 14h-3v5h2a1 1 0 001-1zM17 19c0 1.5-2 2-5 2',
    plus: 'M12 5v14M5 12h14',
    search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3',
    x: 'M6 6l12 12M18 6L6 18',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    alert: 'M12 4l9 16H3zM12 10v4M12 17h.01',
    download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
    clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
    refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7',
    card: 'M3 6h18v12H3zM3 10h18M7 15h4',
    message: 'M4 5h16v11H8l-4 3z',
    lock: 'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3'
  };
  function icon(name, size) {
    size = size || 18;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' + ICONS[name] + '"/></svg>';
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function money(n) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
  function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtDateTime(iso) { return new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
  function ago(iso) {
    var rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    var diff = (new Date(iso).getTime() - Date.now()) / 1000, abs = Math.abs(diff);
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    return rtf.format(Math.round(diff / 86400), 'day');
  }
  function duration(start, end) {
    var e = end ? new Date(end).getTime() : Date.now();
    var m = Math.max(1, Math.round((e - new Date(start).getTime()) / 60000));
    return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  }
  function daysFromNow(iso) { return Math.round((new Date(iso).getTime() - Date.now()) / 864e5); }
  function slug(s) { return s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function at(daysAgo, hoursAgo) { return new Date(Date.now() - (daysAgo || 0) * 864e5 - (hoursAgo || 0) * 36e5).toISOString(); }
  var uid = 0;
  function nextId(p) { uid += 1; return p + Date.now().toString(36) + uid; }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* ---------- state ---------- */
  function monthLabel(offset) {
    var d = new Date(); d.setMonth(d.getMonth() + offset, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  function seedBase() {
    var T = function (id, name, sub, plan, used, limit, status, created, schema, mig, region, email, users) {
      return { id: id, name: name, subdomain: sub, db: 'tenant_' + sub.replace(/-/g, '_'), plan: plan, usersUsed: used, userLimit: limit, status: status, createdAt: created, schema: schema, migration: mig, region: region, adminEmail: email, users: users };
    };
    var tenants = [
      T('t1', 'Arkadios Home Office', 'arkadios', 'professional', 64, 100, 'active', at(40), LATEST, 'ok', 'US East', 'admin@arkadios.example', ['Priya Okafor', 'Mara Vance', 'Alex Park']),
      T('t2', 'Northwind Advisory Group', 'northwind', 'enterprise', 212, 250, 'active', at(210), LATEST, 'ok', 'US East', 'it@northwind.example', ['Elena Marsh', 'Tom Hadley', 'Ruth Calder']),
      T('t3', 'Cobalt Ridge Wealth', 'cobalt-ridge', 'professional', 47, 50, 'active', at(120), LATEST, 'ok', 'US West', 'ops@cobaltridge.example', ['Jonas Weir', 'Aisha Rahman', 'Cole Brandt']),
      T('t4', 'Marlow & Finch Partners', 'marlow-finch', 'essentials', 18, 25, 'trial', at(6), LATEST, 'ok', 'US East', 'office@marlowfinch.example', ['Helen Finch', 'Dev Anand']),
      T('t5', 'Sterling Hollow Family Office', 'sterling-hollow', 'professional', 31, 40, 'suspended', at(300), LATEST, 'ok', 'US East', 'admin@sterlinghollow.example', ['Margot Hale', 'Ibrahim Sy']),
      T('t6', 'Quillon Trust Company', 'quillon', 'enterprise', 140, 200, 'active', at(75), '2.3.2', 'failed', 'EU Frankfurt', 'platform@quillon.example', ['Sofia Lindqvist', 'Marek Novak', 'Anna Bell'])
    ];
    var bills = [];
    tenants.filter(function (t) { return t.status !== 'trial'; }).forEach(function (t) {
      bills.push({ id: t.id + '-prev', tenantId: t.id, month: monthLabel(-1), plan: t.plan, users: t.usersUsed, unit: PLANS[t.plan].unit, taxRate: 0.07, deadline: at(8), status: t.id === 't5' ? 'overdue' : 'paid' });
      bills.push({ id: t.id + '-cur', tenantId: t.id, month: monthLabel(0), plan: t.plan, users: t.usersUsed, unit: PLANS[t.plan].unit, taxRate: 0.07, deadline: at(-24), status: 'pending' });
    });
    function on(ids) { var o = {}; MODULES.forEach(function (m) { o[m.id] = ids.indexOf(m.id) >= 0; }); return o; }
    return {
      tenants: tenants, bills: bills,
      audit: [
        { id: 'a1', at: at(0, 3), actor: 'System', text: 'Migration to ' + LATEST + ' failed on tenant_quillon' },
        { id: 'a2', at: at(0, 5), actor: 'System', text: 'Release ' + LATEST + ' rolled out to 5 of 6 tenant databases' },
        { id: 'a3', at: at(2, 2), actor: 'Support lead', text: 'Support session ended on Arkadios Home Office' },
        { id: 'a4', at: at(5), actor: STAFF, text: 'Suspended Sterling Hollow Family Office for an overdue bill' },
        { id: 'a5', at: at(6), actor: STAFF, text: 'Created tenant Marlow & Finch Partners on Essentials trial' },
        { id: 'a6', at: at(14), actor: STAFF, text: 'Enabled AI next steps on the Professional plan' }
      ],
      sessions: [
        { id: 's1', staff: 'Support lead', tenantId: 't1', asUser: 'Priya Okafor', reason: 'Checklist not creating tasks after a stage move', startedAt: at(2, 2), endedAt: at(2, 1.5) },
        { id: 's2', staff: 'Support lead', tenantId: 't2', asUser: 'Elena Marsh', reason: 'Report export timed out for a large advisor list', startedAt: at(9, 4), endedAt: at(9, 3.4) }
      ],
      planModules: {
        essentials: on(['directory', 'lifetime']),
        professional: on(['directory', 'lifetime', 'workstreams', 'reports', 'dashboards', 'ai', 'sso', 'audit']),
        enterprise: on(['directory', 'lifetime', 'workstreams', 'reports', 'dashboards', 'ai', 'sso', 'audit', 'integrations'])
      },
      trialDays: { essentials: 14, professional: 30, enterprise: 30 }
    };
  }
  function seed() {
    var s = seedBase();
    function bill(id) { return s.bills.filter(function (b) { return b.id === id; })[0]; }
    function tx(id, tenantId, billId, method, ref, status, when, note) {
      var amt = pay_(bill(billId));
      return { id: id, tenantId: tenantId, billId: billId, method: method, ref: ref, amount: amt, fee: status === 'failed' ? 0 : feeFor(method, amt), status: status, at: when, note: note || '' };
    }
    s.transactions = [
      tx('x1', 't1', 't1-prev', 'stripe', 'ch_3Q9kT21', 'succeeded', at(9, 2)),
      tx('x2', 't2', 't2-prev', 'paypal', 'PP-7K2918', 'succeeded', at(10, 5)),
      tx('x3', 't3', 't3-prev', 'stripe', 'ch_3Q9mA44', 'succeeded', at(11, 1)),
      tx('x4', 't6', 't6-prev', 'bank', 'TRF-20931', 'succeeded', at(12, 3)),
      tx('x5', 't5', 't5-prev', 'stripe', 'ch_3Q9zZ08', 'failed', at(8, 6), 'Card declined'),
      tx('x6', 't6', 't6-cur', 'bank', 'TRF-20977', 'pending', at(1), 'Transfer sent, waiting to arrive')
    ];
    s.sms = {
      balance: 48200,
      tenants: { t1: { credits: 1200, used: 842 }, t2: { credits: 5400, used: 3120 }, t3: { credits: 300, used: 410 }, t4: { credits: 100, used: 36 }, t5: { credits: 0, used: 0 }, t6: { credits: 2200, used: 1500 } },
      messages: [
        { id: 'm1', at: at(3), audience: 'All tenant admins (6)', text: 'Scheduled maintenance on Saturday from 02:00 to 03:00 UTC. The console stays available.', recipients: 6, credits: 6, status: 'delivered' },
        { id: 'm2', at: at(5), audience: 'Sterling Hollow Family Office', text: 'Your September bill is overdue. Please pay it to keep your workspace active.', recipients: 1, credits: 1, status: 'delivered' },
        { id: 'm3', at: at(6), audience: 'Marlow & Finch Partners', text: 'Welcome to your trial. Your workspace is ready at marlow-finch.platform.example.', recipients: 1, credits: 1, status: 'delivered' }
      ]
    };
    s.staff = [
      { id: 'u1', name: 'Dana Whitfield', email: 'dana.whitfield@platform.example', role: 'admin', mfa: true, lastActive: at(0, 0.2), status: 'active', self: true },
      { id: 'u2', name: 'Omar Haddad', email: 'omar.haddad@platform.example', role: 'support', mfa: true, lastActive: at(0, 2), status: 'active' },
      { id: 'u3', name: 'Priya Nair', email: 'priya.nair@platform.example', role: 'billing', mfa: true, lastActive: at(1), status: 'active' },
      { id: 'u4', name: 'Liam Carter', email: 'liam.carter@platform.example', role: 'auditor', mfa: false, lastActive: at(6), status: 'active' },
      { id: 'u5', name: 'Sofia Reyes', email: 'sofia.reyes@platform.example', role: 'support', mfa: false, lastActive: null, status: 'invited' }
    ];
    s.perms = {
      tenants: { admin: 'manage', support: 'view', billing: 'view', auditor: 'view' },
      plans: { admin: 'manage', support: 'view', billing: 'view', auditor: 'view' },
      billing: { admin: 'manage', support: 'view', billing: 'manage', auditor: 'view' },
      transactions: { admin: 'manage', support: 'none', billing: 'manage', auditor: 'view' },
      sms: { admin: 'manage', support: 'manage', billing: 'none', auditor: 'none' },
      support: { admin: 'manage', support: 'manage', billing: 'none', auditor: 'view' },
      access: { admin: 'manage', support: 'none', billing: 'none', auditor: 'view' }
    };
    s.security = { mfa: true, idle: 30 };
    return s;
  }
  var S;
  var memory = null;
  function load() {
    var s = null;
    try { var raw = localStorage.getItem(KEY); if (raw) s = JSON.parse(raw); } catch (e) { s = memory; }
    if (!s) s = memory;
    var base = seed();
    if (!s) return base;
    Object.keys(base).forEach(function (k) { if (!(k in s)) s[k] = base[k]; });
    return s;
  }
  function save() {
    memory = S;
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable: keep in memory */ }
  }
  function log(text, actor) { S.audit.unshift({ id: nextId('a'), at: new Date().toISOString(), actor: actor || actorName(), text: text }); }
  function tenantById(id) { return S.tenants.filter(function (t) { return t.id === id; })[0]; }
  function tenantName(id) { var t = tenantById(id); return t ? t.name : 'Unknown tenant'; }
  function activeSession() { return S.sessions.filter(function (s) { return !s.endedAt; })[0]; }
  function tenantUrl(sub) { return sub + '.' + DOMAIN; }

  /* ---------- sign-in session and permissions ---------- */
  var SESS_KEY = 'arkadios_platform_session';
  var DEMO_PASSWORD = 'demo-1234';
  var DEMO_CODE = '123456';
  var AREA_OF = { overview: null, tenants: 'tenants', plans: 'plans', billing: 'billing', transactions: 'transactions', sms: 'sms', support: 'support', access: 'access' };
  var LANDING = { admin: 'index.html', support: 'tenants.html', billing: 'billing.html', auditor: 'index.html' };
  var memSession = null;
  function getSession() {
    try { var r = sessionStorage.getItem(SESS_KEY); return r ? JSON.parse(r) : null; } catch (e) { return memSession; }
  }
  function setSession(o) {
    memSession = o;
    try { if (o) sessionStorage.setItem(SESS_KEY, JSON.stringify(o)); else sessionStorage.removeItem(SESS_KEY); } catch (e) { /* keep in memory */ }
  }
  function currentUser() {
    var s = getSession(); if (!s || !S) return null;
    var u = S.staff.filter(function (x) { return x.id === s.userId; })[0];
    return u && u.status === 'active' ? u : null;
  }
  function levelOf(area) {
    var u = currentUser(); if (!u) return 'none';
    if (u.role === 'admin') return 'manage';
    return (S.perms[area] && S.perms[area][u.role]) || 'none';
  }
  function can(area) { return levelOf(area) === 'manage'; }
  function canView(area) { return levelOf(area) !== 'none'; }
  function actorName() { var u = currentUser(); return u ? u.name : STAFF; }
  function currentFile() { return (location.pathname.split('/').pop() || 'index.html') + location.hash; }
  function signOut(msg) {
    setSession(null);
    location.href = 'login.html' + (msg ? '?msg=' + encodeURIComponent(msg) : '');
  }
  function areaLabel(a) { return AREAS.filter(function (x) { return x[0] === a; })[0][1]; }
  function noAccess(main, page) {
    var u = currentUser(), a = AREA_OF[page];
    main.innerHTML = pageHead('No access', 'Your role, ' + ROLES[u.role] + ', does not include ' + esc(areaLabel(a)) + '.') +
      '<p class="muted" style="max-width:60ch">A Super admin can change what each role can do under Access control.</p><p style="margin-top:16px"><a class="btn btn--secondary" href="' + LANDING[u.role] + '">Go to your home page</a></p>';
  }


  /* ---------- toast ---------- */
  var toastTimer;
  function toast(text) {
    var el = document.getElementById('toast');
    el.innerHTML = '<div class="toast">' + esc(text) + '</div>';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.innerHTML = ''; }, 3600);
  }

  /* ---------- dialogs ---------- */
  function dialog(opts) {
    var d = document.createElement('dialog');
    d.className = 'dlg dlg--' + (opts.variant || 'modal');
    var tid = 'dlg-title-' + (++uid);
    d.setAttribute('aria-labelledby', tid);
    d.innerHTML = '<div class="dlg__panel"><header class="dlg__head"><div><h2 id="' + tid + '">' + esc(opts.title) + '</h2>' +
      (opts.description ? '<p>' + esc(opts.description) + '</p>' : '') + '</div>' +
      '<button type="button" class="icon-btn" aria-label="Close" data-close>' + icon('x') + '</button></header><div class="dlg__body"></div></div>';
    var closeBtn = d.querySelector('[data-close]');
    var api = {
      el: d, body: d.querySelector('.dlg__body'), locked: false,
      close: function () { if (d.open) d.close(); },
      lock: function (v) { api.locked = v; closeBtn.disabled = v; }
    };
    api.body.innerHTML = opts.body || '';
    d.addEventListener('cancel', function (e) { if (api.locked) e.preventDefault(); });
    d.addEventListener('close', function () { d.remove(); if (opts.onClose) opts.onClose(); });
    d.addEventListener('click', function (e) { if (e.target === d && !api.locked) api.close(); });
    closeBtn.addEventListener('click', function () { if (!api.locked) api.close(); });
    document.body.appendChild(d);
    d.showModal();
    if (opts.onMount) opts.onMount(api);
    return api;
  }
  function confirmDialog(o) {
    var typed = o.typeToConfirm;
    var api = dialog({
      title: o.title, description: o.description,
      body: (typed ? '<div class="field"><label for="cf-typed">Company name</label><input id="cf-typed" class="input" autocomplete="off"></div>' : '') +
        '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>' + esc(o.cancelLabel || 'Cancel') + '</button>' +
        '<button type="button" class="btn ' + (o.danger ? 'btn--danger' : 'btn--primary') + '" data-ok' + (typed ? ' disabled' : '') + '>' + esc(o.confirmLabel) + '</button></div>'
    });
    var ok = api.body.querySelector('[data-ok]');
    api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
    if (typed) {
      var input = api.body.querySelector('#cf-typed');
      input.addEventListener('input', function () { ok.disabled = input.value !== typed; });
    }
    ok.addEventListener('click', function () { api.close(); o.onConfirm(); });
    return api;
  }
  function field(id, label, control, hint, error) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>' + control +
      (hint ? '<span class="hint" id="' + id + '-hint">' + esc(hint) + '</span>' : '') +
      '<span class="error" id="' + id + '-err" role="alert"' + (error ? '' : ' hidden') + '>' + esc(error || '') + '</span></div>';
  }
  function setError(id, msg) {
    var e = document.getElementById(id + '-err'), c = document.getElementById(id);
    if (!e || !c) return;
    e.textContent = msg || ''; e.hidden = !msg;
    if (msg) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid');
  }
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 500);
  }
  function statusBadge(kind) {
    var L = { active: 'Active', trial: 'Trial', suspended: 'Suspended', offboarding: 'Offboarding', paid: 'Paid', pending: 'Pending', overdue: 'Overdue', ok: 'Up to date', failed: 'Failed', ended: 'Ended', live: 'In progress', succeeded: 'Succeeded', refunded: 'Refunded', delivered: 'Delivered' };
    return '<span class="badge badge--' + kind + '">' + (L[kind] || kind) + '</span>';
  }
  function planName(id) { return PLANS[id].name; }
  var App = { refresh: function () {} };

  /* ---------- shared chrome ---------- */
  var NAV = [
    ['index.html', 'Overview', 'grid', 'overview'], ['tenants.html', 'Tenants', 'building', 'tenants'],
    ['plans.html', 'Plans and modules', 'layers', 'plans'], ['billing.html', 'Billing', 'receipt', 'billing'],
    ['transactions.html', 'Transactions', 'card', 'transactions'], ['sms.html', 'SMS', 'message', 'sms'],
    ['support.html', 'Support access', 'headset', 'support'], ['access.html', 'Access control', 'lock', 'access']
  ];
  function renderSidebar() {
    var page = document.body.getAttribute('data-page'), u = currentUser();
    var items = NAV.filter(function (n) { return !AREA_OF[n[3]] || canView(AREA_OF[n[3]]); });
    document.getElementById('sidebar').innerHTML =
      '<div class="sidebar__brand"><span class="sidebar__mark" aria-hidden="true">P</span><div><strong>Platform console</strong><small>Staff only</small></div></div>' +
      '<nav aria-label="Platform" class="sidebar__nav">' + items.map(function (n) {
        return '<a class="sidebar__link' + (n[3] === page ? ' active' : '') + '" href="' + n[0] + '"' + (n[3] === page ? ' aria-current="page"' : '') + '>' + icon(n[2]) + '<span>' + n[1] + '</span></a>';
      }).join('') + '</nav>' +
      '<div class="sidebar__foot"><div class="sidebar__user"><strong>' + esc(u.name) + '</strong><span>' + ROLES[u.role] + '</span></div>' +
      '<button type="button" class="sidebar__reset" id="sign-out">Sign out</button>' +
      (u.role === 'admin' ? '<button type="button" class="sidebar__reset sidebar__reset--demo" id="reset-demo">Reset demo data</button>' : '') + '</div>';
    document.getElementById('sign-out').addEventListener('click', function () { signOut(); });
    var rd = document.getElementById('reset-demo');
    if (rd) rd.addEventListener('click', function () {
      confirmDialog({
        title: 'Reset the demo?', description: 'This puts every tenant, bill, plan, and session back to the sample data.', confirmLabel: 'Reset demo data', danger: true,
        onConfirm: function () { try { localStorage.removeItem(KEY); } catch (e) {} memory = null; location.reload(); }
      });
    });
  }
  function renderBanner() {
    var s = activeSession(), el = document.getElementById('banner');
    if (!s || !canView('support')) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="session-banner" role="status">' + icon('eye') + '<p>Support session: viewing <strong>' + esc(tenantName(s.tenantId)) + '</strong> as <strong>' + esc(s.asUser) + '</strong>. Everything you do is recorded.</p>' +
      (can('support') ? '<button type="button" class="btn btn--secondary btn--small" id="end-session">End session</button>' : '') + '</div>';
    var eb = document.getElementById('end-session'); if (eb) eb.addEventListener('click', endSession);
  }
  function endSession() {
    var s = activeSession(); if (!s || !can('support')) return;
    s.endedAt = new Date().toISOString();
    log('Ended the support session on ' + tenantName(s.tenantId));
    save(); renderBanner(); App.refresh(); toast('Support session ended');
  }
  function pageHead(title, sub, actionsHtml) {
    return '<header class="page__head"><div><h1>' + title + '</h1><p class="muted">' + sub + '</p></div>' + (actionsHtml || '') + '</header>';
  }

  /* ---------- create tenant (drawer with provisioning) ---------- */
  function openCreateTenant() {
    if (!can('tenants')) { toast('Your role can view tenants but not create them'); return; }
    var planOptions = PLAN_IDS.map(function (p) { return '<option value="' + p + '"' + (p === 'professional' ? ' selected' : '') + '>' + PLANS[p].name + '</option>'; }).join('');
    var regionOptions = REGIONS.map(function (r) { return '<option>' + r + '</option>'; }).join('');
    var form =
      '<form id="ct-form" novalidate>' +
      field('ct-name', 'Company name', '<input id="ct-name" class="input" autocomplete="off">') +
      field('ct-sub', 'Domain', '<div class="input-group"><input id="ct-sub" class="input mono" autocomplete="off"><span class="suffix">.' + DOMAIN + '</span></div>', 'The tenant signs in here. It also names the database.') +
      field('ct-plan', 'Plan', '<select id="ct-plan" class="select">' + planOptions + '</select>', PLANS.professional.blurb + '. Starts with a ' + S.trialDays.professional + '-day trial.') +
      field('ct-limit', 'User limit', '<input id="ct-limit" type="number" min="1" max="1000" class="input" value="50">') +
      field('ct-region', 'Hosting region', '<select id="ct-region" class="select">' + regionOptions + '</select>', "Where this tenant's database is hosted.") +
      field('ct-email', 'First admin email', '<input id="ct-email" type="email" class="input" autocomplete="off">') +
      '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Create tenant</button></div></form>';
    var api = dialog({ title: 'Create tenant', description: 'Each tenant gets its own domain and its own database.', variant: 'drawer', body: form });
    var b = api.body, subTouched = false;
    var name = b.querySelector('#ct-name'), sub = b.querySelector('#ct-sub'), plan = b.querySelector('#ct-plan');
    b.querySelector('[data-cancel]').addEventListener('click', api.close);
    name.focus();
    name.addEventListener('input', function () { if (!subTouched) sub.value = slug(name.value).slice(0, 30); });
    sub.addEventListener('input', function () { subTouched = true; sub.value = sub.value.toLowerCase(); });
    plan.addEventListener('change', function () {
      document.getElementById('ct-plan-hint').textContent = PLANS[plan.value].blurb + '. Starts with a ' + S.trialDays[plan.value] + '-day trial.';
    });
    b.querySelector('#ct-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = { name: name.value.trim(), sub: sub.value, plan: plan.value, limit: Number(b.querySelector('#ct-limit').value), region: b.querySelector('#ct-region').value, email: b.querySelector('#ct-email').value.trim() };
      var bad = false;
      setError('ct-name', v.name ? '' : 'Enter the company name.'); if (!v.name) bad = true;
      var subErr = '';
      if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(v.sub)) subErr = 'Use 3 to 30 lowercase letters, numbers, or hyphens.';
      else if (S.tenants.some(function (t) { return t.subdomain === v.sub; })) subErr = 'This domain is already taken.';
      setError('ct-sub', subErr); if (subErr) bad = true;
      var limErr = (v.limit >= 1 && v.limit <= 1000) ? '' : 'Enter a number from 1 to 1000.';
      setError('ct-limit', limErr); if (limErr) bad = true;
      var emErr = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email) ? '' : 'Enter a valid email address.';
      setError('ct-email', emErr); if (emErr) bad = true;
      if (bad) { var first = b.querySelector('[aria-invalid="true"]'); if (first) first.focus(); return; }
      provision(api, v);
    });
  }
  function provision(api, v) {
    var db = 'tenant_' + v.sub.replace(/-/g, '_');
    var steps = ['Creating the database ' + db, 'Running migrations for release ' + LATEST, 'Seeding default stages, checklists, and roles', 'Setting up the domain ' + tenantUrl(v.sub), 'Inviting ' + v.email + ' as the first admin'];
    api.lock(true);
    function paint(i, finished) {
      api.body.innerHTML = '<ol class="provision" aria-live="polite">' + steps.map(function (s, k) {
        var state = finished || k < i ? 'done' : (k === i ? 'run' : 'wait');
        return '<li class="provision__step provision__step--' + state + '"><span class="provision__icon" aria-hidden="true">' + (state === 'done' ? icon('check', 16) : (state === 'run' ? '<span class="spinner"></span>' : '')) + '</span><span>' + esc(s) + '</span><span class="sr-only">' + (state === 'done' ? ' (done)' : state === 'run' ? ' (in progress)' : ' (waiting)') + '</span></li>';
      }).join('') + '</ol>';
    }
    var delay = reducedMotion() ? 100 : 850, i = 0;
    paint(0, false);
    (function tick() {
      i += 1;
      if (i < steps.length + 0) { paint(i, false); setTimeout(tick, delay); return; }
      paint(i, true);
      var t = {
        id: nextId('t'), name: v.name, subdomain: v.sub, db: db, plan: v.plan, usersUsed: 1, userLimit: v.limit, status: 'trial', createdAt: new Date().toISOString(),
        schema: LATEST, migration: 'ok', region: v.region, adminEmail: v.email, users: [v.email.split('@')[0]]
      };
      S.tenants.unshift(t);
      log('Created tenant ' + t.name + ' on ' + planName(t.plan) + ' trial');
      save(); App.refresh();
      api.lock(false);
      api.body.insertAdjacentHTML('beforeend', '<div class="done-note"><h3>' + esc(t.name) + ' is ready</h3><p class="muted">Workspace at <span class="mono">' + esc(tenantUrl(t.subdomain)) + '</span>. An invitation went to ' + esc(t.adminEmail) + '. The trial runs for ' + S.trialDays[t.plan] + ' days.</p><div class="form-actions"><button type="button" class="btn btn--secondary" data-manage>Manage tenant</button><button type="button" class="btn btn--primary" data-done>Done</button></div></div>');
      api.body.querySelector('[data-done]').addEventListener('click', api.close);
      api.body.querySelector('[data-manage]').addEventListener('click', function () { api.close(); openManage(t.id); });
    })();
    setTimeout(function () {}, 0);
  }

  /* ---------- manage tenant (drawer) ---------- */
  function openManage(id) {
    var api = dialog({ title: tenantName(id), description: "Manage this tenant's account.", variant: 'drawer', body: '' });
    function draw() {
      var t = tenantById(id); if (!t) { api.close(); return; }
      api.body.innerHTML =
        '<dl class="facts">' +
        row('Status', statusBadge(t.status)) + row('Plan', planName(t.plan)) + row('Domain', '<span class="mono">' + esc(tenantUrl(t.subdomain)) + '</span>') +
        row('Database', '<span class="mono">' + esc(t.db) + '</span>') + row('Hosting region', esc(t.region)) + row('Schema version', '<span class="mono">' + esc(t.schema) + '</span>') + row('SMS credits', smsFor(t.id).credits.toLocaleString('en-US')) +
        row('Created', fmtDate(t.createdAt)) + row('First admin', esc(t.adminEmail)) + '</dl>' +
        '<h3 class="drawer-h">User limit</h3>' +
        '<div class="field"><label for="mt-limit">Currently ' + t.usersUsed + ' users in use</label><div class="inline-form"><input id="mt-limit" type="number" min="' + t.usersUsed + '" class="input" value="' + t.userLimit + '">' +
        '<button type="button" class="btn btn--secondary" id="mt-save" disabled>Save limit</button></div><span class="error" id="mt-limit-err" role="alert" hidden></span></div>' +
        '<h3 class="drawer-h">Account</h3><div class="btn-row">' +
        (t.status === 'suspended' ? '<button type="button" class="btn btn--secondary" id="mt-react">Reactivate tenant</button>' : (t.status !== 'offboarding' ? '<button type="button" class="btn btn--secondary" id="mt-susp">Suspend tenant</button>' : '')) +
        '<button type="button" class="btn btn--secondary" id="mt-export">Export all data</button>' +
        (t.status !== 'offboarding' ? '<button type="button" class="btn btn--secondary btn--danger-text" id="mt-off">Offboard tenant</button>' : '') + '</div>' +
        (t.status === 'offboarding' ? '<p class="muted note">A full export is ready. The database is deleted 30 days after offboarding starts.</p>' : '');
      if (!can('tenants')) {
        var dl = api.body.querySelector('.facts');
        while (dl.nextSibling) dl.parentNode.removeChild(dl.nextSibling);
        api.body.insertAdjacentHTML('beforeend', '<p class="muted note">Your role can view this tenant but cannot change it.</p>');
        return;
      }
      var lim = api.body.querySelector('#mt-limit'), saveBtn = api.body.querySelector('#mt-save');
      lim.addEventListener('input', function () {
        var n = Number(lim.value), okv = n >= t.usersUsed && n !== t.userLimit;
        saveBtn.disabled = !okv;
        var er = api.body.querySelector('#mt-limit-err');
        er.hidden = !(n < t.usersUsed); er.textContent = n < t.usersUsed ? 'The limit cannot be lower than the ' + t.usersUsed + ' users already in use.' : '';
      });
      saveBtn.addEventListener('click', function () {
        t.userLimit = Number(lim.value); log('Set the user limit for ' + t.name + ' to ' + t.userLimit); save(); App.refresh(); toast('User limit saved'); draw();
      });
      var react = api.body.querySelector('#mt-react');
      if (react) react.addEventListener('click', function () { setStatus(t, 'active', 'Reactivated'); draw(); });
      var susp = api.body.querySelector('#mt-susp');
      if (susp) susp.addEventListener('click', function () {
        confirmDialog({ title: 'Suspend ' + t.name + '?', description: 'Users can no longer sign in. Data stays in the database until you reactivate.', confirmLabel: 'Suspend tenant', cancelLabel: 'Keep active', danger: true, onConfirm: function () { setStatus(t, 'suspended', 'Suspended'); draw(); } });
      });
      api.body.querySelector('#mt-export').addEventListener('click', function () {
        download('export-' + t.subdomain + '.json', JSON.stringify({ exportedAt: new Date().toISOString(), tenant: t, bills: S.bills.filter(function (b) { return b.tenantId === t.id; }) }, null, 2), 'application/json');
        log('Exported all data for ' + t.name); save(); toast('Export downloaded');
      });
      var off = api.body.querySelector('#mt-off');
      if (off) off.addEventListener('click', function () {
        confirmDialog({ title: 'Offboard ' + t.name + '?', description: 'The tenant gets a full export, then its database is deleted after 30 days. Type the company name to confirm.', confirmLabel: 'Start offboarding', danger: true, typeToConfirm: t.name, onConfirm: function () { setStatus(t, 'offboarding', 'Started offboarding for'); draw(); } });
      });
    }
    function row(k, v) { return '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>'; }
    draw();
  }
  function setStatus(t, status, verb) {
    t.status = status; log(verb + ' ' + t.name); save(); App.refresh(); toast(verb + ' ' + t.name);
  }

  /* ---------- support session (modal) ---------- */
  function openSignIn(defaultId) {
    if (!can('support')) { toast('Your role cannot start support sessions'); return; }
    var s = activeSession();
    if (s) {
      var a = dialog({ title: 'Start a support session', description: 'Troubleshoot as a tenant user. Every action is logged.',
        body: '<p>A support session is already open on <strong>' + esc(tenantName(s.tenantId)) + '</strong>. End it before starting another.</p><div class="form-actions"><button type="button" class="btn btn--secondary" data-close2>Close</button><button type="button" class="btn btn--primary" data-end>End that session</button></div>' });
      a.body.querySelector('[data-close2]').addEventListener('click', a.close);
      a.body.querySelector('[data-end]').addEventListener('click', function () { a.close(); endSession(); });
      return;
    }
    var eligible = S.tenants.filter(function (t) { return t.status !== 'offboarding'; });
    var id0 = defaultId && tenantById(defaultId) ? defaultId : eligible[0].id;
    var api = dialog({
      title: 'Start a support session', description: 'Troubleshoot as a tenant user. Every action is logged.',
      body: '<form id="si-form" novalidate>' +
        field('si-tenant', 'Tenant', '<select id="si-tenant" class="select">' + eligible.map(function (t) { return '<option value="' + t.id + '"' + (t.id === id0 ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') + '</select>') +
        field('si-user', 'Sign in as', '<select id="si-user" class="select"></select>', "You act with this user's permissions, without their password.") +
        field('si-reason', 'Reason', '<textarea id="si-reason" class="textarea"></textarea>', "Saved with the session so the tenant's admin can see why.") +
        '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Start support session</button></div></form>'
    });
    var b = api.body, tsel = b.querySelector('#si-tenant'), usel = b.querySelector('#si-user');
    function fillUsers() { usel.innerHTML = tenantById(tsel.value).users.map(function (u) { return '<option>' + esc(u) + '</option>'; }).join(''); }
    fillUsers();
    tsel.addEventListener('change', fillUsers);
    b.querySelector('[data-cancel]').addEventListener('click', api.close);
    b.querySelector('#si-reason').addEventListener('input', function () { setError('si-reason', ''); });
    b.querySelector('#si-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var reason = b.querySelector('#si-reason').value.trim();
      if (reason.length < 10) { setError('si-reason', 'Describe why you need access, in at least 10 characters.'); b.querySelector('#si-reason').focus(); return; }
      S.sessions.unshift({ id: nextId('s'), staff: actorName(), tenantId: tsel.value, asUser: usel.value, reason: reason, startedAt: new Date().toISOString() });
      log('Started a support session on ' + tenantName(tsel.value) + ' as ' + usel.value);
      save(); api.close(); renderBanner(); App.refresh(); toast('Support session started on ' + tenantName(tsel.value));
    });
  }

  /* ---------- page: overview ---------- */
  function pageOverview(main) {
    var tenants = S.tenants, total = tenants.length, seeT = canView('tenants');
    var order = [['active', 'Active'], ['trial', 'Trial'], ['suspended', 'Suspended'], ['offboarding', 'Offboarding']];
    var counts = order.map(function (o) { return { key: o[0], label: o[1], n: tenants.filter(function (t) { return t.status === o[0]; }).length }; });
    var failed = tenants.filter(function (t) { return t.migration === 'failed'; });
    var attention = [];
    if (canView('billing')) S.bills.filter(function (b) { return b.status === 'overdue'; }).forEach(function (b) {
      attention.push({ text: esc(tenantName(b.tenantId)) + ' has an overdue ' + esc(b.month) + ' bill, ' + Math.abs(daysFromNow(b.deadline)) + ' days past its deadline.', href: 'billing.html#overdue', cta: 'Open billing' });
    });
    if (seeT) tenants.filter(function (t) { return t.status !== 'offboarding' && t.usersUsed / t.userLimit >= 0.9; }).forEach(function (t) {
      attention.push({ text: esc(t.name) + ' is using ' + t.usersUsed + ' of ' + t.userLimit + ' users.', href: 'tenants.html#manage=' + t.id, cta: can('tenants') ? 'Review limit' : 'View tenant' });
    });
    if (canView('transactions')) S.transactions.filter(function (x) { return x.status === 'failed'; }).forEach(function (x) {
      attention.push({ text: esc(tenantName(x.tenantId)) + ' has a failed payment of ' + money(x.amount) + ' (' + esc((x.note || 'declined').toLowerCase()) + ').', href: 'transactions.html#failed', cta: 'Open transactions' });
    });
    if (canView('sms')) tenants.filter(function (t) { return t.status === 'active' && smsFor(t.id).credits < 500; }).forEach(function (t) {
      attention.push({ text: esc(t.name) + ' has ' + smsFor(t.id).credits + ' SMS credits left.', href: 'sms.html', cta: can('sms') ? 'Add credits' : 'View SMS' });
    });
    var u = currentUser();
    var aria = 'Tenants by status: ' + counts.filter(function (c) { return c.n; }).map(function (c) { return c.n + ' ' + c.label.toLowerCase(); }).join(', ');
    var statusPanel = !seeT ? '' :
      '<section class="panel" aria-labelledby="h-status"><div class="panel__head"><h2 id="h-status">Tenants by status</h2></div><div class="panel__body"><div class="statusbar" role="img" aria-label="' + esc(aria) + '">' +
      counts.filter(function (c) { return c.n > 0; }).map(function (c) { return '<span class="statusbar__seg statusbar__seg--' + c.key + '" style="flex-grow:' + c.n + '"></span>'; }).join('') + '</div><ul class="legend">' +
      counts.map(function (c) { return '<li><span class="legend__dot legend__dot--' + c.key + '" aria-hidden="true"></span>' + c.label + ' <strong class="num">' + c.n + '</strong></li>'; }).join('') + '</ul></div></section>';
    var attnPanel = '<section class="panel" aria-labelledby="h-attn"><div class="panel__head"><h2 id="h-attn">Needs attention</h2><span class="muted">' + attention.length + ' items</span></div>' +
      (attention.length ? '<ul class="rows">' + attention.map(function (a) { return '<li class="rows__item">' + icon('alert') + '<p>' + a.text + '</p><a class="btn btn--ghost btn--small" href="' + a.href + '">' + a.cta + '</a></li>'; }).join('') + '</ul>' : '<p class="panel__body muted">Nothing needs attention right now.</p>') + '</section>';
    var actPanel = !canView('access') ? '' :
      '<section class="panel" aria-labelledby="h-act"><div class="panel__head"><h2 id="h-act">Recent activity</h2></div><ul class="rows">' +
      S.audit.slice(0, 6).map(function (a) { return '<li class="rows__item rows__item--plain"><p><strong>' + esc(a.actor) + '</strong> ' + esc(a.text) + '</p><time class="muted" datetime="' + a.at + '">' + ago(a.at) + '</time></li>'; }).join('') + '</ul></section>';
    var rollPanel = !seeT ? '' :
      '<section class="panel" aria-labelledby="h-roll"><div class="panel__head"><h2 id="h-roll">Release ' + LATEST + ' rollout</h2><span class="muted num">' + (total - failed.length) + ' of ' + total + ' databases</span></div>' +
      '<div class="panel__body"><div class="rollbar" role="img" aria-label="' + (total - failed.length) + ' of ' + total + ' tenant databases are on ' + LATEST + '"><span style="width:' + ((total - failed.length) / total * 100) + '%"></span></div>' +
      '<p class="muted rollnote">Schema changes roll out database by database. A failed migration leaves the tenant on its current version until you retry.</p></div><ul class="rows">' +
      tenants.map(function (t) {
        return '<li class="rows__item rows__item--plain"><div><strong>' + esc(t.name) + '</strong><span class="cell-sub mono">' + esc(t.db) + ' on ' + esc(t.schema) + '</span></div>' +
          (t.migration === 'failed' ? (can('tenants') ? '<button type="button" class="btn btn--secondary btn--small" data-retry="' + t.id + '">' + icon('refresh', 15) + ' Retry<span class="sr-only"> migration for ' + esc(t.name) + '</span></button>' : statusBadge('failed')) : statusBadge('ok')) + '</li>';
      }).join('') + '</ul></section>';
    var left = '<div class="stack">' + statusPanel + attnPanel + actPanel + '</div>';
    main.innerHTML = pageHead('Platform overview', 'Welcome back, ' + esc(u.name.split(' ')[0]) + '. You are signed in as ' + ROLES[u.role] + '.', can('tenants') ? '<button type="button" class="btn btn--primary" id="ov-create">' + icon('plus') + ' Create tenant</button>' : '') +
      (rollPanel ? '<div class="grid-2">' + left + rollPanel + '</div>' : left);
    var cr = main.querySelector('#ov-create'); if (cr) cr.addEventListener('click', openCreateTenant);
    main.querySelectorAll('[data-retry]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = tenantById(btn.getAttribute('data-retry'));
        t.schema = LATEST; t.migration = 'ok'; log('Migration to ' + LATEST + ' succeeded on ' + t.name, 'System'); save(); App.refresh(); toast(t.name + ' is now on ' + LATEST);
      });
    });
  }

  /* ---------- page: tenants ---------- */
  function pageTenants(main) {
    var q = main.__q || '', st = main.__st || 'all';
    main.innerHTML = pageHead('Tenants', 'Each tenant has its own domain, database, plan, and user limit.', (can('tenants') ? '<button type="button" class="btn btn--primary" id="tn-create">' + icon('plus') + ' Create tenant</button>' : '')) +
      '<div class="toolbar"><div class="search">' + icon('search', 16) + '<label for="t-q" class="sr-only">Search tenants</label><input id="t-q" class="input" placeholder="Search by name, domain, or database" autocomplete="off"></div>' +
      '<div><label for="t-status" class="sr-only">Filter by status</label><select id="t-status" class="select"><option value="all">All statuses</option><option value="active">Active</option><option value="trial">Trial</option><option value="suspended">Suspended</option><option value="offboarding">Offboarding</option></select></div></div>' +
      '<div class="table-wrap"><table class="table table--compact"><thead><tr><th>Tenant</th><th>Domain</th><th>Database</th><th>Plan</th><th>Users</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody id="t-body"></tbody></table></div>';
    var qi = main.querySelector('#t-q'), ss = main.querySelector('#t-status');
    qi.value = q; ss.value = st;
    function rows() {
      var text = qi.value.trim().toLowerCase();
      var list = S.tenants.filter(function (t) { return (ss.value === 'all' || t.status === ss.value) && (t.name + ' ' + t.subdomain + ' ' + t.db).toLowerCase().indexOf(text) >= 0; });
      main.querySelector('#t-body').innerHTML = list.length ? list.map(function (t) {
        var r = t.usersUsed / t.userLimit;
        return '<tr data-id="' + t.id + '"><td><strong>' + esc(t.name) + '</strong><span class="cell-sub">Created ' + fmtDate(t.createdAt) + '</span></td><td class="mono">' + esc(tenantUrl(t.subdomain)) + '</td><td class="mono">' + esc(t.db) + '</td><td>' + planName(t.plan) + '</td>' +
          '<td class="nowrap"><span class="num">' + t.usersUsed + ' of ' + t.userLimit + '</span> <span class="meter ' + (r >= 1 ? 'meter--full' : r >= 0.9 ? 'meter--warn' : '') + '" aria-hidden="true"><span style="width:' + Math.min(100, r * 100) + '%"></span></span></td><td>' + statusBadge(t.status) + '</td>' +
          '<td><div class="actions"><button type="button" class="btn btn--ghost btn--small" data-manage="' + t.id + '">' + (can('tenants') ? 'Manage' : 'View') + '<span class="sr-only"> ' + esc(t.name) + '</span></button>' +
          (can('support') ? '<button type="button" class="btn btn--ghost btn--small" data-signin="' + t.id + '"' + (t.status === 'offboarding' ? ' disabled' : '') + '>Sign in as<span class="sr-only"> a user of ' + esc(t.name) + '</span></button>' : '') + '</div></td></tr>';
      }).join('') : '<tr><td colspan="7" class="empty">No tenants match. Clear the search or choose another status.</td></tr>';
      main.querySelectorAll('[data-manage]').forEach(function (b) { b.addEventListener('click', function () { openManage(b.getAttribute('data-manage')); }); });
      main.querySelectorAll('[data-signin]').forEach(function (b) { b.addEventListener('click', function () { openSignIn(b.getAttribute('data-signin')); }); });
    }
    qi.addEventListener('input', function () { main.__q = qi.value; rows(); });
    ss.addEventListener('change', function () { main.__st = ss.value; rows(); });
    var tc = main.querySelector('#tn-create'); if (tc) tc.addEventListener('click', openCreateTenant);
    rows();
  }

  /* ---------- page: plans ---------- */
  function pagePlans(main) {
    var draft = main.__draft || (main.__draft = { modules: JSON.parse(JSON.stringify(S.planModules)), trial: JSON.parse(JSON.stringify(S.trialDays)) });
    function dirty() { return JSON.stringify(draft.modules) !== JSON.stringify(S.planModules) || JSON.stringify(draft.trial) !== JSON.stringify(S.trialDays); }
    main.innerHTML = pageHead('Plans and modules', 'Switch modules on or off per plan. Tenants see only what their plan includes; the rest shows locked with an upgrade prompt.',
      (can('plans') ? '<div class="btn-row"><button type="button" class="btn btn--secondary" id="pl-discard" disabled>Discard</button><button type="button" class="btn btn--primary" id="pl-save" disabled>Save changes</button></div>' : '')) +
      '<div class="table-wrap"><table class="table matrix"><thead><tr><th scope="col">Module</th>' + PLAN_IDS.map(function (p) {
        var n = S.tenants.filter(function (t) { return t.plan === p; }).length;
        return '<th scope="col" class="matrix__plan"><span class="matrix__name">' + PLANS[p].name + '</span><span class="cell-sub">' + n + ' ' + (n === 1 ? 'tenant' : 'tenants') + '</span></th>';
      }).join('') + '</tr></thead><tbody><tr><th scope="row">Trial length<span class="cell-sub">Days before the first bill</span></th>' +
      PLAN_IDS.map(function (p) { return '<td class="matrix__cell"><label class="sr-only" for="trial-' + p + '">Trial days for ' + PLANS[p].name + '</label><input id="trial-' + p + '" type="number" min="0" max="90" class="input input--narrow" value="' + draft.trial[p] + '" data-trial="' + p + '"></td>'; }).join('') + '</tr>' +
      MODULES.map(function (m) {
        return '<tr><th scope="row">' + m.name + '<span class="cell-sub">' + (m.later ? 'Coming later' : m.note) + '</span></th>' + PLAN_IDS.map(function (p) {
          return '<td class="matrix__cell"><span class="switch"><input type="checkbox" data-mod="' + m.id + '" data-plan="' + p + '" aria-label="' + esc(m.name) + ' on ' + PLANS[p].name + '"' + (draft.modules[p][m.id] ? ' checked' : '') + (m.later ? ' disabled' : '') + '><span></span></span></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    if (!can('plans')) { main.querySelectorAll('input').forEach(function (i) { i.disabled = true; }); return; }
    var save_ = main.querySelector('#pl-save'), disc = main.querySelector('#pl-discard');
    function sync() { var d = dirty(); save_.disabled = !d; disc.disabled = !d; }
    main.querySelectorAll('[data-mod]').forEach(function (c) { c.addEventListener('change', function () { draft.modules[c.getAttribute('data-plan')][c.getAttribute('data-mod')] = c.checked; sync(); }); });
    main.querySelectorAll('[data-trial]').forEach(function (c) { c.addEventListener('input', function () { draft.trial[c.getAttribute('data-trial')] = Number(c.value); sync(); }); });
    save_.addEventListener('click', function () {
      S.planModules = JSON.parse(JSON.stringify(draft.modules)); S.trialDays = JSON.parse(JSON.stringify(draft.trial));
      log('Updated plan modules and trial lengths'); save(); sync(); App.refresh(); toast('Plan changes saved');
    });
    disc.addEventListener('click', function () { main.__draft = null; App.refresh(); toast('Changes discarded'); });
    sync();
  }

  /* ---------- page: billing ---------- */
  function sub_(b) { return b.users * b.unit; }
  function tax_(b) { return sub_(b) * b.taxRate; }
  function pay_(b) { return sub_(b) + tax_(b); }
  function invoiceHtml(b) {
    var t = tenantById(b.tenantId);
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice ' + esc(b.id) + '</title><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;color:#1b2a3a}table{width:100%;border-collapse:collapse}td,th{padding:8px 0;border-bottom:1px solid #d9dfe4;text-align:left}td:last-child,th:last-child{text-align:right}</style></head><body>' +
      '<h1>Invoice</h1><p>' + esc(t ? t.name : '') + '<br>' + esc(b.month) + ' subscription, ' + planName(b.plan) + ' plan</p>' +
      '<table><tr><th>Item</th><th>Amount</th></tr><tr><td>' + b.users + ' billed users at ' + money(b.unit) + '</td><td>' + money(sub_(b)) + '</td></tr><tr><td>Tax</td><td>' + money(tax_(b)) + '</td></tr><tr><th>Payable</th><th>' + money(pay_(b)) + '</th></tr></table>' +
      '<p>Status: ' + b.status + '. Deadline: ' + fmtDate(b.deadline) + '.</p><p style="color:#556270">Sample invoice from the platform console demo.</p></body></html>';
  }
  function pageBilling(main) {
    var rank = { overdue: 0, pending: 1, paid: 2 };
    var rows = S.bills.slice().sort(function (a, b) { return rank[a.status] - rank[b.status] || tenantName(a.tenantId).localeCompare(tenantName(b.tenantId)); });
    function total(s) { return S.bills.filter(function (b) { return !s || b.status === s; }).reduce(function (n, b) { return n + pay_(b); }, 0); }
    main.innerHTML = pageHead('Billing', 'Monthly subscription bills for every tenant. Tenants pay online through Stripe or PayPal from their own bill notice.') +
      '<dl class="totals"><div><dt>Billable</dt><dd class="num">' + money(total()) + '</dd></div><div><dt>Collected</dt><dd class="num">' + money(total('paid')) + '</dd></div><div><dt>Not yet paid</dt><dd class="num">' + money(total('pending')) + '</dd></div><div class="totals__alert"><dt>Overdue</dt><dd class="num">' + money(total('overdue')) + '</dd></div></dl>' +
      '<div class="table-wrap"><table class="table table--compact"><thead><tr><th>Tenant</th><th>Month</th><th>Plan</th><th class="r">Billed users</th><th class="r">Unit price</th><th class="r">Subtotal</th><th class="r">Tax</th><th class="r">Payable</th><th>Deadline</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      rows.map(function (b, i) {
        var n = esc(tenantName(b.tenantId));
        return '<tr' + (b.status === 'overdue' ? ' id="overdue-' + b.id + '"' : '') + '><td><strong>' + n + '</strong></td><td class="nowrap">' + esc(shortMonth(b.month)) + '</td><td class="nowrap">' + planName(b.plan) + '</td><td class="r num">' + b.users + '</td><td class="r num">' + money(b.unit) + '</td><td class="r num">' + money(sub_(b)) + '</td><td class="r num">' + money(tax_(b)) + '</td><td class="r num"><strong>' + money(pay_(b)) + '</strong></td><td class="nowrap">' + new Date(b.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) + '</td><td>' + statusBadge(b.status) + '</td><td class="nowrap"><div class="actions">' +
          (b.status === 'paid' ? '<button type="button" class="icon-btn" data-invoice="' + b.id + '" aria-label="Download invoice for ' + n + ', ' + esc(b.month) + '">' + icon('download') + '</button>'
            : '<button type="button" class="icon-btn" data-notice="' + b.id + '" aria-label="Preview the bill notice ' + n + ' sees">' + icon('eye') + '</button>' + (can('billing') ? '<button type="button" class="btn btn--ghost btn--small" data-extend="' + b.id + '">Extend<span class="sr-only"> deadline for ' + n + '</span></button>' : '')) +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
    main.querySelectorAll('[data-invoice]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var b = S.bills.filter(function (x) { return x.id === btn.getAttribute('data-invoice'); })[0];
        download('invoice-' + tenantById(b.tenantId).subdomain + '-' + slug(b.month) + '.html', invoiceHtml(b), 'text/html'); toast('Invoice downloaded');
      });
    });
    main.querySelectorAll('[data-notice]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var b = S.bills.filter(function (x) { return x.id === btn.getAttribute('data-notice'); })[0];
        var api = dialog({ title: 'What the tenant sees', description: "The notice shown at the top of " + tenantName(b.tenantId) + "'s workspace.",
          body: '<div class="bill-notice"><p>Your bill for ' + esc(b.month) + ' is ready. Pay your bill before ' + fmtDate(b.deadline) + '.</p><button type="button" class="btn btn--secondary btn--small" data-pay>Pay now</button></div><p class="muted note">Amount due ' + money(pay_(b)) + '. The tenant picks Stripe or PayPal on the payment page.</p><div class="form-actions"><button type="button" class="btn btn--secondary" data-close2>Close</button></div>' });
        api.body.querySelector('[data-pay]').addEventListener('click', function () { toast('The tenant pays through Stripe or PayPal here'); });
        api.body.querySelector('[data-close2]').addEventListener('click', api.close);
      });
    });
    main.querySelectorAll('[data-extend]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var b = S.bills.filter(function (x) { return x.id === btn.getAttribute('data-extend'); })[0], days = 14;
        var api = dialog({ title: 'Extend the deadline', description: tenantName(b.tenantId) + ', ' + b.month + ' bill. Currently due ' + fmtDate(b.deadline) + '.',
          body: '<div class="field"><span class="label" id="ext-l">Extend by</span><div class="choice" role="radiogroup" aria-labelledby="ext-l">' + [7, 14, 30].map(function (d) {
            return '<label class="choice__opt' + (d === 14 ? ' is-on' : '') + '"><input type="radio" name="ext" value="' + d + '"' + (d === 14 ? ' checked' : '') + '> ' + d + ' days</label>';
          }).join('') + '</div></div><div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="button" class="btn btn--primary" data-ok>Extend deadline</button></div>' });
        api.body.querySelectorAll('input[name="ext"]').forEach(function (r) {
          r.addEventListener('change', function () {
            days = Number(r.value);
            api.body.querySelectorAll('.choice__opt').forEach(function (o) { o.classList.toggle('is-on', o.querySelector('input').checked); });
          });
        });
        api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
        api.body.querySelector('[data-ok]').addEventListener('click', function () {
          var base = Math.max(Date.now(), new Date(b.deadline).getTime());
          b.deadline = new Date(base + days * 864e5).toISOString(); b.status = 'pending';
          log('Extended the ' + b.month + ' bill for ' + tenantName(b.tenantId) + ' by ' + days + ' days'); save(); api.close(); App.refresh(); toast('Deadline extended by ' + days + ' days');
        });
      });
    });
    if (location.hash === '#overdue') {
      var first = main.querySelector('[id^="overdue-"]');
      if (first) { first.classList.add('highlight-row'); first.scrollIntoView({ block: 'center' }); }
    }
  }

  /* ---------- page: support ---------- */
  function pageSupport(main) {
    main.innerHTML = pageHead('Support access', 'Platform staff can sign in as a tenant user to troubleshoot, without ever seeing a password.',
      (can('support') ? '<button type="button" class="btn btn--primary" id="su-start">' + icon('headset') + ' Start support session</button>' : '')) +
      '<ul class="rules"><li>' + icon('shield') + ' A reason is required, and it is saved with the session.</li><li>' + icon('eye') + ' A banner stays on screen for the whole session.</li><li>' + icon('clock') + ' Start, end, and every action are recorded in the audit log.</li></ul>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Started</th><th>Staff</th><th>Tenant</th><th>Viewed as</th><th>Reason</th><th>Length</th><th>Status</th></tr></thead><tbody>' +
      S.sessions.map(function (s) {
        return '<tr><td class="nowrap">' + fmtDateTime(s.startedAt) + '</td><td>' + esc(s.staff) + '</td><td><strong>' + esc(tenantName(s.tenantId)) + '</strong></td><td>' + esc(s.asUser) + '</td><td class="reason">' + esc(s.reason) + '</td><td class="num nowrap">' + duration(s.startedAt, s.endedAt) + '</td><td>' + (s.endedAt ? statusBadge('ended') : statusBadge('live')) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    var ss = main.querySelector('#su-start'); if (ss) ss.addEventListener('click', function () { openSignIn(); });
  }

  /* ---------- transactions ---------- */
  var METHODS = { stripe: { name: 'Stripe', pct: 0.029, fix: 0.30 }, paypal: { name: 'PayPal', pct: 0.0349, fix: 0.49 }, bank: { name: 'Bank transfer', pct: 0, fix: 0 } };
  function feeFor(method, amount) { var m = METHODS[method]; return Math.round((amount * m.pct + m.fix) * 100) / 100; }
  function shortMonth(m) { var a = m.split(' '); return a[0].slice(0, 3) + ' ' + a[1]; }
  function billById(id) { return S.bills.filter(function (b) { return b.id === id; })[0]; }
  function txnById(id) { return S.transactions.filter(function (x) { return x.id === id; })[0]; }
  function receiptHtml(x) {
    var b = billById(x.billId);
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Receipt ' + esc(x.ref) + '</title><style>body{font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;color:#1b2a3a}table{width:100%;border-collapse:collapse}td{padding:8px 0;border-bottom:1px solid #d9dfe4}td:last-child{text-align:right}</style></head><body>' +
      '<h1>Payment receipt</h1><p>' + esc(tenantName(x.tenantId)) + (b ? '<br>' + esc(b.month) + ' subscription' : '') + '</p><table><tr><td>Reference</td><td>' + esc(x.ref) + '</td></tr><tr><td>Method</td><td>' + METHODS[x.method].name + '</td></tr><tr><td>Date</td><td>' + fmtDateTime(x.at) + '</td></tr><tr><td>Amount</td><td>' + money(x.amount) + '</td></tr><tr><td>Processing fee</td><td>' + money(x.fee) + '</td></tr><tr><td>Net</td><td>' + money(x.amount - x.fee) + '</td></tr><tr><td>Status</td><td>' + x.status + '</td></tr></table><p style="color:#556270">Sample receipt from the platform console demo.</p></body></html>';
  }
  function markPaid(x, status) {
    x.status = 'succeeded'; x.at = new Date().toISOString(); x.note = '';
    var b = billById(x.billId); if (b) b.status = 'paid';
  }
  function pageTransactions(main) {
    var f = main.__f || (main.__f = { q: '', status: location.hash === '#failed' ? 'failed' : 'all', method: 'all' });
    var ms = Date.now() - 30 * 864e5;
    function sum(list) { return list.reduce(function (n, x) { return n + x.amount; }, 0); }
    var collected = sum(S.transactions.filter(function (x) { return x.status === 'succeeded' && new Date(x.at).getTime() >= ms; }));
    var pending = sum(S.transactions.filter(function (x) { return x.status === 'pending'; }));
    var failedN = S.transactions.filter(function (x) { return x.status === 'failed'; }).length;
    var refunded = sum(S.transactions.filter(function (x) { return x.status === 'refunded'; }));
    main.innerHTML = pageHead('Transactions', 'Payments from tenants, through Stripe, PayPal, or bank transfer.',
      '<div class="btn-row"><button type="button" class="btn btn--secondary" id="tx-export">' + icon('download') + ' Export CSV</button>' + (can('transactions') ? '<button type="button" class="btn btn--primary" id="tx-record">' + icon('plus') + ' Record a payment</button>' : '') + '</div>') +
      '<dl class="totals"><div><dt>Collected, last 30 days</dt><dd class="num">' + money(collected) + '</dd></div><div><dt>Waiting to arrive</dt><dd class="num">' + money(pending) + '</dd></div><div class="' + (failedN ? 'totals__alert' : '') + '"><dt>Failed payments</dt><dd class="num">' + failedN + '</dd></div><div><dt>Refunded</dt><dd class="num">' + money(refunded) + '</dd></div></dl>' +
      '<div class="toolbar"><div class="search">' + icon('search', 16) + '<label for="x-q" class="sr-only">Search transactions</label><input id="x-q" class="input" placeholder="Search by tenant or reference" autocomplete="off"></div>' +
      '<div><label for="x-status" class="sr-only">Filter by status</label><select id="x-status" class="select"><option value="all">All statuses</option><option value="succeeded">Succeeded</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select></div>' +
      '<div><label for="x-method" class="sr-only">Filter by method</label><select id="x-method" class="select"><option value="all">All methods</option><option value="stripe">Stripe</option><option value="paypal">PayPal</option><option value="bank">Bank transfer</option></select></div></div>' +
      '<div class="table-wrap"><table class="table table--tight"><thead><tr><th>Date</th><th>Tenant</th><th>Bill</th><th>Method</th><th>Reference</th><th class="r">Amount</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody id="x-body"></tbody></table></div>';
    var qi = main.querySelector('#x-q'), st = main.querySelector('#x-status'), me = main.querySelector('#x-method');
    qi.value = f.q; st.value = f.status; me.value = f.method;
    function list() {
      var t = qi.value.trim().toLowerCase();
      return S.transactions.filter(function (x) {
        return (st.value === 'all' || x.status === st.value) && (me.value === 'all' || x.method === me.value) && (tenantName(x.tenantId) + ' ' + x.ref).toLowerCase().indexOf(t) >= 0;
      }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    }
    function rows() {
      var l = list();
      main.querySelector('#x-body').innerHTML = l.length ? l.map(function (x) {
        var b = billById(x.billId), n = esc(tenantName(x.tenantId));
        var act = '';
        if (x.status === 'succeeded' || x.status === 'refunded') act += '<button type="button" class="icon-btn" data-receipt="' + x.id + '" aria-label="View receipt for ' + n + ', ' + esc(x.ref) + '">' + icon('eye') + '</button>';
        if (x.status === 'succeeded' && can('transactions')) act += '<button type="button" class="btn btn--ghost btn--small" data-refund="' + x.id + '">Refund<span class="sr-only"> ' + esc(x.ref) + '</span></button>';
        if (x.status === 'failed' && can('transactions')) act += '<button type="button" class="btn btn--ghost btn--small" data-retry-pay="' + x.id + '">Retry<span class="sr-only"> payment for ' + n + '</span></button>';
        if (x.status === 'pending' && can('transactions')) act += '<button type="button" class="btn btn--ghost btn--small" data-received="' + x.id + '">Mark received<span class="sr-only"> for ' + n + '</span></button>';
        return '<tr><td class="nowrap">' + fmtDateTime(x.at) + '</td><td><strong>' + n + '</strong></td><td class="nowrap">' + (b ? esc(shortMonth(b.month)) : '') + '</td><td><span class="chip">' + METHODS[x.method].name + '</span></td><td class="mono nowrap">' + esc(x.ref) + '</td>' +
          '<td class="r num nowrap"><strong>' + money(x.amount) + '</strong><span class="cell-sub">Fee ' + money(x.fee) + '</span></td><td>' + statusBadge(x.status) + (x.note ? '<span class="cell-sub">' + esc(x.note) + '</span>' : '') + '</td><td class="nowrap"><div class="actions">' + act + '</div></td></tr>';
      }).join('') : '<tr><td colspan="8" class="empty">No transactions match. Clear the search or choose another status.</td></tr>';
      main.querySelectorAll('[data-receipt]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var x = txnById(btn.getAttribute('data-receipt')), b = billById(x.billId);
          var api = dialog({ title: 'Receipt', description: tenantName(x.tenantId) + (b ? ', ' + b.month : ''),
            body: '<dl class="facts"><div><dt>Reference</dt><dd class="mono">' + esc(x.ref) + '</dd></div><div><dt>Method</dt><dd>' + METHODS[x.method].name + '</dd></div><div><dt>Date</dt><dd>' + fmtDateTime(x.at) + '</dd></div><div><dt>Amount</dt><dd>' + money(x.amount) + '</dd></div><div><dt>Processing fee</dt><dd>' + money(x.fee) + '</dd></div><div><dt>Net to you</dt><dd><strong>' + money(x.amount - x.fee) + '</strong></dd></div><div><dt>Status</dt><dd>' + statusBadge(x.status) + '</dd></div></dl>' +
              '<div class="form-actions"><button type="button" class="btn btn--secondary" data-close2>Close</button><button type="button" class="btn btn--primary" data-dl>' + icon('download', 16) + ' Download receipt</button></div>' });
          api.body.querySelector('[data-close2]').addEventListener('click', api.close);
          api.body.querySelector('[data-dl]').addEventListener('click', function () { download('receipt-' + x.ref + '.html', receiptHtml(x), 'text/html'); toast('Receipt downloaded'); });
        });
      });
      main.querySelectorAll('[data-refund]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var x = txnById(btn.getAttribute('data-refund'));
          confirmDialog({ title: 'Refund ' + money(x.amount) + ' to ' + tenantName(x.tenantId) + '?', description: 'The money goes back to the tenant, and the bill returns to Pending so they can pay it again.', confirmLabel: 'Refund payment', danger: true,
            onConfirm: function () { x.status = 'refunded'; var b = billById(x.billId); if (b) b.status = 'pending'; log('Refunded ' + money(x.amount) + ' to ' + tenantName(x.tenantId)); save(); App.refresh(); toast('Refunded ' + money(x.amount)); } });
        });
      });
      main.querySelectorAll('[data-retry-pay]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var x = txnById(btn.getAttribute('data-retry-pay')); markPaid(x); x.ref = 'ch_' + Date.now().toString(36);
          log('Retried the failed payment for ' + tenantName(x.tenantId) + ' and it succeeded'); save(); App.refresh(); toast('Payment succeeded');
        });
      });
      main.querySelectorAll('[data-received]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var x = txnById(btn.getAttribute('data-received')); markPaid(x);
          log('Marked the bank transfer from ' + tenantName(x.tenantId) + ' as received'); save(); App.refresh(); toast('Marked as received');
        });
      });
    }
    qi.addEventListener('input', function () { f.q = qi.value; rows(); });
    st.addEventListener('change', function () { f.status = st.value; rows(); });
    me.addEventListener('change', function () { f.method = me.value; rows(); });
    var rc = main.querySelector('#tx-record'); if (rc) rc.addEventListener('click', openRecordPayment);
    main.querySelector('#tx-export').addEventListener('click', function () {
      var l = list();
      var csv = 'Date,Tenant,Bill,Method,Reference,Amount,Fee,Net,Status\n' + l.map(function (x) {
        var b = billById(x.billId);
        return [new Date(x.at).toISOString(), '"' + tenantName(x.tenantId).replace(/"/g, '""') + '"', b ? b.month : '', METHODS[x.method].name, x.ref, x.amount.toFixed(2), x.fee.toFixed(2), (x.amount - x.fee).toFixed(2), x.status].join(',');
      }).join('\n');
      download('transactions.csv', csv, 'text/csv'); toast('Exported ' + l.length + ' transactions');
    });
    rows();
  }
  function openRecordPayment() {
    var open = S.bills.filter(function (b) { return b.status !== 'paid'; });
    if (!open.length) { toast('Every bill is paid'); return; }
    var api = dialog({
      title: 'Record a payment', description: 'Use this for a bank transfer or a payment made outside the payment page.',
      body: '<form id="rp-form" novalidate>' +
        field('rp-bill', 'Bill', '<select id="rp-bill" class="select">' + open.map(function (b) { return '<option value="' + b.id + '">' + esc(tenantName(b.tenantId)) + ', ' + esc(b.month) + ', ' + money(pay_(b)) + '</option>'; }).join('') + '</select>') +
        field('rp-method', 'Method', '<select id="rp-method" class="select"><option value="bank">Bank transfer</option><option value="stripe">Stripe</option><option value="paypal">PayPal</option></select>') +
        field('rp-ref', 'Reference', '<input id="rp-ref" class="input mono" autocomplete="off" placeholder="Bank reference or payment id">', 'Printed on the receipt.') +
        '<p class="muted note" id="rp-sum" style="margin-top:0"></p>' +
        '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Record payment</button></div></form>'
    });
    var b = api.body, bill = b.querySelector('#rp-bill'), meth = b.querySelector('#rp-method');
    function sum() {
      var bl = billById(bill.value), a = pay_(bl);
      b.querySelector('#rp-sum').textContent = 'Amount ' + money(a) + ', fee ' + money(feeFor(meth.value, a)) + ', net ' + money(a - feeFor(meth.value, a)) + '. The bill becomes Paid.';
    }
    bill.addEventListener('change', sum); meth.addEventListener('change', sum); sum();
    b.querySelector('[data-cancel]').addEventListener('click', api.close);
    b.querySelector('#rp-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var ref = b.querySelector('#rp-ref').value.trim();
      if (ref.length < 4) { setError('rp-ref', 'Enter the reference, at least 4 characters.'); b.querySelector('#rp-ref').focus(); return; }
      var bl = billById(bill.value), a = pay_(bl);
      var existing = S.transactions.filter(function (x) { return x.billId === bl.id && x.status === 'pending'; })[0];
      if (existing) { existing.method = meth.value; existing.ref = ref; existing.fee = feeFor(meth.value, a); markPaid(existing); }
      else { S.transactions.unshift({ id: nextId('x'), tenantId: bl.tenantId, billId: bl.id, method: meth.value, ref: ref, amount: a, fee: feeFor(meth.value, a), status: 'succeeded', at: new Date().toISOString(), note: '' }); bl.status = 'paid'; }
      log('Recorded a ' + METHODS[meth.value].name + ' payment of ' + money(a) + ' from ' + tenantName(bl.tenantId));
      save(); api.close(); App.refresh(); toast('Payment recorded');
    });
  }

  /* ---------- SMS ---------- */
  function smsFor(id) { if (!S.sms.tenants[id]) S.sms.tenants[id] = { credits: 100, used: 0 }; return S.sms.tenants[id]; }
  function segments(text) { return Math.max(1, Math.ceil(text.length / 160)); }
  function pageSms(main) {
    var tenants = S.tenants.filter(function (t) { return t.status !== 'offboarding'; });
    main.innerHTML = pageHead('SMS', 'Credits for tenants, messages to their admins, and what was sent.',
      (can('sms') ? '<div class="btn-row"><button type="button" class="btn btn--secondary" id="sm-buy">Buy credits</button><button type="button" class="btn btn--primary" id="sm-send">' + icon('plus') + ' Send a message</button></div>' : '')) +
      '<dl class="totals"><div><dt>Platform balance</dt><dd class="num">' + S.sms.balance.toLocaleString('en-US') + ' credits</dd></div><div><dt>Used this month</dt><dd class="num">' + tenants.reduce(function (n, t) { return n + smsFor(t.id).used; }, 0).toLocaleString('en-US') + '</dd></div><div><dt>Tenants with low credits</dt><dd class="num">' + tenants.filter(function (t) { return smsFor(t.id).credits < 500; }).length + '</dd></div><div><dt>Sending gateway</dt><dd>' + statusBadge('ok').replace('Up to date', 'Connected') + '</dd></div></dl>' +
      '<section class="panel" aria-labelledby="h-sc" style="margin-bottom:20px"><div class="panel__head"><h2 id="h-sc">Credits by tenant</h2><span class="muted">One credit sends one 160-character message</span></div><div class="table-wrap" style="border:0;border-radius:0"><table class="table"><thead><tr><th>Tenant</th><th>Plan</th><th class="r">Credits left</th><th class="r">Used this month</th><th>Level</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      tenants.map(function (t) {
        var c = smsFor(t.id), low = c.credits < 500;
        return '<tr><td><strong>' + esc(t.name) + '</strong></td><td>' + planName(t.plan) + '</td><td class="r num">' + c.credits.toLocaleString('en-US') + '</td><td class="r num">' + c.used.toLocaleString('en-US') + '</td><td>' + (c.credits === 0 ? '<span class="badge badge--failed">Empty</span>' : low ? '<span class="badge badge--suspended">Low</span>' : '<span class="badge badge--active">Enough</span>') +
          '</td><td><div class="actions">' + (can('sms') ? '<button type="button" class="btn btn--ghost btn--small" data-addcr="' + t.id + '">Add credits<span class="sr-only"> for ' + esc(t.name) + '</span></button>' : '') + '</div></td></tr>';
      }).join('') + '</tbody></table></div></section>' +
      '<section class="panel" aria-labelledby="h-sm"><div class="panel__head"><h2 id="h-sm">Messages sent</h2><span class="muted">' + S.sms.messages.length + ' messages</span></div><div class="table-wrap" style="border:0;border-radius:0"><table class="table"><thead><tr><th>Sent</th><th>To</th><th>Message</th><th class="r">Recipients</th><th class="r">Credits</th><th>Status</th></tr></thead><tbody>' +
      S.sms.messages.map(function (m) {
        return '<tr><td class="nowrap">' + fmtDateTime(m.at) + '</td><td>' + esc(m.audience) + '</td><td class="reason">' + esc(m.text) + '</td><td class="r num">' + m.recipients + '</td><td class="r num">' + m.credits + '</td><td>' + statusBadge(m.status) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
    var sd = main.querySelector('#sm-send'), sb = main.querySelector('#sm-buy');
    if (sd) sd.addEventListener('click', openSendSms);
    if (sb) sb.addEventListener('click', openBuyCredits);
    main.querySelectorAll('[data-addcr]').forEach(function (b) { b.addEventListener('click', function () { openAddCredits(b.getAttribute('data-addcr')); }); });
  }
  function openBuyCredits() {
    var packs = [[10000, 90], [50000, 400], [100000, 750]], pick = 1;
    var api = dialog({ title: 'Buy SMS credits', description: 'Credits are added to the platform balance straight away.',
      body: '<div class="field"><span class="label" id="bp-l">Pack</span><div class="choice" role="radiogroup" aria-labelledby="bp-l">' + packs.map(function (p, i) {
        return '<label class="choice__opt' + (i === pick ? ' is-on' : '') + '"><input type="radio" name="bp" value="' + i + '"' + (i === pick ? ' checked' : '') + '> ' + p[0].toLocaleString('en-US') + ' credits, ' + money(p[1]) + '</label>';
      }).join('') + '</div></div><div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="button" class="btn btn--primary" data-ok>Buy credits</button></div>' });
    api.body.querySelectorAll('input[name="bp"]').forEach(function (r) {
      r.addEventListener('change', function () { pick = Number(r.value); api.body.querySelectorAll('.choice__opt').forEach(function (o) { o.classList.toggle('is-on', o.querySelector('input').checked); }); });
    });
    api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
    api.body.querySelector('[data-ok]').addEventListener('click', function () {
      S.sms.balance += packs[pick][0]; log('Bought ' + packs[pick][0].toLocaleString('en-US') + ' SMS credits for ' + money(packs[pick][1])); save(); api.close(); App.refresh(); toast(packs[pick][0].toLocaleString('en-US') + ' credits added');
    });
  }
  function openAddCredits(id) {
    var t = tenantById(id);
    var api = dialog({ title: 'Add credits for ' + t.name, description: 'Credits move from the platform balance of ' + S.sms.balance.toLocaleString('en-US') + ' to this tenant.',
      body: '<form id="ac-form" novalidate>' + field('ac-n', 'Credits to add', '<input id="ac-n" type="number" min="1" class="input" value="500">') +
        '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Add credits</button></div></form>' });
    api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
    api.body.querySelector('#ac-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var n = Math.floor(Number(api.body.querySelector('#ac-n').value));
      if (!(n >= 1)) { setError('ac-n', 'Enter a number of 1 or more.'); return; }
      if (n > S.sms.balance) { setError('ac-n', 'The platform balance is only ' + S.sms.balance.toLocaleString('en-US') + ' credits. Buy more first.'); return; }
      S.sms.balance -= n; smsFor(id).credits += n; log('Added ' + n.toLocaleString('en-US') + ' SMS credits to ' + t.name); save(); api.close(); App.refresh(); toast(n.toLocaleString('en-US') + ' credits added to ' + t.name);
    });
  }
  function openSendSms() {
    var tenants = S.tenants.filter(function (t) { return t.status !== 'offboarding'; });
    var api = dialog({ title: 'Send a message', description: 'The message goes to the admin of each tenant you choose.', variant: 'drawer',
      body: '<form id="sd-form" novalidate>' +
        field('sd-aud', 'Send to', '<select id="sd-aud" class="select"><option value="all">All tenant admins</option>' + PLAN_IDS.map(function (p) { return '<option value="plan:' + p + '">Tenants on ' + PLANS[p].name + '</option>'; }).join('') + '<option value="pick">Choose tenants</option></select>') +
        '<div id="sd-pick" class="field" hidden><span class="label">Tenants</span>' + tenants.map(function (t) { return '<label style="display:flex;gap:8px;align-items:center;padding:3px 0"><input type="checkbox" data-pick="' + t.id + '"> ' + esc(t.name) + '</label>'; }).join('') + '</div>' +
        field('sd-text', 'Message', '<textarea id="sd-text" class="textarea" maxlength="480"></textarea>') +
        '<p class="muted note" id="sd-sum" style="margin:0 0 4px"></p>' +
        '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Send now</button></div></form>' });
    var b = api.body, aud = b.querySelector('#sd-aud'), text = b.querySelector('#sd-text'), pick = b.querySelector('#sd-pick');
    function recipients() {
      var v = aud.value;
      if (v === 'all') return tenants;
      if (v === 'pick') return tenants.filter(function (t) { return b.querySelector('[data-pick="' + t.id + '"]').checked; });
      return tenants.filter(function (t) { return t.plan === v.split(':')[1]; });
    }
    function label() { var v = aud.value; return v === 'all' ? 'All tenant admins' : v === 'pick' ? 'Chosen tenants' : 'Tenants on ' + PLANS[v.split(':')[1]].name; }
    function sum() {
      var r = recipients().length, seg = segments(text.value), credits = r * seg;
      b.querySelector('#sd-sum').textContent = text.value.length + ' of 160 characters per credit (' + seg + (seg === 1 ? ' credit' : ' credits') + ' each). ' + r + (r === 1 ? ' recipient' : ' recipients') + ', ' + credits + ' credits of ' + S.sms.balance.toLocaleString('en-US') + ' available.';
    }
    aud.addEventListener('change', function () { pick.hidden = aud.value !== 'pick'; sum(); });
    text.addEventListener('input', function () { setError('sd-text', ''); sum(); });
    b.querySelectorAll('[data-pick]').forEach(function (c) { c.addEventListener('change', sum); });
    b.querySelector('[data-cancel]').addEventListener('click', api.close);
    sum();
    b.querySelector('#sd-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var r = recipients(), msg = text.value.trim(), credits = r.length * segments(msg);
      if (!msg) { setError('sd-text', 'Write the message first.'); text.focus(); return; }
      if (!r.length) { setError('sd-text', 'Choose at least one tenant to send to.'); return; }
      if (credits > S.sms.balance) { setError('sd-text', 'Not enough credits. This needs ' + credits + ' and the platform has ' + S.sms.balance + '. Buy more first.'); return; }
      S.sms.balance -= credits;
      S.sms.messages.unshift({ id: nextId('m'), at: new Date().toISOString(), audience: label() + (r.length > 1 || aud.value === 'pick' ? ' (' + r.length + ')' : ''), text: msg, recipients: r.length, credits: credits, status: 'delivered' });
      log('Sent an SMS to ' + r.length + (r.length === 1 ? ' tenant admin' : ' tenant admins'));
      save(); api.close(); App.refresh(); toast('Sent to ' + r.length + (r.length === 1 ? ' tenant admin' : ' tenant admins'));
    });
  }

  /* ---------- access control ---------- */
  var ROLES = { admin: 'Super admin', support: 'Support lead', billing: 'Billing manager', auditor: 'Auditor' };
  var ROLE_IDS = ['admin', 'support', 'billing', 'auditor'];
  var AREAS = [['tenants', 'Tenants'], ['plans', 'Plans and modules'], ['billing', 'Billing'], ['transactions', 'Transactions'], ['sms', 'SMS'], ['support', 'Support access'], ['access', 'Access control']];
  var LEVELS = [['none', 'No access'], ['view', 'View only'], ['manage', 'Can change']];
  function pageAccess(main) {
    var draft = main.__draft || (main.__draft = JSON.parse(JSON.stringify(S.perms)));
    function dirty() { return JSON.stringify(draft) !== JSON.stringify(S.perms); }
    var activeAdmins = S.staff.filter(function (u) { return u.role === 'admin' && u.status === 'active'; }).length;
    main.innerHTML = pageHead('Access control', 'Who can use the platform console, and what each role can do.', '<button type="button" class="btn btn--primary" id="ac-invite">' + icon('plus') + ' Invite staff member</button>') +
      '<section class="panel" aria-labelledby="h-st" style="margin-bottom:20px"><div class="panel__head"><h2 id="h-st">Staff</h2><span class="muted">' + S.staff.length + ' people</span></div><div class="table-wrap" style="border:0;border-radius:0"><table class="table"><thead><tr><th>Name</th><th>Role</th><th>Sign-in security</th><th>Last active</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      S.staff.map(function (u) {
        var self = u.self;
        return '<tr><td><strong>' + esc(u.name) + (self ? ' <span class="muted">(you)</span>' : '') + '</strong><span class="cell-sub">' + esc(u.email) + '</span></td>' +
          '<td><label class="sr-only" for="role-' + u.id + '">Role for ' + esc(u.name) + '</label><select id="role-' + u.id + '" class="select" data-role="' + u.id + '"' + (self || u.status === 'deactivated' ? ' disabled' : '') + '>' + ROLE_IDS.map(function (r) { return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + ROLES[r] + '</option>'; }).join('') + '</select></td>' +
          '<td>' + (u.mfa ? '<span class="badge badge--active">MFA on</span>' : '<span class="badge badge--suspended">MFA not set</span>') + '</td><td class="nowrap">' + (u.lastActive ? ago(u.lastActive) : 'Not yet') + '</td>' +
          '<td>' + (u.status === 'active' ? statusBadge('active') : u.status === 'invited' ? '<span class="badge badge--trial">Invited</span>' : '<span class="badge badge--offboarding">Deactivated</span>') + '</td>' +
          '<td><div class="actions">' + (u.status === 'invited' ? '<button type="button" class="btn btn--ghost btn--small" data-resend="' + u.id + '">Resend invite<span class="sr-only"> to ' + esc(u.name) + '</span></button>' : '') +
          (self ? '' : (u.status === 'deactivated' ? '<button type="button" class="btn btn--ghost btn--small" data-react="' + u.id + '">Reactivate<span class="sr-only"> ' + esc(u.name) + '</span></button>' : '<button type="button" class="btn btn--ghost btn--small" data-deact="' + u.id + '">Deactivate<span class="sr-only"> ' + esc(u.name) + '</span></button>')) + '</div></td></tr>';
      }).join('') + '</tbody></table></div></section>' +
      '<section class="panel" aria-labelledby="h-pm" style="margin-bottom:20px"><div class="panel__head"><h2 id="h-pm">What each role can do</h2><div class="btn-row"><button type="button" class="btn btn--secondary btn--small" id="pm-discard" disabled>Discard</button><button type="button" class="btn btn--primary btn--small" id="pm-save" disabled>Save changes</button></div></div><div class="table-wrap" style="border:0;border-radius:0"><table class="table matrix"><thead><tr><th scope="col">Area</th>' +
      ROLE_IDS.map(function (r) { return '<th scope="col" class="matrix__plan"><span class="matrix__name">' + ROLES[r] + '</span><span class="cell-sub">' + (function (n) { return n + (n === 1 ? ' person' : ' people'); })(S.staff.filter(function (u) { return u.role === r; }).length) + '</span></th>'; }).join('') + '</tr></thead><tbody>' +
      AREAS.map(function (a) {
        return '<tr><th scope="row">' + a[1] + '</th>' + ROLE_IDS.map(function (r) {
          return '<td class="matrix__cell"><label class="sr-only" for="pm-' + a[0] + '-' + r + '">' + a[1] + ' for ' + ROLES[r] + '</label><select id="pm-' + a[0] + '-' + r + '" class="select" data-area="' + a[0] + '" data-role-col="' + r + '"' + (r === 'admin' ? ' disabled' : '') + '>' +
            LEVELS.map(function (l) { return '<option value="' + l[0] + '"' + (draft[a[0]][r] === l[0] ? ' selected' : '') + '>' + l[1] + '</option>'; }).join('') + '</select></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></section>' +
      '<section class="panel" aria-labelledby="h-sec"><div class="panel__head"><h2 id="h-sec">Sign-in security</h2></div><div class="panel__body" style="display:grid;gap:14px">' +
      '<div style="display:flex;justify-content:space-between;gap:16px;align-items:center"><div><strong>Require MFA for all staff</strong><div class="muted">Staff without MFA must set it up at their next sign-in.</div></div><span class="switch"><input type="checkbox" id="sec-mfa" aria-label="Require MFA for all staff"' + (S.security.mfa ? ' checked' : '') + '><span></span></span></div>' +
      '<div style="display:flex;justify-content:space-between;gap:16px;align-items:center"><div><strong>Support sessions need a reason</strong><div class="muted">Always on. The reason is saved with the session.</div></div><span class="switch"><input type="checkbox" checked disabled aria-label="Support sessions need a reason"><span></span></span></div>' +
      '<div style="display:flex;justify-content:space-between;gap:16px;align-items:center"><div><strong>Sign staff out after inactivity</strong><div class="muted">Applies to every staff member.</div></div><div><label class="sr-only" for="sec-idle">Sign out after</label><select id="sec-idle" class="select">' + [15, 30, 60].map(function (m) { return '<option value="' + m + '"' + (S.security.idle === m ? ' selected' : '') + '>' + m + ' minutes</option>'; }).join('') + '</select></div></div></div></section>';
    if (!can('access')) {
      ['#ac-invite', '[data-resend]', '[data-deact]', '[data-react]', '#pm-save', '#pm-discard'].forEach(function (q) { main.querySelectorAll(q).forEach(function (n) { n.remove(); }); });
      main.querySelectorAll('select, input').forEach(function (n) { n.disabled = true; });
      return;
    }
    main.querySelector('#ac-invite').addEventListener('click', openInvite);
    main.querySelectorAll('[data-role]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var u = S.staff.filter(function (x) { return x.id === sel.getAttribute('data-role'); })[0];
        if (u.role === 'admin' && sel.value !== 'admin' && activeAdmins < 2) { sel.value = u.role; toast('Keep at least one active Super admin'); return; }
        u.role = sel.value; log('Changed the role of ' + u.name + ' to ' + ROLES[u.role]); save(); App.refresh(); toast(u.name + ' is now ' + ROLES[u.role]);
      });
    });
    main.querySelectorAll('[data-deact]').forEach(function (b) {
      b.addEventListener('click', function () {
        var u = S.staff.filter(function (x) { return x.id === b.getAttribute('data-deact'); })[0];
        if (u.role === 'admin' && u.status === 'active' && activeAdmins < 2) { toast('Keep at least one active Super admin'); return; }
        confirmDialog({ title: 'Deactivate ' + u.name + '?', description: 'They can no longer sign in. You can reactivate them later.', confirmLabel: 'Deactivate', danger: true, onConfirm: function () { u.status = 'deactivated'; log('Deactivated ' + u.name); save(); App.refresh(); toast(u.name + ' was deactivated'); } });
      });
    });
    main.querySelectorAll('[data-react]').forEach(function (b) { b.addEventListener('click', function () { var u = S.staff.filter(function (x) { return x.id === b.getAttribute('data-react'); })[0]; u.status = 'active'; log('Reactivated ' + u.name); save(); App.refresh(); toast(u.name + ' is active again'); }); });
    main.querySelectorAll('[data-resend]').forEach(function (b) { b.addEventListener('click', function () { var u = S.staff.filter(function (x) { return x.id === b.getAttribute('data-resend'); })[0]; log('Sent the invitation to ' + u.name + ' again'); save(); toast('Invitation sent again to ' + u.email); }); });
    var sv = main.querySelector('#pm-save'), dc = main.querySelector('#pm-discard');
    function sync() { var d = dirty(); sv.disabled = !d; dc.disabled = !d; }
    main.querySelectorAll('[data-area]').forEach(function (s) { s.addEventListener('change', function () { draft[s.getAttribute('data-area')][s.getAttribute('data-role-col')] = s.value; sync(); }); });
    sv.addEventListener('click', function () { S.perms = JSON.parse(JSON.stringify(draft)); log('Updated what each staff role can do'); save(); sync(); toast('Role changes saved'); });
    dc.addEventListener('click', function () { main.__draft = null; App.refresh(); toast('Changes discarded'); });
    main.querySelector('#sec-mfa').addEventListener('change', function (e) { S.security.mfa = e.target.checked; log((S.security.mfa ? 'Turned on' : 'Turned off') + ' required MFA for staff'); save(); toast(S.security.mfa ? 'MFA is now required' : 'MFA is no longer required'); });
    main.querySelector('#sec-idle').addEventListener('change', function (e) { S.security.idle = Number(e.target.value); log('Set the inactivity sign-out to ' + S.security.idle + ' minutes'); save(); toast('Staff are signed out after ' + S.security.idle + ' minutes'); });
    sync();
  }
  function openInvite() {
    var api = dialog({ title: 'Invite a staff member', description: 'They get an email with a link to set up their sign-in.',
      body: '<form id="iv-form" novalidate>' + field('iv-name', 'Full name', '<input id="iv-name" class="input" autocomplete="off">') + field('iv-email', 'Work email', '<input id="iv-email" type="email" class="input" autocomplete="off">') +
        field('iv-role', 'Role', '<select id="iv-role" class="select">' + ROLE_IDS.map(function (r) { return '<option value="' + r + '"' + (r === 'support' ? ' selected' : '') + '>' + ROLES[r] + '</option>'; }).join('') + '</select>') +
        '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Send invitation</button></div></form>' });
    var b = api.body; b.querySelector('#iv-name').focus();
    b.querySelector('[data-cancel]').addEventListener('click', api.close);
    b.querySelector('#iv-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = b.querySelector('#iv-name').value.trim(), email = b.querySelector('#iv-email').value.trim(), bad = false;
      setError('iv-name', name ? '' : 'Enter their name.'); if (!name) bad = true;
      var em = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'Enter a valid email address.' : (S.staff.some(function (u) { return u.email.toLowerCase() === email.toLowerCase(); }) ? 'This person already has access.' : '');
      setError('iv-email', em); if (em) bad = true;
      if (bad) { b.querySelector('[aria-invalid="true"]').focus(); return; }
      var role = b.querySelector('#iv-role').value;
      S.staff.push({ id: nextId('u'), name: name, email: email, role: role, mfa: false, lastActive: null, status: 'invited' });
      log('Invited ' + name + ' as ' + ROLES[role]); save(); api.close(); App.refresh(); toast('Invitation sent to ' + email);
    });
  }

  /* ---------- page: sign in ---------- */
  function pageLogin() {
    var root = document.getElementById('login'), params = new URLSearchParams(location.search);
    var next = params.get('next') || '', note = params.get('msg') || '';
    var step = 'password', pending = null, email = '', info = note;
    function safeNext(u) {
      var m = /^([a-z]+\.html)(#.*)?$/.exec(next); if (!m) return null;
      var key = { 'index.html': 'overview', 'tenants.html': 'tenants', 'plans.html': 'plans', 'billing.html': 'billing', 'transactions.html': 'transactions', 'sms.html': 'sms', 'support.html': 'support', 'access.html': 'access' }[m[1]];
      if (!key) return null;
      var area = AREA_OF[key]; if (area && S.perms && !(u.role === 'admin' || (S.perms[area] && S.perms[area][u.role] !== 'none'))) return null;
      return next;
    }
    function finish(u) {
      u.lastActive = new Date().toISOString(); save();
      setSession({ userId: u.id, at: Date.now() });
      location.href = safeNext(u) || LANDING[u.role];
    }
    function accessSummary(role) {
      var m = [], v = [], n = [];
      AREAS.forEach(function (a) { var l = role === 'admin' ? 'manage' : S.perms[a[0]][role]; (l === 'manage' ? m : l === 'view' ? v : n).push(a[1]); });
      return (m.length ? '<div><strong>Can change:</strong> ' + m.join(', ') + '</div>' : '') + (v.length ? '<div><strong>Can only view:</strong> ' + v.join(', ') + '</div>' : '') + (n.length ? '<div class="muted">No access: ' + n.join(', ') + '</div>' : '');
    }
    function render() {
      var demo = ROLE_IDS.map(function (r) {
        var u = S.staff.filter(function (x) { return x.role === r && x.status === 'active'; })[0]; if (!u) return '';
        return '<div class="demo-card"><div><strong>' + ROLES[r] + '</strong><div class="muted">' + esc(u.name) + ', ' + esc(u.email) + '</div></div><div class="demo-card__access">' + accessSummary(r) + '</div>' +
          '<button type="button" class="btn btn--secondary btn--small" data-use="' + esc(u.email) + '">Use this account<span class="sr-only"> (' + ROLES[r] + ')</span></button></div>';
      }).join('');
      var form;
      if (step === 'password') {
        form = '<h2 class="login__title">Sign in</h2><p class="muted" style="margin-bottom:18px">Platform staff only.</p>' + (info ? '<p class="login__note" role="status">' + esc(info) + '</p>' : '') +
          '<form id="lg-form" novalidate>' + field('lg-email', 'Work email', '<input id="lg-email" type="email" class="input" autocomplete="username" value="' + esc(email) + '">') +
          field('lg-pass', 'Password', '<input id="lg-pass" type="password" class="input" autocomplete="current-password">') +
          '<div class="login__links"><a href="#" id="lg-forgot">Forgot password?</a></div><button type="submit" class="btn btn--primary" style="width:100%;justify-content:center">Sign in</button></form>';
      } else {
        form = '<h2 class="login__title">Enter your code</h2><p class="muted" style="margin-bottom:18px">Open your authenticator app and enter the 6-digit code for ' + esc(pending.email) + '.</p>' +
          '<form id="mf-form" novalidate>' + field('mf-code', 'Authentication code', '<input id="mf-code" class="input mono" inputmode="numeric" maxlength="6" autocomplete="one-time-code">', 'Demo code: ' + DEMO_CODE) +
          '<div class="form-actions" style="margin-top:8px"><button type="button" class="btn btn--secondary" id="mf-back">Back</button><button type="submit" class="btn btn--primary">Verify and sign in</button></div></form>';
      }
      root.innerHTML = '<div class="login"><div class="login__brand"><div class="sidebar__brand"><span class="sidebar__mark" aria-hidden="true">P</span><div><strong>Platform console</strong><small>Staff only</small></div></div>' +
        '<div><h1>Run the platform.</h1><p>Create tenants, manage plans, billing, and payments, send SMS, and support clients. What you see depends on your role.</p></div><p class="login__fine">Demo with sample data.</p></div>' +
        '<div class="login__main"><section class="login__card" aria-live="polite">' + form + '</section>' +
        '<section class="login__demo" aria-labelledby="dm-h"><h2 id="dm-h">Demo accounts</h2><p class="muted" style="margin:2px 0 12px">Every demo account uses the password <span class="mono">' + DEMO_PASSWORD + '</span> and the code <span class="mono">' + DEMO_CODE + '</span>. Each role sees different menus and data.</p><div class="demo-grid">' + demo + '</div></section></div></div>';
      root.querySelectorAll('[data-use]').forEach(function (b) {
        b.addEventListener('click', function () {
          step = 'password'; email = b.getAttribute('data-use'); render();
          root.querySelector('#lg-pass').value = DEMO_PASSWORD; root.querySelector('#lg-pass').focus();
        });
      });
      var fg = root.querySelector('#lg-forgot');
      if (fg) fg.addEventListener('click', function (e) {
        e.preventDefault();
        var api = dialog({ title: 'Reset your password', description: 'Enter your work email. If it matches a staff account, we send a link to set a new password.',
          body: '<form id="fp-form" novalidate>' + field('fp-email', 'Work email', '<input id="fp-email" type="email" class="input" autocomplete="off">') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Send reset link</button></div></form>' });
        api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
        api.body.querySelector('#fp-form').addEventListener('submit', function (ev) {
          ev.preventDefault();
          var v = api.body.querySelector('#fp-email').value.trim();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { setError('fp-email', 'Enter a valid email address.'); return; }
          api.close(); toast('If that email has an account, a reset link is on its way');
        });
      });
      var lf = root.querySelector('#lg-form');
      if (lf) lf.addEventListener('submit', function (e) {
        e.preventDefault();
        email = root.querySelector('#lg-email').value.trim(); var pass = root.querySelector('#lg-pass').value;
        setError('lg-email', email ? '' : 'Enter your work email.'); setError('lg-pass', pass ? '' : 'Enter your password.');
        if (!email || !pass) return;
        var u = S.staff.filter(function (x) { return x.email.toLowerCase() === email.toLowerCase(); })[0];
        if (!u || pass !== DEMO_PASSWORD) { setError('lg-pass', 'The email or password is not right.'); root.querySelector('#lg-pass').select(); return; }
        if (u.status === 'invited') { setError('lg-email', 'This account has not been activated yet. Use the link in your invitation email.'); return; }
        if (u.status === 'deactivated') { setError('lg-email', 'This account is deactivated. Ask a Super admin to turn it back on.'); return; }
        if (S.security.mfa && u.mfa) { pending = u; step = 'code'; info = ''; render(); root.querySelector('#mf-code').focus(); return; }
        finish(u);
      });
      var mf = root.querySelector('#mf-form');
      if (mf) {
        root.querySelector('#mf-back').addEventListener('click', function () { step = 'password'; pending = null; render(); });
        mf.addEventListener('submit', function (e) {
          e.preventDefault();
          if (root.querySelector('#mf-code').value.trim() !== DEMO_CODE) { setError('mf-code', 'That code is not right. Try again.'); return; }
          finish(pending);
        });
      }
    }
    render();
    var el = root.querySelector('#lg-email'); if (el && !email) el.focus();
  }

  /* ---------- boot ---------- */
  function boot() {
    S = load();
    var page = document.body.getAttribute('data-page');
    if (page === 'login') { pageLogin(); return; }
    var sess = getSession();
    if (sess && Date.now() - sess.at > S.security.idle * 60000) {
      setSession(null);
      location.replace('login.html?msg=' + encodeURIComponent('You were signed out after ' + S.security.idle + ' minutes of inactivity.') + '&next=' + encodeURIComponent(currentFile()));
      return;
    }
    if (!currentUser()) { location.replace('login.html?next=' + encodeURIComponent(currentFile())); return; }
    var last = 0;
    function touch() { var n = Date.now(); if (n - last < 10000) return; last = n; var s = getSession(); if (s) { s.at = n; setSession(s); } }
    ['click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, touch, true); });
    setInterval(function () {
      var s = getSession();
      if (s && Date.now() - s.at > S.security.idle * 60000) signOut('You were signed out after ' + S.security.idle + ' minutes of inactivity.');
    }, 30000);
    var main = document.getElementById('main'), area = AREA_OF[page];
    var pages = { overview: pageOverview, tenants: pageTenants, plans: pagePlans, billing: pageBilling, transactions: pageTransactions, sms: pageSms, support: pageSupport, access: pageAccess };
    function draw() { if (area && !canView(area)) noAccess(main, page); else pages[page](main); }
    App.refresh = function () { renderSidebar(); renderBanner(); draw(); };
    renderSidebar(); renderBanner(); draw();
    if (page === 'tenants' && canView('tenants')) {
      var m = /manage=([\w-]+)/.exec(location.hash);
      if (m && tenantById(m[1])) { history.replaceState(null, '', 'tenants.html'); openManage(m[1]); }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
