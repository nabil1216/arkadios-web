Platform console (mother UI): plain HTML, CSS, and JavaScript

Open login.html (or any page: signed-out visitors are sent to the sign-in page).
There is no build step and no server needed. It also works when copied to any web server.

Demo accounts (password demo-1234, authentication code 123456)
  dana.whitfield@platform.example   Super admin      can change everything, including Access control
  omar.haddad@platform.example      Support lead     Tenants view, can sign in as tenant users, SMS, Support access
  priya.nair@platform.example       Billing manager  Billing and Transactions, view Tenants and Plans
  liam.carter@platform.example      Auditor          read-only view of most areas (no MFA, so no code asked)
The sign-in page lists these with what each role can change, view, or not open.
Menus, pages, and buttons follow the role. A Super admin can change what each role can do under
Access control, and the change shows up the next time that role signs in.

Pages
  login.html         Sign in, MFA code, forgot password
  index.html         Overview: tenants by status, items that need attention, activity, release rollout
  tenants.html       Tenants: search, filter, Create tenant (with setup steps), Manage, Sign in as
  plans.html         Plans and modules: module switches per plan, trial lengths
  billing.html       Billing: totals, extend a deadline, preview the tenant bill notice, download an invoice
  transactions.html  Transactions: receipts, refunds, retry a failed payment, mark a bank transfer received,
                     record a payment, export CSV
  sms.html           SMS: balance, buy credits, add credits for a tenant, send a message to tenant admins
  support.html       Support access: start and end audited support sessions
  access.html        Access control: staff, roles, what each role can do, invitations, sign-in security

Notes
  - Everything is sample data. Changes are kept in the browser (localStorage) so they carry across pages.
    The signed-in user is kept for the browser tab only. Staff are signed out after the inactivity time set
    under Access control (30 minutes to start).
  - This demo checks roles in the browser only. A real build checks them on the server for every request.
  - "Reset demo data" (Super admin only, bottom of the sidebar) puts everything back.
  - Fonts are bundled in assets/fonts, so it works offline.
  - Put it behind a password if you host it. The pages ask search engines not to index them.
  - Domain names use platform.example, which is reserved for examples.
