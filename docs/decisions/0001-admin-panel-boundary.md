# ADR 0001 — Admin Panel Repository and Trust Boundaries

- **Status:** Accepted by the product owner for A0
- **Date:** 2026-11-20
- **Decision owners:** Product owner
- **Context:** The RAGbot widget/backend is in a separate repository. The panel
  must serve client administrators and eventually provider staff without
  exposing cross-client credentials to browsers.

## Decision

1. Keep this repository responsible for administration frontends and their
   documented backend integrations.
2. Keep tenant database migrations, tenant RPCs/RLS, visitor API, worker,
   widget, and shared backend contracts in
   [`ragbot-widget`](https://github.com/Debjoy26/ragbot-widget).
3. Client administration uses Supabase Auth, active tenant membership, required
   MFA assurance, RLS, approved RPCs, and Storage policies.
4. Provider administration is a separate trust mode/deployment and calls a
   provider-controlled API. It does not use browser-held service-role keys or
   arbitrary direct connections to tenant projects.
5. Any provider action against a tenant is explicit, scoped, and audited.
6. Knowledge-gap answers become ordinary approved/indexed tenant knowledge;
   they are not automatic model training.

## Consequences

- No competing tenant migration history is created here.
- Provider control-plane ownership and schema remain undecided.
- Widget keys and subscription state require backend contracts before UI
  controls can claim to manage them.
