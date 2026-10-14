# Arkadios web: platform console (apps/console)

Read docs/ARCHITECTURE.md first. It is the source of truth for design and wire conventions.

Current scope: apps/console only.

## Stack
React + TypeScript (strict) + Vite, React Router v7, TanStack Query/Table,
React Hook Form + Zod, Tailwind v4 + shadcn/ui, MSW, Vitest, Playwright.
Package manager: pnpm only. Never npm or npx in this repo.

## Source of truth
docs/handoff/ holds the approved HTML demos. Match layout, copy,
roles, menus and states. Do not redesign.
Console demo: docs/handoff/platform-console/
Notes and rules: docs/handoff/docs/
Existing checks to port: docs/handoff/tests/

## Rules
- Feature folders: src/features/<name>/{api,components,pages,hooks}.
- API types come ONLY from the generated client in packages/api-client.
  No hand-written API types once that client exists.
- Access token and session live in memory only. Never localStorage or
  sessionStorage. Refresh token is an httpOnly cookie, JS never touches
  it. Page reload restores the session through POST /api/auth/refresh.
- Permissions: usePermission() and <Can>. Menu and buttons come from
  permission keys. UI checks are cosmetic; the server is the authority.
  The role matrix comes from the API (GET /api/permissions), never
  hard-coded in the app.
- Redirect targets (`next`) must be relative paths only.
- Clear TanStack Query cache on logout.
- No dangerouslySetInnerHTML. Forms use Zod schemas.
- Every list: loading, empty, error state. Every mutation: invalidate
  its feature query key.
- Double submit: every submit that must not run twice (save, create, extend,
  invite, remove) goes through useSubmitGuard (src/lib). The guard is set in the
  click or submit handler itself, not only by a disabled state after render.
  Each one needs a same-instant double-click test (both clicks inside one act()).
- Dialogs: Cancel is focused first. The confirm button uses useSubmitGuard.
- API calls go through MSW handlers until real endpoints exist.
- shadcn/ui: never overwrite existing components (no --overwrite; if the CLI
  asks, answer no and use the existing file). After every shadcn run, check
  package.json for a bogus "cn" dependency (remove it and import cn from
  "@/lib/utils"), and check git diff for unexpected changes to existing files
  (restore them with git checkout).
- Small commits, one per plan item.

## Done means
Typecheck, lint, unit tests and the matching Playwright checks pass.
