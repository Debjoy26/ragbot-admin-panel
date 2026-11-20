# RAGbot Admin Panel

Documentation-first specification for the client and provider administration
interfaces that manage deployments of `ragbot-widget`.

This repository is the admin-panel frontend. It does not own the tenant
database schema, visitor API, ingestion worker, or provider credentials.

## Status

The initial product and architecture documents are a proposal, not an
implementation or an acceptance record. See [status.md](status.md) and
[plan.md](plan.md) for open decisions and sequencing.

## Documents

- [PRD.md](PRD.md): product scope and requirements
- [ARCHITECTURE.md](ARCHITECTURE.md): client/provider boundaries and flows
- [TECH_SPECS.md](TECH_SPECS.md): authorization and backend integration
- [UI_SCHEMA.md](UI_SCHEMA.md): routes, screens, and interaction states
- [plan.md](plan.md): staged implementation plan
- [status.md](status.md): current decisions and progress

## Backend source of truth

The companion [`ragbot-widget`](https://github.com/Debjoy26/ragbot-widget)
repository owns Supabase migrations, RLS, RPCs, Storage policies, shared
contracts, the visitor API, the worker, and the embeddable widget. The panel
must use the published backend contract; it must not create competing
migrations or write protected tables directly.
