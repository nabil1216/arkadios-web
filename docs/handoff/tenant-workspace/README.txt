Arkadios workspace (tenant UI): plain HTML, CSS, and JavaScript

START HERE: open login.html in a browser. No build step and no server needed.
It also works when copied to any web server. The _headers file adds security headers on Netlify or Cloudflare Pages.

Demo accounts (password demo-1234; MFA code 123456 if an admin turns MFA on)
  avery.quinn@arkadios.example     Super Admin       everything, including Admin and Settings
  elena.marsh@arkadios.example     Leader            sees everything, changes nothing
  dana.reyes@arkadios.example      Manager           firms, tasks, approvals, reports, team performance
  imani.brooks@arkadios.example    Client Service    firms, advisors, tasks, tickets, messages
  alex.park@arkadios.example       Advisor Support   advisors, tasks, tickets
  noor.haddad@arkadios.example     Compliance        edits licenses, approves as Compliance
  priya.okafor@arkadios.example    Billing           billing details, records funds
  rory.quinn@arkadios.example      Read-only         looks, changes nothing

Menu (8 items) and the pages inside each
  Command Center   index.html (overview), dashboards.html
  Firms            firms.html, people.html, map.html, firm.html (one firm)
  Pipeline         pipeline.html
  Tasks            tasks.html (list and calendar), approvals.html, tickets.html
  Documents        documents.html (with e-signature), communications.html
  Reports          reports.html
  Team performance team.html (People, Plan vs achievement, SLA)
  Admin            admin.html (roles and scope, users, teams, lifecycle, approvals and recurring,
                   custom fields, integrations, data and hosting, security and AI, audit log), import.html
  Bell             notifications.html
  Your name        account.html (My account), settings.html (Settings, for admins)

Notes
  - Everything is sample data kept in the browser (localStorage). "Reset demo data" (Super Admin) puts it back.
  - Roles are checked in the browser for this demo. A real build checks them on the server.
  - Email, text, e-signature, and integrations are simulated and say so in the app.
  - Uploaded files are kept in the browser (up to 1.5 MB each).
