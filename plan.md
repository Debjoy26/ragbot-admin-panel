# Implementation Plan — RAGbot Admin Panel

## 1. Guiding rules

1. This panel consumes the `ragbot-widget` backend contract; it does not own
   tenant migrations.
2. Implement client authorization before privileged features.
3. Provider cross-client operations require a provider API and registry; never
   put provider credentials in a browser.
4. Approved knowledge is indexed content, not model training.
5. Every phase needs its named local tests and explicit owner acceptance.

## 2. Proposed phases

| Phase | Deliverable | Depends on | Gate |
|---|---|---|---|
| A0 | Resolve product/security decisions and confirm backend contract | — | Decisions recorded and owner-approved |
| A1 | Frontend scaffold, routing, lint/typecheck/test/build | A0 | Clean build and baseline tests |
| A2 | Client Auth, MFA/aal2 states, membership and role guards | A1, tenant Auth contract | Role and revoked-session tests |
| A3 | Client overview, settings, documents, indexing status, conversations, usage, members | A2, existing tenant RPCs | Contract tests plus tenant-isolation tests |
| A4 | Knowledge-gap review and approved-answer workflow | A3, chosen FAQ/document contract | Approval, indexing, failure, and retrieval tests |
| A5 | Widget installation and public identifier lifecycle | A0, backend key contract | Rotation/revocation and embed tests |
| A6 | Client subscription display and server enforcement integration | A0, provider subscription contract | Expired/suspended bot fails closed |
| A7 | Provider identity, registry, API integration, audit and client operations | A0, provider control-plane design | Provider role/target/audit security tests |
| A8 | Accessibility, security, release readiness, deployment | A2–A7 | Owner-approved release gates |

Phases A5–A7 may be split further once A0 decides the provider architecture.
Scheduling does not authorize changes in `ragbot-widget`, hosted Supabase
writes, AWS provisioning, paid calls, or production deployment.

## 3. First implementation milestone

After A0 decisions and framework approval:

1. Scaffold the panel with strict types and tested build scripts.
2. Implement client login/MFA and role-aware shell.
3. Integrate read-only settings, bot/document status, and knowledge gaps.
4. Add mutations only through already-reviewed RPCs/Storage policies.
5. Add focused tests for denial, stale state, and backend failures.

Do not begin with provider impersonation, billing automation, or AWS
provisioning.

## 4. Cross-repository work

For each required backend capability:

1. Record the missing contract and threat model here.
2. Obtain owner approval for the backend task.
3. Implement schema/RPC/RLS/worker behavior in `ragbot-widget` under its
   migration history and phase gates.
4. Publish/update the shared contract.
5. Integrate and test the panel against the exact contract.

## 5. Release and deployment

Deployment provider, domains, and CI are open decisions. Before release:

- Build client and provider bundles separately.
- Scan output for secret-like values.
- Verify client bundle cannot call provider endpoints.
- Verify MFA, tenant isolation, provider authorization, audit, and accessibility.
- Use staging/test projects; do not write to hosted client projects without
  explicit approval.
- Record rollback versions and compatibility with backend/widget releases.

## 6. Open decisions

See [status.md](status.md). No phase beyond documentation/scaffolding is
considered approved by this plan alone.
