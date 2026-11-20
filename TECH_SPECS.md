# Technical Specifications — RAGbot Admin Panel

## 1. Status

This is a proposed integration contract. It does not declare any endpoint,
RPC, route, or provider service implemented. Confirm concrete types and names
against the current `ragbot-widget` source before coding.

## 2. Authentication and authorization

### Client mode

- Authenticate through the selected tenant's Supabase Auth.
- Require the backend's `aal2` assurance for private reads and mutations.
- Read the active membership and role from an approved contract.
- Treat an authenticated session without active membership as unauthorized.
- Treat the UI route guard as presentation only; PostgreSQL RLS and RPC checks
  remain authoritative.
- On sign-out, expiry, revoked membership, or lost assurance, clear sensitive
  in-memory state and return to an appropriate auth/error state.

### Provider mode

- Authenticate through a provider-controlled identity/service, not by inserting
  provider users as ordinary members in every client project.
- Enforce provider role, MFA, target-client scope, and action permission in the
  provider API on every request.
- Never allow the browser to provide arbitrary Supabase project refs, service
  credentials, deployment URLs, or provider roles.

Provider identity provider, session format, and control API are open decisions.

## 3. Backend integration

The client UI may use only:

1. documented RLS-protected reads;
2. browser-callable, role-scoped RPCs listed in the backend schema contract;
3. Storage operations permitted by the backend's Storage policies.

No direct mutation of protected tables. The current backend documentation
lists admin RPCs for documents, settings, enablement, conversations, members,
and summaries; exact function signatures and role grants must be read from the
current migration/schema before implementation.

The panel must handle stable backend error codes, including permission,
membership/MFA, validation, quota, stale-version, indexing, unavailable, and
conflict outcomes. Unknown errors must be shown as an explicit failure with a
safe correlation identifier when available.

## 4. Feature contracts

### Documents

- Register an upload through the approved RPC before uploading.
- Upload only to the generated pending-version path permitted by Storage RLS.
- Complete the upload through the approved RPC to queue indexing.
- Poll or refresh safe document status; show safe failure code and progress.
- Retry/re-index/delete through approved RPCs.
- Do not show a new version as active until backend status confirms activation.

### Settings

- Load server-authoritative settings and `settings_version`.
- Submit only whitelisted fields with the expected version.
- Surface stale-write conflicts; do not silently overwrite another admin's edit.
- Validate for UX, but rely on SQL/backend validation for enforcement.

### Knowledge gaps and authored answers

- Display only fields approved by the knowledge-gap reporting contract.
- Avoid exposing question text to analyst roles unless granted.
- Do not turn a question or a model response into knowledge automatically.
- Submit an admin-authored answer through the approved knowledge ingestion path.
- Show pending/indexing/ready/failed states from authoritative worker status.
- The FAQ storage representation and RPC are not yet defined.

### Widget installation

- Generate a snippet only from the approved public embed contract.
- Public identifiers are not auth tokens.
- Never include admin session tokens, service-role keys, provider keys, or
  secrets.
- Dedicated widget-key creation, rotation, hostname restrictions, and revocation
  require a backend contract not currently assumed.

### Subscription

- Client mode is read-only.
- Display source and last-updated state.
- Unknown/expired state must not be presented as active.
- Enforcement, grace period, renewal, suspension and restoration semantics
  must be implemented by the provider/backend before the UI claims they are
  enforced.

## 5. Data and privacy

- Fetch only the page/summary needed for the current view.
- Avoid localStorage for auth tokens or sensitive admin data.
- Do not persist document bodies or full conversation transcripts in browser
  caches by default.
- Redact tokens and sensitive content from client telemetry and error reports.
- Follow tenant retention and deletion behavior; the panel does not create
  independent copies.

## 6. Test requirements

### Client authorization

- Unauthenticated, nonmember, inactive member, `aal1`, analyst, admin, owner,
  and revoked-member cases.
- Cross-client ID substitution fails.
- Direct RPC/Storage denial remains enforced if UI guards are bypassed.
- Stale settings version is surfaced without overwriting.

### Knowledge workflow

- Repeated unanswered questions aggregate only as permitted.
- Unapproved answer is never submitted/indexed.
- Failed indexing leaves existing active knowledge intact.
- Ready state appears only after confirmed activation.
- A future answer can cite the approved source; no claim of model retraining.

### Provider

- Client credentials cannot call provider operations.
- Provider role without required MFA is denied.
- Arbitrary client/project target is rejected.
- Every mutation writes an auditable event.
- Private content is inaccessible absent explicit permission.

### Frontend

- Auth expiry and error states are explicit.
- No secrets appear in built assets.
- Keyboard, screen-reader, and responsive behavior are tested.

## 7. Validation commands

Install the locked dependencies with `npm ci`. Run `npm run lint`,
`npm run typecheck`, `npm test`, and `npm run build` from the repository root.
Install the Chromium test browser with `npx playwright install --only-shell chromium` and run
`npm run test:e2e` against the production build. See [README.md](README.md)
for toolchain pins and the local preview address.
