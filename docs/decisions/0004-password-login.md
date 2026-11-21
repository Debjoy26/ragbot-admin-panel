# ADR 0004 — Password Sign-In with Provider-Activated Membership

- **Status:** Accepted by the product owner (generalized login requested for all clients).
- **Date:** 2026-11-21
- **Decision owners:** Product owner
- **Context:** Tenant sign-in used email magic links only (TECH SPECS, ADR 0002). Link delivery is rate-limited per project, which blocks first sign-in under retry bursts, and the product owner wants a generalized login where the provider authorizes each client account.

## Decisions

1. **Password sign-in replaces magic links.** The client panel signs users in with email plus password (`signInWithPassword`). Accounts are created through the panel's create-account form (`signUp`). No sign-in links are sent by the panel. Email confirmation and password-reset links still exist as Supabase account emails; they are one-time account lifecycle messages, not the sign-in method.
2. **Nobody is authorized by signing up.** A new account is inert until the provider side activates membership: the account must have an active row in the tenant's `admin_memberships` (role `owner`, `admin`, or `analyst`) before the panel renders anything beyond the access-denied state. The backend remains authoritative; the panel fails closed on unknown role, assurance, or membership.
3. **Provider authorizes the client.** Activation is a provider/owner action. Until the in-panel member invitation contract exists (open decision #8), activation is done by the workspace owner in the tenant project's SQL editor or Table Editor. The denied screen directs users to their provider administrator.
4. **MFA stays mandatory.** Password alone yields `aal1`. Private reads and every mutation still require `aal2` (TOTP) exactly as before. Password rules, lockout, and reset behavior are the tenant Auth project's configuration; the panel enforces nothing about passwords itself beyond basic input validation.
5. **Tenant Auth prerequisites change.** The tenant project must enable the email provider with password sign-in, decide signup policy (open registration recommended so clients can self-register inert accounts; invited-only remains allowed), keep TOTP enabled, and keep the panel URL in the redirect allowlist for confirmation and reset links.

## Consequences

- TECH SPECS client sign-in section and README local demo instructions switch from links to passwords.
- E2E auth mocks switch from magic-link callbacks to password-grant sessions.
- Magic-link rate limits no longer gate sign-in; they can still gate confirmation/reset delivery, which custom SMTP mitigates.
