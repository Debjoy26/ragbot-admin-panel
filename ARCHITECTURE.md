# Architecture — RAGbot Admin Panel

## 1. System boundary

```text
Client administrator browser
  -> Client-admin deployment
  -> Supabase Auth session (client project)
  -> Tenant RLS-protected reads, approved RPCs, and Storage

Provider administrator browser
  -> Provider-admin deployment
  -> Provider control API (separate trusted service)
  -> Provider registry and audit store
  -> Explicitly authorised tenant operations

Visitor website
  -> Widget bundle and visitor API (ragbot-widget; outside this panel)
```

The client panel talks directly to Supabase as established by
[`ragbot-widget` ADR 0017](https://github.com/Debjoy26/ragbot-widget/blob/main/docs/decisions/0017-admin-panel-direct-to-supabase.md).
It does not call the visitor Render/AWS API for ordinary admin operations.

The provider panel must not connect from the browser to every tenant using
service-role credentials. Cross-client work goes through a provider control
API. Provider API location and ownership are open decisions; no such service is
assumed to exist yet.

## 2. Deployment modes

The client and provider experiences may share UI components and a codebase,
but must be built and deployed as separate trust modes:

- **Client build:** contains only public Supabase configuration and client
  features. It has no provider API secrets or provider-only authority.
- **Provider build:** calls the provider API and is protected by provider
  authentication, MFA, role checks, and server-side audit.

Separate deployments are a security boundary aid, not a substitute for
backend authorization. Build-time flags and hidden routes are not access
controls.

## 3. Client request flow

1. User signs in through the configured client Supabase Auth project.
2. The panel obtains the user's session and verifies the required assurance
   before rendering private capabilities.
3. Reads use RLS-protected relations or documented safe RPCs.
4. Mutations use browser-callable RPCs and Storage policies from the tenant
   backend contract.
5. The backend validates ownership, role, MFA, input, quota, and audit behavior.
6. The panel reports the backend result; it does not fabricate success.

## 4. Knowledge-gap answer flow

```text
Knowledge-gap report
  -> admin reviews question
  -> admin authors/approves answer
  -> approved tenant knowledge write/upload
  -> durable indexing job
  -> worker validates, extracts/chunks/embeds
  -> atomic activation
  -> future retrieval can cite the approved source
```

The live model does not update its own knowledge from a conversation. Storage
format and the exact write RPC are pending a backend contract decision.

## 5. Provider flow

1. Provider staff authenticate in the provider trust domain and complete MFA.
2. Provider API verifies provider role and the requested action.
3. API resolves the client from the provider registry; the browser cannot
   supply arbitrary project credentials or target URLs.
4. API performs only an explicitly allowed action using server-held
   credentials or a reviewed delegation protocol.
5. API records actor, client, operation, outcome, and safe metadata.
6. API returns the minimum result needed by the panel.

Provider access to private conversations or document bodies requires a
separate owner-approved policy and purpose-specific audit. It is not granted by
provider UI access alone.

## 6. Data ownership

| Data | Authority |
|---|---|
| Client identity, bot settings, documents, conversations, usage | That client's Supabase project and `ragbot-widget` schema |
| Client login and membership | That client's Supabase Auth/membership model |
| Provider staff, provider roles, client registry, subscription records, provider audit | Provider control plane (design pending) |
| Widget script and visitor runtime | `ragbot-widget` static bundle, API, and worker |

This panel repository does not create tenant migrations. Provider registry
schema, if hosted in Supabase, must have a separate explicitly identified
owner/history rather than competing with `ragbot-widget` tenant migrations.

## 7. Integration constraints

- Pin and consume backend contracts; do not infer RPC shapes from UI needs.
- Reuse `shared` schemas only through a documented package, generated artifact,
  or reviewed synchronization process. No implicit cross-repository file copy.
- The current widget embed is based on public bot/configuration values. A
  dedicated rotatable widget-key contract is not assumed to exist.
- The current bot enable/disable control is not a complete subscription
  lifecycle.
- Subscription and suspension UI must not imply enforcement until the visitor
  API and authoritative database checks enforce the state.
- Do not cache authorization decisions beyond the session/backend contract.

## 8. Operational and security boundaries

- No service-role key, AWS key, provider key, visitor signing secret, or
  Turnstile secret in frontend environment variables or bundles.
- Do not log access/refresh tokens, full chat content, document bodies, or
  generated secrets.
- Clear local UI state when sessions expire or membership is revoked.
- Host-origin checks and client-side role checks are supplementary only.
- Fail closed if auth assurance, role, client identity, subscription state, or
  required configuration is unknown.
