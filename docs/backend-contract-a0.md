# A0 Backend Contract Review

Reviewed the `ragbot-widget` source at [ebc75ecaf2c99ce6dcacdbefa3827914b64273b5](https://github.com/Debjoy26/ragbot-widget/tree/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5). The source defines migrations 001–027 and `schema_version()` returning 27. This review establishes the source contract. Verify the deployed schema and Auth configuration in the target test environment before wiring the panel.

## Authentication and reads

- Each client has its own Supabase project. Configure the client deployment with that project's public URL and publishable key. Use the signed-in user's session for private requests.
- The tenant setup guide calls for invite-only signup and TOTP MFA. Its first-admin script provisions the initial invite and membership outside the browser. The checked-in local config enables signup for development, so its defaults do not establish hosted settings.
- `is_active_member(p_roles text[])` returns a boolean and checks live, active project membership for the current user. Use it as a role probe. Authorization for private operations requires `aal2` through `is_active_member_mfa(p_roles text[])`. When membership is revoked, subsequent backend checks deny private access. Clear any private UI state when the panel detects denial or lost assurance.
- Owner, admin, and analyst can read `documents`, `document_versions`, `conversations`, `messages`, `message_sources`, and `conversation_analysis` under RLS. System messages are filtered. `data_entries` and `audit_logs` are restricted to owners and admins. Request only the fields and rows each screen needs.
- Published `public_bot_config` rows are public. `bot_profiles`, `client_settings`, `admin_memberships`, jobs, and raw usage events have no direct browser read grant. Use the approved calls below.

Sources: [ADR 0015](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/docs/decisions/0015-mfa-enforced-in-database.md), [ADR 0017](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/docs/decisions/0017-admin-panel-direct-to-supabase.md), [tenant setup](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/database/README.md), [migration 003](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/supabase/migrations/003_grants_rls_storage.sql), and [migration 008](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/supabase/migrations/008_p3d5_fixes.sql).

## Client RPCs

These calls are granted to `authenticated`. Each data operation checks live membership and `aal2`. “All” means owner, admin, or analyst.

| RPC and named arguments | Roles | SQL result |
|---|---|---|
| `admin_list_bots()` | All | Rows with `id uuid`, `slug text`, `display_name text`, `enabled boolean`, `settings_version integer` |
| `admin_get_settings(p_bot_id uuid)` | All | Settings row. See migration 010 for the exact projection, including nullable values from the upload policy and public config |
| `admin_update_settings(p_bot_id uuid, p_expected_settings_version integer, p_patch jsonb)` | Owner, admin | New settings version as `integer` |
| `admin_set_bot_enabled(p_bot_id uuid, p_expected_settings_version integer, p_enabled boolean)` | Owner, admin | New settings version as `integer` |
| `admin_register_document(p_bot_id uuid, p_title text, p_media_type text, p_byte_size bigint, p_disclosure_policy text)` | Owner, admin | `document_id uuid`, `version_id uuid`, `storage_path text` |
| `admin_add_document_version(p_document_id uuid, p_media_type text, p_byte_size bigint)` | Owner, admin | `version_id uuid`, `version_number integer`, `storage_path text` |
| `admin_complete_upload(p_version_id uuid)` | Owner, admin | `version_id uuid`, `status text`, `job_queued boolean` |
| `admin_retry_version(p_version_id uuid)` | Owner, admin | `version_id uuid`, `status text` |
| `admin_reindex_document(p_document_id uuid)` | Owner, admin | `version_id uuid`, `version_number integer` |
| `admin_document_status(p_bot_id uuid, p_limit integer, p_offset integer)` | All | Document and active/latest version identifiers and states, batch progress, and safe failure code. Limit 1–500, offset at least 0 |
| `admin_request_download(p_version_id uuid)` | Owner, admin | Audits the request and returns the object path as `text` |
| `admin_delete_document(p_document_id uuid)` | Owner, admin | `void` |
| `admin_delete_conversation(p_conversation_id uuid)` | Owner, admin | `void` |
| `admin_list_members()` | Owner, admin | `user_id uuid`, `role text`, `active boolean`, `label text` (email where available) |
| `job_status_summary()` | All | `job_type text`, `job_state text`, `job_count bigint` |
| `usage_daily_summary(p_from date, p_to date)` | All | `usage_day date`, `bot_id uuid`, `operation text`, `event_count bigint`, `input_tokens bigint`, `output_tokens bigint`, `estimated_cost numeric`. Date range limit of 92 days |
| `knowledge_gaps(p_from date, p_to date, p_limit integer)` | All | `handoff_reason text`, `question text`, `occurrences bigint`, `last_seen timestamptz`. Date range limit of 92 days, row limit 1–200 |

`schema_version()` returns an integer for signed-in users and serves as a compatibility probe only. The paginated document status call in migration 010 replaces the single-argument call from migration 009. Migration 012 replaces the reindex implementation while keeping its signature.

Sources: [migration 003](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/supabase/migrations/003_grants_rls_storage.sql), [migration 009](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/supabase/migrations/009_admin_documents.sql), [migration 010](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/supabase/migrations/010_admin_settings.sql), [migration 012](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/supabase/migrations/012_ingestion.sql), and [migration 027](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/supabase/migrations/027_warm_tenant_binding.sql).

## Behavior the panel should preserve

- **Settings.** Load `settings_version` with the editable values. Submit only fields accepted by `admin_validate_settings_patch` in migration 010, with the version read. Use the returned version after a successful write. On conflict, reload and let the user reconcile edits. Upload limits in the read response are informational.
- **Documents.** Register a document or version, upload the PDF, Markdown, or plain text file to the returned path in private bucket `knowledge` with upsert disabled, then complete the upload to queue indexing. The path is `{bot_id}/{document_id}/{version_id}/{generated_filename}`. The insert policy allows owner/admin uploads for pending versions within 24 hours of registration. Use the backend's active version ID and status to confirm activation. Failed replacements leave the prior active version available. For original downloads, call the audit RPC before requesting a short-lived signed URL. A URL already issued remains usable until expiry even if membership changes.
- **Errors.** Map `22023` to invalid input, `42501` to permission denial, `RB030` to a stale version or invalid state, `RB031` to file too large, `RB032` to MFA required, `RB033` to forbidden, `RB034` to quota exceeded, `RB035` to invalid settings, `RB036` to policy/configuration missing, `RB037` to not found, `RB038` to upload missing, and `RB039` to bot disabled. Keep transport failures and unknown errors distinct from empty results. See the [shared SQLSTATE mapping](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/shared/src/errors.ts).
- **Knowledge gaps.** The report aggregates assistant handoffs by reason and question text, truncated to 500 characters. It omits the `blocked` group for analysts. Analysts still have direct message reads under RLS, so this filter cannot enforce transcript privacy. The report returns no language, raw conversation reference, or pagination cursor.
- **Widget installation.** The current script requires `data-bot-slug`, `data-api-url`, `data-supabase-url`, and `data-supabase-publishable-key`. Include `data-turnstile-site-key` when the deployment requires Turnstile. Use a versioned script URL and deployment-provided public values. The slug identifies a bot. See the [embed parser](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/widget/src/public-config.ts).

## Features needing a separate contract

| Feature | Current source support | Panel scope |
|---|---|---|
| Member management | Member listing and an operator-run first-admin invite script | Show the list. Defer in-panel invitations, role changes, and revocation controls pending a reviewed contract |
| Approved answers | Generic Markdown ingestion and a separate gap report | Propose a human-reviewed Markdown workflow. Define how approved sources relate to report entries, and confirm audit, retention, deduplication, and citations before A4. Internal cache warming RPCs are service-only |
| Public widget identifier lifecycle | Public slug-based embed | Offer the existing snippet once public deployment configuration is available. Defer creation, rotation, host restrictions, and revocation |
| Subscriptions | Bot enablement blocks new visitor work through session and request checks | Label the control as bot enablement. Defer plan, period, billing status, and suspension UI until an authoritative provider and runtime contract exists |
| Provider administration | Proposed trust boundary | Keep provider features out of the client build. Define the provider identity, registry, API, audit, and allowed actions before building the provider deployment |

See [runtime enablement checks](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/supabase/migrations/011_visitor_sessions_runs.sql) and [upstream ADR 0019](https://github.com/Debjoy26/ragbot-widget/blob/ebc75ecaf2c99ce6dcacdbefa3827914b64273b5/docs/decisions/0019-managed-admin-platform.md).
