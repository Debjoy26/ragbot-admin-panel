# Status — RAGbot Admin Panel

## Current checkpoint

A0 is complete. The product owner accepted the repository boundary and
frontend baseline. The [backend contract review](docs/backend-contract-a0.md)
is pinned to `ragbot-widget` commit `ebc75ec` and schema version 27.

A1 is complete. The product owner accepted the scaffold after its local checks
passed. The first [GitHub Actions run](https://github.com/Debjoy26/ragbot-admin-panel/actions/runs/44806533522)
passed for commit `328bbdc`.

A2 is complete. The product owner accepted the sign-in, TOTP MFA, membership
checks, and role guards after local validation passed. The product owner accepted
the live overview, settings, documents, indexing status, conversations, usage,
and members integration after local validation passed.
A4 is complete. The knowledge-gap review and approved-answer workflow are
implemented against the reviewed `knowledge_gaps` report plus the ordinary
Markdown document pipeline, pending owner acceptance of the local validation.

## Phase tracker

| Phase | State | Notes |
|---|---|---|
| A0 — decisions/backend contract | Complete | Owner accepted ADRs 0001 and 0002 after the backend source review |
| A1 — frontend scaffold | Complete | Owner accepted the client shell and routes after lint, typecheck, unit tests, build, and browser checks passed |
| A2 — client auth/MFA | Complete | Owner accepted after local checks and a smoke test against Supabase schema 27 passed |
| A3 — client admin features | Complete | Owner accepted the live admin integration after lint, typecheck, unit tests, build, and browser checks passed |
| A4 — approved knowledge workflow | Complete | Gap review plus Markdown approved-answer submission; pending owner acceptance of the local validation |
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
7. Resolved for A4 by convention: approved answers link to a gap through the
   `Approved answer — <question>` title plus a source-gap blockquote in the
   Markdown body; covering-document suggestions are a title heuristic only.
   Citations resolve through ordinary retrieval only after backend activation.
8. Define the contract for in-panel member invitations and changes when scheduled.
9. Confirm knowledge-gap retention and any additional privacy requirements for analyst access.
10. Scope later UI localization beyond the initial English UI.
11. Settle deployment commands at release planning.

## Backend contract notes

- `ragbot-widget` owns tenant migrations and direct-Supabase admin security.
- Admin RPC names, arguments, and role rules are recorded in the pinned review.
- Knowledge-gap reporting and generic Markdown ingestion exist in source.
  A4 submits approved answers through that ordinary document pipeline; no
  dedicated answer-publishing RPC is assumed.
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

## A2 validation

| Check | Result |
|---|---|
| `npm run lint` and `npm run typecheck` | Passed |
| `npm test` | 9 unit tests passed |
| `npm run build` | Passed |
| `npm run test:e2e` | 12 Chromium tests passed using mocked tenant responses |
| Loopback Supabase smoke test | Schema 27. Verified a real magic-link callback, denial at `aal1`, TOTP enrollment, access at `aal2`, analyst role checks, revocation, and sign-out. Removed the disposable account and membership afterward |

The live smoke test ran against the local stack. The hosted tenant’s Auth
redirects, email delivery, and configuration still need verification before
connecting that tenant.

## A3 validation

Ran on Windows with Node `26.13.1` and npm `11.20.0`. RPC shapes were verified
against the `ragbot-widget` source at commit `ebc75ec` (migrations
001/003/009/010/012) before wiring. Confirm the target’s schema version and
Auth configuration before connecting a hosted tenant.

| Command | Result |
|---|---|
| `npm run lint` and `npm run typecheck` | Passed |
| `npm test` | 30 unit tests passed |
| `npm run build` | Passed |
| `npm run test:e2e` | 16 Chromium tests passed using mocked tenant responses |

A3 covers overview, settings (whitelisted patch fields plus enablement, with
stale-version conflicts preserved for reconciliation), documents
(register/upload/complete, retry, re-index, audited original download, delete),
indexing status, conversations (plain-text reads plus owner/admin delete),
usage (92-day capped ranges), and members (read-only list). Analysts are
read-only; owner/admin mutations stay behind the backend’s membership, `aal2`,
and quota checks. Widget and subscription screens state their deferred
contracts explicitly.

## A4 validation

Ran on Windows with Node `26.13.1` and npm `11.20.0`. The `knowledge_gaps`
shape follows the pinned `ragbot-widget` review; approved answers reuse the
ordinary document pipeline, so no new backend contract is assumed. Confirm the
target’s schema version and Auth configuration before connecting a hosted tenant.

| Command | Result |
|---|---|
| `npm run lint` and `npm run typecheck` | Passed |
| `npm test` | 33 unit tests passed |
| `npm run build` | Passed |
| `npm run test:e2e` | 18 Chromium tests passed using mocked tenant responses |

A4 covers gap review (92-day capped ranges, limit 1–200, search, pagination
guard) plus an owner/admin approved-answer form (title, Markdown body, explicit
human-review checkbox) that registers, uploads, and completes an ordinary
`public_answer` Markdown document. The submission notice states the content is
queued and not retrievable until backend activation; Documents and Indexing
status remain the activation source of truth. Analysts review gaps read-only.
Gap-to-answer linkage is the title plus source-gap blockquote convention, and
covering-document hints are a local title heuristic, not a backend link.

## Approval boundary

Hosted Supabase writes, AWS provisioning, paid provider calls, production deployment, and
changes to `ragbot-widget` require their own explicit approvals and gates.
