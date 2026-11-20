# Status — RAGbot Admin Panel

## Current checkpoint

A0 is complete. The product owner accepted the repository boundary and
frontend baseline. The [backend contract review](docs/backend-contract-a0.md)
is pinned to `ragbot-widget` commit `ebc75ec` and schema version 27.

A1 is complete. The product owner accepted the scaffold after its local checks
passed. The client shell at `/app/` runs on bundled sample data. A2 covers
client sign-in, MFA, and membership checks.

## Phase tracker

| Phase | State | Notes |
|---|---|---|
| A0 — decisions/backend contract | Complete | Owner accepted ADRs 0001 and 0002 after the backend source review |
| A1 — frontend scaffold | Complete | Owner accepted the client shell and routes after lint, typecheck, unit tests, build, and browser checks passed |
| A2 — client auth/MFA | Not started | Must follow tenant Supabase Auth and `aal2` contract |
| A3 — client admin features | Not started | RPC signatures reviewed in source. Confirm target compatibility before wiring |
| A4 — approved knowledge workflow | Not started | Markdown baseline accepted. Gap linkage and publishing details remain open |
| A5 — widget key lifecycle | Not started | Current widget uses public bot/configuration attributes; dedicated key is not assumed |
| A6 — subscription integration | Not started | Current bot enablement is not a complete subscription lifecycle |
| A7 — provider administration | Not started | Provider identity/API/registry design is open |
| A8 — release/deployment | Not started | Hosting and release gates are not selected |

## Open decisions

1. Choose the hosting account and production domains before release.
2. Provider identity provider, MFA policy, provider roles, and staff recovery.
3. Owner and repository for provider API and provider registry.
4. Provider access to client conversations/documents and required audit/consent.
5. Subscription states, start/end semantics, grace period, limits, and
   authoritative enforcement location.
6. Public widget-key format, hashing, hostname restriction, rotation, and
   revocation behavior.
7. Define how approved Markdown answers link to knowledge gaps and how citations identify them before A4.
8. Define the contract for in-panel member invitations and changes when scheduled.
9. Confirm knowledge-gap retention and any additional privacy requirements for analyst access.
10. Scope later UI localization beyond the initial English UI.
11. Settle deployment commands at release planning.

## Backend contract notes

- `ragbot-widget` owns tenant migrations and direct-Supabase admin security.
- Admin RPC names, arguments, and role rules are recorded in the pinned review.
- Knowledge-gap reporting and generic Markdown ingestion exist in source. A dedicated answer-publishing flow remains open.
- Widget identifier rotation/revocation and subscription lifecycle are not
  assumed implemented.
- No provider control plane is assumed to exist.

## A0 checkpoint

- A read-only clone of `ragbot-widget` provided the source evidence for the contract review. Hosted behavior and configuration were outside this review.
- Owner acceptance is recorded in [ADR 0001](docs/decisions/0001-admin-panel-boundary.md)
  and [ADR 0002](docs/decisions/0002-a0-product-and-integration-baseline.md).

## A1 validation

Ran on Windows with Node `26.13.1` and npm `11.20.0`.

| Command | Result |
|---|---|
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 3 unit tests passed |
| `npm run build` | Passed. Static assets generated in `dist/` |
| `npm run test:e2e` | 3 Chromium tests passed against the production build |

Playwright needed an unrestricted local run on Windows to shut down the preview
server. The checks cover the scaffold and sample data. Tenant authentication and
MFA are A2 work.

## Approval boundary

Hosted Supabase writes, AWS provisioning, paid provider calls, production deployment, and
changes to `ragbot-widget` require their own explicit approvals and gates.
