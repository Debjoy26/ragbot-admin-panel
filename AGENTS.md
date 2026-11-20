# Agent Guidance

## Project status and source of truth

- This repository is the administration frontend for `ragbot-widget`; it does not own the visitor runtime or tenant backend.
- Read `README.md`, `PRD.md`, `ARCHITECTURE.md`, `TECH_SPECS.md`, `UI_SCHEMA.md`, `plan.md`, and `status.md` before substantial work. Review relevant decisions in `docs/decisions/` as well.
- Treat the product and architecture documents as proposals where they say so. `status.md` records current decisions and progress. Do not claim a feature, API, RPC, or provider service exists unless verified in its authoritative source.
- The companion `ragbot-widget` repository owns tenant migrations, RLS, RPCs, Storage policies, visitor API, indexing worker, widget bundle, and shared backend contracts. Do not create competing tenant migrations or silently copy contracts across repositories.
- Follow the accepted frontend stack and build layout in [ADR 0002](docs/decisions/0002-a0-product-and-integration-baseline.md). Hosting, the provider control plane, and deferred feature contracts still have open decisions.

## Security boundaries

- Treat client and provider experiences as separate trust modes and deployments, even if they share components. Routes, build flags, and hidden UI are not authorization controls.
- Client access uses the configured tenant Supabase Auth, active membership, required `aal2` assurance, RLS-protected reads, approved browser-callable RPCs, and permitted Storage operations. Verify exact signatures and grants against the current backend source before integration.
- Never write protected tenant tables directly. Backend authorization is authoritative; UI guards are supplementary. Fail closed on unknown identity, role, assurance, configuration, or state.
- Provider operations must go through the provider-controlled API. Never put service-role, provider, AWS, visitor-signing, or other server secrets in frontend code, environment variables, bundles, or browser requests. Never accept arbitrary project refs, credentials, or target URLs from the browser.
- Provider actions must be explicitly scoped and audited. Provider UI access does not grant access to private conversations or document contents.
- Do not log or persist auth tokens, full transcripts, document bodies, or generated secrets. Avoid retaining sensitive records in browser storage or caches; clear in-memory private state on sign-out, expiry, revoked membership, or lost assurance.

## Product and integration rules

- Keep widget/runtime, ingestion, tenant schema, and provider-secret responsibilities outside this repository.
- Treat knowledge-gap review as a human approval workflow. An answer becomes usable only after the approved backend ingestion and indexing flow confirms activation; it is not model training.
- Do not add UI that claims widget-key rotation, subscription enforcement, suspension, provider provisioning, or approved-answer publishing exists until the corresponding backend contract and enforcement are confirmed.
- Client subscription is read-only. Unknown or stale status must not appear active.
- Use only fields and operations permitted by the backend contract. Handle permission, membership/MFA, validation, quota, stale-version, indexing, unavailable, and conflict errors as explicit failures; do not disguise errors as empty states or successful mutations.
- Avoid rendering untrusted chat or document content as HTML. Preserve keyboard access, visible focus, meaningful labels, and accessible announcements for asynchronous state.

## Implementation workflow

- Follow the phase order in `plan.md`: resolve product/security decisions and verify backend contracts before implementing dependent features. Do not treat this plan as approval for hosted writes, AWS provisioning, paid calls, production deployment, or changes to `ragbot-widget`.
- Keep changes within this repository unless the user explicitly authorizes cross-repository work and the required owner approval is recorded.
- A1 defines the scaffold and configures the validation commands listed in ADR 0002. Report a validation gate as passing only after its command exists and runs successfully.
- Add or run tests only when requested or when the applicable project workflow requires them. When validation is performed, report the exact commands and results.
- Update `status.md` or relevant decision records when an authorized change resolves an open decision or advances a phase. Keep proposals, accepted decisions, and completed implementation clearly distinguished.
