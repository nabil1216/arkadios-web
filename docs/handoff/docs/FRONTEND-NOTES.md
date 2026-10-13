# Arkadios CRM: frontend notes

These notes are for the developers who will build the real frontend from the two working HTML demos.
The demos are the source of truth for layout, behaviour, wording, and permissions.

## 1. What is here

| Folder | What it is |
| --- | --- |
| `tenant-workspace/` | The client-side app (what Arkadios's teams use). Open `login.html`. |
| `platform-console/` | The staff-side "mother" console (creates and manages tenants, plans, billing, SMS, support access). Open `login.html`. |
| `tests/` | 17 browser test scripts (Playwright, Python) that act as acceptance checks for both demos. |
| `pdf/` | `arkadios-tenant-every-page.pdf` (51 pages, every tenant screen) and `arkadios-platform-console-preview.pdf` (27 pages). |
| `deploy-kit/` | Nginx, Docker, and Netlify headers used to host the demos. |

Both demos are plain HTML, CSS, and JavaScript. No build step, no framework, no network calls.
Fonts are bundled (Newsreader, IBM Plex Sans, IBM Plex Mono).
Live copies: https://arkadios-tenant.netlify.app and https://platform-console.netlify.app/login.html

Demo password for every account is `demo-1234`. The console asks for the code `123456`
(the tenant app asks for it too when an admin turns MFA on). The sign-in pages list every demo account.

## 2. How the demos work, and what they fake

- All data is sample data created by a `seed()` function in `assets/workspace.js` and `assets/platform.js`.
- State is saved in the browser: `localStorage` key `arkadios_ws_v1` (tenant), `arkadios_platform_v1` (console),
  `arkadios_ws_files` (uploaded files, as data URLs). The signed-in user is in `sessionStorage`
  (`arkadios_ws_session`, `arkadios_platform_session`).
- "Reset demo data" (Super Admin, bottom left) clears it.
- **Roles are checked in the browser only.** In the real build every permission, scope, and sensitive-field rule
  must be enforced on the server. The frontend should only hide what the server would refuse.
- Simulated in the demo, and labelled that way in the UI: sending email and text, e-signature, the integrations
  (Outlook, Salesforce, Wealthbox, Black Diamond, Schwab, Zendesk), the AI suggestions (simple rules over the firm's data),
  SSO set-up, payments, and the console's tenant provisioning.

## 3. Design system

- Tokens are CSS variables at the top of `assets/workspace.css` (tenant) and `assets/platform.css` (console).
  Tenant: navy `#1B2A3A`, mist `#EEF2F6`, blue `#2F5BD3`; stage colours Prospect `#3B6FD8`, Onboarding `#D08A1E`,
  Implementation `#2F855A`, Training `#B8434A`, Lifetime `#1B2A3A`. Console: graphite `#1F272E` with teal `#0E7C7B`.
- Type: Newsreader for titles, IBM Plex Sans for UI, IBM Plex Mono for codes and ids.
- Components to build once and reuse (class names in the CSS are a good guide): Panel, Table (sortable, paged),
  Tabs, Segmented control, Pill, Avatar, Meter, Switch, Field (label, hint, error), Dialog, Drawer, Toast,
  Confirm dialog, Kanban board, Calendar, Tile map, Donut, Stacked bar, Timeline, Lifecycle ribbon.
- Accessibility already built in and worth keeping: every control has a label, errors use `role="alert"`,
  dialogs trap focus and close on Escape, tables use real `<th>`, state is never colour only.

## 4. Tenant workspace

### Menu and pages
Eight menu items. Pages that sit inside an item are listed under it in the left menu and as a small switch on the page.

| Menu item | Pages (file) |
| --- | --- |
| Command Center | `index.html` (overview, editable layout), `dashboards.html` |
| Firms | `firms.html`, `people.html`, `map.html`, `firm.html?id=` (tabs: overview, advisors, service, workstreams, tasks, documents) |
| Pipeline | `pipeline.html` |
| Tasks | `tasks.html` (list and calendar), `approvals.html`, `tickets.html` |
| Documents | `documents.html` (with e-signature), `communications.html` |
| Reports | `reports.html` |
| Team performance | `team.html` (People, Plan vs achievement, SLA) |
| Admin | `admin.html` (Roles, Users, Teams, Lifecycle, Approvals and recurring, Custom fields, Integrations, Data and hosting, Security and AI, Audit log), `import.html` |
| Bell / your name | `notifications.html`, `account.html`, `settings.html` (General, Terminology, Menu, Notifications) |

### Roles and permission keys
Roles: Super Admin, Leader, Manager, Client Service, Advisor Support, Compliance, Billing, Read-only.
Permission keys (a role holds a list of them; Super Admin holds `*`):
`firms.create`, `firms.edit`, `advisors.edit`, `rep.edit`, `license.edit`, `tasks.create`, `tasks.edit`, `pipeline.move`,
`notes.add`, `billing.view`, `billing.edit`, `funds.record`, `documents.upload`, `documents.delete`, `tickets.edit`,
`comms.send`, `reports.view`, `reports.build`, `team.view`, `export`, `admin.view`, `admin.edit`.
The default role-to-key table is `CAPS` in `workspace.js`; Admin lets a Super Admin change it (stored as `caps`).
**Scope:** per role and per area (`firms`, `tasks`, `documents`): `all`, `dept` (own team), or `own` (own records).
Scope must filter lists, search, the map, People, reports, and counts, server side.
**Sensitive fields:** banking and tax details need `billing.view`; licenses need `license.edit` to change;
rep codes need `rep.edit`.

### Data model (what the demo keeps in `S`)
- `users`: id, name, email, role, dept, status (`active` / `deactivated`), start, tasksScope.
- `firms`: id, name, city, state, address, phone, website, aum, stage (0 to 4), stageSince, history[{stage, from, to}],
  ownerId, dept, prefix, createdAt, fundsAt, contacts[{name, title, email}], billing{ach, w9}, custom{}, external{salesforce, wealthbox}.
- `advisors`: id, firmId, name, role, age, gender, city, state, officeStaff, repCode, licenses, custom{}.
- `stages`: five stages, each with steps[{id, title, dept, days, how}]; `targets[]` (days per stage); `stageNames[]`.
- `tasks`: id, title, firmId, stageIdx, stepId, dept, assigneeId, priority, status (`Open`, `In progress`, `Blocked`,
  `Awaiting approval`, `Done`), due, desc, subtasks[], blockedOn, blockedReason, blockedAt, comments[], createdAt, doneAt, approvalId.
- `notes`: id, firmId, type (`note`, `call`, `handoff`, `message`, `stage`), by, at, text.
- `documents`: id, title, ext, size, category, firmId, stage, tags, by, at, hasFile, fileName,
  sign{status, by, signers[{name, role, status, at}], events[]}.
- `approvalRules`: stepId to {on, layers[roles]}; `approvals`: id, taskId, firmId, title, layers, idx, by, at, status, events[].
- `tickets`: id, no (`T-1042`), title, firmId, contact, priority, status, assigneeId, createdAt, respondBy, firstResponseAt,
  messages[{by, kind (`firm`, `staff`, `internal`), text, at}], resolvedAt. `templates`, `messages` (sent log).
- `reports`: id, name, entity (`advisor` or `firm`), match (`all` or `any`), conds[{field, op, value}], cols[], sort, shared, by.
- `customFields`: id, entity, label, type (`text`, `number`, `select`), options[].
- `recurring`: id, title, every, window, dept, active. `rules`: {funds, checklists}.
- `notifs`: id, to, kind, text, href, at, read; `userNotif`; `notifDefaults`.
- Settings: `company`, `work` (days, from, to, tz, workdays, dmy), `record`, `terms`, `menu`, `scopes`, `caps`, `security`
  (mfa, ai, aiLimit, sso), `slaTarget`, `integrations`, `dash` (per user), `layouts`, `savedViews`, `sessions`, `audit`, `depts`.

### Business rules the server must own (all are client-side in the demo)
1. **Moving a firm** to a stage: close the current history entry, set the new stage and `stageSince`, create the new stage's
   checklist as tasks (due = days after the move, in working days if enabled, assigned by team default or firm owner),
   add a stage note, notify the owner. Open tasks from the old stage stay. Rule can be switched off (`rules.checklists`).
2. **Funds received** on a firm: set `fundsAt`, create the six billing tasks for Finance, unblock tasks blocked on Finance,
   add a hand-off note, notify the owner. Rule can be switched off (`rules.funds`).
3. **Approvals:** completing a step that has an approval rule creates a request instead of finishing the task
   (status `Awaiting approval`). People who already hold a sign-off role skip their own layer. Each layer approves, or returns
   with a required comment; the last approval completes the task. Notify approvers, then the submitter.
4. **Recurring work:** for firms in Lifetime, create the next task once its window opens (`every` days after the last due
   date, `window` days early). Never create two open copies.
5. **Due dates** can count working days only (`work.days`, `work.workdays`).
6. **Tickets:** first response due 4 / 8 / 24 hours by priority (High / Medium / Low). Response time is `Met` or `Missed`
   once a staff reply exists, paused while `Waiting on firm`, otherwise a countdown or `Breached`.
7. **Notifications** are created for: task assigned, blocked, mention (`@Full Name` or `@First`), stage move and funds (to the owner),
   approval requests and decisions. Each user can switch kinds off; company defaults are in `notifDefaults`.
   Overdue work is shown live, not stored.
8. **Scope** filters (see above) and **terminology** (the demo swaps words in the page; do this properly with a message catalogue).
9. **Statistics:** SLA = tasks done in the last 30 days whose `doneAt` date is on or before `due`; plan vs achievement =
   tasks due in the last 30 days, split into done on time, done late, not done, blocked; category = stage name for checklist
   tasks, Billing for Finance tasks, otherwise Service. Delivery % = done in 30 days / (done in 30 days + overdue now).
10. **Reports:** operators `is`, `is not`, `contains` (text); `is`, `is over`, `is under` (number); `is`, `is not` (choice),
    match all or any, any field including custom fields, optional sort and columns, live result count.
11. **Import:** CSV, up to 5,000 rows, auto-match columns by name, a firm needs a name and (if new) a 2-letter state, rows for
    existing firms are skipped or add people to that firm, new firms start in Prospect with its checklist.
12. **Audit log:** record who changed what; sign-ins and exports only when the company switches that on.
13. **Sessions:** one record per sign-in; a user can end the others; a removed session is signed out on its next request.

### Suggested frontend build
- React with a router (one route per page above) and a typed API client; keep the demo's page and component boundaries.
- Replace the in-browser `S` object with server queries and mutations; keep optimistic UI for toggles, task completion, and drag and drop.
- Endpoints the pages need (grouped): auth and sessions; users, roles, scopes; firms and history; advisors; tasks and comments;
  stages and checklists; approvals; notes; documents and signature requests; tickets and replies; templates and messages;
  reports (run, save, delete); dashboards (per user); notifications; settings and terminology; audit; import (validate, commit);
  integrations (connect, sync); team statistics (plan, SLA, delivery).
- The tile map needs only counts by state; a real tile map can replace it later if the client wants street-level detail.

## 5. Platform console (mother UI)

Pages: `login`, `index` (Overview), `tenants`, `plans`, `billing`, `transactions`, `sms`, `support`, `access`.
- Tenants: search and filter, create a tenant (own database and domain, shown as provisioning steps), manage, and
  "sign in as" a tenant user with a required reason (support sessions are audited).
- Plans: module switches per plan and trial lengths. Billing: totals, extend a deadline, preview the bill notice, invoice download.
- Transactions: Stripe, PayPal, and bank transfer with receipt, refund, retry, mark received, record a payment, CSV export.
- SMS: platform balance, buy credits, add credits per tenant, send to tenant admins.
- Access control: staff list and role matrix (areas by roles), MFA required, inactivity sign-out (default 30 minutes).
- Roles: Super admin, Support lead, Billing manager, Auditor (read only, no MFA in the demo). Each role sees only its own menu,
  pages, buttons, and overview panels.
- Seed: six tenants (Arkadios is the first), historical bills, six transactions, SMS credits and messages, five staff.
  Read `seed()` in `assets/platform.js` for the exact shapes.

## 6. Known gaps against the proposal

- Adding a new lifecycle stage is not built (renaming is). There is no task categories and types table; categories are derived.
- Black Diamond and Schwab only plan an API review. Email, text, e-signature, and integrations are simulated.
- The map is a tile map of states. Dark mode and keyboard shortcuts from the prototype are not built.
- Roles are enforced in the browser only (see section 2). SOC 2 groundwork and real hosting are outside the demos.
