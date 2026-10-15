# Arkadios CRM: architecture

Source of truth for design decisions. Keep this file identical in both repos
(`arkadios-web/docs/ARCHITECTURE.md` and `arkadios-api/docs/ARCHITECTURE.md`).
If a decision changes, change it here first, then in code.

## 1. System overview

Multi-tenant SaaS CRM for wealth-management firms (client: Arkadios).
Two separate repos that meet only through an OpenAPI contract.

| Repo | Stack | Purpose |
|---|---|---|
| `arkadios-web` | React + TypeScript + Vite (pnpm workspace) | `apps/console` (platform staff UI, built first), `apps/workspace` (tenant UI, later), shared packages later |
| `arkadios-api` | ASP.NET Core Web API, Clean Architecture | Platform API and tenant API, background jobs |

Approved UI demos live in `arkadios-web/docs/handoff/` (platform console and tenant workspace).
Match them; do not redesign.

## 2. Backend structure (arkadios-api)

```
src/
  Arkadios.Domain/          entities, enums, value objects. No packages.
  Arkadios.Application/     use cases (MediatR), FluentValidation, interfaces, DTOs
  Arkadios.Infrastructure/  EF Core (MotherDbContext, TenantDbContext), cache, jobs, email, storage
  Arkadios.Api/             controllers, auth, middleware, OpenAPI
tests/
  Arkadios.Application.Tests/
  Arkadios.Api.IntegrationTests/
```

- Dependency direction: Domain <- Application <- Infrastructure <- Api.
- Application never references EF Core types. It depends on interfaces
  (`ICacheService`, `ITenantContext`, `IEmailSender`, repositories or DbContext abstractions).
- Controllers stay thin: map request to MediatR command or query, return DTO.
- Four `src` projects only for the pilot. Add a separate worker host after the pilot.
- Runtime: .NET 10 LTS (do not use .NET 8, its support ends Nov 2026).
- Database: **SQL Server** (decided), code-first migrations. Azure SQL in cloud, SQL Server 2022 container locally.
  Prefer plain EF Core. SQL Server features (full-text search, sequential GUIDs, temporal tables) are allowed
  when they earn their place, but keep them inside Infrastructure so Application and Domain stay provider-neutral.

## 3. Multi-tenancy (critical)

- **Mother DB** holds platform data: tenants, plans, billing, platform users, job state.
- **One database per tenant** holds that tenant's business data.
- Tenant tables have **no `TenantId` column**. The database is the tenant.
  Mother DB tables do use `TenantId`.
- Tenant identity comes **only** from the JWT claim, resolved by middleware into a scoped
  `ITenantContext`. Never from request body, route or query string.
- `ITenantContext` looks up the tenant connection string in the mother DB (cached, tenant-scoped key).
  `TenantDbContext` is built per request with that connection string.
- Each tenant DB has a `TenantIdentity` row. On connection, its tenant id must match the token's
  tenant id, otherwise refuse the request (safety net against a wrong connection string).
- Migrations: one migration set. A migration runner loops over all active tenant DBs and applies it.
  Schema version is stored per tenant in `TenantDatabases` (mother DB). Build the runner in week 1.
- **Provisioning** a tenant: create DB, run migrations, seed roles and first admin, record in mother DB.
- Cross-tenant platform statistics cannot be one query. Keep small counters in the mother DB or collect via job.
- If a cheap shared-DB tier is ever needed, add `TenantId` plus a global query filter then, not now.

## 4. Two APIs, two audiences

| | Platform API | Tenant API |
|---|---|---|
| Route prefix | `/api/platform/v1` | `/api/v1` |
| Users | `PlatformUsers` (mother DB) | `Users` (tenant DB) |
| JWT audience | `arkadios-platform` | `arkadios-tenant` |
| Used by | `apps/console` | `apps/workspace` |

A tenant token must never open the platform API, and the reverse.
"Sign in as tenant user" (support access) issues a tenant token with an `act_as` claim,
a reason, a short expiry, and an audit entry in both mother and tenant DBs.

## 5. Security

**Auth**
- Password hashing: Argon2 (or ASP.NET Identity hasher).
- Access token: JWT, 10 to 15 minutes. Refresh token: rotated on every use, stored hashed,
  delivered as an `httpOnly`, `Secure`, `SameSite` cookie. Reuse of an old refresh token kills the session.
