# Arkadios UI handoff

Start with `docs/FRONTEND-NOTES.md`. It maps every page, permission, data shape, and business rule you need to rebuild the UI properly.

- `tenant-workspace/login.html`: the client app. Keep the whole folder together.
- `platform-console/login.html`: the staff console. Keep the whole folder together.
- `pdf/`: every screen as a picture, with a contents page.
- `tests/`: browser tests you can run against the demos, and later against the real frontend. See `tests/README.md`.
- `deploy-kit/`: hosting files (Nginx, Docker, Netlify headers).

Live demos: https://arkadios-tenant.netlify.app and https://platform-console.netlify.app/login.html (password `demo-1234`, console code `123456`).
