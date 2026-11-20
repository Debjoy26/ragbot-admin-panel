# ADR 0002 — A0 Product and Integration Baseline

- **Status:** Accepted by the product owner for A0
- **Date:** 2026-11-21
- **Decision owners:** Product owner
- **Context:** A0 sets the product and security baseline for the first client milestone. The [A0 backend contract review](../backend-contract-a0.md) records the tenant APIs against a pinned `ragbot-widget` revision.

## Decisions

1. **Panel scope:** This repository owns the client and provider administration experiences and their frontend integration only. The `ragbot-widget` repository remains authoritative for tenant schema, RLS, RPCs, Storage policies, visitor API, indexing worker, widget, and shared contracts.
2. **Client trust mode:** Client administration authenticates against the selected tenant Supabase Auth project, requires active membership and `aal2` for private operations, and uses only verified RLS-protected reads, approved browser-callable RPCs, and permitted Storage operations. The backend remains authoritative for authorization.
3. **Provider trust mode:** Provider administration is deferred until a provider identity/MFA design, provider API owner, registry, and audit contract are approved. Any eventual provider UI is a separate deployment/trust mode; browser code never receives provider or tenant service credentials.
4. **Knowledge answers:** Use admin-authored Markdown as the proposed A4 format because the existing document pipeline supports its upload, versioning, and activation. Require explicit human approval before submission and confirm the active version before declaring the answer available. Define gap linkage, retention, audit, deduplication, and citation behavior during A4 design.
5. **Subscription and widget identifiers:** Separate the current slug-based widget snippet from the future identifier lifecycle work in A5. Treat the existing enabled flag as bot availability. Scope client subscriptions to read-only display once an authoritative contract exists, with provider-managed lifecycle and server enforcement in A6–A7.
6. **Cross-repository changes:** Tenant backend changes are specified and implemented in `ragbot-widget` under its migration history, then published as a versioned/reviewed contract before this panel integrates them.
7. **Frontend stack:** Use React, strict TypeScript, Vite, and React Router for the client browser app. Match the companion repository's Node `26.13.1` and npm `11.20.0` pins, and use `npm ci` with a committed lockfile. Vite provides a static artifact that fits the direct Supabase design. [Vite guide](https://vite.dev/guide/) · [Upstream toolchain decision](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/docs/decisions/0018-node-26-pin.md).
8. **Build and hosting:** Start with one client entry point under `/app`. Target static hosting with route fallback under `/app` and tenant-specific public configuration. Select the hosting account, domains, and production workflow at release planning. A later provider entry point may share UI components in this repository and must produce its own deployment artifact with separate configuration.
9. **Initial client scope:** Show the member list and the knowledge-gap fields verified in the contract. Defer in-panel invitations, role changes, and revocation. Start with English UI copy and a WCAG 2.2 AA accessibility target. Preserve the backend's content language values independently of UI localization.

## A1 handoff

- Create the client shell and route structure. Use local fixture data for the scaffold.
- Define `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` with ESLint, TypeScript, Vitest, Vite, and Playwright. The scripts become runnable once A1 adds them.
- Use the pinned source review for A2–A3. Confirm the test target's schema version and Auth configuration before connecting the panel. Reconcile any differences with `ragbot-widget` before shipping the affected feature.

## A0 exit gate

The product owner accepted this baseline and the companion [repository boundary ADR](0001-admin-panel-boundary.md) after the source review was recorded. A0 is complete. Deferred features retain their own contract and acceptance gates.
