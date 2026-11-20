# Product Requirements — RAGbot Admin Panel

## 1. Purpose

This repository specifies the administration frontend for the managed RAGbot
service. It covers two audiences:

- **Client administrators**, who manage one organisation and its bot.
- **Provider administrators**, who manage the provider's client registry and
  have explicitly authorised cross-client operations.

The panel is a separate application from the embeddable widget and backend. It
does not own tenant migrations, RAG execution, indexing, or provider secrets.

## 2. Product boundaries

The companion `ragbot-widget` repository remains authoritative for:

- Tenant Supabase migrations, grants, RLS, RPCs, and Storage policies
- Visitor API and signed visitor sessions
- Document indexing worker and retrieval/chat behavior
- Widget bundle and its public embed contract
- Shared backend schemas and contracts

This repository owns admin user journeys, frontend behavior, and integration
with approved backend contracts. Any required tenant schema/RPC change must be
specified for and implemented in `ragbot-widget`, in its single migration
history, before this panel depends on it.

## 3. Goals

1. Let a client securely sign in with Supabase Auth and required MFA (`aal2`).
2. Let client members manage only their own organisation's bot and data.
3. Provide document upload, indexing status, retry/re-index, and deletion
   using existing authorised RPCs and Storage policies.
4. Provide bot settings, conversation/usage views, and knowledge-gap reporting
   where the backend contract permits them.
5. Let an authorised client administrator obtain or rotate a public widget
   identifier and copy an installation snippet once the backend supports its
   lifecycle.
6. Show provider-managed subscription state without letting client admins
   change it.
7. Let provider staff see all clients and perform explicitly authorised,
   audited provider operations through a separate provider service.
8. Present frequent unanswered questions and support a human-reviewed path to
   add approved knowledge for future retrieval.
9. Keep provider credentials and cross-client authority out of client
   browser bundles.

## 4. Non-goals

- Implementing the visitor widget, API, worker, or tenant database schema.
- Putting Supabase service-role keys, AWS credentials, or AI provider keys in
  the frontend.
- Allowing an LLM or an unverified visitor to publish knowledge automatically.
- Billing-provider integration, invoices, or automated payment collection in
  the initial panel.
- Treating a widget identifier, Supabase publishable key, or website origin as
  authentication.
- Giving provider staff silent or unaudited access to private conversation or
  document content.
- Browser-side direct writes to protected tenant tables.

## 5. Roles and permissions

| Role | Scope | Allowed responsibilities |
|---|---|---|
| Client owner | One organisation | Manage bot, documents, settings, members, and authorised records |
| Client admin | One organisation | Manage bot and knowledge within granted permissions |
| Client analyst | One organisation | Read permitted conversations, usage, status, and knowledge gaps |
| Provider operator | Provider control plane | View client/deployment status and perform specifically granted operations |
| Provider super-admin | Provider control plane | Manage provider staff, client lifecycle, plans, and audited exceptional operations |

The panel UI is not an authorization boundary. Client permissions must be
enforced by tenant RLS/RPC/Storage policies. Provider permissions must be
enforced by the provider service. MFA and role requirements must be explicit
for both trust domains.

## 6. Functional requirements

### Client administration

| ID | Requirement | Acceptance condition |
|---|---|---|
| ADM-01 | Client login and MFA | A member can sign in; private screens/actions require the backend's required MFA assurance |
| ADM-02 | Tenant isolation | A client member cannot read or change another organisation's data, including by changing a URL or request parameter |
| ADM-03 | Bot settings | An authorised member can read and update only backend-whitelisted settings, handling stale-version conflicts |
| ADM-04 | Documents | An authorised member can upload supported content, see safe indexing status, retry/re-index, and delete through approved RPC/Storage paths |
| ADM-05 | Conversations and usage | Members see only records allowed by their tenant role and the backend grants |
| ADM-06 | Members | Owners/admins can view and manage members only where supported by the Auth and membership contract |
| ADM-07 | Widget installation | The panel can show the public embed contract and copy a script snippet; it never includes admin or server credentials |
| ADM-08 | Widget identifier lifecycle | An authorised member can create, view as appropriate, rotate, or revoke a public widget identifier only after backend support exists |
| ADM-09 | Subscription display | Client members can view provider-managed plan/status/period; they cannot edit provider subscription state |
| ADM-10 | Knowledge gaps | Permitted members can view aggregated unanswered questions and counts using the approved reporting RPC |
| ADM-11 | Approved answer workflow | An authorised member can review a gap, author/approve knowledge, and submit it through the agreed document/indexing workflow; it is not answerable by the live model until indexing succeeds |
| ADM-12 | Safe failures | Auth expiry, `aal2` loss, denied access, stale edits, upload/indexing failure, and service outage are visible and do not appear successful |

### Provider administration

| ID | Requirement | Acceptance condition |
|---|---|---|
| ADM-13 | Provider authentication | Provider routes require provider identity, MFA, and provider-side role checks |
| ADM-14 | Client registry | Provider staff can list and inspect registered client/deployment metadata |
| ADM-15 | Client feature parity | A provider may access client management capabilities only through a documented, audited provider operation; no silent browser impersonation |
| ADM-16 | Subscription lifecycle | Provider roles can set plan/status/period and record an audit event; runtime enforcement is owned by the backend |
| ADM-17 | Suspend/restore | Provider can suspend or restore a client using an authoritative backend operation; suspension is enforced server-side and fails closed |
| ADM-18 | Provider audit | Every provider mutation records actor, target, action, timestamp, outcome, and safe metadata |
| ADM-19 | Cross-client isolation | Client credentials and sessions cannot call provider operations; provider operations are scoped to a selected registered client |
| ADM-20 | Provisioning | Provisioning is not assumed to be available until infrastructure automation and its approvals are designed |

## 7. Unanswered questions to approved knowledge

The reporting list is a review queue, not an automatic training mechanism:

1. The backend records a permitted knowledge-gap event and aggregates repeated
   questions without exposing unnecessary raw conversation content.
2. The administrator reviews the question and supplies an approved answer or
   updates an existing knowledge source.
3. The content is stored in the tenant's approved knowledge base using the
   same validation, Storage, indexing, and version-activation rules as other
   knowledge.
4. The panel shows pending/indexing/ready/failed state.
5. Retrieval can use the new content only after successful activation.
6. A failed replacement leaves the prior active knowledge unchanged.

Whether approved answers are stored as Markdown documents or as a dedicated
FAQ entity is an open contract decision. The panel must not claim that the bot
"learned" an answer before the backend confirms indexing and activation.

## 8. Success criteria

- Client roles cannot cross tenant boundaries.
- No service or provider secret is present in any browser bundle or response.
- All private actions require the expected auth assurance and server-side role
  enforcement.
- Document, settings, subscription, and suspension states match authoritative
  backend responses.
- An approved answer becomes retrievable only after successful indexing.
- Provider changes are attributable in an audit record.

## 9. Open decisions

See [status.md](status.md). In particular: frontend framework, provider identity
and MFA source, provider control-plane API/repository, provider registry,
widget-key format and lifecycle, subscription semantics, FAQ storage shape,
client member invitation flow, and permitted provider access to client content.
