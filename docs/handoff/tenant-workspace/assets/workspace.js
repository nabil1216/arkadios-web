/* Arkadios workspace (tenant UI). Plain JavaScript, no build step.
   Data is kept in localStorage so changes carry across pages until "Reset demo data". */
(function () {
  'use strict';

  var KEY = 'arkadios_ws_v1';
  var SESS_KEY = 'arkadios_ws_session';
  var DEMO_PASSWORD = 'demo-1234';

  var ICONS = {
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    building: 'M4 21V7l8-4 8 4v14M9 21v-6h6v6',
    kanban: 'M4 4h5v16H4zM10 4h4v10h-4zM15 4h5v13h-5z',
    tasks: 'M5 4h14v16H5zM9 9l2 2 4-4M9 15h6',
    search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3',
    bell: 'M6 16v-5a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0',
    plus: 'M12 5v14M5 12h14',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    down: 'M6 9l6 6 6-6',
    up: 'M6 15l6-6 6 6',
    left: 'M15 6l-6 6 6 6',
    right: 'M9 6l6 6-6 6',
    x: 'M6 6l12 12M18 6L6 18',
    alert: 'M12 4l9 16H3zM12 10v4M12 17h.01',
    download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
    grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
    clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
    pin: 'M12 21s6-5.5 6-11a6 6 0 10-12 0c0 5.5 6 11 6 11zM12 12a2 2 0 100-4 2 2 0 000 4z',
    phone: 'M6 4h4l1.5 4-2 1.5a11 11 0 005 5L16 12.5l4 1.5v4a2 2 0 01-2 2A14 14 0 014 6a2 2 0 012-2z',
    link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
    lock: 'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3',
    file: 'M7 3h7l4 4v14H7zM14 3v4h4',
    chart: 'M4 20V10M10 20V4M16 20v-8M3 20h18',
    users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M17 11a2.5 2.5 0 100-5M21 20a5 5 0 00-4-4.9',
    sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4',
    upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
    person: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
    approve: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8.5 12.5l2.5 2.5 4.5-5',
    mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
    send: 'M4 12l16-8-6 16-3-7z',
    pen: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
    refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7'
  };
  function icon(name, size) {
    size = size || 18;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="flex:none"><path d="' + ICONS[name] + '"/></svg>';
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function money(n) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
  function fmtDate(iso) { return new Date(iso).toLocaleDateString(dateLoc(), { day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtDateTime(iso) { return new Date(iso).toLocaleString(dateLoc(), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
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

  /* ---------- reference data ---------- */
  var DEPTS = ['Relationship Ops', 'Business Development', 'Operations', 'Finance', 'Technology', 'Training', 'Client Service'];
  var ROLES = { super: 'Super Admin', leader: 'Leader', manager: 'Manager', service: 'Client Service', support: 'Advisor Support', compliance: 'Compliance', billing: 'Billing', readonly: 'Read-only' };
  var ROLE_IDS = ['super', 'leader', 'manager', 'service', 'support', 'compliance', 'billing', 'readonly'];
  var CAP_GROUPS = [
    ['Firms', [['firms.create', 'Create firms'], ['firms.edit', 'Edit firm profiles']]],
    ['Advisors and staff', [['advisors.edit', 'Add and edit people'], ['rep.edit', 'Change rep codes'], ['license.edit', 'Change licenses']]],
    ['Tasks and pipeline', [['tasks.create', 'Create tasks'], ['tasks.edit', 'Update tasks'], ['pipeline.move', 'Move firms between stages'], ['notes.add', 'Add notes']]],
    ['Billing', [['billing.view', 'See billing details'], ['billing.edit', 'Edit billing details'], ['funds.record', 'Record funds received']]],
    ['Documents', [['documents.upload', 'Upload documents and request signatures'], ['documents.delete', 'Delete documents']]],
    ['Service and messages', [['tickets.edit', 'Work tickets'], ['comms.send', 'Send messages to firms']]],
    ['Reports and teams', [['reports.view', 'Run shared reports'], ['reports.build', 'Build and save reports'], ['team.view', 'See team performance'], ['export', 'Export lists to CSV']]],
    ['Admin', [['admin.view', 'See Admin settings'], ['admin.edit', 'Change Admin settings']]]
  ];
  var ROLE_BLURB = {
    super: 'Everything, including settings.', leader: 'Sees all data, team performance, and reports. Changes nothing.', manager: 'Runs a department: firms, tasks, pipeline, reports, and team performance.',
    service: 'Firms, advisors, notes, and tasks for service work.', support: 'Advisors, staff, tasks, and notes.', compliance: 'Edits licenses and compliance fields. Reads the rest.',
    billing: 'Billing details and tasks, and records when funds arrive. Reads firm data.', readonly: 'Looks at everything shared. Changes nothing.'
  };
  /* what each role can do */
  var CAPS = {
    super: ['*'],
    leader: ['billing.view', 'team.view', 'reports.view', 'export', 'admin.view'],
    manager: ['firms.create', 'firms.edit', 'advisors.edit', 'rep.edit', 'tasks.create', 'tasks.edit', 'pipeline.move', 'notes.add', 'funds.record', 'team.view', 'reports.view', 'reports.build', 'export', 'documents.upload', 'documents.delete', 'tickets.edit', 'comms.send'],
    service: ['firms.edit', 'advisors.edit', 'rep.edit', 'tasks.create', 'tasks.edit', 'pipeline.move', 'notes.add', 'export', 'documents.upload', 'reports.view', 'tickets.edit', 'comms.send'],
    support: ['advisors.edit', 'rep.edit', 'tasks.create', 'tasks.edit', 'notes.add', 'export', 'documents.upload', 'reports.view', 'tickets.edit', 'comms.send'],
    compliance: ['license.edit', 'tasks.edit', 'notes.add', 'export', 'documents.upload', 'reports.view'],
    billing: ['billing.view', 'billing.edit', 'funds.record', 'tasks.create', 'tasks.edit', 'notes.add', 'export', 'documents.upload', 'reports.view', 'comms.send'],
    readonly: ['reports.view']
  };
  var STAGE_META = [
    { name: 'Prospect', fill: '#3B6FD8', text: '#2F5BD3', tint: '#E8EEFC', target: 30 },
    { name: 'Onboarding', fill: '#D08A1E', text: '#8A5A00', tint: '#FBF0D9', target: 45 },
    { name: 'Implementation', fill: '#2F855A', text: '#1F7A4D', tint: '#E4F3EA', target: 60 },
    { name: 'Training', fill: '#B8434A', text: '#A3343B', tint: '#FBE9EA', target: 30 },
    { name: 'Lifetime', fill: '#1B2A3A', text: '#1B2A3A', tint: '#E6EAEE', target: null }
  ];
  var BILLING_STEPS = [
    ['Verify the funds are in the account', 3], ['Set up the billing profile', 5], ['Add ACH details to the billing system', 7],
    ['Confirm the fee schedule with the firm', 10], ['Issue the first invoice', 12], ['Send the billing welcome note', 14]
  ];
  var DEPT_DEFAULT = { 'Relationship Ops': 'u-mara', 'Business Development': 'u-jordan', 'Operations': 'u-sam', 'Finance': 'u-priya', 'Technology': 'u-tomas', 'Training': 'u-alex', 'Client Service': 'u-imani' };

  function defaultStages() {
    function st(arr) { return arr.map(function (a, i) { return { id: 's' + i + '-' + slug(a[0]), title: a[0], dept: a[1], days: a[2], how: a[3] || '' }; }); }
    return [
      { steps: st([['Send the firm overview deck', 'Business Development', 7, 'Send the current overview deck and note the date on the firm.'], ['Qualify firm size and fit', 'Business Development', 7, 'Confirm advisor count, assets, and fit with the platform.'], ['Hold the discovery call', 'Business Development', 10], ['Share pricing and terms', 'Business Development', 14], ['Confirm intent to proceed', 'Business Development', 21]]) },
      { steps: st([['Collect signed agreement', 'Relationship Ops', 7, 'Send the agreement for signature and attach the signed copy to the firm.'], ['Verify key contacts', 'Relationship Ops', 7], ['Collect W-9 and ACH details', 'Finance', 7, 'Ask the firm for a signed W-9 and bank details for billing.'], ['Create firm record in core systems', 'Technology', 10], ['Assign home-office owner', 'Operations', 10], ['Kickoff call scheduled', 'Relationship Ops', 14]]) },
      { steps: st([['Confirm technology stack', 'Technology', 5], ['Migrate data', 'Operations', 14, 'Load the firm data from their files and check a sample of records.'], ['Sign engagement', 'Relationship Ops', 10], ['Verify billing setup', 'Finance', 14, 'Check that funds arrived and billing is ready.'], ['Approve go-live plan', 'Relationship Ops', 21]]) },
      { steps: st([['Intro call', 'Training', 3], ['Schedule core platform session', 'Training', 7], ['Send recorded training materials', 'Training', 10], ['Back-office walkthrough', 'Training', 14], ['Qualify fit for advanced training', 'Training', 18], ['Confirm go-live', 'Relationship Ops', 21], ['Hand off to Client Service', 'Client Service', 28, 'Share the notes and open items with the Client Service owner.']]) },
      { steps: st([['Confirm platform access', 'Relationship Ops', 10, 'Check that each advisor can sign in and see their own firm data. Record the date in the firm notes.'], ['Book quarterly business review', 'Client Service', 30], ['Annual satisfaction check-in', 'Client Service', 60]]) }
    ];
  }

  /* ---------- seed ---------- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function dstr(d) { var x = d || new Date(); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); }
  function dayShift(base, n) { var d = new Date(base); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return dstr(d); }
  function todayStr() { return dstr(new Date()); }
  function dayDiff(s) { var a = new Date(s + 'T12:00:00'), b = new Date(todayStr() + 'T12:00:00'); return Math.round((a - b) / 864e5); }
  function fmtDay(s) {
    var d = dayDiff(s);
    if (d === 0) return 'Today'; if (d === 1) return 'Tomorrow'; if (d === -1) return 'Yesterday';
    var dt = new Date(s + 'T12:00:00');
    return d > 1 && d < 7 ? dt.toLocaleDateString(dateLoc(), { weekday: 'short', day: 'numeric', month: 'short' }) : dt.toLocaleDateString(dateLoc(), { day: 'numeric', month: 'short' });
  }

  function seed() {
    var R = rng(20261009);
    var U = function (id, name, email, role, dept, bg, fg) { return { id: id, name: name, email: email, role: role, dept: dept, bg: bg, fg: fg }; };
    var users = [
      U('u-avery', 'Avery Quinn', 'avery.quinn@arkadios.example', 'super', 'Operations', '#E3E8ED', '#1B2A3A'),
      U('u-elena', 'Elena Marsh', 'elena.marsh@arkadios.example', 'leader', 'Relationship Ops', '#FBEBD6', '#8A5A00'),
      U('u-dana', 'Dana Reyes', 'dana.reyes@arkadios.example', 'manager', 'Client Service', '#DCE6FA', '#2449AE'),
      U('u-imani', 'Imani Brooks', 'imani.brooks@arkadios.example', 'service', 'Client Service', '#FBE3E6', '#A3343B'),
      U('u-luca', 'Luca Ferraro', 'luca.ferraro@arkadios.example', 'service', 'Client Service', '#DCE6FA', '#2449AE'),
      U('u-mara', 'Mara Vance', 'mara.vance@arkadios.example', 'manager', 'Relationship Ops', '#DDF0E4', '#1F7A4D'),
      U('u-jordan', 'Jordan Tan', 'jordan.tan@arkadios.example', 'service', 'Business Development', '#FBEBD6', '#8A5A00'),
      U('u-robin', 'Robin Nash', 'robin.nash@arkadios.example', 'service', 'Relationship Ops', '#D7DEE6', '#1B2A3A'),
      U('u-alex', 'Alex Park', 'alex.park@arkadios.example', 'support', 'Training', '#DCE6FA', '#2449AE'),
      U('u-kenji', 'Kenji Ito', 'kenji.ito@arkadios.example', 'support', 'Training', '#DDF0E4', '#1F7A4D'),
      U('u-priya', 'Priya Okafor', 'priya.okafor@arkadios.example', 'billing', 'Finance', '#FBE3E6', '#A3343B'),
      U('u-tomas', 'Tomas Berg', 'tomas.berg@arkadios.example', 'support', 'Technology', '#E3E8ED', '#1B2A3A'),
      U('u-sam', 'Sam Whitlock', 'sam.whitlock@arkadios.example', 'service', 'Operations', '#DDF0E4', '#1F7A4D'),
      U('u-noor', 'Noor Haddad', 'noor.haddad@arkadios.example', 'compliance', 'Operations', '#FBEBD6', '#8A5A00'),
      U('u-rory', 'Rory Quinn', 'rory.quinn@arkadios.example', 'readonly', 'Operations', '#E3E8ED', '#1B2A3A')
    ];
    var stages = defaultStages();
    var F = function (name, city, st, stage, days, owner, n, prefix, done, aum, tz) { return { name: name, city: city, state: st, stage: stage, days: days, owner: owner, n: n, prefix: prefix, done: done, aum: aum, tz: tz }; };
    var seeds = [
      F('Ashford Family Office', 'Greenwich', 'CT', 3, 3, 'u-mara', 14, 'AF', 1, '$2.1B'),
      F('Beacon Hill Partners', 'Boston', 'MA', 4, 150, 'u-robin', 9, 'BH', 1, '$860M'),
      F('Cedarline Advisors', 'Birmingham', 'AL', 4, 9, 'u-mara', 22, 'CL', 0, '$1.4B'),
      F('Halcyon Family Office', 'Charlotte', 'NC', 3, 9, 'u-robin', 7, 'HF', 0, '$540M'),
      F('Harborline Advisors', 'Savannah', 'GA', 3, 9, 'u-alex', 18, 'HA', 2, '$1.1B'),
      F('Ironwood Trust', 'Nashville', 'TN', 2, 16, 'u-alex', 11, 'IT', 3, '$720M'),
      F('Larkspur Advisory', 'Mobile', 'AL', 3, 8, 'u-kenji', 6, 'LA', 3, '$310M'),
      F('Meridian Wealth Group', 'Atlanta', 'GA', 2, 8, 'u-jordan', 31, 'MW', 2, '$3.2B'),
      F('Northgate Partners', 'Dallas', 'TX', 1, 31, 'u-priya', 8, 'NP', 1, '$640M'),
      F('Pinnacle Trust Co.', 'Richmond', 'VA', 4, 510, 'u-jordan', 15, 'PT', 1, '$1.7B'),
      F('Vantage Point Capital', 'Houston', 'TX', 0, 21, 'u-jordan', 12, 'VP', 2, '$900M'),
      F('Lakeshore Wealth', 'Chicago', 'IL', 0, 7, 'u-kenji', 8, 'LW', 1, '$480M'),
      F('Summit Row Advisors', 'Montgomery', 'AL', 0, 9, null, 6, 'SR', 0, '$260M'),
      F('Redwood Hall Group', 'Portland', 'OR', 2, 5, null, 10, 'RH', 4, '$830M'),
      F('Nightwatch Advisors', 'Denver', 'CO', 2, 0, 'u-alex', 7, 'NW', 0, '$390M'),
      F('Solstice Financial', 'Phoenix', 'AZ', 3, 42, 'u-kenji', 19, 'SO', 3, '$1.2B')
    ];
    var STREETS = ['Linden Row', 'Round Hill Road', 'Harbor Street', 'Maple Avenue', 'Court Square', 'Park Boulevard', 'Elm Street', 'River Road'];
    var F1 = ['Eleanor', 'Grace', 'Nora', 'Claire', 'Iris', 'Helen', 'Joan', 'Maya', 'Sofia', 'Anna', 'Leah', 'Tessa', 'Cora', 'Naomi', 'Elise'];
    var M1 = ['Alistair', 'Theo', 'Jun', 'Marcus', 'Daniel', 'Omar', 'Felix', 'Victor', 'Henry', 'Samuel', 'Rafael', 'Owen', 'Ivan', 'Calvin', 'Neil'];
    var L1 = ['Whitfield', 'Lindqvist', 'Brandt', 'Katsuro', 'Okonkwo', 'Nakamura', 'Delgado', 'Fitzgerald', 'Rossi', 'Patel', 'Kowalski', 'Abara', 'Sterling', 'Hale', 'Calder', 'Weir', 'Rahman', 'Moreau', 'Bianchi', 'Tran'];
    var LIC = ['Series 65', 'Series 7, Series 66', 'Series 65, Series 7', 'Series 7', 'Series 66', 'Series 65, Series 63'];
    var pick = function (a) { return a[Math.floor(R() * a.length)]; };
    var named = {
      'Summit Row Advisors': [['Ruth Callahan', 70, 'Montgomery', 'Series 65']],
      'Cedarline Advisors': [['Dorothy Hargrove', 67, 'Birmingham', 'Series 65'], ['Margaret Ellison', 63, 'Birmingham', 'Series 65, Series 7'], ['Lorraine Beaumont', 62, 'Huntsville', 'Series 65, Series 66']],
      'Larkspur Advisory': [['Harriet Sloane', 66, 'Mobile', 'Series 7, Series 63'], ['Evelyn Marchetti', 64, 'Mobile', 'Series 7'], ['Patricia Voss', 61, 'Mobile', 'Series 65, Series 66']]
    };
    var firms = [], advisors = [], tasks = [], notes = [], serial = 0;
    var taskSeq = 0;
    function mkTask(o) {
      taskSeq += 1;
      return { id: 'k' + taskSeq, title: o.title, firmId: o.firmId || null, stageIdx: o.stageIdx == null ? null : o.stageIdx, stepId: o.stepId || null, dept: o.dept, assigneeId: o.assigneeId || null,
        priority: o.priority || 'Medium', status: o.status || 'Open', due: o.due, desc: o.desc || '', subtasks: o.subtasks || [], blockedOn: o.blockedOn || '', blockedReason: o.blockedReason || '', comments: o.comments || [],
        createdAt: o.createdAt || new Date().toISOString(), doneAt: o.doneAt || null };
    }
    seeds.forEach(function (s, i) {
      var fid = 'f' + (i + 1);
      var since = new Date(Date.now() - s.days * 864e5).toISOString();
      var hist = [], cursor = new Date(Date.now() - s.days * 864e5), durs = [18, 40, 57, 25];
      for (var k = s.stage - 1; k >= 0; k--) { var dd = durs[k] || 20, from = new Date(cursor.getTime() - dd * 864e5); hist.unshift({ stage: k, from: from.toISOString(), to: cursor.toISOString() }); cursor = from; }
      var street = (100 + Math.floor(R() * 800)) + ' ' + pick(STREETS);
      firms.push({
        id: fid, name: s.name, city: s.city, state: s.state, address: street + ', ' + s.city + ', ' + s.state + ' ' + (10000 + Math.floor(R() * 89999)), phone: '(' + (200 + Math.floor(R() * 700)) + ') 555-' + ('0' + Math.floor(R() * 99)).slice(-2) + ('0' + Math.floor(R() * 99)).slice(-2),
        website: slug(s.name).replace(/-(co|inc)$/, '') + '.example', aum: s.aum, stage: s.stage, stageSince: since, history: hist, ownerId: s.owner, dept: s.stage >= 3 ? 'Client Service' : 'Relationship Ops', prefix: s.prefix,
        createdAt: hist.length ? hist[0].from : since, fundsAt: s.stage >= 3 ? new Date(Date.now() - (s.days + 20) * 864e5).toISOString() : null,
        contacts: [{ name: pick(F1) + ' ' + pick(L1), title: 'Managing partner', email: 'partner@' + slug(s.name) + '.example' }, { name: pick(M1) + ' ' + pick(L1), title: 'Operations lead', email: 'ops@' + slug(s.name) + '.example' }],
        billing: { ach: s.stage >= 2 ? 'Bank account ending ' + (1000 + Math.floor(R() * 8999)) : 'Not collected yet', w9: s.stage >= 1 ? 'On file' : 'Not received' }
      });
      /* advisors and staff */
      var nm = named[s.name] || [];
      for (var a = 0; a < s.n; a++) {
        serial += 1;
        var fixed = nm[a], female = fixed ? true : R() < 0.5;
        var first = female ? pick(F1) : pick(M1), last = pick(L1), role = a === 0 && !fixed ? 'Lead advisor' : (R() < 0.72 ? 'Advisor' : (R() < 0.5 ? 'Operations' : (R() < 0.5 ? 'Compliance officer' : 'Assistant')));
        var licensed = role === 'Lead advisor' || role === 'Advisor' || fixed;
        var age = fixed ? fixed[1] : 28 + Math.floor(R() * 44), staff = fixed ? 2 : Math.floor(R() * 7), cityA = fixed ? fixed[2] : s.city;
        if (s.state === 'AL' && !fixed && female && age > 60 && staff === 2) staff = 3;
        advisors.push({ id: 'a' + serial, firmId: fid, name: fixed ? fixed[0] : first + ' ' + last, role: fixed ? 'Advisor' : role, age: age, gender: female ? 'Female' : 'Male', city: cityA, state: s.state, officeStaff: staff,
          repCode: licensed ? s.prefix + '-' + (3000 + serial * 3 + Math.floor(R() * 3)) : '', licenses: licensed ? (fixed ? fixed[3] : pick(LIC)) : 'No license needed' });
      }
      /* checklist tasks for the current stage */
      var owner = s.owner, steps = stages[s.stage].steps;
      steps.forEach(function (step, j) {
        var assignee = step.dept === 'Relationship Ops' || step.dept === 'Business Development' ? (owner || DEPT_DEFAULT[step.dept]) : (step.dept === 'Training' ? (owner && users.filter(function (u) { return u.id === owner; })[0].dept === 'Training' ? owner : DEPT_DEFAULT.Training) : DEPT_DEFAULT[step.dept]);
        var done = j < s.done;
        tasks.push(mkTask({ title: step.title, firmId: fid, stageIdx: s.stage, stepId: step.id, dept: step.dept, assigneeId: assignee, priority: step.days <= 7 ? 'High' : 'Medium', status: done ? 'Done' : 'Open',
          due: s.stage === 4 ? dayShift(new Date(), step.days - (s.days % step.days || step.days)) : dayShift(since, step.days), desc: step.how, createdAt: since, doneAt: done ? new Date(Date.now() - 864e5 * Math.max(0, s.days - step.days / 2)).toISOString() : null,
          subtasks: step.how ? [{ t: 'Do the work', done: done }, { t: 'Note the date on the firm', done: done }] : [] }));
      });
    });
    /* finished work from earlier stages, and the billing tasks that followed the funds */
    seeds.forEach(function (s, i) {
      var f = firms[i];
      f.history.forEach(function (h) {
        var from = new Date(h.from).getTime(), to = new Date(h.to).getTime();
        stages[h.stage].steps.forEach(function (step) {
          var assignee = step.dept === 'Relationship Ops' || step.dept === 'Business Development' ? (f.ownerId || DEPT_DEFAULT[step.dept]) : DEPT_DEFAULT[step.dept];
          var doneAt = Math.min(to, from + Math.max(1, step.days) * 864e5 * 0.85);
          tasks.push(mkTask({ title: step.title, firmId: f.id, stageIdx: h.stage, stepId: step.id, dept: step.dept, assigneeId: assignee, priority: 'Medium', status: 'Done', due: dayShift(new Date(from), step.days), createdAt: new Date(from).toISOString(), doneAt: new Date(doneAt).toISOString() }));
        });
      });
      if (f.fundsAt) {
        var fa = new Date(f.fundsAt).getTime();
        BILLING_STEPS.forEach(function (b) {
          tasks.push(mkTask({ title: b[0], firmId: f.id, dept: 'Finance', assigneeId: DEPT_DEFAULT.Finance, priority: 'Medium', status: 'Done', due: dayShift(new Date(fa), b[1]), createdAt: new Date(fa).toISOString(), doneAt: new Date(Math.min(Date.now() - 864e5, fa + b[1] * 864e5)).toISOString() }));
        });
      }
    });
    /* standalone tasks */
    var T = function (title, fid, dept, who, prio, status, due, extra) { var o = { title: title, firmId: fid, dept: dept, assigneeId: who, priority: prio, status: status, due: due }; for (var k in (extra || {})) o[k] = extra[k]; tasks.push(mkTask(o)); };
    T('Follow up on renewal terms', 'f1', 'Client Service', 'u-luca', 'Medium', 'In progress', dayShift(new Date(), 0));
    T('Review growth opportunities', 'f2', 'Client Service', 'u-imani', 'Medium', 'Open', dayShift(new Date(), 0));
    T('Collect survey responses', 'f4', 'Client Service', 'u-dana', 'Low', 'Open', dayShift(new Date(), 5));
    T('Prepare the quarterly review pack', null, 'Client Service', 'u-dana', 'Medium', 'Open', dayShift(new Date(), 0));
    T('Update the hand-off checklist template', null, 'Client Service', 'u-dana', 'Low', 'In progress', dayShift(new Date(), 3));
    T('Share the session recording with the back-office team', 'f1', 'Training', 'u-dana', 'Medium', 'Open', dayShift(new Date(), 0));
    /* a blocked task and a couple of overdue personal ones */
    tasks.forEach(function (t) { if (t.title === 'Verify billing setup' && t.firmId === 'f6') { t.status = 'Blocked'; t.blockedOn = 'Finance'; t.blockedReason = 'Funds not received yet'; } });
    tasks.forEach(function (t) { if (t.title === 'Confirm platform access' && t.firmId === 'f3') { t.assigneeId = 'u-dana'; t.status = 'In progress'; t.priority = 'High'; t.blockedOn = 'Technology'; t.blockedReason = 'Access was requested 3 days ago'; t.subtasks = [{ t: 'Request access from Technology', done: true }, { t: 'Send sign-in instructions to the firm', done: true }, { t: 'Confirm each advisor can sign in', done: false }, { t: 'Note the date on the firm', done: false }]; t.due = dayShift(new Date(), -2); t.comments = [{ by: 'u-dana', at: at(0, 3), text: 'Eleanor can sign in. Two advisors still need their invitations.' }, { by: 'u-imani', at: at(1), text: 'Technology confirmed they received the request.' }]; } });
    /* notes */
    var N = function (fid, type, by, when, text) { notes.push({ id: nextId('n'), firmId: fid, type: type, by: by, at: when, text: text }); };
    N('f1', 'note', 'u-mara', at(0, 3), 'Renewal call went well. They want a second training session for the back-office team.');
    N('f1', 'stage', 'u-alex', at(3), 'Moved from Implementation to Training. The Training checklist was added with 7 tasks.');
    N('f1', 'handoff', 'u-priya', at(7), 'Billing setup verified. Handed over to Client Service with the signed agreement attached.');
    N('f1', 'call', 'u-kenji', at(9), 'Intro call with Eleanor Whitcombe. Agreed the training plan and a go-live check.');
    N('f6', 'note', 'u-alex', at(1), 'Data migration plan approved. Waiting on their custodian for the account file.');
    N('f2', 'note', 'u-robin', at(1, 2), 'Quarterly review booked for the 21st. Growth opportunities to cover.');
    N('f3', 'note', 'u-dana', at(0, 3), 'Eleanor can sign in. Two advisors still need their invitations.');
    N('f9', 'note', 'u-priya', at(2), 'Waiting on the signed W-9 before billing can be set up.');
    N('f4', 'call', 'u-robin', at(5), 'Intro call completed. Contacts confirmed and training dates offered.');
    N('f5', 'note', 'u-alex', at(4), 'Back-office team has two open questions about the data migration.');
    N('f8', 'note', 'u-jordan', at(3), 'Engagement letter sent for signature. Expect it back this week.');
    N('f11', 'call', 'u-jordan', at(6), 'Discovery call went well. They asked for pricing.');
    N('f16', 'note', 'u-kenji', at(8), 'Scheduling is slow. Training session still not booked.');
    var layouts = {};
    var saved = [
      { id: 'v-onboarding', name: 'Onboarding queue', f: { stage: '1' }, builtin: true },
      { id: 'v-overdue', name: 'Overdue, mine', f: { overdueMine: true }, builtin: true },
      { id: 'v-prospect', name: 'Prospect bench', f: { stage: '0' }, builtin: true }
    ];
    users.forEach(function (u) { u.status = 'active'; });
    advisors.forEach(function (a) { a.custom = { cf1: pick(['Email', 'Phone', 'Text']) }; });
    firms.forEach(function (f) { f.custom = { cf2: pick(['March', 'June', 'September', 'December']) }; });
    tasks.forEach(function (t) { if (t.blockedOn) t.blockedAt = at(t.title === 'Verify billing setup' ? 6 : 3); });
    var D = function (title, ext, kb, cat, fid, stage, tags, by, when) { return { id: nextId('d'), title: title, ext: ext, size: kb * 1024, category: cat, firmId: fid, stage: stage, tags: tags, by: by, at: when, hasFile: false }; };
    var documents = [
      D('Signed agreement, Northgate Partners', 'pdf', 412, 'Agreement', 'f9', 1, ['signed', 'q4'], 'u-priya', at(0, 1)),
      D('W-9 and ACH request template', 'docx', 58, 'Template', null, null, ['finance'], 'u-priya', at(3)),
      D('Core platform training slides', 'pptx', 6348, 'Training material', null, 3, ['session 1'], 'u-alex', at(6)),
      D('Renewal terms, Ashford Family Office', 'pdf', 221, 'Agreement', 'f1', 3, ['renewal'], 'u-mara', at(9)),
      D('Data migration plan, Ironwood Trust', 'xlsx', 1434, 'Plan', 'f6', 2, ['migration', 'approved'], 'u-alex', at(11)),
      D('Quarterly review notes, Beacon Hill Partners', 'docx', 96, 'Meeting notes', 'f2', 4, ['q3'], 'u-robin', at(15)),
      D('Back-office walkthrough checklist', 'docx', 74, 'Training material', null, 3, ['handoff'], 'u-kenji', at(20)),
      D('Go-live confirmation, Harborline Advisors', 'pdf', 188, 'Confirmation', 'f5', 3, ['go-live'], 'u-alex', at(24))
    ];
    var reports = [
      { id: 'r1', name: 'Female advisors over 60, 2 office staff, Alabama', entity: 'advisor', match: 'all', conds: [{ field: 'gender', op: 'is', value: 'Female' }, { field: 'age', op: 'is over', value: '60' }, { field: 'staff', op: 'is', value: '2' }, { field: 'state', op: 'is', value: 'AL' }], cols: ['name', 'age', 'firm', 'city', 'staff', 'rep', 'lic'], sort: { field: 'age', dir: -1 }, shared: true, by: 'u-dana' },
      { id: 'r2', name: 'Series 63 holders', entity: 'advisor', match: 'all', conds: [{ field: 'lic', op: 'contains', value: 'Series 63' }], cols: ['name', 'firm', 'state', 'rep', 'lic'], sort: { field: 'name', dir: 1 }, shared: true, by: 'u-dana' },
      { id: 'r3', name: 'Firms with no named contact', entity: 'firm', match: 'all', conds: [{ field: 'contacts', op: 'is', value: '0' }], cols: ['name', 'stage', 'owner', 'state', 'advisors'], sort: { field: 'name', dir: 1 }, shared: true, by: 'u-dana' }
    ];
    /* Part 2 data: approvals, tickets, messages, recurring work, integrations */
    var stepIdOf = function (title) { for (var i = 0; i < stages.length; i++) for (var j = 0; j < stages[i].steps.length; j++) if (stages[i].steps[j].title === title) return stages[i].steps[j].id; return null; };
    var tkOf = function (fid, title) { return tasks.filter(function (t) { return t.firmId === fid && t.title === title; })[0]; };
    var approvalRules = {};
    [['Collect signed agreement', ['manager', 'compliance']], ['Approve go-live plan', ['manager']], ['Migrate data', ['manager']]].forEach(function (r) { var id = stepIdOf(r[0]); if (id) approvalRules[id] = { on: true, layers: r[1] }; });
    var approvals = [];
    var tA = tkOf('f9', 'Collect signed agreement'), tB = tkOf('f14', 'Approve go-live plan'), tC = tkOf('f6', 'Migrate data');
    if (tA) { var aA = { id: nextId('ap'), taskId: tA.id, firmId: 'f9', title: tA.title, layers: ['manager', 'compliance'], idx: 0, by: tA.assigneeId || 'u-priya', at: at(0, 2), status: 'pending', events: [] }; approvals.push(aA); tA.status = 'Awaiting approval'; tA.doneAt = null; tA.approvalId = aA.id; }
    if (tB) { var aB = { id: nextId('ap'), taskId: tB.id, firmId: 'f14', title: tB.title, layers: ['manager'], idx: 0, by: tB.assigneeId || 'u-mara', at: at(1), status: 'pending', events: [] }; approvals.push(aB); tB.status = 'Awaiting approval'; tB.doneAt = null; tB.approvalId = aB.id; }
    if (tC) approvals.push({ id: nextId('ap'), taskId: tC.id, firmId: 'f6', title: tC.title, layers: ['manager'], idx: 0, by: 'u-sam', at: at(4), status: 'approved', events: [{ by: 'u-dana', at: at(3), decision: 'approve', comment: '', role: 'manager' }] });
    var TKT = function (no, title, fid, contact, prio, status, who, hrsAgo, msgs) {
      var created = Date.now() - hrsAgo * 36e5, hrs = { High: 4, Medium: 8, Low: 24 }[prio];
      var ms = msgs.map(function (m) { return { id: nextId('m'), by: m[0], kind: m[1], text: m[2], at: new Date(created + m[3] * 6e4).toISOString() }; });
      var firstStaff = ms.filter(function (m) { return m.kind === 'staff'; })[0];
      return { id: nextId('t'), no: no, title: title, firmId: fid, contact: contact, priority: prio, status: status, assigneeId: who, createdAt: new Date(created).toISOString(), respondBy: new Date(created + hrs * 36e5).toISOString(), firstResponseAt: firstStaff ? firstStaff.at : null, messages: ms, resolvedAt: status === 'Resolved' ? new Date(created + 6 * 36e5).toISOString() : null };
    };
    var tickets = [
      TKT('T-1042', 'Platform sign-in not working for two advisors', 'f3', 'Eleanor Whitcombe', 'High', 'Open', 'u-imani', 2.7, [[null, 'firm', 'Two of our advisors cannot sign in since this morning. They get an error after the password.', 0]]),
      TKT('T-1041', 'Rep code missing on a new advisor', 'f7', 'Ravi Menon', 'Medium', 'In progress', 'u-dana', 3, [[null, 'firm', 'We added a new advisor last week and there is no rep code on their record.', 0], ['u-dana', 'staff', 'Thanks Ravi. I am checking with Compliance and will confirm today.', 30]]),
      TKT('T-1040', "Request: update the firm's billing contact", 'f6', 'Mary Doyle', 'Low', 'Waiting on firm', 'u-luca', 20, [[null, 'firm', 'Please change our billing contact to Jo Park.', 0], ['u-luca', 'staff', 'Done on our side. Can you confirm Jo Park\'s email address?', 60]]),
      TKT('T-1039', 'Report export is slow', 'f8', 'Tom Hadley', 'Medium', 'Resolved', 'u-imani', 50, [[null, 'firm', 'Exporting the advisor list takes several minutes.', 0], ['u-imani', 'staff', 'We found the cause and the export now runs in seconds. Please try again.', 60]]),
      TKT('T-1038', 'Training session needs rescheduling', 'f4', 'Helen Finch', 'Low', 'Open', 'u-dana', 30, [[null, 'firm', 'Can we move Friday\'s training session to the following Tuesday?', 0]])
    ];
    var templates = [
      { id: 'tp1', name: 'Welcome to the platform', channel: 'email', subject: 'Welcome to {company}', body: 'Hi {contact first name},\n\nWelcome to the platform. {owner} is your contact at {company} and will be in touch to set up your kickoff call.\n\nThanks,\n{owner}' },
      { id: 'tp2', name: 'Training session reminder', channel: 'email', subject: 'Your training session for {firm}', body: 'Hi {contact first name},\n\nA quick reminder about the core platform training session for {firm}. {owner} is your contact if anything changes.\n\nThanks,\n{owner}' },
      { id: 'tp3', name: 'Session reminder (text)', channel: 'text', subject: '', body: 'Hi {contact first name}, a reminder from {company}: your training session for {firm} is coming up. Reply here if the time no longer works.' },
      { id: 'tp4', name: 'Quarterly review invitation', channel: 'email', subject: 'Quarterly review for {firm}', body: 'Hi {contact first name},\n\nIt is time for your quarterly review. {owner} would like to find 45 minutes with you in the next two weeks.\n\nThanks,\n{owner}' },
      { id: 'tp5', name: 'Renewal check-in', channel: 'email', subject: 'Checking in on your renewal', body: 'Hi {contact first name},\n\nYour renewal with {company} is coming up. Is there anything you would like us to cover before then?\n\nThanks,\n{owner}' }
    ];
    var messages = [
      { id: nextId('ms'), firmId: 'f9', to: firms[8].contacts[0].name, channel: 'email', subject: 'Welcome to Arkadios', body: 'Welcome to the platform.', by: 'u-priya', at: at(0, 2) },
      { id: nextId('ms'), firmId: 'f1', to: firms[0].contacts[0].name, channel: 'text', subject: '', body: 'Reminder: your training session is tomorrow at 10 am.', by: 'u-mara', at: at(1) },
      { id: nextId('ms'), firmId: 'f2', to: firms[1].contacts[0].name, channel: 'email', subject: 'Quarterly review for Beacon Hill Partners', body: 'It is time for your quarterly review.', by: 'u-robin', at: at(3) }
    ];
    documents[0].sign = { status: 'signed', signers: [{ name: firms[8].contacts[0].name, role: 'firm', status: 'Signed', at: at(1) }, { name: 'Priya Okafor', role: 'home', status: 'Signed', at: at(0, 3) }], events: [{ text: 'Sent for signature', at: at(2) }, { text: firms[8].contacts[0].name + ' signed', at: at(1) }, { text: 'Priya Okafor signed. All signatures collected.', at: at(0, 3) }] };
    documents[3].sign = { status: 'out', signers: [{ name: firms[0].contacts[0].name, role: 'firm', status: 'Opened', at: at(0, 5) }, { name: 'Mara Vance', role: 'home', status: 'Waiting', at: null }], events: [{ text: 'Sent for signature', at: at(1) }, { text: firms[0].contacts[0].name + ' opened the document', at: at(0, 5) }] };
    var nq = function (kind, text, href, when, read) { return { id: nextId('nt'), to: 'u-dana', kind: kind, text: text, href: href, at: when, read: read }; };
    var notifs = [nq('assigned', 'Imani Brooks assigned you "Confirm platform access" for Cedarline Advisors.', 'tasks.html', at(0, 2), false), nq('mention', 'Mara Vance mentioned you in a note on Ashford Family Office.', 'firm.html?id=f1&tab=service', at(1), false), nq('approval', 'Mara Vance submitted "Approve go-live plan" for Redwood Hall Group for your approval.', 'approvals.html', at(1, 1), false), nq('stage', 'Ironwood Trust moved to Implementation. The checklist was added with 5 tasks.', 'firm.html?id=f6', at(2), true), nq('blocked', '"Verify billing setup" for Ironwood Trust is blocked on Finance.', 'tasks.html', at(3), true)];
    return { users: users, stages: stages, firms: firms, advisors: advisors, tasks: tasks, notes: notes, savedViews: saved, layouts: layouts, audit: [],
      documents: documents, reports: reports,
      customFields: [{ id: 'cf1', entity: 'advisor', label: 'Preferred contact method', type: 'select', options: ['Email', 'Phone', 'Text'] }, { id: 'cf2', entity: 'firm', label: 'Fiscal year end', type: 'select', options: ['March', 'June', 'September', 'December'] }],
      caps: JSON.parse(JSON.stringify(CAPS)), depts: DEPTS.slice(), targets: STAGE_META.map(function (m) { return m.target; }), rules: { funds: true, checklists: true },
      company: { name: 'Arkadios', tagline: 'Home Office' }, security: { mfa: false, ai: true, aiLimit: 200, sso: { provider: '', configured: false } }, aiLog: [], aiLast: {},
      approvalRules: approvalRules, approvals: approvals, tickets: tickets, templates: templates, messages: messages, notifs: notifs, userNotif: {},
      notifDefaults: { assigned: { app: true, email: true }, due: { app: true, email: false }, overdue: { app: true, email: true }, blocked: { app: true, email: true }, mention: { app: true, email: true }, stage: { app: true, email: false }, funds: { app: true, email: true }, approval: { app: true, email: true } },
      recurring: [{ id: 'rc1', title: 'Book quarterly business review', every: 90, window: 14, dept: 'Client Service', active: true }, { id: 'rc2', title: 'Annual satisfaction check-in', every: 365, window: 30, dept: 'Client Service', active: true }, { id: 'rc3', title: 'License check', every: 180, window: 21, dept: 'Operations', active: true }],
      work: { days: [1, 2, 3, 4, 5], from: '09:00', to: '17:30', tz: 'Eastern Time', workdays: true, dmy: false }, record: { signins: true, exports: true },
      terms: {}, menu: { order: ['home', 'firms', 'pipeline', 'tasks', 'documents', 'reports', 'team', 'admin'], hidden: [] }, scopes: {}, dash: {}, sessions: {}, passwords: {}, stageNames: STAGE_META.map(function (m) { return m.name; }), capsV: 2,
      integrations: { outlook: { status: 'connected', account: 'operations@arkadios.example', last: at(0, 1), synced: 128, emails: true, meetings: true, flagged: false, every: 15 }, salesforce: { status: 'off' }, wealthbox: { status: 'off' }, blackdiamond: { status: 'off' }, schwab: { status: 'off' }, zendesk: { status: 'off' } } };
  }

  /* ---------- state ---------- */
  var S, memory = null;
  function load() {
    var s = null;
    try { var raw = localStorage.getItem(KEY); if (raw) s = JSON.parse(raw); } catch (e) { s = memory; }
    if (!s) s = memory;
    var base = seed();
    if (!s) return base;
    Object.keys(base).forEach(function (k) { if (!(k in s)) s[k] = base[k]; });
    if (!s.capsV) { ['tickets.edit', 'comms.send'].forEach(function (c) { Object.keys(CAPS).forEach(function (r) { if (CAPS[r].indexOf(c) >= 0 && s.caps[r] && s.caps[r].indexOf(c) < 0 && s.caps[r].indexOf('*') < 0) s.caps[r].push(c); }); }); s.capsV = 2; }
    DEPTS.splice.apply(DEPTS, [0, DEPTS.length].concat(s.depts));
    if (s.stageNames) STAGE_META.forEach(function (m, i) { if (s.stageNames[i]) m.name = s.stageNames[i]; });
    STAGE_META.forEach(function (m, i) { m.target = s.targets[i]; });
    return s;
  }
  function save() { memory = S; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* keep in memory */ } }
  var App = { refresh: function () {} };

  /* ---------- sign-in session and permissions ---------- */
  var memSession = null;
  function getSession() { try { var r = sessionStorage.getItem(SESS_KEY); return r ? JSON.parse(r) : null; } catch (e) { return memSession; } }
  function setSession(o) { memSession = o; try { if (o) sessionStorage.setItem(SESS_KEY, JSON.stringify(o)); else sessionStorage.removeItem(SESS_KEY); } catch (e) { /* memory */ } }
  function userById(id) { return S.users.filter(function (u) { return u.id === id; })[0]; }
  function currentUser() { var s = getSession(); return s && S ? userById(s.userId) : null; }
  function can(cap) { var u = currentUser(); if (!u) return false; var c = (S.caps && S.caps[u.role]) || CAPS[u.role] || []; return c.indexOf('*') >= 0 || c.indexOf(cap) >= 0 || (cap === 'admin.view' && c.indexOf('admin.edit') >= 0); }
  function initials(name) { return name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase(); }
  function avatar(id, size) {
    var u = typeof id === 'string' ? userById(id) : id; size = size || 26;
    if (!u) return '<span class="avatar avatar--none" style="width:' + size + 'px;height:' + size + 'px" title="Unassigned">?</span>';
    return '<span class="avatar" title="' + esc(u.name) + '" style="width:' + size + 'px;height:' + size + 'px;background:' + u.bg + ';color:' + u.fg + ';font-size:' + Math.max(10, Math.round(size * 0.42)) + 'px">' + initials(u.name) + '</span>';
  }
  function userName(id) { var u = userById(id); return u ? u.name : 'Unassigned'; }
  function signOut(msg) {
    var ses = getSession(); if (ses && S) { var me = userById(ses.userId); if (S.sessions[ses.userId]) S.sessions[ses.userId] = S.sessions[ses.userId].filter(function (x) { return x.id !== ses.sid; }); if (S.record && S.record.signins && me) recordAudit(me.id, 'Signed out'); save(); }
    setSession(null); location.href = 'login.html' + (msg ? '?msg=' + encodeURIComponent(msg) : ''); }
  function log(text) { S.audit.unshift({ id: nextId('a'), at: new Date().toISOString(), by: currentUser() ? currentUser().id : null, text: text }); S.audit = S.audit.slice(0, 200); }

  /* ---------- domain helpers ---------- */
  function firmById(id) { return S.firms.filter(function (f) { return f.id === id; })[0]; }
  function taskById(id) { return S.tasks.filter(function (t) { return t.id === id; })[0]; }
  function firmName(id) { var f = firmById(id); return f ? f.name : ''; }
  function daysIn(f) { return Math.max(0, Math.floor((Date.now() - new Date(f.stageSince).getTime()) / 864e5)); }
  function overTarget(f) { var t = STAGE_META[f.stage].target; return t && daysIn(f) > t; }
  function isOpen(t) { return t.status !== 'Done'; }
  function isOverdue(t) { return isOpen(t) && dayDiff(t.due) < 0; }
  function stageTasks(f) { return S.tasks.filter(function (t) { return t.firmId === f.id && t.stageIdx === f.stage && t.stepId; }); }
  function progress(f) { var l = stageTasks(f); return { done: l.filter(function (t) { return t.status === 'Done'; }).length, total: l.length }; }
  function nextStep(f) {
    var open = stageTasks(f).filter(isOpen).sort(function (a, b) { return a.due < b.due ? -1 : 1; });
    return open[0] || null;
  }
  function firmRepCodes(f) { return S.advisors.filter(function (a) { return a.firmId === f.id && a.repCode; }).map(function (a) { return a.repCode; }); }
  function firmAdvisors(f) { return S.advisors.filter(function (a) { return a.firmId === f.id; }); }
  function defaultAssignee(dept, firm) {
    if ((dept === 'Relationship Ops' || dept === 'Business Development') && firm && firm.ownerId) return firm.ownerId;
    if (dept === 'Client Service' && firm && firm.ownerId && userById(firm.ownerId) && userById(firm.ownerId).dept === 'Client Service') return firm.ownerId;
    return DEPT_DEFAULT[dept] || null;
  }
  function addNote(fid, type, by, text) { S.notes.unshift({ id: nextId('n'), firmId: fid, type: type, by: by, at: new Date().toISOString(), text: text }); mentionNotes(by, fid, text); }
  function addStageTasks(f, idx) {
    var created = [];
    S.stages[idx].steps.forEach(function (step) {
      var t = { id: nextId('k'), title: step.title, firmId: f.id, stageIdx: idx, stepId: step.id, dept: step.dept, assigneeId: defaultAssignee(step.dept, f), priority: step.days <= 7 ? 'High' : 'Medium', status: 'Open',
        due: dueIn(step.days), desc: step.how, subtasks: step.how ? [{ t: 'Do the work', done: false }, { t: 'Note the date on the firm', done: false }] : [], blockedOn: '', blockedReason: '', comments: [], createdAt: new Date().toISOString(), doneAt: null };
      S.tasks.push(t); created.push(t);
    });
    return created;
  }
  function moveFirm(f, to) {
    var from = f.stage, by = currentUser();
    f.history.push({ stage: from, from: f.stageSince, to: new Date().toISOString() });
    f.stage = to; f.stageSince = new Date().toISOString();
    if (to >= 3) f.dept = 'Client Service'; else f.dept = 'Relationship Ops';
    var made = S.rules.checklists ? addStageTasks(f, to) : [];
    addNote(f.id, 'stage', by.id, 'Moved from ' + STAGE_META[from].name + ' to ' + STAGE_META[to].name + (S.rules.checklists ? '. The ' + STAGE_META[to].name + ' checklist was added with ' + made.length + ' tasks.' : '.'));
    log('Moved ' + f.name + ' to ' + STAGE_META[to].name);
    pushNote(f.ownerId, 'stage', f.name + ' moved to ' + STAGE_META[to].name + '.', 'firm.html?id=' + f.id);
    save();
  }
  function recordFunds(f) {
    var by = currentUser(); f.fundsAt = new Date().toISOString();
    (S.rules.funds ? BILLING_STEPS : []).forEach(function (b) {
      S.tasks.push({ id: nextId('k'), title: b[0], firmId: f.id, stageIdx: null, stepId: null, dept: 'Finance', assigneeId: DEPT_DEFAULT.Finance, priority: 'Medium', status: 'Open', due: dueIn(b[1]), desc: '', subtasks: [], blockedOn: '', blockedReason: '', comments: [], createdAt: new Date().toISOString(), doneAt: null });
    });
    addNote(f.id, 'handoff', by.id, S.rules.funds ? 'Funds received. ' + BILLING_STEPS.length + ' billing setup tasks were created for Finance.' : 'Funds received.');
    S.tasks.forEach(function (t) { if (t.firmId === f.id && t.status === 'Blocked' && t.blockedOn === 'Finance') { t.status = 'Open'; t.blockedOn = ''; t.blockedReason = ''; } });
    log('Recorded funds received for ' + f.name);
    pushNote(f.ownerId, 'funds', 'Funds were received for ' + f.name + '.', 'firm.html?id=' + f.id + '&tab=workstreams');
    save();
  }
  function completeTask(t, done) {
    var by = currentUser();
    if (done && t.status === 'Awaiting approval') { pendingToast = 'This is already waiting for approval.'; return 'pending'; }
    if (done && t.status !== 'Done' && by) {
      var rule = ruleFor(t);
      if (rule) { var layers = rule.layers.slice(), idx = 0; while (idx < layers.length && (layers[idx] === by.role || by.role === 'super')) idx++; if (idx < layers.length) { submitForApproval(t, layers, idx, by); return 'pending'; } }
    }
    t.status = done ? 'Done' : 'Open'; t.doneAt = done ? new Date().toISOString() : null;
    if (done) { t.blockedOn = ''; t.blockedReason = ''; }
    log((done ? 'Completed ' : 'Reopened ') + '"' + t.title + '"' + (t.firmId ? ' for ' + firmName(t.firmId) : '')); save();
    return done ? 'done' : 'open';
  }
  function tasksIn(scope, u) {
    return visibleTasks().filter(function (t) {
      if (scope === 'mine') return t.assigneeId === u.id;
      if (scope === 'team') return t.dept === u.dept || (userById(t.assigneeId) && userById(t.assigneeId).dept === u.dept);
      return true;
    });
  }
  function stagePill(i) { var m = STAGE_META[i]; return '<span class="pill" style="background:' + m.tint + ';color:' + m.text + '"><span class="pill__dot" style="background:' + m.text + '"></span>' + m.name + '</span>'; }
  function ribbon(i, small) {
    return '<span class="ribbon' + (small ? ' ribbon--small' : '') + '" role="img" aria-label="Stage ' + (i + 1) + ' of 5: ' + STAGE_META[i].name + '">' + STAGE_META.map(function (m, k) {
      return '<span class="ribbon__seg' + (k === i ? ' is-current' : '') + '" style="background:' + (k <= i ? m.fill : '#E3E8ED') + '"></span>';
    }).join('') + '</span>';
  }
  function dueLabel(t) {
    var d = dayDiff(t.due);
    if (!isOpen(t)) return '<span class="muted">' + fmtDay(t.due) + '</span>';
    if (d < 0) return '<span class="pill pill--red"><span class="pill__dot"></span>' + (d === -1 ? 'Overdue 1 day' : 'Overdue ' + Math.abs(d) + ' days') + '</span>';
    if (d === 0) return '<span class="pill pill--blue"><span class="pill__dot"></span>Due today</span>';
    return '<span class="muted">' + fmtDay(t.due) + '</span>';
  }
  var STATUS_CLASS = { 'Open': 'blue', 'In progress': 'teal', 'Blocked': 'amber', 'Awaiting approval': 'amber', 'Done': 'green' };
  var PRIO_CLASS = { High: 'red', Medium: 'amber', Low: 'gray' };
  function csv(rows) { return rows.map(function (r) { return r.map(function (c) { c = String(c == null ? '' : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\n'); }

  /* ---------- chrome: sidebar, top bar, search ---------- */
  var NAV = [['index.html', 'Command Center', 'grid', 'home', null], ['firms.html', 'Firms', 'building', 'firms', null], ['pipeline.html', 'Pipeline', 'kanban', 'pipeline', null], ['tasks.html', 'Tasks', 'tasks', 'tasks', null],
    ['documents.html', 'Documents', 'file', 'documents', null], ['reports.html', 'Reports', 'chart', 'reports', 'reports.view'], ['team.html', 'Team performance', 'users', 'team', 'team.view'], ['admin.html', 'Admin', 'sliders', 'admin', 'admin.view']];
  var SIDE_SUBS = { home: [['dashboards.html', 'Dashboards', 'dashboards']], firms: [['people.html', 'People', 'people'], ['map.html', 'Map', 'map']], tasks: [['approvals.html', 'Approvals', 'approvals'], ['tickets.html', 'Tickets', 'tickets']], documents: [['communications.html', 'Communications', 'communications']] };
  var PAGE_CAP = { reports: 'reports.view', team: 'team.view', admin: 'admin.view', settings: 'admin.view', import: 'admin.edit' };
  function overdueMine(u) { return S.tasks.filter(function (t) { return t.assigneeId === u.id && isOverdue(t); }); }
  function renderChrome() {
    var page = document.body.getAttribute('data-page'), u = currentUser();
    var views = S.savedViews.map(function (v) { return '<a class="side__view" href="firms.html?view=' + v.id + '">' + esc(v.name) + '</a>'; }).join('');
    document.getElementById('sidebar').innerHTML =
      '<div class="side__brand"><span class="side__mark" aria-hidden="true">' + esc(S.company.name.charAt(0).toUpperCase()) + '</span><div><strong>' + esc(S.company.name) + '</strong><small>' + esc(S.company.tagline) + '</small></div></div>' +
      '<div class="side__scope"><span class="muted">Viewing as</span><strong>' + ROLES[u.role] + '</strong><span class="muted">' + esc(u.dept) + '</span></div>' +
      '<nav aria-label="Main" class="side__nav">' + navItems().map(function (n) {
        var on = n[3] === (NAV_OF_PAGE[page] || page);
        var subs = (SIDE_SUBS[n[3]] || []).map(function (x) { var cnt = x[2] === 'approvals' ? approvalsForMe().length : 0; return '<a class="side__sub' + (page === x[2] ? ' active' : '') + '" href="' + x[0] + '"' + (page === x[2] ? ' aria-current="page"' : '') + '>' + x[1] + (cnt ? ' <span class="count">' + cnt + '</span>' : '') + '</a>'; }).join('');
        return '<a class="side__link' + (on ? ' active' : '') + '" href="' + n[0] + '"' + (on ? ' aria-current="page"' : '') + '>' + icon(n[2]) + '<span>' + n[1] + '</span></a>' + subs;
      }).join('') + '</nav>' +
      '<div class="side__views"><div class="side__views-h">Saved views</div>' + views + '</div>' +
      '<div class="side__foot"><div class="side__user">' + avatar(u, 34) + '<div><strong>' + esc(u.name) + '</strong><span>' + ROLES[u.role] + '</span></div></div>' +
      '<div class="side__foot-links"><a class="link-btn" href="account.html">My account</a>' + (can('admin.view') ? '<a class="link-btn" href="settings.html">Settings</a>' : '') + '<button type="button" class="link-btn" id="sign-out">Sign out</button>' + (u.role === 'super' ? '<button type="button" class="link-btn" id="reset-demo">Reset demo data</button>' : '') + '</div></div>';
    var n = bellCount(u);
    document.getElementById('topbar').innerHTML =
      '<div class="search"><span class="search__ic">' + icon('search') + '</span><label for="g-search" class="sr-only">Search firms, advisors, rep codes, and licenses</label>' +
      '<input id="g-search" class="input" autocomplete="off" placeholder="Search firms, advisors, rep codes, licenses" role="combobox" aria-expanded="false" aria-controls="g-results"><kbd class="search__kbd">Ctrl K</kbd><div id="g-results" class="search__results" role="listbox" hidden></div></div>' +
      '<button type="button" class="bell" id="bell" aria-label="Notifications, ' + n + ' unread">' + icon('bell', 20) + (n ? '<span class="bell__dot" aria-hidden="true">' + (n > 9 ? '9+' : n) + '</span>' : '') + '</button>';
    document.getElementById('sign-out').addEventListener('click', function () { signOut(); });
    var rd = document.getElementById('reset-demo');
    if (rd) rd.addEventListener('click', function () {
      confirmDialog({ title: 'Reset the demo?', description: 'This puts every firm, task, note, and saved view back to the sample data.', confirmLabel: 'Reset demo data', danger: true,
        onConfirm: function () { try { localStorage.removeItem(KEY); } catch (e) {} memory = null; location.reload(); } });
    });
    bindSearch(); bindBell();
  }
  function bindBell() { document.getElementById('bell').addEventListener('click', function () { location.href = 'notifications.html'; }); }
  function searchAll(q) {
    q = q.trim().toLowerCase(); if (!q) return [];
    var out = [];
    visibleFirms().forEach(function (f) {
      var hay = [f.name, f.city, f.state, STAGE_META[f.stage].name].concat(firmRepCodes(f)).join(' ').toLowerCase();
      if (hay.indexOf(q) >= 0) out.push({ kind: 'Firm', label: f.name, sub: f.city + ', ' + f.state + ', ' + STAGE_META[f.stage].name, href: 'firm.html?id=' + f.id });
    });
    visibleAdvisors().forEach(function (a) {
      var hay = [a.name, a.repCode, a.licenses].join(' ').toLowerCase();
      if (hay.indexOf(q) >= 0) { var f = firmById(a.firmId); out.push({ kind: 'Advisor', label: a.name, sub: (a.repCode ? a.repCode + ', ' : '') + firmName(a.firmId) + (a.licenses && a.licenses !== 'No license needed' ? ', ' + a.licenses : ''), href: 'firm.html?id=' + a.firmId + '&tab=advisors&adv=' + a.id }); }
    });
    return out;
  }
  function bindSearch() {
    var inp = document.getElementById('g-search'), box = document.getElementById('g-results'), idx = -1, items = [];
    function close() { box.hidden = true; inp.setAttribute('aria-expanded', 'false'); idx = -1; }
    function paint() {
      items = searchAll(inp.value).slice(0, 8);
      if (!inp.value.trim()) { close(); return; }
      box.hidden = false; inp.setAttribute('aria-expanded', 'true');
      box.innerHTML = items.length ? items.map(function (r, i) { return '<a class="search__item' + (i === idx ? ' is-on' : '') + '" role="option" href="' + r.href + '"><span class="search__kind">' + r.kind + '</span><span><strong>' + esc(r.label) + '</strong><span class="muted"> ' + esc(r.sub) + '</span></span></a>'; }).join('') +
        '<a class="search__item search__all" href="firms.html?q=' + encodeURIComponent(inp.value.trim()) + '">See all matches in Firms</a>' : '<div class="search__empty">No firms or advisors match "' + esc(inp.value.trim()) + '".</div>';
    }
    inp.addEventListener('input', function () { idx = -1; paint(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(-1, idx - 1); paint(); }
      else if (e.key === 'Escape') { close(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (idx >= 0 && items[idx]) location.href = items[idx].href; else if (inp.value.trim()) location.href = 'firms.html?q=' + encodeURIComponent(inp.value.trim()); }
    });
  }
  document.addEventListener('click', function (e) { if (!e.target.closest('.search')) { var b = document.getElementById('g-results'); if (b) b.hidden = true; } });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { var i = document.getElementById('g-search'); if (i) { e.preventDefault(); i.focus(); i.select(); } }
  });
  function pageHead(title, sub, actions) { return '<header class="page__head"><div><h1>' + title + '</h1><p class="muted">' + sub + '</p></div>' + (actions ? '<div class="btn-row">' + actions + '</div>' : '') + '</header>'; }
  function params() { return new URLSearchParams(location.search); }
  function selectOpts(list, cur, allLabel) {
    return (allLabel ? '<option value="all">' + allLabel + '</option>' : '') + list.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('');
  }
  function userOptions(cur, allowNone) { return (allowNone ? '<option value="">Unassigned</option>' : '') + S.users.map(function (u) { return '<option value="' + u.id + '"' + (cur === u.id ? ' selected' : '') + '>' + esc(u.name) + '</option>'; }).join(''); }

  /* ---------- toast ---------- */
  var toastTimer, pendingToast = null;
  function toast(text) {
    if (pendingToast) { text = pendingToast; pendingToast = null; }
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
    if (!c) return;
    if (!e && msg) { e = document.createElement('span'); e.className = 'error'; e.id = id + '-err'; e.setAttribute('role', 'alert'); c.insertAdjacentElement('afterend', e); }
    if (!e) return;
    e.textContent = msg || ''; e.hidden = !msg;
    if (msg) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid');
  }
  function download(filename, text, mime) {
    if (S && S.record && S.record.exports && currentUser()) { recordAudit(currentUser().id, 'Exported ' + filename); try { save(); } catch (e) {} }
    var blob = new Blob([text], { type: mime || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 500);
  }
  /* ---------- shared dialogs ---------- */
  function openNewFirm() {
    if (!can('firms.create')) { toast('Your role cannot create firms'); return; }
    var api = dialog({ title: 'New firm', description: 'It starts in Prospect with the Prospect checklist.',
      body: '<form id="nf-form" novalidate>' + field('nf-name', 'Firm name', '<input id="nf-name" class="input" autocomplete="off">') +
        '<div class="two">' + field('nf-city', 'City', '<input id="nf-city" class="input" autocomplete="off">') + field('nf-state', 'State', '<input id="nf-state" class="input" maxlength="2" autocomplete="off" placeholder="AL">') + '</div>' +
        field('nf-owner', 'Owner', '<select id="nf-owner" class="select">' + userOptions(currentUser().id, true) + '</select>') +
        '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Create firm</button></div></form>' });
    var b = api.body; b.querySelector('#nf-name').focus();
    b.querySelector('[data-cancel]').addEventListener('click', api.close);
    b.querySelector('#nf-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = b.querySelector('#nf-name').value.trim(), city = b.querySelector('#nf-city').value.trim(), st = b.querySelector('#nf-state').value.trim().toUpperCase(), bad = false;
      var dup = S.firms.some(function (f) { return f.name.toLowerCase() === name.toLowerCase(); });
      setError('nf-name', !name ? 'Enter the firm name.' : (dup ? 'A firm with this name already exists.' : '')); if (!name || dup) bad = true;
      setError('nf-city', city ? '' : 'Enter the city.'); if (!city) bad = true;
      setError('nf-state', /^[A-Z]{2}$/.test(st) ? '' : 'Use the 2-letter state code.'); if (!/^[A-Z]{2}$/.test(st)) bad = true;
      if (bad) { var f1 = b.querySelector('[aria-invalid="true"]'); if (f1) f1.focus(); return; }
      var f = { id: nextId('f'), name: name, city: city, state: st, address: '', phone: '', website: '', aum: 'Not yet known', stage: 0, stageSince: new Date().toISOString(), history: [], ownerId: b.querySelector('#nf-owner').value || null,
        dept: 'Relationship Ops', prefix: name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase(), createdAt: new Date().toISOString(), fundsAt: null, contacts: [], billing: { ach: 'Not collected yet', w9: 'Not received' } };
      S.firms.push(f); var made = addStageTasks(f, 0);
      addNote(f.id, 'note', currentUser().id, 'Firm created in Prospect with ' + made.length + ' checklist tasks.'); log('Created the firm ' + name); save();
      location.href = 'firm.html?id=' + f.id;
    });
  }
  function openNewTask(opts) {
    opts = opts || {};
    if (!can('tasks.create')) { toast('Your role cannot create tasks'); return; }
    var api = dialog({ title: 'New task', description: opts.firmId ? 'For ' + firmName(opts.firmId) + '.' : 'Link it to a firm if it belongs to one.',
      body: '<form id="nt-form" novalidate>' + field('nt-title', 'Task', '<input id="nt-title" class="input" autocomplete="off" value="' + esc(opts.title || '') + '">') +
        field('nt-firm', 'Firm', '<select id="nt-firm" class="select"><option value="">No firm</option>' + S.firms.map(function (f) { return '<option value="' + f.id + '"' + (opts.firmId === f.id ? ' selected' : '') + '>' + esc(f.name) + '</option>'; }).join('') + '</select>') +
        '<div class="two">' + field('nt-who', 'Assignee', '<select id="nt-who" class="select">' + userOptions(currentUser().id, true) + '</select>') +
        field('nt-prio', 'Priority', '<select id="nt-prio" class="select"><option>High</option><option selected>Medium</option><option>Low</option></select>') + '</div>' +
        field('nt-due', 'Due date', '<input id="nt-due" type="date" class="input" value="' + dueIn(3) + '">') +
        '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Create task</button></div></form>' });
    var b = api.body; b.querySelector('#nt-title').focus();
    b.querySelector('[data-cancel]').addEventListener('click', api.close);
    b.querySelector('#nt-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var title = b.querySelector('#nt-title').value.trim(), due = b.querySelector('#nt-due').value, bad = false;
      setError('nt-title', title ? '' : 'Describe the task.'); if (!title) bad = true;
      setError('nt-due', due ? '' : 'Choose a due date.'); if (!due) bad = true;
      if (bad) { b.querySelector('[aria-invalid="true"]').focus(); return; }
      var who = b.querySelector('#nt-who').value || null, fid = b.querySelector('#nt-firm').value || null;
      var t = { id: nextId('k'), title: title, firmId: fid, stageIdx: null, stepId: null, dept: who ? userById(who).dept : 'Client Service', assigneeId: who, priority: b.querySelector('#nt-prio').value, status: 'Open', due: due, desc: '', subtasks: [], blockedOn: '', blockedReason: '', comments: [], createdAt: new Date().toISOString(), doneAt: null };
      S.tasks.push(t); log('Created the task "' + title + '"'); if (who) pushNote(who, 'assigned', currentUser().name + ' assigned you "' + title + '".', 'tasks.html?task=' + t.id); save(); api.close(); App.refresh(); toast('Task created');
      if (opts.onDone) opts.onDone(t);
    });
  }
  function openNote(fid, onDone) {
    if (!can('notes.add')) { toast('Your role cannot add notes'); return; }
    var api = dialog({ title: 'Log a note', description: fid ? 'On ' + firmName(fid) + '.' : 'Choose the firm it belongs to.',
      body: '<form id="ln-form" novalidate>' + (fid ? '' : field('ln-firm', 'Firm', '<select id="ln-firm" class="select">' + S.firms.map(function (f) { return '<option value="' + f.id + '">' + esc(f.name) + '</option>'; }).join('') + '</select>')) +
        field('ln-type', 'Type', '<select id="ln-type" class="select"><option value="note">Note</option><option value="call">Call</option><option value="handoff">Hand-off</option></select>') +
        field('ln-text', 'What happened', '<textarea id="ln-text" class="textarea"></textarea>') +
        '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Save note</button></div></form>' });
    var b = api.body; b.querySelector('#ln-text').focus();
    b.querySelector('[data-cancel]').addEventListener('click', api.close);
    b.querySelector('#ln-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var text = b.querySelector('#ln-text').value.trim();
      if (!text) { setError('ln-text', 'Write a few words about it.'); b.querySelector('#ln-text').focus(); return; }
      var id = fid || b.querySelector('#ln-firm').value;
      addNote(id, b.querySelector('#ln-type').value, currentUser().id, text); log('Added a note to ' + firmName(id)); save(); api.close(); App.refresh(); toast('Note saved');
      if (onDone) onDone();
    });
  }
  function openMove(f, to) {
    if (!can('pipeline.move')) { toast('Your role can see the pipeline but cannot move firms'); return; }
    if (to === f.stage) return;
    var open = stageTasks(f).filter(isOpen).length, steps = S.stages[to].steps;
    var depts = steps.map(function (s) { return s.dept; }).filter(function (d, i, a) { return a.indexOf(d) === i; });
    var maxDays = Math.max.apply(null, steps.map(function (s) { return s.days; }));
    var t = STAGE_META[f.stage].target;
    var api = dialog({ title: 'Move ' + f.name + ' to ' + STAGE_META[to].name + '?', description: 'It has been in ' + STAGE_META[f.stage].name + ' for ' + daysIn(f) + ' days' + (t ? ', against a target of ' + t + '.' : '.'),
      body: (open ? '<div class="callout callout--amber">' + icon('alert') + '<div><strong>' + open + ' of ' + stageTasks(f).length + ' ' + STAGE_META[f.stage].name.toLowerCase() + ' steps ' + (open === 1 ? 'is' : 'are') + ' still open.</strong><div>They stay on the firm\'s task list.</div></div></div>' : '') +
        '<p style="margin:14px 0 0">The ' + steps.length + '-step ' + STAGE_META[to].name + ' checklist is added, with tasks for ' + depts.join(', ').replace(/, ([^,]*)$/, ' and $1') + ' due within ' + maxDays + ' days.' + (to < f.stage ? ' You are moving the firm back a stage.' : '') + '</p>' +
        '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Keep in ' + STAGE_META[f.stage].name + '</button><button type="button" class="btn btn--primary" data-ok>Move to ' + STAGE_META[to].name + '</button></div>' });
    api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
    api.body.querySelector('[data-ok]').addEventListener('click', function () { api.close(); moveFirm(f, to); App.refresh(); toast(f.name + ' moved to ' + STAGE_META[to].name); });
  }
  function openBlock(t, done) {
    var api = dialog({ title: 'Block on a team', description: 'The task stays open until that team confirms.',
      body: '<form id="bk-form" novalidate>' + field('bk-team', 'Waiting on', '<select id="bk-team" class="select">' + selectOpts(DEPTS, t.blockedOn || 'Technology') + '</select>') +
        field('bk-why', 'Why', '<input id="bk-why" class="input" autocomplete="off" value="' + esc(t.blockedReason || '') + '">') +
        '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Mark as blocked</button></div></form>' });
    api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
    api.body.querySelector('#bk-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var why = api.body.querySelector('#bk-why').value.trim();
      if (!why) { setError('bk-why', 'Say what you are waiting for.'); return; }
      t.status = 'Blocked'; t.blockedOn = api.body.querySelector('#bk-team').value; t.blockedReason = why; t.blockedAt = new Date().toISOString(); if (t.assigneeId) pushNote(t.assigneeId, 'blocked', '"' + t.title + '" was blocked on ' + t.blockedOn + ': ' + why, 'tasks.html?task=' + t.id);
      t.comments.push({ by: currentUser().id, at: new Date().toISOString(), text: 'Blocked, waiting on ' + t.blockedOn + ': ' + why });
      log('Blocked "' + t.title + '" on ' + t.blockedOn); save(); api.close(); if (done) done(); App.refresh(); toast('Task marked as blocked');
    });
  }
  function openTask(id) {
    var t0 = taskById(id); if (!t0) return;
    var api = dialog({ title: t0.title, variant: 'drawer', body: '' });
    var edit = can('tasks.edit');
    function chk(done, label, attrs) { return '<label class="check"><input type="checkbox"' + (done ? ' checked' : '') + (edit ? '' : ' disabled') + ' ' + attrs + '><span>' + label + '</span></label>'; }
    function draw() {
      var t = taskById(id); if (!t) { api.close(); return; }
      var f = firmById(t.firmId), step = t.stepId && f ? STAGE_META[t.stageIdx].name + ' checklist' : 'Standalone task';
      api.el.querySelector('h2').textContent = t.title;
      var sel = function (key, opts) { return '<select class="select select--inline" data-f="' + key + '"' + (edit ? '' : ' disabled') + '>' + opts + '</select>'; };
      api.body.innerHTML =
        '<div class="muted" style="margin:-4px 0 10px">' + esc(step) + (f ? ', <a href="firm.html?id=' + f.id + '">' + esc(f.name) + '</a>' : '') + '</div>' +
        '<dl class="facts">' +
        '<div><dt>Assignee</dt><dd>' + sel('assigneeId', userOptions(t.assigneeId, true)) + '</dd></div>' +
        '<div><dt>Team</dt><dd>' + sel('dept', selectOpts(DEPTS, t.dept)) + '</dd></div>' +
        '<div><dt>Priority</dt><dd>' + sel('priority', selectOpts(['High', 'Medium', 'Low'], t.priority)) + '</dd></div>' +
        '<div><dt>Status</dt><dd>' + (t.status === 'Awaiting approval' ? '<a class="pill pill--amber" href="approvals.html">Awaiting approval</a>' : sel('status', selectOpts(['Open', 'In progress', 'Blocked', 'Done'], t.status))) + '</dd></div>' +
        '<div><dt>Due</dt><dd><input type="date" class="input input--inline" data-f="due" value="' + t.due + '"' + (edit ? '' : ' disabled') + '> ' + (isOverdue(t) ? '<span class="pill pill--red"><span class="pill__dot"></span>Overdue</span>' : '') + '</dd></div></dl>' +
        (t.blockedOn ? '<div class="callout callout--amber">' + icon('alert') + '<div><strong>Waiting on ' + esc(t.blockedOn || 'another team') + '.</strong><div>' + esc(t.blockedReason || '') + '</div></div></div>' : '') +
        (t.desc ? '<h3 class="drawer-h">How to do it</h3><p>' + esc(t.desc) + '</p>' : '') +
        (t.subtasks.length ? '<h3 class="drawer-h">Steps <span class="muted">' + t.subtasks.filter(function (s) { return s.done; }).length + ' of ' + t.subtasks.length + ' done</span></h3>' + t.subtasks.map(function (s, i) { return chk(s.done, esc(s.t), 'data-sub="' + i + '"'); }).join('') : '') +
        '<h3 class="drawer-h">Activity</h3><div class="activity">' + t.comments.map(function (c) { return '<div class="activity__row">' + avatar(c.by, 28) + '<div><div class="muted"><strong>' + esc(userName(c.by)) + '</strong>, ' + ago(c.at) + '</div><div>' + esc(c.text) + '</div></div></div>'; }).join('') +
        '<div class="muted activity__note">Task created ' + fmtDate(t.createdAt) + (t.stepId ? ' from the ' + esc(STAGE_META[t.stageIdx].name) + ' checklist' : '') + '</div></div>' +
        (edit ? '<form id="cm-form" class="inline-form" style="margin-top:12px"><input id="cm-text" class="input" aria-label="Add a comment" placeholder="Add a comment" autocomplete="off"><button type="submit" class="btn btn--secondary">Comment</button></form>' : '') +
        '<div class="form-actions form-actions--split">' + (edit ? '<button type="button" class="btn btn--secondary" id="tk-block">Block on a team</button><button type="button" class="btn btn--primary" id="tk-complete">' + (t.status === 'Done' ? 'Reopen task' : icon('check', 16) + ' Mark done') + '</button>' : '<span class="muted">Your role can read this task but not change it.</span>') + '</div>';
      api.body.querySelectorAll('[data-f]').forEach(function (el) {
        el.addEventListener('change', function () {
          var k = el.getAttribute('data-f'), v = el.value;
          if (k === 'assigneeId') { t.assigneeId = v || null; if (v) { t.dept = userById(v).dept; pushNote(v, 'assigned', currentUser().name + ' assigned you "' + t.title + '".', 'tasks.html?task=' + t.id); } }
          else if (k === 'status') { if (v === 'Done') { completeTask(t, true); } else { t.status = v; t.doneAt = null; if (v !== 'Blocked') { t.blockedOn = ''; t.blockedReason = ''; } } }
          else if (k === 'due') { if (!v) return; t.due = v; } else { t[k] = v; }
          log('Updated "' + t.title + '"'); save(); App.refresh(); draw(); toast('Task updated');
        });
      });
      api.body.querySelectorAll('[data-sub]').forEach(function (el) { el.addEventListener('change', function () { t.subtasks[Number(el.getAttribute('data-sub'))].done = el.checked; save(); draw(); }); });
      var cf = api.body.querySelector('#cm-form');
      if (cf) cf.addEventListener('submit', function (e) { e.preventDefault(); var v = api.body.querySelector('#cm-text').value.trim(); if (!v) return; t.comments.push({ by: currentUser().id, at: new Date().toISOString(), text: v }); save(); draw(); });
      var bk = api.body.querySelector('#tk-block'); if (bk) bk.addEventListener('click', function () { openBlock(t, draw); });
      var dn = api.body.querySelector('#tk-complete'); if (dn) dn.addEventListener('click', function () { completeTask(t, t.status !== 'Done'); App.refresh(); draw(); toast(t.status === 'Done' ? 'Marked done' : 'Reopened'); });
    }
    draw();
  }

  /* ---------- page: Command Center ---------- */
  var CARD_TITLES = { due: 'Due today and overdue', overdue: 'Overdue by team', pipeline: 'Pipeline', queue: 'Onboarding queue', notes: 'Recent notes' };
  function factoryLayout() { return { left: ['due', 'overdue'], right: ['pipeline', 'queue', 'notes'], hidden: [] }; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function getLayout(uid) { if (!S.layouts[uid]) S.layouts[uid] = copy(factoryLayout()); return S.layouts[uid]; }
  function pageHome(main) {
    var u = currentUser(), L = getLayout(u.id), edit = !!main.__edit, scope = main.__scope || 'mine';
    var today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
    var mineNow = S.tasks.filter(function (t) { return t.assigneeId === u.id && isOpen(t) && dayDiff(t.due) <= 0; });
    var mineOver = mineNow.filter(isOverdue).length;
    function head(id, right) {
      return '<div class="panel__head"><h2>' + (edit ? '<span class="grip">' + icon('grip', 16) + '</span>' : '') + CARD_TITLES[id] + '</h2><div class="panel__tools">' + (right || '') + (edit ? cardTools(id) : '') + '</div></div>';
    }
    function cardTools(id) {
      var inLeft = L.left.indexOf(id) >= 0, col = inLeft ? L.left : L.right, i = col.indexOf(id);
      return '<span class="tools"><button type="button" class="icon-btn icon-btn--s" data-mv="up" data-card="' + id + '" aria-label="Move ' + CARD_TITLES[id] + ' up"' + (i === 0 ? ' disabled' : '') + '>' + icon('up', 16) + '</button>' +
        '<button type="button" class="icon-btn icon-btn--s" data-mv="down" data-card="' + id + '" aria-label="Move ' + CARD_TITLES[id] + ' down"' + (i === col.length - 1 ? ' disabled' : '') + '>' + icon('down', 16) + '</button>' +
        '<button type="button" class="icon-btn icon-btn--s" data-mv="side" data-card="' + id + '" aria-label="Move ' + CARD_TITLES[id] + ' to the ' + (inLeft ? 'right' : 'left') + ' column">' + icon(inLeft ? 'right' : 'left', 16) + '</button>' +
        '<button type="button" class="icon-btn icon-btn--s" data-mv="hide" data-card="' + id + '" aria-label="Hide ' + CARD_TITLES[id] + '">' + icon('x', 16) + '</button></span>';
    }
    var cards = {
      due: function () {
        var list = tasksIn(scope, u).filter(function (t) { return isOpen(t) && dayDiff(t.due) <= 0; }).sort(function (a, b) { return a.due < b.due ? -1 : (a.due > b.due ? 1 : 0); });
        var seg = '<div class="seg" role="tablist">' + [['mine', 'Mine'], ['team', 'My team'], ['all', 'All']].map(function (s) { return '<button type="button" role="tab" aria-selected="' + (scope === s[0]) + '" class="seg__b' + (scope === s[0] ? ' is-on' : '') + '" data-scope="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>';
        return '<section class="panel" data-card="due">' + head('due', seg) + (list.length ? '<ul class="rows">' + list.slice(0, 6).map(function (t) {
          return '<li class="rows__item"><button type="button" class="box' + (can('tasks.edit') ? '' : ' box--off') + '" data-done="' + t.id + '" aria-label="Mark ' + esc(t.title) + ' done"' + (can('tasks.edit') ? '' : ' disabled') + '></button>' +
            '<div class="grow"><a class="strong" href="tasks.html?task=' + t.id + '">' + esc(t.title) + '</a><div class="muted">' + (t.firmId ? '<a href="firm.html?id=' + t.firmId + '">' + esc(firmName(t.firmId)) + '</a> ' : '') + esc(t.dept) + '</div></div>' + dueLabel(t) + avatar(t.assigneeId, 28) + '</li>';
        }).join('') + '</ul>' + '<div class="panel__foot"><a class="btn btn--ghost btn--small" href="tasks.html?scope=' + scope + '">Show all ' + list.length + ' tasks</a></div>' : '<p class="panel__body muted">Nothing is due today or overdue in this view.</p>') + '</section>';
      },
      overdue: function () {
        var counts = DEPTS.map(function (d) { return [d, S.tasks.filter(function (t) { return t.dept === d && isOverdue(t); }).length]; }).filter(function (c) { return c[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; });
        var mx = counts.length ? counts[0][1] : 1, tot = counts.reduce(function (n, c) { return n + c[1]; }, 0);
        return '<section class="panel" data-card="overdue">' + head('overdue', '<span class="muted small">' + tot + ' overdue in all</span>') + (counts.length ? '<div class="bars">' + counts.map(function (c) {
          return '<a class="bar-row" href="tasks.html?dept=' + encodeURIComponent(c[0]) + '&due=overdue"><span>' + esc(c[0]) + '</span><span class="bar"><span style="width:' + Math.round(c[1] / mx * 100) + '%"></span></span><strong class="num">' + c[1] + '</strong></a>';
        }).join('') + '</div>' : '<p class="panel__body muted">No overdue tasks.</p>') + '</section>';
      },
      pipeline: function () {
        var mx = Math.max.apply(null, STAGE_META.map(function (m, i) { return visibleFirms().filter(function (f) { return f.stage === i; }).length; }).concat([1]));
        return '<section class="panel" data-card="pipeline">' + head('pipeline', '<a class="link small" href="pipeline.html">Open board</a>') + '<div class="stages">' + STAGE_META.map(function (m, i) {
          var fs = visibleFirms().filter(function (f) { return f.stage === i; }), avg = fs.length ? Math.round(fs.reduce(function (n, f) { return n + daysIn(f); }, 0) / fs.length) : 0, over = m.target && avg > m.target;
          return '<a class="stage-row" href="firms.html?stage=' + i + '"><span class="strong">' + m.name + '</span><span><span class="stage-bar" style="width:' + Math.max(8, Math.round(fs.length / mx * 100)) + '%;background:' + m.fill + '"></span><span class="small ' + (over ? 'red' : 'muted') + '">avg ' + avg + 'd' + (m.target ? ' of ' + m.target + 'd' : '') + '</span></span><strong class="num">' + fs.length + '</strong></a>';
        }).join('') + '</div></section>';
      },
      queue: function () {
        var fs = visibleFirms().filter(function (f) { return f.stage === 1; });
        return '<section class="panel" data-card="queue">' + head('queue') + (fs.length ? fs.map(function (f) {
          var p = progress(f), n = nextStep(f);
          return '<div class="queue"><div class="queue__top"><div><a class="strong" href="firm.html?id=' + f.id + '">' + esc(f.name) + '</a><div class="muted">Owner ' + esc(userName(f.ownerId)) + '</div></div>' + avatar(f.ownerId, 32) + '</div>' +
            '<div class="queue__bar"><span class="meter"><span style="width:' + Math.round((p.total ? p.done / p.total : 0) * 100) + '%;background:#D08A1E"></span></span><span class="small num">' + p.done + ' of ' + p.total + ' steps</span></div>' +
            (n ? '<div class="small"><span class="muted">Next step</span> <strong class="' + (isOverdue(n) ? 'red' : '') + '">' + esc(n.title) + '</strong></div>' : '<div class="small muted">All steps done.</div>') + '</div>';
        }).join('') : '<p class="panel__body muted">No firms are onboarding right now.</p>') + '</section>';
      },
      notes: function () {
        var ns = S.notes.slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 3);
        return '<section class="panel" data-card="notes">' + head('notes') + ns.map(function (n) {
          return '<div class="note-row">' + avatar(n.by, 30) + '<div><div class="small muted"><a class="strong" href="firm.html?id=' + n.firmId + '&tab=service">' + esc(firmName(n.firmId)) + '</a>, ' + ago(n.at) + '</div><div>' + esc(n.text) + '</div></div></div>';
        }).join('') + '</section>';
      }
    };
    var actions = subnav('cc', 'Command Center') + '<button type="button" class="btn btn--secondary" id="h-edit">' + icon('grip', 16) + (edit ? ' Done editing' : ' Edit layout') + '</button>' +
      '<button type="button" class="btn btn--secondary" id="h-default">Set as my default</button>' + (can('firms.create') ? '<button type="button" class="btn btn--primary" id="h-new">' + icon('plus', 16) + ' New firm</button>' : '');
    var hiddenBar = edit ? '<div class="hidden-cards"><span class="muted">Hidden cards:</span> ' + (L.hidden.length ? L.hidden.map(function (id) { return '<button type="button" class="chip-btn" data-show="' + id + '">' + icon('plus', 14) + ' ' + CARD_TITLES[id] + '</button>'; }).join(' ') : '<span class="muted">None</span>') + ' <button type="button" class="link-btn" id="h-reset">Reset layout</button></div>' : '';
    main.innerHTML = pageHead('Good ' + (new Date().getHours() < 12 ? 'morning' : (new Date().getHours() < 18 ? 'afternoon' : 'evening')) + ', ' + esc(u.name.split(' ')[0]), today + '. ' + (mineNow.length ? mineNow.length + (mineNow.length === 1 ? ' task needs' : ' tasks need') + ' you today' + (mineOver ? ', and ' + mineOver + ' of them ' + (mineOver === 1 ? 'is' : 'are') + ' overdue.' : '.') : 'Nothing is due for you today.'), actions) + hiddenBar +
      '<div class="cols"><div class="col">' + L.left.map(function (id) { return cards[id](); }).join('') + '</div><div class="col">' + L.right.map(function (id) { return cards[id](); }).join('') + '</div></div>';
    main.querySelector('#h-edit').addEventListener('click', function () { main.__edit = !main.__edit; App.refresh(); });
    main.querySelector('#h-default').addEventListener('click', function () { if (!S.layoutSaved) S.layoutSaved = {}; S.layoutSaved[u.id] = copy(L); save(); toast('Saved as your default view'); });
    var nb = main.querySelector('#h-new'); if (nb) nb.addEventListener('click', openNewFirm);
    var rs = main.querySelector('#h-reset'); if (rs) rs.addEventListener('click', function () { S.layouts[u.id] = copy((S.layoutSaved && S.layoutSaved[u.id]) || factoryLayout()); save(); App.refresh(); toast('Layout reset'); });
    main.querySelectorAll('[data-show]').forEach(function (b) { b.addEventListener('click', function () { var id = b.getAttribute('data-show'); L.hidden = L.hidden.filter(function (x) { return x !== id; }); (L.right.length <= L.left.length ? L.right : L.left).push(id); save(); App.refresh(); }); });
    main.querySelectorAll('[data-mv]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-card'), kind = b.getAttribute('data-mv'), inLeft = L.left.indexOf(id) >= 0, col = inLeft ? L.left : L.right, i = col.indexOf(id);
        if (kind === 'up' && i > 0) { col.splice(i, 1); col.splice(i - 1, 0, id); }
        else if (kind === 'down' && i < col.length - 1) { col.splice(i, 1); col.splice(i + 1, 0, id); }
        else if (kind === 'side') { col.splice(i, 1); (inLeft ? L.right : L.left).push(id); }
        else if (kind === 'hide') { col.splice(i, 1); L.hidden.push(id); }
        save(); App.refresh();
      });
    });
    main.querySelectorAll('[data-scope]').forEach(function (b) { b.addEventListener('click', function () { main.__scope = b.getAttribute('data-scope'); App.refresh(); }); });
    main.querySelectorAll('[data-done]').forEach(function (b) { b.addEventListener('click', function () { completeTask(taskById(b.getAttribute('data-done')), true); App.refresh(); toast('Marked done'); }); });
  }

  /* ---------- page: Firms ---------- */
  var PAGE_SIZE = 10;
  function allLicenses() { var set = {}; S.advisors.forEach(function (a) { if (a.licenses && a.licenses !== 'No license needed') a.licenses.split(',').forEach(function (l) { set[l.trim()] = 1; }); }); return Object.keys(set).sort(); }
  function applyFirmFilters(f, u) {
    var q = (f.q || '').trim().toLowerCase();
    return visibleFirms().filter(function (x) {
      if (f.stage !== 'all' && String(x.stage) !== String(f.stage)) return false;
      if (f.dept !== 'all' && x.dept !== f.dept) return false;
      if (f.owner !== 'all' && (f.owner === 'none' ? x.ownerId : x.ownerId !== f.owner)) return false;
      if (f.state !== 'all' && x.state !== f.state) return false;
      if (f.lic !== 'all' && !firmAdvisors(x).some(function (a) { return a.licenses.split(',').map(function (l) { return l.trim(); }).indexOf(f.lic) >= 0; })) return false;
      if (f.overdueMine && !S.tasks.some(function (t) { return t.firmId === x.id && t.assigneeId === u.id && isOverdue(t); })) return false;
      if (q) {
        var hay = [x.name, x.city, x.state, userName(x.ownerId), STAGE_META[x.stage].name].concat(firmRepCodes(x)).concat(firmAdvisors(x).map(function (a) { return a.name + ' ' + a.licenses; })).join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  function pageFirms(main) {
    var u = currentUser(), P = params();
    var f = main.__f;
    if (!f) {
      f = main.__f = { q: P.get('q') || '', stage: P.get('stage') == null ? 'all' : P.get('stage'), dept: 'all', owner: 'all', state: 'all', lic: 'all', overdueMine: false, view: 'all', sort: 'name', dir: 1, page: 0, sel: P.get('sel') || '' };
      var vid = P.get('view'), v = vid && S.savedViews.filter(function (x) { return x.id === vid; })[0];
      if (v) { f.view = v.id; ['q', 'stage', 'dept', 'owner', 'state', 'lic'].forEach(function (k) { if (v.f[k] != null) f[k] = v.f[k]; }); f.overdueMine = !!v.f.overdueMine; }
    }
    var list = applyFirmFilters(f, u);
    var key = { name: function (x) { return x.name.toLowerCase(); }, stage: function (x) { return x.stage * 1000 - daysIn(x); }, owner: function (x) { return userName(x.ownerId).toLowerCase(); }, adv: function (x) { return firmAdvisors(x).length; }, check: function (x) { var p = progress(x); return p.total ? p.done / p.total : 0; } }[f.sort];
    list.sort(function (a, b) { var A = key(a), B = key(b); return (A < B ? -1 : A > B ? 1 : 0) * f.dir; });
    var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE)); if (f.page >= pages) f.page = pages - 1;
    var show = list.slice(f.page * PAGE_SIZE, f.page * PAGE_SIZE + PAGE_SIZE);
    var sel = firmById(f.sel); if (!sel || list.indexOf(sel) < 0) sel = show[0] || null;
    var tabs = [{ id: 'all', name: 'All firms', f: {} }].concat(S.savedViews);
    function tabCount(v) { var ff = { q: '', stage: 'all', dept: 'all', owner: 'all', state: 'all', lic: 'all', overdueMine: false }; for (var k in v.f) ff[k] = v.f[k]; return applyFirmFilters(ff, u).length; }
    var owners = S.users.filter(function (x) { return S.firms.some(function (fm) { return fm.ownerId === x.id; }); });
    var states = S.firms.map(function (x) { return x.state; }).filter(function (s, i, a) { return a.indexOf(s) === i; }).sort();
    function th(label, k, cls) { var on = f.sort === k; return '<th' + (cls ? ' class="' + cls + '"' : '') + ' aria-sort="' + (on ? (f.dir === 1 ? 'ascending' : 'descending') : 'none') + '"><button type="button" class="th-btn" data-sort="' + k + '">' + label + (on ? '<span class="sort">' + icon(f.dir === 1 ? 'up' : 'down', 13) + '</span>' : '') + '</button></th>'; }
    function quick(x) {
      if (!x) return '<aside class="panel quick"><p class="panel__body muted">No firm selected.</p></aside>';
      var codes = firmRepCodes(x), lic = {}; firmAdvisors(x).forEach(function (a) { if (a.licenses !== 'No license needed') a.licenses.split(',').forEach(function (l) { lic[l.trim()] = 1; }); });
      return '<aside class="panel quick" aria-label="Quick view of ' + esc(x.name) + '"><div class="quick__body"><div class="quick__name">' + esc(x.name) + '</div><div class="quick__meta">' + stagePill(x.stage) + '<span class="muted small">' + daysIn(x) + ' days in stage</span></div>' +
        '<div class="quick__facts">' + (x.address ? '<div>' + icon('pin', 16) + '<span>' + esc(x.address) + '</span></div>' : '') + (x.phone ? '<div>' + icon('phone', 16) + '<span>' + esc(x.phone) + '</span></div>' : '') + (x.website ? '<div>' + icon('link', 16) + '<span>' + esc(x.website) + '</span></div>' : '') + '</div>' +
        '<h3>Rep codes</h3><div class="codes">' + (codes.length ? codes.slice(0, 6).map(function (c, i) { return '<span class="code' + (i === 0 ? ' code--main' : '') + '">' + esc(c) + '</span>'; }).join('') + (codes.length > 6 ? '<span class="muted small">+' + (codes.length - 6) + ' more</span>' : '') : '<span class="muted">None yet</span>') + '</div>' +
        '<h3>Licenses and registrations</h3><div>' + (Object.keys(lic).length ? esc(Object.keys(lic).sort().join(', ')) : '<span class="muted">None recorded</span>') + '</div>' +
        '<h3>Key contacts</h3>' + (x.contacts.length ? x.contacts.map(function (c) { return '<div class="contact"><span class="avatar" style="width:30px;height:30px;background:#E3E8ED;color:#1B2A3A;font-size:12px">' + initials(c.name) + '</span><div><strong>' + esc(c.name) + '</strong><div class="muted small">' + esc(c.title) + '</div></div></div>'; }).join('') : '<span class="muted">None yet</span>') +
        '</div><div class="quick__foot"><a class="btn btn--primary" href="firm.html?id=' + x.id + '">Open firm</a>' + (can('notes.add') ? '<button type="button" class="btn btn--secondary" id="q-note">Log a note</button>' : '') + '</div></aside>';
    }
    main.innerHTML = pageHead('Firms', visibleFirms().length + ' firms with ' + visibleAdvisors().length + ' advisors and staff. Search finds names, rep codes, and licenses.',
      subnav('firms', 'Firms') + '<button type="button" class="btn btn--secondary" id="fm-export">' + icon('download', 16) + ' Export CSV</button>' + (can('firms.create') ? '<button type="button" class="btn btn--primary" id="fm-new">' + icon('plus', 16) + ' New firm</button>' : '')) +
      '<div class="tabs" role="tablist">' + tabs.map(function (v) {
        var on = f.view === v.id; return '<span class="tab' + (on ? ' is-on' : '') + '"><button type="button" role="tab" aria-selected="' + on + '" data-view="' + v.id + '">' + esc(v.name) + ' <span class="count">' + (v.id === 'all' ? S.firms.length : tabCount(v)) + '</span></button>' + (!v.builtin && v.id !== 'all' ? '<button type="button" class="tab__x" data-delview="' + v.id + '" aria-label="Delete the view ' + esc(v.name) + '">' + icon('x', 13) + '</button>' : '') + '</span>';
      }).join('') + '<button type="button" class="link-btn tabs__save" id="fm-save">Save this view</button></div>' +
      '<div class="filters"><div class="search search--inline"><span class="search__ic">' + icon('search', 16) + '</span><label for="f-q" class="sr-only">Search firms</label><input id="f-q" class="input" placeholder="Search firms, advisors, rep codes, licenses" autocomplete="off" value="' + esc(f.q) + '"></div>' +
      '<label class="sr-only" for="f-stage">Stage</label><select id="f-stage" class="select select--chip">' + selectOpts(STAGE_META.map(function (m, i) { return [String(i), m.name]; }), f.stage, 'All stages') + '</select>' +
      '<label class="sr-only" for="f-dept">Team</label><select id="f-dept" class="select select--chip">' + selectOpts(['Relationship Ops', 'Client Service'], f.dept, 'All teams') + '</select>' +
      '<label class="sr-only" for="f-owner">Owner</label><select id="f-owner" class="select select--chip">' + selectOpts(owners.map(function (o) { return [o.id, o.name]; }), f.owner, 'All owners') + '</select>' +
      '<label class="sr-only" for="f-state">State</label><select id="f-state" class="select select--chip">' + selectOpts(states, f.state, 'All states') + '</select>' +
      '<label class="sr-only" for="f-lic">License</label><select id="f-lic" class="select select--chip">' + selectOpts(allLicenses(), f.lic, 'All licenses') + '</select>' +
      (f.overdueMine ? '<span class="pill pill--red">Only firms with my overdue tasks</span>' : '') + '<button type="button" class="link-btn" id="f-clear">Clear filters</button></div>' +
      '<div class="firms-grid"><section class="panel table-panel"><div class="table-wrap"><table class="table table--firms"><thead><tr>' + th('Firm', 'name') + th('Stage', 'stage') + th('Owner', 'owner') + th('People', 'adv', 'r') + '<th>Rep codes</th>' + th('Next step', 'check') + '</tr></thead><tbody>' +
      (show.length ? show.map(function (x) {
        var codes = firmRepCodes(x), p = progress(x), n = nextStep(x), d = daysIn(x);
        return '<tr class="' + (sel && sel.id === x.id ? 'is-sel' : '') + '" data-row="' + x.id + '" tabindex="0" aria-selected="' + (sel && sel.id === x.id) + '"><td><a class="strong" href="firm.html?id=' + x.id + '">' + esc(x.name) + '</a><span class="cell-sub">' + esc(x.city) + ', ' + esc(x.state) + '</span></td>' +
          '<td>' + ribbon(x.stage, true) + '<div class="strong small" style="color:' + STAGE_META[x.stage].text + ';margin-top:4px">' + STAGE_META[x.stage].name + '</div><div class="small ' + (overTarget(x) ? 'red' : 'muted') + '">' + d + 'd in stage</div></td>' +
          '<td><div class="who">' + avatar(x.ownerId, 24) + '<span>' + esc(userName(x.ownerId).split(' ')[0]) + '</span></div></td><td class="r num">' + firmAdvisors(x).length + '</td><td class="nowrap"><span class="mono">' + esc(codes[0] || 'None') + '</span>' + (codes.length > 1 ? '<span class="cell-sub">+' + (codes.length - 1) + ' more</span>' : '') + '</td>' +
          '<td>' + (n ? '<span class="' + (isOverdue(n) ? 'red' : '') + '">' + esc(n.title) + '</span>' : '<span class="muted">All steps done</span>') + '<span class="cell-sub num">' + p.done + ' of ' + p.total + ' steps done</span></td></tr>';
      }).join('') : '<tr><td colspan="6" class="empty">No firms match. Clear the filters or try a different search.</td></tr>') + '</tbody></table></div>' +
      '<div class="pager"><span class="muted">' + (list.length ? 'Showing ' + (f.page * PAGE_SIZE + 1) + ' to ' + Math.min(list.length, (f.page + 1) * PAGE_SIZE) + ' of ' + list.length + ' firms' : 'No firms') + '</span><span class="btn-row"><button type="button" class="btn btn--secondary btn--small" id="pg-prev"' + (f.page === 0 ? ' disabled' : '') + '>Previous</button><button type="button" class="btn btn--secondary btn--small" id="pg-next"' + (f.page >= pages - 1 ? ' disabled' : '') + '>Next</button></span></div></section>' + quick(sel) + '</div>';
    function again() { App.refresh(); }
    function bindSel(id, k) { main.querySelector(id).addEventListener('change', function (e) { f[k] = e.target.value; f.page = 0; f.view = 'custom'; again(); }); }
    var qi = main.querySelector('#f-q');
    qi.addEventListener('input', function () { f.q = qi.value; f.page = 0; f.view = 'custom'; var pos = qi.selectionStart; again(); var n = main.querySelector('#f-q'); n.focus(); n.setSelectionRange(pos, pos); });
    bindSel('#f-stage', 'stage'); bindSel('#f-dept', 'dept'); bindSel('#f-owner', 'owner'); bindSel('#f-state', 'state'); bindSel('#f-lic', 'lic');
    main.querySelector('#f-clear').addEventListener('click', function () { main.__f = null; history.replaceState(null, '', 'firms.html'); again(); });
    main.querySelectorAll('[data-sort]').forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-sort'); if (f.sort === k) f.dir = -f.dir; else { f.sort = k; f.dir = 1; } again(); }); });
    main.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-view'), v = S.savedViews.filter(function (x) { return x.id === id; })[0];
        f.q = ''; f.stage = 'all'; f.dept = 'all'; f.owner = 'all'; f.state = 'all'; f.lic = 'all'; f.overdueMine = false; f.page = 0; f.view = id;
        if (v) { for (var k in v.f) { if (k === 'overdueMine') f.overdueMine = !!v.f[k]; else f[k] = v.f[k]; } }
        again();
      });
    });
    main.querySelectorAll('[data-delview]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-delview'), v = S.savedViews.filter(function (x) { return x.id === id; })[0];
        confirmDialog({ title: 'Delete the view "' + v.name + '"?', description: 'The firms are not affected.', confirmLabel: 'Delete view', danger: true, onConfirm: function () { S.savedViews = S.savedViews.filter(function (x) { return x.id !== id; }); if (f.view === id) f.view = 'all'; save(); renderChrome(); again(); toast('View deleted'); } });
      });
    });
    main.querySelector('#fm-save').addEventListener('click', function () {
      var api = dialog({ title: 'Save this view', description: 'It keeps the search and filters you have set, and appears in the sidebar.',
        body: '<form id="sv-form" novalidate>' + field('sv-name', 'Name', '<input id="sv-name" class="input" autocomplete="off">') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Save view</button></div></form>' });
      api.body.querySelector('#sv-name').focus(); api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
      api.body.querySelector('#sv-form').addEventListener('submit', function (e) {
        e.preventDefault(); var name = api.body.querySelector('#sv-name').value.trim();
        if (!name) { setError('sv-name', 'Give the view a name.'); return; }
        if (S.savedViews.some(function (v) { return v.name.toLowerCase() === name.toLowerCase(); })) { setError('sv-name', 'A view with this name already exists.'); return; }
        var id = nextId('v'); S.savedViews.push({ id: id, name: name, f: { q: f.q, stage: f.stage, dept: f.dept, owner: f.owner, state: f.state, lic: f.lic, overdueMine: f.overdueMine } });
        f.view = id; save(); api.close(); renderChrome(); again(); toast('View saved');
      });
    });
    main.querySelectorAll('[data-row]').forEach(function (r) {
      function pick() { f.sel = r.getAttribute('data-row'); again(); }
      r.addEventListener('click', function (e) { if (e.target.closest('a')) return; pick(); });
      r.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.target.closest('a')) pick(); });
    });
    main.querySelector('#pg-prev').addEventListener('click', function () { f.page = Math.max(0, f.page - 1); again(); });
    main.querySelector('#pg-next').addEventListener('click', function () { f.page += 1; again(); });
    var nf = main.querySelector('#fm-new'); if (nf) nf.addEventListener('click', openNewFirm);
    var qn = main.querySelector('#q-note'); if (qn && sel) qn.addEventListener('click', function () { openNote(sel.id); });
    main.querySelector('#fm-export').addEventListener('click', function () {
      var rows = [['Firm', 'City', 'State', 'Stage', 'Days in stage', 'Owner', 'Advisors and staff', 'Rep codes', 'Next step', 'Checklist done', 'Checklist total']].concat(list.map(function (x) { var p = progress(x), n = nextStep(x); return [x.name, x.city, x.state, STAGE_META[x.stage].name, daysIn(x), userName(x.ownerId), firmAdvisors(x).length, firmRepCodes(x).join(' '), n ? n.title : '', p.done, p.total]; }));
      download('firms.csv', csv(rows), 'text/csv'); toast('Exported ' + list.length + ' firms');
    });
  }

  /* ---------- page: Firm detail ---------- */
  function openEditFirm(f) {
    var api = dialog({ title: 'Edit profile', description: f.name,
      body: '<form id="ef-form" novalidate>' + field('ef-name', 'Firm name', '<input id="ef-name" class="input" value="' + esc(f.name) + '">') +
        '<div class="two">' + field('ef-city', 'City', '<input id="ef-city" class="input" value="' + esc(f.city) + '">') + field('ef-state', 'State', '<input id="ef-state" class="input" maxlength="2" value="' + esc(f.state) + '">') + '</div>' +
        field('ef-addr', 'Address', '<input id="ef-addr" class="input" value="' + esc(f.address) + '">') + '<div class="two">' + field('ef-phone', 'Phone', '<input id="ef-phone" class="input" value="' + esc(f.phone) + '">') + field('ef-web', 'Website', '<input id="ef-web" class="input" value="' + esc(f.website) + '">') + '</div>' +
        '<div class="two">' + field('ef-owner', 'Owner', '<select id="ef-owner" class="select">' + userOptions(f.ownerId, true) + '</select>') + field('ef-aum', 'Assets under management', '<input id="ef-aum" class="input" value="' + esc(f.aum) + '">') + '</div>' +
        customInputs('firm', f) + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Save profile</button></div></form>' });
    var b = api.body; b.querySelector('[data-cancel]').addEventListener('click', api.close);
    b.querySelector('#ef-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = b.querySelector('#ef-name').value.trim(), st = b.querySelector('#ef-state').value.trim().toUpperCase(), city = b.querySelector('#ef-city').value.trim(), bad = false;
      setError('ef-name', name ? '' : 'Enter the firm name.'); if (!name) bad = true;
      setError('ef-city', city ? '' : 'Enter the city.'); if (!city) bad = true;
      setError('ef-state', /^[A-Z]{2}$/.test(st) ? '' : 'Use the 2-letter state code.'); if (!/^[A-Z]{2}$/.test(st)) bad = true;
      if (bad) return;
      f.name = name; f.city = city; f.state = st; f.address = b.querySelector('#ef-addr').value.trim(); f.phone = b.querySelector('#ef-phone').value.trim(); f.website = b.querySelector('#ef-web').value.trim();
      var newOwner = b.querySelector('#ef-owner').value || null; if (newOwner !== f.ownerId) { addNote(f.id, 'handoff', currentUser().id, 'Owner changed from ' + userName(f.ownerId) + ' to ' + userName(newOwner) + '.'); f.ownerId = newOwner; }
      f.aum = b.querySelector('#ef-aum').value.trim() || f.aum; saveCustom(f, b); log('Edited the profile of ' + f.name); save(); api.close(); App.refresh(); toast('Profile saved');
    });
  }
  function openAdvisor(f, a) {
    var isNew = !a, canRep = can('rep.edit'), canLic = can('license.edit');
    var cur = a || { name: '', role: 'Advisor', age: 40, gender: 'Female', city: f.city, officeStaff: 0, repCode: '', licenses: canLic ? 'Series 65' : 'Not yet recorded' };
    var api = dialog({ title: isNew ? 'Add an advisor or staff member' : 'Edit ' + cur.name, description: f.name,
      body: '<form id="ad-form" novalidate>' + field('ad-name', 'Full name', '<input id="ad-name" class="input" value="' + esc(cur.name) + '">') +
        '<div class="two">' + field('ad-role', 'Role', '<select id="ad-role" class="select">' + selectOpts(['Lead advisor', 'Advisor', 'Operations', 'Compliance officer', 'Assistant'], cur.role) + '</select>') + field('ad-gender', 'Gender', '<select id="ad-gender" class="select">' + selectOpts(['Female', 'Male', 'Another gender'], cur.gender) + '</select>') + '</div>' +
        '<div class="two">' + field('ad-age', 'Age', '<input id="ad-age" type="number" min="18" max="99" class="input" value="' + cur.age + '">') + field('ad-staff', 'Office staff', '<input id="ad-staff" type="number" min="0" max="99" class="input" value="' + cur.officeStaff + '">') + '</div>' +
        field('ad-city', 'City', '<input id="ad-city" class="input" value="' + esc(cur.city) + '">') +
        '<div class="two">' + field('ad-rep', 'Rep code', '<input id="ad-rep" class="input mono"' + (canRep ? '' : ' disabled') + ' value="' + esc(cur.repCode) + '">', canRep ? '' : 'Your role cannot change rep codes.') +
        field('ad-lic', 'Licenses', '<input id="ad-lic" class="input"' + (canLic ? '' : ' disabled') + ' value="' + esc(cur.licenses) + '">', canLic ? 'Separate with commas.' : 'Only Compliance can change licenses.') + '</div>' +
        customInputs('advisor', cur) + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">' + (isNew ? 'Add to firm' : 'Save changes') + '</button></div></form>' });
    var b = api.body; b.querySelector('[data-cancel]').addEventListener('click', api.close); b.querySelector('#ad-name').focus();
    b.querySelector('#ad-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = b.querySelector('#ad-name').value.trim(), age = Number(b.querySelector('#ad-age').value), staff = Number(b.querySelector('#ad-staff').value), bad = false;
      setError('ad-name', name ? '' : 'Enter the name.'); if (!name) bad = true;
      setError('ad-age', age >= 18 && age <= 99 ? '' : 'Enter an age from 18 to 99.'); if (!(age >= 18 && age <= 99)) bad = true;
      setError('ad-staff', staff >= 0 ? '' : 'Enter 0 or more.'); if (!(staff >= 0)) bad = true;
      if (bad) { b.querySelector('[aria-invalid="true"]').focus(); return; }
      var rep = canRep ? b.querySelector('#ad-rep').value.trim() : cur.repCode;
      var rec = a || { id: nextId('a'), firmId: f.id, state: f.state };
      rec.name = name; rec.role = b.querySelector('#ad-role').value; rec.gender = b.querySelector('#ad-gender').value; rec.age = age; rec.officeStaff = staff; rec.city = b.querySelector('#ad-city').value.trim() || f.city;
      rec.repCode = rep; rec.licenses = canLic ? (b.querySelector('#ad-lic').value.trim() || 'No license needed') : cur.licenses;
      saveCustom(rec, b);
      if (isNew) S.advisors.push(rec);
      log((isNew ? 'Added ' : 'Updated ') + name + ' at ' + f.name); save(); api.close(); App.refresh(); toast(isNew ? 'Added to ' + f.name : 'Changes saved');
    });
  }
  function openChooseStage(f) {
    var api = dialog({ title: 'Move ' + f.name, description: 'Choose the stage to move it to. You confirm on the next step.',
      body: '<div class="stage-pick">' + STAGE_META.map(function (m, i) { return '<button type="button" class="stage-pick__b" data-to="' + i + '"' + (i === f.stage ? ' disabled' : '') + ' style="border-left-color:' + m.fill + '"><strong>' + m.name + '</strong><span class="muted small">' + (i === f.stage ? 'Current stage' : S.stages[i].steps.length + ' steps') + '</span></button>'; }).join('') + '</div><div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button></div>' });
    api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
    api.body.querySelectorAll('[data-to]').forEach(function (b) { b.addEventListener('click', function () { api.close(); openMove(f, Number(b.getAttribute('data-to'))); }); });
  }
  function pageFirm(main) {
    var P = params(), f = firmById(P.get('id'));
    if (!f) { main.innerHTML = pageHead('Firm not found', 'It may have been removed.', '<a class="btn btn--primary" href="firms.html">Back to Firms</a>'); return; }
    var tab = main.__tab || P.get('tab') || 'overview'; main.__tab = tab;
    document.title = f.name + ' | Arkadios workspace';
    var owner = userById(f.ownerId), tasks = S.tasks.filter(function (t) { return t.firmId === f.id; }), advs = firmAdvisors(f), tgt = STAGE_META[f.stage].target, d = daysIn(f);
    var ribCols = STAGE_META.map(function (m, k) {
      var sub, h = S.firms && f.history.filter(function (x) { return x.stage === k; })[0];
      if (k < f.stage) sub = h ? 'Done in ' + Math.max(1, Math.round((new Date(h.to) - new Date(h.from)) / 864e5)) + ' days' : 'Done';
      else if (k === f.stage) sub = tgt ? 'Day ' + d + ' of ' + tgt : 'Day ' + d;
      else sub = k === f.stage + 1 ? 'Next' : 'Not started';
      return '<div class="lc"><span class="lc__bar' + (k === f.stage ? ' is-current' : '') + '" style="background:' + (k <= f.stage ? m.fill : '#E3E8ED') + '"></span><div class="lc__name' + (k > f.stage ? ' muted' : '') + '">' + m.name + '</div><div class="small" style="color:' + (k === f.stage ? m.text : '#566472') + '">' + sub + '</div></div>';
    }).join('');
    var health = tgt ? (d > tgt ? '<span class="pill pill--red"><span class="pill__dot"></span>Over target by ' + (d - tgt) + ' days</span>' : '<span class="pill pill--green"><span class="pill__dot"></span>On track, ' + (tgt - d) + ' days left in this stage</span>') : '<span class="pill pill--blue"><span class="pill__dot"></span>Ongoing relationship</span>';
    var tabs = [['overview', 'Overview'], ['advisors', 'Advisors and staff', advs.length], ['service', 'Lifetime and service'], ['workstreams', 'Workstreams'], ['tasks', 'Tasks', tasks.filter(isOpen).length], ['documents', 'Documents', S.documents.filter(function (d) { return d.firmId === f.id; }).length]];
    var body = '';
    if (tab === 'overview') body = tabOverview(f, owner, advs);
    else if (tab === 'advisors') body = tabAdvisors(f, advs, P.get('adv'), main);
    else if (tab === 'service') body = tabService(f, main);
    else if (tab === 'workstreams') body = tabWork(f, tasks);
    else if (tab === 'documents') body = tabDocs(f);
    else body = tabTasks(f, tasks, main);
    main.innerHTML = '<div class="crumb"><a href="firms.html">Firms</a> / ' + esc(f.name) + '</div>' +
      '<div class="firm-head"><div><div class="firm-title"><h1>' + esc(f.name) + '</h1>' + stagePill(f.stage) + '</div><div class="firm-meta"><span>' + icon('pin', 15) + esc(f.city) + ', ' + esc(f.state) + '</span><span class="muted">Assets under management <strong class="ink">' + esc(f.aum) + '</strong></span><span class="muted">' + esc(f.dept) + '</span><span class="who muted">Owner ' + avatar(owner, 24) + '<strong class="ink">' + esc(userName(f.ownerId)) + '</strong></span></div></div>' +
      '<div class="btn-row">' + (can('tasks.create') ? '<button type="button" class="btn btn--secondary" id="fd-task">' + icon('plus', 16) + ' Add task</button>' : '') + (can('notes.add') ? '<button type="button" class="btn btn--secondary" id="fd-note">Log a note</button>' : '') + (can('pipeline.move') ? '<button type="button" class="btn btn--primary" id="fd-move">Move to stage</button>' : '') + '</div></div>' +
      '<section class="panel lifecycle"><div class="lifecycle__head"><h2>Lifecycle</h2>' + health + '</div><div class="lifecycle__cols">' + ribCols + '</div></section>' +
      '<div class="tabs" role="tablist">' + tabs.map(function (t) { var on = tab === t[0]; return '<span class="tab' + (on ? ' is-on' : '') + '"><button type="button" role="tab" aria-selected="' + on + '" data-tab="' + t[0] + '">' + t[1] + (t[2] != null ? ' <span class="count">' + t[2] + '</span>' : '') + '</button></span>'; }).join('') + '</div>' + body;
    main.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { main.__tab = b.getAttribute('data-tab'); var q = params(); q.set('tab', main.__tab); q.delete('adv'); history.replaceState(null, '', 'firm.html?' + q.toString()); App.refresh(); }); });
    var ft = main.querySelector('#fd-task'); if (ft) ft.addEventListener('click', function () { openNewTask({ firmId: f.id }); });
    var fn = main.querySelector('#fd-note'); if (fn) fn.addEventListener('click', function () { openNote(f.id); });
    var fm = main.querySelector('#fd-move'); if (fm) fm.addEventListener('click', function () { openChooseStage(f); });
    bindFirmTab(f, main);
  }
  function tabOverview(f, owner, advs) {
    var codes = firmRepCodes(f), lic = {}; advs.forEach(function (a) { if (a.licenses !== 'No license needed' && a.licenses !== 'Not yet recorded') a.licenses.split(',').forEach(function (l) { lic[l.trim()] = (lic[l.trim()] || 0) + 1; }); });
    var n = nextStep(f);
    function kv(k, v) { return '<div class="kv"><span class="muted">' + k + '</span><span>' + v + '</span></div>'; }
    return '<div class="cols cols--even"><div class="col">' +
      '<section class="panel"><div class="panel__head"><h2>Firm profile</h2>' + (can('firms.edit') ? '<button type="button" class="btn btn--secondary btn--small" id="fd-edit">Edit profile</button>' : '') + '</div><div class="panel__body">' +
      kv('Address', esc(f.address || 'Not recorded')) + kv('Phone', esc(f.phone || 'Not recorded')) + kv('Website', esc(f.website || 'Not recorded')) + kv('Team', esc(f.dept)) + kv('Owner', esc(userName(f.ownerId))) + kv('Next step', n ? esc(n.title) + (isOverdue(n) ? ' <span class="pill pill--red">Overdue</span>' : '') : 'All steps done') + customRows(f, 'firm') + externalRows(f) + '</div></section>' +
      '<section class="panel"><div class="panel__head"><h2>Key contacts</h2></div>' + (f.contacts.length ? f.contacts.map(function (c) { return '<div class="note-row"><span class="avatar" style="width:34px;height:34px;background:#E3E8ED;color:#1B2A3A">' + initials(c.name) + '</span><div><strong>' + esc(c.name) + '</strong><div class="muted small">' + esc(c.title) + ', ' + esc(c.email) + '</div></div></div>'; }).join('') : '<p class="panel__body muted">No contacts recorded yet.</p>') + '</section></div>' +
      '<div class="col"><section class="panel"><div class="panel__head"><h2>Rep codes and licenses</h2></div><div class="panel__body"><h3 class="h3">Rep codes <span class="muted">' + codes.length + '</span></h3><div class="codes">' + (codes.length ? codes.slice(0, 12).map(function (c, i) { return '<span class="code' + (i === 0 ? ' code--main' : '') + '">' + esc(c) + '</span>'; }).join('') + (codes.length > 12 ? '<span class="muted small">+' + (codes.length - 12) + ' more, see Advisors and staff</span>' : '') : '<span class="muted">None yet</span>') + '</div>' +
      '<h3 class="h3" style="margin-top:16px">Licenses held</h3>' + (Object.keys(lic).length ? Object.keys(lic).sort().map(function (l) { return '<div class="kv"><span>' + esc(l) + '</span><span class="muted">' + lic[l] + (lic[l] === 1 ? ' person' : ' people') + '</span></div>'; }).join('') : '<span class="muted">None recorded</span>') + '</div></section>' +
      aiPanel(f) + (can('billing.view') ? '<section class="panel"><div class="panel__head"><h2>Billing details</h2><span class="pill pill--gray">' + icon('lock', 13) + ' Restricted</span></div><div class="panel__body">' + kv('Bank details', esc(f.billing.ach)) + kv('W-9', esc(f.billing.w9)) + kv('Funds received', f.fundsAt ? fmtDate(f.fundsAt) : 'Not yet') +
        (can('funds.record') && !f.fundsAt ? '<div class="form-actions" style="margin-top:12px"><button type="button" class="btn btn--secondary" id="fd-funds">Record funds received</button></div>' : '') + '</div></section>' : '') + '</div></div>';
  }
  function tabAdvisors(f, advs, hl, main) {
    var q = (main.__advq || '').toLowerCase();
    var list = advs.filter(function (a) { return !q || (a.name + ' ' + a.repCode + ' ' + a.licenses + ' ' + a.role + ' ' + a.city).toLowerCase().indexOf(q) >= 0; });
    return '<section class="panel"><div class="panel__head"><h2>Advisors and staff</h2><div class="btn-row"><div class="search search--inline search--small"><span class="search__ic">' + icon('search', 16) + '</span><label for="av-q" class="sr-only">Search this firm\'s people</label><input id="av-q" class="input" placeholder="Search name, rep code, license" value="' + esc(main.__advq || '') + '" autocomplete="off"></div>' +
      (can('advisors.edit') ? '<button type="button" class="btn btn--primary btn--small" id="av-add">' + icon('plus', 15) + ' Add person</button>' : '') + '</div></div><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Role</th><th>Rep code</th><th>Licenses</th><th>City</th><th class="r">Office staff</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      (list.length ? list.map(function (a) {
        return '<tr' + (hl === a.id ? ' class="is-sel"' : '') + '><td><strong>' + esc(a.name) + '</strong></td><td>' + esc(a.role) + '</td><td class="mono">' + esc(a.repCode || 'n/a') + '</td><td>' + esc(a.licenses) + '</td><td>' + esc(a.city) + ', ' + esc(a.state) + '</td><td class="r num">' + a.officeStaff + '</td><td>' + (can('advisors.edit') ? '<button type="button" class="btn btn--ghost btn--small" data-adv="' + a.id + '">Edit<span class="sr-only"> ' + esc(a.name) + '</span></button>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="empty">No one matches that search.</td></tr>') + '</tbody></table></div></section>';
  }
  var NOTE_KIND = { note: ['Note', 'blue'], call: ['Call', 'green'], handoff: ['Hand-off', 'amber'], message: ['Message', 'teal'], stage: ['Stage change', 'gray'] };
  function tabService(f, main) {
    var flt = main.__flt || 'all';
    var list = S.notes.filter(function (n) { return n.firmId === f.id && (flt === 'all' || n.type === flt); }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    return '<section class="panel"><div class="panel__head"><h2>Lifetime and service</h2><div class="chips">' + [['all', 'All'], ['note', 'Notes'], ['call', 'Calls'], ['handoff', 'Hand-offs'], ['message', 'Messages'], ['stage', 'Stage changes']].map(function (c) { return '<button type="button" class="chip-btn' + (flt === c[0] ? ' is-on' : '') + '" data-flt="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div></div><div class="panel__body">' +
      (can('notes.add') ? '<form id="sv-quick" class="composer"><label class="sr-only" for="sq-type">Type</label><select id="sq-type" class="select select--chip"><option value="note">Note</option><option value="call">Call</option><option value="handoff">Hand-off</option></select><label class="sr-only" for="sq-text">Log a note, call, or hand-off</label><input id="sq-text" class="input" placeholder="Log a note, call, or hand-off" autocomplete="off"><button type="submit" class="btn btn--primary">Save note</button></form>' : '') +
      '<div class="timeline">' + (list.length ? list.map(function (n) { var k = NOTE_KIND[n.type]; return '<div class="tl"><span class="tl__av">' + avatar(n.by, 30) + '</span><div><div class="small muted"><span class="pill pill--' + k[1] + '">' + k[0] + '</span> ' + esc(userName(n.by)) + ', ' + fmtDateTime(n.at) + '</div><div>' + esc(n.text) + '</div></div></div>'; }).join('') : '<p class="muted">Nothing logged here yet.</p>') + '</div></div></section>';
  }
  function tabWork(f, tasks) {
    var winStart = Date.now() - 120 * 864e5, winEnd = Date.now() + 30 * 864e5, span = winEnd - winStart;
    function pos(ms) { return Math.max(0, Math.min(100, (ms - winStart) / span * 100)); }
    var segs = f.history.concat([{ stage: f.stage, from: f.stageSince, to: new Date(winEnd).toISOString() }]);
    var head = segs.map(function (s) { var l = pos(new Date(s.from).getTime()), r = pos(new Date(s.to).getTime()); return r - l < 4 ? '' : '<div class="ws__stage" style="left:' + l + '%;width:' + (r - l) + '%;color:' + STAGE_META[s.stage].text + '">' + STAGE_META[s.stage].name + '</div>'; }).join('');
    var lanes = DEPTS.map(function (d) {
      var ts = tasks.filter(function (t) { return t.dept === d }); if (!ts.length) return '';
      var start = Math.min.apply(null, ts.map(function (t) { return new Date(t.createdAt).getTime(); })), end = Math.max.apply(null, ts.map(function (t) { return t.doneAt ? new Date(t.doneAt).getTime() : new Date(t.due + 'T23:00:00').getTime(); }));
      end = Math.max(end, start + 3 * 864e5);
      var done = ts.filter(function (t) { return t.status === 'Done'; }).length, l = pos(start), r = pos(end), w = Math.max(2, r - l);
      var cnt = {}; ts.forEach(function (t) { cnt[t.assigneeId] = (cnt[t.assigneeId] || 0) + 1; }); var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0];
      var ev = d === 'Finance' && f.fundsAt ? '<span class="ws__event" style="left:' + pos(new Date(f.fundsAt).getTime()) + '%"></span><span class="ws__event-l" style="left:' + pos(new Date(f.fundsAt).getTime()) + '%">Funds received ' + fmtDay(dstr(new Date(f.fundsAt))) + '</span>' : '';
      return '<div class="ws__lane"><div class="ws__label">' + avatar(top === 'null' ? null : top, 30) + '<div><strong>' + (d === 'Finance' ? 'Billing' : d) + '</strong><div class="small muted">' + done + ' of ' + ts.length + ' tasks done</div></div></div><div class="ws__track"><span class="ws__bar" style="left:' + l + '%;width:' + w + '%"><span style="width:' + Math.round(done / ts.length * 100) + '%"></span></span>' + ev + '</div></div>';
    }).join('');
    return '<section class="panel"><div class="panel__head"><h2>Department workstreams</h2><span class="muted small">Teams work in parallel. Billing opens when funds arrive.</span></div><div class="panel__body ws">' +
      '<div class="ws__lane ws__lane--head"><div></div><div class="ws__track ws__track--head">' + head + '<span class="ws__today" style="left:' + pos(Date.now()) + '%"><span>Today</span></span></div></div>' + lanes +
      '<div class="ws__legend"><span><i class="lg lg--done"></i>Done</span><span><i class="lg lg--plan"></i>Planned</span><span><i class="lg lg--ev"></i>Event that starts a team</span></div>' +
      (can('funds.record') && !f.fundsAt ? '<div class="callout callout--blue">' + icon('alert') + '<div><strong>Funds have not been recorded.</strong><div>Recording them opens the billing lane and creates ' + BILLING_STEPS.length + ' setup tasks for Finance.</div></div><button type="button" class="btn btn--primary btn--small" id="fd-funds">Record funds received</button></div>' : '') + '</div></section>';
  }
  function tabTasks(f, tasks, main) {
    var list = tasks.slice().sort(function (a, b) { return (isOpen(b) - isOpen(a)) || (a.due < b.due ? -1 : 1); });
    return '<section class="panel"><div class="panel__head"><h2>Tasks for this firm</h2>' + (can('tasks.create') ? '<button type="button" class="btn btn--secondary btn--small" id="ft-add">' + icon('plus', 15) + ' Add task</button>' : '') + '</div>' +
      (list.length ? '<ul class="rows">' + list.map(function (t) { return '<li class="rows__item"><button type="button" class="box' + (t.status === 'Done' ? ' box--on' : '') + (can('tasks.edit') ? '' : ' box--off') + '" data-tdone="' + t.id + '" aria-label="' + (t.status === 'Done' ? 'Reopen ' : 'Mark done: ') + esc(t.title) + '"' + (can('tasks.edit') ? '' : ' disabled') + '>' + (t.status === 'Done' ? icon('check', 14) : '') + '</button><div class="grow"><a class="strong' + (t.status === 'Done' ? ' done' : '') + '" href="tasks.html?task=' + t.id + '">' + esc(t.title) + '</a><div class="muted small">' + esc(t.dept) + (t.stepId ? ', ' + STAGE_META[t.stageIdx].name + ' checklist' : '') + '</div></div><span class="pill pill--' + STATUS_CLASS[t.status] + '">' + t.status + '</span>' + dueLabel(t) + avatar(t.assigneeId, 28) + '</li>'; }).join('') + '</ul>' : '<p class="panel__body muted">No tasks yet.</p>') + '</section>';
  }
  function bindFirmTab(f, main) {
    var ed = main.querySelector('#fd-edit'); if (ed) ed.addEventListener('click', function () { openEditFirm(f); });
    var ar = main.querySelector('#ai-run'); if (ar) ar.addEventListener('click', function () { runAI(f); });
    var du = main.querySelector('#fdoc-up'); if (du) du.addEventListener('click', function () { openUpload(f.id); });
    bindDocActions(main);
    var fu = main.querySelector('#fd-funds'); if (fu) fu.addEventListener('click', function () {
      confirmDialog({ title: 'Record funds received for ' + f.name + '?', description: 'This opens the billing lane and creates ' + BILLING_STEPS.length + ' setup tasks for Finance.', confirmLabel: 'Record funds received', onConfirm: function () { recordFunds(f); App.refresh(); toast('Funds recorded. Billing tasks created.'); } });
    });
    var aq = main.querySelector('#av-q'); if (aq) aq.addEventListener('input', function () { main.__advq = aq.value; var p = aq.selectionStart; App.refresh(); var n = main.querySelector('#av-q'); n.focus(); n.setSelectionRange(p, p); });
    var aa = main.querySelector('#av-add'); if (aa) aa.addEventListener('click', function () { openAdvisor(f, null); });
    main.querySelectorAll('[data-adv]').forEach(function (b) { b.addEventListener('click', function () { openAdvisor(f, S.advisors.filter(function (a) { return a.id === b.getAttribute('data-adv'); })[0]); }); });
    main.querySelectorAll('[data-flt]').forEach(function (b) { b.addEventListener('click', function () { main.__flt = b.getAttribute('data-flt'); App.refresh(); }); });
    var sq = main.querySelector('#sv-quick'); if (sq) sq.addEventListener('submit', function (e) { e.preventDefault(); var v = main.querySelector('#sq-text').value.trim(); if (!v) { main.querySelector('#sq-text').focus(); return; } addNote(f.id, main.querySelector('#sq-type').value, currentUser().id, v); log('Added a note to ' + f.name); save(); App.refresh(); toast('Note saved'); });
    var ta = main.querySelector('#ft-add'); if (ta) ta.addEventListener('click', function () { openNewTask({ firmId: f.id }); });
    main.querySelectorAll('[data-tdone]').forEach(function (b) { b.addEventListener('click', function () { var t = taskById(b.getAttribute('data-tdone')), r = completeTask(t, t.status !== 'Done'); App.refresh(); if (r === 'pending') toast('Submitted for approval'); }); });
  }

  /* ---------- page: Pipeline ---------- */
  function pagePipeline(main) {
    var u = currentUser(), f = main.__pf || (main.__pf = { dept: 'all', owner: 'all', state: 'all', view: 'board' });
    var firms = visibleFirms().filter(function (x) { return (f.dept === 'all' || x.dept === f.dept) && (f.owner === 'all' || (f.owner === 'none' ? !x.ownerId : x.ownerId === f.owner)) && (f.state === 'all' || x.state === f.state); });
    var states = S.firms.map(function (x) { return x.state; }).filter(function (s, i, a) { return a.indexOf(s) === i; }).sort();
    var owners = S.users.filter(function (x) { return S.firms.some(function (fm) { return fm.ownerId === x.id; }); });
    var over = firms.filter(overTarget).length, canMove = can('pipeline.move');
    function card(x) {
      var p = progress(x), n = nextStep(x), d = daysIn(x);
      return '<div class="kcard' + (canMove ? ' kcard--drag' : '') + '" draggable="' + canMove + '" data-firm="' + x.id + '"><a class="strong" href="firm.html?id=' + x.id + '">' + esc(x.name) + '</a><div class="small muted">' + (n ? 'Next: ' + esc(n.title) : 'No next step yet') + '</div>' +
        '<div class="kcard__bar"><span class="meter"><span style="width:' + Math.round((p.total ? p.done / p.total : 0) * 100) + '%"></span></span><span class="small muted num">' + p.done + ' of ' + p.total + '</span></div>' +
        '<div class="kcard__foot"><span class="small ' + (overTarget(x) ? 'red strong' : 'muted') + '">' + d + 'd in stage</span><span class="who">' + (canMove ? '<button type="button" class="icon-btn icon-btn--s" data-moveto="' + x.id + '" aria-label="Move ' + esc(x.name) + ' to another stage">' + icon('right', 15) + '</button>' : '') + avatar(x.ownerId, 24) + '</span></div></div>';
    }
    var board = '<div class="kanban">' + STAGE_META.map(function (m, i) {
      var cs = firms.filter(function (x) { return x.stage === i; });
      return '<div class="kcol" data-stage="' + i + '" style="border-top-color:' + m.fill + '"><div class="kcol__head"><div><div class="strong" style="color:' + (i < 4 ? m.text : '#1B2A3A') + '">' + m.name + '</div><div class="small muted">' + (m.target ? 'Target ' + m.target + ' days' : 'No target') + '</div></div><strong class="num">' + cs.length + '</strong></div>' + cs.map(card).join('') + (cs.length ? '' : '<div class="kcol__empty small muted">No firms here. ' + (canMove ? 'Drag one in.' : '') + '</div>') + '</div>';
    }).join('') + '</div>';
    var list = '<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Firm</th><th>Stage</th><th>Owner</th><th>Days in stage</th><th>Next step</th><th><span class="sr-only">Move</span></th></tr></thead><tbody>' + firms.sort(function (a, b) { return a.stage - b.stage || daysIn(b) - daysIn(a); }).map(function (x) {
      var n = nextStep(x);
      return '<tr><td><a class="strong" href="firm.html?id=' + x.id + '">' + esc(x.name) + '</a></td><td>' + stagePill(x.stage) + '</td><td><div class="who">' + avatar(x.ownerId, 26) + '<span>' + esc(userName(x.ownerId)) + '</span></div></td><td class="' + (overTarget(x) ? 'red strong' : '') + '">' + daysIn(x) + 'd</td><td>' + (n ? esc(n.title) : '<span class="muted">All steps done</span>') + '</td><td>' + (canMove ? '<button type="button" class="btn btn--ghost btn--small" data-moveto="' + x.id + '">Move<span class="sr-only"> ' + esc(x.name) + '</span></button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div></section>';
    main.innerHTML = pageHead('Pipeline', canMove ? 'Drag a firm to a new stage. You confirm before it moves.' : 'See where every firm is in its lifecycle.', can('firms.create') ? '<button type="button" class="btn btn--primary" id="pl-new">' + icon('plus', 16) + ' New firm</button>' : '') +
      '<div class="filters"><div class="seg" role="tablist">' + [['board', 'Board'], ['list', 'List']].map(function (s) { return '<button type="button" role="tab" aria-selected="' + (f.view === s[0]) + '" class="seg__b' + (f.view === s[0] ? ' is-on' : '') + '" data-pv="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>' +
      '<label class="sr-only" for="p-dept">Team</label><select id="p-dept" class="select select--chip">' + selectOpts(['Relationship Ops', 'Client Service'], f.dept, 'All teams') + '</select>' +
      '<label class="sr-only" for="p-owner">Owner</label><select id="p-owner" class="select select--chip">' + selectOpts(owners.map(function (o) { return [o.id, o.name]; }), f.owner, 'All owners') + '</select>' +
      '<label class="sr-only" for="p-state">State</label><select id="p-state" class="select select--chip">' + selectOpts(states, f.state, 'All states') + '</select><span class="muted filters__r">' + firms.length + ' firms, ' + over + ' over target</span></div>' + (f.view === 'board' ? board : list);
    main.querySelectorAll('[data-pv]').forEach(function (b) { b.addEventListener('click', function () { f.view = b.getAttribute('data-pv'); App.refresh(); }); });
    [['#p-dept', 'dept'], ['#p-owner', 'owner'], ['#p-state', 'state']].forEach(function (p) { main.querySelector(p[0]).addEventListener('change', function (e) { f[p[1]] = e.target.value; App.refresh(); }); });
    var nb = main.querySelector('#pl-new'); if (nb) nb.addEventListener('click', openNewFirm);
    main.querySelectorAll('[data-moveto]').forEach(function (b) { b.addEventListener('click', function () { openChooseStage(firmById(b.getAttribute('data-moveto'))); }); });
    if (canMove) {
      var dragId = null;
      main.querySelectorAll('.kcard').forEach(function (c) {
        c.addEventListener('dragstart', function (e) { dragId = c.getAttribute('data-firm'); c.classList.add('is-drag'); e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; });
        c.addEventListener('dragend', function () { c.classList.remove('is-drag'); main.querySelectorAll('.kcol').forEach(function (k) { k.classList.remove('is-over'); }); });
      });
      main.querySelectorAll('.kcol').forEach(function (col) {
        col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('is-over'); });
        col.addEventListener('dragleave', function () { col.classList.remove('is-over'); });
        col.addEventListener('drop', function (e) { e.preventDefault(); col.classList.remove('is-over'); var id = e.dataTransfer.getData('text/plain') || dragId, fm = firmById(id); if (fm) openMove(fm, Number(col.getAttribute('data-stage'))); });
      });
    }
  }

  /* ---------- page: Tasks ---------- */
  function pageTasks(main) {
    var u = currentUser(), P = params();
    var f = main.__tf;
    if (!f) {
      f = main.__tf = { view: P.get('view') === 'calendar' ? 'calendar' : 'list', month: null, who: P.get('who'), scope: P.get('scope') || u.tasksScope || 'mine', dept: P.get('dept') || 'all', firm: P.get('firm') || 'all', stage: 'all', prio: 'all', status: 'all', due: P.get('due') || 'all', done: false, sel: [], group: 'due' };
      if (P.get('dept')) f.scope = 'dept';
      if (P.get('who')) f.scope = 'who';
    }
    var canEdit = can('tasks.edit');
    function inScope(t) {
      if (f.scope === 'mine') return t.assigneeId === u.id;
      if (f.scope === 'team') return t.dept === u.dept || (userById(t.assigneeId) && userById(t.assigneeId).dept === u.dept);
      if (f.scope === 'dept') return t.dept === f.dept;
      if (f.scope === 'who') return t.assigneeId === f.who;
      return true;
    }
    function bucket(t) { var d = dayDiff(t.due); return d < 0 ? 'Overdue' : d === 0 ? 'Today' : d <= 7 ? 'This week' : 'Later'; }
    var list = visibleTasks().filter(function (t) {
      if (!inScope(t)) return false;
      if (!f.done && !isOpen(t)) return false;
      if (f.scope !== 'dept' && f.dept !== 'all' && t.dept !== f.dept) return false;
      if (f.firm !== 'all' && (f.firm === 'none' ? t.firmId : t.firmId !== f.firm)) return false;
      if (f.stage !== 'all' && (f.stage === 'standalone' ? t.stepId : String(t.stageIdx) !== f.stage || !t.stepId)) return false;
      if (f.prio !== 'all' && t.priority !== f.prio) return false;
      if (f.status !== 'all' && t.status !== f.status) return false;
      if (f.due !== 'all' && ((f.due === 'overdue' && !isOverdue(t)) || (f.due === 'today' && dayDiff(t.due) !== 0) || (f.due === 'week' && !(dayDiff(t.due) >= 0 && dayDiff(t.due) <= 7)))) return false;
      return true;
    });
    list.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
    f.sel = f.sel.filter(function (id) { return list.some(function (t) { return t.id === id; }); });
    var order = f.group === 'firm' ? S.firms.map(function (x) { return x.name; }).concat(['No firm']) : ['Overdue', 'Today', 'This week', 'Later'];
    var groups = {}; list.forEach(function (t) { var k = f.group === 'firm' ? (firmName(t.firmId) || 'No firm') : bucket(t); (groups[k] = groups[k] || []).push(t); });
    var overN = list.filter(isOverdue).length, blockedN = list.filter(function (t) { return t.status === 'Blocked'; }).length;
    var tabs = [['mine', 'My tasks'], ['team', 'My team'], ['all', 'Firmwide']].concat(DEPTS.filter(function (d) { return S.tasks.some(function (t) { return t.dept === d && isOpen(t); }); }).map(function (d) { return ['dept:' + d, d]; }));
    function tabOn(t) { return t[0].indexOf('dept:') === 0 ? f.scope === 'dept' && f.dept === t[0].slice(5) : f.scope === t[0]; }
    function tabCount(t) { var sc = f.scope, dp = f.dept; var n = S.tasks.filter(function (x) { return isOpen(x) && (t[0] === 'mine' ? x.assigneeId === u.id : t[0] === 'team' ? (x.dept === u.dept || (userById(x.assigneeId) && userById(x.assigneeId).dept === u.dept)) : t[0] === 'all' ? true : x.dept === t[0].slice(5)); }).length; return n; }
    var rowsHtml = order.filter(function (k) { return groups[k]; }).map(function (k) {
      return '<tr class="grp"><td colspan="7"><strong' + (k === 'Overdue' ? ' class="red"' : '') + '>' + esc(k) + '</strong> <span class="muted">' + groups[k].length + '</span></td></tr>' + groups[k].map(function (t) {
        var on = f.sel.indexOf(t.id) >= 0;
        return '<tr class="' + (on ? 'is-sel' : '') + '"><td><div class="taskcell"><button type="button" class="box' + (on ? ' box--on' : '') + '" data-pick="' + t.id + '" role="checkbox" aria-checked="' + on + '" aria-label="Select ' + esc(t.title) + '">' + (on ? icon('check', 14) : '') + '</button><div><a class="strong' + (t.status === 'Done' ? ' done' : '') + '" href="#" data-open="' + t.id + '">' + esc(t.title) + '</a><div><span class="tag">' + (t.stepId ? STAGE_META[t.stageIdx].name + ' checklist' : 'Standalone') + '</span></div>' + (t.status === 'Blocked' ? '<div class="small amber strong">Waiting on ' + esc(t.blockedOn) + (t.blockedReason ? ', ' + esc(t.blockedReason.toLowerCase()) : '') + '</div>' : '') + '</div></div></td>' +
          '<td>' + (t.firmId ? '<a href="firm.html?id=' + t.firmId + '">' + esc(firmName(t.firmId)) + '</a>' : '<span class="muted">No firm</span>') + '</td><td><div class="who">' + avatar(t.assigneeId, 26) + '<span>' + esc(userName(t.assigneeId)) + '</span></div></td>' +
          '<td><span class="pill pill--' + PRIO_CLASS[t.priority] + '">' + t.priority + '</span></td>' +
          (t.status === 'Awaiting approval' ? '<td><a class="pill pill--amber" href="approvals.html?task=' + t.id + '">Awaiting approval</a></td>' : '<td><label class="sr-only" for="st-' + t.id + '">Status of ' + esc(t.title) + '</label><select id="st-' + t.id + '" class="select select--status select--' + STATUS_CLASS[t.status] + '" data-status="' + t.id + '"' + (canEdit ? '' : ' disabled') + '>' + selectOpts(['Open', 'In progress', 'Blocked', 'Done'], t.status) + '</select></td>') +
          '<td class="nowrap">' + dueLabel(t) + '</td><td><button type="button" class="btn btn--ghost btn--small" data-open="' + t.id + '">Open<span class="sr-only"> ' + esc(t.title) + '</span></button></td></tr>';
      }).join('');
    }).join('');
    main.innerHTML = pageHead('Tasks', (f.scope === 'mine' ? 'You have ' : f.scope === 'who' ? userName(f.who) + ' has ' : f.scope === 'dept' ? f.dept + ' has ' : f.scope === 'team' ? 'Your team has ' : 'The firm has ') + list.length + ' ' + (f.done ? '' : 'open ') + (list.length === 1 ? 'task' : 'tasks') + '. ' + overN + ' ' + (overN === 1 ? 'is' : 'are') + ' overdue' + (blockedN ? ' and ' + blockedN + ' ' + (blockedN === 1 ? 'is' : 'are') + ' blocked on another team.' : '.'),
      subnav('tasks', 'Tasks') + '<button type="button" class="btn btn--secondary" id="tk-export">' + icon('download', 16) + ' Export CSV</button>' + (can('tasks.create') ? '<button type="button" class="btn btn--primary" id="tk-new">' + icon('plus', 16) + ' New task</button>' : '')) +
      (can('tasks.create') ? '<form id="tk-quick" class="quickadd"><span class="quickadd__ic">' + icon('plus', 18) + '</span><label for="tk-add" class="sr-only">Add a task</label><input id="tk-add" class="input" autocomplete="off" placeholder="Add a task and press Enter. Type @ then a firm name to link it."></form>' : '') +
      '<div class="tabs tabs--wrap" role="tablist">' + tabs.map(function (t) { var on = tabOn(t); return '<span class="tab' + (on ? ' is-on' : '') + '"><button type="button" role="tab" aria-selected="' + on + '" data-tab="' + t[0] + '">' + esc(t[1]) + ' <span class="count">' + tabCount(t) + '</span></button></span>'; }).join('') +
      '<label class="tabs__chk"><input type="checkbox" id="tk-done"' + (f.done ? ' checked' : '') + '> Show completed</label></div>' +
      '<div class="filters"><label class="sr-only" for="t-firm">Firm</label><select id="t-firm" class="select select--chip"><option value="all">All firms</option><option value="none"' + (f.firm === 'none' ? ' selected' : '') + '>No firm</option>' + S.firms.map(function (x) { return '<option value="' + x.id + '"' + (f.firm === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' +
      '<label class="sr-only" for="t-stage">Checklist</label><select id="t-stage" class="select select--chip">' + selectOpts(STAGE_META.map(function (m, i) { return [String(i), m.name + ' checklist']; }).concat([['standalone', 'Standalone']]), f.stage, 'All checklists') + '</select>' +
      '<label class="sr-only" for="t-prio">Priority</label><select id="t-prio" class="select select--chip">' + selectOpts(['High', 'Medium', 'Low'], f.prio, 'All priorities') + '</select>' +
      '<label class="sr-only" for="t-status">Status</label><select id="t-status" class="select select--chip">' + selectOpts(['Open', 'In progress', 'Blocked', 'Awaiting approval', 'Done'], f.status, 'All statuses') + '</select>' +
      '<label class="sr-only" for="t-due">Due</label><select id="t-due" class="select select--chip">' + selectOpts([['overdue', 'Overdue'], ['today', 'Due today'], ['week', 'Next 7 days']], f.due, 'Any due date') + '</select>' +
      '<span class="filters__r">Group by <label class="sr-only" for="t-group">Group by</label><select id="t-group" class="select select--chip">' + selectOpts([['due', 'Due date'], ['firm', 'Firm']], f.group) + '</select></span></div>' +
      '<section class="panel"><div class="table-wrap"><table class="table table--tasks"><thead><tr><th>Task</th><th>Firm</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Due</th><th><span class="sr-only">Open</span></th></tr></thead><tbody>' + (rowsHtml || '<tr><td colspan="7" class="empty">No tasks match. Clear a filter or add a task above.</td></tr>') + '</tbody></table></div></section>' +
      (f.sel.length && canEdit ? '<div class="bulk" role="region" aria-label="Selected tasks"><strong>' + f.sel.length + ' selected</strong><span class="muted-dark">' + f.sel.filter(function (id) { return isOverdue(taskById(id)); }).length + ' overdue.</span><span class="btn-row bulk__b"><button type="button" class="btn btn--dark" id="bk-who">Reassign</button><button type="button" class="btn btn--dark" id="bk-due">Change due date</button><button type="button" class="btn btn--primary" id="bk-done">Mark done</button></span></div>' : '');
    var again = function () { App.refresh(); };
    taskExtras(main, f, list, again, canEdit);
    main.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { var v = b.getAttribute('data-tab'); if (v.indexOf('dept:') === 0) { f.scope = 'dept'; f.dept = v.slice(5); } else { f.scope = v; f.dept = 'all'; } f.sel = []; again(); }); });
    [['#t-firm', 'firm'], ['#t-stage', 'stage'], ['#t-prio', 'prio'], ['#t-status', 'status'], ['#t-due', 'due'], ['#t-group', 'group']].forEach(function (p) { main.querySelector(p[0]).addEventListener('change', function (e) { f[p[1]] = e.target.value; again(); }); });
    main.querySelector('#tk-done').addEventListener('change', function (e) { f.done = e.target.checked; again(); });
    main.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); openTask(b.getAttribute('data-open')); }); });
    main.querySelectorAll('[data-pick]').forEach(function (b) { b.addEventListener('click', function () { var id = b.getAttribute('data-pick'), i = f.sel.indexOf(id); if (i >= 0) f.sel.splice(i, 1); else f.sel.push(id); again(); }); });
    main.querySelectorAll('[data-status]').forEach(function (s) { s.addEventListener('change', function () { var t = taskById(s.getAttribute('data-status')), v = s.value; if (v === 'Blocked') { s.value = t.status; openBlock(t); return; } if (v === 'Done') completeTask(t, true); else { t.status = v; t.doneAt = null; t.blockedOn = ''; t.blockedReason = ''; log('Updated "' + t.title + '"'); save(); } again(); toast('Status updated'); }); });
    var nt = main.querySelector('#tk-new'); if (nt) nt.addEventListener('click', function () { openNewTask({}); });
    var qa = main.querySelector('#tk-quick');
    if (qa) qa.addEventListener('submit', function (e) {
      e.preventDefault(); var inp = main.querySelector('#tk-add'), raw = inp.value.trim(); if (!raw) return;
      var m = /@([^@]+)$/.exec(raw), firm = null, title = raw;
      if (m) { var q = m[1].trim().toLowerCase(); firm = S.firms.filter(function (x) { return x.name.toLowerCase().indexOf(q) >= 0; })[0] || null; if (firm) title = raw.slice(0, m.index).trim() || raw; }
      if (!title) { inp.focus(); return; }
      var t = { id: nextId('k'), title: title, firmId: firm ? firm.id : null, stageIdx: null, stepId: null, dept: u.dept, assigneeId: u.id, priority: 'Medium', status: 'Open', due: dueIn(3), desc: '', subtasks: [], blockedOn: '', blockedReason: '', comments: [], createdAt: new Date().toISOString(), doneAt: null };
      S.tasks.push(t); log('Created the task "' + title + '"'); save(); again(); toast(firm ? 'Task added for ' + firm.name : 'Task added to your queue');
    });
    main.querySelector('#tk-export').addEventListener('click', function () {
      var rows = [['Task', 'Firm', 'Checklist', 'Team', 'Assignee', 'Priority', 'Status', 'Due']].concat(list.map(function (t) { return [t.title, firmName(t.firmId), t.stepId ? STAGE_META[t.stageIdx].name : 'Standalone', t.dept, userName(t.assigneeId), t.priority, t.status, t.due]; }));
      download('tasks.csv', csv(rows), 'text/csv'); toast('Exported ' + list.length + ' tasks');
    });
    var bw = main.querySelector('#bk-who'); if (bw) bw.addEventListener('click', function () {
      var api = dialog({ title: 'Reassign ' + f.sel.length + (f.sel.length === 1 ? ' task' : ' tasks'), body: '<form id="rs-form">' + field('rs-who', 'New assignee', '<select id="rs-who" class="select">' + userOptions(u.id, true) + '</select>') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Reassign</button></div></form>' });
      api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
      api.body.querySelector('#rs-form').addEventListener('submit', function (e) { e.preventDefault(); var v = api.body.querySelector('#rs-who').value || null; f.sel.forEach(function (id) { var t = taskById(id); t.assigneeId = v; if (v) { t.dept = userById(v).dept; pushNote(v, 'assigned', currentUser().name + ' assigned you "' + t.title + '".', 'tasks.html?task=' + t.id); } }); log('Reassigned ' + f.sel.length + ' tasks to ' + userName(v)); save(); api.close(); f.sel = []; again(); toast('Tasks reassigned'); });
    });
    var bd = main.querySelector('#bk-due'); if (bd) bd.addEventListener('click', function () {
      var api = dialog({ title: 'Change the due date', description: 'For ' + f.sel.length + (f.sel.length === 1 ? ' task.' : ' tasks.'), body: '<form id="dd-form">' + field('dd-date', 'New due date', '<input id="dd-date" type="date" class="input" value="' + dayShift(new Date(), 7) + '">') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Change due date</button></div></form>' });
      api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
      api.body.querySelector('#dd-form').addEventListener('submit', function (e) { e.preventDefault(); var v = api.body.querySelector('#dd-date').value; if (!v) { setError('dd-date', 'Choose a date.'); return; } f.sel.forEach(function (id) { taskById(id).due = v; }); log('Changed the due date of ' + f.sel.length + ' tasks'); save(); api.close(); f.sel = []; again(); toast('Due date changed'); });
    });
    var bn = main.querySelector('#bk-done'); if (bn) bn.addEventListener('click', function () { f.sel.forEach(function (id) { completeTask(taskById(id), true); }); var n = f.sel.length; f.sel = []; again(); toast(n + (n === 1 ? ' task' : ' tasks') + ' marked done'); });
    if (!main.__opened && P.get('task')) { main.__opened = true; openTask(P.get('task')); history.replaceState(null, '', 'tasks.html'); }
  }

  /* ---------- custom fields, AI panel, firm documents ---------- */
  function customRows(r, ent) { return S.customFields.filter(function (c) { return c.entity === ent; }).map(function (c) { return '<div class="kv"><span class="muted">' + esc(c.label) + '</span><span>' + esc((r.custom && r.custom[c.id]) || 'Not set') + '</span></div>'; }).join(''); }
  function customInputs(ent, r) {
    return S.customFields.filter(function (c) { return c.entity === ent; }).map(function (c) {
      var v = (r.custom && r.custom[c.id]) || '', id = 'cx-' + c.id;
      var ctl = c.type === 'select' ? '<select id="' + id + '" class="select" data-cx="' + c.id + '"><option value="">Not set</option>' + c.options.map(function (o) { return '<option' + (v === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>' : '<input id="' + id + '" class="input" data-cx="' + c.id + '" type="' + (c.type === 'number' ? 'number' : 'text') + '" value="' + esc(v) + '">';
      return field(id, c.label, ctl);
    }).join('');
  }
  function saveCustom(r, root) { r.custom = r.custom || {}; root.querySelectorAll('[data-cx]').forEach(function (el) { r.custom[el.getAttribute('data-cx')] = el.value; }); }
  function aiSuggest(f) {
    var items = [], tasks = S.tasks.filter(function (t) { return t.firmId === f.id && isOpen(t); });
    var over = tasks.filter(isOverdue).sort(function (a, b) { return a.due < b.due ? -1 : 1; })[0];
    if (over) items.push('Follow up on "' + over.title + '", which is ' + Math.abs(dayDiff(over.due)) + ' days overdue.');
    var bl = tasks.filter(function (t) { return t.status === 'Blocked'; })[0]; if (bl) items.push('Chase ' + (bl.blockedOn || 'the other team') + ' on "' + bl.title + '".');
    if (overTarget(f)) items.push('The firm is ' + (daysIn(f) - STAGE_META[f.stage].target) + ' days over the ' + STAGE_META[f.stage].name + ' target. Review the open steps with ' + userName(f.ownerId) + '.');
    var ns = nextStep(f); if (ns && !over) items.push('Finish "' + ns.title + '", due ' + fmtDay(ns.due) + '.');
    var last = S.notes.filter(function (n) { return n.firmId === f.id; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; })[0], gap = last ? Math.floor((Date.now() - new Date(last.at).getTime()) / 864e5) : null;
    if (gap == null || gap > 30) items.push('Log a check-in. ' + (gap == null ? 'There are no notes yet.' : 'The last note was ' + gap + ' days ago.'));
    if (!items.length) items.push('Nothing urgent. Keep the next step on schedule.');
    return items.slice(0, 3);
  }
  function aiPanel(f) {
    if (!S.security.ai) return '';
    var last = S.aiLast[f.id], items = last ? last.items : aiSuggest(f), nn = S.notes.filter(function (n) { return n.firmId === f.id; }).length, nt = S.tasks.filter(function (t) { return t.firmId === f.id; }).length;
    return '<section class="panel"><div class="panel__head"><h2><span class="ai-h">' + icon('sparkle', 16) + 'AI next steps</span></h2></div><div class="panel__body"><div class="small muted">Based on ' + nn + (nn === 1 ? ' note' : ' notes') + ' and ' + nt + (nt === 1 ? ' task' : ' tasks') + '.</div><ol class="ai-list">' + items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ol><div class="ai-foot"><button type="button" class="btn btn--secondary btn--small" id="ai-run">' + icon('sparkle', 15) + ' Summarize again</button><span class="small muted">This call is logged. Admins can switch AI off.</span></div></div></section>';
  }
  function runAI(f) {
    if (aiUsed() >= S.security.aiLimit) { toast('The monthly AI limit is reached. An admin can raise it.'); return; }
    S.aiLog.unshift({ id: nextId('ai'), at: new Date().toISOString(), by: currentUser().id, firmId: f.id, kind: 'Next steps' }); S.aiLast[f.id] = { at: new Date().toISOString(), items: aiSuggest(f) }; save(); App.refresh(); toast('Suggestions updated');
  }
  function tabDocs(f) {
    var docs = S.documents.filter(function (d) { return d.firmId === f.id; });
    return '<section class="panel"><div class="panel__head"><h2>Documents</h2>' + (can('documents.upload') ? '<button type="button" class="btn btn--primary btn--small" id="fdoc-up">' + icon('upload', 15) + ' Upload a file</button>' : '') + '</div><div class="table-wrap"><table class="table"><thead><tr><th>File</th><th>Category</th><th>Signature</th><th>Uploaded by</th><th>Uploaded</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      (docs.length ? docs.map(function (d) { return docRow(d, false); }).join('') : '<tr><td colspan="6" class="empty">No documents are linked to this firm yet.</td></tr>') + '</tbody></table></div></section>';
  }
  function noAccess(main) {
    var u = currentUser();
    main.innerHTML = pageHead('No access', 'Your role, ' + ROLES[u.role] + ', does not include this page.', '') + '<p class="muted" style="max-width:60ch">A Super Admin can change what each role can do under Admin.</p><p style="margin-top:16px"><a class="btn btn--secondary" href="index.html">Go to the Command Center</a></p>';
  }

  /* ---------- documents ---------- */
  var DOC_CATS = ['Agreement', 'Template', 'Training material', 'Plan', 'Meeting notes', 'Confirmation', 'Other'];
  var FILES_KEY = 'arkadios_ws_files';
  function loadFiles() { try { return JSON.parse(localStorage.getItem(FILES_KEY) || '{}'); } catch (e) { return {}; } }
  function saveFiles(m) { try { localStorage.setItem(FILES_KEY, JSON.stringify(m)); return true; } catch (e) { return false; } }
  var EXT_STYLE = { pdf: ['PDF', '#FBE3E6', '#B42318'], doc: ['DOC', '#E8EEFC', '#2449AE'], docx: ['DOCX', '#E8EEFC', '#2449AE'], xls: ['XLS', '#E4F3EA', '#1F7A4D'], xlsx: ['XLSX', '#E4F3EA', '#1F7A4D'], csv: ['CSV', '#E4F3EA', '#1F7A4D'], ppt: ['PPT', '#FBF0D9', '#8A5A00'], pptx: ['PPTX', '#FBF0D9', '#8A5A00'], txt: ['TXT', '#E3E8ED', '#1B2A3A'], png: ['PNG', '#EDE7F6', '#5B3F99'], jpg: ['JPG', '#EDE7F6', '#5B3F99'] };
  function extStyle(ext) { return EXT_STYLE[ext] || [(ext || 'file').slice(0, 4).toUpperCase(), '#E3E8ED', '#1B2A3A']; }
  function extGroup(ext) { return { pdf: 'pdf', doc: 'word', docx: 'word', xls: 'excel', xlsx: 'excel', csv: 'excel', ppt: 'slides', pptx: 'slides' }[ext] || 'other'; }
  function fmtSize(b) { return b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB'; }
  function docFirm(d) { return d.firmId ? firmName(d.firmId) : ''; }
  function downloadDoc(d) {
    var files = loadFiles();
    if (d.hasFile && files[d.id]) { var a = document.createElement('a'); a.href = files[d.id]; a.download = d.fileName || (slug(d.title) + '.' + d.ext); document.body.appendChild(a); a.click(); a.remove(); }
    else download(slug(d.title) + '-sample.txt', d.title + '\n\nThis is a sample document from the Arkadios workspace demo.\nCategory: ' + d.category + '\n', 'text/plain');
    toast('Downloaded');
  }
  function openUpload(firmId, done) {
    if (!can('documents.upload')) { toast('Your role cannot upload documents'); return; }
    var api = dialog({ title: 'Upload a file', description: 'Up to 1.5 MB in this demo. Link it to a firm and stage so it is easy to find.',
      body: '<form id="up-form" novalidate>' + field('up-file', 'File', '<input id="up-file" type="file" class="input">') + field('up-title', 'Title', '<input id="up-title" class="input" autocomplete="off">') +
        '<div class="two">' + field('up-cat', 'Category', '<select id="up-cat" class="select">' + selectOpts(DOC_CATS, 'Agreement') + '</select>') +
        field('up-firm', 'Firm', '<select id="up-firm" class="select"><option value="">Shared library</option>' + S.firms.map(function (f) { return '<option value="' + f.id + '"' + (firmId === f.id ? ' selected' : '') + '>' + esc(f.name) + '</option>'; }).join('') + '</select>') + '</div>' +
        '<div class="two">' + field('up-stage', 'Stage', '<select id="up-stage" class="select"><option value="">Any stage</option>' + STAGE_META.map(function (m, i) { return '<option value="' + i + '">' + m.name + '</option>'; }).join('') + '</select>') +
        field('up-tags', 'Tags', '<input id="up-tags" class="input" autocomplete="off" placeholder="signed, q4">', 'Separate with commas.') + '</div>' +
        '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Upload</button></div></form>' });
    var b = api.body, fi = b.querySelector('#up-file'), ti = b.querySelector('#up-title');
    b.querySelector('[data-cancel]').addEventListener('click', api.close);
    var autoTitle = '';
    fi.addEventListener('change', function () { if (fi.files[0] && (!ti.value || ti.value === autoTitle)) { autoTitle = fi.files[0].name.replace(/\.[^.]+$/, ''); ti.value = autoTitle; } setError('up-file', ''); });
    b.querySelector('#up-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var file = fi.files[0], title = ti.value.trim();
      if (!file) { setError('up-file', 'Choose a file to upload.'); fi.focus(); return; }
      if (file.size > 1.5 * 1048576) { setError('up-file', 'This file is ' + fmtSize(file.size) + '. The demo accepts files up to 1.5 MB.'); return; }
      if (!title) { setError('up-title', 'Give the document a title.'); ti.focus(); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var id = nextId('d'), files = loadFiles(); files[id] = reader.result;
        if (!saveFiles(files)) { setError('up-file', 'The browser has no room to keep this file. Try a smaller one.'); return; }
        var st = b.querySelector('#up-stage').value;
        S.documents.unshift({ id: id, title: title, ext: (file.name.split('.').pop() || 'file').toLowerCase(), size: file.size, category: b.querySelector('#up-cat').value, firmId: b.querySelector('#up-firm').value || null, stage: st === '' ? null : Number(st),
          tags: b.querySelector('#up-tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean), by: currentUser().id, at: new Date().toISOString(), hasFile: true, fileName: file.name });
        log('Uploaded "' + title + '"'); save(); api.close(); App.refresh(); toast('Uploaded ' + title); if (done) done();
      };
      reader.readAsDataURL(file);
    });
  }
  function docRow(d, showFirm) {
    var st = extStyle(d.ext), by = userById(d.by);
    return '<tr><td><div class="doc"><span class="doc__ext" style="background:' + st[1] + ';color:' + st[2] + '">' + st[0] + '</span><div><div class="strong">' + esc(d.title) + '</div><div class="small muted">' + fmtSize(d.size) + (d.hasFile ? '' : ', sample') + '</div></div></div></td>' +
      '<td>' + esc(d.category) + '<div class="doc__tags">' + d.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join(' ') + '</div></td>' +
      (showFirm ? '<td>' + (d.firmId ? '<a class="strong" href="firm.html?id=' + d.firmId + '">' + esc(firmName(d.firmId)) + '</a>' : '<span class="strong">Shared library</span>') + '<div class="small muted">' + (d.stage != null ? STAGE_META[d.stage].name : 'All stages') + '</div></td>' : '') +
      '<td>' + sigPill(d) + '</td>' +
      '<td><div class="who">' + avatar(by, 26) + '<span>' + esc(by ? by.name : 'Unknown') + '</span></div></td><td class="nowrap">' + fmtDay(dstr(new Date(d.at))) + '</td>' +
      '<td class="nowrap"><div class="actions">' + sigBtn(d) + '<button type="button" class="icon-btn" data-dl="' + d.id + '" aria-label="Download ' + esc(d.title) + '">' + icon('download') + '</button>' + (can('documents.delete') ? '<button type="button" class="icon-btn" data-rm="' + d.id + '" aria-label="Delete ' + esc(d.title) + '">' + icon('x') + '</button>' : '') + '</div></td></tr>';
  }
  function bindDocActions(root) {
    root.querySelectorAll('[data-sig]').forEach(function (b) { b.addEventListener('click', function () { openSignature(S.documents.filter(function (d) { return d.id === b.getAttribute('data-sig'); })[0]); }); });
    root.querySelectorAll('[data-dl]').forEach(function (b) { b.addEventListener('click', function () { downloadDoc(S.documents.filter(function (d) { return d.id === b.getAttribute('data-dl'); })[0]); }); });
    root.querySelectorAll('[data-rm]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = S.documents.filter(function (x) { return x.id === b.getAttribute('data-rm'); })[0];
        confirmDialog({ title: 'Delete "' + d.title + '"?', description: 'It is removed for everyone. This cannot be undone.', confirmLabel: 'Delete document', danger: true,
          onConfirm: function () { S.documents = S.documents.filter(function (x) { return x.id !== d.id; }); var fl = loadFiles(); delete fl[d.id]; saveFiles(fl); log('Deleted "' + d.title + '"'); save(); App.refresh(); toast('Document deleted'); } });
      });
    });
  }
  function pageDocuments(main) {
    var f = main.__df || (main.__df = { q: '', firm: 'all', stage: 'all', cat: 'all', type: 'all' });
    var list = visibleDocs().filter(function (d) {
      if (f.firm !== 'all' && (f.firm === 'shared' ? d.firmId : d.firmId !== f.firm)) return false;
      if (f.stage !== 'all' && String(d.stage) !== f.stage) return false;
      if (f.cat !== 'all' && d.category !== f.cat) return false;
      if (f.type !== 'all' && extGroup(d.ext) !== f.type) return false;
      var q = f.q.trim().toLowerCase(); if (q && (d.title + ' ' + d.tags.join(' ') + ' ' + d.category + ' ' + docFirm(d)).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    main.innerHTML = pageHead('Documents', 'Agreements, templates, and training material, linked to firms and stages.', subnav('docs', 'Documents') + (can('documents.upload') ? '<button type="button" class="btn btn--primary" id="dc-up">' + icon('upload', 16) + ' Upload a file</button>' : '')) +
      '<div class="filters"><div class="search search--inline"><span class="search__ic">' + icon('search', 16) + '</span><label for="d-q" class="sr-only">Search documents</label><input id="d-q" class="input" placeholder="Search files, categories, tags" autocomplete="off" value="' + esc(f.q) + '"></div>' +
      '<label class="sr-only" for="d-firm">Firm</label><select id="d-firm" class="select select--chip"><option value="all">All firms</option><option value="shared"' + (f.firm === 'shared' ? ' selected' : '') + '>Shared library</option>' + S.firms.map(function (x) { return '<option value="' + x.id + '"' + (f.firm === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' +
      '<label class="sr-only" for="d-stage">Stage</label><select id="d-stage" class="select select--chip">' + selectOpts(STAGE_META.map(function (m, i) { return [String(i), m.name]; }), f.stage, 'All stages') + '</select>' +
      '<label class="sr-only" for="d-cat">Category</label><select id="d-cat" class="select select--chip">' + selectOpts(DOC_CATS, f.cat, 'All categories') + '</select>' +
      '<label class="sr-only" for="d-type">Type</label><select id="d-type" class="select select--chip">' + selectOpts([['pdf', 'PDF'], ['word', 'Word'], ['excel', 'Excel'], ['slides', 'PowerPoint'], ['other', 'Other']], f.type, 'All types') + '</select><span class="filters__r muted">' + list.length + ' of ' + S.documents.length + ' files</span></div>' +
      '<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>File</th><th>Category</th><th>Linked to</th><th>Signature</th><th>Uploaded by</th><th>Uploaded</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      (list.length ? list.map(function (d) { return docRow(d, true); }).join('') : '<tr><td colspan="7" class="empty">No files match. Clear a filter or upload one.</td></tr>') + '</tbody></table></div></section>';
    var qi = main.querySelector('#d-q'); qi.addEventListener('input', function () { f.q = qi.value; var p = qi.selectionStart; App.refresh(); var n = main.querySelector('#d-q'); n.focus(); n.setSelectionRange(p, p); });
    [['#d-firm', 'firm'], ['#d-stage', 'stage'], ['#d-cat', 'cat'], ['#d-type', 'type']].forEach(function (p) { main.querySelector(p[0]).addEventListener('change', function (e) { f[p[1]] = e.target.value; App.refresh(); }); });
    var up = main.querySelector('#dc-up'); if (up) up.addEventListener('click', function () { openUpload(null); });
    bindDocActions(main);
  }

  /* ---------- page: Team performance ---------- */
  function userStats(x) {
    var mine = S.tasks.filter(function (t) { return t.assigneeId === x.id; }), cut = Date.now() - 30 * 864e5;
    var open = mine.filter(isOpen).length, over = mine.filter(isOverdue).length, blocked = mine.filter(function (t) { return t.status === 'Blocked'; }).length;
    var done30 = mine.filter(function (t) { return t.status === 'Done' && t.doneAt && new Date(t.doneAt).getTime() >= cut; }).length;
    var owned = S.firms.filter(function (fm) { return fm.ownerId === x.id; });
    return { u: x, open: open, over: over, blocked: blocked, done30: done30, pct: done30 + over ? Math.round(done30 / (done30 + over) * 100) : null, firms: owned.length, avg: owned.length ? Math.round(owned.reduce(function (n, fm) { return n + daysIn(fm); }, 0) / owned.length) : null };
  }
  function pageTeam(main) {
    var u = currentUser(), dept = main.__dept || (u.role === 'manager' ? u.dept : 'all');
    if ((main.__tmtab || 'people') !== 'people') return pageTeamTab(main, u, dept);
    var pool = u.role === 'manager' ? S.users.filter(function (x) { return x.dept === u.dept && x.status !== 'deactivated'; }) : S.users.filter(function (x) { return x.status !== 'deactivated'; });
    var people = pool.filter(function (x) { return dept === 'all' || x.dept === dept; }).map(userStats).filter(function (r) { return r.open + r.done30 + r.firms > 0 || dept !== 'all'; });
    people.sort(function (a, b) { return b.over - a.over || a.u.name.localeCompare(b.u.name); });
    var tot = people.reduce(function (n, r) { return { open: n.open + r.open, over: n.over + r.over, blocked: n.blocked + r.blocked, done: n.done + r.done30 }; }, { open: 0, over: 0, blocked: 0, done: 0 });
    var ids = people.map(function (r) { return r.u.id; });
    var waiting = S.tasks.filter(function (t) { return t.status === 'Blocked' && ids.indexOf(t.assigneeId) >= 0; }).sort(function (a, b) { return (a.blockedAt || '') < (b.blockedAt || '') ? -1 : 1; });
    var depts = DEPTS.map(function (d) { var rs = people.filter(function (r) { return r.u.dept === d; }); var done = rs.reduce(function (n, r) { return n + r.done30; }, 0), over = rs.reduce(function (n, r) { return n + r.over; }, 0); return [d, done + over ? Math.round(done / (done + over) * 100) : null]; }).filter(function (x) { return x[1] != null; });
    function pctColor(p) { return p == null ? '#9aa6b2' : p >= 80 ? '#1f7a4d' : p >= 40 ? '#b7791f' : '#b42318'; }
    main.innerHTML = pageHead('Team performance', u.role === 'manager' ? 'Shown to managers and leaders. You see ' + esc(u.dept) + '.' : 'Shown to managers and leaders. You see every team.',
      '<div class="btn-row">' + (u.role === 'manager' ? '' : '<label class="sr-only" for="tm-dept">Team</label><select id="tm-dept" class="select select--chip">' + selectOpts(DEPTS, dept, 'All teams') + '</select>') + '<button type="button" class="btn btn--secondary" id="tm-export">' + icon('download', 16) + ' Export CSV</button></div>') +
      teamTabs(main) + '<div class="headline"><div class="headline__t">' + (tot.open ? '<span class="' + (tot.over ? 'red' : '') + '">' + tot.over + ' of ' + tot.open + '</span> open tasks are overdue.' : 'No open tasks for this view.') + '</div><div class="muted">' + tot.done + ' ' + (tot.done === 1 ? 'task was' : 'tasks were') + ' completed in the last 30 days' + (tot.blocked ? ', and ' + tot.blocked + ' ' + (tot.blocked === 1 ? 'is' : 'are') + ' blocked on another team.' : '.') + '</div></div>' +
      '<div class="cols cols--team"><section class="panel"><div class="panel__head"><h2>People</h2><span class="muted small">' + people.length + ' people, most overdue first</span></div><div class="table-wrap"><table class="table table--team"><thead><tr><th>Person</th><th class="r">Open</th><th class="r">Overdue</th><th class="r">Blocked</th><th class="r">Done in 30 days</th><th>Delivery</th><th class="r">Firms</th><th class="r"><span title="Average days in stage for the firms they own">Avg days</span></th></tr></thead><tbody>' +
      (people.length ? people.map(function (r) {
        return '<tr><td><div class="who">' + avatar(r.u, 32) + '<div><a class="strong" href="tasks.html?who=' + r.u.id + '">' + esc(r.u.name) + '</a><div class="small muted">' + esc(r.u.dept) + '</div></div></div></td><td class="r num">' + r.open + '</td><td class="r num ' + (r.over ? 'red strong' : 'muted') + '">' + r.over + '</td><td class="r num ' + (r.blocked ? 'amber strong' : 'muted') + '">' + r.blocked + '</td><td class="r num">' + r.done30 + '</td>' +
          '<td class="nowrap">' + (r.pct == null ? '<span class="muted">No data</span>' : '<span class="meter meter--wide"><span style="width:' + r.pct + '%;background:' + pctColor(r.pct) + '"></span></span> <strong class="num">' + r.pct + '%</strong>') + '</td><td class="r num">' + r.firms + '</td><td class="r num ' + (r.avg > 60 ? 'red' : '') + '">' + (r.avg == null ? 'None' : r.avg) + '</td></tr>';
      }).join('') : '<tr><td colspan="8" class="empty">No one to show for this team.</td></tr>') + '</tbody></table></div><div class="panel__foot muted small">Delivery is tasks completed in the last 30 days divided by those plus tasks now overdue.</div></section>' +
      '<div class="col"><section class="panel"><div class="panel__head"><h2>Waiting on another team</h2></div>' + (waiting.length ? '<ul class="rows">' + waiting.slice(0, 6).map(function (t) {
        var days = t.blockedAt ? Math.max(0, Math.floor((Date.now() - new Date(t.blockedAt).getTime()) / 864e5)) : null;
        return '<li class="rows__item"><div class="grow"><a class="strong" href="tasks.html?task=' + t.id + '">' + esc(t.title) + '</a><div class="small muted">' + (t.firmId ? '<a href="firm.html?id=' + t.firmId + '">' + esc(firmName(t.firmId)) + '</a>, ' : '') + 'waiting on ' + esc(t.blockedOn || 'another team') + (t.blockedReason ? ', ' + esc(t.blockedReason.toLowerCase()) : '') + '</div><div class="small amber strong">Blocked' + (days != null ? ' for ' + days + (days === 1 ? ' day' : ' days') : '') + '</div></div></li>';
      }).join('') + '</ul>' : '<p class="panel__body muted">Nothing is waiting on another team.</p>') + '</section>' +
      '<section class="panel"><div class="panel__head"><h2>Delivery by team</h2></div>' + (depts.length ? '<div class="bars">' + depts.map(function (d) { return '<div class="bar-row"><span>' + esc(d[0]) + '</span><span class="bar"><span style="width:' + d[1] + '%;background:' + pctColor(d[1]) + '"></span></span><strong class="num">' + d[1] + '%</strong></div>'; }).join('') + '</div>' : '<p class="panel__body muted">No data yet.</p>') + '</section></div></div>';
    bindTeamTabs(main);
    var sd = main.querySelector('#tm-dept'); if (sd) sd.addEventListener('change', function (e) { main.__dept = e.target.value; App.refresh(); });
    main.querySelector('#tm-export').addEventListener('click', function () {
      download('team-performance.csv', csv([['Person', 'Team', 'Open', 'Overdue', 'Blocked', 'Done in 30 days', 'Delivery %', 'Firms', 'Avg days in stage']].concat(people.map(function (r) { return [r.u.name, r.u.dept, r.open, r.over, r.blocked, r.done30, r.pct == null ? '' : r.pct, r.firms, r.avg == null ? '' : r.avg]; }))), 'text/csv'); toast('Exported ' + people.length + ' people');
    });
  }

  /* ---------- page: Reports ---------- */
  var OPS = { text: ['is', 'is not', 'contains'], number: ['is', 'is over', 'is under'], select: ['is', 'is not'] };
  var DEFAULT_COLS = { advisor: ['name', 'age', 'firm', 'city', 'staff', 'rep', 'lic'], firm: ['name', 'stage', 'owner', 'state', 'advisors', 'days'] };
  function reportFields(entity) {
    var cf = S.customFields.filter(function (c) { return c.entity === entity; }).map(function (c) {
      return { id: 'cf:' + c.id, label: c.label, type: c.type, options: c.options || [], custom: true, get: function (r) { return r.custom && r.custom[c.id] != null ? r.custom[c.id] : ''; } };
    });
    var states = (entity === 'advisor' ? S.advisors : S.firms).map(function (r) { return r.state; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
    var stageNames = STAGE_META.map(function (m) { return m.name; });
    if (entity === 'advisor') return [
      { id: 'name', label: 'Name', type: 'text', get: function (r) { return r.name; } },
      { id: 'role', label: 'Role', type: 'select', options: ['Lead advisor', 'Advisor', 'Operations', 'Compliance officer', 'Assistant'], get: function (r) { return r.role; } },
      { id: 'gender', label: 'Gender', type: 'select', options: ['Female', 'Male', 'Another gender'], get: function (r) { return r.gender; } },
      { id: 'age', label: 'Age', type: 'number', get: function (r) { return r.age; } },
      { id: 'staff', label: 'Office staff', type: 'number', get: function (r) { return r.officeStaff; } },
      { id: 'city', label: 'City', type: 'text', get: function (r) { return r.city; } },
      { id: 'state', label: 'State', type: 'select', options: states, get: function (r) { return r.state; } },
      { id: 'firm', label: 'Firm', type: 'select', options: S.firms.map(function (f) { return f.name; }), get: function (r) { return firmName(r.firmId); }, link: function (r) { return 'firm.html?id=' + r.firmId; } },
      { id: 'stage', label: 'Firm stage', type: 'select', options: stageNames, get: function (r) { var f = firmById(r.firmId); return f ? stageNames[f.stage] : ''; } },
      { id: 'rep', label: 'Rep code', type: 'text', mono: true, get: function (r) { return r.repCode || ''; } },
      { id: 'lic', label: 'Licenses', type: 'text', get: function (r) { return r.licenses; } }
    ].concat(cf);
    return [
      { id: 'name', label: 'Firm', type: 'text', get: function (r) { return r.name; }, link: function (r) { return 'firm.html?id=' + r.id; } },
      { id: 'city', label: 'City', type: 'text', get: function (r) { return r.city; } },
      { id: 'state', label: 'State', type: 'select', options: states, get: function (r) { return r.state; } },
      { id: 'stage', label: 'Stage', type: 'select', options: stageNames, get: function (r) { return stageNames[r.stage]; } },
      { id: 'owner', label: 'Owner', type: 'select', options: S.users.map(function (u) { return u.name; }).concat(['Unassigned']), get: function (r) { return userName(r.ownerId); } },
      { id: 'team', label: 'Team', type: 'select', options: DEPTS.slice(), get: function (r) { return r.dept; } },
      { id: 'advisors', label: 'Advisors and staff', type: 'number', get: function (r) { return firmAdvisors(r).length; } },
      { id: 'contacts', label: 'Named contacts', type: 'number', get: function (r) { return r.contacts.length; } },
      { id: 'days', label: 'Days in stage', type: 'number', get: function (r) { return daysIn(r); } },
      { id: 'funds', label: 'Funds', type: 'select', options: ['Received', 'Not yet'], get: function (r) { return r.fundsAt ? 'Received' : 'Not yet'; } }
    ].concat(cf);
  }
  function condMatch(r, c, fields) {
    var fd = fields.filter(function (x) { return x.id === c.field; })[0]; if (!fd || c.value === '' || c.value == null) return true;
    var v = fd.get(r);
    if (fd.type === 'number') { var a = Number(v), b = Number(c.value); if (isNaN(b)) return true; return c.op === 'is' ? a === b : c.op === 'is over' ? a > b : a < b; }
    var A = String(v).toLowerCase(), B = String(c.value).toLowerCase();
    return c.op === 'contains' ? A.indexOf(B) >= 0 : c.op === 'is not' ? A !== B : A === B;
  }
  function runReport(spec) {
    var fields = reportFields(spec.entity), recs = spec.entity === 'advisor' ? visibleAdvisors() : visibleFirms(), conds = spec.conds.filter(function (c) { return c.value !== '' && c.value != null; });
    var out = recs.filter(function (r) { return !conds.length || (spec.match === 'any' ? conds.some(function (c) { return condMatch(r, c, fields); }) : conds.every(function (c) { return condMatch(r, c, fields); })); });
    var sf = fields.filter(function (x) { return x.id === spec.sort.field; })[0];
    if (sf) out.sort(function (a, b) { var A = sf.get(a), B = sf.get(b); if (sf.type === 'number') return (Number(A) - Number(B)) * spec.sort.dir; return String(A).localeCompare(String(B)) * spec.sort.dir; });
    return out;
  }
  function blankSpec(entity) { return { entity: entity, match: 'all', conds: [{ field: entity === 'advisor' ? 'gender' : 'stage', op: 'is', value: '' }], cols: DEFAULT_COLS[entity].slice(), sort: { field: 'name', dir: 1 }, name: '', loadedId: null }; }
  function pageReports(main) {
    var u = currentUser(), canBuild = can('reports.build');
    var visible = S.reports.filter(function (r) { return r.shared || r.by === u.id || canBuild; });
    var spec = main.__rs, ps = params().get('state');
    if (!spec && ps) { spec = main.__rs = blankSpec('advisor'); spec.conds = [{ field: 'state', op: 'is', value: ps.toUpperCase() }]; }
    if (!spec) { var first = visible[0]; spec = main.__rs = first ? copy(first) : blankSpec('advisor'); if (first) { spec.loadedId = first.id; spec.name = first.name; } }
    var fields = reportFields(spec.entity), ro = !canBuild;
    function valueCtl(c, i) {
      var fd = fields.filter(function (x) { return x.id === c.field; })[0] || fields[0], dis = ro ? ' disabled' : '';
      if (fd.type === 'select') return '<select class="select" aria-label="Value for condition ' + (i + 1) + '" data-cv="' + i + '"' + dis + '><option value="">Choose a value</option>' + fd.options.map(function (o) { return '<option' + (String(c.value) === String(o) ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
      return '<input class="input" aria-label="Value for condition ' + (i + 1) + '" data-cv="' + i + '" type="' + (fd.type === 'number' ? 'number' : 'text') + '" value="' + esc(c.value) + '" autocomplete="off"' + dis + '>';
    }
    var condHtml = spec.conds.map(function (c, i) {
      var fd = fields.filter(function (x) { return x.id === c.field; })[0] || fields[0], dis = ro ? ' disabled' : '';
      return '<div class="cond"><div class="cond__top"><label class="sr-only" for="cf-' + i + '">Field for condition ' + (i + 1) + '</label><select id="cf-' + i + '" class="select" data-cf="' + i + '"' + dis + '>' + fields.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === fd.id ? ' selected' : '') + '>' + esc(x.label) + (x.custom ? ' (custom field)' : '') + '</option>'; }).join('') + '</select>' +
        (ro ? '' : '<button type="button" class="icon-btn icon-btn--s" data-rmc="' + i + '" aria-label="Remove condition ' + (i + 1) + '">' + icon('x', 16) + '</button>') + '</div><div class="two"><label class="sr-only" for="co-' + i + '">Operator for condition ' + (i + 1) + '</label><select id="co-' + i + '" class="select" data-co="' + i + '"' + dis + '>' + OPS[fd.type].map(function (o) { return '<option' + (c.op === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>' + valueCtl(c, i) + '</div></div>';
    }).join('');
    main.innerHTML = pageHead('Reports', 'Ask a question about any field, including fields your admins added.', can('export') ? '<button type="button" class="btn btn--primary" id="rp-export">' + icon('download', 16) + ' Export CSV</button>' : '') +
      (ro ? '<div class="callout callout--blue">' + icon('eye') + '<div><strong>You can run shared reports.</strong><div>Building and saving new reports needs the Manager role or above.</div></div></div>' : '') +
      '<div class="rp-grid"><div class="col"><section class="panel"><div class="panel__head"><h2>Your question</h2></div><div class="panel__body"><div class="rp-top"><span>Show</span><label class="sr-only" for="rp-ent">Record type</label><select id="rp-ent" class="select"' + (ro ? ' disabled' : '') + '><option value="advisor"' + (spec.entity === 'advisor' ? ' selected' : '') + '>Advisors and staff</option><option value="firm"' + (spec.entity === 'firm' ? ' selected' : '') + '>Firms</option></select><span>where</span><label class="sr-only" for="rp-match">Match</label><select id="rp-match" class="select"' + (ro ? ' disabled' : '') + '><option value="all"' + (spec.match === 'all' ? ' selected' : '') + '>all are true</option><option value="any"' + (spec.match === 'any' ? ' selected' : '') + '>any is true</option></select></div>' +
      '<div class="conds">' + condHtml + '</div>' + (ro ? '' : '<div class="btn-row" style="margin-top:12px"><button type="button" class="btn btn--secondary btn--small" id="rp-add">' + icon('plus', 15) + ' Add a condition</button></div>') +
      '<h3 class="h3" style="margin-top:18px">Columns</h3><div class="chips">' + fields.map(function (x) { var on = spec.cols.indexOf(x.id) >= 0; return '<button type="button" class="chip-btn' + (on ? ' is-on' : '') + '" data-col="' + esc(x.id) + '" aria-pressed="' + on + '">' + esc(x.label) + '</button>'; }).join('') + '</div>' +
      '<div class="rp-sort"><span class="strong">Sort by</span><label class="sr-only" for="rp-sort">Sort field</label><select id="rp-sort" class="select">' + fields.map(function (x) { return '<option value="' + esc(x.id) + '"' + (spec.sort.field === x.id ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select><button type="button" class="btn btn--secondary btn--small" id="rp-dir">' + (spec.sort.dir === 1 ? 'Ascending' : 'Descending') + '</button></div></div></section>' +
      '<section class="panel"><div class="panel__head"><h2>Saved reports</h2></div>' + (visible.length ? '<ul class="rows">' + visible.map(function (r) {
        return '<li class="rows__item"><div class="grow"><button type="button" class="link-btn strong" data-load="' + r.id + '">' + esc(r.name) + '</button><div class="small muted">' + (r.entity === 'advisor' ? 'Advisors and staff' : 'Firms') + ', ' + (r.shared ? 'shared with everyone' : 'only you') + '</div></div>' + (canBuild ? '<button type="button" class="icon-btn icon-btn--s" data-delrep="' + r.id + '" aria-label="Delete the report ' + esc(r.name) + '">' + icon('x', 16) + '</button>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="panel__body muted">No saved reports yet.</p>') + '</section></div><section class="panel rp-results" id="rp-results"></section></div>';
    function drawResults() {
      var rows = runReport(spec), cols = spec.cols.map(function (id) { return fields.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean);
      var firmsSet = {}, statesSet = {}; if (spec.entity === 'advisor') rows.forEach(function (r) { firmsSet[r.firmId] = 1; statesSet[r.state] = 1; });
      var shown = rows.slice(0, 200);
      document.getElementById('rp-results').innerHTML = '<div class="rp-sum"><div><div class="rp-count">' + rows.length + ' ' + (spec.entity === 'advisor' ? (rows.length === 1 ? 'person matches' : 'people match') : (rows.length === 1 ? 'firm matches' : 'firms match')) + '</div><div class="muted">' + (spec.entity === 'advisor' ? 'Across ' + Object.keys(firmsSet).length + (Object.keys(firmsSet).length === 1 ? ' firm' : ' firms') + ', in ' + Object.keys(statesSet).length + (Object.keys(statesSet).length === 1 ? ' state' : ' states') + '. ' : '') + 'Results are live.</div></div></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr>' + cols.map(function (c) { return '<th' + (c.type === 'number' ? ' class="r"' : '') + '>' + esc(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        (shown.length ? shown.map(function (r) { return '<tr>' + cols.map(function (c) { var v = c.get(r); return '<td' + (c.type === 'number' ? ' class="r num"' : '') + '>' + (c.link ? '<a class="strong" href="' + c.link(r) + '">' + esc(v) + '</a>' : (c.mono ? '<span class="mono">' + esc(v || 'n/a') + '</span>' : esc(v === '' ? 'None' : v))) + '</td>'; }).join('') + '</tr>'; }).join('') : '<tr><td colspan="' + Math.max(1, cols.length) + '" class="empty">Nothing matches these conditions.</td></tr>') + '</tbody></table></div>' +
        (rows.length > 200 ? '<p class="panel__body muted small">Showing the first 200. Export to get them all.</p>' : '') +
        '<div class="rp-foot"><span class="muted">' + (spec.loadedId ? 'Report: <strong class="ink">' + esc(spec.name) + '</strong>' : 'Not saved yet.') + '</span>' + (canBuild ? '<button type="button" class="btn btn--primary btn--small" id="rp-save">Save report</button>' : '') + '</div>';
      var sv = document.getElementById('rp-save'); if (sv) sv.addEventListener('click', saveDialog);
    }
    function saveDialog() {
      var api = dialog({ title: 'Save this report', description: 'It keeps the question, the columns, and the sort.',
        body: '<form id="sr-form" novalidate>' + field('sr-name', 'Name', '<input id="sr-name" class="input" autocomplete="off" value="' + esc(spec.name || '') + '">') + '<label class="check"><input type="checkbox" id="sr-share" checked><span>Share with everyone, so they can run it</span></label><div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Save report</button></div></form>' });
      api.body.querySelector('#sr-name').focus(); api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
      api.body.querySelector('#sr-form').addEventListener('submit', function (e) {
        e.preventDefault(); var name = api.body.querySelector('#sr-name').value.trim();
        if (!name) { setError('sr-name', 'Give the report a name.'); return; }
        var rec = S.reports.filter(function (r) { return r.name.toLowerCase() === name.toLowerCase(); })[0];
        var body = { name: name, entity: spec.entity, match: spec.match, conds: copy(spec.conds), cols: spec.cols.slice(), sort: copy(spec.sort), shared: api.body.querySelector('#sr-share').checked, by: u.id };
        if (rec) { for (var k in body) rec[k] = body[k]; spec.loadedId = rec.id; } else { body.id = nextId('r'); S.reports.push(body); spec.loadedId = body.id; }
        spec.name = name; log('Saved the report "' + name + '"'); save(); api.close(); App.refresh(); toast(rec ? 'Report updated' : 'Report saved');
      });
    }
    function refreshAll() { main.__rs = spec; App.refresh(); }
    drawResults();
    if (!ro) {
      main.querySelector('#rp-ent').addEventListener('change', function (e) { var n = blankSpec(e.target.value); main.__rs = n; App.refresh(); });
      main.querySelector('#rp-match').addEventListener('change', function (e) { spec.match = e.target.value; spec.loadedId = spec.loadedId; refreshAll(); });
      main.querySelector('#rp-add').addEventListener('click', function () { spec.conds.push({ field: fields[0].id, op: 'is', value: '' }); refreshAll(); });
      main.querySelectorAll('[data-rmc]').forEach(function (b) { b.addEventListener('click', function () { spec.conds.splice(Number(b.getAttribute('data-rmc')), 1); if (!spec.conds.length) spec.conds.push({ field: fields[0].id, op: 'is', value: '' }); refreshAll(); }); });
      main.querySelectorAll('[data-cf]').forEach(function (s) { s.addEventListener('change', function () { var i = Number(s.getAttribute('data-cf')); spec.conds[i] = { field: s.value, op: 'is', value: '' }; refreshAll(); }); });
      main.querySelectorAll('[data-co]').forEach(function (s) { s.addEventListener('change', function () { spec.conds[Number(s.getAttribute('data-co'))].op = s.value; drawResults(); }); });
      main.querySelectorAll('[data-cv]').forEach(function (el) { var h = function () { spec.conds[Number(el.getAttribute('data-cv'))].value = el.value; drawResults(); }; el.addEventListener('input', h); el.addEventListener('change', h); });
    }
    main.querySelectorAll('[data-col]').forEach(function (b) { b.addEventListener('click', function () { var id = b.getAttribute('data-col'), i = spec.cols.indexOf(id); if (i >= 0) { if (spec.cols.length > 1) spec.cols.splice(i, 1); } else spec.cols.push(id); refreshAll(); }); });
    main.querySelector('#rp-sort').addEventListener('change', function (e) { spec.sort.field = e.target.value; refreshAll(); });
    main.querySelector('#rp-dir').addEventListener('click', function () { spec.sort.dir = -spec.sort.dir; refreshAll(); });
    main.querySelectorAll('[data-load]').forEach(function (b) { b.addEventListener('click', function () { var r = S.reports.filter(function (x) { return x.id === b.getAttribute('data-load'); })[0]; var n = copy(r); n.loadedId = r.id; main.__rs = n; App.refresh(); toast('Loaded "' + r.name + '"'); }); });
    main.querySelectorAll('[data-delrep]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = S.reports.filter(function (x) { return x.id === b.getAttribute('data-delrep'); })[0];
        confirmDialog({ title: 'Delete the report "' + r.name + '"?', description: 'It is removed for everyone it was shared with.', confirmLabel: 'Delete report', danger: true, onConfirm: function () { S.reports = S.reports.filter(function (x) { return x.id !== r.id; }); if (spec.loadedId === r.id) { spec.loadedId = null; } log('Deleted the report "' + r.name + '"'); save(); App.refresh(); toast('Report deleted'); } });
      });
    });
    var ex = main.querySelector('#rp-export'); if (ex) ex.addEventListener('click', function () {
      var rows = runReport(spec), cols = spec.cols.map(function (id) { return fields.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean);
      download('report.csv', csv([cols.map(function (c) { return c.label; })].concat(rows.map(function (r) { return cols.map(function (c) { return c.get(r); }); }))), 'text/csv'); toast('Exported ' + rows.length + ' rows');
    });
  }

  /* ---------- page: Admin ---------- */
  var PROTECTED_DEPTS = ['Relationship Ops', 'Finance', 'Client Service'];
  var ADMIN_TABS = [['roles', 'Roles and permissions'], ['users', 'Users'], ['teams', 'Teams'], ['lifecycle', 'Lifecycle and checklists'], ['approvals', 'Approvals and recurring'], ['fields', 'Custom fields'], ['integrations', 'Integrations'], ['data', 'Data and hosting'], ['settings', 'Security and AI'], ['audit', 'Audit log']];
  function renameDept(oldN, newN) {
    var i = S.depts.indexOf(oldN); S.depts[i] = newN; DEPTS[i] = newN;
    S.users.forEach(function (u) { if (u.dept === oldN) u.dept = newN; });
    S.tasks.forEach(function (t) { if (t.dept === oldN) t.dept = newN; if (t.blockedOn === oldN) t.blockedOn = newN; });
    S.firms.forEach(function (f) { if (f.dept === oldN) f.dept = newN; });
    S.stages.forEach(function (st) { st.steps.forEach(function (s) { if (s.dept === oldN) s.dept = newN; }); });
    if (DEPT_DEFAULT[oldN]) { DEPT_DEFAULT[newN] = DEPT_DEFAULT[oldN]; delete DEPT_DEFAULT[oldN]; }
  }
  function pageAdmin(main) {
    var ro = !can('admin.edit'), tab = main.__atab || params().get('tab') || 'roles'; main.__atab = tab;
    var body = { roles: adminRoles, users: adminUsers, teams: adminTeams, lifecycle: adminLifecycle, approvals: adminApprovals, fields: adminFields, integrations: adminIntegrations, data: adminData, settings: adminSettings, audit: adminAudit }[tab](main, ro);
    main.innerHTML = pageHead('Admin', ro ? 'You can look at these settings. Changing them needs the Super Admin role.' : 'Change roles, teams, checklists, fields, and settings without a developer.', '') +
      '<div class="tabs tabs--wrap" role="tablist">' + ADMIN_TABS.map(function (t) { var on = tab === t[0]; return '<span class="tab' + (on ? ' is-on' : '') + '"><button type="button" role="tab" aria-selected="' + on + '" data-atab="' + t[0] + '">' + t[1] + '</button></span>'; }).join('') + '</div><div id="admin-body">' + body.html + '</div>';
    main.querySelectorAll('[data-atab]').forEach(function (b) { b.addEventListener('click', function () { main.__atab = b.getAttribute('data-atab'); var q = params(); q.set('tab', main.__atab); history.replaceState(null, '', 'admin.html?' + q.toString()); App.refresh(); }); });
    body.bind(main.querySelector('#admin-body'));
  }
  function aswitch(id, label, on, dis) { return '<span class="switch"><input type="checkbox" id="' + id + '" aria-label="' + esc(label) + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '><span></span></span>'; }

  /* roles */
  function adminRoles(main, ro) {
    var draft = main.__capdraft || (main.__capdraft = copy(S.caps)); main.__scdraft = main.__scdraft || copy(S.scopes);
    function has(r, c) { return r === 'super' || (draft[r] || []).indexOf(c) >= 0; }
    function dirty() { return JSON.stringify(draft) !== JSON.stringify(S.caps) || JSON.stringify(main.__scdraft) !== JSON.stringify(S.scopes); }
    var html = '<section class="panel"><div class="panel__head"><h2>What each role can do</h2>' + (ro ? '' : '<div class="btn-row"><button type="button" class="btn btn--secondary btn--small" id="rl-discard" disabled>Discard</button><button type="button" class="btn btn--primary btn--small" id="rl-save" disabled>Save changes</button></div>') + '</div><div class="table-wrap"><table class="table matrix"><thead><tr><th scope="col">Permission</th>' +
      ROLE_IDS.map(function (r) { return '<th scope="col" class="matrix__plan"><span class="matrix__name">' + ROLES[r] + '</span><span class="cell-sub">' + (function (n) { return n + (n === 1 ? ' person' : ' people'); })(S.users.filter(function (u) { return u.role === r && u.status !== 'deactivated'; }).length) + '</span></th>'; }).join('') + '</tr></thead><tbody>' +
      CAP_GROUPS.map(function (g) {
        return '<tr class="grp"><td colspan="' + (ROLE_IDS.length + 1) + '"><strong>' + g[0] + '</strong></td></tr>' + g[1].map(function (c) {
          return '<tr><th scope="row">' + c[1] + '</th>' + ROLE_IDS.map(function (r) { return '<td class="matrix__cell"><input type="checkbox" class="cbx" data-cap="' + c[0] + '" data-role="' + r + '" aria-label="' + esc(c[1]) + ' for ' + ROLES[r] + '"' + (has(r, c[0]) ? ' checked' : '') + (ro || r === 'super' ? ' disabled' : '') + '></td>'; }).join('') + '</tr>';
        }).join('');
      }).join('') + '</tbody></table></div><div class="panel__foot muted small">Everyone can see shared data. Super Admin always has every permission. Changes apply the next time each person opens a page.</div></section>' + roleScopePanel(main, ro);
    return { html: html, bind: function (root) {
      if (ro) return;
      var sv = root.querySelector('#rl-save'), dc = root.querySelector('#rl-discard');
      function sync() { var d = dirty(); sv.disabled = !d; dc.disabled = !d; }
      root.querySelectorAll('[data-cap]').forEach(function (c) { c.addEventListener('change', function () { var r = c.getAttribute('data-role'), k = c.getAttribute('data-cap'), a = draft[r] || (draft[r] = []), i = a.indexOf(k); if (c.checked && i < 0) a.push(k); if (!c.checked && i >= 0) a.splice(i, 1); sync(); }); });
      root.querySelectorAll('[data-scope]').forEach(function (x) { x.addEventListener('change', function () { var sd = main.__scdraft, r = x.getAttribute('data-srole'); (sd[r] = sd[r] || {})[x.getAttribute('data-scope')] = x.value; sync(); }); });
      sv.addEventListener('click', function () { S.caps = copy(draft); S.scopes = copy(main.__scdraft); log('Changed what roles can do and see'); save(); App.refresh(); toast('Role changes saved'); });
      dc.addEventListener('click', function () { main.__capdraft = null; main.__scdraft = null; App.refresh(); toast('Changes discarded'); });
      sync();
    } };
  }

  /* users */
  function adminUsers(main, ro) {
    var me = currentUser(), supers = S.users.filter(function (u) { return u.role === 'super' && u.status !== 'deactivated'; }).length;
    var html = '<section class="panel"><div class="panel__head"><h2>Users</h2>' + (ro ? '' : '<button type="button" class="btn btn--primary btn--small" id="us-add">' + icon('plus', 15) + ' Invite a user</button>') + '</div><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Role</th><th>Team</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      S.users.map(function (u) {
        var self = u.id === me.id, off = u.status === 'deactivated';
        return '<tr><td><div class="who">' + avatar(u, 30) + '<div><strong>' + esc(u.name) + (self ? ' <span class="muted">(you)</span>' : '') + '</strong><div class="small muted">' + esc(u.email) + '</div></div></div></td>' +
          '<td><label class="sr-only" for="ur-' + u.id + '">Role for ' + esc(u.name) + '</label><select id="ur-' + u.id + '" class="select select--chip" data-role="' + u.id + '"' + (ro || self || off ? ' disabled' : '') + '>' + selectOpts(ROLE_IDS.map(function (r) { return [r, ROLES[r]]; }), u.role) + '</select></td>' +
          '<td><label class="sr-only" for="ut-' + u.id + '">Team for ' + esc(u.name) + '</label><select id="ut-' + u.id + '" class="select select--chip" data-team="' + u.id + '"' + (ro || off ? ' disabled' : '') + '>' + selectOpts(DEPTS, u.dept) + '</select></td>' +
          '<td>' + (off ? '<span class="pill pill--gray">Deactivated</span>' : '<span class="pill pill--green"><span class="pill__dot"></span>Active</span>') + '</td>' +
          '<td>' + (ro || self ? '' : off ? '<button type="button" class="btn btn--ghost btn--small" data-react="' + u.id + '">Reactivate<span class="sr-only"> ' + esc(u.name) + '</span></button>' : '<button type="button" class="btn btn--ghost btn--small" data-deact="' + u.id + '">Deactivate<span class="sr-only"> ' + esc(u.name) + '</span></button>') + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
    return { html: html, bind: function (root) {
      var add = root.querySelector('#us-add');
      if (add) add.addEventListener('click', function () {
        var api = dialog({ title: 'Invite a user', description: 'They can sign in with their work email. In this demo the password is demo-1234.',
          body: '<form id="iu-form" novalidate>' + field('iu-name', 'Full name', '<input id="iu-name" class="input" autocomplete="off">') + field('iu-email', 'Work email', '<input id="iu-email" type="email" class="input" autocomplete="off">') +
            '<div class="two">' + field('iu-role', 'Role', '<select id="iu-role" class="select">' + selectOpts(ROLE_IDS.map(function (r) { return [r, ROLES[r]]; }), 'service') + '</select>') + field('iu-team', 'Team', '<select id="iu-team" class="select">' + selectOpts(DEPTS, 'Client Service') + '</select>') + '</div>' +
            '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Add user</button></div></form>' });
        api.body.querySelector('#iu-name').focus(); api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
        api.body.querySelector('#iu-form').addEventListener('submit', function (e) {
          e.preventDefault(); var name = api.body.querySelector('#iu-name').value.trim(), email = api.body.querySelector('#iu-email').value.trim(), bad = false;
          setError('iu-name', name ? '' : 'Enter their name.'); if (!name) bad = true;
          var em = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'Enter a valid email address.' : (S.users.some(function (u) { return u.email.toLowerCase() === email.toLowerCase(); }) ? 'This person already has an account.' : '');
          setError('iu-email', em); if (em) bad = true; if (bad) return;
          S.users.push({ id: nextId('u'), name: name, email: email, role: api.body.querySelector('#iu-role').value, dept: api.body.querySelector('#iu-team').value, bg: '#E3E8ED', fg: '#1B2A3A', status: 'active' });
          log('Invited ' + name); save(); api.close(); App.refresh(); toast('Added ' + name);
        });
      });
      root.querySelectorAll('[data-role]').forEach(function (s) { s.addEventListener('change', function () { var u = userById(s.getAttribute('data-role')); if (u.role === 'super' && s.value !== 'super' && supers < 2) { s.value = u.role; toast('Keep at least one Super Admin'); return; } u.role = s.value; log('Changed the role of ' + u.name + ' to ' + ROLES[u.role]); save(); App.refresh(); toast(u.name + ' is now ' + ROLES[u.role]); }); });
      root.querySelectorAll('[data-team]').forEach(function (s) { s.addEventListener('change', function () { var u = userById(s.getAttribute('data-team')); u.dept = s.value; log('Moved ' + u.name + ' to ' + u.dept); save(); App.refresh(); toast(u.name + ' is now in ' + u.dept); }); });
      root.querySelectorAll('[data-deact]').forEach(function (b) { b.addEventListener('click', function () {
        var u = userById(b.getAttribute('data-deact')); if (u.role === 'super' && supers < 2) { toast('Keep at least one Super Admin'); return; }
        confirmDialog({ title: 'Deactivate ' + u.name + '?', description: 'They can no longer sign in. Their tasks stay where they are until you reassign them.', confirmLabel: 'Deactivate', danger: true, onConfirm: function () { u.status = 'deactivated'; log('Deactivated ' + u.name); save(); App.refresh(); toast(u.name + ' was deactivated'); } });
      }); });
      root.querySelectorAll('[data-react]').forEach(function (b) { b.addEventListener('click', function () { var u = userById(b.getAttribute('data-react')); u.status = 'active'; log('Reactivated ' + u.name); save(); App.refresh(); toast(u.name + ' is active again'); }); });
    } };
  }

  /* teams */
  function adminTeams(main, ro) {
    var html = '<section class="panel"><div class="panel__head"><h2>Teams</h2>' + (ro ? '' : '<button type="button" class="btn btn--primary btn--small" id="tm-add">' + icon('plus', 15) + ' Add a team</button>') + '</div><div class="table-wrap"><table class="table"><thead><tr><th>Team</th><th class="r">People</th><th class="r">Open tasks</th><th class="r">Firms</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      DEPTS.map(function (d) {
        var people = S.users.filter(function (u) { return u.dept === d && u.status !== 'deactivated'; }).length, open = S.tasks.filter(function (t) { return t.dept === d && isOpen(t); }).length, firms = S.firms.filter(function (f) { return f.dept === d; }).length, prot = PROTECTED_DEPTS.indexOf(d) >= 0, busy = people || open || firms;
        return '<tr><td><strong>' + esc(d) + '</strong>' + (prot ? '<div class="small muted">Used by automatic rules</div>' : '') + '</td><td class="r num">' + people + '</td><td class="r num">' + open + '</td><td class="r num">' + firms + '</td><td>' + (ro ? '' : (prot ? '' : '<button type="button" class="btn btn--ghost btn--small" data-rename="' + esc(d) + '">Rename<span class="sr-only"> ' + esc(d) + '</span></button><button type="button" class="btn btn--ghost btn--small" data-delteam="' + esc(d) + '"' + (busy ? ' disabled title="Move its people and tasks first"' : '') + '>Delete<span class="sr-only"> ' + esc(d) + '</span></button>')) + '</td></tr>';
      }).join('') + '</tbody></table></div><div class="panel__foot muted small">A team can be deleted once it has no people, open tasks, or firms.</div></section>';
    function nameDialog(title, cur, done) {
      var api = dialog({ title: title, body: '<form id="tn-form" novalidate>' + field('tn-name', 'Team name', '<input id="tn-name" class="input" autocomplete="off" value="' + esc(cur) + '">') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Save</button></div></form>' });
      api.body.querySelector('#tn-name').focus(); api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
      api.body.querySelector('#tn-form').addEventListener('submit', function (e) { e.preventDefault(); var v = api.body.querySelector('#tn-name').value.trim(); if (!v) { setError('tn-name', 'Enter a name.'); return; } if (DEPTS.some(function (d) { return d.toLowerCase() === v.toLowerCase() && d !== cur; })) { setError('tn-name', 'A team with this name already exists.'); return; } api.close(); done(v); });
    }
    return { html: html, bind: function (root) {
      var a = root.querySelector('#tm-add'); if (a) a.addEventListener('click', function () { nameDialog('Add a team', '', function (v) { S.depts.push(v); DEPTS.push(v); log('Added the team ' + v); save(); App.refresh(); toast('Added ' + v); }); });
      root.querySelectorAll('[data-rename]').forEach(function (b) { b.addEventListener('click', function () { var old = b.getAttribute('data-rename'); nameDialog('Rename ' + old, old, function (v) { if (v === old) return; renameDept(old, v); log('Renamed the team ' + old + ' to ' + v); save(); App.refresh(); toast('Renamed to ' + v); }); }); });
      root.querySelectorAll('[data-delteam]').forEach(function (b) { b.addEventListener('click', function () { var d = b.getAttribute('data-delteam'); confirmDialog({ title: 'Delete the team ' + d + '?', description: 'It has no people, open tasks, or firms.', confirmLabel: 'Delete team', danger: true, onConfirm: function () { var i = S.depts.indexOf(d); S.depts.splice(i, 1); DEPTS.splice(i, 1); log('Deleted the team ' + d); save(); App.refresh(); toast('Deleted ' + d); } }); }); });
    } };
  }

  /* lifecycle stages and checklists */
  function adminLifecycle(main, ro) {
    var dr = main.__stdraft || (main.__stdraft = { stages: copy(S.stages), targets: S.targets.slice(), names: S.stageNames.slice() }), idx = main.__stidx || 0;
    function dirty() { return JSON.stringify(dr) !== JSON.stringify({ stages: S.stages, targets: S.targets, names: S.stageNames }); }
    var steps = dr.stages[idx].steps, m = STAGE_META[idx];
    var html = '<div class="admin-grid"><section class="panel"><div class="panel__head"><h2>Stage checklists</h2></div><div class="panel__body stage-list">' + STAGE_META.map(function (x, i) { return '<button type="button" class="stage-item' + (i === idx ? ' is-on' : '') + '" data-stage="' + i + '"><span class="stage-item__dot" style="background:' + x.fill + '"></span><span>' + x.name + '</span><span class="muted small">' + dr.stages[i].steps.length + ' steps</span></button>'; }).join('') + '</div></section>' +
      '<div class="col"><div class="field" style="max-width:360px;margin:0"><label for="lc-name">Stage name</label><input id="lc-name" class="input" value="' + esc(dr.names[idx]) + '"' + (ro ? ' disabled' : '') + '></div><div><div class="big-t">' + m.name + ' checklist</div><p class="muted" style="margin-top:4px;max-width:68ch">When a firm moves into ' + m.name + ', these steps are added as tasks for the team named on each step, due the number of days after the move.</p></div>' +
      '<section class="panel"><div class="panel__head"><h2>Steps</h2>' + (ro ? '' : '<div class="btn-row"><button type="button" class="btn btn--secondary btn--small" id="lc-add">' + icon('plus', 15) + ' Add a step</button></div>') + '</div><div class="table-wrap"><table class="table table--steps"><thead><tr><th>Step</th><th>Team</th><th>Due in (days)</th><th>How to do it</th><th><span class="sr-only">Order and remove</span></th></tr></thead><tbody>' +
      (steps.length ? steps.map(function (s, i) {
        return '<tr><td><label class="sr-only" for="sp-t' + i + '">Step ' + (i + 1) + '</label><input id="sp-t' + i + '" class="input" data-k="title" data-i="' + i + '" value="' + esc(s.title) + '"' + (ro ? ' disabled' : '') + '></td><td><select class="select" aria-label="Team for step ' + (i + 1) + '" data-k="dept" data-i="' + i + '"' + (ro ? ' disabled' : '') + '>' + selectOpts(DEPTS, s.dept) + '</select></td>' +
          '<td><input class="input input--num" type="number" min="1" max="365" aria-label="Days for step ' + (i + 1) + '" data-k="days" data-i="' + i + '" value="' + s.days + '"' + (ro ? ' disabled' : '') + '></td><td><input class="input" aria-label="How to do step ' + (i + 1) + '" data-k="how" data-i="' + i + '" value="' + esc(s.how || '') + '" placeholder="Optional instructions"' + (ro ? ' disabled' : '') + '></td>' +
          '<td class="nowrap">' + (ro ? '' : '<button type="button" class="icon-btn icon-btn--s" data-up="' + i + '" aria-label="Move step ' + (i + 1) + ' up"' + (i === 0 ? ' disabled' : '') + '>' + icon('up', 16) + '</button><button type="button" class="icon-btn icon-btn--s" data-down="' + i + '" aria-label="Move step ' + (i + 1) + ' down"' + (i === steps.length - 1 ? ' disabled' : '') + '>' + icon('down', 16) + '</button><button type="button" class="icon-btn icon-btn--s" data-del="' + i + '" aria-label="Remove step ' + (i + 1) + '">' + icon('x', 16) + '</button>') + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="empty">No steps. Add one so firms entering this stage get tasks.</td></tr>') + '</tbody></table></div>' +
      (idx < 4 ? '<div class="panel__foot target-row"><label for="lc-target" class="strong">Target for this stage</label><input id="lc-target" class="input input--num" type="number" min="1" max="999" value="' + (dr.targets[idx] || '') + '"' + (ro ? ' disabled' : '') + '><span class="muted">days. Firms over the target are flagged in red.</span></div>' : '') + '</section>' +
      (ro ? '' : '<div class="savebar"><span class="muted">Changes apply to firms that enter this stage later. Firms already in it keep their current checklist.</span><span class="btn-row"><button type="button" class="btn btn--secondary" id="lc-discard" disabled>Discard</button><button type="button" class="btn btn--primary" id="lc-save" disabled>Save template</button></span></div>') +
      '<section class="panel"><div class="panel__head"><h2>Start another team</h2><span class="muted small">Teams work in parallel, so one team can start while others continue.</span></div>' +
      '<div class="rule"><div><strong>When funds are received</strong><div class="muted">Create the ' + BILLING_STEPS.length + ' billing setup tasks for Finance.</div></div>' + aswitch('rl-funds', 'Create billing tasks when funds are received', S.rules.funds, ro) + '</div>' +
      '<div class="rule"><div><strong>When a firm moves to a new stage</strong><div class="muted">Add that stage\'s checklist as tasks for each team.</div></div>' + aswitch('rl-check', 'Add the checklist when a firm moves', S.rules.checklists, ro) + '</div></section></div></div>';
    return { html: html, bind: function (root) {
      root.querySelectorAll('[data-stage]').forEach(function (b) { b.addEventListener('click', function () { main.__stidx = Number(b.getAttribute('data-stage')); App.refresh(); }); });
      var f1 = root.querySelector('#rl-funds'), f2 = root.querySelector('#rl-check');
      if (!ro) {
        f1.addEventListener('change', function () { S.rules.funds = f1.checked; log((f1.checked ? 'Turned on' : 'Turned off') + ' billing tasks when funds are received'); save(); toast(f1.checked ? 'Billing tasks will be created' : 'Billing tasks will not be created'); });
        f2.addEventListener('change', function () { S.rules.checklists = f2.checked; log((f2.checked ? 'Turned on' : 'Turned off') + ' checklists when a firm moves'); save(); toast(f2.checked ? 'Checklists will be added' : 'Checklists will not be added'); });
        var sv = root.querySelector('#lc-save'), dc = root.querySelector('#lc-discard');
        function sync() { var d = dirty(); sv.disabled = !d; dc.disabled = !d; }
        root.querySelectorAll('[data-k]').forEach(function (el) { var h = function () { var i = Number(el.getAttribute('data-i')), k = el.getAttribute('data-k'); steps[i][k] = k === 'days' ? Number(el.value) : el.value; sync(); }; el.addEventListener('input', h); el.addEventListener('change', h); });
        var tg = root.querySelector('#lc-target'); if (tg) tg.addEventListener('input', function () { dr.targets[idx] = tg.value === '' ? null : Number(tg.value); sync(); });
        var nmi = root.querySelector('#lc-name'); if (nmi) nmi.addEventListener('input', function () { dr.names[idx] = nmi.value; sync(); });
        root.querySelector('#lc-add').addEventListener('click', function () { steps.push({ id: 's' + idx + '-new-' + Date.now().toString(36), title: 'New step', dept: DEPTS[0], days: 7, how: '' }); App.refresh(); });
        root.querySelectorAll('[data-up]').forEach(function (b) { b.addEventListener('click', function () { var i = Number(b.getAttribute('data-up')); steps.splice(i - 1, 0, steps.splice(i, 1)[0]); App.refresh(); }); });
        root.querySelectorAll('[data-down]').forEach(function (b) { b.addEventListener('click', function () { var i = Number(b.getAttribute('data-down')); steps.splice(i + 1, 0, steps.splice(i, 1)[0]); App.refresh(); }); });
        root.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { steps.splice(Number(b.getAttribute('data-del')), 1); App.refresh(); }); });
        sv.addEventListener('click', function () {
          var bad = dr.stages.some(function (st) { return st.steps.some(function (s) { return !String(s.title).trim() || !(s.days >= 1); }); });
          if (bad) { toast('Every step needs a name and a due time of at least 1 day'); return; }
          var nm = dr.names.map(function (x) { return String(x).trim(); }); if (nm.some(function (x) { return !x; }) || nm.some(function (x, i) { return nm.indexOf(x) !== i; })) { toast('Every stage needs a different name'); return; }
          S.stages = copy(dr.stages); S.targets = dr.targets.slice(); S.stageNames = nm; STAGE_META.forEach(function (x, i) { x.target = S.targets[i]; x.name = nm[i]; });
          log('Changed the checklists and stage targets'); save(); App.refresh(); toast('Template saved');
        });
        dc.addEventListener('click', function () { main.__stdraft = null; App.refresh(); toast('Changes discarded'); });
        sync();
      }
    } };
  }

  /* custom fields */
  function adminFields(main, ro) {
    var html = '<section class="panel"><div class="panel__head"><h2>Custom fields</h2>' + (ro ? '' : '<button type="button" class="btn btn--primary btn--small" id="cf-add">' + icon('plus', 15) + ' Add a field</button>') + '</div><div class="table-wrap"><table class="table"><thead><tr><th>Field</th><th>Applies to</th><th>Type</th><th>Choices</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      (S.customFields.length ? S.customFields.map(function (c) { return '<tr><td><strong>' + esc(c.label) + '</strong></td><td>' + (c.entity === 'advisor' ? 'Advisors and staff' : 'Firms') + '</td><td>' + ({ text: 'Text', number: 'Number', select: 'Choice' }[c.type]) + '</td><td>' + (c.type === 'select' ? esc(c.options.join(', ')) : '<span class="muted">None</span>') + '</td><td>' + (ro ? '' : '<button type="button" class="btn btn--ghost btn--small" data-delf="' + c.id + '">Delete<span class="sr-only"> ' + esc(c.label) + '</span></button>') + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="empty">No custom fields yet.</td></tr>') + '</tbody></table></div><div class="panel__foot muted small">New fields appear in the advisor and firm forms and in the report builder, with no developer needed.</div></section>';
    return { html: html, bind: function (root) {
      var a = root.querySelector('#cf-add');
      if (a) a.addEventListener('click', function () {
        var api = dialog({ title: 'Add a custom field', description: 'It shows up in forms and can be used in reports.',
          body: '<form id="cf-form" novalidate>' + field('cf-label', 'Field name', '<input id="cf-label" class="input" autocomplete="off">') + '<div class="two">' + field('cf-ent', 'Applies to', '<select id="cf-ent" class="select"><option value="advisor">Advisors and staff</option><option value="firm">Firms</option></select>') +
            field('cf-type', 'Type', '<select id="cf-type" class="select"><option value="text">Text</option><option value="number">Number</option><option value="select">Choice</option></select>') + '</div>' +
            '<div id="cf-opts-wrap" hidden>' + field('cf-opts', 'Choices', '<input id="cf-opts" class="input" autocomplete="off" placeholder="Email, Phone, Text">', 'Separate with commas.') + '</div><div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Add field</button></div></form>' });
        var b = api.body; b.querySelector('#cf-label').focus(); b.querySelector('[data-cancel]').addEventListener('click', api.close);
        b.querySelector('#cf-type').addEventListener('change', function (e) { b.querySelector('#cf-opts-wrap').hidden = e.target.value !== 'select'; });
        b.querySelector('#cf-form').addEventListener('submit', function (e) {
          e.preventDefault(); var label = b.querySelector('#cf-label').value.trim(), type = b.querySelector('#cf-type').value, ent = b.querySelector('#cf-ent').value, bad = false;
          setError('cf-label', !label ? 'Name the field.' : (S.customFields.some(function (c) { return c.entity === ent && c.label.toLowerCase() === label.toLowerCase(); }) ? 'This field already exists.' : '')); if (!label || b.querySelector('#cf-label-err:not([hidden])')) bad = true;
          var opts = b.querySelector('#cf-opts').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
          if (type === 'select' && opts.length < 2) { setError('cf-opts', 'Give at least two choices.'); bad = true; }
          if (bad) return;
          S.customFields.push({ id: nextId('cf'), entity: ent, label: label, type: type, options: type === 'select' ? opts : [] }); log('Added the custom field ' + label); save(); api.close(); App.refresh(); toast('Field added');
        });
      });
      root.querySelectorAll('[data-delf]').forEach(function (b) { b.addEventListener('click', function () {
        var c = S.customFields.filter(function (x) { return x.id === b.getAttribute('data-delf'); })[0];
        confirmDialog({ title: 'Delete the field "' + c.label + '"?', description: 'The values already entered for it are removed too.', confirmLabel: 'Delete field', danger: true, onConfirm: function () {
          S.customFields = S.customFields.filter(function (x) { return x.id !== c.id; }); (c.entity === 'advisor' ? S.advisors : S.firms).forEach(function (r) { if (r.custom) delete r.custom[c.id]; });
          S.reports.forEach(function (r) { r.conds = r.conds.filter(function (k) { return k.field !== 'cf:' + c.id; }); r.cols = r.cols.filter(function (k) { return k !== 'cf:' + c.id; }); if (!r.cols.length) r.cols = DEFAULT_COLS[r.entity].slice(); });
          log('Deleted the custom field ' + c.label); save(); App.refresh(); toast('Field deleted'); } });
      }); });
    } };
  }

  /* company, security, and AI */
  function aiUsed() { var ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(); return S.aiLog.filter(function (x) { return new Date(x.at).getTime() >= ms; }).length; }
  function adminSettings(main, ro) {
    var s = S.security, sso = s.sso;
    var html = '<div class="cols cols--even"><div class="col">' +
      '<section class="panel"><div class="panel__head"><h2>Sign-in security</h2></div><div class="panel__body"><div class="rule rule--flat"><div><strong>Require MFA for everyone</strong><div class="muted">Staff set up an authenticator app at their next sign-in.</div></div>' + aswitch('se-mfa', 'Require MFA for everyone', s.mfa, ro) + '</div>' +
      '<div class="rule rule--flat"><div><strong>Single sign-on</strong><div class="muted">' + (sso.configured ? 'Connected to ' + esc(sso.provider) + '.' : 'Not connected. People sign in with email and password.') + '</div></div>' + (ro ? '' : '<span class="btn-row"><button type="button" class="btn btn--secondary btn--small" id="se-sso">' + (sso.configured ? 'Change' : 'Set up SSO') + '</button>' + (sso.configured ? '<button type="button" class="btn btn--ghost btn--small" id="se-ssooff">Remove</button>' : '') + '</span>') + '</div></div></section></div>' +
      '<div class="col"><section class="panel"><div class="panel__head"><h2>AI controls</h2></div><div class="panel__body"><div class="rule rule--flat"><div><strong>AI next steps</strong><div class="muted">Adds a suggestions panel to each firm. Turn it off to remove it everywhere.</div></div>' + aswitch('ai-on', 'AI next steps', s.ai, ro) + '</div>' +
      '<div class="field" style="margin-top:12px"><label for="ai-lim">Monthly limit</label><div class="inline-form"><input id="ai-lim" type="number" min="0" class="input input--num" value="' + s.aiLimit + '"' + (ro ? ' disabled' : '') + '><span class="muted" style="align-self:center">calls. ' + aiUsed() + ' used this month.</span></div></div>' +
      '<p class="muted small">Every call is logged below. In this demo the suggestions come from simple rules over the firm\'s own data and nothing leaves the browser. In a real build, the provider\'s data terms are confirmed in writing first.</p></div></section>' +
      '<section class="panel"><div class="panel__head"><h2>AI call log</h2></div>' + (S.aiLog.length ? '<ul class="rows">' + S.aiLog.slice(0, 8).map(function (x) { return '<li class="rows__item"><div class="grow"><strong>' + esc(x.kind) + '</strong> for ' + esc(firmName(x.firmId)) + '<div class="small muted">' + esc(userName(x.by)) + ', ' + fmtDateTime(x.at) + '</div></div></li>'; }).join('') + '</ul>' : '<p class="panel__body muted">No AI calls yet.</p>') + '</section></div></div>';
    return { html: html, bind: function (root) {
      if (ro) return;
      root.querySelector('#se-mfa').addEventListener('change', function (e) { S.security.mfa = e.target.checked; log((S.security.mfa ? 'Turned on' : 'Turned off') + ' required MFA'); save(); toast(S.security.mfa ? 'MFA is now required' : 'MFA is no longer required'); });
      root.querySelector('#ai-on').addEventListener('change', function (e) { S.security.ai = e.target.checked; log((S.security.ai ? 'Turned on' : 'Turned off') + ' AI next steps'); save(); toast(S.security.ai ? 'AI next steps are on' : 'AI next steps are off'); });
      root.querySelector('#ai-lim').addEventListener('change', function (e) { S.security.aiLimit = Math.max(0, Number(e.target.value) || 0); log('Set the monthly AI limit to ' + S.security.aiLimit); save(); App.refresh(); toast('Limit saved'); });
      var so = root.querySelector('#se-sso'); if (so) so.addEventListener('click', function () {
        var api = dialog({ title: 'Set up single sign-on', description: 'Connect your identity provider so people sign in with their work account.',
          body: '<form id="ss-form" novalidate>' + field('ss-prov', 'Provider', '<select id="ss-prov" class="select">' + selectOpts(['Microsoft Entra ID', 'Okta', 'Google Workspace', 'Another SAML provider'], sso.provider || 'Microsoft Entra ID') + '</select>') + field('ss-url', 'Metadata URL', '<input id="ss-url" class="input" autocomplete="off" placeholder="https://login.example.com/metadata">') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Connect</button></div></form>' });
        api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
        api.body.querySelector('#ss-form').addEventListener('submit', function (e) { e.preventDefault(); var u = api.body.querySelector('#ss-url').value.trim(); if (!/^https:\/\/\S+$/.test(u)) { setError('ss-url', 'Enter the https address your provider gave you.'); return; } S.security.sso = { provider: api.body.querySelector('#ss-prov').value, configured: true }; log('Connected single sign-on with ' + S.security.sso.provider); save(); api.close(); App.refresh(); toast('Single sign-on connected'); });
      });
      var off = root.querySelector('#se-ssooff'); if (off) off.addEventListener('click', function () { confirmDialog({ title: 'Remove single sign-on?', description: 'People go back to signing in with email and password.', confirmLabel: 'Remove', danger: true, onConfirm: function () { S.security.sso = { provider: '', configured: false }; log('Removed single sign-on'); save(); App.refresh(); toast('Single sign-on removed'); } }); });
    } };
  }

  /* audit log */
  function adminAudit(main, ro) {
    var f = main.__af || (main.__af = { who: 'all', q: '' });
    var rows = S.audit.filter(function (a) { return (f.who === 'all' || a.by === f.who) && (!f.q || a.text.toLowerCase().indexOf(f.q.toLowerCase()) >= 0); });
    var html = '<div class="filters"><div class="search search--inline"><span class="search__ic">' + icon('search', 16) + '</span><label for="au-q" class="sr-only">Search the log</label><input id="au-q" class="input" placeholder="Search what happened" autocomplete="off" value="' + esc(f.q) + '"></div><label class="sr-only" for="au-who">Person</label><select id="au-who" class="select select--chip"><option value="all">Everyone</option>' + S.users.map(function (u) { return '<option value="' + u.id + '"' + (f.who === u.id ? ' selected' : '') + '>' + esc(u.name) + '</option>'; }).join('') + '</select>' +
      '<span class="filters__r"><button type="button" class="btn btn--secondary btn--small" id="au-export">' + icon('download', 15) + ' Export CSV</button></span></div>' +
      '<section class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Who</th><th>What happened</th></tr></thead><tbody>' + (rows.length ? rows.slice(0, 100).map(function (a) { return '<tr><td class="nowrap">' + fmtDateTime(a.at) + '</td><td><div class="who">' + avatar(a.by, 24) + '<span>' + esc(userName(a.by)) + '</span></div></td><td>' + esc(a.text) + '</td></tr>'; }).join('') : '<tr><td colspan="3" class="empty">Nothing matches. Changes people make in the workspace appear here.</td></tr>') + '</tbody></table></div></section>';
    return { html: html, bind: function (root) {
      var q = root.querySelector('#au-q'); q.addEventListener('input', function () { f.q = q.value; var p = q.selectionStart; App.refresh(); var n = document.querySelector('#au-q'); n.focus(); n.setSelectionRange(p, p); });
      root.querySelector('#au-who').addEventListener('change', function (e) { f.who = e.target.value; App.refresh(); });
      root.querySelector('#au-export').addEventListener('click', function () { download('audit-log.csv', csv([['When', 'Who', 'What happened']].concat(rows.map(function (a) { return [a.at, userName(a.by), a.text]; }))), 'text/csv'); toast('Exported ' + rows.length + ' entries'); });
    } };
  }

  /* =====================================================================
     Part 2: shared support (scopes, working days, approvals, notifications,
     terminology, sessions, recurring work)
     ===================================================================== */
  function dateLoc() { return S && S.work && S.work.dmy ? 'en-GB' : 'en-US'; }
  function isWorkday(d) { return ((S.work && S.work.days) || [1, 2, 3, 4, 5]).indexOf(d.getDay()) >= 0; }
  function dueIn(n) {
    var d = new Date(); d.setHours(12, 0, 0, 0);
    if (!S.work || !S.work.workdays || !((S.work.days || []).length)) { d.setDate(d.getDate() + n); return dstr(d); }
    var left = n, guard = 0; while (left > 0 && guard++ < 2000) { d.setDate(d.getDate() + 1); if (isWorkday(d)) left--; }
    return dstr(d);
  }
  /* what each role is allowed to see: all, its own team, or only its own records */
  function scopeFor(area) { var u = currentUser(); if (!u || u.role === 'super') return 'all'; var sc = S.scopes && S.scopes[u.role]; return (sc && sc[area]) || 'all'; }
  function firmInDept(f, u) { var o = userById(f.ownerId); return f.dept === u.dept || !!(o && o.dept === u.dept); }
  function firmInScope(f) { var sc = scopeFor('firms'), u = currentUser(); if (sc === 'all' || !u) return true; return sc === 'own' ? f.ownerId === u.id : firmInDept(f, u); }
  function visibleFirms() { return S.firms.filter(firmInScope); }
  function visibleAdvisors() { var ok = {}; visibleFirms().forEach(function (f) { ok[f.id] = 1; }); return S.advisors.filter(function (a) { return ok[a.firmId]; }); }
  function taskInScope(t) { var sc = scopeFor('tasks'), u = currentUser(); if (sc === 'all' || !u) return true; if (sc === 'own') return t.assigneeId === u.id; var a = userById(t.assigneeId); return t.dept === u.dept || !!(a && a.dept === u.dept); }
  function visibleTasks() { return S.tasks.filter(taskInScope); }
  function docInScope(d) { var sc = scopeFor('documents'), u = currentUser(); if (sc === 'all' || !u || !d.firmId) return true; var f = firmById(d.firmId); if (!f) return true; return sc === 'own' ? (d.by === u.id || f.ownerId === u.id) : firmInDept(f, u); }
  function visibleDocs() { return S.documents.filter(docInScope); }

  /* sections that group pages as tabs inside one menu item */
  var SUBNAV = { cc: [['index.html', 'Command Center'], ['dashboards.html', 'Dashboards']], firms: [['firms.html', 'Firms'], ['people.html', 'People'], ['map.html', 'Map']], tasks: [['tasks.html', 'Tasks'], ['approvals.html', 'Approvals'], ['tickets.html', 'Tickets']], docs: [['documents.html', 'Documents'], ['communications.html', 'Communications']] };
  function subnav(group, on) {
    return '<nav class="seg seg--nav" aria-label="Section">' + SUBNAV[group].map(function (x) {
      var n = x[1] === 'Approvals' ? approvalsForMe().length : 0;
      return '<a class="seg__b' + (x[1] === on ? ' is-on' : '') + '" href="' + x[0] + '"' + (x[1] === on ? ' aria-current="page"' : '') + '>' + x[1] + (n ? ' <span class="count">' + n + '</span>' : '') + '</a>';
    }).join('') + '</nav>';
  }
  var NAV_OF_PAGE = { firm: 'firms', people: 'firms', map: 'firms', dashboards: 'home', approvals: 'tasks', tickets: 'tasks', communications: 'documents', import: 'admin' };
  function navItems() {
    var order = (S.menu && S.menu.order) || NAV.map(function (n) { return n[3]; }), hidden = (S.menu && S.menu.hidden) || [];
    var list = NAV.slice().sort(function (a, b) { var i = order.indexOf(a[3]), j = order.indexOf(b[3]); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
    return list.filter(function (n) { return (!n[4] || can(n[4])) && (hidden.indexOf(n[3]) < 0 || n[3] === 'admin' || n[3] === 'home'); });
  }

  /* notifications */
  var NOTE_KINDS = { assigned: 'A task is assigned to me', due: 'A task of mine is due today', overdue: 'A task of mine is overdue', blocked: 'A task of mine is blocked on another team', mention: 'Someone mentions me in a note', stage: 'A firm I own moves to a new stage', funds: 'Funds are received for a firm I own', approval: 'Something needs my approval, or is decided' };
  function appOn(uid, kind) { var up = S.userNotif[uid]; if (up && up[kind] != null) return up[kind]; var d = S.notifDefaults[kind]; return d ? d.app : true; }
  function pushNote(uid, kind, text, href) {
    var me = currentUser(); if (!uid || (me && uid === me.id)) return;
    var u = userById(uid); if (!u || u.status === 'deactivated' || !appOn(uid, kind)) return;
    S.notifs.unshift({ id: nextId('nt'), to: uid, kind: kind, text: text, href: href || 'index.html', at: new Date().toISOString(), read: false });
    S.notifs = S.notifs.slice(0, 300);
  }
  function unreadNotes(u) { return S.notifs.filter(function (n) { return n.to === u.id && !n.read; }); }
  function bellCount(u) { return unreadNotes(u).length + overdueMine(u).length; }
  function notifItems(u) {
    var items = S.notifs.filter(function (n) { return n.to === u.id; }).map(function (n) { return { id: n.id, kind: n.kind, text: n.text, href: n.href, at: n.at, read: n.read, real: true }; });
    overdueMine(u).forEach(function (t) { items.push({ id: 'od-' + t.id, kind: 'overdue', text: 'Your task "' + t.title + '" is ' + Math.abs(dayDiff(t.due)) + (Math.abs(dayDiff(t.due)) === 1 ? ' day' : ' days') + ' overdue' + (t.firmId ? ' (' + firmName(t.firmId) + ')' : '') + '.', href: 'tasks.html?task=' + t.id, at: t.due + 'T08:00:00', read: false, real: false }); });
    return items.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }
  function mentionNotes(by, fid, text) {
    S.users.forEach(function (u) { if (u.id !== by && u.status !== 'deactivated' && (text.indexOf('@' + u.name) >= 0 || text.indexOf('@' + u.name.split(' ')[0]) >= 0)) pushNote(u.id, 'mention', userName(by) + ' mentioned you in a note on ' + firmName(fid) + '.', 'firm.html?id=' + fid + '&tab=service'); });
  }

  /* approvals */
  function ruleFor(t) { var r = t.stepId && S.approvalRules[t.stepId]; return r && r.on && r.layers && r.layers.length ? r : null; }
  function approverUsers(role) { return S.users.filter(function (u) { return u.status !== 'deactivated' && (u.role === role || u.role === 'super'); }); }
  function canDecide(req, u) { return req.status === 'pending' && (u.role === req.layers[req.idx] || u.role === 'super') && req.by !== u.id; }
  function approvalsForMe() { var u = currentUser(); return u ? S.approvals.filter(function (r) { return canDecide(r, u); }) : []; }
  function submitForApproval(t, layers, idx, by) {
    var req = { id: nextId('ap'), taskId: t.id, firmId: t.firmId, title: t.title, layers: layers, idx: idx, by: by.id, at: new Date().toISOString(), status: 'pending', events: [] };
    S.approvals.unshift(req); t.status = 'Awaiting approval'; t.approvalId = req.id; t.doneAt = null; t.blockedOn = ''; t.blockedReason = '';
    approverUsers(layers[idx]).forEach(function (u) { pushNote(u.id, 'approval', by.name + ' submitted "' + t.title + '"' + (t.firmId ? ' for ' + firmName(t.firmId) : '') + ' for your approval.', 'approvals.html?id=' + req.id); });
    log('Submitted "' + t.title + '" for approval'); save();
    pendingToast = 'Submitted for approval. It counts as done once ' + ROLES[layers[layers.length - 1]] + ' approves.';
  }
  function decideApproval(req, decision, comment) {
    var by = currentUser(), t = taskById(req.taskId), now = new Date().toISOString();
    req.events.push({ by: by.id, at: now, decision: decision, comment: comment || '', role: req.layers[req.idx] });
    if (decision === 'approve') {
      if (req.idx + 1 < req.layers.length) {
        req.idx += 1;
        approverUsers(req.layers[req.idx]).forEach(function (u) { pushNote(u.id, 'approval', by.name + ' approved "' + req.title + '". It now needs your approval.', 'approvals.html?id=' + req.id); });
        pushNote(req.by, 'approval', '"' + req.title + '" was approved by ' + by.name + ' and moves to ' + ROLES[req.layers[req.idx]] + '.', 'approvals.html?id=' + req.id);
      } else {
        req.status = 'approved'; if (t) { t.status = 'Done'; t.doneAt = now; t.approvalId = null; }
        pushNote(req.by, 'approval', '"' + req.title + '" was approved.', 'approvals.html?id=' + req.id);
        if (req.firmId) addNote(req.firmId, 'handoff', by.id, 'Approved: "' + req.title + '".');
      }
    } else {
      req.status = 'returned'; if (t) { t.status = 'Open'; t.approvalId = null; t.comments.push({ by: by.id, at: now, text: 'Returned by ' + by.name + ': ' + comment }); }
      pushNote(req.by, 'approval', '"' + req.title + '" was returned: ' + comment, 'tasks.html?task=' + req.taskId);
    }
    log((decision === 'approve' ? 'Approved' : 'Returned') + ' "' + req.title + '"'); save();
  }

  /* terminology: the whole workspace follows the words a company chooses */
  var TERM_DEFS = { firm: ['Firm', 'Firms'], advisor: ['Advisor', 'Advisors'], owner: ['Owner', 'Owners'], stage: ['Stage', 'Stages'] };
  function termRules() {
    var out = [];
    Object.keys(TERM_DEFS).forEach(function (k) {
      var cur = (S.terms && S.terms[k]) || TERM_DEFS[k], d = TERM_DEFS[k];
      if (cur[0] === d[0] && cur[1] === d[1]) return;
      out.push([new RegExp('\\b' + d[1] + '\\b', 'g'), cur[1]], [new RegExp('\\b' + d[0] + '\\b', 'g'), cur[0]], [new RegExp('\\b' + d[1].toLowerCase() + '\\b', 'g'), cur[1].toLowerCase()], [new RegExp('\\b' + d[0].toLowerCase() + '\\b', 'g'), cur[0].toLowerCase()]);
    });
    return out;
  }
  var termsDone = (typeof WeakSet !== 'undefined') ? new WeakSet() : null;
  function applyTerms(root) {
    var rules = termRules(); if (!rules.length || !root || !termsDone) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { var p = n.parentNode; if (!p || termsDone.has(n)) return NodeFilter.FILTER_REJECT; var tag = p.nodeName; if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return NodeFilter.FILTER_REJECT; if (p.closest && p.closest('[data-noterms]')) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; } });
    var nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) { termsDone.add(n); var v = n.nodeValue; rules.forEach(function (r) { v = v.replace(r[0], r[1]); }); if (v !== n.nodeValue) n.nodeValue = v; });
    if (root.querySelectorAll) root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(function (el) {
      if (el.closest && el.closest('[data-noterms]')) return;
      ['placeholder', 'aria-label', 'title'].forEach(function (a) { var o = el.getAttribute(a); if (!o || el.getAttribute('data-t-' + a)) return; var v = o; rules.forEach(function (r) { v = v.replace(r[0], r[1]); }); el.setAttribute('data-t-' + a, '1'); if (v !== o) el.setAttribute(a, v); });
    });
  }
  function startTerms() {
    if (!termRules().length) return;
    applyTerms(document.body); document.title = document.title.replace(/\bFirms\b/g, (S.terms.firm || TERM_DEFS.firm)[1]).replace(/\bFirm\b/g, (S.terms.firm || TERM_DEFS.firm)[0]);
    new MutationObserver(function (muts) { muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) applyTerms(n); }); }); }).observe(document.body, { childList: true, subtree: true });
  }

  /* recurring work: Lifetime tasks come back on their own, inside a window before they are due */
  function ensureRecurring() {
    var made = false;
    S.recurring.forEach(function (r) {
      if (!r.active) return;
      S.firms.forEach(function (f) {
        if (f.stage !== 4) return;
        var ts = S.tasks.filter(function (t) { return t.firmId === f.id && t.title === r.title; });
        if (ts.some(isOpen)) return;
        var due;
        if (!ts.length) due = dueIn(r.window);
        else { var last = ts.map(function (t) { return t.due; }).sort().pop(), next = dayShift(new Date(last + 'T12:00:00'), r.every); if (dayDiff(next) - r.window > 0) return; due = dayDiff(next) < 0 ? dueIn(r.window) : next; }
        S.tasks.push({ id: nextId('k'), title: r.title, firmId: f.id, stageIdx: null, stepId: null, dept: r.dept, assigneeId: defaultAssignee(r.dept, f), priority: 'Medium', status: 'Open', due: due, desc: 'Comes back every ' + r.every + ' days.', subtasks: [], blockedOn: '', blockedReason: '', comments: [], createdAt: new Date().toISOString(), doneAt: null });
        made = true;
      });
    });
    if (made) save();
  }

  /* sessions and sign-in */
  function uaLabel() { var u = navigator.userAgent || ''; var b = /Edg/.test(u) ? 'Edge' : /Firefox/.test(u) ? 'Firefox' : /Chrome/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'Browser'; var o = /Windows/.test(u) ? 'Windows' : /iPhone|iPad/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : 'a device'; return b + ' on ' + o; }
  function newSession(u) {
    var sid = nextId('s'), list = S.sessions[u.id] || [];
    list.unshift({ id: sid, at: new Date().toISOString(), ua: uaLabel() }); S.sessions[u.id] = list.slice(0, 6); save(); return sid;
  }
  function recordAudit(by, text) { S.audit.unshift({ id: nextId('a'), at: new Date().toISOString(), by: by, text: text }); S.audit = S.audit.slice(0, 200); }

  /* =====================================================================
     Dashboards, Map, People
     ===================================================================== */
  var STATE_NAMES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
  var TILE_GRID = { AK: [0, 0], ME: [10, 0], WI: [5, 1], VT: [9, 1], NH: [10, 1], WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], MI: [6, 2], NY: [8, 2], MA: [9, 2], OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3], RI: [10, 3], CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4], AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5], OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6], HI: [0, 7], TX: [3, 7], FL: [8, 7] };
  function stateStats(stage, team) {
    var out = {};
    visibleFirms().filter(function (f) { return (stage === 'all' || String(f.stage) === String(stage)) && (team === 'all' || f.dept === team); }).forEach(function (f) {
      var o = out[f.state] || (out[f.state] = { firms: [], adv: 0, staff: 0, women60: 0, licensed: 0 });
      o.firms.push(f); firmAdvisors(f).forEach(function (a) { o.adv++; o.staff += a.officeStaff; if (a.gender === 'Female' && a.age > 60) o.women60++; if (a.repCode) o.licensed++; });
    });
    return out;
  }
  function tileShade(v, max) { if (!v) return ['#eef2f6', '#1B2A3A']; var r = v / max; return r < 0.2 ? ['#cfdaf6', '#1B2A3A'] : r < 0.45 ? ['#9db4ee', '#1B2A3A'] : r < 0.75 ? ['#5a82e0', '#fff'] : ['#2449ae', '#fff']; }
  function tileMap(vals, opts) {
    opts = opts || {}; var max = Math.max.apply(null, Object.keys(vals).map(function (k) { return vals[k]; }).concat([1]));
    return '<div class="tilemap' + (opts.small ? ' tilemap--small' : '') + '" role="group" aria-label="Map of the United States by state">' + Object.keys(TILE_GRID).map(function (st) {
      var v = vals[st] || 0, c = TILE_GRID[st], sh = tileShade(v, max), sel = opts.sel === st, hit = opts.hits && opts.hits.indexOf(st) >= 0;
      var inner = '<span class="tile__s">' + st + '</span><span class="tile__v">' + (v || '') + '</span>';
      var style = 'grid-column:' + (c[0] + 1) + ';grid-row:' + (c[1] + 1) + ';background:' + sh[0] + ';color:' + sh[1];
      return opts.small ? '<span class="tile" style="' + style + '" title="' + esc(STATE_NAMES[st] + ': ' + v) + '">' + inner + '</span>' :
        '<button type="button" class="tile' + (sel ? ' is-sel' : '') + (hit ? ' is-hit' : '') + '" data-state="' + st + '" style="' + style + '" aria-pressed="' + sel + '" aria-label="' + esc(STATE_NAMES[st] + ': ' + v) + '">' + inner + '</button>';
    }).join('') + '</div>';
  }
  var LEGEND = '<div class="legend">Fewer ' + ['#eef2f6', '#cfdaf6', '#9db4ee', '#5a82e0', '#2449ae'].map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + ' More</div>';

  /* ---------- statistics shared by dashboards and Team performance ---------- */
  function taskCategory(t) { if (t.stepId && t.stageIdx != null) return STAGE_META[t.stageIdx].name; return t.dept === 'Finance' ? 'Billing' : 'Service'; }
  function slaStats(tasks, days) {
    var cut = Date.now() - (days || 30) * 864e5, done = tasks.filter(function (t) { return t.status === 'Done' && t.doneAt && new Date(t.doneAt).getTime() >= cut; });
    var on = done.filter(function (t) { return dstr(new Date(t.doneAt)) <= t.due; });
    return { done: done.length, onTime: on.length, pct: done.length ? Math.round(on.length / done.length * 100) : null };
  }
  function plannedStats(tasks, days) {
    var from = dayShift(new Date(), -(days || 30)), today = todayStr();
    var planned = tasks.filter(function (t) { return t.due >= from && t.due <= today; });
    var o = { planned: planned.length, achieved: 0, onTime: 0, late: 0, notDone: 0, blocked: 0, cats: {} };
    planned.forEach(function (t) {
      var c = taskCategory(t), r = o.cats[c] || (o.cats[c] = { planned: 0, achieved: 0 }); r.planned++;
      if (t.status === 'Done') { o.achieved++; r.achieved++; if (t.doneAt && dstr(new Date(t.doneAt)) <= t.due) o.onTime++; else o.late++; }
      else if (t.status === 'Blocked') o.blocked++; else o.notDone++;
    });
    return o;
  }
  function slaTarget() { return S.slaTarget || 80; }
  function donut(pct, label, sub) {
    var p = pct == null ? 0 : pct, under = pct != null && pct < slaTarget();
    return '<div class="donut-row"><div class="donut" style="background:conic-gradient(' + (under ? '#b7791f' : '#1f7a4d') + ' 0 ' + p + '%, #e3e8ed ' + p + '% 100%)"><div class="donut__in">' + (pct == null ? 'None' : pct + '%') + '</div></div><div><div class="strong">' + label + '</div><div class="muted small">' + sub + '</div>' + (pct == null ? '' : '<div style="margin-top:8px">' + (under ? '<span class="pill pill--amber"><span class="pill__dot"></span>' + (slaTarget() - pct) + ' points under target</span>' : '<span class="pill pill--green"><span class="pill__dot"></span>On target</span>') + '</div>') + '</div></div>';
  }

  /* ---------- page: Dashboards ---------- */
  var CARD_TYPES = {
    due: ['Due today and overdue', 'Your tasks that are due today or late.', 2], overdue: ['Overdue by team', 'Overdue tasks for each team.', 1], pipeline: ['Pipeline by stage', 'How many firms are in each stage.', 1],
    queue: ['Onboarding queue', 'Firms in Onboarding and their next step.', 1], notes: ['Recent notes', 'The latest notes across firms.', 1], sla: ['SLA compliance', 'Share of tasks done within their due time.', 1],
    planned: ['Planned vs achieved', 'Tasks due in the last 30 days and how many were finished.', 2], map: ['Firms by state', 'A small map of where firms are.', 1], docs: ['Recent documents', 'The newest files.', 1], tickets: ['Open tickets', 'Service requests waiting on us.', 1], report: ['Saved report', 'The result of a report you saved.', 1]
  };
  function defaultDash() {
    var n = 0, c = function (type, span, ref) { n += 1; return { id: 'c' + n, type: type, span: span, ref: ref || null }; };
    return { defaultId: 'd1', list: [{ id: 'd1', name: 'My dashboard', cards: [c('due', 2), c('sla', 1), c('pipeline', 1), c('overdue', 1), c('map', 1)] }, { id: 'd2', name: 'Service health', cards: [c('sla', 1), c('planned', 2), c('tickets', 1), c('overdue', 1)] }, { id: 'd3', name: 'Pipeline overview', cards: [c('pipeline', 1), c('queue', 1), c('map', 1)] }] };
  }
  function getDash(uid) { if (!S.dash[uid]) S.dash[uid] = defaultDash(); return S.dash[uid]; }
  function cardBody(card, u) {
    var t = card.type;
    if (t === 'due') {
      var list = tasksIn('mine', u).filter(function (x) { return isOpen(x) && dayDiff(x.due) <= 0; }).sort(function (a, b) { return a.due < b.due ? -1 : 1; });
      return list.length ? '<ul class="rows">' + list.slice(0, 5).map(function (x) { return '<li class="rows__item"><button type="button" class="box' + (can('tasks.edit') ? '' : ' box--off') + '" data-done="' + x.id + '" aria-label="Mark ' + esc(x.title) + ' done"' + (can('tasks.edit') ? '' : ' disabled') + '></button><div class="grow"><a class="strong" href="tasks.html?task=' + x.id + '">' + esc(x.title) + '</a><div class="muted small">' + esc(firmName(x.firmId) || 'No firm') + '</div></div>' + dueLabel(x) + '</li>'; }).join('') + '</ul>' : '<p class="panel__body muted">Nothing is due today or overdue for you.</p>';
    }
    if (t === 'overdue') {
      var counts = DEPTS.map(function (d) { return [d, visibleTasks().filter(function (x) { return x.dept === d && isOverdue(x); }).length]; }).filter(function (x) { return x[1] > 0; }).sort(function (a, b) { return b[1] - a[1]; }), mx = counts.length ? counts[0][1] : 1;
      return counts.length ? '<div class="bars">' + counts.map(function (c) { return '<a class="bar-row" href="tasks.html?dept=' + encodeURIComponent(c[0]) + '&due=overdue"><span>' + esc(c[0]) + '</span><span class="bar"><span style="width:' + Math.round(c[1] / mx * 100) + '%"></span></span><strong class="num">' + c[1] + '</strong></a>'; }).join('') + '</div>' : '<p class="panel__body muted">No overdue tasks.</p>';
    }
    if (t === 'pipeline') {
      var cnt = STAGE_META.map(function (m, i) { return visibleFirms().filter(function (f) { return f.stage === i; }).length; }), tot = cnt.reduce(function (a, b) { return a + b; }, 0) || 1;
      return '<div class="panel__body"><div class="stackbar">' + cnt.map(function (n, i) { return n ? '<span style="flex:' + n + ';background:' + STAGE_META[i].fill + '"></span>' : ''; }).join('') + '</div><div class="legend-list">' + STAGE_META.map(function (m, i) { return '<a href="firms.html?stage=' + i + '"><span><i class="dot" style="background:' + m.fill + '"></i>' + m.name + '</span><strong class="num">' + cnt[i] + '</strong></a>'; }).join('') + '</div></div>';
    }
    if (t === 'queue') {
      var fs = visibleFirms().filter(function (f) { return f.stage === 1; });
      return fs.length ? fs.map(function (f) { var p = progress(f), n = nextStep(f); return '<div class="queue"><div class="queue__top"><div><a class="strong" href="firm.html?id=' + f.id + '">' + esc(f.name) + '</a><div class="muted small">Owner ' + esc(userName(f.ownerId)) + '</div></div>' + avatar(f.ownerId, 30) + '</div><div class="queue__bar"><span class="meter"><span style="width:' + Math.round((p.total ? p.done / p.total : 0) * 100) + '%;background:#D08A1E"></span></span><span class="small num">' + p.done + ' of ' + p.total + '</span></div>' + (n ? '<div class="small"><span class="muted">Next step</span> <strong class="' + (isOverdue(n) ? 'red' : '') + '">' + esc(n.title) + '</strong></div>' : '') + '</div>'; }).join('') : '<p class="panel__body muted">No firms are onboarding.</p>';
    }
    if (t === 'notes') return S.notes.slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 3).map(function (n) { return '<div class="note-row">' + avatar(n.by, 28) + '<div><div class="small muted"><a class="strong" href="firm.html?id=' + n.firmId + '&tab=service">' + esc(firmName(n.firmId)) + '</a>, ' + ago(n.at) + '</div><div>' + esc(n.text) + '</div></div></div>'; }).join('');
    if (t === 'sla') { var s = slaStats(visibleTasks(), 30); return '<div class="panel__body">' + donut(s.pct, 'Tasks done within their due time', 'Last 30 days, all teams. Target ' + slaTarget() + '%. ' + s.onTime + ' of ' + s.done + ' on time.') + '</div>'; }
    if (t === 'planned') {
      var p = plannedStats(visibleTasks(), 30), cats = Object.keys(p.cats);
      return '<div class="panel__body"><div class="kv"><span>Planned</span><strong>' + p.planned + '</strong></div><div class="kv"><span>Achieved</span><strong>' + p.achieved + '</strong></div><div class="kv"><span>Achievement rate</span><strong>' + (p.planned ? Math.round(p.achieved / p.planned * 100) + '%' : 'None') + '</strong></div>' + cats.map(function (c) { var r = p.cats[c]; return '<div class="bar-row" style="grid-template-columns:120px minmax(0,1fr) 44px;padding:6px 0"><span>' + esc(c) + '</span><span class="bar"><span style="width:' + Math.round(r.achieved / r.planned * 100) + '%;background:#2f5bd3"></span></span><strong class="num">' + Math.round(r.achieved / r.planned * 100) + '%</strong></div>'; }).join('') + '</div>';
    }
    if (t === 'map') { var st = stateStats('all', 'all'), vals = {}; Object.keys(st).forEach(function (k) { vals[k] = st[k].adv; }); return '<div class="panel__body">' + tileMap(vals, { small: true }) + '<div class="small muted" style="margin-top:8px">Advisors and staff by state. Darker means more.</div></div>'; }
    if (t === 'docs') { var ds = visibleDocs().slice(0, 5); return ds.length ? '<ul class="rows">' + ds.map(function (d) { var st2 = extStyle(d.ext); return '<li class="rows__item"><span class="doc__ext" style="background:' + st2[1] + ';color:' + st2[2] + '">' + st2[0] + '</span><div class="grow"><div class="strong">' + esc(d.title) + '</div><div class="small muted">' + esc(docFirm(d) || 'Shared library') + '</div></div></li>'; }).join('') + '</ul>' : '<p class="panel__body muted">No documents yet.</p>'; }
    if (t === 'tickets') {
      var open = S.tickets.filter(function (k) { return k.status !== 'Resolved'; }), br = open.filter(function (k) { return ticketSla(k).k === 'red'; }).length;
      return '<div class="panel__body"><div class="kv"><span>Open tickets</span><a href="tickets.html"><strong>' + open.length + '</strong></a></div><div class="kv"><span>Past their response time</span><strong class="' + (br ? 'red' : '') + '">' + br + '</strong></div><div class="kv"><span>Waiting on a firm</span><strong>' + S.tickets.filter(function (k) { return k.status === 'Waiting on firm'; }).length + '</strong></div></div>';
    }
    if (t === 'report') {
      var r = S.reports.filter(function (x) { return x.id === card.ref; })[0]; if (!r) return '<p class="panel__body muted">This report was deleted. Remove the card or add a new one.</p>';
      var rows = runReport(r), fl = reportFields(r.entity);
      return '<div class="panel__body"><div class="rp-count" style="font-size:28px">' + rows.length + ' ' + (r.entity === 'advisor' ? 'people' : 'firms') + '</div><div class="muted small" style="margin-bottom:8px">' + esc(r.name) + '</div>' + rows.slice(0, 4).map(function (x) { var f1 = fl.filter(function (q) { return q.id === r.cols[0]; })[0] || fl[0]; return '<div class="kv"><span>' + esc(f1.get(x)) + '</span></div>'; }).join('') + '<a class="link small" href="reports.html">Open the report builder</a></div>';
    }
    return '';
  }
  function pageDashboards(main) {
    var u = currentUser(), D = getDash(u.id), edit = !!main.__dedit, cur = D.list.filter(function (x) { return x.id === (main.__dcur || D.defaultId); })[0] || D.list[0]; main.__dcur = cur.id;
    var cards = cur.cards.map(function (c, i) {
      var ct = CARD_TYPES[c.type], title = c.type === 'report' ? ((S.reports.filter(function (x) { return x.id === c.ref; })[0] || {}).name || 'Saved report') : ct[0];
      var tools = edit ? '<span class="tools"><button type="button" class="icon-btn icon-btn--s" data-cmv="-1" data-ci="' + i + '" aria-label="Move ' + esc(title) + ' earlier"' + (i === 0 ? ' disabled' : '') + '>' + icon('left', 16) + '</button><button type="button" class="icon-btn icon-btn--s" data-cmv="1" data-ci="' + i + '" aria-label="Move ' + esc(title) + ' later"' + (i === cur.cards.length - 1 ? ' disabled' : '') + '>' + icon('right', 16) + '</button><button type="button" class="btn btn--ghost btn--small" data-csz="' + i + '" aria-label="Make ' + esc(title) + ' wider">Width ' + c.span + '</button><button type="button" class="icon-btn icon-btn--s" data-crm="' + i + '" aria-label="Remove ' + esc(title) + '">' + icon('x', 16) + '</button></span>' : '';
      return '<section class="panel dcard" data-dcard="' + c.id + '" style="grid-column:span ' + c.span + '"><div class="panel__head"><h2>' + esc(title) + '</h2><div class="panel__tools">' + tools + '</div></div>' + cardBody(c, u) + '</section>';
    }).join('');
    main.innerHTML = pageHead('Dashboards', 'Build the views you check every day from cards, and choose which one opens first.', subnav('cc', 'Dashboards') +
      '<button type="button" class="btn btn--secondary" id="d-add">' + icon('plus', 16) + ' Add a card</button><button type="button" class="btn btn--secondary" id="d-edit">' + (edit ? 'Done editing' : 'Edit cards') + '</button>' + (cur.id !== D.defaultId ? '<button type="button" class="btn btn--primary" id="d-default">Set as my default</button>' : '')) +
      '<div class="tabs" role="tablist">' + D.list.map(function (x) { var on = x.id === cur.id; return '<span class="tab' + (on ? ' is-on' : '') + '"><button type="button" role="tab" aria-selected="' + on + '" data-dash="' + x.id + '">' + esc(x.name) + (x.id === D.defaultId ? ' <span class="count">default</span>' : '') + '</button></span>'; }).join('') + '<button type="button" class="link-btn tabs__save" id="d-new">New dashboard</button></div>' +
      (edit ? '<div class="btn-row" style="margin-bottom:14px"><button type="button" class="btn btn--secondary btn--small" id="d-rename">Rename this dashboard</button>' + (D.list.length > 1 ? '<button type="button" class="btn btn--ghost btn--small" id="d-del">Delete this dashboard</button>' : '') + '</div>' : '') +
      (cur.cards.length ? '<div class="dgrid">' + cards + '</div>' : '<section class="panel"><p class="panel__body muted">This dashboard has no cards yet. Add one to get started.</p></section>');
    function again() { save(); App.refresh(); }
    main.querySelectorAll('[data-dash]').forEach(function (b) { b.addEventListener('click', function () { main.__dcur = b.getAttribute('data-dash'); App.refresh(); }); });
    main.querySelector('#d-edit').addEventListener('click', function () { main.__dedit = !main.__dedit; App.refresh(); });
    var df = main.querySelector('#d-default'); if (df) df.addEventListener('click', function () { D.defaultId = cur.id; again(); toast('"' + cur.name + '" will open first'); });
    main.querySelector('#d-add').addEventListener('click', function () {
      var api = dialog({ title: 'Add a card', description: 'Choose what to show on "' + cur.name + '".', body: '<div class="stage-pick">' + Object.keys(CARD_TYPES).map(function (k) { return '<button type="button" class="stage-pick__b" data-add="' + k + '" style="border-left-color:#2f5bd3"><span><strong>' + CARD_TYPES[k][0] + '</strong><div class="muted small">' + CARD_TYPES[k][1] + '</div></span></button>'; }).join('') + '</div><div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button></div>' });
      api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
      api.body.querySelectorAll('[data-add]').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-add'), mk = function (ref) { cur.cards.push({ id: nextId('c'), type: k, span: CARD_TYPES[k][2], ref: ref || null }); api.close(); again(); toast('Card added'); };
          if (k !== 'report') return mk();
          if (!S.reports.length) { toast('Save a report first, then add it here'); return; }
          api.body.innerHTML = '<form id="rc-form">' + field('rc-r', 'Which report?', '<select id="rc-r" class="select">' + S.reports.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + '</option>'; }).join('') + '</select>') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel2>Back</button><button type="submit" class="btn btn--primary">Add card</button></div></form>';
          api.body.querySelector('[data-cancel2]').addEventListener('click', api.close); api.body.querySelector('#rc-form').addEventListener('submit', function (e) { e.preventDefault(); mk(api.body.querySelector('#rc-r').value); });
        });
      });
    });
    main.querySelector('#d-new').addEventListener('click', function () {
      var api = dialog({ title: 'New dashboard', body: '<form id="nd-form" novalidate>' + field('nd-name', 'Name', '<input id="nd-name" class="input" autocomplete="off">') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Create</button></div></form>' });
      api.body.querySelector('#nd-name').focus(); api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
      api.body.querySelector('#nd-form').addEventListener('submit', function (e) {
        e.preventDefault(); var n = api.body.querySelector('#nd-name').value.trim();
        if (!n) { setError('nd-name', 'Give the dashboard a name.'); return; } if (D.list.some(function (x) { return x.name.toLowerCase() === n.toLowerCase(); })) { setError('nd-name', 'You already have a dashboard with this name.'); return; }
        var nd = { id: nextId('d'), name: n, cards: [{ id: nextId('c'), type: 'due', span: 2, ref: null }, { id: nextId('c'), type: 'pipeline', span: 1, ref: null }] }; D.list.push(nd); main.__dcur = nd.id; main.__dedit = true; api.close(); again(); toast('Dashboard created');
      });
    });
    var rn = main.querySelector('#d-rename'); if (rn) rn.addEventListener('click', function () {
      var api = dialog({ title: 'Rename this dashboard', body: '<form id="rn-form" novalidate>' + field('rn-name', 'Name', '<input id="rn-name" class="input" value="' + esc(cur.name) + '">') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Save</button></div></form>' });
      api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
      api.body.querySelector('#rn-form').addEventListener('submit', function (e) { e.preventDefault(); var n = api.body.querySelector('#rn-name').value.trim(); if (!n) { setError('rn-name', 'Enter a name.'); return; } cur.name = n; api.close(); again(); toast('Renamed'); });
    });
    var dd = main.querySelector('#d-del'); if (dd) dd.addEventListener('click', function () { confirmDialog({ title: 'Delete "' + cur.name + '"?', description: 'The cards on it are removed. Your other dashboards are not affected.', confirmLabel: 'Delete dashboard', danger: true, onConfirm: function () { D.list = D.list.filter(function (x) { return x.id !== cur.id; }); if (D.defaultId === cur.id) D.defaultId = D.list[0].id; main.__dcur = D.defaultId; again(); toast('Dashboard deleted'); } }); });
    main.querySelectorAll('[data-cmv]').forEach(function (b) { b.addEventListener('click', function () { var i = Number(b.getAttribute('data-ci')), j = i + Number(b.getAttribute('data-cmv')); cur.cards.splice(j, 0, cur.cards.splice(i, 1)[0]); again(); }); });
    main.querySelectorAll('[data-csz]').forEach(function (b) { b.addEventListener('click', function () { var c = cur.cards[Number(b.getAttribute('data-csz'))]; c.span = c.span % 3 + 1; again(); }); });
    main.querySelectorAll('[data-crm]').forEach(function (b) { b.addEventListener('click', function () { cur.cards.splice(Number(b.getAttribute('data-crm')), 1); again(); toast('Card removed'); }); });
    main.querySelectorAll('[data-done]').forEach(function (b) { b.addEventListener('click', function () { completeTask(taskById(b.getAttribute('data-done')), true); App.refresh(); toast('Marked done'); }); });
  }

  /* ---------- page: Map ---------- */
  function pageMap(main) {
    var f = main.__mf || (main.__mf = { layer: 'adv', stage: 'all', team: 'all', q: '', sel: params().get('state') || '' });
    var stats = stateStats(f.stage, f.team), vals = {};
    Object.keys(stats).forEach(function (k) { vals[k] = f.layer === 'firms' ? stats[k].firms.length : f.layer === 'staff' ? stats[k].staff : stats[k].adv; });
    var order = Object.keys(vals).sort(function (a, b) { return vals[b] - vals[a]; });
    if (!f.sel || !stats[f.sel]) f.sel = order[0] || '';
    var q = f.q.trim().toLowerCase(), hits = [], matches = [];
    if (q) {
      Object.keys(TILE_GRID).forEach(function (st) { if (st.toLowerCase() === q || STATE_NAMES[st].toLowerCase().indexOf(q) >= 0) { hits.push(st); matches.push({ st: st, label: STATE_NAMES[st] }); } });
      visibleFirms().forEach(function (fm) { if ((fm.city + ' ' + fm.name + ' ' + fm.address).toLowerCase().indexOf(q) >= 0) { if (hits.indexOf(fm.state) < 0) hits.push(fm.state); matches.push({ st: fm.state, label: fm.name + ', ' + fm.city + ', ' + fm.state }); } });
    }
    var tot = Object.keys(vals).reduce(function (n, k) { return n + vals[k]; }, 0), s = stats[f.sel];
    var what = f.layer === 'firms' ? 'firms' : f.layer === 'staff' ? 'office staff' : 'advisors and staff';
    var side = s ? '<section class="panel"><div class="panel__head"><h2>' + esc(STATE_NAMES[f.sel] || f.sel) + '</h2></div><div class="panel__body"><div class="kv"><span class="muted">Firms</span><strong>' + s.firms.length + '</strong></div><div class="kv"><span class="muted">Advisors and staff</span><strong>' + s.adv + '</strong></div><div class="kv"><span class="muted">Office staff</span><strong>' + s.staff + '</strong></div><div class="kv"><span class="muted">Female, over 60</span><strong>' + s.women60 + '</strong></div><div class="kv"><span class="muted">With a rep code</span><strong>' + s.licensed + '</strong></div><h3 class="h3" style="margin-top:14px">Firms here</h3>' + s.firms.map(function (fm) { return '<div class="kv"><a href="firm.html?id=' + fm.id + '">' + esc(fm.name) + '</a><span class="muted">' + firmAdvisors(fm).length + ' people</span></div>'; }).join('') +
      '<div class="btn-row" style="margin-top:14px"><a class="btn btn--primary btn--small" href="people.html?state=' + f.sel + '">See the people</a><a class="btn btn--secondary btn--small" href="reports.html?state=' + f.sel + '">Run as a report</a></div></div></section>' : '<section class="panel"><p class="panel__body muted">No firms match these filters.</p></section>';
    main.innerHTML = pageHead('Map', 'See where firms and advisors are. Click a state to see who is there.', subnav('firms', 'Map') + (can('export') ? '<button type="button" class="btn btn--secondary" id="mp-export">' + icon('download', 16) + ' Export CSV</button>' : '')) +
      '<div class="filters"><div class="search search--inline"><span class="search__ic">' + icon('search', 16) + '</span><label for="mp-q" class="sr-only">Search a state, city, or firm</label><input id="mp-q" class="input" placeholder="Search a state, city, or firm" autocomplete="off" value="' + esc(f.q) + '"></div>' +
      '<div class="seg" role="tablist" aria-label="Layer">' + [['firms', 'Firms'], ['adv', 'Advisors and staff'], ['staff', 'Office staff']].map(function (l) { return '<button type="button" role="tab" aria-selected="' + (f.layer === l[0]) + '" class="seg__b' + (f.layer === l[0] ? ' is-on' : '') + '" data-layer="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>' +
      '<label class="sr-only" for="mp-stage">Stage</label><select id="mp-stage" class="select select--chip">' + selectOpts(STAGE_META.map(function (m, i) { return [String(i), m.name]; }), f.stage, 'All stages') + '</select><label class="sr-only" for="mp-team">Team</label><select id="mp-team" class="select select--chip">' + selectOpts(['Relationship Ops', 'Client Service'], f.team, 'All teams') + '</select><span class="filters__r muted">' + tot + ' ' + what + ' in ' + order.length + (order.length === 1 ? ' state' : ' states') + '</span></div>' +
      (q ? '<div class="chips" style="margin-bottom:12px">' + (matches.length ? matches.slice(0, 8).map(function (m) { return '<button type="button" class="chip-btn" data-pick="' + m.st + '">' + esc(m.label) + '</button>'; }).join('') : '<span class="muted">Nothing matches "' + esc(f.q) + '".</span>') + '</div>' : '') +
      '<div class="cols"><section class="panel"><div class="panel__body">' + tileMap(vals, { sel: f.sel, hits: hits }) + LEGEND + '</div></section>' + side + '</div>';
    function again() { App.refresh(); }
    var qi = main.querySelector('#mp-q'); qi.addEventListener('input', function () { f.q = qi.value; var p = qi.selectionStart; again(); var n = main.querySelector('#mp-q'); n.focus(); n.setSelectionRange(p, p); });
    main.querySelectorAll('[data-layer]').forEach(function (b) { b.addEventListener('click', function () { f.layer = b.getAttribute('data-layer'); again(); }); });
    main.querySelector('#mp-stage').addEventListener('change', function (e) { f.stage = e.target.value; again(); }); main.querySelector('#mp-team').addEventListener('change', function (e) { f.team = e.target.value; again(); });
    main.querySelectorAll('[data-state]').forEach(function (b) { b.addEventListener('click', function () { f.sel = b.getAttribute('data-state'); again(); }); });
    main.querySelectorAll('[data-pick]').forEach(function (b) { b.addEventListener('click', function () { f.sel = b.getAttribute('data-pick'); f.q = ''; again(); }); });
    var ex = main.querySelector('#mp-export'); if (ex) ex.addEventListener('click', function () { download('firms-by-state.csv', csv([['State', 'Firms', 'Advisors and staff', 'Office staff']].concat(order.map(function (k) { return [STATE_NAMES[k] || k, stats[k].firms.length, stats[k].adv, stats[k].staff]; }))), 'text/csv'); toast('Exported ' + order.length + ' states'); });
  }

  /* ---------- page: People ---------- */
  function pagePeople(main) {
    var P0 = params(), f = main.__pp;
    if (!f) f = main.__pp = { q: P0.get('q') || '', firm: P0.get('firm') || 'all', role: 'all', state: P0.get('state') || 'all', lic: 'all', rep: false, sort: 'name', dir: 1, page: 0, sel: P0.get('sel') || '' };
    var all = visibleAdvisors(), firms = visibleFirms();
    var list = all.filter(function (a) {
      if (f.firm !== 'all' && a.firmId !== f.firm) return false; if (f.role !== 'all' && a.role !== f.role) return false; if (f.state !== 'all' && a.state !== f.state) return false;
      if (f.lic !== 'all' && a.licenses.split(',').map(function (l) { return l.trim(); }).indexOf(f.lic) < 0) return false; if (f.rep && !a.repCode) return false;
      var q = f.q.trim().toLowerCase(); if (q && (a.name + ' ' + a.repCode + ' ' + a.licenses + ' ' + firmName(a.firmId) + ' ' + a.city).toLowerCase().indexOf(q) < 0) return false; return true;
    });
    var key = { name: function (a) { return a.name.toLowerCase(); }, firm: function (a) { return firmName(a.firmId).toLowerCase(); }, rep: function (a) { return a.repCode || 'zzz'; }, staff: function (a) { return a.officeStaff; } }[f.sort];
    list.sort(function (a, b) { var A = key(a), B = key(b); return (A < B ? -1 : A > B ? 1 : 0) * f.dir; });
    var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE)); if (f.page >= pages) f.page = pages - 1;
    var show = list.slice(f.page * PAGE_SIZE, f.page * PAGE_SIZE + PAGE_SIZE), sel = all.filter(function (a) { return a.id === f.sel; })[0]; if (!sel || list.indexOf(sel) < 0) sel = show[0] || null;
    var states = all.map(function (a) { return a.state; }).filter(function (x, i, arr) { return arr.indexOf(x) === i; }).sort();
    function th(label, k, cls) { var on = f.sort === k; return '<th' + (cls ? ' class="' + cls + '"' : '') + ' aria-sort="' + (on ? (f.dir === 1 ? 'ascending' : 'descending') : 'none') + '"><button type="button" class="th-btn" data-sort="' + k + '">' + label + (on ? '<span class="sort">' + icon(f.dir === 1 ? 'up' : 'down', 13) + '</span>' : '') + '</button></th>'; }
    var quick = !sel ? '<aside class="panel quick"><p class="panel__body muted">No one selected.</p></aside>' : (function () {
      var fm = firmById(sel.firmId);
      return '<aside class="panel quick" aria-label="Quick view of ' + esc(sel.name) + '"><div class="quick__body"><div class="who" style="gap:14px">' + '<span class="avatar" style="width:52px;height:52px;background:#E3E8ED;color:#1B2A3A;font-size:20px">' + initials(sel.name) + '</span><div><div class="quick__name" style="font-size:22px">' + esc(sel.name) + '</div><div class="muted">' + esc(sel.role) + ' at <a href="firm.html?id=' + sel.firmId + '">' + esc(fm.name) + '</a></div></div></div>' +
        '<h3>Rep code</h3><div class="codes">' + (sel.repCode ? '<span class="code code--main">' + esc(sel.repCode) + '</span>' : '<span class="muted">None, no license needed</span>') + '</div><h3>Licenses and registrations</h3><div>' + esc(sel.licenses) + '</div><h3>Details</h3>' +
        '<div class="kv"><span class="muted">Age</span><span>' + (sel.age || 'Not recorded') + '</span></div><div class="kv"><span class="muted">Office staff</span><span>' + sel.officeStaff + '</span></div><div class="kv"><span class="muted">City</span><span>' + esc(sel.city) + ', ' + esc(sel.state) + '</span></div>' + customRows(sel, 'advisor') +
        '</div><div class="quick__foot"><a class="btn btn--primary" href="firm.html?id=' + sel.firmId + '&tab=advisors&adv=' + sel.id + '">Open firm</a>' + (can('advisors.edit') ? '<button type="button" class="btn btn--secondary" id="pp-edit">Edit person</button>' : '') + '</div></aside>';
    })();
    main.innerHTML = pageHead('People', all.length + ' advisors and staff across ' + firms.length + ' firms. Search finds names, rep codes, and licenses.', subnav('firms', 'People') + (can('export') ? '<button type="button" class="btn btn--secondary" id="pp-export">' + icon('download', 16) + ' Export CSV</button>' : '') + (can('advisors.edit') ? '<button type="button" class="btn btn--primary" id="pp-add">' + icon('plus', 16) + ' Add person</button>' : '')) +
      '<div class="filters"><div class="search search--inline"><span class="search__ic">' + icon('search', 16) + '</span><label for="pp-q" class="sr-only">Search people</label><input id="pp-q" class="input" placeholder="Search people, rep codes, licenses" autocomplete="off" value="' + esc(f.q) + '"></div>' +
      '<label class="sr-only" for="pp-firm">Firm</label><select id="pp-firm" class="select select--chip"><option value="all">All firms</option>' + firms.map(function (x) { return '<option value="' + x.id + '"' + (f.firm === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' +
      '<label class="sr-only" for="pp-role">Role</label><select id="pp-role" class="select select--chip">' + selectOpts(['Lead advisor', 'Advisor', 'Operations', 'Compliance officer', 'Assistant'], f.role, 'All roles') + '</select><label class="sr-only" for="pp-state">State</label><select id="pp-state" class="select select--chip">' + selectOpts(states, f.state, 'All states') + '</select>' +
      '<label class="sr-only" for="pp-lic">License</label><select id="pp-lic" class="select select--chip">' + selectOpts(allLicenses(), f.lic, 'All licenses') + '</select><label class="tabs__chk" style="margin-left:0"><input type="checkbox" id="pp-rep"' + (f.rep ? ' checked' : '') + '> Has a rep code</label><button type="button" class="link-btn" id="pp-clear">Clear filters</button></div>' +
      '<div class="firms-grid"><section class="panel table-panel"><div class="table-wrap"><table class="table"><thead><tr>' + th('Person', 'name') + th('Firm', 'firm') + th('Rep code', 'rep') + '<th>Licenses</th><th>City</th>' + th('Office staff', 'staff', 'r') + '</tr></thead><tbody>' +
      (show.length ? show.map(function (a) { var on = sel && sel.id === a.id; return '<tr class="' + (on ? 'is-sel' : '') + '" data-prow="' + a.id + '" tabindex="0" aria-selected="' + on + '"><td><div class="who"><span class="avatar" style="width:30px;height:30px;background:#E3E8ED;color:#1B2A3A;font-size:12px">' + initials(a.name) + '</span><div><strong>' + esc(a.name) + '</strong><div class="small muted">' + esc(a.role) + '</div></div></div></td><td><a class="strong" href="firm.html?id=' + a.firmId + '">' + esc(firmName(a.firmId)) + '</a></td><td class="nowrap"><span class="mono">' + esc(a.repCode || 'n/a') + '</span></td><td>' + esc(a.licenses) + '</td><td>' + esc(a.city) + ', ' + esc(a.state) + '</td><td class="r num">' + a.officeStaff + '</td></tr>'; }).join('') : '<tr><td colspan="6" class="empty">No one matches. Clear the filters or try a different search.</td></tr>') + '</tbody></table></div>' +
      '<div class="pager"><span class="muted">' + (list.length ? 'Showing ' + (f.page * PAGE_SIZE + 1) + ' to ' + Math.min(list.length, (f.page + 1) * PAGE_SIZE) + ' of ' + list.length + ' people' : 'No people') + '</span><span class="btn-row"><button type="button" class="btn btn--secondary btn--small" id="pp-prev"' + (f.page === 0 ? ' disabled' : '') + '>Previous</button><button type="button" class="btn btn--secondary btn--small" id="pp-next"' + (f.page >= pages - 1 ? ' disabled' : '') + '>Next</button></span></div></section>' + quick + '</div>';
    function again() { App.refresh(); }
    var qi = main.querySelector('#pp-q'); qi.addEventListener('input', function () { f.q = qi.value; f.page = 0; var p = qi.selectionStart; again(); var n = main.querySelector('#pp-q'); n.focus(); n.setSelectionRange(p, p); });
    [['#pp-firm', 'firm'], ['#pp-role', 'role'], ['#pp-state', 'state'], ['#pp-lic', 'lic']].forEach(function (x) { main.querySelector(x[0]).addEventListener('change', function (e) { f[x[1]] = e.target.value; f.page = 0; again(); }); });
    main.querySelector('#pp-rep').addEventListener('change', function (e) { f.rep = e.target.checked; f.page = 0; again(); });
    main.querySelector('#pp-clear').addEventListener('click', function () { main.__pp = null; history.replaceState(null, '', 'people.html'); again(); });
    main.querySelectorAll('[data-sort]').forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-sort'); if (f.sort === k) f.dir = -f.dir; else { f.sort = k; f.dir = 1; } again(); }); });
    main.querySelectorAll('[data-prow]').forEach(function (r) { function pick() { f.sel = r.getAttribute('data-prow'); again(); } r.addEventListener('click', function (e) { if (e.target.closest('a')) return; pick(); }); r.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.target.closest('a')) pick(); }); });
    main.querySelector('#pp-prev').addEventListener('click', function () { f.page = Math.max(0, f.page - 1); again(); }); main.querySelector('#pp-next').addEventListener('click', function () { f.page += 1; again(); });
    var ed = main.querySelector('#pp-edit'); if (ed && sel) ed.addEventListener('click', function () { openAdvisor(firmById(sel.firmId), sel); });
    var ad = main.querySelector('#pp-add'); if (ad) ad.addEventListener('click', function () {
      var api = dialog({ title: 'Add a person', description: 'Which firm do they work at?', body: '<form id="pf-form">' + field('pf-firm', 'Firm', '<select id="pf-firm" class="select">' + firms.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + '</option>'; }).join('') + '</select>') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Continue</button></div></form>' });
      api.body.querySelector('[data-cancel]').addEventListener('click', api.close); api.body.querySelector('#pf-form').addEventListener('submit', function (e) { e.preventDefault(); var fid = api.body.querySelector('#pf-firm').value; api.close(); openAdvisor(firmById(fid), null); });
    });
    var ex = main.querySelector('#pp-export'); if (ex) ex.addEventListener('click', function () { download('people.csv', csv([['Name', 'Role', 'Firm', 'Rep code', 'Licenses', 'City', 'State', 'Age', 'Gender', 'Office staff']].concat(list.map(function (a) { return [a.name, a.role, firmName(a.firmId), a.repCode, a.licenses, a.city, a.state, a.age, a.gender, a.officeStaff]; }))), 'text/csv'); toast('Exported ' + list.length + ' people'); });
  }

  /* =====================================================================
     Tasks calendar, Approvals, Tickets
     ===================================================================== */
  function taskExtras(main, f, list, again, canEdit) {
    var bar = main.querySelector('.filters'); if (!bar) return;
    bar.insertAdjacentHTML('afterbegin', '<div class="seg" role="tablist" aria-label="View">' + [['list', 'List'], ['calendar', 'Calendar']].map(function (v) { return '<button type="button" role="tab" aria-selected="' + (f.view === v[0]) + '" class="seg__b' + (f.view === v[0] ? ' is-on' : '') + '" data-tview="' + v[0] + '">' + v[1] + '</button>'; }).join('') + '</div>');
    bar.querySelectorAll('[data-tview]').forEach(function (b) { b.addEventListener('click', function () { f.view = b.getAttribute('data-tview'); again(); }); });
    if (f.view !== 'calendar') return;
    var now = new Date(); if (!f.month) f.month = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);
    var y = Number(f.month.slice(0, 4)), m = Number(f.month.slice(5, 7)) - 1, first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), lead = first.getDay(), total = Math.ceil((lead + days) / 7) * 7, today = todayStr();
    var cells = '';
    for (var i = 0; i < total; i++) {
      var d = i - lead + 1, inm = d >= 1 && d <= days, ds = inm ? y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + d).slice(-2) : '';
      var ts = inm ? list.filter(function (t) { return t.due === ds; }) : [];
      cells += '<div class="cal__cell' + (inm ? '' : ' is-off') + (ds === today ? ' is-today' : '') + '"' + (inm ? ' data-day="' + ds + '"' : '') + '><div class="cal__d">' + (inm ? d : '') + '</div>' +
        ts.slice(0, 3).map(function (t) { var k = t.status === 'Done' ? 'green' : t.status === 'Awaiting approval' ? 'amber' : isOverdue(t) ? 'red' : 'blue'; return '<button type="button" class="cal__chip cal__chip--' + k + '" data-ctask="' + t.id + '" draggable="' + (canEdit && t.status !== 'Done') + '" title="' + esc(t.title) + '">' + esc(t.title) + '</button>'; }).join('') +
        (ts.length > 3 ? '<button type="button" class="cal__more" data-cmore="' + ds + '">+' + (ts.length - 3) + ' more</button>' : '') + '</div>';
    }
    var head = '<div class="cal__bar"><button type="button" class="btn btn--secondary btn--small" data-cal="-1" aria-label="Previous month">' + icon('left', 15) + '</button><strong class="cal__title">' + new Date(y, m, 1).toLocaleDateString(dateLoc(), { month: 'long', year: 'numeric' }) + '</strong><button type="button" class="btn btn--secondary btn--small" data-cal="1" aria-label="Next month">' + icon('right', 15) + '</button><button type="button" class="link-btn" data-cal="0">Today</button><span class="muted small" style="margin-left:auto">' + (canEdit ? 'Drag a task to another day to change its due date.' : '') + '</span></div>';
    var grid = '<div class="cal">' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function (n) { return '<div class="cal__h">' + n + '</div>'; }).join('') + cells + '</div>';
    var tbl = main.querySelector('.table--tasks'), panel = tbl && tbl.closest('.panel'); if (!panel) return;
    panel.outerHTML = '<section class="panel" id="cal-panel">' + head + grid + '</section>';
    var gs = main.querySelector('#t-group'); if (gs && gs.closest('.filters__r')) gs.closest('.filters__r').hidden = true;
    main.querySelectorAll('[data-cal]').forEach(function (b) { b.addEventListener('click', function () { var k = Number(b.getAttribute('data-cal')), mm = k === 0 ? now.getMonth() : m + k, yy = k === 0 ? now.getFullYear() : y; if (mm < 0) { mm = 11; yy--; } if (mm > 11) { mm = 0; yy++; } f.month = yy + '-' + ('0' + (mm + 1)).slice(-2); again(); }); });
    main.querySelectorAll('[data-ctask]').forEach(function (b) { b.addEventListener('click', function () { openTask(b.getAttribute('data-ctask')); }); });
    main.querySelectorAll('[data-cmore]').forEach(function (b) { b.addEventListener('click', function () { var ds = b.getAttribute('data-cmore'); var api = dialog({ title: fmtDay(ds), body: '<ul class="rows">' + list.filter(function (t) { return t.due === ds; }).map(function (t) { return '<li class="rows__item"><div class="grow"><a class="strong" href="tasks.html?task=' + t.id + '">' + esc(t.title) + '</a><div class="muted small">' + esc(firmName(t.firmId) || 'No firm') + '</div></div>' + avatar(t.assigneeId, 26) + '</li>'; }).join('') + '</ul><div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Close</button></div>' }); api.body.querySelector('[data-cancel]').addEventListener('click', api.close); }); });
    if (canEdit) {
      var dragId = null;
      main.querySelectorAll('.cal__chip[draggable="true"]').forEach(function (c) { c.addEventListener('dragstart', function (e) { dragId = c.getAttribute('data-ctask'); e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; }); });
      main.querySelectorAll('.cal__cell[data-day]').forEach(function (cell) {
        cell.addEventListener('dragover', function (e) { e.preventDefault(); cell.classList.add('is-over'); }); cell.addEventListener('dragleave', function () { cell.classList.remove('is-over'); });
        cell.addEventListener('drop', function (e) { e.preventDefault(); cell.classList.remove('is-over'); var t = taskById(e.dataTransfer.getData('text/plain') || dragId); if (!t) return; var ds = cell.getAttribute('data-day'); if (t.due === ds) return; t.due = ds; log('Moved the due date of "' + t.title + '" to ' + ds); save(); again(); toast('Due date moved to ' + fmtDay(ds)); });
      });
    }
  }

  /* ---------- page: Approvals ---------- */
  function pageApprovals(main) {
    var u = currentUser(), P0 = params(), tab = main.__aptab || 'waiting'; main.__aptab = tab;
    var waiting = approvalsForMe(), mine = S.approvals.filter(function (r) { return r.by === u.id; }), decided = S.approvals.filter(function (r) { return r.status !== 'pending' && (r.by === u.id || r.events.some(function (e) { return e.by === u.id; })); });
    var pre = P0.get('id') || (P0.get('task') && (S.approvals.filter(function (r) { return r.taskId === P0.get('task'); })[0] || {}).id);
    if (pre && !main.__apsel) { var pr = S.approvals.filter(function (r) { return r.id === pre; })[0]; if (pr) { main.__apsel = pr.id; tab = main.__aptab = canDecide(pr, u) ? 'waiting' : (pr.status === 'pending' ? 'mine' : 'decided'); } }
    var lists = { waiting: waiting, mine: mine, decided: decided }, list = lists[tab];
    var sel = list.filter(function (r) { return r.id === main.__apsel; })[0] || list[0] || null; main.__apsel = sel ? sel.id : null;
    function chain(r) {
      return '<div class="chain">' + [{ t: 'Submitted by ' + userName(r.by).split(' ')[0], c: 'green' }].concat(r.layers.map(function (role, i) { var c = r.status === 'approved' || i < r.idx ? 'green' : (r.status === 'pending' && i === r.idx ? 'blue' : (r.status === 'returned' && i === r.idx ? 'red' : 'gray')); return { t: ROLES[role] + (i < r.idx || r.status === 'approved' ? ' approved' : ' sign-off'), c: c }; })).map(function (x, i) { return (i ? '<span class="muted">›</span>' : '') + '<span class="pill pill--' + x.c + '"><span class="pill__dot"></span>' + esc(x.t) + '</span>'; }).join('') + '</div>';
    }
    function statusPill(r) { return r.status === 'pending' ? '<span class="pill pill--amber"><span class="pill__dot"></span>Waiting for ' + ROLES[r.layers[r.idx]] + '</span>' : r.status === 'approved' ? '<span class="pill pill--green"><span class="pill__dot"></span>Approved</span>' : '<span class="pill pill--red"><span class="pill__dot"></span>Returned</span>'; }
    var rowsHtml = list.map(function (r) {
      var on = sel && sel.id === r.id, f = firmById(r.firmId);
      return '<tr class="' + (on ? 'is-sel' : '') + '" data-ap="' + r.id + '" tabindex="0"><td><span class="strong">' + esc(r.title) + '</span><span class="cell-sub">' + esc(f ? f.name : 'No firm') + '</span></td><td><div class="who">' + avatar(r.by, 26) + '<span>' + esc(userName(r.by)) + '</span></div></td><td class="nowrap">' + ago(r.at) + '</td><td>' + (tab === 'waiting' ? '<button type="button" class="btn btn--primary btn--small" data-quick="' + r.id + '">Approve<span class="sr-only"> ' + esc(r.title) + '</span></button>' : statusPill(r)) + '</td></tr>';
    }).join('');
    var detail = '<section class="panel"><p class="panel__body muted">Nothing to show here.</p></section>';
    if (sel) {
      var t = taskById(sel.taskId), f = firmById(sel.firmId), docs = f ? S.documents.filter(function (d) { return d.firmId === f.id; }).slice(0, 3) : [], decide = canDecide(sel, u);
      detail = '<section class="panel"><div class="panel__head"><h2>' + esc(sel.title) + '</h2>' + statusPill(sel) + '</div><div class="panel__body"><div class="muted" style="margin-top:-4px">' + (f ? '<a href="firm.html?id=' + f.id + '">' + esc(f.name) + '</a>' : 'No firm') + (t ? ', <a href="tasks.html?task=' + t.id + '">open the task</a>' : '') + '</div>' + chain(sel) +
        (t && t.desc ? '<h3 class="h3" style="margin-top:14px">How it should be done</h3><p style="margin:0">' + esc(t.desc) + '</p>' : '') +
        '<h3 class="h3" style="margin-top:14px">Documents on this firm</h3>' + (docs.length ? docs.map(function (d) { var st = extStyle(d.ext); return '<div class="doc" style="padding:6px 0"><span class="doc__ext" style="background:' + st[1] + ';color:' + st[2] + '">' + st[0] + '</span><div><div class="strong">' + esc(d.title) + '</div><div class="small muted">' + fmtSize(d.size) + '</div></div></div>'; }).join('') : '<span class="muted">None linked yet.</span>') +
        (sel.events.length ? '<h3 class="h3" style="margin-top:14px">History</h3>' + sel.events.map(function (e) { return '<div class="note-row" style="padding:8px 0;border-top:1px solid var(--line-2)">' + avatar(e.by, 26) + '<div><div class="small muted"><strong class="ink">' + esc(userName(e.by)) + '</strong> (' + ROLES[e.role] + '), ' + ago(e.at) + '</div><div>' + (e.decision === 'approve' ? 'Approved.' : 'Returned.') + (e.comment ? ' ' + esc(e.comment) : '') + '</div></div></div>'; }).join('') : '') +
        (decide ? '<h3 class="h3" style="margin-top:14px">Your decision</h3><div class="field"><label for="ap-c">Comment</label><textarea id="ap-c" class="textarea" placeholder="Add a comment for the team. Needed when you return it."></textarea></div><div class="form-actions"><button type="button" class="btn btn--secondary" id="ap-ret">Return with comment</button><button type="button" class="btn btn--primary" id="ap-ok">Approve</button></div>' : (sel.status === 'pending' ? '<p class="muted" style="margin:14px 0 0">' + (sel.by === u.id ? 'You submitted this. ' : '') + 'It waits for ' + ROLES[sel.layers[sel.idx]] + ' to decide.</p>' : '')) + '</div></section>';
    }
    main.innerHTML = pageHead('Approvals', 'Work that needs a second pair of eyes before it counts as done.', subnav('tasks', 'Approvals') + (can('admin.view') ? '<a class="btn btn--secondary" href="admin.html?tab=approvals">Approval rules</a>' : '')) +
      '<div class="tabs" role="tablist">' + [['waiting', 'Waiting for me', waiting.length], ['mine', 'I submitted', mine.length], ['decided', 'Decided', decided.length]].map(function (t) { var on = tab === t[0]; return '<span class="tab' + (on ? ' is-on' : '') + '"><button type="button" role="tab" aria-selected="' + on + '" data-aptab="' + t[0] + '">' + t[1] + ' <span class="count">' + t[2] + '</span></button></span>'; }).join('') + '</div>' +
      '<div class="cols"><section class="panel"><div class="table-wrap"><table class="table table--tasks"><thead><tr><th>Item</th><th>Submitted by</th><th>Waiting</th><th>' + (tab === 'waiting' ? 'Decision' : 'Status') + '</th></tr></thead><tbody>' + (rowsHtml || '<tr><td colspan="4" class="empty">' + (tab === 'waiting' ? 'Nothing is waiting for you.' : 'Nothing here yet.') + '</td></tr>') + '</tbody></table></div></section>' + detail + '</div>';
    main.querySelectorAll('[data-aptab]').forEach(function (b) { b.addEventListener('click', function () { main.__aptab = b.getAttribute('data-aptab'); main.__apsel = null; App.refresh(); }); });
    main.querySelectorAll('[data-ap]').forEach(function (r) { function pick() { main.__apsel = r.getAttribute('data-ap'); App.refresh(); } r.addEventListener('click', function (e) { if (e.target.closest('button')) return; pick(); }); r.addEventListener('keydown', function (e) { if (e.key === 'Enter') pick(); }); });
    main.querySelectorAll('[data-quick]').forEach(function (b) { b.addEventListener('click', function () { var r = S.approvals.filter(function (x) { return x.id === b.getAttribute('data-quick'); })[0]; decideApproval(r, 'approve', ''); App.refresh(); toast('Approved'); }); });
    var ok = main.querySelector('#ap-ok'); if (ok) ok.addEventListener('click', function () { decideApproval(sel, 'approve', main.querySelector('#ap-c').value.trim()); App.refresh(); toast(sel.status === 'approved' ? 'Approved. The task is done.' : 'Approved. It moves to the next layer.'); });
    var rt = main.querySelector('#ap-ret'); if (rt) rt.addEventListener('click', function () { var c = main.querySelector('#ap-c').value.trim(); if (!c) { setError('ap-c', 'Say what needs to change.'); main.querySelector('#ap-c').focus(); return; } decideApproval(sel, 'return', c); App.refresh(); toast('Returned with your comment'); });
  }

  /* ---------- page: Tickets ---------- */
  var TICKET_HOURS = { High: 4, Medium: 8, Low: 24 };
  function ticketSla(k) {
    var due = new Date(k.respondBy).getTime(), met = k.firstResponseAt ? new Date(k.firstResponseAt).getTime() <= due : null;
    if (k.firstResponseAt) return { t: met ? 'Met' : 'Missed', k: met ? 'green' : 'red' };
    if (k.status === 'Resolved') return { t: 'Closed', k: 'gray' };
    if (k.status === 'Waiting on firm') return { t: 'Paused', k: 'gray' };
    var ms = due - Date.now(), a = Math.abs(ms), h = Math.floor(a / 36e5), m = Math.floor(a % 36e5 / 6e4), lab = (h ? h + ' h ' : '') + m + ' m';
    return ms < 0 ? { t: 'Breached ' + lab + ' ago', k: 'red' } : { t: lab + ' left', k: ms < 3 * 36e5 ? 'amber' : 'green' };
  }
  var TK_STATUS = { 'Open': 'blue', 'In progress': 'teal', 'Waiting on firm': 'gray', 'Resolved': 'green' };
  function openNewTicket(done) {
    if (!can('tickets.edit')) { toast('Your role cannot create tickets'); return; }
    var api = dialog({ title: 'New ticket', description: 'A service request from a firm.', body: '<form id="tn-form" novalidate>' + field('tn-title', 'What is it about?', '<input id="tn-title" class="input" autocomplete="off">') +
      '<div class="two">' + field('tn-firm', 'Firm', '<select id="tn-firm" class="select">' + visibleFirms().map(function (f) { return '<option value="' + f.id + '">' + esc(f.name) + '</option>'; }).join('') + '</select>') + field('tn-contact', 'Who raised it?', '<input id="tn-contact" class="input" autocomplete="off">') + '</div>' +
      '<div class="two">' + field('tn-prio', 'Priority', '<select id="tn-prio" class="select"><option>High</option><option selected>Medium</option><option>Low</option></select>', 'First response due in 4, 8, or 24 hours.') + field('tn-who', 'Assignee', '<select id="tn-who" class="select">' + userOptions(currentUser().id, true) + '</select>') + '</div>' +
      field('tn-desc', 'Details', '<textarea id="tn-desc" class="textarea"></textarea>') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Create ticket</button></div></form>' });
    var b = api.body; b.querySelector('#tn-title').focus(); b.querySelector('[data-cancel]').addEventListener('click', api.close);
    b.querySelector('#tn-form').addEventListener('submit', function (e) {
      e.preventDefault(); var title = b.querySelector('#tn-title').value.trim(), contact = b.querySelector('#tn-contact').value.trim(), desc = b.querySelector('#tn-desc').value.trim(), bad = false;
      setError('tn-title', title ? '' : 'Say what it is about.'); if (!title) bad = true; setError('tn-contact', contact ? '' : 'Say who raised it.'); if (!contact) bad = true; if (bad) { b.querySelector('[aria-invalid="true"]').focus(); return; }
      var prio = b.querySelector('#tn-prio').value, n = S.tickets.reduce(function (mx, k) { return Math.max(mx, Number(k.no.slice(2)) || 0); }, 1000) + 1, now = Date.now(), who = b.querySelector('#tn-who').value || null;
      var k = { id: nextId('t'), no: 'T-' + n, title: title, firmId: b.querySelector('#tn-firm').value, contact: contact, priority: prio, status: 'Open', assigneeId: who, createdAt: new Date(now).toISOString(), respondBy: new Date(now + TICKET_HOURS[prio] * 36e5).toISOString(), firstResponseAt: null, messages: desc ? [{ id: nextId('m'), by: null, kind: 'firm', text: desc, at: new Date(now).toISOString() }] : [], resolvedAt: null };
      S.tickets.unshift(k); log('Created ticket ' + k.no); if (who) pushNote(who, 'assigned', currentUser().name + ' assigned you ticket ' + k.no + ': ' + title, 'tickets.html?id=' + k.id); save(); api.close(); toast('Ticket ' + k.no + ' created'); if (done) done(k);
    });
  }
  function pageTickets(main) {
    var u = currentUser(), P0 = params(), edit = can('tickets.edit'), tab = main.__tktab || 'open'; main.__tktab = tab;
    var lists = { open: S.tickets.filter(function (k) { return k.status !== 'Resolved'; }), mine: S.tickets.filter(function (k) { return k.assigneeId === u.id && k.status !== 'Resolved'; }), waiting: S.tickets.filter(function (k) { return k.status === 'Waiting on firm'; }), resolved: S.tickets.filter(function (k) { return k.status === 'Resolved'; }) };
    if (P0.get('id') && !main.__tksel) { var pk = S.tickets.filter(function (k) { return k.id === P0.get('id'); })[0]; if (pk) { main.__tksel = pk.id; tab = main.__tktab = pk.status === 'Resolved' ? 'resolved' : 'open'; } }
    var list = lists[tab], sel = list.filter(function (k) { return k.id === main.__tksel; })[0] || list[0] || null; main.__tksel = sel ? sel.id : null;
    var rowsHtml = list.map(function (k) {
      var sl = ticketSla(k), on = sel && sel.id === k.id;
      return '<tr class="' + (on ? 'is-sel' : '') + '" data-tk="' + k.id + '" tabindex="0"><td><span class="mono small">' + k.no + '</span><div class="strong">' + esc(k.title) + '</div></td><td><a href="firm.html?id=' + k.firmId + '">' + esc(firmName(k.firmId)) + '</a><span class="cell-sub">' + esc(k.contact) + '</span></td><td><span class="pill pill--' + PRIO_CLASS[k.priority] + '">' + k.priority + '</span></td><td><span class="pill pill--' + TK_STATUS[k.status] + '">' + k.status + '</span></td><td><div class="who">' + avatar(k.assigneeId, 24) + '<span>' + esc(userName(k.assigneeId).split(' ')[0]) + '</span></div></td><td class="nowrap"><span class="pill pill--' + sl.k + '"><span class="pill__dot"></span>' + sl.t + '</span></td></tr>';
    }).join('');
    var detail = '<section class="panel"><p class="panel__body muted">No ticket selected.</p></section>';
    if (sel) {
      var sl = ticketSla(sel), dis = edit ? '' : ' disabled';
      detail = '<section class="panel"><div class="panel__head"><h2>' + sel.no + '</h2><span class="pill pill--' + sl.k + '"><span class="pill__dot"></span>' + sl.t + '</span></div><div class="panel__body"><div class="strong" style="font-size:16px">' + esc(sel.title) + '</div><div class="muted" style="margin:2px 0 12px"><a href="firm.html?id=' + sel.firmId + '">' + esc(firmName(sel.firmId)) + '</a>, raised by ' + esc(sel.contact) + ', ' + ago(sel.createdAt) + '</div>' +
        '<div class="facts"><div><dt>Status</dt><dd><select class="select select--inline" id="tk-status"' + dis + '>' + selectOpts(['Open', 'In progress', 'Waiting on firm', 'Resolved'], sel.status) + '</select></dd></div><div><dt>Priority</dt><dd><select class="select select--inline" id="tk-prio"' + dis + '>' + selectOpts(['High', 'Medium', 'Low'], sel.priority) + '</select></dd></div><div><dt>Assignee</dt><dd><select class="select select--inline" id="tk-who"' + dis + '>' + userOptions(sel.assigneeId, true) + '</select></dd></div></div>' +
        '<h3 class="h3" style="margin-top:14px">Conversation</h3><div class="convo">' + (sel.messages.length ? sel.messages.map(function (m) { return '<div class="note-row" style="padding:10px 0;border-top:1px solid var(--line-2)">' + (m.by ? avatar(m.by, 28) : '<span class="avatar" style="width:28px;height:28px;background:#E3E8ED;color:#1B2A3A;font-size:11px">' + initials(sel.contact) + '</span>') + '<div><div class="small muted"><strong class="ink">' + esc(m.by ? userName(m.by) : sel.contact) + '</strong>, ' + ago(m.at) + (m.kind === 'internal' ? ' <span class="pill pill--amber">Internal note</span>' : '') + '</div><div>' + esc(m.text) + '</div></div></div>'; }).join('') : '<p class="muted">No messages yet.</p>') + '</div>' +
        (edit ? '<form id="tk-reply" class="reply"><label class="sr-only" for="tk-text">Reply</label><textarea id="tk-text" class="textarea" placeholder="Reply to the firm or add an internal note"></textarea><div class="reply__bar"><label class="check"><input type="checkbox" id="tk-int"><span>Internal note, the firm does not see it</span></label><button type="submit" class="btn btn--primary btn--small">Send</button></div></form><div class="btn-row" style="margin-top:12px">' + (sel.status === 'Resolved' ? '<button type="button" class="btn btn--secondary btn--small" id="tk-reopen">Reopen</button>' : '<button type="button" class="btn btn--secondary btn--small" id="tk-resolve">Resolve</button>') + (can('tasks.create') ? '<button type="button" class="btn btn--secondary btn--small" id="tk-task">Create a task</button>' : '') + '</div>' : '<p class="muted small">Your role can read tickets but not change them.</p>') + '</div></section>';
    }
    main.innerHTML = pageHead('Tickets', 'Service requests from firms, with response times. This replaces the separate ticketing tool.', subnav('tasks', 'Tickets') + (edit ? '<button type="button" class="btn btn--primary" id="tk-new">' + icon('plus', 16) + ' New ticket</button>' : '')) +
      '<div class="tabs" role="tablist">' + [['open', 'Open'], ['mine', 'Mine'], ['waiting', 'Waiting on firm'], ['resolved', 'Resolved']].map(function (t) { var on = tab === t[0]; return '<span class="tab' + (on ? ' is-on' : '') + '"><button type="button" role="tab" aria-selected="' + on + '" data-tktab="' + t[0] + '">' + t[1] + ' <span class="count">' + lists[t[0]].length + '</span></button></span>'; }).join('') + '</div>' +
      '<div class="cols cols--team"><section class="panel"><div class="table-wrap"><table class="table table--tasks"><thead><tr><th>Ticket</th><th>Firm</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Response time</th></tr></thead><tbody>' + (rowsHtml || '<tr><td colspan="6" class="empty">No tickets here.</td></tr>') + '</tbody></table></div></section>' + detail + '</div>';
    main.querySelectorAll('[data-tktab]').forEach(function (b) { b.addEventListener('click', function () { main.__tktab = b.getAttribute('data-tktab'); main.__tksel = null; App.refresh(); }); });
    main.querySelectorAll('[data-tk]').forEach(function (r) { function pick() { main.__tksel = r.getAttribute('data-tk'); App.refresh(); } r.addEventListener('click', function (e) { if (e.target.closest('a')) return; pick(); }); r.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.target.closest('a')) pick(); }); });
    var nt = main.querySelector('#tk-new'); if (nt) nt.addEventListener('click', function () { openNewTicket(function (k) { main.__tksel = k.id; main.__tktab = 'open'; App.refresh(); }); });
    if (sel && edit) {
      main.querySelector('#tk-status').addEventListener('change', function (e) { var v = e.target.value; sel.status = v; sel.resolvedAt = v === 'Resolved' ? new Date().toISOString() : null; log('Ticket ' + sel.no + ' is now ' + v); save(); main.__tktab = v === 'Resolved' ? 'resolved' : (tab === 'resolved' ? 'open' : tab); App.refresh(); toast('Ticket ' + v.toLowerCase()); });
      main.querySelector('#tk-prio').addEventListener('change', function (e) { sel.priority = e.target.value; sel.respondBy = new Date(new Date(sel.createdAt).getTime() + TICKET_HOURS[sel.priority] * 36e5).toISOString(); log('Changed the priority of ' + sel.no); save(); App.refresh(); toast('Priority changed. The response time was recalculated.'); });
      main.querySelector('#tk-who').addEventListener('change', function (e) { sel.assigneeId = e.target.value || null; if (sel.assigneeId) pushNote(sel.assigneeId, 'assigned', u.name + ' assigned you ticket ' + sel.no + ': ' + sel.title, 'tickets.html?id=' + sel.id); log('Assigned ' + sel.no + ' to ' + userName(sel.assigneeId)); save(); App.refresh(); toast('Assigned to ' + userName(sel.assigneeId)); });
      main.querySelector('#tk-reply').addEventListener('submit', function (e) {
        e.preventDefault(); var txt = main.querySelector('#tk-text').value.trim(); if (!txt) { setError('tk-text', 'Write a reply first.'); main.querySelector('#tk-text').focus(); return; }
        var internal = main.querySelector('#tk-int').checked, now = new Date().toISOString(); sel.messages.push({ id: nextId('m'), by: u.id, kind: internal ? 'internal' : 'staff', text: txt, at: now });
        if (!internal && !sel.firstResponseAt) sel.firstResponseAt = now; if (!internal && sel.status === 'Open') sel.status = 'In progress';
        log((internal ? 'Added an internal note to ' : 'Replied on ') + sel.no); save(); App.refresh(); toast(internal ? 'Internal note saved' : 'Reply sent. In this demo nothing is emailed.');
      });
      var rs = main.querySelector('#tk-resolve'); if (rs) rs.addEventListener('click', function () { sel.status = 'Resolved'; sel.resolvedAt = new Date().toISOString(); log('Resolved ' + sel.no); save(); main.__tktab = 'resolved'; App.refresh(); toast('Ticket resolved'); });
      var ro = main.querySelector('#tk-reopen'); if (ro) ro.addEventListener('click', function () { sel.status = 'Open'; sel.resolvedAt = null; log('Reopened ' + sel.no); save(); main.__tktab = 'open'; App.refresh(); toast('Ticket reopened'); });
      var tt = main.querySelector('#tk-task'); if (tt) tt.addEventListener('click', function () { openNewTask({ firmId: sel.firmId, title: sel.no + ': ' + sel.title }); });
    }
  }

  /* =====================================================================
     Communications, e-signature, Team performance tabs
     ===================================================================== */
  function fillTemplate(text, firm, contact) {
    var owner = firm.ownerId ? userName(firm.ownerId) : S.company.name, map = { 'contact first name': contact ? contact.split(' ')[0] : 'there', firm: firm.name, owner: owner, company: S.company.name };
    return text.replace(/\{([^}]+)\}/g, function (m, k) { return map[k] != null ? map[k] : m; });
  }
  function openTemplates(done) {
    var api = dialog({ title: 'Message templates', description: 'Words in curly brackets fill in from the firm and the person: {contact first name}, {firm}, {owner}, {company}.', body: '' });
    function list() {
      api.body.innerHTML = '<ul class="rows">' + S.templates.map(function (t) { return '<li class="rows__item"><div class="grow"><strong>' + esc(t.name) + '</strong><div class="small muted">' + (t.channel === 'email' ? 'Email' : 'Text') + '</div></div><button type="button" class="btn btn--ghost btn--small" data-tedit="' + t.id + '">Edit<span class="sr-only"> ' + esc(t.name) + '</span></button><button type="button" class="btn btn--ghost btn--small" data-tdel="' + t.id + '">Delete<span class="sr-only"> ' + esc(t.name) + '</span></button></li>'; }).join('') + '</ul><div class="form-actions"><button type="button" class="btn btn--secondary" data-close>Close</button><button type="button" class="btn btn--primary" id="tp-new">New template</button></div>';
      api.body.querySelector('[data-close]').addEventListener('click', function () { api.close(); if (done) done(); });
      api.body.querySelector('#tp-new').addEventListener('click', function () { form(null); });
      api.body.querySelectorAll('[data-tedit]').forEach(function (b) { b.addEventListener('click', function () { form(S.templates.filter(function (t) { return t.id === b.getAttribute('data-tedit'); })[0]); }); });
      api.body.querySelectorAll('[data-tdel]').forEach(function (b) { b.addEventListener('click', function () { S.templates = S.templates.filter(function (t) { return t.id !== b.getAttribute('data-tdel'); }); log('Deleted a message template'); save(); list(); toast('Template deleted'); }); });
    }
    function form(t) {
      var c = t || { name: '', channel: 'email', subject: '', body: '' };
      api.body.innerHTML = '<form id="tf-form" novalidate>' + field('tf-name', 'Name', '<input id="tf-name" class="input" value="' + esc(c.name) + '">') + field('tf-ch', 'Channel', '<select id="tf-ch" class="select"><option value="email"' + (c.channel === 'email' ? ' selected' : '') + '>Email</option><option value="text"' + (c.channel === 'text' ? ' selected' : '') + '>Text</option></select>') + field('tf-sub', 'Subject', '<input id="tf-sub" class="input" value="' + esc(c.subject) + '">', 'Email only.') + field('tf-body', 'Message', '<textarea id="tf-body" class="textarea" style="min-height:150px">' + esc(c.body) + '</textarea>') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-back>Back</button><button type="submit" class="btn btn--primary">Save template</button></div></form>';
      api.body.querySelector('[data-back]').addEventListener('click', list);
      api.body.querySelector('#tf-form').addEventListener('submit', function (e) {
        e.preventDefault(); var n = api.body.querySelector('#tf-name').value.trim(), b = api.body.querySelector('#tf-body').value.trim(), ch = api.body.querySelector('#tf-ch').value, sub = api.body.querySelector('#tf-sub').value.trim(), bad = false;
        setError('tf-name', n ? '' : 'Name the template.'); if (!n) bad = true; setError('tf-body', b ? '' : 'Write the message.'); if (!b) bad = true; setError('tf-sub', ch === 'email' && !sub ? 'Give the email a subject.' : ''); if (ch === 'email' && !sub) bad = true; if (bad) return;
        var rec = t || { id: nextId('tp') }; rec.name = n; rec.channel = ch; rec.subject = ch === 'email' ? sub : ''; rec.body = b; if (!t) S.templates.push(rec); log('Saved the template ' + n); save(); list(); toast('Template saved');
      });
    }
    list();
  }
  function pageCommunications(main) {
    var u = currentUser(), canSend = can('comms.send'), firms = visibleFirms();
    var c = main.__cm || (main.__cm = { firm: firms[0] ? firms[0].id : '', to: '', channel: 'email', tpl: '', subject: '', body: '', save: true });
    if (!firmById(c.firm) && firms[0]) c.firm = firms[0].id;
    var fm = firmById(c.firm), contacts = fm ? fm.contacts.map(function (x) { return x.name; }) : [];
    if (contacts.length && contacts.indexOf(c.to) < 0 && !c.otherTo) c.to = contacts[0];
    var tpls = S.templates.filter(function (t) { return t.channel === c.channel; });
    var compose = '<section class="panel"><div class="panel__head"><h2>New message</h2></div><div class="panel__body"><form id="cm-form" novalidate>' +
      '<div class="two">' + field('cm-firm', 'Firm', '<select id="cm-firm" class="select"' + (canSend ? '' : ' disabled') + '>' + firms.map(function (f) { return '<option value="' + f.id + '"' + (f.id === c.firm ? ' selected' : '') + '>' + esc(f.name) + '</option>'; }).join('') + '</select>') +
      field('cm-to', 'To', contacts.length ? '<select id="cm-to" class="select"' + (canSend ? '' : ' disabled') + '>' + contacts.map(function (n) { return '<option' + (n === c.to ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' : '<input id="cm-to" class="input" placeholder="Their name" value="' + esc(c.to) + '"' + (canSend ? '' : ' disabled') + '>') + '</div>' +
      '<div class="two"><div class="field"><label>Channel</label><div class="seg" role="tablist" aria-label="Channel">' + [['email', 'Email'], ['text', 'Text']].map(function (x) { return '<button type="button" role="tab" aria-selected="' + (c.channel === x[0]) + '" class="seg__b' + (c.channel === x[0] ? ' is-on' : '') + '" data-ch="' + x[0] + '"' + (canSend ? '' : ' disabled') + '>' + x[1] + '</button>'; }).join('') + '</div></div>' +
      field('cm-tpl', 'Template', '<select id="cm-tpl" class="select"' + (canSend ? '' : ' disabled') + '><option value="">No template</option>' + tpls.map(function (t) { return '<option value="' + t.id + '"' + (t.id === c.tpl ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') + '</select>') + '</div>' +
      (c.channel === 'email' ? field('cm-sub', 'Subject', '<input id="cm-sub" class="input" value="' + esc(c.subject) + '"' + (canSend ? '' : ' disabled') + '>') : '') +
      field('cm-body', 'Message', '<textarea id="cm-body" class="textarea" style="min-height:150px"' + (canSend ? '' : ' disabled') + '>' + esc(c.body) + '</textarea>', 'Words in curly brackets fill in from the firm and the person.') +
      '<label class="check"><input type="checkbox" id="cm-save"' + (c.save ? ' checked' : '') + (canSend ? '' : ' disabled') + '><span>Save to the firm\'s service history</span></label>' +
      (canSend ? '<div class="form-actions"><button type="button" class="btn btn--secondary" id="cm-prev">Preview</button><button type="submit" class="btn btn--primary">' + icon('send', 16) + ' ' + (c.channel === 'email' ? 'Send email' : 'Send text') + '</button></div>' : '<p class="muted small">Your role can read messages but not send them.</p>') + '</form></div></section>';
    var tplList = '<section class="panel"><div class="panel__head"><h2>Templates</h2>' + (canSend ? '<button type="button" class="btn btn--secondary btn--small" id="cm-manage">Manage templates</button>' : '') + '</div><ul class="rows">' + S.templates.map(function (t) { return '<li class="rows__item"><div class="grow"><strong>' + esc(t.name) + '</strong><div class="small muted">' + (t.channel === 'email' ? 'Email' : 'Text') + '</div></div>' + (canSend ? '<button type="button" class="btn btn--ghost btn--small" data-use="' + t.id + '">Use<span class="sr-only"> ' + esc(t.name) + '</span></button>' : '') + '</li>'; }).join('') + '</ul></section>';
    var sent = '<section class="panel"><div class="panel__head"><h2>Sent from here</h2></div>' + (S.messages.length ? '<ul class="rows">' + S.messages.slice(0, 8).map(function (m) { return '<li class="rows__item"><span class="pill pill--' + (m.channel === 'email' ? 'blue' : 'green') + '" style="padding:5px">' + icon(m.channel === 'email' ? 'mail' : 'phone', 15) + '</span><div class="grow"><strong>' + esc(m.subject || m.body.slice(0, 48)) + '</strong><div class="small muted">' + esc(m.to) + ', <a href="firm.html?id=' + m.firmId + '&tab=service">' + esc(firmName(m.firmId)) + '</a>, ' + esc(userName(m.by)) + ', ' + ago(m.at) + '</div></div></li>'; }).join('') + '</ul>' : '<p class="panel__body muted">Nothing sent yet.</p>') + '</section>';
    main.innerHTML = pageHead('Communications', 'Email and text messages to a firm\'s contacts, saved to its history. In this demo nothing is actually sent.', subnav('docs', 'Communications')) + '<div class="cols">' + compose + '<div class="col">' + tplList + sent + '</div></div>';
    function again() { App.refresh(); }
    function grab() { var s = main.querySelector('#cm-sub'), b = main.querySelector('#cm-body'), sv = main.querySelector('#cm-save'), to = main.querySelector('#cm-to'); if (s) c.subject = s.value; if (b) c.body = b.value; if (sv) c.save = sv.checked; if (to) { c.to = to.value; if (to.tagName === 'INPUT') c.otherTo = true; } }
    function useTpl(id) { var t = S.templates.filter(function (x) { return x.id === id; })[0]; if (!t) return; c.channel = t.channel; c.tpl = id; var f = firmById(c.firm); c.subject = fillTemplate(t.subject || '', f, c.to); c.body = fillTemplate(t.body, f, c.to); }
    if (canSend) {
      main.querySelector('#cm-firm').addEventListener('change', function (e) { grab(); c.firm = e.target.value; c.to = ''; c.otherTo = false; if (c.tpl) useTpl(c.tpl); again(); });
      main.querySelector('#cm-to').addEventListener('change', function () { grab(); if (c.tpl) useTpl(c.tpl); again(); });
      main.querySelectorAll('[data-ch]').forEach(function (b) { b.addEventListener('click', function () { grab(); c.channel = b.getAttribute('data-ch'); c.tpl = ''; again(); }); });
      main.querySelector('#cm-tpl').addEventListener('change', function (e) { grab(); if (e.target.value) useTpl(e.target.value); else c.tpl = ''; again(); });
      main.querySelectorAll('[data-use]').forEach(function (b) { b.addEventListener('click', function () { grab(); useTpl(b.getAttribute('data-use')); again(); toast('Template filled in'); }); });
      var mg = main.querySelector('#cm-manage'); if (mg) mg.addEventListener('click', function () { openTemplates(again); });
      main.querySelector('#cm-prev').addEventListener('click', function () { grab(); var f = firmById(c.firm); var api = dialog({ title: 'Preview', description: 'To ' + (c.to || 'nobody yet') + ' at ' + f.name + ', by ' + (c.channel === 'email' ? 'email' : 'text') + '.', body: (c.channel === 'email' ? '<div class="strong" style="margin-bottom:8px">' + esc(fillTemplate(c.subject, f, c.to)) + '</div>' : '') + '<div style="white-space:pre-wrap">' + esc(fillTemplate(c.body, f, c.to)) + '</div><div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Close</button></div>' }); api.body.querySelector('[data-cancel]').addEventListener('click', api.close); });
      main.querySelector('#cm-form').addEventListener('submit', function (e) {
        e.preventDefault(); grab(); var f = firmById(c.firm), bad = false, sub = fillTemplate(c.subject, f, c.to), body = fillTemplate(c.body, f, c.to).trim();
        if (!c.to.trim()) { setError('cm-to', 'Choose who it is for.'); bad = true; } else setError('cm-to', '');
        if (c.channel === 'email') { if (!sub.trim()) { setError('cm-sub', 'Give the email a subject.'); bad = true; } else setError('cm-sub', ''); }
        if (!body) { setError('cm-body', 'Write the message.'); bad = true; } else setError('cm-body', ''); if (bad) { var bf = main.querySelector('[aria-invalid="true"]'); if (bf) bf.focus(); return; }
        S.messages.unshift({ id: nextId('ms'), firmId: f.id, to: c.to, channel: c.channel, subject: sub, body: body, by: u.id, at: new Date().toISOString() });
        if (c.save) addNote(f.id, 'message', u.id, (c.channel === 'email' ? 'Emailed ' : 'Texted ') + c.to + (sub ? ': "' + sub + '".' : '.'));
        log('Sent a ' + c.channel + ' to ' + c.to + ' at ' + f.name); save(); c.subject = ''; c.body = ''; c.tpl = ''; again(); toast('Saved' + (c.save ? ' to ' + f.name + '\'s history' : '') + '. In this demo nothing is actually sent.');
      });
    }
  }

  /* ---------- e-signature on documents ---------- */
  function sigPill(d) {
    var s = d.sign ? d.sign.status : null;
    return s === 'out' ? '<span class="pill pill--amber"><span class="pill__dot"></span>Out for signature</span>' : s === 'signed' ? '<span class="pill pill--green"><span class="pill__dot"></span>Signed</span>' : s === 'cancelled' ? '<span class="pill pill--gray">Cancelled</span>' : '<span class="muted">Not requested</span>';
  }
  function sigBtn(d) { var has = d.sign && d.sign.status !== 'cancelled'; return (has || can('documents.upload')) ? '<button type="button" class="btn btn--ghost btn--small" data-sig="' + d.id + '">' + (has ? 'Signature' : 'Request signature') + '<span class="sr-only"> for ' + esc(d.title) + '</span></button>' : ''; }
  function openSignature(d) {
    var has = d.sign && d.sign.status !== 'cancelled';
    if (!has) return openSignRequest(d);
    var api = dialog({ title: 'Signature request', variant: 'drawer', body: '' }), edit = can('documents.upload');
    function draw() {
      var sg = d.sign, st = extStyle(d.ext), nextIdx = sg.signers.findIndex(function (x) { return x.status !== 'Signed'; });
      api.body.innerHTML = '<div class="doc"><span class="doc__ext" style="background:' + st[1] + ';color:' + st[2] + '">' + st[0] + '</span><div><div class="strong">' + esc(d.title) + '</div><div class="small muted">' + fmtSize(d.size) + ', ' + esc(d.category) + '</div></div></div><div style="margin:12px 0">' + sigPill(d) + '</div>' +
        '<h3 class="drawer-h">Who signs, in order</h3>' + sg.signers.map(function (x, i) { return '<div class="kv"><span>' + (i + 1) + '. ' + esc(x.name) + ' <span class="muted">' + (x.role === 'firm' ? 'firm' : 'home office') + '</span></span><span class="pill pill--' + (x.status === 'Signed' ? 'green' : x.status === 'Opened' ? 'blue' : 'gray') + '">' + x.status + '</span></div>'; }).join('') +
        '<h3 class="drawer-h">Progress</h3><div class="activity">' + sg.events.slice().reverse().map(function (e) { return '<div class="activity__row"><span class="pill pill--blue" style="padding:6px">' + icon('clock', 14) + '</span><div><div>' + esc(e.text) + '</div><div class="small muted">' + fmtDateTime(e.at) + '</div></div></div>'; }).join('') + '</div>' +
        (edit && sg.status === 'out' ? '<div class="form-actions form-actions--split"><span class="btn-row"><button type="button" class="btn btn--secondary" id="sg-rem">Send a reminder</button><button type="button" class="btn btn--ghost" id="sg-cancel">Cancel request</button></span></div><div class="callout callout--blue">' + icon('eye') + '<div><strong>Demo only</strong><div>Nobody is really being asked. Use these to see what happens next.</div><div class="btn-row" style="margin-top:8px"><button type="button" class="btn btn--secondary btn--small" id="sg-open">Demo: ' + esc(sg.signers[nextIdx].name.split(' ')[0]) + ' opens it</button><button type="button" class="btn btn--primary btn--small" id="sg-sign">Demo: ' + esc(sg.signers[nextIdx].name.split(' ')[0]) + ' signs</button></div></div></div>' : '') +
        (edit && sg.status !== 'out' ? '<div class="form-actions"><button type="button" class="btn btn--secondary" id="sg-again">Start a new request</button></div>' : '');
      function rebind() {
        var b1 = api.body.querySelector('#sg-rem'); if (b1) b1.addEventListener('click', function () { sg.events.push({ text: 'Reminder sent to ' + sg.signers[nextIdx].name, at: new Date().toISOString() }); save(); draw(); toast('Reminder sent. In this demo nothing is emailed.'); });
        var b2 = api.body.querySelector('#sg-cancel'); if (b2) b2.addEventListener('click', function () { sg.status = 'cancelled'; sg.events.push({ text: 'Request cancelled', at: new Date().toISOString() }); log('Cancelled the signature request for "' + d.title + '"'); save(); api.close(); App.refresh(); toast('Signature request cancelled'); });
        var b3 = api.body.querySelector('#sg-open'); if (b3) b3.addEventListener('click', function () { var x = sg.signers[nextIdx]; if (x.status === 'Waiting') { x.status = 'Opened'; x.at = new Date().toISOString(); sg.events.push({ text: x.name + ' opened the document', at: x.at }); } save(); draw(); toast('Marked as opened'); });
        var b4 = api.body.querySelector('#sg-sign'); if (b4) b4.addEventListener('click', function () {
          var x = sg.signers[nextIdx], now = new Date().toISOString(); x.status = 'Signed'; x.at = now; sg.events.push({ text: x.name + ' signed', at: now });
          if (sg.signers.every(function (y) { return y.status === 'Signed'; })) { sg.status = 'signed'; sg.events.push({ text: 'All signatures collected.', at: now }); if (d.firmId) addNote(d.firmId, 'handoff', currentUser().id, 'Signed by everyone: "' + d.title + '".'); pushNote(sg.by, 'approval', '"' + d.title + '" is fully signed.', 'documents.html'); log('"' + d.title + '" was fully signed'); }
          save(); App.refresh(); draw(); toast(sg.status === 'signed' ? 'Fully signed' : 'Signed. The next person is asked.');
        });
        var b5 = api.body.querySelector('#sg-again'); if (b5) b5.addEventListener('click', function () { api.close(); openSignRequest(d); });
      }
      rebind();
    }
    draw();
  }
  function openSignRequest(d) {
    if (!can('documents.upload')) { toast('Your role cannot request signatures'); return; }
    var f = d.firmId ? firmById(d.firmId) : null, contacts = f ? f.contacts : [], homeDefault = (f && f.ownerId) || currentUser().id;
    var api = dialog({ title: 'Request a signature', description: d.title, body: '<form id="sr-form" novalidate>' +
      (contacts.length ? '<div class="field"><label>Who signs at the firm</label>' + contacts.map(function (x, i) { return '<label class="check"><input type="checkbox" data-sgn="' + esc(x.name) + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(x.name) + ' <span class="muted">' + esc(x.title) + '</span></span></label>'; }).join('') + '</div>' : field('sr-name', 'Who signs at the firm', '<input id="sr-name" class="input" placeholder="Their name">', 'This document is not linked to a firm, so type the name.')) +
      field('sr-home', 'Home office signer, signs last', '<select id="sr-home" class="select">' + S.users.filter(function (u) { return u.status !== 'deactivated'; }).map(function (u) { return '<option value="' + u.id + '"' + (u.id === homeDefault ? ' selected' : '') + '>' + esc(u.name) + '</option>'; }).join('') + '</select>') +
      field('sr-msg', 'Message', '<textarea id="sr-msg" class="textarea">Please review and sign this document.</textarea>') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Send for signature</button></div></form>' });
    var b = api.body; b.querySelector('[data-cancel]').addEventListener('click', api.close);
    b.querySelector('#sr-form').addEventListener('submit', function (e) {
      e.preventDefault(); var names = contacts.length ? Array.prototype.slice.call(b.querySelectorAll('[data-sgn]:checked')).map(function (x) { return x.getAttribute('data-sgn'); }) : [b.querySelector('#sr-name').value.trim()].filter(Boolean);
      if (!names.length) { if (contacts.length) toast('Choose at least one person at the firm'); else setError('sr-name', 'Enter who signs at the firm.'); return; }
      var home = userById(b.querySelector('#sr-home').value), now = new Date().toISOString();
      d.sign = { status: 'out', by: currentUser().id, signers: names.map(function (n) { return { name: n, role: 'firm', status: 'Waiting', at: null }; }).concat([{ name: home.name, role: 'home', status: 'Waiting', at: null }]), events: [{ text: 'Sent for signature to ' + names.join(', ') + ' and ' + home.name, at: now }] };
      if (d.firmId) addNote(d.firmId, 'message', currentUser().id, 'Sent "' + d.title + '" for signature.'); log('Requested a signature on "' + d.title + '"'); save(); api.close(); App.refresh(); toast('Sent for signature. In this demo nobody is actually emailed.');
    });
  }

  /* ---------- Team performance: plan vs achievement and SLA ---------- */
  function teamTabs(main) {
    var tab = main.__tmtab || 'people';
    return '<div class="tabs" role="tablist">' + [['people', 'People'], ['plan', 'Plan vs achievement'], ['sla', 'SLA']].map(function (t) { var on = tab === t[0]; return '<span class="tab' + (on ? ' is-on' : '') + '"><button type="button" role="tab" aria-selected="' + on + '" data-tmtab="' + t[0] + '">' + t[1] + '</button></span>'; }).join('') + '</div>';
  }
  function bindTeamTabs(main) { main.querySelectorAll('[data-tmtab]').forEach(function (b) { b.addEventListener('click', function () { main.__tmtab = b.getAttribute('data-tmtab'); App.refresh(); }); }); }
  function pageTeamTab(main, u, dept) {
    var tab = main.__tmtab, pool = (u.role === 'manager' ? S.users.filter(function (x) { return x.dept === u.dept; }) : S.users).filter(function (x) { return x.status !== 'deactivated' && (dept === 'all' || x.dept === dept); });
    var ids = pool.map(function (x) { return x.id; }), tasks = visibleTasks().filter(function (t) { return ids.indexOf(t.assigneeId) >= 0; });
    var ctrl = '<div class="btn-row">' + (u.role === 'manager' ? '' : '<label class="sr-only" for="tm-dept">Team</label><select id="tm-dept" class="select select--chip">' + selectOpts(DEPTS, dept, 'All teams') + '</select>') + '<button type="button" class="btn btn--secondary" id="tm-export">' + icon('download', 16) + ' Export CSV</button></div>';
    var head = pageHead('Team performance', u.role === 'manager' ? 'Shown to managers and leaders. You see ' + esc(u.dept) + '.' : 'Shown to managers and leaders. You see every team.', ctrl) + teamTabs(main), body = '', rows = [];
    if (tab === 'plan') {
      var p = plannedStats(tasks, 30), cats = Object.keys(p.cats).sort(), rate = p.planned ? Math.round(p.achieved / p.planned * 100) : null, ontime = p.achieved ? Math.round(p.onTime / p.achieved * 100) : null;
      function tile(k, v, s, c) { return '<div class="panel stat"><div class="muted small">' + k + '</div><div class="stat__v">' + v + '</div><div class="small ' + (c || 'muted') + '">' + s + '</div></div>'; }
      var tot = Math.max(1, p.onTime + p.late + p.notDone + p.blocked), seg = [['Done on time', p.onTime, '#1f7a4d'], ['Done late', p.late, '#c27a00'], ['Not done', p.notDone, '#b42318'], ['Blocked', p.blocked, '#9aa6b2']];
      body = '<div class="stats">' + tile('Planned', p.planned, 'tasks due in the last 30 days') + tile('Achieved', p.achieved, 'completed') + tile('Achievement rate', rate == null ? 'None' : rate + '%', 'achieved divided by planned') + tile('On time', ontime == null ? 'None' : ontime + '%', 'target ' + slaTarget() + '%', ontime != null && ontime < slaTarget() ? 'red' : 'muted') + '</div>' +
        '<div class="cols"><section class="panel"><div class="panel__head"><h2>Planned and achieved by category</h2></div><div class="panel__body">' + (cats.length ? cats.map(function (c) { var r = p.cats[c], pc = Math.round(r.achieved / r.planned * 100); return '<div class="pair"><span>' + esc(c) + '</span><span class="pair__bars"><span class="pair__b pair__b--plan" style="width:' + Math.min(100, r.planned / Math.max.apply(null, cats.map(function (k) { return p.cats[k].planned; })) * 100) + '%"></span><span class="pair__b pair__b--ach" style="width:' + Math.min(100, r.achieved / Math.max.apply(null, cats.map(function (k) { return p.cats[k].planned; })) * 100) + '%"></span></span><strong class="num">' + pc + '%</strong></div>'; }).join('') : '<p class="muted">No tasks were due in this period.</p>') + '<div class="small muted" style="margin-top:10px"><i class="dot" style="background:#cfdaf6"></i> Planned <i class="dot" style="background:#2f5bd3;margin-left:12px"></i> Achieved</div></div></section>' +
        '<section class="panel"><div class="panel__head"><h2>How the work finished</h2></div><div class="panel__body"><div class="stackbar">' + seg.map(function (x) { return x[1] ? '<span style="flex:' + x[1] + ';background:' + x[2] + '"></span>' : ''; }).join('') + '</div>' + seg.map(function (x) { return '<div class="kv"><span><i class="dot" style="background:' + x[2] + '"></i>' + x[0] + '</span><strong>' + Math.round(x[1] / tot * 100) + '%</strong></div>'; }).join('') + '</div></section></div>';
      rows = [['Category', 'Planned', 'Achieved', 'Rate %']].concat(cats.map(function (c) { return [c, p.cats[c].planned, p.cats[c].achieved, Math.round(p.cats[c].achieved / p.cats[c].planned * 100)]; }));
    } else {
      var all = slaStats(tasks, 30), byTeam = DEPTS.map(function (d) { var ts = tasks.filter(function (t) { return t.dept === d; }), s = slaStats(ts, 30), od = ts.filter(isOverdue).length; return [d, s, od]; }).filter(function (x) { return x[1].done || x[2]; });
      var byStage = STAGE_META.map(function (m, i) { var ts = tasks.filter(function (t) { return t.stepId && t.stageIdx === i; }); return [m.name, slaStats(ts, 30), ts.filter(isOverdue).length]; }).filter(function (x) { return x[1].done || x[2]; });
      function trow(x) { var pc = x[1].pct; return '<tr><td><strong>' + esc(x[0]) + '</strong></td><td class="r num">' + x[1].done + '</td><td class="r num">' + x[1].onTime + '</td><td class="nowrap">' + (pc == null ? '<span class="muted">No data</span>' : '<span class="meter meter--wide"><span style="width:' + pc + '%;background:' + (pc >= slaTarget() ? '#1f7a4d' : '#b7791f') + '"></span></span> <strong class="num">' + pc + '%</strong>') + '</td><td class="r num ' + (x[2] ? 'red strong' : 'muted') + '">' + x[2] + '</td></tr>'; }
      body = '<div class="cols"><section class="panel"><div class="panel__head"><h2>Overall</h2></div><div class="panel__body">' + donut(all.pct, 'Tasks done within their due time', 'Last 30 days. ' + all.onTime + ' of ' + all.done + ' on time.') + (can('admin.edit') ? '<div class="field" style="margin-top:14px"><label for="sla-t">Target</label><div class="inline-form"><input id="sla-t" class="input input--num" type="number" min="1" max="100" value="' + slaTarget() + '"><span class="muted" style="align-self:center">% of tasks on time</span></div></div>' : '<div class="muted small" style="margin-top:12px">Target ' + slaTarget() + '%.</div>') + '</div></section>' +
        '<div class="col"><section class="panel"><div class="panel__head"><h2>By team</h2></div><div class="table-wrap"><table class="table"><thead><tr><th>Team</th><th class="r">Done</th><th class="r">On time</th><th>Rate</th><th class="r">Overdue now</th></tr></thead><tbody>' + (byTeam.length ? byTeam.map(trow).join('') : '<tr><td colspan="5" class="empty">No data yet.</td></tr>') + '</tbody></table></div></section>' +
        '<section class="panel"><div class="panel__head"><h2>By checklist stage</h2></div><div class="table-wrap"><table class="table"><thead><tr><th>Stage</th><th class="r">Done</th><th class="r">On time</th><th>Rate</th><th class="r">Overdue now</th></tr></thead><tbody>' + (byStage.length ? byStage.map(trow).join('') : '<tr><td colspan="5" class="empty">No data yet.</td></tr>') + '</tbody></table></div></section></div></div>';
      rows = [['Team', 'Done in 30 days', 'On time', 'Rate %', 'Overdue now']].concat(byTeam.map(function (x) { return [x[0], x[1].done, x[1].onTime, x[1].pct == null ? '' : x[1].pct, x[2]]; }));
    }
    main.innerHTML = head + body; bindTeamTabs(main);
    var sd = main.querySelector('#tm-dept'); if (sd) sd.addEventListener('change', function (e) { main.__dept = e.target.value; App.refresh(); });
    var st = main.querySelector('#sla-t'); if (st) st.addEventListener('change', function (e) { var v = Math.min(100, Math.max(1, Number(e.target.value) || 80)); S.slaTarget = v; log('Set the SLA target to ' + v + '%'); save(); App.refresh(); toast('Target saved'); });
    main.querySelector('#tm-export').addEventListener('click', function () { download((tab === 'plan' ? 'plan-vs-achievement' : 'sla') + '.csv', csv(rows), 'text/csv'); toast('Exported'); });
  }

  /* =====================================================================
     Notifications, My account, Settings
     ===================================================================== */
  var NOTE_ICON = { assigned: 'tasks', overdue: 'alert', blocked: 'alert', mention: 'person', stage: 'kanban', funds: 'check', approval: 'approve', due: 'clock' };
  var NOTE_PILL = { assigned: 'blue', overdue: 'red', blocked: 'amber', mention: 'blue', stage: 'blue', funds: 'green', approval: 'amber', due: 'blue' };
  function pageNotifications(main) {
    var u = currentUser(), tab = main.__nt || 'all', items = notifItems(u);
    var lists = { all: items, unread: items.filter(function (i) { return !i.read; }), mentions: items.filter(function (i) { return i.kind === 'mention'; }), overdue: items.filter(function (i) { return i.kind === 'overdue'; }) }, list = lists[tab];
    var unread = lists.unread.length;
    main.innerHTML = pageHead('Notifications', unread ? unread + (unread === 1 ? ' needs' : ' need') + ' your attention.' : 'You are caught up.', '<button type="button" class="btn btn--secondary" id="nf-all"' + (unreadNotes(u).length ? '' : ' disabled') + '>Mark all as read</button><a class="btn btn--secondary" href="account.html#notifications">Notification settings</a>') +
      '<div class="tabs" role="tablist">' + [['all', 'All'], ['unread', 'Unread'], ['mentions', 'Mentions'], ['overdue', 'Overdue']].map(function (t) { var on = tab === t[0]; return '<span class="tab' + (on ? ' is-on' : '') + '"><button type="button" role="tab" aria-selected="' + on + '" data-nt="' + t[0] + '">' + t[1] + ' <span class="count">' + lists[t[0]].length + '</span></button></span>'; }).join('') + '</div>' +
      '<section class="panel">' + (list.length ? '<ul class="rows">' + list.map(function (i) { return '<li class="rows__item' + (i.read ? '' : ' is-unread') + '"><span class="pill pill--' + (NOTE_PILL[i.kind] || 'blue') + '" style="padding:6px">' + icon(NOTE_ICON[i.kind] || 'bell', 16) + '</span><div class="grow"><div>' + esc(i.text) + '</div><div class="small muted">' + ago(i.at) + '</div></div>' + (i.read ? '' : '<span class="udot" role="img" aria-label="Unread"></span>') + '<button type="button" class="btn btn--ghost btn--small" data-go="' + esc(i.id) + '">Open<span class="sr-only"> ' + esc(i.text) + '</span></button></li>'; }).join('') + '</ul>' : '<p class="panel__body muted">Nothing here.</p>') + '</section>';
    main.querySelectorAll('[data-nt]').forEach(function (b) { b.addEventListener('click', function () { main.__nt = b.getAttribute('data-nt'); App.refresh(); }); });
    main.querySelector('#nf-all').addEventListener('click', function () { S.notifs.forEach(function (n) { if (n.to === u.id) n.read = true; }); save(); App.refresh(); toast('All marked as read'); });
    main.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { var it = items.filter(function (x) { return x.id === b.getAttribute('data-go'); })[0]; if (it.real) { S.notifs.forEach(function (n) { if (n.id === it.id) n.read = true; }); save(); } location.href = it.href; }); });
  }

  function pageAccount(main) {
    var u = currentUser(), ses = getSession() || {}, mine = S.sessions[u.id] || [];
    var up = S.userNotif[u.id] || {};
    main.innerHTML = pageHead('My account', 'Your profile, sign-in, and how the workspace opens for you.', '') +
      '<div class="cols"><div class="col"><section class="panel"><div class="panel__head"><h2>Profile</h2></div><div class="panel__body"><div class="who" style="gap:16px;margin-bottom:14px">' + avatar(u, 60) + '<div><div class="quick__name" style="font-size:24px">' + esc(u.name) + '</div><div class="muted">' + ROLES[u.role] + ', ' + esc(u.dept) + '</div></div></div><div class="kv"><span class="muted">Work email</span><span>' + esc(u.email) + '</span></div><div class="kv"><span class="muted">Role</span><span>' + ROLES[u.role] + '</span></div><div class="kv"><span class="muted">Team</span><span>' + esc(u.dept) + '</span></div><div class="small muted" style="margin-top:10px">An admin sets your role and team.</div></div></section>' +
      '<section class="panel"><div class="panel__head"><h2>Change password</h2></div><div class="panel__body"><form id="pw-form" novalidate>' + field('pw-cur', 'Current password', '<input id="pw-cur" type="password" class="input" autocomplete="current-password">') + '<div class="two">' + field('pw-new', 'New password', '<input id="pw-new" type="password" class="input" autocomplete="new-password">', 'At least 10 characters, with a number.') + field('pw-conf', 'Confirm new password', '<input id="pw-conf" type="password" class="input" autocomplete="new-password">') + '</div><button type="submit" class="btn btn--primary">Change password</button></form></div></section></div>' +
      '<div class="col"><section class="panel"><div class="panel__head"><h2>How the workspace opens</h2></div><div class="panel__body"><form id="pr-form">' + field('pr-start', 'Start page', '<select id="pr-start" class="select">' + selectOpts([['index.html', 'Command Center'], ['dashboards.html', 'Dashboards'], ['firms.html', 'Firms'], ['pipeline.html', 'Pipeline'], ['tasks.html', 'Tasks']], u.start || 'index.html') + '</select>') + field('pr-tasks', 'Tasks open on', '<select id="pr-tasks" class="select">' + selectOpts([['mine', 'My tasks'], ['team', 'My team'], ['all', 'Firmwide']], u.tasksScope || 'mine') + '</select>') + '<button type="submit" class="btn btn--primary">Save preferences</button></form></div></section>' +
      '<section class="panel" id="notifications"><div class="panel__head"><h2>Tell me in the app when</h2></div><ul class="rows">' + Object.keys(NOTE_KINDS).filter(function (k) { return k !== 'due' && k !== 'overdue' || true; }).map(function (k) { return '<li class="rows__item"><div class="grow">' + NOTE_KINDS[k] + '</div><span class="switch"><input type="checkbox" data-nk="' + k + '" aria-label="' + esc(NOTE_KINDS[k]) + '"' + (appOn(u.id, k) ? ' checked' : '') + '><span></span></span></li>'; }).join('') + '</ul><div class="panel__foot muted small">Email is set by your admin. In this demo nothing is emailed.</div></section>' +
      '<section class="panel"><div class="panel__head"><h2>Where you are signed in</h2></div>' + (mine.length ? '<ul class="rows">' + mine.map(function (x) { var cur = x.id === ses.sid; return '<li class="rows__item"><div class="grow"><strong>' + esc(x.ua) + '</strong><div class="small muted">' + (cur ? 'Active now' : 'Signed in ' + ago(x.at)) + '</div></div>' + (cur ? '<span class="pill pill--green"><span class="pill__dot"></span>This browser</span>' : '<button type="button" class="btn btn--secondary btn--small" data-so="' + x.id + '">Sign out<span class="sr-only"> ' + esc(x.ua) + '</span></button>') + '</li>'; }).join('') + '</ul>' : '<p class="panel__body muted">No sessions recorded.</p>') + (mine.length > 1 ? '<div class="panel__foot"><button type="button" class="btn btn--secondary btn--small" id="so-all">Sign out everywhere else</button></div>' : '') + '</section></div></div>';
    main.querySelector('#pw-form').addEventListener('submit', function (e) {
      e.preventDefault(); var cur = main.querySelector('#pw-cur').value, nw = main.querySelector('#pw-new').value, cf = main.querySelector('#pw-conf').value, bad = false;
      setError('pw-cur', cur === (S.passwords[u.id] || DEMO_PASSWORD) ? '' : 'That is not your current password.'); if (cur !== (S.passwords[u.id] || DEMO_PASSWORD)) bad = true;
      var weak = nw.length < 10 || !/\d/.test(nw); setError('pw-new', weak ? 'Use at least 10 characters, with a number.' : ''); if (weak) bad = true;
      setError('pw-conf', cf !== nw ? 'The two passwords do not match.' : ''); if (cf !== nw) bad = true; if (bad) { main.querySelector('[aria-invalid="true"]').focus(); return; }
      S.passwords[u.id] = nw; recordAudit(u.id, 'Changed their password'); save(); App.refresh(); toast('Password changed. Use it next time you sign in.');
    });
    main.querySelector('#pr-form').addEventListener('submit', function (e) { e.preventDefault(); u.start = main.querySelector('#pr-start').value; u.tasksScope = main.querySelector('#pr-tasks').value; save(); toast('Preferences saved'); });
    main.querySelectorAll('[data-nk]').forEach(function (c) { c.addEventListener('change', function () { var m = S.userNotif[u.id] || (S.userNotif[u.id] = {}); m[c.getAttribute('data-nk')] = c.checked; save(); toast(c.checked ? 'You will be told in the app' : 'You will not be told in the app'); }); });
    main.querySelectorAll('[data-so]').forEach(function (b) { b.addEventListener('click', function () { S.sessions[u.id] = (S.sessions[u.id] || []).filter(function (x) { return x.id !== b.getAttribute('data-so'); }); save(); App.refresh(); toast('Signed out of that device'); }); });
    var all = main.querySelector('#so-all'); if (all) all.addEventListener('click', function () { S.sessions[u.id] = (S.sessions[u.id] || []).filter(function (x) { return x.id === ses.sid; }); recordAudit(u.id, 'Signed out of all other devices'); save(); App.refresh(); toast('Signed out everywhere else'); });
    if (location.hash === '#notifications') { var n = document.getElementById('notifications'); if (n) n.scrollIntoView(); }
  }

  function pageSettings(main) {
    var ro = !can('admin.edit'), tab = main.__stab || 'general'; main.__stab = tab;
    var body = { general: settingsGeneral, terms: settingsTerms, menu: settingsMenu, notif: settingsNotif }[tab](main, ro);
    main.innerHTML = pageHead('Settings', ro ? 'You can look at these settings. Changing them needs the Super Admin role.' : 'How the workspace looks and behaves for your company.', '') +
      '<div class="tabs" role="tablist">' + [['general', 'General'], ['terms', 'Terminology'], ['menu', 'Menu'], ['notif', 'Notifications']].map(function (t) { var on = tab === t[0]; return '<span class="tab' + (on ? ' is-on' : '') + '"><button type="button" role="tab" aria-selected="' + on + '" data-stab="' + t[0] + '">' + t[1] + '</button></span>'; }).join('') + '</div><div id="settings-body">' + body.html + '</div>';
    main.querySelectorAll('[data-stab]').forEach(function (b) { b.addEventListener('click', function () { main.__stab = b.getAttribute('data-stab'); main.__tdraft = null; main.__mdraft = null; App.refresh(); }); });
    body.bind(main.querySelector('#settings-body'));
  }
  var TIMES = []; for (var th = 6; th <= 21; th++) { TIMES.push(('0' + th).slice(-2) + ':00'); TIMES.push(('0' + th).slice(-2) + ':30'); }
  function timeLabel(t) { var h = Number(t.slice(0, 2)), m = t.slice(3); return (h % 12 || 12) + ':' + m + ' ' + (h < 12 ? 'am' : 'pm'); }
  function settingsGeneral(main, ro) {
    var w = main.__wdraft || (main.__wdraft = copy(S.work)), dis = ro ? ' disabled' : '';
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var html = '<div class="cols"><div class="col"><section class="panel"><div class="panel__head"><h2>Company profile</h2></div><div class="panel__body"><form id="co-form" novalidate>' + field('co-name', 'Company name', '<input id="co-name" class="input" value="' + esc(S.company.name) + '"' + dis + '>') + field('co-tag', 'Tagline under the name', '<input id="co-tag" class="input" value="' + esc(S.company.tagline) + '"' + dis + '>') + (ro ? '' : '<button type="submit" class="btn btn--primary">Save company</button>') + '</form></div></section>' +
      '<section class="panel"><div class="panel__head"><h2>What gets recorded</h2></div><div class="panel__body"><div class="rule rule--flat"><div><strong>Sign-ins and sign-outs</strong></div><span class="switch"><input type="checkbox" id="rc-in" aria-label="Record sign-ins"' + (S.record.signins ? ' checked' : '') + dis + '><span></span></span></div><div class="rule rule--flat"><div><strong>Exports and downloads</strong></div><span class="switch"><input type="checkbox" id="rc-ex" aria-label="Record exports"' + (S.record.exports ? ' checked' : '') + dis + '><span></span></span></div><div class="rule rule--flat"><div><strong>Every AI call</strong><div class="muted">Always on.</div></div><span class="switch"><input type="checkbox" checked disabled aria-label="Record AI calls"><span></span></span></div><div class="small muted">Shown in the Admin audit log.</div></div></section></div>' +
      '<div class="col"><section class="panel"><div class="panel__head"><h2>Working hours</h2></div><div class="panel__body"><form id="wk-form" novalidate><div class="field"><label>Working days</label><div class="chips">' + days.map(function (d, i) { return '<button type="button" class="chip-btn' + (w.days.indexOf(i) >= 0 ? ' is-on' : '') + '" data-wd="' + i + '" aria-pressed="' + (w.days.indexOf(i) >= 0) + '"' + dis + '>' + d + '</button>'; }).join('') + '</div><span class="error" id="wd-err" role="alert" hidden></span></div>' +
      '<div class="two">' + field('wk-from', 'From', '<select id="wk-from" class="select"' + dis + '>' + TIMES.map(function (t) { return '<option value="' + t + '"' + (w.from === t ? ' selected' : '') + '>' + timeLabel(t) + '</option>'; }).join('') + '</select>') + field('wk-to', 'To', '<select id="wk-to" class="select"' + dis + '>' + TIMES.map(function (t) { return '<option value="' + t + '"' + (w.to === t ? ' selected' : '') + '>' + timeLabel(t) + '</option>'; }).join('') + '</select>') + '</div>' +
      field('wk-tz', 'Time zone', '<select id="wk-tz" class="select"' + dis + '>' + selectOpts(['Eastern Time', 'Central Time', 'Mountain Time', 'Pacific Time'], w.tz) + '</select>') + '<div class="rule rule--flat"><div><strong>Count due dates in working days</strong><div class="muted">A task due in 5 days lands on the fifth working day, not the fifth calendar day.</div></div><span class="switch"><input type="checkbox" id="wk-wd" aria-label="Count due dates in working days"' + (w.workdays ? ' checked' : '') + dis + '><span></span></span></div>' +
      field('wk-df', 'Date format', '<select id="wk-df" class="select"' + dis + '><option value="us"' + (!w.dmy ? ' selected' : '') + '>Oct 9, 2026</option><option value="uk"' + (w.dmy ? ' selected' : '') + '>9 Oct 2026</option></select>') + (ro ? '' : '<button type="submit" class="btn btn--primary">Save working hours</button>') + '</form></div></section></div></div>';
    return { html: html, bind: function (root) {
      if (ro) return;
      root.querySelector('#co-form').addEventListener('submit', function (e) { e.preventDefault(); var n = root.querySelector('#co-name').value.trim(), t = root.querySelector('#co-tag').value.trim(); if (!n) { setError('co-name', 'Enter the company name.'); return; } S.company = { name: n, tagline: t }; log('Changed the company name to ' + n); save(); App.refresh(); toast('Company saved'); });
      root.querySelector('#rc-in').addEventListener('change', function (e) { S.record.signins = e.target.checked; log((e.target.checked ? 'Started' : 'Stopped') + ' recording sign-ins'); save(); toast(e.target.checked ? 'Sign-ins are recorded' : 'Sign-ins are no longer recorded'); });
      root.querySelector('#rc-ex').addEventListener('change', function (e) { S.record.exports = e.target.checked; log((e.target.checked ? 'Started' : 'Stopped') + ' recording exports'); save(); toast(e.target.checked ? 'Exports are recorded' : 'Exports are no longer recorded'); });
      root.querySelectorAll('[data-wd]').forEach(function (b) { b.addEventListener('click', function () { var i = Number(b.getAttribute('data-wd')), k = w.days.indexOf(i); if (k >= 0) w.days.splice(k, 1); else w.days.push(i); b.classList.toggle('is-on', k < 0); b.setAttribute('aria-pressed', String(k < 0)); }); });
      root.querySelector('#wk-form').addEventListener('submit', function (e) {
        e.preventDefault(); var from = root.querySelector('#wk-from').value, to = root.querySelector('#wk-to').value, er = document.getElementById('wd-err');
        if (!w.days.length) { er.textContent = 'Choose at least one working day.'; er.hidden = false; return; } er.hidden = true;
        if (from >= to) { setError('wk-to', 'The end must be after the start.'); return; } setError('wk-to', '');
        S.work = { days: w.days.slice().sort(), from: from, to: to, tz: root.querySelector('#wk-tz').value, workdays: root.querySelector('#wk-wd').checked, dmy: root.querySelector('#wk-df').value === 'uk' };
        main.__wdraft = null; log('Changed the working hours'); save(); App.refresh(); toast('Working hours saved');
      });
    } };
  }
  function settingsTerms(main, ro) {
    var dr = main.__tdraft || (main.__tdraft = copy(Object.keys(TERM_DEFS).reduce(function (o, k) { o[k] = (S.terms && S.terms[k]) || TERM_DEFS[k]; return o; }, {}))), dis = ro ? ' disabled' : '';
    var labels = { firm: ['Firm', 'The companies you work with'], advisor: ['Advisor', 'The people who work at them'], owner: ['Owner', 'The person who looks after a firm'], stage: ['Stage', 'Where a firm is in its lifecycle'] };
    var rows = Object.keys(TERM_DEFS).map(function (k) { return '<tr><td data-noterms><strong>' + labels[k][0] + '</strong><div class="small muted">' + labels[k][1] + '</div></td><td><label class="sr-only" for="tm-s-' + k + '">Your word for ' + labels[k][0] + ', singular</label><input id="tm-s-' + k + '" class="input" data-term="' + k + '" data-i="0" value="' + esc(dr[k][0]) + '"' + dis + '></td><td><label class="sr-only" for="tm-p-' + k + '">Your word for ' + labels[k][0] + ', plural</label><input id="tm-p-' + k + '" class="input" data-term="' + k + '" data-i="1" value="' + esc(dr[k][1]) + '"' + dis + '></td></tr>'; }).join('');
    var prev = '<section class="panel"><div class="panel__head"><h2>Preview</h2><span class="muted small">How it reads with your words</span></div><div class="panel__body" data-noterms id="tm-prev"></div></section>';
    function preview(root) { var d = dr; root.querySelector('#tm-prev').innerHTML = '<div class="small muted" style="margin-bottom:8px">Menu</div><div style="display:grid;gap:4px;margin-bottom:16px"><span class="side__link">' + icon('building') + '<span>' + esc(d.firm[1]) + '</span></span><span class="side__link">' + icon('kanban') + '<span>Pipeline</span></span></div><div class="small muted" style="margin-bottom:8px">Page heading</div><div style="font:500 26px var(--font-display)">' + esc(d.firm[1]) + '</div><div class="muted">16 ' + esc(d.firm[1].toLowerCase()) + ' with 203 ' + esc(d.advisor[1].toLowerCase()) + ' and staff.</div><div class="small muted" style="margin:16px 0 8px">Details</div><div class="kv"><span class="muted">' + esc(d.owner[0]) + '</span><span>Mara Vance</span></div><div class="kv"><span class="muted">' + esc(d.stage[0]) + '</span><span>Training</span></div><div class="small muted" style="margin:16px 0 8px">Button</div><span class="btn btn--primary">Add ' + esc(d.firm[0].toLowerCase()) + '</span>'; }
    var html = '<div class="cols"><section class="panel"><div class="panel__head"><h2>Your words</h2></div><div class="table-wrap"><table class="table"><thead><tr><th>Default word</th><th>Singular</th><th>Plural</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="panel__foot muted small">Menus, headings, buttons, and reports all use your words. Names of people and firms are not changed.</div></section>' + prev + '</div>' +
      (ro ? '' : '<div class="savebar" style="margin-top:20px"><span class="muted">Changes apply to everyone in the company.</span><span class="btn-row"><button type="button" class="btn btn--ghost" id="tm-reset">Reset to defaults</button><button type="button" class="btn btn--secondary" id="tm-disc">Discard</button><button type="button" class="btn btn--primary" id="tm-save">Save changes</button></span></div>');
    return { html: html, bind: function (root) {
      preview(root); if (ro) return;
      root.querySelectorAll('[data-term]').forEach(function (el) { el.addEventListener('input', function () { dr[el.getAttribute('data-term')][Number(el.getAttribute('data-i'))] = el.value; preview(root); }); });
      root.querySelector('#tm-reset').addEventListener('click', function () { S.terms = {}; main.__tdraft = null; log('Reset the terminology'); save(); location.reload(); });
      root.querySelector('#tm-disc').addEventListener('click', function () { main.__tdraft = null; App.refresh(); toast('Changes discarded'); });
      root.querySelector('#tm-save').addEventListener('click', function () {
        var bad = false; Object.keys(dr).forEach(function (k) { [0, 1].forEach(function (i) { var v = String(dr[k][i]).trim(), el = root.querySelector('#tm-' + (i ? 'p' : 's') + '-' + k); var msg = !v ? 'Enter a word.' : (v.length > 24 ? 'Use 24 characters or fewer.' : (/[<>{}\d]/.test(v) ? 'Use letters only.' : '')); setError(el.id, msg); if (msg) bad = true; dr[k][i] = v; }); });
        if (bad) { root.querySelector('[aria-invalid="true"]').focus(); return; }
        S.terms = {}; Object.keys(dr).forEach(function (k) { if (dr[k][0] !== TERM_DEFS[k][0] || dr[k][1] !== TERM_DEFS[k][1]) S.terms[k] = dr[k].slice(); });
        main.__tdraft = null; log('Changed the terminology'); save(); location.reload();
      });
    } };
  }
  function settingsMenu(main, ro) {
    var dr = main.__mdraft || (main.__mdraft = copy(S.menu)), dis = ro ? ' disabled' : '';
    function items() { return dr.order.map(function (id) { return NAV.filter(function (n) { return n[3] === id; })[0]; }).filter(Boolean); }
    var html = '<div class="cols"><section class="panel"><div class="panel__head"><h2>Menu items</h2><span class="muted small">Reorder, or turn items off for everyone</span></div>' + items().map(function (n, i) {
      var locked = n[3] === 'admin' || n[3] === 'home', off = dr.hidden.indexOf(n[3]) >= 0;
      return '<div class="rule" style="border-top:1px solid var(--line-2)"><div style="display:flex;align-items:center;gap:12px"><span style="color:var(--ink-2)">' + icon(n[2]) + '</span><strong>' + n[1] + '</strong>' + (locked ? '<span class="pill pill--gray">Always shown</span>' : '') + '</div><div class="btn-row"><button type="button" class="icon-btn icon-btn--s" data-mup="' + i + '" aria-label="Move ' + n[1] + ' up"' + (i === 0 || ro ? ' disabled' : '') + '>' + icon('up', 16) + '</button><button type="button" class="icon-btn icon-btn--s" data-mdn="' + i + '" aria-label="Move ' + n[1] + ' down"' + (i === dr.order.length - 1 || ro ? ' disabled' : '') + '>' + icon('down', 16) + '</button><span class="switch"><input type="checkbox" data-mshow="' + n[3] + '" aria-label="Show ' + n[1] + '"' + (off ? '' : ' checked') + (locked || ro ? ' disabled' : '') + '><span></span></span></div></div>';
    }).join('') + '</section><section class="panel"><div class="panel__head"><h2>Preview</h2></div><div class="panel__body" style="display:grid;gap:2px">' + items().filter(function (n) { return dr.hidden.indexOf(n[3]) < 0; }).map(function (n) { return '<span class="side__link' + (n[3] === 'home' ? ' active' : '') + '">' + icon(n[2]) + '<span>' + n[1] + '</span></span>'; }).join('') + '</div></section></div>' +
      (ro ? '' : '<div class="savebar" style="margin-top:20px"><span class="muted">People only see the items their role allows.</span><span class="btn-row"><button type="button" class="btn btn--secondary" id="mn-disc">Discard</button><button type="button" class="btn btn--primary" id="mn-save">Save changes</button></span></div>');
    return { html: html, bind: function (root) {
      if (ro) return;
      root.querySelectorAll('[data-mup]').forEach(function (b) { b.addEventListener('click', function () { var i = Number(b.getAttribute('data-mup')); dr.order.splice(i - 1, 0, dr.order.splice(i, 1)[0]); App.refresh(); }); });
      root.querySelectorAll('[data-mdn]').forEach(function (b) { b.addEventListener('click', function () { var i = Number(b.getAttribute('data-mdn')); dr.order.splice(i + 1, 0, dr.order.splice(i, 1)[0]); App.refresh(); }); });
      root.querySelectorAll('[data-mshow]').forEach(function (c) { c.addEventListener('change', function () { var id = c.getAttribute('data-mshow'), k = dr.hidden.indexOf(id); if (c.checked && k >= 0) dr.hidden.splice(k, 1); if (!c.checked && k < 0) dr.hidden.push(id); App.refresh(); }); });
      root.querySelector('#mn-disc').addEventListener('click', function () { main.__mdraft = null; App.refresh(); toast('Changes discarded'); });
      root.querySelector('#mn-save').addEventListener('click', function () { S.menu = copy(dr); main.__mdraft = null; log('Changed the menu'); save(); App.refresh(); toast('Menu saved'); });
    } };
  }
  function settingsNotif(main, ro) {
    var dg = S.digest || { on: true, time: '08:00' }, qh = S.quiet || { on: true }, dis = ro ? ' disabled' : '';
    var rows = Object.keys(NOTE_KINDS).map(function (k) { var d = S.notifDefaults[k] || { app: true, email: false }; return '<tr><td>' + NOTE_KINDS[k] + '</td><td class="matrix__cell"><span class="switch"><input type="checkbox" data-nd="' + k + '" data-ch="app" aria-label="' + esc(NOTE_KINDS[k]) + ', in the app"' + (d.app ? ' checked' : '') + dis + '><span></span></span></td><td class="matrix__cell"><span class="switch"><input type="checkbox" data-nd="' + k + '" data-ch="email" aria-label="' + esc(NOTE_KINDS[k]) + ', by email"' + (d.email ? ' checked' : '') + dis + '><span></span></span></td></tr>'; }).join('');
    var html = '<div class="cols"><section class="panel"><div class="panel__head"><h2>What to tell people about</h2><span class="muted small">Company defaults. Each person can change their own.</span></div><div class="table-wrap"><table class="table matrix"><thead><tr><th>When</th><th class="matrix__plan">In the app</th><th class="matrix__plan">By email</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="panel__foot muted small">In-app notifications work now. Email is set up here but not sent in this demo.</div></section>' +
      '<div class="col"><section class="panel"><div class="panel__head"><h2>Daily summary email</h2></div><div class="panel__body"><div class="rule rule--flat"><div><strong>Send a summary every working day</strong><div class="muted">Tasks due today, overdue work, and what is waiting on others.</div></div><span class="switch"><input type="checkbox" id="dg-on" aria-label="Send a daily summary"' + (dg.on ? ' checked' : '') + dis + '><span></span></span></div>' + field('dg-time', 'Send at', '<select id="dg-time" class="select"' + dis + '>' + TIMES.map(function (t) { return '<option value="' + t + '"' + (dg.time === t ? ' selected' : '') + '>' + timeLabel(t) + '</option>'; }).join('') + '</select>') + '</div></section>' +
      '<section class="panel"><div class="panel__head"><h2>Quiet hours</h2></div><div class="panel__body"><div class="rule rule--flat"><div><strong>No emails outside working hours</strong><div class="muted">In-app notifications still arrive. Working hours are under General.</div></div><span class="switch"><input type="checkbox" id="qh-on" aria-label="No emails outside working hours"' + (qh.on ? ' checked' : '') + dis + '><span></span></span></div></div></section></div></div>';
    return { html: html, bind: function (root) {
      if (ro) return;
      root.querySelectorAll('[data-nd]').forEach(function (c) { c.addEventListener('change', function () { var k = c.getAttribute('data-nd'), d = S.notifDefaults[k] || (S.notifDefaults[k] = { app: true, email: false }); d[c.getAttribute('data-ch')] = c.checked; log('Changed the notification defaults'); save(); toast('Saved'); }); });
      root.querySelector('#dg-on').addEventListener('change', function (e) { S.digest = { on: e.target.checked, time: root.querySelector('#dg-time').value }; save(); toast('Saved'); });
      root.querySelector('#dg-time').addEventListener('change', function (e) { S.digest = { on: root.querySelector('#dg-on').checked, time: e.target.value }; save(); toast('Saved'); });
      root.querySelector('#qh-on').addEventListener('change', function (e) { S.quiet = { on: e.target.checked }; save(); toast('Saved'); });
    } };
  }

  /* =====================================================================
     Admin: approvals and recurring work, integrations, data and hosting; Import
     ===================================================================== */
  function externalRows(f) { var e = f.external || {}, names = { salesforce: 'Salesforce ID', wealthbox: 'Wealthbox ID' }; return Object.keys(e).map(function (k) { return '<div class="kv"><span class="muted">' + (names[k] || k) + '</span><span class="mono">' + esc(e[k]) + '</span></div>'; }).join(''); }

  function adminApprovals(main, ro) {
    var dis = ro ? ' disabled' : '', roleOpts = function (cur, none) { return (none ? '<option value="">None</option>' : '') + ROLE_IDS.filter(function (r) { return r !== 'readonly'; }).map(function (r) { return '<option value="' + r + '"' + (cur === r ? ' selected' : '') + '>' + ROLES[r] + '</option>'; }).join(''); };
    var steps = []; S.stages.forEach(function (st, i) { st.steps.forEach(function (s) { steps.push([i, s]); }); });
    var rows = steps.map(function (x) {
      var s = x[1], r = S.approvalRules[s.id] || { on: false, layers: ['manager'] };
      return '<tr><td><strong>' + esc(s.title) + '</strong><span class="cell-sub">' + STAGE_META[x[0]].name + '</span></td><td><span class="switch"><input type="checkbox" data-rs="' + s.id + '" aria-label="Needs approval: ' + esc(s.title) + '"' + (r.on ? ' checked' : '') + dis + '><span></span></span></td><td><label class="sr-only" for="l1-' + s.id + '">First sign-off for ' + esc(s.title) + '</label><select id="l1-' + s.id + '" class="select select--chip" data-l="0" data-sid="' + s.id + '"' + (ro || !r.on ? ' disabled' : '') + '>' + roleOpts(r.layers[0], false) + '</select></td><td><label class="sr-only" for="l2-' + s.id + '">Second sign-off for ' + esc(s.title) + '</label><select id="l2-' + s.id + '" class="select select--chip" data-l="1" data-sid="' + s.id + '"' + (ro || !r.on ? ' disabled' : '') + '>' + roleOpts(r.layers[1] || '', true) + '</select></td></tr>';
    }).join('');
    var rec = S.recurring.map(function (r) { return '<tr><td><strong>' + esc(r.title) + '</strong></td><td>Every ' + r.every + ' days</td><td>Opens ' + r.window + ' days before it is due</td><td>' + esc(r.dept) + '</td><td><span class="switch"><input type="checkbox" data-ra="' + r.id + '" aria-label="Active: ' + esc(r.title) + '"' + (r.active ? ' checked' : '') + dis + '><span></span></span></td><td class="nowrap">' + (ro ? '' : '<button type="button" class="btn btn--ghost btn--small" data-redit="' + r.id + '">Edit<span class="sr-only"> ' + esc(r.title) + '</span></button><button type="button" class="btn btn--ghost btn--small" data-rdel="' + r.id + '">Delete<span class="sr-only"> ' + esc(r.title) + '</span></button>') + '</td></tr>'; }).join('');
    var html = '<section class="panel"><div class="panel__head"><h2>Steps that need approval</h2><span class="muted small">The person doing the step submits it. It counts as done once every sign-off agrees.</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Step</th><th>Needs approval</th><th>First sign-off</th><th>Second sign-off</th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="panel__foot muted small">People who already hold a sign-off role do not need to wait for themselves.</div></section>' +
      '<section class="panel" style="margin-top:20px"><div class="panel__head"><h2>Recurring work</h2>' + (ro ? '' : '<button type="button" class="btn btn--secondary btn--small" id="rc-add">' + icon('plus', 15) + ' Add recurring work</button>') + '</div><div class="table-wrap"><table class="table"><thead><tr><th>Task</th><th>How often</th><th>Window</th><th>Team</th><th>Active</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' + (rec || '<tr><td colspan="6" class="empty">Nothing recurs yet.</td></tr>') + '</tbody></table></div><div class="panel__foot muted small">For firms in Lifetime, the next task is created once its window opens. It is never created twice.</div></section>';
    function recDialog(r) {
      var c = r || { title: '', every: 90, window: 14, dept: 'Client Service', active: true };
      var api = dialog({ title: r ? 'Edit recurring work' : 'Add recurring work', body: '<form id="rc-form" novalidate>' + field('rc-title', 'Task', '<input id="rc-title" class="input" value="' + esc(c.title) + '">') + '<div class="two">' + field('rc-every', 'Repeats every (days)', '<input id="rc-every" type="number" min="1" max="1000" class="input" value="' + c.every + '">') + field('rc-win', 'Opens (days before due)', '<input id="rc-win" type="number" min="0" max="365" class="input" value="' + c.window + '">') + '</div>' + field('rc-dept', 'Team', '<select id="rc-dept" class="select">' + selectOpts(DEPTS, c.dept) + '</select>') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Save</button></div></form>' });
      api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
      api.body.querySelector('#rc-form').addEventListener('submit', function (e) {
        e.preventDefault(); var t = api.body.querySelector('#rc-title').value.trim(), ev = Number(api.body.querySelector('#rc-every').value), wn = Number(api.body.querySelector('#rc-win').value), bad = false;
        setError('rc-title', t ? '' : 'Name the task.'); if (!t) bad = true; setError('rc-every', ev >= 1 ? '' : 'Enter 1 or more days.'); if (!(ev >= 1)) bad = true; var wm = wn >= 0 && wn <= ev ? '' : 'The window cannot be longer than the repeat.'; setError('rc-win', wm); if (wm) bad = true; if (bad) return;
        var rec2 = r || { id: nextId('rc'), active: true }; rec2.title = t; rec2.every = ev; rec2.window = wn; rec2.dept = api.body.querySelector('#rc-dept').value; if (!r) S.recurring.push(rec2);
        log('Saved the recurring work ' + t); save(); ensureRecurring(); api.close(); App.refresh(); toast('Saved');
      });
    }
    return { html: html, bind: function (root) {
      if (ro) return;
      root.querySelectorAll('[data-rs]').forEach(function (c) { c.addEventListener('change', function () { var id = c.getAttribute('data-rs'), r = S.approvalRules[id] || (S.approvalRules[id] = { on: false, layers: ['manager'] }); r.on = c.checked; log((c.checked ? 'Turned on' : 'Turned off') + ' approval for a step'); save(); App.refresh(); toast(c.checked ? 'This step now needs approval' : 'This step no longer needs approval'); }); });
      root.querySelectorAll('[data-sid]').forEach(function (s) { s.addEventListener('change', function () { var r = S.approvalRules[s.getAttribute('data-sid')], l = Number(s.getAttribute('data-l')); if (l === 0) r.layers[0] = s.value; else { if (s.value) r.layers[1] = s.value; else r.layers.splice(1); } log('Changed who signs off a step'); save(); toast('Saved'); }); });
      root.querySelectorAll('[data-ra]').forEach(function (c) { c.addEventListener('change', function () { var r = S.recurring.filter(function (x) { return x.id === c.getAttribute('data-ra'); })[0]; r.active = c.checked; log((c.checked ? 'Turned on ' : 'Paused ') + r.title); save(); if (c.checked) ensureRecurring(); toast(c.checked ? 'Active' : 'Paused'); }); });
      root.querySelector('#rc-add').addEventListener('click', function () { recDialog(null); });
      root.querySelectorAll('[data-redit]').forEach(function (b) { b.addEventListener('click', function () { recDialog(S.recurring.filter(function (x) { return x.id === b.getAttribute('data-redit'); })[0]); }); });
      root.querySelectorAll('[data-rdel]').forEach(function (b) { b.addEventListener('click', function () { var r = S.recurring.filter(function (x) { return x.id === b.getAttribute('data-rdel'); })[0]; confirmDialog({ title: 'Delete "' + r.title + '"?', description: 'No new tasks will be created. Tasks already created stay.', confirmLabel: 'Delete', danger: true, onConfirm: function () { S.recurring = S.recurring.filter(function (x) { return x.id !== r.id; }); log('Deleted the recurring work ' + r.title); save(); App.refresh(); toast('Deleted'); } }); }); });
    } };
  }

  var INTEGRATIONS = [
    ['outlook', 'Microsoft 365 and Outlook', 'Email and calendar. Emails to a firm\'s contacts are saved to its history, and meetings show on the firm.', 'connect'],
    ['salesforce', 'Salesforce', 'Bring over firms, contacts, and notes, then keep both in step during the move.', 'connect'],
    ['wealthbox', 'Wealthbox', 'Two-way sync of contacts and tasks with the advisor\'s own CRM.', 'connect'],
    ['blackdiamond', 'Black Diamond', 'Account and balance data for firms. Needs a review of their API first.', 'review'],
    ['schwab', 'Schwab', 'Custodian data feeds. Needs a review of their API first.', 'review'],
    ['zendesk', 'Zendesk', 'Replaced by Tickets in this workspace. Move your tickets over, then switch it off.', 'move']
  ];
  function integSync(key) {
    var it = S.integrations[key], made = 0;
    if (key === 'outlook') {
      var fs = visibleFirms().slice(0, 2), subs = ['Re: training dates', 'Quarterly review time'];
      fs.forEach(function (f, i) { if (!it.emails) return; var who = f.contacts[0] ? f.contacts[0].name : 'a contact'; addNote(f.id, 'message', currentUser().id, 'Email from ' + who + ': "' + subs[i] + '" (saved from Outlook).'); made++; });
      it.synced += made;
    } else {
      S.firms.forEach(function (f) { f.external = f.external || {}; if (!f.external[key]) { f.external[key] = (key === 'salesforce' ? 'SF-' : 'WB-') + (10000 + (f.id.replace(/\D/g, '') * 37 % 8999)); made++; } });
      it.synced = (it.synced || 0) + made;
    }
    it.last = new Date().toISOString(); log('Synced ' + key + ': ' + made + ' items'); save(); return made;
  }
  function adminIntegrations(main, ro) {
    var open = main.__intopen || null, dis = ro ? ' disabled' : '';
    function pillFor(k) { var s = S.integrations[k].status; return s === 'connected' ? '<span class="pill pill--green"><span class="pill__dot"></span>Connected</span>' : s === 'review' ? '<span class="pill pill--amber"><span class="pill__dot"></span>Review planned</span>' : s === 'moved' ? '<span class="pill pill--green"><span class="pill__dot"></span>Tickets moved</span>' : '<span class="pill pill--gray"><span class="pill__dot"></span>Not connected</span>'; }
    var cards = INTEGRATIONS.map(function (x) {
      var k = x[0], it = S.integrations[k], act = '';
      if (!ro) {
        if (x[3] === 'connect') act = it.status === 'connected' ? '<button type="button" class="btn btn--secondary btn--small" data-imanage="' + k + '">Manage<span class="sr-only"> ' + x[1] + '</span></button>' : '<button type="button" class="btn btn--primary btn--small" data-iconnect="' + k + '">Connect<span class="sr-only"> ' + x[1] + '</span></button>';
        else if (x[3] === 'review') act = '<button type="button" class="btn btn--secondary btn--small" data-ireview="' + k + '">' + (it.status === 'review' ? 'Change the review' : 'Plan a review') + '<span class="sr-only"> for ' + x[1] + '</span></button>';
        else act = it.status === 'moved' ? '' : '<button type="button" class="btn btn--secondary btn--small" data-imove="' + k + '">Move tickets</button>';
      }
      return '<section class="panel icard"><div class="icard__top"><div class="strong" style="font-size:15.5px">' + x[1] + '</div>' + pillFor(k) + '</div><div class="muted">' + x[2] + '</div><div class="small muted">' + (it.status === 'connected' ? 'Last sync ' + ago(it.last) + ', ' + (it.synced || 0) + ' items' : it.status === 'review' ? 'Review on ' + esc(it.date || 'a date to be set') : it.status === 'moved' ? it.count + ' tickets moved ' + ago(it.last) : '') + '</div><div class="btn-row">' + act + '</div></section>';
    }).join('');
    var panel = '';
    if (open && S.integrations[open] && S.integrations[open].status === 'connected') {
      var o = S.integrations[open], name = INTEGRATIONS.filter(function (x) { return x[0] === open; })[0][1];
      var tg = open === 'outlook' ? [['emails', 'Save emails to the firm', 'Emails with a firm\'s contacts appear in its history.'], ['meetings', 'Show meetings on the firm', 'Calendar events with a contact link to the firm.'], ['flagged', 'Create tasks from flagged emails', 'Flagged mail becomes a task for the sender.']] : [['match', 'Match firms by name', 'Link records to firms that already exist.'], ['writeback', 'Send changes back', 'Changes here are also written to ' + name + '.']];
      panel = '<section class="panel" style="margin-top:20px"><div class="panel__head"><h2>' + name + '</h2><span class="muted small">' + esc(o.account || '') + '</span></div><div class="panel__body">' + tg.map(function (t) { return '<div class="rule rule--flat"><div><strong>' + t[1] + '</strong><div class="muted">' + t[2] + '</div></div><span class="switch"><input type="checkbox" data-itg="' + t[0] + '" aria-label="' + esc(t[1]) + '"' + (o[t[0]] ? ' checked' : '') + dis + '><span></span></span></div>'; }).join('') + '<div class="field" style="margin-top:12px"><label for="it-every">Sync every</label><select id="it-every" class="select"' + dis + '>' + [[15, '15 minutes'], [60, 'hour'], [1440, 'day']].map(function (x) { return '<option value="' + x[0] + '"' + (Number(o.every || 15) === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>' + (ro ? '' : '<div class="form-actions"><button type="button" class="btn btn--secondary" id="it-sync">' + icon('refresh', 16) + ' Sync now</button><button type="button" class="btn btn--ghost" id="it-off">Disconnect</button></div>') + '</div></section>';
    }
    return { html: '<div class="igrid">' + cards + '</div>' + panel, bind: function (root) {
      root.querySelectorAll('[data-imanage]').forEach(function (b) { b.addEventListener('click', function () { main.__intopen = main.__intopen === b.getAttribute('data-imanage') ? null : b.getAttribute('data-imanage'); App.refresh(); }); });
      if (ro) return;
      root.querySelectorAll('[data-iconnect]').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-iconnect'), nm = INTEGRATIONS.filter(function (x) { return x[0] === k; })[0][1];
          var api = dialog({ title: 'Connect ' + nm, description: 'Use the account your company already has with them.', body: '<form id="ic-form" novalidate>' + (k === 'salesforce' ? field('ic-a', 'Instance address', '<input id="ic-a" class="input" placeholder="https://yourcompany.my.salesforce.com">', 'Starts with https://') : field('ic-a', 'Access token', '<input id="ic-a" class="input" type="password" autocomplete="off">', 'From your ' + nm + ' settings.')) + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Connect</button></div></form>' });
          api.body.querySelector('#ic-a').focus(); api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
          api.body.querySelector('#ic-form').addEventListener('submit', function (e) {
            e.preventDefault(); var v = api.body.querySelector('#ic-a').value.trim(); var msg = k === 'salesforce' ? (/^https:\/\/\S+\.\S+/.test(v) ? '' : 'Enter the https address of your Salesforce instance.') : (v.length >= 8 ? '' : 'The access token looks too short.'); setError('ic-a', msg); if (msg) return;
            S.integrations[k] = { status: 'connected', account: k === 'salesforce' ? v : 'Token ending ' + v.slice(-4), last: new Date().toISOString(), synced: 0, match: true, writeback: false, every: 60 }; log('Connected ' + nm); save(); api.close(); main.__intopen = k; App.refresh(); toast(nm + ' connected');
          });
        });
      });
      root.querySelectorAll('[data-itg]').forEach(function (c) { c.addEventListener('change', function () { S.integrations[open][c.getAttribute('data-itg')] = c.checked; log('Changed an integration setting'); save(); toast('Saved'); }); });
      var ev = root.querySelector('#it-every'); if (ev) ev.addEventListener('change', function () { S.integrations[open].every = Number(ev.value); save(); toast('Saved'); });
      var sy = root.querySelector('#it-sync'); if (sy) sy.addEventListener('click', function () { var n = integSync(open); App.refresh(); toast(n ? 'Synced. ' + n + ' items brought in.' : 'Already in step. Nothing new to bring in.'); });
      var off = root.querySelector('#it-off'); if (off) off.addEventListener('click', function () { var nm = INTEGRATIONS.filter(function (x) { return x[0] === open; })[0][1]; confirmDialog({ title: 'Disconnect ' + nm + '?', description: 'Syncing stops. Anything already brought in stays.', confirmLabel: 'Disconnect', danger: true, onConfirm: function () { S.integrations[open] = { status: 'off' }; log('Disconnected ' + nm); main.__intopen = null; save(); App.refresh(); toast(nm + ' disconnected'); } }); });
      root.querySelectorAll('[data-ireview]').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-ireview'), nm = INTEGRATIONS.filter(function (x) { return x[0] === k; })[0][1], it = S.integrations[k];
          var api = dialog({ title: 'Plan a review of ' + nm, description: 'We check what their API allows before promising anything.', body: '<form id="rv-form" novalidate>' + field('rv-date', 'Review on', '<input id="rv-date" type="date" class="input" value="' + (it.dateRaw || dueIn(14)) + '">') + field('rv-note', 'Who should join, or what to check', '<textarea id="rv-note" class="textarea">' + esc(it.note || '') + '</textarea>') + '<div class="form-actions">' + (it.status === 'review' ? '<button type="button" class="btn btn--ghost" id="rv-cancel">Cancel the review</button>' : '') + '<button type="button" class="btn btn--secondary" data-cancel>Close</button><button type="submit" class="btn btn--primary">Save review</button></div></form>' });
          api.body.querySelector('[data-cancel]').addEventListener('click', api.close); var rc = api.body.querySelector('#rv-cancel'); if (rc) rc.addEventListener('click', function () { S.integrations[k] = { status: 'off' }; save(); api.close(); App.refresh(); toast('Review cancelled'); });
          api.body.querySelector('#rv-form').addEventListener('submit', function (e) { e.preventDefault(); var d = api.body.querySelector('#rv-date').value; if (!d) { setError('rv-date', 'Choose a date.'); return; } S.integrations[k] = { status: 'review', dateRaw: d, date: fmtDay(d), note: api.body.querySelector('#rv-note').value.trim() }; log('Planned an API review for ' + nm); save(); api.close(); App.refresh(); toast('Review planned for ' + fmtDay(d)); });
        });
      });
      root.querySelectorAll('[data-imove]').forEach(function (b) { b.addEventListener('click', function () {
        confirmDialog({ title: 'Move your Zendesk tickets here?', description: 'Three open tickets are copied into Tickets. Zendesk can then be switched off.', confirmLabel: 'Move tickets', onConfirm: function () {
          var now = Date.now(), n = S.tickets.reduce(function (mx, k) { return Math.max(mx, Number(k.no.slice(2)) || 0); }, 1000);
          [['Cannot download the monthly statement', 'f2', 'Dorothy Hargrove', 'Medium'], ['Add a second admin user', 'f5', 'Priya Shah', 'Low'], ['Wrong firm name on invoice', 'f10', 'James Cole', 'High']].forEach(function (x, i) { n++; S.tickets.push({ id: nextId('t'), no: 'T-' + n, title: x[0], firmId: x[1], contact: x[2], priority: x[3], status: 'Open', assigneeId: null, createdAt: new Date(now - (i + 1) * 36e5).toISOString(), respondBy: new Date(now - (i + 1) * 36e5 + TICKET_HOURS[x[3]] * 36e5).toISOString(), firstResponseAt: null, messages: [{ id: nextId('m'), by: null, kind: 'firm', text: 'Imported from Zendesk.', at: new Date(now - (i + 1) * 36e5).toISOString() }], resolvedAt: null, source: 'Zendesk' }); });
          S.integrations.zendesk = { status: 'moved', count: 3, last: new Date().toISOString() }; log('Moved 3 Zendesk tickets'); save(); App.refresh(); toast('3 tickets moved. Open Tickets to see them.'); } });
      }); });
    } };
  }

  function sampleCsv() { return csv([['Firm name', 'City', 'State', 'Address', 'Phone', 'Website', 'Advisor name', 'Role', 'Rep code', 'Licenses', 'Age', 'Gender', 'Office staff'], ['Harbor Light Advisors', 'Charleston', 'SC', '12 Meeting Street', '(843) 555-0101', 'harborlight.example', 'Nora Whitaker', 'Lead advisor', 'HL-1001', 'Series 65', '58', 'Female', '3'], ['Harbor Light Advisors', 'Charleston', 'SC', '12 Meeting Street', '(843) 555-0101', 'harborlight.example', 'Owen Marsh', 'Advisor', 'HL-1002', 'Series 7, Series 66', '44', 'Male', '1']]); }
  function adminData(main, ro) {
    var steps = S.stages.reduce(function (n, st) { return n + st.steps.length; }, 0);
    var html = '<div class="cols"><div class="col"><section class="panel"><div class="panel__head"><h2>Where your data lives</h2></div><div class="panel__body"><div class="kv"><span class="muted">Hosting region</span><strong>US East</strong></div><div class="kv"><span class="muted">Database</span><strong>Dedicated to ' + esc(S.company.name) + '</strong></div><div class="kv"><span class="muted">Backups</span><strong>Every night, kept 30 days</strong></div><div class="kv"><span class="muted">Encryption</span><strong>At rest and in transit</strong></div><div class="small muted" style="margin-top:10px">Your data sits in its own database and never mixes with another company\'s. The region is set when your workspace is created.</div></div></section>' +
      '<section class="panel"><div class="panel__head"><h2>Starting template</h2></div><div class="panel__body"><div style="display:flex;gap:12px;align-items:flex-start"><span class="pill pill--green" style="padding:6px">' + icon('check', 16) + '</span><div><strong>Wealth and advisory firms</strong><div class="muted">Applied when your workspace was created.</div></div></div><div class="kv" style="margin-top:12px"><span>Lifecycle stages</span><span>' + S.stages.length + '</span></div><div class="kv"><span>Checklist steps</span><span>' + steps + '</span></div><div class="kv"><span>Roles</span><span>' + ROLE_IDS.length + '</span></div></div></section></div>' +
      '<div class="col"><section class="panel"><div class="panel__head"><h2>Bring data in</h2></div><div class="panel__body"><p class="muted" style="margin-top:0">Load firms, advisors, and staff from your Excel or Salesforce exports. Save the sheet as CSV first.</p><div class="btn-row">' + (ro ? '' : '<a class="btn btn--primary" href="import.html">' + icon('upload', 16) + ' Import data</a>') + '<button type="button" class="btn btn--secondary" id="dt-tpl">' + icon('download', 16) + ' Download a CSV template</button></div></div></section>' +
      '<section class="panel"><div class="panel__head"><h2>Take data out</h2></div><div class="panel__body"><p class="muted" style="margin-top:0">Download everything in your workspace: firms, advisors, notes, tasks, documents, tickets, and the audit log.</p><div class="btn-row">' + (can('export') ? '<button type="button" class="btn btn--secondary" id="dt-all">' + icon('download', 16) + ' Export all data</button>' : '<span class="muted">Your role cannot export.</span>') + '</div></div></section></div></div>';
    return { html: html, bind: function (root) {
      root.querySelector('#dt-tpl').addEventListener('click', function () { download('import-template.csv', sampleCsv(), 'text/csv'); toast('Template downloaded'); });
      var all = root.querySelector('#dt-all'); if (all) all.addEventListener('click', function () {
        var out = { exportedAt: new Date().toISOString(), company: S.company, firms: S.firms, advisors: S.advisors, tasks: S.tasks, notes: S.notes, documents: S.documents, tickets: S.tickets, messages: S.messages, approvals: S.approvals, users: S.users.map(function (u) { return { id: u.id, name: u.name, email: u.email, role: u.role, dept: u.dept, status: u.status }; }), audit: S.audit };
        download('arkadios-export.json', JSON.stringify(out, null, 2), 'application/json'); toast('Exported everything');
      });
    } };
  }

  /* ---------- Import wizard ---------- */
  function parseCsv(text) {
    var rows = [], row = [], cur = '', q = false, i, c;
    text = text.replace(/^\uFEFF/, '');
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(function (x) { return x !== ''; })) rows.push(row); row = []; }
      else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); if (row.some(function (x) { return x !== ''; })) rows.push(row); }
    return rows;
  }
  var IMPORT_FIELDS = [['ignore', 'Ignore this column'], ['firm', 'Firm name'], ['city', 'City'], ['state', 'State'], ['address', 'Address'], ['phone', 'Phone'], ['website', 'Website'], ['adv', 'Advisor name'], ['role', 'Role'], ['rep', 'Rep code'], ['lic', 'Licenses'], ['age', 'Age'], ['gender', 'Gender'], ['staff', 'Office staff']];
  var IMPORT_GUESS = { firm: ['firm', 'firmname', 'company', 'companyname', 'partner', 'partnername'], city: ['city', 'town'], state: ['state', 'st', 'stateprovince'], address: ['address', 'street', 'streetaddress'], phone: ['phone', 'telephone', 'phonenumber'], website: ['website', 'web', 'url', 'site'], adv: ['advisor', 'advisorname', 'name', 'person', 'representative', 'rep name'], role: ['role', 'title', 'position'], rep: ['repcode', 'rep', 'rep#', 'repnumber', 'repid'], lic: ['licenses', 'license', 'registrations', 'licences'], age: ['age'], gender: ['gender', 'sex'], staff: ['officestaff', 'staff', 'staffcount'] };
  function guessField(h) {
    var n = h.toLowerCase().replace(/[^a-z0-9#]/g, '');
    for (var k in IMPORT_GUESS) if (IMPORT_GUESS[k].indexOf(n) >= 0) return k;
    var cf = S.customFields.filter(function (c) { return c.label.toLowerCase().replace(/[^a-z0-9]/g, '') === n; })[0]; return cf ? 'cf:' + cf.id : 'ignore';
  }
  function importPlan(im) {
    var col = {}; im.map.forEach(function (f, i) { if (f !== 'ignore' && !(f in col)) col[f] = i; });
    var firmsByName = {}; S.firms.forEach(function (f) { firmsByName[f.name.toLowerCase()] = f; });
    var plan = { groups: {}, order: [], valid: 0, bad: [], newFirms: 0, existing: 0, advisors: 0, skipped: 0 };
    im.rows.forEach(function (r, i) {
      function v(k) { return k in col ? String(r[col[k]] || '').trim() : ''; }
      var name = v('firm'), st = v('state').toUpperCase(), why = !name ? 'No firm name' : (!/^[A-Z]{2}$/.test(st) && !firmsByName[name.toLowerCase()] ? 'State is not a 2-letter code' : '');
      if (why) { plan.bad.push({ row: i + 2, why: why }); return; }
      var key = name.toLowerCase(), ex = firmsByName[key], g = plan.groups[key];
      if (!g) { g = plan.groups[key] = { name: name, existing: ex || null, city: v('city'), state: st, address: v('address'), phone: v('phone'), website: v('website'), people: [], custom: {} }; plan.order.push(key); if (ex) plan.existing++; else plan.newFirms++; }
      plan.valid++;
      if (ex && im.dup === 'skip') { plan.skipped++; return; }
      if (v('adv')) { var p = { name: v('adv'), role: v('role') || 'Advisor', rep: v('rep'), lic: v('lic'), age: Number(v('age')) || 0, gender: /^f/i.test(v('gender')) ? 'Female' : /^m/i.test(v('gender')) ? 'Male' : 'Another gender', staff: Number(v('staff')) || 0, city: v('city'), custom: {} }; im.map.forEach(function (f, ci) { if (f.indexOf('cf:') === 0 && r[ci]) { var cf = S.customFields.filter(function (c) { return 'cf:' + c.id === f; })[0]; if (cf && cf.entity === 'advisor') p.custom[cf.id] = r[ci].trim(); else if (cf) g.custom[cf.id] = r[ci].trim(); } }); g.people.push(p); plan.advisors++; }
    });
    return plan;
  }
  function pageImport(main) {
    var im = main.__imp || (main.__imp = { step: 1, name: '', headers: [], rows: [], map: [], dup: 'add', done: null });
    var steps = ['Choose a file', 'Match columns', 'Review', 'Import'];
    var bar = '<div class="stepbar">' + steps.map(function (s, i) { var c = i + 1 < im.step || im.done ? 'green' : i + 1 === im.step ? 'blue' : 'gray'; return '<span class="pill pill--' + c + '"><span class="pill__dot"></span>' + (i + 1) + ' ' + s + '</span>' + (i < 3 ? '<span class="muted">›</span>' : ''); }).join('') + '</div>';
    var body = '';
    if (im.done) {
      body = '<section class="panel"><div class="panel__head"><h2>Import finished</h2></div><div class="panel__body"><div class="callout callout--blue">' + icon('check') + '<div><strong>' + im.done.firms + ' new firms and ' + im.done.people + ' people were added.</strong><div>' + im.done.updated + ' existing firms got new people. ' + im.done.skipped + ' rows were skipped.</div></div></div><div class="form-actions"><a class="btn btn--secondary" href="people.html">See the people</a><a class="btn btn--primary" href="firms.html">See the firms</a></div></div></section>';
    } else if (im.step === 1) {
      body = '<section class="panel"><div class="panel__head"><h2>Choose a CSV file</h2></div><div class="panel__body"><p class="muted" style="margin-top:0">In Excel, choose Save As, then CSV. Each row is one person, with their firm\'s details repeated. Up to 5,000 rows.</p>' + field('im-file', 'File', '<input id="im-file" type="file" accept=".csv,text/csv" class="input">') + '<div class="form-actions"><button type="button" class="btn btn--secondary" id="im-tpl">' + icon('download', 16) + ' Download a CSV template</button><button type="button" class="btn btn--primary" id="im-next1">Continue</button></div></div></section>';
    } else if (im.step === 2) {
      var used = {}; im.map.forEach(function (f) { if (f !== 'ignore') used[f] = (used[f] || 0) + 1; });
      var fopts = IMPORT_FIELDS.concat(S.customFields.map(function (c) { return ['cf:' + c.id, 'Custom field: ' + c.label]; }));
      body = '<div class="cols"><section class="panel"><div class="panel__head"><h2>Match your columns</h2><span class="muted small">' + esc(im.name) + ', ' + im.rows.length + ' rows</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Column in your file</th><th>Goes to</th></tr></thead><tbody>' + im.headers.map(function (h, i) { return '<tr><td><span class="mono">' + esc(h) + '</span><span class="cell-sub">' + esc((im.rows[0] || [])[i] || '') + '</span></td><td><label class="sr-only" for="mp-' + i + '">Where ' + esc(h) + ' goes</label><select id="mp-' + i + '" class="select" data-mp="' + i + '">' + fopts.map(function (o) { return '<option value="' + o[0] + '"' + (im.map[i] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></td></tr>'; }).join('') + '</tbody></table></div></section>' +
        '<section class="panel"><div class="panel__head"><h2>What we need</h2></div><div class="panel__body"><div class="kv"><span>Firm name</span>' + (used.firm ? '<span class="pill pill--green">Matched</span>' : '<span class="pill pill--red">Needed</span>') + '</div><div class="kv"><span>State</span>' + (used.state ? '<span class="pill pill--green">Matched</span>' : '<span class="pill pill--amber">Needed for new firms</span>') + '</div><div class="kv"><span>Advisor name</span>' + (used.adv ? '<span class="pill pill--green">Matched</span>' : '<span class="pill pill--gray">Optional</span>') + '</div><span class="error" id="mp-err" role="alert" hidden></span></div></section></div><div class="form-actions"><button type="button" class="btn btn--secondary" id="im-back">Back</button><button type="button" class="btn btn--primary" id="im-next2">Review</button></div>';
    } else if (im.step === 3) {
      var pl = importPlan(im);
      body = '<div class="cols"><section class="panel"><div class="panel__head"><h2>Check before importing</h2></div><div class="panel__body"><div class="kv"><span>Rows ready</span><strong>' + pl.valid + '</strong></div><div class="kv"><span>New firms</span><strong>' + pl.newFirms + '</strong></div><div class="kv"><span>Firms you already have</span><strong class="' + (pl.existing ? 'amber' : '') + '">' + pl.existing + '</strong></div><div class="kv"><span>People to add</span><strong>' + pl.advisors + '</strong></div><div class="kv"><span>Rows that cannot be imported</span><strong class="' + (pl.bad.length ? 'red' : '') + '">' + pl.bad.length + '</strong></div>' +
        (pl.existing ? '<div class="callout callout--amber">' + icon('alert') + '<div><strong>' + pl.existing + ' firms already exist.</strong><div>Choose what to do with their rows.</div></div></div><div class="field" style="margin-top:12px"><label for="im-dup">For firms you already have</label><select id="im-dup" class="select"><option value="add"' + (im.dup === 'add' ? ' selected' : '') + '>Add the people to the existing firm</option><option value="skip"' + (im.dup === 'skip' ? ' selected' : '') + '>Skip those rows</option></select></div>' : '') + '</div></section>' +
        '<section class="panel"><div class="panel__head"><h2>Problems</h2></div>' + (pl.bad.length ? '<ul class="rows">' + pl.bad.slice(0, 8).map(function (b) { return '<li class="rows__item"><div class="grow">Row ' + b.row + '</div><span class="pill pill--red">' + b.why + '</span></li>'; }).join('') + '</ul>' + (pl.bad.length > 8 ? '<div class="panel__foot muted small">And ' + (pl.bad.length - 8) + ' more.</div>' : '') : '<p class="panel__body muted">No problems found.</p>') + '</section></div><div class="form-actions"><button type="button" class="btn btn--secondary" id="im-back">Back</button><button type="button" class="btn btn--primary" id="im-go"' + (pl.valid ? '' : ' disabled') + '>Import ' + pl.valid + ' rows</button></div>';
    }
    main.innerHTML = pageHead('Import data', 'Load firms, advisors, and staff from your exports.', '<a class="btn btn--secondary" href="admin.html?tab=data">Back to Admin</a>') + bar + body;
    function again() { App.refresh(); }
    var tpl = main.querySelector('#im-tpl'); if (tpl) tpl.addEventListener('click', function () { download('import-template.csv', sampleCsv(), 'text/csv'); toast('Template downloaded'); });
    var n1 = main.querySelector('#im-next1'); if (n1) n1.addEventListener('click', function () {
      var fi = main.querySelector('#im-file').files[0]; if (!fi) { setError('im-file', 'Choose a CSV file first.'); return; }
      var rd = new FileReader(); rd.onload = function () {
        var rows = parseCsv(String(rd.result)); if (rows.length < 2) { setError('im-file', 'The file needs a header row and at least one row of data.'); return; } if (rows.length > 5001) { setError('im-file', 'This file has more than 5,000 rows.'); return; }
        im.name = fi.name; im.headers = rows[0].map(function (h) { return h.trim(); }); im.rows = rows.slice(1); im.map = im.headers.map(guessField); im.step = 2; again();
      }; rd.readAsText(fi);
    });
    main.querySelectorAll('[data-mp]').forEach(function (s) { s.addEventListener('change', function () { im.map[Number(s.getAttribute('data-mp'))] = s.value; again(); }); });
    var bk = main.querySelector('#im-back'); if (bk) bk.addEventListener('click', function () { im.step -= 1; again(); });
    var n2 = main.querySelector('#im-next2'); if (n2) n2.addEventListener('click', function () { if (im.map.indexOf('firm') < 0) { var er = main.querySelector('#mp-err'); er.textContent = 'Match a column to Firm name first.'; er.hidden = false; return; } im.step = 3; again(); });
    var dp = main.querySelector('#im-dup'); if (dp) dp.addEventListener('change', function () { im.dup = dp.value; again(); });
    var go = main.querySelector('#im-go'); if (go) go.addEventListener('click', function () {
      var pl = importPlan(im), made = { firms: 0, people: 0, updated: 0, skipped: pl.skipped + pl.bad.length }, by = currentUser();
      pl.order.forEach(function (k) {
        var g = pl.groups[k], f = g.existing;
        if (!f) {
          f = { id: nextId('f'), name: g.name, city: g.city || '', state: g.state, address: g.address, phone: g.phone, website: g.website, aum: 'Not yet known', stage: 0, stageSince: new Date().toISOString(), history: [], ownerId: null, dept: 'Relationship Ops', prefix: g.name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase(), createdAt: new Date().toISOString(), fundsAt: null, contacts: [], billing: { ach: 'Not collected yet', w9: 'Not received' }, custom: g.custom };
          S.firms.push(f); addStageTasks(f, 0); addNote(f.id, 'note', by.id, 'Imported from ' + im.name + '.'); made.firms++;
        } else if (g.people.length) made.updated++;
        g.people.forEach(function (p) { S.advisors.push({ id: nextId('a'), firmId: f.id, name: p.name, role: p.role, age: p.age, gender: p.gender, city: p.city || f.city, state: f.state, officeStaff: p.staff, repCode: p.rep, licenses: p.lic || 'No license needed', custom: p.custom }); made.people++; });
      });
      log('Imported ' + made.firms + ' firms and ' + made.people + ' people from ' + im.name); save(); im.done = made; again(); toast('Import finished');
    });
  }

  function roleScopePanel(main, ro) {
    var sc = main.__scdraft || (main.__scdraft = copy(S.scopes)), areas = [['firms', 'Firms'], ['tasks', 'Tasks'], ['documents', 'Documents']];
    return '<section class="panel" style="margin-top:20px"><div class="panel__head"><h2>Who sees what</h2><span class="muted small">All, the person\'s own team, or only records they own</span></div><div class="table-wrap"><table class="table matrix"><thead><tr><th scope="col">Records</th>' + ROLE_IDS.map(function (r) { return '<th scope="col" class="matrix__plan"><span class="matrix__name">' + ROLES[r] + '</span></th>'; }).join('') + '</tr></thead><tbody>' +
      areas.map(function (a) { return '<tr><th scope="row">' + a[1] + '</th>' + ROLE_IDS.map(function (r) { var cur = (sc[r] && sc[r][a[0]]) || 'all'; return '<td class="matrix__cell"><label class="sr-only" for="sc-' + a[0] + '-' + r + '">' + a[1] + ' for ' + ROLES[r] + '</label><select id="sc-' + a[0] + '-' + r + '" class="select select--chip" data-scope="' + a[0] + '" data-srole="' + r + '"' + (ro || r === 'super' ? ' disabled' : '') + '>' + [['all', 'All'], ['dept', 'Own team'], ['own', 'Own records']].map(function (o) { return '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div><div class="panel__foot muted small">A role limited to its own team sees firms, tasks, and documents for that team only. Search, the map, people, and reports follow the same limit.</div></section>';
  }
  /* ---------- page: sign in ---------- */
  function pageLogin() {
    var root = document.getElementById('login'), P = params(), next = P.get('next') || '', info = P.get('msg') || '', email = '';
    function safeNext() { return /^(index|firms|firm|pipeline|tasks|documents|reports|team|admin|dashboards|people|map|approvals|tickets|communications|notifications|account|settings|import)\.html(\?[\w=&%.-]*)?$/.test(next) ? next : 'index.html'; }
    function summary(role) {
      var c = CAPS[role], all = c.indexOf('*') >= 0;
      var items = [['firms.create', 'create firms'], ['firms.edit', 'edit firms'], ['advisors.edit', 'edit advisors'], ['license.edit', 'edit licenses'], ['tasks.edit', 'work tasks'], ['pipeline.move', 'move firms'], ['funds.record', 'record funds'], ['billing.view', 'see billing details'], ['team.view', 'see team performance']];
      var can_ = items.filter(function (i) { return all || c.indexOf(i[0]) >= 0; }).map(function (i) { return i[1]; });
      return all ? 'Can do everything.' : (can_.length ? 'Can ' + can_.slice(0, 5).join(', ') + (can_.length > 5 ? ', and more' : '') + '.' : 'Can look but not change anything.');
    }
    function render() {
      var demo = ROLE_IDS.map(function (r) {
        var u = S.users.filter(function (x) { return x.role === r; })[0]; if (!u) return '';
        return '<div class="demo-card"><div><strong>' + ROLES[r] + '</strong><div class="muted">' + esc(u.name) + ', ' + esc(u.email) + '</div></div><div class="small">' + ROLE_BLURB[r] + '</div><div class="small muted">' + summary(r) + '</div>' +
          '<button type="button" class="btn btn--secondary btn--small" data-use="' + esc(u.email) + '">Use this account<span class="sr-only"> (' + ROLES[r] + ')</span></button></div>';
      }).join('');
      root.innerHTML = '<div class="login"><div class="login__brand"><div class="side__brand"><span class="side__mark" aria-hidden="true">' + esc(S.company.name.charAt(0).toUpperCase()) + '</span><div><strong>' + esc(S.company.name) + '</strong><small>' + esc(S.company.tagline) + '</small></div></div>' +
        '<div><h1>One place for every firm.</h1><p>Find a firm or advisor in seconds, hand work between teams, and keep every relationship moving. What you see depends on your role.</p></div><p class="login__fine">Demo with sample data.</p></div>' +
        '<div class="login__main"><section class="login__card"><h2 class="login__title">Sign in</h2><p class="muted" style="margin-bottom:18px">Use your work email.</p>' + (info ? '<p class="login__note" role="status">' + esc(info) + '</p>' : '') +
        '<form id="lg-form" novalidate>' + field('lg-email', 'Work email', '<input id="lg-email" type="email" class="input" autocomplete="username" value="' + esc(email) + '">') + field('lg-pass', 'Password', '<input id="lg-pass" type="password" class="input" autocomplete="current-password">') +
        '<div class="login__links"><a href="#" id="lg-forgot">Forgot password?</a></div><button type="submit" class="btn btn--primary" style="width:100%;justify-content:center">Sign in</button></form></section>' +
        '<section class="login__demo" aria-labelledby="dm-h"><h2 id="dm-h">Demo accounts</h2><p class="muted" style="margin:2px 0 12px">Every demo account uses the password <span class="mono">' + DEMO_PASSWORD + '</span>. Each role sees and can change different things.</p><div class="demo-grid">' + demo + '</div></section></div></div>';
      root.querySelectorAll('[data-use]').forEach(function (b) { b.addEventListener('click', function () { email = b.getAttribute('data-use'); render(); root.querySelector('#lg-pass').value = DEMO_PASSWORD; root.querySelector('#lg-pass').focus(); }); });
      root.querySelector('#lg-forgot').addEventListener('click', function (e) {
        e.preventDefault();
        var api = dialog({ title: 'Reset your password', description: 'Enter your work email. If it matches an account, we send a link to set a new password.', body: '<form id="fp-form" novalidate>' + field('fp-email', 'Work email', '<input id="fp-email" type="email" class="input" autocomplete="off">') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Cancel</button><button type="submit" class="btn btn--primary">Send reset link</button></div></form>' });
        api.body.querySelector('[data-cancel]').addEventListener('click', api.close);
        api.body.querySelector('#fp-form').addEventListener('submit', function (ev) { ev.preventDefault(); var v = api.body.querySelector('#fp-email').value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { setError('fp-email', 'Enter a valid email address.'); return; } api.close(); toast('If that email has an account, a reset link is on its way'); });
      });
      root.querySelector('#lg-form').addEventListener('submit', function (e) {
        e.preventDefault(); email = root.querySelector('#lg-email').value.trim(); var pass = root.querySelector('#lg-pass').value;
        setError('lg-email', email ? '' : 'Enter your work email.'); setError('lg-pass', pass ? '' : 'Enter your password.'); if (!email || !pass) return;
        var u = S.users.filter(function (x) { return x.email.toLowerCase() === email.toLowerCase(); })[0];
        if (!u || pass !== (S.passwords[u.id] || DEMO_PASSWORD)) { setError('lg-pass', 'The email or password is not right.'); root.querySelector('#lg-pass').select(); return; }
        if (u.status === 'deactivated') { setError('lg-email', 'This account is deactivated. Ask a Super Admin to turn it back on.'); return; }
        function go() { var sid = newSession(u); setSession({ userId: u.id, sid: sid, at: Date.now() }); if (S.record.signins) { recordAudit(u.id, 'Signed in'); save(); } location.href = next ? safeNext() : (u.start && /^[a-z]+\.html$/.test(u.start) ? u.start : 'index.html'); }
        if (S.security.mfa) {
          var mf = dialog({ title: 'Enter your code', description: 'Open your authenticator app and enter the 6-digit code for ' + u.email + '. Demo code: 123456.', body: '<form id="mf-form" novalidate>' + field('mf-code', 'Authentication code', '<input id="mf-code" class="input mono" inputmode="numeric" maxlength="6" autocomplete="one-time-code">') + '<div class="form-actions"><button type="button" class="btn btn--secondary" data-cancel>Back</button><button type="submit" class="btn btn--primary">Verify and sign in</button></div></form>' });
          mf.body.querySelector('#mf-code').focus(); mf.body.querySelector('[data-cancel]').addEventListener('click', mf.close);
          mf.body.querySelector('#mf-form').addEventListener('submit', function (ev) { ev.preventDefault(); if (mf.body.querySelector('#mf-code').value.trim() !== '123456') { setError('mf-code', 'That code is not right. Try again.'); return; } go(); });
          return;
        }
        go();
      });
    }
    render(); var el = root.querySelector('#lg-email'); if (el) el.focus();
  }

  /* ---------- boot ---------- */
  function boot() {
    S = load();
    var page = document.body.getAttribute('data-page');
    if (page === 'login') { pageLogin(); return; }
    if (!currentUser()) { var file = (location.pathname.split('/').pop() || 'index.html') + location.search; location.replace('login.html?next=' + encodeURIComponent(file)); return; }
    var ses = getSession();
    if (ses && ses.sid && !(S.sessions[ses.userId] || []).some(function (x) { return x.id === ses.sid; })) { setSession(null); location.replace('login.html?msg=' + encodeURIComponent('You were signed out from another device.')); return; }
    ensureRecurring();
    var main = document.getElementById('main');
    var pages = { home: pageHome, firms: pageFirms, firm: pageFirm, pipeline: pagePipeline, tasks: pageTasks, documents: pageDocuments, reports: pageReports, team: pageTeam, admin: pageAdmin, dashboards: pageDashboards, map: pageMap, people: pagePeople, approvals: pageApprovals, tickets: pageTickets, communications: pageCommunications, notifications: pageNotifications, account: pageAccount, settings: pageSettings, import: pageImport };
    function draw() { var need = PAGE_CAP[page]; if (need && !can(need)) noAccess(main); else pages[page](main); }
    App.refresh = function () { renderChrome(); draw(); };
    renderChrome(); draw(); startTerms();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
