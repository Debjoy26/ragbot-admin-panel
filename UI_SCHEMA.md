# UI Schema — RAGbot Admin Panel

## 1. Application modes

The same product may share components, but client and provider modes are
separate deployments and authorization contexts:

- Client base: `/app`
- Provider base: `/provider`

Routes are not a security boundary. Each backend enforces authorization.

## 2. Client navigation

```text
Client App
  Login / MFA
  Overview
  Bot Settings
  Knowledge
    Documents
    Indexing Status
    Knowledge Gaps
    Add Approved Answer
  Conversations
  Usage
  Members
  Widget Installation
  Subscription Status (read-only)
  Account / Sign Out
```

## 3. Provider navigation

```text
Provider App
  Provider Login / MFA
  Client Registry
    Client Detail
      Deployment Status
      Subscription
      Suspend / Restore
      Audited Client Operations
  Provider Audit
  Provider Staff / Roles
```

Provider access to client feature screens must use an approved provider
operation/delegation mechanism. Do not silently mint a client session or
impersonate a client in the browser.

## 4. Key screens

### Knowledge gaps

- List frequent unanswered questions with count, most recent occurrence,
  supported language, and allowed aggregate metadata.
- Support search, date range, and pagination if the backend supports them.
- Selecting an item opens its permitted context, not an unrestricted raw-chat
  transcript.
- "Add approved answer" opens an editor with an explicit publish/index action.
- Clearly distinguish draft, submitted, indexing, ready, and failed states.
- Do not say the bot has learned the answer until indexing/activation succeeds.

### Widget installation

- Show the currently supported script attributes and copyable snippet.
- Clearly label all included values as public.
- Explain that the key/slug identifies a bot and is not an admin credential.
- Show rotation/revocation controls only when the backend supports them.

### Subscription

- Show plan, status, start/end dates, and last-updated source where available.
- Client mode has no edit/suspend controls.
- Unknown or stale status is visually distinct from active.

## 5. Common states

Every data screen supports:

- Loading
- Empty
- Ready
- Permission denied
- Session expired / MFA required
- Conflict / stale update
- Rate or quota limit
- Backend unavailable
- Partial data, if the backend explicitly reports it

Errors must not be disguised as empty data or successful mutations.

## 6. Accessibility and presentation

- Keyboard-operable navigation, dialogs, tables, forms, and copy controls.
- Visible focus and meaningful labels.
- Announce async status changes without repeatedly reading large content.
- Confirm destructive operations and show their scope.
- Avoid rendering untrusted chat/document content as HTML.
- Use pagination/virtualization for large conversation and gap lists.
