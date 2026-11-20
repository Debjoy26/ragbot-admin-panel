# RAGbot Admin Panel

Documentation-first specification for the client and provider administration
interfaces that manage deployments of `ragbot-widget`.

This repository is the admin-panel frontend. It does not own the tenant
database schema, visitor API, ingestion worker, or provider credentials.

## Status

A0 is complete. See the accepted [repository boundary](docs/decisions/0001-admin-panel-boundary.md)
and [frontend baseline](docs/decisions/0002-a0-product-and-integration-baseline.md).
A1 is complete. The client scaffold is available locally, and A2 covers tenant
sign-in and MFA. See [status.md](status.md) and [plan.md](plan.md).

## Local development

Use Node `26.13.1` and npm `11.20.0`.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/app/`. The client shell uses bundled sample data
and requires no tenant configuration.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install --only-shell chromium
npm run test:e2e
```

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
