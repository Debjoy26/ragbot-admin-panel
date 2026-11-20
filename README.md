# RAGbot Admin Panel

Documentation-first specification for the client and provider administration
interfaces that manage deployments of `ragbot-widget`.

This repository is the admin-panel frontend. It does not own the tenant
database schema, visitor API, ingestion worker, or provider credentials.

## Status

A0 is complete. See the accepted [repository boundary](docs/decisions/0001-admin-panel-boundary.md)
and [frontend baseline](docs/decisions/0002-a0-product-and-integration-baseline.md).
A2 is complete. The client uses tenant sign-in, TOTP MFA, and membership
checks. A3 covers live admin features. See [status.md](status.md) and
[plan.md](plan.md) for phase status.

## Local development

Use Node `26.13.1` and npm `11.20.0`.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/app/`. For sign-in, create
`public/tenant-config.json` from [tenant-config.example.json](tenant-config.example.json)
using the intended test tenant’s project URL and publishable key. Add the
exact `/app/` URL to the tenant's Auth redirect allowlist. The tenant must
allow email sign-in links, have public signup disabled and TOTP enabled, and
have an invited user with active membership. The checked-in example contains
placeholders. The app shows a configuration error until valid settings are
available.

For a static deployment, serve that tenant’s configuration at
`/app/tenant-config.json`. The workspace still displays bundled sample data
once access is verified. Sessions are stored in memory, so a full reload
requires signing in again.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install --only-shell chromium
npm run test:e2e
```

The [CI workflow](.github/workflows/ci.yml) runs these checks on pull requests
targeting `main` and on pushes to `main`. It uses the pinned Node and npm versions
and mocks tenant responses for browser tests.

Browser checks serve the built assets on port 4173. A static host must serve
`dist/` at `/app/` and fall back to the app's `index.html` for client routes
under that prefix. Serve existing assets directly.

## Documents

- [PRD.md](PRD.md): product scope and requirements
- [ARCHITECTURE.md](ARCHITECTURE.md): client/provider boundaries and flows
- [TECH_SPECS.md](TECH_SPECS.md): authorization and backend integration
- [UI_SCHEMA.md](UI_SCHEMA.md): routes, screens, and interaction states
- [plan.md](plan.md): staged implementation plan
- [status.md](status.md): current decisions and progress
- [A0 backend contract review](docs/backend-contract-a0.md): source revision, client RPCs, and integration gaps

## Backend source of truth

The companion [`ragbot-widget`](https://github.com/Debjoy26/ragbot-widget)
repository owns Supabase migrations, RLS, RPCs, Storage policies, shared
contracts, the visitor API, the worker, and the embeddable widget. The panel
must use the published backend contract; it must not create competing
migrations or write protected tables directly.
