# ADR 0003 — A7 Provider Baseline (Proposal)

- **Status:** Accepted by the product owner for A7.0. Build steps A7a–A7c may proceed against this contract.
- **Date:** 2026-11-21
- **Accepted:** 2026-11-21 (product owner via reporting manager review)
- **Decision owners:** Product owner plus the `ragbot-widget` maintainers (provider API home decided 2026-11-21: isolated server component of `ragbot-widget` — own folder, own deploy, own project/database; never in tenant migration history)
- **Context:** Phase A7 (provider administration) is blocked on [status.md](../../status.md) open decisions #2 (provider identity/MFA/roles/recovery), #3 (provider API and registry owner), and #4 (provider access to client data plus audit/consent). The provider panel must never be built as browser code holding service credentials or accepting arbitrary project refs. This proposal splits A7 into a decision step (A7.0, this ADR) and build steps that start only after acceptance.

## Proposals

1. **Provider identity (closes decision #2).** Stand up provider staff in a dedicated provider trust domain — recommended: a separate Supabase project used only for staff identity (Auth + TOTP MFA, public signup disabled, invited staff only), with provider roles (`provider_admin`, `provider_operator`, `provider_support`) enforced server-side on every request. Rejected: reusing any tenant project for staff (mixes trust modes and leaks tenant RLS assumptions), and browser-asserted roles. Staff recovery must be a documented break-glass procedure owned by the provider API owner, not self-service reset alone.
2. **Provider API owner and location (closes decision #3).** Decided 2026-11-21: the provider control API is an isolated server component of `ragbot-widget` (backend repository), backed by a provider registry that lives in the provider domain, never in tenant databases. The panel calls only this API; it never connects to tenant projects directly, never receives service-role/provider/AWS/visitor-signing secrets, and never sends project refs, credentials, or target URLs from the browser — the API resolves the client from its own registry.
3. **Client registry shape.** Minimum columns: client key, tenant project ref (server-held only), plan, subscription/enablement status with source and timestamps, deployment status, and timestamps. No conversation content, document bodies, or credentials stored here.
4. **Provider as superadmin — client control (closes decision #4).** The provider role is the superadmin for lifecycle and tenancy control over all clients:
   - Provision and deprovision client tenants.
   - Invite, suspend, and revoke client owners and admins.
   - Suspend and restore client service.
   - Set and change subscription plan and status, with server-side enforcement.
   - Gate activation: a client's widget script is issued and servable only after provider activation. Tenants cannot self-activate; the tenant panel must hide or disable the installation snippet and the self-enable control until the provider API reports the client active. Amendment accepted 2026-11-21: no active state, no servable script.
   - Read the client registry, deployment status, and usage rollups.
   - Every power above is a provider-API mutation or read with server-side enforcement, never a panel toggle, and every mutation is audited (actor, action, target client, result, timestamp).
   - **Boundary that stays even for superadmin:** silent access to private client data (conversation contents, document bodies) is default-deny. Any permitted access (e.g. support debugging) requires an explicit per-action grant with a recorded purpose/consent reference plus purpose-specific audit. Rationale: one compromised staff account must never be able to quietly read every client's chats, and tenants adopt the product on the promise that their data is not browsable.
   - **Client-held grant mechanism (amendment accepted 2026-11-21):** private-content access and updates happen only under a grant the client issues from its own panel. The client sees dedicated controls: grant provider access with explicit scope (which areas), purpose, and expiry; view active grants; revoke instantly. The provider sees request-access on the client detail, grant status (pending/active/expired/revoked), and acts only within an active, unexpired grant — every action audited on both sides. The grant record lives in the tenant database (the client owns its consent) via a new `ragbot-widget` migration; the provider API enforces the live grant row on every gated operation. No grant, no access — including for updates.
5. **Audit minimum.** Every provider mutation records actor, action, target client, inputs (redacted), result, and timestamp in provider-owned storage with a stated retention period. Auth tokens, full transcripts, document bodies, and generated secrets are never logged. Audit is readable by provider roles only.
6. **Enforcement rule.** The provider API re-verifies staff identity, MFA assurance, role, target-client scope, and action permission on every request. Panel route guards and hidden buttons are presentation only.
7. **Build split after acceptance.** A7a: provider login/MFA + read-only client registry and status (no mutations). A7b: suspend/restore, activation gating (tenant self-enable removed or downgraded to "request activation"; script issuance hidden until provider-active), plus subscription operations with audit. Visitor-API enforcement of the active state must be verified in `ragbot-widget` before any claim. A7c: explicitly approved audited client operations (if decision #4 grants any). Each ships only against the accepted backend contract with its own security tests (role without MFA denied, arbitrary target rejected, tenant cannot self-activate, every mutation audited, no private content without explicit permission).

## Non-goals

- No client impersonation or minted client sessions in the browser.
- No service-role, provider, AWS, or visitor-signing secrets in frontend code, bundles, or requests.
- No UI claiming suspension, enforcement, provisioning, or billing exists before the backend contract and server enforcement are confirmed and tested.

## Acceptance gate for A7.0

The product owner records acceptance of the identity approach, the API owner/repository, the registry location, the access/consent policy, and the audit minimum — or amends this proposal. Until then, A7 stays "Not started" and no provider code is written.
