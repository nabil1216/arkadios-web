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

## 13. Open decisions

1. ~~Database engine~~ Decided: SQL Server.
2. Hosting: Azure App Service plus Azure SQL elastic pool is the assumed target. Confirm with the client.
3. Domains and cookie site: for example `console.<domain>` and `api.<domain>`, or a UI proxy.
4. Shared-DB tier for small tenants: not planned. Revisit only if a cheap plan is sold.
5. Redis: not in the pilot. Add with the second API instance.
