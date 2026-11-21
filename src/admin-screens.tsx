import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantRole } from './client-auth'
import {
  addDocumentVersion,
  approvedAnswerBody,
  approvedAnswerTitle,
  buildSettingsPatch,
  completeUpload,
  deleteConversation,
  deleteDocument,
  documentStatus,
  downloadOriginalUrl,
  draftFromSettings,
  emptySettingsDraft,
  errorMessage,
  getSettings,
  jobSummary,
  knowledgeGaps,
  listBots,
  listConversations,
  listMembers,
  listMessageSources,
  listMessages,
  mediaTypeForFile,
  reindexDocument,
  registerDocument,
  retryVersion,
  setBotEnabled,
  shortId,
  suggestCoveringDocuments,
  toISODate,
  toTenantError,
  updateSettings,
  uploadKnowledgeFile,
  usageSummary,
} from './tenant-api'
import type {
  Bot,
  BotSettings,
  ConversationRow,
  DocumentStatusRow,
  EditableSettingsKey,
  JobSummaryRow,
  KnowledgeGapRow,
  MemberRow,
  MessageRow,
  TenantError,
  UsageRow,
} from './tenant-api'

function useReload(): [number, () => void] {
  const [generation, setGeneration] = useState(0)
  return [generation, () => setGeneration((value) => value + 1)]
}

function Loading({ label }: { label: string }) {
  return (
    <p role="status" className="notice">
      {label}
    </p>
  )
}