- Browser keeps the access token in memory only. No localStorage or sessionStorage for tokens.
- Page reload restores the session through `POST /auth/refresh`.
- **MFA required for all platform users**, including read-only roles (the demo's Auditor without MFA is demo-only).
- Login errors are generic. Do not reveal whether an account exists or is disabled.

**Every request, in order**
1. HTTPS only, HSTS, TLS 1.2+.
2. Rate limit per IP and per user (strict on login and password reset).
3. Validate JWT: signature, expiry, issuer, audience.
4. Resolve tenant from claim.
5. Permission policy on each endpoint (for example `firms.read`). Authorize by permission key, not role name.
6. Object-level check in the handler: may this user see this record (scope: all, team, own)? This blocks BOLA.
7. FluentValidation on input. Reject unknown fields. Size limits.
8. Audit entry for writes and security events.

**Every response**
- Return DTOs, never entities. Hide fields the user may not see.
- Errors as `ProblemDetails`. No stack traces to clients.
- `Cache-Control: no-store` on sensitive responses. Cap page size.

**Browser and infra**
- CORS: allow only the known UI origins, never `*`.
- CSRF protection on the cookie-based refresh endpoint (SameSite plus custom header or token).
- UI and API must share one site (same parent domain, or a proxy) so the refresh cookie works.
- Secrets and connection strings in Key Vault, never in the repo. Mother DB stores tenant connection strings encrypted.
- Uploads: check type and size, virus scan, private blob storage, short-lived signed URLs.
- Signature and public links: one-time tokens, expiry, rate limited.
- Webhooks: HMAC signature plus replay window.

## 6. Permissions

- `Permissions` catalog (keys such as `tenants.view`, `tenants.manage`). `manage` implies `view`.
- `RolePermissions(RoleId, PermissionKey)` plus `RoleAreaScopes(RoleId, Area, Scope)` in tenant DB.
- Platform equivalent: `PlatformRolePermissions` in mother DB.
- `GET /permissions` returns keys per role. Clients never hard-code the matrix.
- The server is the only authority. UI checks only hide things.

## 7. Caching

- `ICacheService` interface in Application, implementation in Infrastructure.
- Start with `IMemoryCache` plus HTTP caching (ETag, 304). Add Redis (`HybridCache` or `IDistributedCache`)
  when running more than one API instance.
- **Every key includes tenant id**, built by one `TenantCache` helper using `ITenantContext`. Never typed by hand.
  Pattern: `v1:t:{tenantId}:{entity}:{id}`. User-scoped data also includes user id or role.
- Cache: tenant config and connection lookup, role-to-permission map (short TTL, evict on change),
  lookup lists, dashboard card results (30 to 60 s).
- Do not cache: tokens, audit log, approvals, signature status, records users edit often.
- Invalidate by evicting in command handlers (MediatR pipeline behavior) plus TTL as safety net.
- Index first, cache second.

## 8. Background jobs

- Hangfire with SQL storage in the **mother DB**. Jobs are handlers in Application; Hangfire is only the trigger.
- **Multi-tenant fan-out:** a master recurring job reads active tenants and enqueues one child job per tenant.
  A child job receives only `tenantId`, sets `ITenantContext`, opens that tenant DB. One slow tenant must not block others.
  Add per-tenant locks and start-time jitter.
- **Task expiry** is one recurring sweep per tenant (about every 5 minutes), not one timer per task.
  Overdue state is also computed on read, so the UI is right even if the job is late.
  The job does side effects only: flag, notify, escalate, audit. It must be idempotent.
- Other jobs: recurring tasks, SLA breach check, approval timeout, notification fan-out, import processing,
  signature expiry and reminders, integration sync, document scan, nightly snapshots.
- Reliability: outbox pattern for email and webhooks, retry with backoff then dead-letter plus alert,
  cancellation tokens, priority queues (`critical`, `default`, `bulk`).
- All times UTC in DB. Convert to the tenant time zone for "due today" and reminder hours.
- Job arguments carry ids only, never user data. Hangfire dashboard only for platform admins with MFA.

## 8b. Logging and audit (three separate things)

| What | Where |
|---|---|
| Audit log (who changed what) | `AuditLog` table in **tenant DB**, written by an EF `SaveChanges` interceptor |
| Application log | Serilog to files, Seq or App Insights. Not in business DBs |
| Job run log | Hangfire tables plus `JobRuns` in mother DB |

- Audit columns: `Id`, `OccurredAtUtc`, `UserId`, `UserDisplayName` (copy), `Action`, `EntityType`, `EntityId`,
  `Changes` (JSON of changed fields), `IpAddress`, `UserAgent`, `CorrelationId`, `Source` (UI, API, Job, Import), `IsSecurity`.
- Append-only: the app DB login has insert and select only. Never log passwords, tokens or document content.
- Index `(EntityType, EntityId, OccurredAtUtc)` and `(UserId, OccurredAtUtc)`.
- One `CorrelationId` per request, passed into jobs, app logs and audit rows.
- Platform actions go to `PlatformAuditLog` in the mother DB.

## 9. Data model

**Conventions (tenant DB)**
- `bigint identity` primary key. Add `PublicId` (GUID) only on records exposed in URLs or links.
- Every table: `CreatedAtUtc`, `CreatedBy`, `UpdatedAtUtc`, `UpdatedBy`, `RowVersion`.
- Soft delete (`IsDeleted`, `DeletedAtUtc`) on business data, not on audit.
- UTC everywhere. Money `decimal(18,2)`. Status as lookup table or small enum.
- Real FK columns (`FirmId`, `PersonId`, nullable) on Tasks, Documents, Tickets.
  Polymorphic `EntityType + EntityId` only for `AuditLog`, `Notes`, `CustomFieldValues`.
- Custom fields: `CustomFieldDefinitions`, `CustomFieldOptions`, and one `CustomFieldValues` table with typed columns
  (`ValueText`, `ValueNumber`, `ValueDate`, `ValueBool`, `ValueOptionId`), indexed by `(FieldId, Value*)`.
- Dashboard card config is the only place JSON columns are fine.

**Mother DB**
- Tenants: `Tenants`, `TenantDomains`, `TenantDatabases`
- Plans: `Plans`, `Modules`, `PlanModules`, `TenantModules`
- Money: `Subscriptions`, `Invoices`, `InvoiceLines`, `Payments`, `Refunds`
- SMS: `SmsWallets`, `SmsLedger`
- Staff: `PlatformUsers`, `PlatformRoles`, `PlatformRolePermissions`
- Support: `SupportAccessGrants`
- System: `PlatformAuditLog`, `JobRuns`, `TenantMigrations`, Hangfire schema

**Tenant DB**
- Access: `Users`, `Roles`, `Permissions`, `RolePermissions`, `RoleAreaScopes`, `UserRoles`, `Teams`, `TeamMembers`, `RefreshTokens`, `LoginHistory`
- Directory: `Firms`, `People`, `FirmPeople`, `RepCodes`, `Licenses`, `LicenseTypes`, `Addresses`, `Departments`, `Regions`
- Lifecycle: `LifecycleStages`, `StageChecklistItems`, `FirmStageHistory`, `Workstreams`, `FirmWorkstreams`
- Tasks: `Tasks` (with `StageId`, `SourceChecklistItemId`), `TaskCategories`, `TaskTypes`, `TaskComments`, `TaskDependencies`, `RecurringRules`, `HolidayCalendar`
- Approvals: `ApprovalRules`, `ApprovalRequests`, `ApprovalSteps`
- Tickets: `Tickets`, `TicketMessages`, `SlaPolicies`
- Documents: `Documents`, `DocumentVersions`, `DocumentLinks`, `SignatureRequests`, `SignatureSigners`
- Comms: `Communications`, `Notes`, `MessageTemplates`, `Notifications`, `NotificationPreferences`
- Custom fields and dashboards: `CustomField*`, `Dashboards`, `DashboardCards`, `SavedReports`, `SavedViews`
- Settings: `TenantSettings`, `Terminology`, `MenuConfig`, `Integrations`, `IntegrationSyncLog`
- System: `AuditLog`, `OutboxMessages`, `ImportJobs`, `ImportRows`, `JobLocks`, `TenantIdentity`

**Key indexes:** `Firms(StageId, OwnerId)`, `Tasks(AssigneeId, Status, DueAtUtc)`,
`AuditLog(EntityType, EntityId, OccurredAtUtc)`, search indexes on firm name, person name, rep code, license number.

## 10. API contract between the repos

- The API publishes an OpenAPI document (versioned routes, `/api/v1` and `/api/platform/v1`).
- `arkadios-web` generates `packages/api-client` from it. No hand-written API types once it exists.
- Until the backend exists, the UI uses MSW mocks that follow the same shapes.
- Breaking changes need a new version prefix or a coordinated change in both repos.
- Lists use server-side filter, sort and paging. Errors are `ProblemDetails`.

**Wire conventions (the UI mocks follow these; the backend mirrors them in OpenAPI)**
- Platform API base: `/api/platform/v1`. Tenant API base: `/api/v1`.
- List response: `{ items, total, page, pageSize }`. Query params: `q`, `status`, `sort`, `page`, `pageSize`.
- Errors: `application/problem+json` with `type`, `title`, `status`, `detail`, `traceId`, and `errors` (field to messages) for validation.
  Login failures (bad password, unknown email, disabled or invited account) return the same generic problem.
- Session response includes `expiresIn` (seconds). The client refreshes shortly before expiry.
- Refresh and logout require the custom header `X-Requested-With: arkadios-web` (403 without it), on top of `SameSite` cookies.
  The backend may upgrade this to a double-submit token later; the UI change would be one header.
- A reused or invalid refresh token ends the session and the client returns to login.
- Money: `{ amountMinor, currency }`. `amountMinor` is an integer in the currency's minor unit (cents for USD) and `currency` is
  an ISO 4217 code. A float never appears in a money field, in a request or a response. The server does all money arithmetic
  (a tax is rounded half up to a whole minor unit); the client only formats for display, using the currency's own number of
  decimal places. Amounts in different currencies are never added together.
- Dates and times: ISO 8601 UTC date-times such as `2026-10-21T09:00:00.000Z`. The client shows them in the viewer's local time.
  A calendar month is `YYYY-MM`.

**Tenants list (platform API; other lists follow the same shape)**
- `GET /tenants?q=&status=&sort=&page=&pageSize=`. Needs `tenants.view`: `401` without a valid token, `403` without the key.
  Responses carry `Cache-Control: no-store`.
- Response: `{ items, total, page, pageSize }`. `total` is the count after filtering, before paging.
- Item: `{ id, name, domain, database, planId, planName, usersUsed, userLimit, status, createdAt }`.
  `id` is an opaque GUID, never a sequence number. `status` is `active`, `trial`, `suspended` or `offboarding`.
  `createdAt` is ISO 8601 UTC. `database` is the database name only.
- `q`: optional text, trimmed, at most 100 characters, matched case-insensitively as "contains" against name, domain and database.
  `%` and `_` in `q` are plain characters, not wildcards.
- `status`: optional, one of the four values above. Omit it for all statuses; `all` is not a value.
- `sort`: one key from the whitelist `name`, `plan`, `usersUsed`, `status`, `createdAt`; a leading `-` means descending. Default `name`.
  `plan` sorts by `planName`. Ties always fall back to `name` ascending, then `id` ascending, whatever the direction, so pages never repeat or skip rows.
- Paging: `page` is a whole number from 1 (default 1); `pageSize` is a whole number from 1 to 100 (default 25).
  A page past the end returns `200` with empty `items` and the real `total`.
- Invalid parameters return `400` `application/problem+json` with `errors` keyed by parameter:
  `q`, `status`, `sort`, `page`, `pageSize`. Every bad parameter is reported in one response. Unknown parameters are ignored.
- Backend notes:
  - `sort` accepts only whitelisted keys, each mapped to a column in code. A request value is never placed in an `ORDER BY` string.
  - `q` always goes in as a query parameter, never concatenated into SQL, and `%`, `_` and the escape character are escaped before the `LIKE`.
  - Responses are DTOs. They never include connection strings or any secret, only the database name.

**Create tenant (platform API)**
- `GET /tenants/options` returns `{ plans, regions, baseDomain }` for the create form, in one request.
  `plans` is `[{ id, name, blurb, trialDays }]`, `regions` is `[{ id, name }]`, and a tenant lives at `<domain>.<baseDomain>`.
  Needs `tenants.manage`. The UI hard-codes none of these values.
- `POST /tenants` with `{ name, domain, planId, userLimit, region, adminEmail }`. Needs `tenants.manage` (`403` without it).
  - `name`: required, trimmed, at most 100 characters.
  - `domain`: 3 to 30 characters, lowercase letters, numbers and hyphens, starting with a letter or number. It also names the database
    (`tenant_<domain with - as _>`).
  - `planId` and `region` must be ids from `/tenants/options`. `userLimit` is a whole number from 1 to 1000.
  - `adminEmail` is a valid email address, trimmed.
  - Unknown fields are refused. Invalid input returns `400` with `errors` keyed by field name, every bad field in one response.
  - A domain that is already in use, or reserved by a tenant still being provisioned, returns `409` with `errors.domain`.
    The `400` checks run before the `409` check.
  - Success is `202 Accepted` with `{ id }` and a `Location` header pointing at the provisioning resource. `id` is the new tenant's
    opaque GUID. The tenant is not in the tenants list yet.
- `GET /tenants/{id}/provisioning` returns `{ id, status, steps, result? }`. Needs `tenants.manage`; `404` for an unknown id;
  `Cache-Control: no-store`. The client polls it while `status` is `running`.
  - `status` is `running`, `succeeded` or `failed`. `steps` is an ordered list of `{ key, label, state }`, with `state` one of
    `waiting`, `running`, `done` or `failed`.
  - The steps, in order: `database`, `migrations`, `seed`, `domain`, `invite`. `label` is display text from the server, for example
    "Creating the database tenant_acme".
  - `result` is only present when `status` is `succeeded`: `{ name, domain, adminEmail, trialDays }`, where `domain` is the full host.
- When provisioning succeeds the tenant appears in `GET /tenants` with status `trial` and one user. The first admin gets the
  "set your password" invitation described under Password reset.
- Backend notes: provisioning runs as a background job (see section 3, Provisioning); the first `POST` reserves the domain; connection
  strings never appear in any of these responses.

**Plans and modules (platform API)**
- `GET /plans` returns `{ modules, plans }`. Needs `plans.view`. It is a small fixed set, so it has no list envelope and no paging.
  `Cache-Control: no-store`.
  - `modules` is the catalog, `[{ id, name, note, comingLater }]`. A module with `comingLater: true` cannot be switched on yet.
  - A plan is `{ id, name, blurb, tenantCount, trialDays, modules, version }`. `modules` has every catalog id as `true` or `false`.
    `tenantCount` counts every tenant on the plan, whatever its status. `trialDays` is the days before the first bill.
- `PUT /plans/{id}` with `{ modules, trialDays, version }`. Needs `plans.manage` (`403` without it, `404` for an unknown id).
  It replaces the plan's modules and trial length and returns the updated plan, with `version` one higher.
  - `modules` must name every catalog id as `true` or `false`; no other keys. A "coming later" module may only be `false`.
  - `trialDays` is a whole number from 0 to 90. `version` is the number from the `GET` the edit started from.
  - Unknown fields are refused. Invalid input returns `400` with `errors` keyed `modules` (not an object), `modules.<id>`
    (unknown, missing, not a boolean, or "coming later" switched on), `trialDays` and `version`, every bad field in one response.
  - A stale `version` returns `409` with `errors.version` ("This plan was changed by someone else. Reload to see the latest.")
    and applies nothing. The `400` checks run before the `409` check. The client reloads the plan and the person starts again.
- The server does not ask for confirmation. The console asks before it saves a change that switches a module off on a plan whose
  `tenantCount` is above 0, and names the modules and the tenant count. Switching a module on needs no confirmation.
- Backend notes:
  - Turning a module off hides it and makes it read-only for the tenants on that plan. It never deletes tenant data, and switching
    the module back on restores access to what was there.
  - A plan or module change evicts the cached tenant config for every tenant on the plan (see section 7, Caching), so tenants see
    the change on their next request.
  - Each change writes a `PlatformAuditLog` entry: who, which plan, and what changed (modules switched on or off, trial length).
  - Only `plans.manage` can write. Reads and writes never touch tenant databases.

**Billing (platform API)**
- A bill is `{ id, tenantId, tenantName, month, planId, planName, billedUsers, unitPrice, subtotal, tax, taxRateBps, payable, deadline, status }`.
  `id` is an opaque GUID and `month` is `YYYY-MM`. `unitPrice`, `subtotal`, `tax` and `payable` are Money. `taxRateBps` is an integer
  in basis points (700 is 7%). The server computes `subtotal` (billed users times unit price), `tax` (subtotal times the rate, rounded
  half up) and `payable` (subtotal plus tax); the client never does money arithmetic. `deadline` is an ISO 8601 UTC date-time.
  `status` is `pending`, `paid` or `overdue`, derived by the server: paid wins, otherwise a deadline in the past means overdue.
- `GET /bills?q=&status=&month=&sort=&page=&pageSize=` returns the list envelope. Needs `billing.view`. `Cache-Control: no-store`.
  - `q`: optional text, trimmed, at most 100 characters, matched case-insensitively as "contains" against the tenant name.
    `%` and `_` are plain characters.
  - `status`: optional, `pending`, `paid` or `overdue`. `month`: optional, `YYYY-MM`.
  - `sort`: one key from the whitelist `status`, `tenant`, `month`, `payable`, `deadline`; a leading `-` means descending. Default
    `status`, which orders overdue, then pending, then paid. Ties fall back to tenant name, then month, then `id`, ascending,
    whatever the direction.
  - Paging is the same as the tenants list: `page` from 1, `pageSize` 1 to 100 (default 25), and a page past the end returns empty
    `items` with the real `total`.
  - Invalid parameters return `400` with `errors` keyed `q`, `status`, `month`, `sort`, `page` and `pageSize`, every bad one at once.
- `GET /bills/summary?q=&month=` returns `{ totals }`. Needs `billing.view`. `totals` has one entry per currency:
  `{ currency, billable, collected, notYetPaid, overdue }`, where every amount is an integer in that currency's minor unit.
  It covers the bills that match `q` and `month`. `status` is not a filter here, because the four totals already split by status.
  With nothing in scope `totals` is `[]`. A bad `q` or `month` returns `400`.
- `GET /bills/{id}/notice` returns `{ message, amountDue, paymentMethods }`: the notice the tenant sees at the top of its workspace.
  Needs `billing.view`. `message` is plain text written by the server, so the console previews exactly what the tenant gets; the
  console renders it as text, never as HTML. `amountDue` is Money and `paymentMethods` is a list such as `["stripe", "paypal"]`.
  `409` for a paid bill, `404` for an unknown id.
- `GET /bills/{id}/invoice` returns the invoice as a file download. Needs `billing.view`. Only a paid bill has an invoice (`409`
  otherwise, `404` for an unknown id). The file name comes from `Content-Disposition`, and the response is
  `Cache-Control: private, no-store`. The media type may change (the mock returns the demo's sample HTML; the backend is expected to
  return a PDF), so the client uses the `Content-Type` and file name the server sends.
- `POST /bills/{id}/extend` with `{ days }`, where `days` is 7, 14 or 30. Needs `billing.manage`. The new deadline is the later of
  now and the current deadline, plus `days`. An overdue bill is pending again. It returns the updated bill.
  - `400` with `errors.days` for any other number, and for unknown fields. `409` for a paid bill. `404` for an unknown id.
  - The request is not idempotent: every call extends again. The backend may add an `Idempotency-Key` header later; the UI change
    would be one header. The console disables the button while the request runs.
- Backend notes:
  - Each extension writes a `PlatformAuditLog` entry that records who made it, the old deadline and the new deadline.
  - A cap on the total extension per bill is a business rule to confirm with the client (60 days is the suggestion). It would be
    refused with `409`. The mock does not enforce a cap.
  - CORS must expose `Content-Disposition` (`Access-Control-Expose-Headers`), or a cross-origin console cannot read the invoice file name.
  - The invoice file name is built by the server from the bill id and the month (for example `invoice-2026-09-<bill id>`), never
    from user input or tenant names.
  - Payments through Stripe or PayPal and bank transfers belong to the Transactions contract, not to this one.

**Access control (platform API)**
- Assumption: one role per person. A staff member has exactly one role, and a role is a set of permission keys. Several roles per
  person would change `role` into a list and the escalation check into a union; that is a coordinated change in both repos.
- Permissions travel as keys on the wire, `<area>.view` and `<area>.manage`, and `manage` implies `view`. The server stores and returns the
  highest key per area (`billing.manage`, never both), in the catalog order tenants, plans, billing, transactions, sms, support, access.
  A request that sends both is accepted and stored as the highest.
- `GET /staff` returns `{ items }`. Needs `access.view`. `Cache-Control: no-store`. It is a small set, so it has no list envelope and no
  paging, like Plans; items are ordered by `name` ascending, then `id`. Item:
  `{ id, name, email, role, status, mfaEnrolled, lastActiveAt, version }`. `id` is an opaque GUID, `status` is `active`, `invited` or
  `deactivated`, `lastActiveAt` is ISO 8601 UTC or `null`, and `version` is the number a write must send back. A removed person is not
  listed. There is no password field and no MFA setting anywhere in this contract.
- `GET /roles` returns `{ items }`, one per role. Needs `access.view`. Item: `{ id, name, locked, permissions, staffCount, version }`.
  `permissions` is the list of keys. `locked` is `true` for Super admin, which cannot be edited. `staffCount` counts the people in the role
  who are not deactivated (invited people count). `GET /permissions` is unchanged (keys per role, for any signed-in person) and reads the same data.
- `POST /staff` with `{ name, email, role }` invites a person. Needs `access.manage`. It returns `201` with the new item (`status`
  `invited`, `mfaEnrolled` `false`) and a `Location` header.
  - `name`: required, trimmed, at most 100 characters. `email`: a valid address, trimmed, at most 254 characters. `role` is a role id.
  - **No password is ever sent, shown or set here.** The person gets a set-password link by email, through the same flow as Password reset
    ("An invited account uses the same flow as set your password"). Choosing a password accepts the invitation: the account becomes `active`
    and the first sign-in enrols MFA. Unknown fields, `password` and any MFA field among them, are refused with `400`.
  - `400` with `errors` keyed by field, every bad field in one response. Then `409` `access/escalation` (see Safety rules), then `409`
    with `errors.email` ("This person already has access.") when the email is already in use, ignoring case. An email of a removed
    person is free to invite again; it creates a new account with a new `id`.
- `POST /staff/{id}/resend-invite` returns `204` and sends a new link; earlier links stop working. Needs `access.manage`. `409` unless the
  person is `invited`, `404` for an unknown id.
- `PATCH /staff/{id}` with `{ role?, status?, version }`. Needs `access.manage`. `status` is `active` or `deactivated`; `invited` is never
  set by a client. At least one of `role` and `status` is required. It returns the updated item with `version` one higher.
  - `400` with `errors` keyed `role`, `status`, `version` or an unknown field name, every bad field at once. `404` for an unknown id.
  - A stale `version` returns `409` with `errors.version` ("This person was changed by someone else. Reload to see the latest.") and
    applies nothing. The `400` checks run before the `409` check, and the stale check runs before the safety rules.
  - `409` for a status that does not fit: only an `active` person can be deactivated, only a `deactivated` person activated.
  - Sending the role the person already has changes nothing: `200`, no new version, no audit entry.
- `DELETE /staff/{id}?version=` returns `204`. Needs `access.manage`. `version` is required (`400` without it, `409` when stale).
  A removed person cannot sign in, has no sessions, and is not listed.
- `PUT /roles/{role}/permissions` with `{ permissions, version }`. Needs `access.manage`. It replaces the role's keys and returns the role
  with `version` one higher. `404` for an unknown role. `409` `access/role-locked` for the Super admin role.
  - `400` with `errors.permissions` (not a list), `errors.permissions.<key>` (unknown key), `errors.version` and unknown field names.
    A stale `version` is `409` with `errors.version`, same wording pattern as above, and applies nothing.
- Safety rules. These are `409` problems (`application/problem+json`) whose `type` ends in the slug below and whose `detail` is a
  sentence the console shows as is. They are server rules, and the console only hides the controls it can predict.
  | `type` slug | When |
  |---|---|
  | `access/self-lockout` | A person changes their own role to one without `access.manage`, or disables or removes themselves, or edits their own role so that it loses `access.manage`. |
  | `access/last-admin` | The change would leave no **active** person with `access.manage`: demoting, disabling or removing the last one, or removing the key from a role when no active person would be left. An invited or deactivated person does not count. |
  | `access/last-manager-role` | The change would leave no role that holds `access.manage`. |
  | `access/outranked` | The target of the change holds a permission the person making it lacks. For a person (role change, disable, reactivate, remove) the target is their current role; for `PUT /roles/{role}/permissions` it is the role being edited, as it is before the edit. A manager can only change people and roles that are within their own, so only a Super admin can touch a Super admin (the Super admin role itself is locked for everyone: `access/role-locked`). `manage` covers `view`. The console hides those controls and shows such a role's column read only. |
  | `access/escalation` | The person making the change does not hold every key they would hand out: the keys of a role they assign (invite, change a role, reactivate), or a key they add to a role. `manage` covers `view`. |
  | `access/role-locked` | Editing the Super admin role. |
  - Order of checks: `403`, `404`, `400`, stale `version`, outranked (a person or a role), self lockout, escalation, last admin, last manager role.
  - Outranked is about who or what is being changed, escalation is about what is being handed out. For a role it means a Support lead
    with `access.manage` cannot edit the Billing manager role (it holds `billing.manage`, which they lack), and can edit the Support lead role but
    not grant it a key they lack (escalation). It checks the role's permissions before the edit, so lowering them does not get round it.
    For a person: a Support lead with `access.manage` can
    invite or move a colleague within the Support lead role, but not a Billing manager (outranked) and not into Super admin (escalation).
    It looks at the target's current role, whatever their status. Resending an invitation is not a change to the person and is not checked.
  - Backend: the `access/last-admin` and `access/last-manager-role` checks must run **inside the same database transaction as the
    write**, with the rows they read locked (a row lock) or under `SERIALIZABLE` isolation (SQL Server: `UPDLOCK, HOLDLOCK` on the
    rows that hold `access.manage`, or `SERIALIZABLE` for the whole unit of work). The transaction reads who is left holding
    `access.manage` after the change, refuses with `409` if that is nobody, writes the change and the audit entry, and commits.
    Two admins demoting each other at the same moment then run one after the other: the second sees the first's result and gets
    the `409`, instead of both reading "there is another admin" and both succeeding. A check made before the transaction, in the
    handler or against the permission cache, is not enough, and neither is the optimistic `version`, which is per row and does not
    see the other row. The same goes for editing a role's permissions. An integration test should fire the two demotions
    together and expect exactly one success and one `409`.
- Backend notes:
  - **Takes effect at once.** A role change, a disable and a removal revoke that person's refresh tokens, bump their security stamp, and
    evict their cached permission map. An access token carrying the old stamp is refused on its next request (`401`), so the console
    returns to sign-in. A change to what a role can do evicts the cached permission map for that role instead; nobody is signed out and
    the new keys apply on the next request.
  - **Permissions are not stored in the JWT.** The token holds the user id, the role and the security stamp. The server resolves
    permissions from the cached map (section 7), which is evicted on every change in this section.
  - **Audit.** Every successful change writes a `PlatformAuditLog` entry: who (actor id, plus a copy of the display name), the action,
    the entity, and `changes` as a list of `{ field, old, new }`. Actions: `staff.invited`, `staff.invite-resent`, `staff.activated`,
    `staff.role-changed`, `staff.deactivated`, `staff.reactivated`, `staff.removed`, `role.permissions-changed`. A refused change writes
    nothing. These are security events (`IsSecurity`). Passwords, tokens and reset links are never logged.
  - **Remove is a soft delete.** The row stays, hidden from every list and from sign-in. Audit rows keep a copy of the person's name, so
    history still reads after the person is gone.
  - **MFA stays required for every platform user.** There is no setting, switch or endpoint for it. `mfaEnrolled` is read only and says
    whether the person has set it up. A request that sends an MFA field is an unknown field.
  - **Inactivity sign-out** is a server value (`idleMinutes` in the session response). It is shown read only and nothing here changes
    or disables it.
  - **Rate limits.** Invite and resend are rate limited per actor and per target email (`429` with `Retry-After`). The email is sent
    by the job outbox, not inline, and the response never says whether it was delivered.
  - The invitation link has a longer expiry than a reset link; the backend decides how long.
- The console offers a role in a role select only if the signed-in role holds every permission that role holds (the roles a person may
  hand out, their own included), and shows people they outrank no role select or Deactivate, Reactivate and Remove buttons. This is
  cosmetic: the server decides, and answers `access/escalation` or `access/outranked` if a request gets through anyway.
- The console asks before it does any of these, naming the person (or the role and how many people it affects) and what changes:
  demoting or moving someone to a role with fewer permissions, disabling, removing, inviting or assigning a role that holds
  `access.manage`, saving a role edit that removes permissions, and granting `access.manage` to a role. The server does not ask. Cancel
  is focused first in every dialog.

**Password reset (platform API; the tenant API follows the same shape)**
- `POST /auth/forgot-password` with `{ email }`. Always `204` for any well-formed email, whether or not the account exists
  (no account enumeration). Strict rate limit per IP and per email; `429` with `Retry-After`. The email is sent by a job (outbox), not inline.
- Reset link: `https://<console-host>/reset-password#token=<token>`. The token sits in the URL fragment, not the query string,
  so it is never sent to servers, logs or referrers. The page reads it, removes it from the address bar with `history.replaceState`,
  and keeps it in memory only. The page sends `Referrer-Policy: no-referrer`.
- `POST /auth/reset-password` with `{ token, newPassword }`. `204` on success. Invalid, expired or already-used token returns one generic
  `400` problem ("This reset link is invalid or has expired."). Weak password returns `400` with `errors.newPassword`.
- Token: random, single-use, stored hashed, expires in 30 minutes, and a new request invalidates earlier tokens.
- On success: revoke all refresh tokens for that user, write a security audit entry, send a "your password was changed" email.
  Do not sign the user in. They sign in again and still pass MFA.
- Password rule: minimum 12 characters, not in a known-breached list, not equal to the email. No composition rules.
- An invited (not yet active) account uses the same flow as "set your password", with a longer expiry decided in the backend.

## 11. Frontend (arkadios-web)

- pnpm workspace: `apps/console` first, `apps/workspace` later, shared packages extracted only when the second app starts.
- React 19, TypeScript strict, React Router, TanStack Query and Table, React Hook Form with Zod, Tailwind v4 with shadcn/ui, MSW, Vitest, Playwright.
- Feature folders: `src/features/<name>/{api,components,pages,hooks}`.
- Permissions through `usePermission()` and `<Can>` only. Clear the query cache on logout.
- Step 1 (skeleton, theme, layout, guards, MSW) is done and on `main`. Later work uses short feature branches.

## 12. Build order

**Backend**
1. Skeleton: base entity, audit columns, ProblemDetails, Serilog with correlation id, health check, architecture tests.
2. Mother DB: `Tenants`, `TenantDatabases`, `PlatformUsers`, first migration.
3. Tenant plumbing: `ITenantContext`, middleware, per-request `TenantDbContext`, migration runner, tenant provisioning.
4. Auth: login, MFA, JWT, refresh rotation, roles, permission policies, scope checks (platform first, to serve the console).
5. Console endpoints: tenants, plans and modules, billing, transactions, SMS, support access, access control.
6. Tenant API: directory (firms, people, custom fields), then lifecycle and tasks.
7. Audit interceptor, cache, Hangfire and the task sweep.
8. Remaining modules in UI page order.

**Frontend** (parallel): console steps follow the same order, using MSW until each endpoint exists.

**Tests required early**
- Tenant isolation: two tenants, tenant A's token can never read tenant B's data. Runs in CI forever.
- Architecture tests (NetArchTest): Domain references nothing; Application references only Domain; Api never touches DbContext directly.
- Permission tests: every endpoint rejects a user without the permission.
- outranked checks apply to people and to roles

## 13. Open decisions

1. ~~Database engine~~ Decided: SQL Server.
2. Hosting: Azure App Service plus Azure SQL elastic pool is the assumed target. Confirm with the client.
3. Domains and cookie site: for example `console.<domain>` and `api.<domain>`, or a UI proxy.
4. Shared-DB tier for small tenants: not planned. Revisit only if a cheap plan is sold.
5. Redis: not in the pilot. Add with the second API instance.
