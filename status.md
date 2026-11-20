# Status — RAGbot Admin Panel

## Current checkpoint

Initial documentation baseline created as a proposal. No frontend code,
provider API, provider registry, tenant migration, deployment, or hosted write
has been performed by this repository yet.

## Phase tracker

| Phase | State | Notes |
|---|---|---|
| A0 — decisions/backend contract | Pending | See open decisions below |
| A1 — frontend scaffold | Not started | Framework and package manager not selected |
| A2 — client auth/MFA | Not started | Must follow tenant Supabase Auth and `aal2` contract |
| A3 — client admin features | Not started | Existing RPC signatures must be verified before wiring |
| A4 — approved knowledge workflow | Not started | FAQ/document representation and write contract are open |
| A5 — widget key lifecycle | Not started | Current widget uses public bot/configuration attributes; dedicated key is not assumed |
| A6 — subscription integration | Not started | Current bot enablement is not a complete subscription lifecycle |
| A7 — provider administration | Not started | Provider identity/API/registry design is open |
| A8 — release/deployment | Not started | Hosting and release gates are not selected |

## Open decisions

1. Frontend framework, Node version, package manager, and deployment target.
2. Whether client and provider builds share a codebase while remaining separate
   deployments.
3. Provider identity provider, MFA policy, provider roles, and staff recovery.
4. Owner and repository for provider API and provider registry.
5. Provider access to client conversations/documents and required audit/consent.
6. Subscription states, start/end semantics, grace period, limits, and
   authoritative enforcement location.
7. Public widget-key format, hashing, hostname restriction, rotation, and
   revocation behavior.
8. Whether approved answers are Markdown knowledge documents or a dedicated FAQ
   entity, and how citations identify them.
9. Client invitation/member-management contract.
10. Safe fields and retention rules for knowledge-gap reporting.
11. Supported languages/localization and accessibility target.
12. Exact local test/build/deploy commands after the framework is selected.

## Backend contract notes

- `ragbot-widget` owns tenant migrations and direct-Supabase admin security.
- Admin RPC names/arguments must be verified against current source before use.
- Knowledge-gap reporting exists in the backend design; a publish-answer flow
  is not assumed implemented.
- Widget identifier rotation/revocation and subscription lifecycle are not
  assumed implemented.
- No provider control plane is assumed to exist.

## Approval boundary

This status file is a planning record, not phase acceptance. Hosted Supabase
writes, AWS provisioning, paid provider calls, production deployment, and
changes to `ragbot-widget` require their own explicit approvals and gates.