function ErrorBox({ error, onRetry }: { error: TenantError; onRetry?: () => void }) {
  return (
    <div role="alert" className="error-box">
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="notice">{text}</p>
}

function BotPicker({
  bots,
  value,
  onChange,
  label = 'Bot',
}: {
  bots: Bot[]
  value: string
  onChange: (id: string) => void
  label?: string
}) {
  if (bots.length <= 1) return null
  return (
    <div className="toolbar">
      <label htmlFor="bot-picker">{label}</label>
      <select id="bot-picker" value={value} onChange={(event) => onChange(event.target.value)}>
        {bots.map((bot) => (
          <option key={bot.id} value={bot.id}>
            {bot.slug}
            {bot.display_name ? ' — ' + bot.display_name : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

function useBotList(client: SupabaseClient, reloadKey: number) {
  const [bots, setBots] = useState<Bot[] | null>(null)
  const [error, setError] = useState<TenantError | null>(null)
  useEffect(() => {
    let cancelled = false
    setBots(null)
    setError(null)
    listBots(client)
      .then((rows) => {
        if (!cancelled) setBots(rows)
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(toTenantError(failure))
      })
    return () => {
      cancelled = true
    }
  }, [client, reloadKey])
  return { bots, error }
}

function useSelectedBot(bots: Bot[] | null, selected: string, setSelected: (id: string) => void): Bot | null {
  useEffect(() => {
    if (!selected && bots && bots.length > 0) setSelected(bots[0]?.id ?? '')
  }, [bots, selected, setSelected])
  return bots?.find((bot) => bot.id === selected) ?? bots?.[0] ?? null
}

function formatDateTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatDate(value: string): string {
  return value || '—'
}

export function OverviewScreen({ client }: { client: SupabaseClient }) {
  const [reloadKey, reload] = useReload()
  const { bots, error } = useBotList(client, reloadKey)
  const [documents, setDocuments] = useState<DocumentStatusRow[] | null>(null)
  const [documentsError, setDocumentsError] = useState<TenantError | null>(null)
  const [jobs, setJobs] = useState<JobSummaryRow[] | null>(null)
  const [jobsError, setJobsError] = useState<TenantError | null>(null)
  const [usage, setUsage] = useState<UsageRow[] | null>(null)
  const [usageError, setUsageError] = useState<TenantError | null>(null)

  useEffect(() => {
    if (!bots || bots.length === 0) return
    let cancelled = false
    setDocuments(null)
    setDocumentsError(null)
    Promise.all(bots.map((bot) => documentStatus(client, bot.id, 200, 0)))
      .then((pages) => {
        if (!cancelled) setDocuments(pages.flat())
      })
      .catch((failure: unknown) => {
        if (!cancelled) setDocumentsError(toTenantError(failure))
      })
    jobSummary(client)
      .then((rows) => {
        if (!cancelled) setJobs(rows)
      })
      .catch((failure: unknown) => {
        if (!cancelled) setJobsError(toTenantError(failure))
      })
    const to = new Date()
    const from = new Date(to.getTime() - 6 * 24 * 3600 * 1000)
    usageSummary(client, toISODate(from), toISODate(to))
      .then((rows) => {
        if (!cancelled) setUsage(rows)
      })
      .catch((failure: unknown) => {
        if (!cancelled) setUsageError(toTenantError(failure))
      })
    return () => {
      cancelled = true
    }
  }, [client, bots])

  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!bots) return <Loading label="Loading workspace overview…" />

  const ready = documents?.filter((item) => item.status === 'ready').length ?? null
  const indexing = documents?.filter((item) => item.status === 'indexing').length ?? null
  const events = usage?.reduce((sum, row) => sum + row.event_count, 0) ?? null

  return (
    <>
      <div className="screen-heading">
        <h1>Overview</h1>
        <p>Live workspace state from the tenant backend.</p>
      </div>
      <dl className="metrics">
        <div>
          <dt>Bots</dt>
          <dd>{bots.length}</dd>
        </div>
        <div>
          <dt>Documents</dt>
          <dd>{documents ? documents.length : '…'}</dd>
        </div>
        <div>
          <dt>Ready</dt>
          <dd>{ready ?? '…'}</dd>
        </div>
        <div>
          <dt>Indexing</dt>
          <dd>{indexing ?? '…'}</dd>
        </div>
        <div>
          <dt>Events (7 days)</dt>
          <dd>{events ?? '…'}</dd>
        </div>
      </dl>
      {bots.length === 0 && <Empty text="No bots are registered for this workspace." />}
      {bots.length > 0 && (
        <section className="panel" aria-labelledby="bots-heading">
          <h2 id="bots-heading">Bots</h2>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Slug</th>
                  <th scope="col">Display name</th>
                  <th scope="col">Enabled</th>
                  <th scope="col">Settings version</th>
                </tr>
              </thead>
              <tbody>
                {bots.map((bot) => (
                  <tr key={bot.id}>
                    <td>{bot.slug}</td>
                    <td>{bot.display_name ?? '—'}</td>
                    <td>{bot.enabled ? 'Yes' : 'No'}</td>
                    <td>{bot.settings_version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="panel" aria-labelledby="jobs-heading">
        <h2 id="jobs-heading">Indexing jobs</h2>
        {jobsError && <ErrorBox error={jobsError} />}
        {!jobsError && !jobs && <Loading label="Loading job status…" />}
        {!jobsError && jobs && jobs.length === 0 && <Empty text="No jobs have been recorded." />}
        {!jobsError && jobs && jobs.length > 0 && (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">State</th>
                  <th scope="col">Count</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.job_type + ':' + job.job_state}>
                    <td>{job.job_type}</td>
                    <td>{job.job_state}</td>
                    <td>{job.job_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel" aria-labelledby="overview-documents-heading">
        <h2 id="overview-documents-heading">Documents</h2>
        {documentsError && <ErrorBox error={documentsError} />}
        {!documentsError && !documents && <Loading label="Loading documents…" />}
        {!documentsError && documents && documents.length === 0 && <Empty text="No documents yet." />}
        {!documentsError && documents && documents.length > 0 && (
          <ul className="document-list">
            {documents.slice(0, 10).map((item) => (
              <li key={item.document_id}>
                <span>{item.title}</span>
                <span className="status" data-status={item.status}>
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {usageError && (
        <section className="panel" aria-labelledby="usage-heading">
          <h2 id="usage-heading">Usage</h2>
          <ErrorBox error={usageError} />
        </section>
      )}
    </>
  )
}

const SETTINGS_FIELDS: { key: EditableSettingsKey; label: string; hint: string; multiline?: boolean }[] = [
  { key: 'display_name', label: 'Display name', hint: 'Required before first publish. Up to 80 characters.' },
  { key: 'greeting', label: 'Greeting', hint: 'Up to 500 characters.' },
  { key: 'tone', label: 'Tone', hint: 'Single line, up to 500 characters.', multiline: true },
  { key: 'scope', label: 'Scope', hint: 'Up to 2000 characters.', multiline: true },
  { key: 'suggested_questions', label: 'Suggested questions', hint: 'One question per line, up to 6 items of 200 characters.' },
  { key: 'primary_color', label: 'Primary color', hint: 'Hex color such as #123456.' },
  { key: 'position', label: 'Position', hint: 'bottom-right or bottom-left.' },
  { key: 'privacy_url', label: 'Privacy URL', hint: 'Public https URL, or blank.' },
  { key: 'supported_languages', label: 'Supported languages', hint: 'Comma-separated tags such as en, es. Required before first publish.' },
  { key: 'escalation_label', label: 'Escalation label', hint: 'Up to 60 characters.' },
  { key: 'escalation_messages', label: 'Escalation messages (JSON)', hint: 'Object mapping each supported language to its message.' },
  { key: 'contact_email', label: 'Contact email', hint: 'Or blank.' },
  { key: 'contact_phone', label: 'Contact phone', hint: 'E.164 format such as +15551234567, or blank.' },
  { key: 'contact_whatsapp_url', label: 'WhatsApp URL', hint: 'Public https URL, or blank.' },
  { key: 'contact_page_url', label: 'Contact page URL', hint: 'Public https URL, or blank.' },
  { key: 'business_hours', label: 'Business hours (JSON)', hint: 'Optional object such as {"mon-fri": "09:00-17:00"}.' },
  { key: 'timezone', label: 'Timezone', hint: 'IANA name such as America/New_York. Required when business hours are set.' },
]

export function SettingsScreen({ client, role }: { client: SupabaseClient; role: TenantRole }) {
  const [reloadKey, reload] = useReload()
  const { bots, error: botsError } = useBotList(client, reloadKey)
  const [selected, setSelected] = useState('')
  const bot = useSelectedBot(bots, selected, setSelected)
  const [settings, setSettings] = useState<BotSettings | null>(null)
  const [settingsError, setSettingsError] = useState<TenantError | null>(null)
  const [draft, setDraft] = useState(emptySettingsDraft())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<TenantError | null>(null)
  const [saveNotice, setSaveNotice] = useState('')
  const canMutate = role === 'owner' || role === 'admin'

  useEffect(() => {
    if (!bot) return
    let cancelled = false
    setSettings(null)
    setSettingsError(null)
    setSaveNotice('')
    getSettings(client, bot.id)
      .then((row) => {
        if (cancelled) return
        setSettings(row)
        setDraft(draftFromSettings(row))
      })
      .catch((failure: unknown) => {
        if (!cancelled) setSettingsError(toTenantError(failure))
      })
    return () => {
      cancelled = true
    }
  }, [client, bot])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!bot || !settings || saving) return
    setSaveError(null)
    setSaveNotice('')
    let patch: Record<string, unknown> | null
    try {
      patch = buildSettingsPatch(settings, draft)
    } catch (failure) {
      setSaveError(toTenantError(failure))
      return
    }
    if (!patch) {
      setSaveNotice('No changes to save.')
      return
    }
    setSaving(true)
    try {
      const version = await updateSettings(client, bot.id, settings.settings_version, patch)
      const refreshed = await getSettings(client, bot.id)
      setSettings({ ...refreshed, settings_version: version })
      setDraft(draftFromSettings({ ...refreshed, settings_version: version }))
      setSaveNotice('Settings saved as version ' + version + '.')
    } catch (failure) {
      const tenantError = toTenantError(failure)
      if (tenantError.kind === 'stale') {
        try {
          const refreshed = await getSettings(client, bot.id)
          setSettings(refreshed)
          setSaveNotice('The workspace is now at version ' + refreshed.settings_version + '. Your edits are preserved below — review and save again.')
        } catch {
          // Keep the stale form so no edits are lost.
        }
      }
      setSaveError(tenantError)
    } finally {
      setSaving(false)
    }
  }

  async function toggleEnabled() {
    if (!bot || !settings || saving) return
    const next = !settings.enabled
    const confirmed = window.confirm(
      next
        ? 'Enable bot ' + bot.slug + '? It becomes publicly servable only when its settings pass every publish rule.'
        : 'Disable bot ' + bot.slug + '? This stops new visitor work immediately.',
    )
    if (!confirmed) return
    setSaveError(null)
    setSaveNotice('')
    setSaving(true)
    try {
      const version = await setBotEnabled(client, bot.id, settings.settings_version, next)
      const refreshed = await getSettings(client, bot.id)
      setSettings({ ...refreshed, settings_version: version })
      setDraft(draftFromSettings({ ...refreshed, settings_version: version }))
      setSaveNotice(next ? 'Bot enabled.' : 'Bot disabled.')
    } catch (failure) {
      setSaveError(toTenantError(failure))
    } finally {
      setSaving(false)
    }
  }

  if (botsError) return <ErrorBox error={botsError} onRetry={reload} />
  if (!bots || !bot) return <Loading label="Loading bots…" />

  return (
    <>
      <div className="screen-heading">
        <h1>Bot settings</h1>
        <p>Server-authoritative settings with stale-version protection.</p>
      </div>
      <BotPicker bots={bots} value={bot.id} onChange={setSelected} />
      {settingsError && <ErrorBox error={settingsError} onRetry={reload} />}
      {!settingsError && !settings && <Loading label="Loading settings…" />}
      {settings && (
        <>
          <section className="panel" aria-labelledby="enablement-heading">
            <div className="panel-heading">
              <h2 id="enablement-heading">Availability</h2>
              <span className="status" data-status={settings.enabled ? 'Ready' : 'Disabled'}>
                {settings.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="hint">
              Version {settings.settings_version}
              {settings.max_bytes != null && ' · Upload limit ' + settings.max_bytes + ' bytes'}
              {settings.max_pages != null && ' · ' + settings.max_pages + ' pages'}
            </p>
            {canMutate ? (
              <button type="button" disabled={saving} onClick={() => void toggleEnabled()}>
                {settings.enabled ? 'Disable bot' : 'Enable bot'}
              </button>
            ) : (
              <p className="hint">Analysts can read settings but cannot change availability.</p>
            )}
          </section>
          <section className="panel" aria-labelledby="settings-form-heading">
            <h2 id="settings-form-heading">Editable settings</h2>
            {!canMutate && <p className="hint">Analysts have read-only access to these values.</p>}
            <form onSubmit={(event) => void save(event)}>
              <div className="form-grid">
                {SETTINGS_FIELDS.map((field) => (
                  <div key={field.key} className="field">
                    <label htmlFor={'settings-' + field.key}>{field.label}</label>
                    {field.multiline || field.key === 'escalation_messages' || field.key === 'business_hours' ? (
                      <textarea
                        id={'settings-' + field.key}
                        value={draft[field.key]}
                        rows={field.key === 'tone' || field.key === 'scope' ? 3 : 4}
                        disabled={!canMutate || saving}
                        onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                      />
                    ) : (
                      <input
                        id={'settings-' + field.key}
                        value={draft[field.key]}
                        disabled={!canMutate || saving}
                        onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                      />
                    )}
                    <p className="hint">{field.hint}</p>
                  </div>
                ))}
              </div>
              {saveError && <ErrorBox error={saveError} />}
              {saveNotice && (
                <p role="status" className="notice">
                  {saveNotice}
                </p>
              )}
              {canMutate && (
                <button disabled={saving}>{saving ? 'Saving…' : 'Save settings (version ' + settings.settings_version + ')'}</button>
              )}
            </form>
          </section>
        </>
      )}
    </>
  )
}

export function DocumentsScreen({ client, role }: { client: SupabaseClient; role: TenantRole }) {
  const [reloadKey, reload] = useReload()
  const { bots, error: botsError } = useBotList(client, reloadKey)
  const [selected, setSelected] = useState('')
  const bot = useSelectedBot(bots, selected, setSelected)
  const [rows, setRows] = useState<DocumentStatusRow[] | null>(null)
  const [rowsError, setRowsError] = useState<TenantError | null>(null)
  const [offset, setOffset] = useState(0)
  const [actionNotice, setActionNotice] = useState('')
  const [actionError, setActionError] = useState<TenantError | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [policy, setPolicy] = useState('excluded')
  const [uploading, setUploading] = useState(false)
  const canMutate = role === 'owner' || role === 'admin'
  const limit = 50

  useEffect(() => {
    setOffset(0)
  }, [selected])

  useEffect(() => {
    if (!bot) return
    let cancelled = false
    setRows(null)
    setRowsError(null)
    documentStatus(client, bot.id, limit, offset)
      .then((page) => {
        if (!cancelled) setRows(page)
      })
      .catch((failure: unknown) => {
        if (!cancelled) setRowsError(toTenantError(failure))
      })
    return () => {
      cancelled = true
    }
  }, [client, bot, offset, reloadKey])

  async function runAction(key: string, action: () => Promise<unknown>, confirmText?: string) {
    if (busy) return
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(key)
    setActionError(null)
    setActionNotice('')
    try {
      await action()
      setActionNotice('Action completed.')
      reload()
    } catch (failure) {
      setActionError(toTenantError(failure))
    } finally {
      setBusy(null)
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!bot || uploading) return
    const input = event.currentTarget.querySelector('input[type="file"]') as HTMLInputElement | null
    const file = input?.files?.[0]
    setActionError(null)
    setActionNotice('')
    if (!file) {
      setActionError(toTenantError({ code: '22023', message: 'Choose a file to upload' }))
      return
    }
    const mediaType = mediaTypeForFile(file)
    if (!mediaType) {
      setActionError(toTenantError({ code: '22023', message: 'Only PDF, Markdown, or plain text files are supported' }))
      return
    }
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setActionError(toTenantError({ code: '22023', message: 'Title is required' }))
      return
    }
    setUploading(true)
    try {
      const registered = await registerDocument(client, bot.id, trimmedTitle, mediaType, file.size, policy)
      await uploadKnowledgeFile(client, registered.storage_path, file, mediaType)
      await completeUpload(client, registered.version_id)
      setTitle('')
      if (input) input.value = ''
      setActionNotice('Upload queued for indexing.')
      reload()
    } catch (failure) {
      setActionError(toTenantError(failure))
    } finally {
      setUploading(false)
    }
  }

  async function uploadNewVersion(documentId: string, documentTitle: string, file: File) {
    const mediaType = mediaTypeForFile(file)
    if (!mediaType) throw toTenantError({ code: '22023', message: 'Only PDF, Markdown, or plain text files are supported' })
    const added = await addDocumentVersion(client, documentId, mediaType, file.size)
    await uploadKnowledgeFile(client, added.storage_path, file, mediaType)
    await completeUpload(client, added.version_id)
    void documentTitle
  }

  if (botsError) return <ErrorBox error={botsError} onRetry={reload} />
  if (!bots || !bot) return <Loading label="Loading documents…" />

  return (
    <>
      <div className="screen-heading">
        <h1>Documents</h1>
        <p>Upload, track, retry, re-index, and delete approved knowledge. Activation is confirmed by the backend.</p>
      </div>
      <BotPicker bots={bots} value={bot.id} onChange={setSelected} />
      {actionError && <ErrorBox error={actionError} />}
      {actionNotice && (
        <p role="status" className="notice">
          {actionNotice}
        </p>
      )}
      {canMutate && (
        <section className="panel" aria-labelledby="upload-heading">
          <h2 id="upload-heading">Upload a document</h2>
          <form onSubmit={(event) => void upload(event)}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="document-title">Title</label>
                <input id="document-title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="document-file">File (PDF, Markdown, or plain text)</label>
                <input id="document-file" type="file" accept=".pdf,.md,.markdown,.txt" />
              </div>
              <div className="field">
                <label htmlFor="document-policy">Disclosure</label>
                <select id="document-policy" value={policy} onChange={(event) => setPolicy(event.target.value)}>
                  <option value="excluded">Excluded</option>
                  <option value="public_answer">Public answer</option>
                </select>
                <p className="hint">Excluded documents are never used in public answers.</p>
              </div>
            </div>
            <button disabled={uploading}>{uploading ? 'Uploading…' : 'Register, upload, and queue indexing'}</button>
          </form>
        </section>
      )}
      <section className="panel" aria-labelledby="document-list-heading">
        <div className="panel-heading">
          <h2 id="document-list-heading">Document status</h2>
          <div className="row-actions">
            <button type="button" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - limit))}>
              Previous
            </button>
            <button type="button" disabled={!rows || rows.length < limit} onClick={() => setOffset((value) => value + limit)}>
              Next
            </button>
            <button type="button" onClick={reload}>
              Refresh
            </button>
          </div>
        </div>
        {rowsError && <ErrorBox error={rowsError} onRetry={reload} />}
        {!rowsError && !rows && <Loading label="Loading document status…" />}
        {!rowsError && rows && rows.length === 0 && <Empty text="No documents yet." />}
        {!rowsError && rows && rows.length > 0 && (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Status</th>
                  <th scope="col">Latest</th>
                  <th scope="col">Progress</th>
                  <th scope="col">Failure</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.document_id}>
                    <td>{row.title}</td>
                    <td>
                      <span className="status" data-status={row.status}>
                        {row.status}
                      </span>
                    </td>
                    <td>{row.latest_version_number != null ? 'v' + row.latest_version_number + ' · ' + (row.latest_version_status ?? '—') : '—'}</td>
                    <td>
                      {row.batches_done != null || row.batches_total != null
                        ? (row.batches_done ?? '—') + ' / ' + (row.batches_total ?? '—')
                        : '—'}
                    </td>
                    <td>{row.failure_code ?? '—'}</td>
                    <td>
                      <div className="row-actions">
                        {canMutate && row.latest_version_id && (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() =>
                              void runAction('retry:' + row.document_id, () => retryVersion(client, row.latest_version_id as string))
                            }
                          >
                            Retry
                          </button>
                        )}
                        {canMutate && row.active_version_id && (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void runAction('reindex:' + row.document_id, () => reindexDocument(client, row.document_id))}
                          >
                            Re-index
                          </button>
                        )}
                        {canMutate && row.latest_version_id && (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() =>
                              void runAction('download:' + row.document_id, async () => {
                                const url = await downloadOriginalUrl(client, row.latest_version_id as string)
                                window.open(url, '_blank', 'noopener')
                              })
                            }
                          >
                            Original
                          </button>
                        )}
                        {canMutate && (
                          <label className="file-action">
                            New version
                            <input
                              type="file"
                              accept=".pdf,.md,.markdown,.txt"
                              disabled={busy !== null}
                              onChange={(event) => {
                                const file = event.target.files?.[0]
                                event.target.value = ''
                                if (file) void runAction('version:' + row.document_id, () => uploadNewVersion(row.document_id, row.title, file))
                              }}
                            />
                          </label>
                        )}
                        {canMutate && (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() =>
                              void runAction(
                                'delete:' + row.document_id,
                                () => deleteDocument(client, row.document_id),
                                'Delete "' + row.title + '"? Its indexed knowledge is removed by the backend cleanup.',
                              )
                            }
                          >
                            Delete
                          </button>
                        )}
                        {!canMutate && <span className="hint">Read-only</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

export function IndexingScreen({ client }: { client: SupabaseClient }) {
  const [reloadKey, reload] = useReload()
  const { bots, error: botsError } = useBotList(client, reloadKey)
  const [selected, setSelected] = useState('')
  const bot = useSelectedBot(bots, selected, setSelected)
  const [jobs, setJobs] = useState<JobSummaryRow[] | null>(null)
  const [jobsError, setJobsError] = useState<TenantError | null>(null)
  const [rows, setRows] = useState<DocumentStatusRow[] | null>(null)
  const [rowsError, setRowsError] = useState<TenantError | null>(null)

  useEffect(() => {
    let cancelled = false
    setJobs(null)
    setJobsError(null)
    jobSummary(client)
      .then((result) => {
        if (!cancelled) setJobs(result)
      })
      .catch((failure: unknown) => {
        if (!cancelled) setJobsError(toTenantError(failure))
      })
    return () => {
      cancelled = true
    }
  }, [client, reloadKey])

  useEffect(() => {
    if (!bot) return
    let cancelled = false
    setRows(null)
    setRowsError(null)
    documentStatus(client, bot.id, 200, 0)
      .then((page) => {
        if (!cancelled) setRows(page)
      })
      .catch((failure: unknown) => {
        if (!cancelled) setRowsError(toTenantError(failure))
      })
    return () => {
      cancelled = true
    }
  }, [client, bot, reloadKey])

  if (botsError) return <ErrorBox error={botsError} onRetry={reload} />
  if (!bots || !bot) return <Loading label="Loading indexing status…" />
  const active = (rows ?? []).filter((row) =>
    ['indexing', 'draft', 'failed'].includes(row.status) || ['uploaded', 'extracting', 'embedding', 'failed'].includes(row.latest_version_status ?? ''),
  )

  return (
    <>
      <div className="screen-heading">
        <h1>Indexing status</h1>
        <p>Job counts and per-version progress. A new version is active only after backend activation.</p>
      </div>
      <BotPicker bots={bots} value={bot.id} onChange={setSelected} />
      <section className="panel" aria-labelledby="job-summary-heading">
        <div className="panel-heading">
          <h2 id="job-summary-heading">Job summary</h2>
          <button type="button" onClick={reload}>
            Refresh
          </button>
        </div>
        {jobsError && <ErrorBox error={jobsError} onRetry={reload} />}
        {!jobsError && !jobs && <Loading label="Loading jobs…" />}
        {!jobsError && jobs && jobs.length === 0 && <Empty text="No jobs have been recorded." />}
        {!jobsError && jobs && jobs.length > 0 && (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">State</th>
                  <th scope="col">Count</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.job_type + ':' + job.job_state}>
                    <td>{job.job_type}</td>
                    <td>{job.job_state}</td>
                    <td>{job.job_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel" aria-labelledby="active-versions-heading">
        <h2 id="active-versions-heading">Versions needing attention</h2>
        {rowsError && <ErrorBox error={rowsError} onRetry={reload} />}
        {!rowsError && !rows && <Loading label="Loading versions…" />}
        {!rowsError && rows && active.length === 0 && <Empty text="No pending or failed versions." />}
        {!rowsError && rows && active.length > 0 && (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col">Version</th>
                  <th scope="col">Status</th>
                  <th scope="col">Progress</th>
                  <th scope="col">Failure</th>
                </tr>
              </thead>
              <tbody>
                {active.map((row) => (
                  <tr key={row.document_id}>
                    <td>{row.title}</td>
                    <td>{row.latest_version_number != null ? 'v' + row.latest_version_number : '—'}</td>
                    <td>{row.latest_version_status ?? row.status}</td>
                    <td>
                      {(row.batches_done ?? '—') + ' / ' + (row.batches_total ?? '—')}
                    </td>
                    <td>{row.failure_code ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

export function ConversationsScreen({ client, role }: { client: SupabaseClient; role: TenantRole }) {
  const [reloadKey, reload] = useReload()
  const { bots, error: botsError } = useBotList(client, reloadKey)
  const [selected, setSelected] = useState('')
  const bot = useSelectedBot(bots, selected, setSelected)
  const [conversations, setConversations] = useState<ConversationRow[] | null>(null)
  const [conversationsError, setConversationsError] = useState<TenantError | null>(null)
  const [activeId, setActiveId] = useState('')
  const [messages, setMessages] = useState<MessageRow[] | null>(null)
  const [messagesError, setMessagesError] = useState<TenantError | null>(null)
  const [sources, setSources] = useState<Record<string, { label: string; excerpt: string | null }[]>>({})
  const [actionNotice, setActionNotice] = useState('')
  const [actionError, setActionError] = useState<TenantError | null>(null)
  const canMutate = role === 'owner' || role === 'admin'

  useEffect(() => {
    if (!bot) return
    let cancelled = false
    setConversations(null)
    setConversationsError(null)
    setActiveId('')
    listConversations(client, bot.id, 25)
      .then((rows) => {
        if (!cancelled) setConversations(rows)
      })
      .catch((failure: unknown) => {
        if (!cancelled) setConversationsError(toTenantError(failure))
      })
    return () => {
      cancelled = true
    }
  }, [client, bot, reloadKey])

  useEffect(() => {
    if (!activeId) {
      setMessages(null)
      setMessagesError(null)
      return
    }
    let cancelled = false
    setMessages(null)
    setMessagesError(null)
    listMessages(client, activeId)
      .then(async (rows) => {
        if (cancelled) return
        setMessages(rows)
        try {
          const refs = await listMessageSources(
            client,
            rows.filter((row) => row.role === 'assistant').map((row) => row.id),
          )
          if (!cancelled) {
            const grouped: Record<string, { label: string; excerpt: string | null }[]> = {}
            for (const ref of refs) {
              grouped[ref.message_id] = [...(grouped[ref.message_id] ?? []), { label: ref.source_label, excerpt: ref.excerpt }]
            }
            setSources(grouped)
          }
        } catch {
          if (!cancelled) setSources({})
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) setMessagesError(toTenantError(failure))
      })
    return () => {
      cancelled = true
    }
  }, [client, activeId])

  async function remove(conversation: ConversationRow) {
    if (!window.confirm('Delete conversation ' + shortId(conversation.id) + '? Messages, sources, and entries are removed.')) return
    setActionError(null)
    setActionNotice('')
    try {
      await deleteConversation(client, conversation.id)
      setActiveId('')
      setActionNotice('Conversation deleted.')
      reload()
    } catch (failure) {
      setActionError(toTenantError(failure))
    }
  }

  if (botsError) return <ErrorBox error={botsError} onRetry={reload} />
  if (!bots || !bot) return <Loading label="Loading conversations…" />

  return (
    <>
      <div className="screen-heading">
        <h1>Conversations</h1>
        <p>Only records your role is granted. Content is shown as plain text, never as HTML.</p>
      </div>
      <BotPicker bots={bots} value={bot.id} onChange={setSelected} />
      {actionError && <ErrorBox error={actionError} />}
      {actionNotice && (
        <p role="status" className="notice">
          {actionNotice}
        </p>
      )}
      <div className="two-column">
        <section className="panel" aria-labelledby="conversation-list-heading">
          <div className="panel-heading">
            <h2 id="conversation-list-heading">Recent conversations</h2>
            <button type="button" onClick={reload}>
              Refresh
            </button>
          </div>
          {conversationsError && <ErrorBox error={conversationsError} onRetry={reload} />}
          {!conversationsError && !conversations && <Loading label="Loading conversations…" />}
          {!conversationsError && conversations && conversations.length === 0 && <Empty text="No conversations yet." />}
          {!conversationsError && conversations && conversations.length > 0 && (
            <ul className="document-list">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    className="link-button"
                    aria-current={conversation.id === activeId ? 'true' : undefined}
                    onClick={() => setActiveId(conversation.id)}
                  >
                    {shortId(conversation.id)} · {conversation.status} · {formatDateTime(conversation.last_message_at ?? conversation.created_at)}
                  </button>
                  {canMutate && (
                    <button type="button" onClick={() => void remove(conversation)}>
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel" aria-labelledby="message-list-heading" aria-live="polite">
          <h2 id="message-list-heading">Messages</h2>
          {!activeId && <Empty text="Select a conversation to read its messages." />}
          {activeId && messagesError && <ErrorBox error={messagesError} />}
          {activeId && !messagesError && !messages && <Loading label="Loading messages…" />}
          {activeId && !messagesError && messages && messages.length === 0 && <Empty text="No messages in this conversation." />}
          {activeId && !messagesError && messages && messages.length > 0 && (
            <ol className="message-list">
              {messages.map((message) => (
                <li key={message.id} className="message" data-role={message.role}>
                  <p className="message-meta">
                    <strong>{message.role}</strong> · {formatDateTime(message.created_at)}
                    {message.handoff_reason ? ' · ' + message.handoff_reason : ''}
                    {message.status !== 'complete' ? ' · ' + message.status : ''}
                  </p>
                  <p className="message-content">{message.content}</p>
                  {(sources[message.id] ?? []).length > 0 && (
                    <ul className="source-list">
                      {(sources[message.id] ?? []).map((source, index) => (
                        <li key={message.id + ':' + index}>
                          {source.label}
                          {source.excerpt ? ' — ' + source.excerpt.slice(0, 160) : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
          {activeId && !messagesError && messages && messages.length === 200 && (
            <p className="hint">Showing the first 200 messages. Narrow the conversation before reviewing more.</p>
          )}
        </section>
      </div>
    </>
  )
}

export function UsageScreen({ client }: { client: SupabaseClient }) {
  const [to, setTo] = useState(() => toISODate(new Date()))
  const [from, setFrom] = useState(() => toISODate(new Date(Date.now() - 29 * 24 * 3600 * 1000)))
  const [rows, setRows] = useState<UsageRow[] | null>(null)
  const [error, setError] = useState<TenantError | null>(null)
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setFormError('')
    setError(null)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      setFormError('Use a valid from/to date range.')
      return
    }
    const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
    if (days > 92) {
      setFormError('The range must not exceed 92 days.')
      return
    }
    setLoading(true)
    try {
      setRows(await usageSummary(client, from, to))
    } catch (failure) {
      setError(toTenantError(failure))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totals = (rows ?? []).reduce(
    (sum, row) => ({
      events: sum.events + row.event_count,
      input: sum.input + row.input_tokens,
      output: sum.output + row.output_tokens,
      cost: sum.cost + row.estimated_cost,
    }),
    { events: 0, input: 0, output: 0, cost: 0 },
  )

  return (
    <>
      <div className="screen-heading">
        <h1>Usage</h1>
        <p>Daily aggregates for the selected range. Ranges are limited to 92 days.</p>
      </div>
      <section className="panel" aria-labelledby="usage-filter-heading">
        <h2 id="usage-filter-heading">Range</h2>
        <form onSubmit={(event) => void load(event)}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="usage-from">From</label>
              <input id="usage-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="usage-to">To</label>
              <input id="usage-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
          </div>
          {formError && (
            <p role="alert" className="field-error">
              {formError}
            </p>
          )}
          <button disabled={loading}>{loading ? 'Loading…' : 'Load usage'}</button>
        </form>
      </section>
      <section className="panel" aria-labelledby="usage-results-heading">
        <h2 id="usage-results-heading">Daily usage</h2>
        {error && <ErrorBox error={error} />}
        {!error && !rows && <Loading label="Loading usage…" />}
        {!error && rows && rows.length === 0 && <Empty text="No usage in this range." />}
        {!error && rows && rows.length > 0 && (
          <>
            <p className="hint">
              {totals.events} events · {totals.input} input tokens · {totals.output} output tokens · estimated cost{' '}
              {totals.cost.toFixed(6)}
            </p>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Operation</th>
                    <th scope="col">Events</th>
                    <th scope="col">Input</th>
                    <th scope="col">Output</th>
                    <th scope="col">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((row, index) => (
                    <tr key={row.usage_day + ':' + row.bot_id + ':' + row.operation + ':' + index}>
                      <td>{formatDate(row.usage_day)}</td>
                      <td>{row.operation}</td>
                      <td>{row.event_count}</td>
                      <td>{row.input_tokens}</td>
                      <td>{row.output_tokens}</td>
                      <td>{row.estimated_cost.toFixed(6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 200 && <p className="hint">Showing the first 200 rows. Narrow the range for the full detail.</p>}
          </>
        )}
      </section>
    </>
  )
}

export function MembersScreen({ client }: { client: SupabaseClient }) {
  const [reloadKey, reload] = useReload()
  const [members, setMembers] = useState<MemberRow[] | null>(null)
  const [error, setError] = useState<TenantError | null>(null)
  const firstLoad = useRef(true)

  useEffect(() => {
    let cancelled = false
    if (firstLoad.current) {
      firstLoad.current = false
    } else {
      setMembers(null)
    }
    setError(null)
    listMembers(client)
      .then((rows) => {
        if (!cancelled) setMembers(rows)
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(toTenantError(failure))
      })
    return () => {
      cancelled = true
    }
  }, [client, reloadKey])

  return (
    <>
      <div className="screen-heading">
        <h1>Members</h1>
        <p>Active workspace membership. Invitations and role changes are deferred pending a reviewed contract.</p>
      </div>
      <section className="panel" aria-labelledby="member-list-heading">
        <div className="panel-heading">
          <h2 id="member-list-heading">Member list</h2>
          <button type="button" onClick={reload}>
            Refresh
          </button>
        </div>
        {error && <ErrorBox error={error} onRetry={reload} />}
        {!error && !members && <Loading label="Loading members…" />}
        {!error && members && members.length === 0 && <Empty text="No members found." />}
        {!error && members && members.length > 0 && (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Role</th>
                  <th scope="col">Active</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.user_id}>
                    <td>{member.label ?? shortId(member.user_id)}</td>
                    <td>{member.role}</td>
                    <td>{member.active ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

export function KnowledgeGapsScreen({ client, role }: { client: SupabaseClient; role: TenantRole }) {
  const [reloadKey, reload] = useReload()
  const { bots, error: botsError } = useBotList(client, reloadKey)
  useEffect(() => {
    document.title = 'Knowledge gaps | RAGbot Admin'
  }, [])
  const [targetBotId, setTargetBotId] = useState('')
  const targetBot = useSelectedBot(bots, targetBotId, setTargetBotId)
  const [to, setTo] = useState(() => toISODate(new Date()))
  const [from, setFrom] = useState(() => toISODate(new Date(Date.now() - 29 * 24 * 3600 * 1000)))
  const [limit, setLimit] = useState(50)
  const [rows, setRows] = useState<KnowledgeGapRow[] | null>(null)
  const [error, setError] = useState<TenantError | null>(null)
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState('')
  const [documents, setDocuments] = useState<DocumentStatusRow[] | null>(null)
  const [title, setTitle] = useState('')
  const [answer, setAnswer] = useState('')
  const [approved, setApproved] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<TenantError | null>(null)
  const [submitNotice, setSubmitNotice] = useState('')
  const canMutate = role === 'owner' || role === 'admin'

  async function load(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setFormError('')
    setError(null)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      setFormError('Use a valid from/to date range.')
      return
    }
    const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
    if (days > 92) {
      setFormError('The range must not exceed 92 days.')
      return
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      setFormError('The limit must be between 1 and 200.')
      return
    }
    setLoading(true)
    try {
      setRows(await knowledgeGaps(client, from, to, limit))
      setSelectedKey('')
      setSubmitNotice('')
    } catch (failure) {
      setError(toTenantError(failure))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey])

  useEffect(() => {
    if (!targetBot) return
    let cancelled = false
    documentStatus(client, targetBot.id, 200, 0)
      .then((page) => {
        if (!cancelled) setDocuments(page)
      })
      .catch(() => {
        if (!cancelled) setDocuments(null)
      })
    return () => {
      cancelled = true
    }
  }, [client, targetBot])

  const filtered = (rows ?? []).filter((row) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return row.question.toLowerCase().includes(query) || row.handoff_reason.toLowerCase().includes(query)
  })
  const selected = filtered.find((row) => row.handoff_reason + '|' + row.question === selectedKey) ?? null
  const covering = selected ? suggestCoveringDocuments(documents ?? [], selected.question) : []

  function select(row: KnowledgeGapRow) {
    const key = row.handoff_reason + '|' + row.question
    setSelectedKey(key)
    setTitle(approvedAnswerTitle(row.question))
    setAnswer('')
    setApproved(false)
    setSubmitError(null)
    setSubmitNotice('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !targetBot || submitting) return
    setSubmitError(null)
    setSubmitNotice('')
    if (title.trim() === '') {
      setSubmitError(toTenantError({ code: '22023', message: 'Title is required' }))
      return
    }
    if (answer.trim() === '') {
      setSubmitError(toTenantError({ code: '22023', message: 'An approved answer is required' }))
      return
    }
    if (!approved) {
      setSubmitError(toTenantError({ code: '22023', message: 'Confirm human approval before submitting' }))
      return
    }
    setSubmitting(true)
    try {
      const body = approvedAnswerBody({
        question: selected.question,
        handoffReason: selected.handoff_reason,
        occurrences: selected.occurrences,
        lastSeen: selected.last_seen,
        answer,
      })
      const file = new File([body], 'approved-answer.md', { type: 'text/markdown' })
      const registered = await registerDocument(client, targetBot.id, title.trim(), 'text/markdown', file.size, 'public_answer')
      await uploadKnowledgeFile(client, registered.storage_path, file, 'text/markdown')
      await completeUpload(client, registered.version_id)
      setSubmitNotice('Upload queued for indexing as "' + title.trim() + '". Track activation in Documents and Indexing status. It is not retrievable until the backend confirms activation.')
      setAnswer('')
      setApproved(false)
    } catch (failure) {
      setSubmitError(toTenantError(failure))
    } finally {
      setSubmitting(false)
    }
  }

  if (botsError) return <ErrorBox error={botsError} onRetry={reload} />

  return (
    <>
      <div className="screen-heading">
        <h1>Knowledge gaps</h1>
        <p>Recurring unanswered questions. Approved answers become ordinary Markdown documents and are retrievable only after backend activation.</p>
      </div>
      <section className="panel" aria-labelledby="gaps-filter-heading">
        <h2 id="gaps-filter-heading">Range</h2>
        <form onSubmit={(event) => void load(event)}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="gaps-from">From</label>
              <input id="gaps-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="gaps-to">To</label>
              <input id="gaps-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="gaps-limit">Limit (1–200)</label>
              <input
                id="gaps-limit"
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="gaps-search">Search</label>
              <input id="gaps-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by question or reason" />
            </div>
          </div>
          {formError && (
            <p role="alert" className="field-error">
              {formError}
            </p>
          )}
          <button disabled={loading}>{loading ? 'Loading…' : 'Load gaps'}</button>
        </form>
      </section>
      <section className="panel" aria-labelledby="gaps-results-heading">
        <h2 id="gaps-results-heading">Recurring questions</h2>
        {error && <ErrorBox error={error} onRetry={() => void load()} />}
        {!error && !rows && <Loading label="Loading knowledge gaps…" />}
        {!error && rows && filtered.length === 0 && <Empty text="No knowledge gaps in this range." />}
        {!error && rows && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Count</th>
                  <th scope="col">Last seen</th>
                  <th scope="col">Review</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((row) => {
                  const key = row.handoff_reason + '|' + row.question
                  return (
                    <tr key={key}>
                      <td>{row.question}</td>
                      <td>{row.handoff_reason}</td>
                      <td>{row.occurrences}</td>
                      <td>{row.last_seen ? formatDateTime(row.last_seen) : '—'}</td>
                      <td>
                        <button type="button" aria-current={key === selectedKey ? 'true' : undefined} onClick={() => select(row)}>
                          Select
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <section className="panel" aria-labelledby="gap-detail-heading" aria-live="polite">
          <h2 id="gap-detail-heading">Review selected gap</h2>
          <p className="hint">
            {selected.occurrences}× · {selected.handoff_reason} · last seen {selected.last_seen ? formatDateTime(selected.last_seen) : '—'}
          </p>
          <p>{selected.question}</p>
          {covering.length > 0 && (
            <p className="hint">Possible covering documents (heuristic title match, not a backend link): {covering.map((doc) => doc.title).join('; ')}</p>
          )}
          {!canMutate && <p className="hint">Analysts can review gaps but cannot submit approved answers.</p>}
          {canMutate && (
            <form onSubmit={(event) => void submit(event)}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="gap-target-bot">Target bot</label>
                  <select id="gap-target-bot" value={targetBot?.id ?? ''} onChange={(event) => setTargetBotId(event.target.value)}>
                    {(bots ?? []).map((bot) => (
                      <option key={bot.id} value={bot.id}>
                        {bot.slug}
                        {bot.display_name ? ' — ' + bot.display_name : ''}
                      </option>
                    ))}
                  </select>
                  <p className="hint">Approved answers are stored with disclosure “public answer” so future retrieval can cite them.</p>
                </div>
                <div className="field">
                  <label htmlFor="gap-answer-title">Document title</label>
                  <input id="gap-answer-title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="gap-answer-body">Approved answer (Markdown)</label>
                <textarea id="gap-answer-body" rows={8} value={answer} onChange={(event) => setAnswer(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="gap-approved">
                  <input id="gap-approved" type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />
                  {' '}Human review complete — submit as approved knowledge
                </label>
              </div>
              {submitError && <ErrorBox error={submitError} />}
              {submitNotice && (
                <p role="status" className="notice">
                  {submitNotice}
                </p>
              )}
              <button disabled={submitting || !targetBot}>{submitting ? 'Submitting…' : 'Submit approved answer'}</button>
            </form>
          )}
        </section>
      )}
    </>
  )
}
