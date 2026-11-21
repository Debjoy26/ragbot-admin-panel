import type { SupabaseClient } from '@supabase/supabase-js'

export type TenantErrorKind =
  | 'invalid-input'
  | 'permission'
  | 'mfa-required'
  | 'forbidden'
  | 'stale'
  | 'too-large'
  | 'quota'
  | 'invalid-settings'
  | 'missing-policy'
  | 'not-found'
  | 'upload-missing'
  | 'disabled'
  | 'unavailable'
  | 'unknown'

export type TenantError = {
  kind: TenantErrorKind
  message: string
  code?: string
}

const KIND_BY_CODE: Record<string, TenantErrorKind> = {
  '22023': 'invalid-input',
  '42501': 'permission',
  RB030: 'stale',
  RB031: 'too-large',
  RB032: 'mfa-required',
  RB033: 'forbidden',
  RB034: 'quota',
  RB035: 'invalid-settings',
  RB036: 'missing-policy',
  RB037: 'not-found',
  RB038: 'upload-missing',
  RB039: 'disabled',
}

const HUMAN_BY_KIND: Record<TenantErrorKind, string> = {
  'invalid-input': 'The request was invalid. Check the highlighted fields and try again.',
  permission: "You don't have permission for this. Contact a workspace owner.",
  'mfa-required': 'Multi-factor verification is required. Complete MFA and try again.',
  forbidden: "This action isn't allowed for your workspace.",
  stale: 'This changed since you loaded it. Reload and try again.',
  'too-large': 'The file is larger than the workspace upload limit.',
  quota: 'The workspace limit was reached. Try again later.',
  'invalid-settings': 'Some settings were rejected by the workspace.',
  'missing-policy': 'The workspace upload or usage configuration is missing. Contact a workspace owner.',
  'not-found': "The requested item wasn't found. It may have been removed.",
  'upload-missing': "The file hasn't finished uploading. Upload it and try again.",
  disabled: 'The bot is disabled.',
  unavailable: "The workspace couldn't be reached. Try again.",
  unknown: 'Something went wrong. Try again.',
}

export function errorMessage(error: TenantError): string {
  const detail = error.code ? ' (' + error.code + ')' : ''
  if (error.kind === 'invalid-settings' && /\(.+\)/.test(error.message)) return error.message + detail
  return HUMAN_BY_KIND[error.kind] + detail
}

function codeFrom(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { code?: unknown; message?: unknown; status?: unknown }
    if (typeof maybe.code === 'string' && maybe.code) {
      const match = maybe.code.match(/RB0\d\d|22023|42501/)
      if (match) return match[0]
      return maybe.code
    }
    if (typeof maybe.message === 'string') {
      const match = maybe.message.match(/RB0\d\d/)
      if (match) return match[0]
    }
    if (maybe.status === 502 || maybe.status === 503 || maybe.status === 504) return 'unavailable-transport'
  }
  if (error instanceof TypeError) return 'unavailable-transport'
  return undefined
}

export function toTenantError(error: unknown): TenantError {
  if (error instanceof Error && 'kind' in error) return error as TenantError
  if (typeof error === 'object' && error !== null && 'kind' in error) {
    const candidate = (error as { kind: unknown }).kind
    if (typeof candidate === 'string' && candidate in HUMAN_BY_KIND) return error as TenantError
  }
  const code = codeFrom(error)
  const rawMessage =
    typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
      ? error.message
      : 'Request failed'
  if (code === 'unavailable-transport') return { kind: 'unavailable', message: rawMessage }
  if (code && code in KIND_BY_CODE) {
    const kind = KIND_BY_CODE[code] as TenantErrorKind | undefined
    if (kind) return { kind, message: rawMessage, code }
  }
  if (code === 'PGRST301' || code?.startsWith('PGRST')) {
    return code ? { kind: 'unavailable', message: rawMessage, code } : { kind: 'unavailable', message: rawMessage }
  }
  return code ? { kind: 'unknown', message: rawMessage, code } : { kind: 'unknown', message: rawMessage }
}

export type Bot = {
  id: string
  slug: string
  display_name: string | null
  enabled: boolean
  settings_version: number
}

export type BotSettings = {
  bot_id: string
  slug: string
  enabled: boolean
  settings_version: number
  tone: string | null
  scope: string | null
  max_bytes: number | null
  max_pages: number | null
  display_name: string | null
  greeting: string | null
  suggested_questions: string[]
  primary_color: string | null
  position: string | null
  privacy_url: string | null
  supported_languages: string[]
  escalation_label: string | null
  escalation_messages: Record<string, string>
  contact_email: string | null
  contact_phone: string | null
  contact_whatsapp_url: string | null
  contact_page_url: string | null
  business_hours: Record<string, string> | null
  timezone: string | null
}

export type DocumentStatusRow = {
  document_id: string
  title: string
  status: string
  active_version_id: string | null
  latest_version_id: string | null
  latest_version_number: number | null
  latest_version_status: string | null
  batches_done: number | null
  batches_total: number | null
  failure_code: string | null
}

export type MemberRow = {
  user_id: string
  role: string
  active: boolean
  label: string | null
}

export type JobSummaryRow = {
  job_type: string
  job_state: string
  job_count: number
}

export type UsageRow = {
  usage_day: string
  bot_id: string
  operation: string
  event_count: number
  input_tokens: number
  output_tokens: number
  estimated_cost: number
}

export type ConversationRow = {
  id: string
  bot_id: string
  status: string
  created_at: string
  last_message_at: string | null
}

export type MessageRow = {
  id: string
  role: string
  content: string
  status: string
  handoff_reason: string | null
  created_at: string
}

export type MessageSourceRow = {
  message_id: string
  source_label: string
  excerpt: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function callRpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  let result: { data: unknown; error: unknown }
  try {
    result = await client.rpc(fn, args)
  } catch (error) {
    throw toTenantError(error)
  }
  if (result.error) throw toTenantError(result.error)
  return result.data as T
}

async function readTable<T>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  let result: { data: unknown; error: unknown }
  try {
    result = await query
  } catch (error) {
    throw toTenantError(error)
  }
  if (result.error) throw toTenantError(result.error)
  return result.data as T
}

function asBot(row: unknown): Bot {
  if (!isRecord(row) || typeof row.id !== 'string' || typeof row.slug !== 'string') {
    throw toTenantError({ message: 'Unexpected bot response' })
  }
  return {
    id: row.id,
    slug: row.slug,
    display_name: typeof row.display_name === 'string' ? row.display_name : null,
    enabled: row.enabled === true,
    settings_version: typeof row.settings_version === 'number' ? row.settings_version : 1,
  }
}

export async function listBots(client: SupabaseClient): Promise<Bot[]> {
  const data = await callRpc<unknown>(client, 'admin_list_bots', {})
  if (!Array.isArray(data)) throw toTenantError({ message: 'Unexpected bot response' })
  return data.map(asBot)
}

export async function getSettings(client: SupabaseClient, botId: string): Promise<BotSettings> {
  const data = await callRpc<unknown>(client, 'admin_get_settings', { p_bot_id: botId })
  const row = (Array.isArray(data) ? data[0] : data) as unknown
  if (!isRecord(row) || typeof row.bot_id !== 'string') throw toTenantError({ message: 'Unexpected settings response' })
  return {
    bot_id: row.bot_id,
    slug: typeof row.slug === 'string' ? row.slug : '',
    enabled: row.enabled === true,
    settings_version: typeof row.settings_version === 'number' ? row.settings_version : 1,
    tone: typeof row.tone === 'string' ? row.tone : null,
    scope: typeof row.scope === 'string' ? row.scope : null,
    max_bytes: typeof row.max_bytes === 'number' ? row.max_bytes : null,
    max_pages: typeof row.max_pages === 'number' ? row.max_pages : null,
    display_name: typeof row.display_name === 'string' ? row.display_name : null,
    greeting: typeof row.greeting === 'string' ? row.greeting : null,
    suggested_questions: Array.isArray(row.suggested_questions)
      ? row.suggested_questions.filter((item): item is string => typeof item === 'string')
      : [],
    primary_color: typeof row.primary_color === 'string' ? row.primary_color : null,
    position: typeof row.position === 'string' ? row.position : null,
    privacy_url: typeof row.privacy_url === 'string' ? row.privacy_url : null,
    supported_languages: Array.isArray(row.supported_languages)
      ? row.supported_languages.filter((item): item is string => typeof item === 'string')
      : [],
    escalation_label: typeof row.escalation_label === 'string' ? row.escalation_label : null,
    escalation_messages:
      isRecord(row.escalation_messages) &&
      Object.values(row.escalation_messages).every((value) => typeof value === 'string')
        ? (row.escalation_messages as Record<string, string>)
        : {},
    contact_email: typeof row.contact_email === 'string' ? row.contact_email : null,
    contact_phone: typeof row.contact_phone === 'string' ? row.contact_phone : null,
    contact_whatsapp_url: typeof row.contact_whatsapp_url === 'string' ? row.contact_whatsapp_url : null,
    contact_page_url: typeof row.contact_page_url === 'string' ? row.contact_page_url : null,
    business_hours:
      isRecord(row.business_hours) &&
      Object.values(row.business_hours).every((value) => typeof value === 'string')
        ? (row.business_hours as Record<string, string>)
        : null,
    timezone: typeof row.timezone === 'string' ? row.timezone : null,
  }
}

export async function updateSettings(
  client: SupabaseClient,
  botId: string,
  expectedVersion: number,
  patch: Record<string, unknown>,
): Promise<number> {
  const data = await callRpc<unknown>(client, 'admin_update_settings', {
    p_bot_id: botId,
    p_expected_settings_version: expectedVersion,
    p_patch: patch,
  })
  const version = Array.isArray(data) ? data[0] : data
  if (typeof version !== 'number') throw toTenantError({ message: 'Unexpected settings response' })
  return version
}

export async function setBotEnabled(
  client: SupabaseClient,
  botId: string,
  expectedVersion: number,
  enabled: boolean,
): Promise<number> {
  const data = await callRpc<unknown>(client, 'admin_set_bot_enabled', {
    p_bot_id: botId,
    p_expected_settings_version: expectedVersion,
    p_enabled: enabled,
  })
  const version = Array.isArray(data) ? data[0] : data
  if (typeof version !== 'number') throw toTenantError({ message: 'Unexpected settings response' })
  return version
}

export async function documentStatus(
  client: SupabaseClient,
  botId: string,
  limit = 50,
  offset = 0,
): Promise<DocumentStatusRow[]> {
  const data = await callRpc<unknown>(client, 'admin_document_status', {
    p_bot_id: botId,
    p_limit: limit,
    p_offset: offset,
  })
  if (!Array.isArray(data)) throw toTenantError({ message: 'Unexpected document response' })
  return data.map((item) => {
    if (!isRecord(item) || typeof item.document_id !== 'string' || typeof item.title !== 'string') {
      throw toTenantError({ message: 'Unexpected document response' })
    }
    return {
      document_id: item.document_id,
      title: item.title,
      status: typeof item.status === 'string' ? item.status : 'unknown',
      active_version_id: typeof item.active_version_id === 'string' ? item.active_version_id : null,
      latest_version_id: typeof item.latest_version_id === 'string' ? item.latest_version_id : null,
      latest_version_number: typeof item.latest_version_number === 'number' ? item.latest_version_number : null,
      latest_version_status: typeof item.latest_version_status === 'string' ? item.latest_version_status : null,
      batches_done: typeof item.batches_done === 'number' ? item.batches_done : null,
      batches_total: typeof item.batches_total === 'number' ? item.batches_total : null,
      failure_code: typeof item.failure_code === 'string' ? item.failure_code : null,
    }
  })
}

export type RegisterDocumentResult = {
  document_id: string
  version_id: string
  storage_path: string
}

export async function registerDocument(
  client: SupabaseClient,
  botId: string,
  title: string,
  mediaType: string,
  byteSize: number,
  disclosurePolicy: string,
): Promise<RegisterDocumentResult> {
  const data = await callRpc<unknown>(client, 'admin_register_document', {
    p_bot_id: botId,
    p_title: title,
    p_media_type: mediaType,
    p_byte_size: byteSize,
    p_disclosure_policy: disclosurePolicy,
  })
  const row = (Array.isArray(data) ? data[0] : data) as unknown
  if (
    !isRecord(row) ||
    typeof row.document_id !== 'string' ||
    typeof row.version_id !== 'string' ||
    typeof row.storage_path !== 'string'
  ) {
    throw toTenantError({ message: 'Unexpected document response' })
  }
  return { document_id: row.document_id, version_id: row.version_id, storage_path: row.storage_path }
}

export async function addDocumentVersion(
  client: SupabaseClient,
  documentId: string,
  mediaType: string,
  byteSize: number,
): Promise<{ version_id: string; version_number: number; storage_path: string }> {
  const data = await callRpc<unknown>(client, 'admin_add_document_version', {
    p_document_id: documentId,
    p_media_type: mediaType,
    p_byte_size: byteSize,
  })
  const row = (Array.isArray(data) ? data[0] : data) as unknown
  if (
    !isRecord(row) ||
    typeof row.version_id !== 'string' ||
    typeof row.version_number !== 'number' ||
    typeof row.storage_path !== 'string'
  ) {
    throw toTenantError({ message: 'Unexpected document response' })
  }
  return { version_id: row.version_id, version_number: row.version_number, storage_path: row.storage_path }
}

export async function completeUpload(client: SupabaseClient, versionId: string): Promise<void> {
  await callRpc<unknown>(client, 'admin_complete_upload', { p_version_id: versionId })
}

export async function retryVersion(client: SupabaseClient, versionId: string): Promise<void> {
  await callRpc<unknown>(client, 'admin_retry_version', { p_version_id: versionId })
}

export async function reindexDocument(client: SupabaseClient, documentId: string): Promise<void> {
  await callRpc<unknown>(client, 'admin_reindex_document', { p_document_id: documentId })
}

export async function deleteDocument(client: SupabaseClient, documentId: string): Promise<void> {
  await callRpc<unknown>(client, 'admin_delete_document', { p_document_id: documentId })
}

export async function deleteConversation(client: SupabaseClient, conversationId: string): Promise<void> {
  await callRpc<unknown>(client, 'admin_delete_conversation', { p_conversation_id: conversationId })
}

export async function listMembers(client: SupabaseClient): Promise<MemberRow[]> {
  const data = await callRpc<unknown>(client, 'admin_list_members', {})
  if (!Array.isArray(data)) throw toTenantError({ message: 'Unexpected member response' })
  return data.map((item) => {
    if (!isRecord(item) || typeof item.user_id !== 'string') {
      throw toTenantError({ message: 'Unexpected member response' })
    }
    return {
      user_id: item.user_id,
      role: typeof item.role === 'string' ? item.role : 'unknown',
      active: item.active === true,
      label: typeof item.label === 'string' ? item.label : null,
    }
  })
}

export async function jobSummary(client: SupabaseClient): Promise<JobSummaryRow[]> {
  const data = await callRpc<unknown>(client, 'job_status_summary', {})
  if (!Array.isArray(data)) throw toTenantError({ message: 'Unexpected job response' })
  return data.map((item) => {
    if (!isRecord(item) || typeof item.job_type !== 'string' || typeof item.job_state !== 'string') {
      throw toTenantError({ message: 'Unexpected job response' })
    }
    return {
      job_type: item.job_type,
      job_state: item.job_state,
      job_count: typeof item.job_count === 'number' ? item.job_count : Number(item.job_count) || 0,
    }
  })
}

export function toISODate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export async function usageSummary(
  client: SupabaseClient,
  from: string,
  to: string,
): Promise<UsageRow[]> {
  const data = await callRpc<unknown>(client, 'usage_daily_summary', { p_from: from, p_to: to })
  if (!Array.isArray(data)) throw toTenantError({ message: 'Unexpected usage response' })
  return data.map((item) => {
    if (!isRecord(item) || typeof item.usage_day !== 'string') {
      throw toTenantError({ message: 'Unexpected usage response' })
    }
    return {
      usage_day: item.usage_day,
      bot_id: typeof item.bot_id === 'string' ? item.bot_id : '',
      operation: typeof item.operation === 'string' ? item.operation : '',
      event_count: typeof item.event_count === 'number' ? item.event_count : 0,
      input_tokens: typeof item.input_tokens === 'number' ? item.input_tokens : 0,
      output_tokens: typeof item.output_tokens === 'number' ? item.output_tokens : 0,
      estimated_cost: typeof item.estimated_cost === 'number' ? item.estimated_cost : 0,
    }
  })
}

export async function listConversations(
  client: SupabaseClient,
  botId: string,
  limit = 25,
): Promise<ConversationRow[]> {
  const data = await readTable<unknown>(
    client
      .from('conversations')
      .select('id, bot_id, status, created_at, last_message_at')
      .eq('bot_id', botId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit),
  )
  if (!Array.isArray(data)) throw toTenantError({ message: 'Unexpected conversation response' })
  return data.map((item) => {
    if (!isRecord(item) || typeof item.id !== 'string') {
      throw toTenantError({ message: 'Unexpected conversation response' })
    }
    return {
      id: item.id,
      bot_id: typeof item.bot_id === 'string' ? item.bot_id : botId,
      status: typeof item.status === 'string' ? item.status : 'unknown',
      created_at: typeof item.created_at === 'string' ? item.created_at : '',
      last_message_at: typeof item.last_message_at === 'string' ? item.last_message_at : null,
    }
  })
}

export async function listMessages(client: SupabaseClient, conversationId: string): Promise<MessageRow[]> {
  const data = await readTable<unknown>(
    client
      .from('messages')
      .select('id, role, content, status, handoff_reason, created_at')
      .eq('conversation_id', conversationId)
      .neq('role', 'system')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(200),
  )
  if (!Array.isArray(data)) throw toTenantError({ message: 'Unexpected message response' })
  return data.map((item) => {
    if (!isRecord(item) || typeof item.id !== 'string') {
      throw toTenantError({ message: 'Unexpected message response' })
    }
    return {
      id: item.id,
      role: typeof item.role === 'string' ? item.role : 'unknown',
      content: typeof item.content === 'string' ? item.content : '',
      status: typeof item.status === 'string' ? item.status : 'unknown',
      handoff_reason: typeof item.handoff_reason === 'string' ? item.handoff_reason : null,
      created_at: typeof item.created_at === 'string' ? item.created_at : '',
    }
  })
}

export async function listMessageSources(
  client: SupabaseClient,
  messageIds: string[],
): Promise<MessageSourceRow[]> {
  if (messageIds.length === 0) return []
  const data = await readTable<unknown>(
    client.from('message_sources').select('message_id, source_label, excerpt').in('message_id', messageIds.slice(0, 200)),
  )
  if (!Array.isArray(data)) throw toTenantError({ message: 'Unexpected source response' })
  return data.flatMap((item) => {
    if (!isRecord(item) || typeof item.message_id !== 'string' || typeof item.source_label !== 'string') return []
    return [
      {
        message_id: item.message_id,
        source_label: item.source_label,
        excerpt: typeof item.excerpt === 'string' ? item.excerpt : null,
      },
    ]
  })
}

export async function uploadKnowledgeFile(
  client: SupabaseClient,
  storagePath: string,
  file: File,
  mediaType: string,
): Promise<void> {
  let result: { error: unknown }
  try {
    result = await client.storage.from('knowledge').upload(storagePath, file, {
      upsert: false,
      contentType: mediaType,
    })
  } catch (error) {
    throw toTenantError(error)
  }
  if (result.error) throw toTenantError(result.error)
}

export async function downloadOriginalUrl(client: SupabaseClient, versionId: string): Promise<string> {
  const path = await callRpc<unknown>(client, 'admin_request_download', { p_version_id: versionId })
  const storagePath = Array.isArray(path) ? path[0] : path
  if (typeof storagePath !== 'string' || !storagePath) throw toTenantError({ message: 'Unexpected download response' })
  let signed: { data: unknown; error: unknown }
  try {
    signed = await client.storage.from('knowledge').createSignedUrl(storagePath, 60)
  } catch (error) {
    throw toTenantError(error)
  }
  if (signed.error || !isRecord(signed.data) || typeof signed.data.signedUrl !== 'string') {
    throw toTenantError(signed.error ?? { message: 'Could not create a download link' })
  }
  return signed.data.signedUrl
}

export function mediaTypeForFile(file: File): string | null {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'application/pdf'
  if (file.type === 'text/markdown' || name.endsWith('.md') || name.endsWith('.markdown')) return 'text/markdown'
  if (file.type === 'text/plain' || name.endsWith('.txt')) return 'text/plain'
  return null
}

export function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id
}

export const EDITABLE_SETTINGS_KEYS = [
  'display_name',
  'greeting',
  'tone',
  'scope',
  'suggested_questions',
  'primary_color',
  'position',
  'privacy_url',
  'supported_languages',
  'escalation_label',
  'escalation_messages',
  'contact_email',
  'contact_phone',
  'contact_whatsapp_url',
  'contact_page_url',
  'business_hours',
  'timezone',
] as const

export type EditableSettingsKey = (typeof EDITABLE_SETTINGS_KEYS)[number]

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export function buildSettingsPatch(
  current: BotSettings,
  draft: Record<EditableSettingsKey, string>,
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {}
  const text = (value: string): string | null => (value.trim() === '' ? null : value)

  const assign = (key: EditableSettingsKey, value: unknown, original: unknown) => {
    if (!valuesEqual(value, original)) patch[key] = value
  }

  assign('display_name', draft.display_name.trim() === '' ? current.display_name : draft.display_name.trim(), current.display_name)
  assign('greeting', draft.greeting === '' ? current.greeting : draft.greeting, current.greeting)
  assign('tone', draft.tone === '' ? current.tone : draft.tone, current.tone)
  assign('scope', draft.scope === '' ? current.scope : draft.scope, current.scope)
  assign('primary_color', draft.primary_color === '' ? current.primary_color : draft.primary_color, current.primary_color)
  assign('position', draft.position === '' ? current.position : draft.position, current.position)
  assign('privacy_url', text(draft.privacy_url) ?? null, current.privacy_url)
  assign('escalation_label', draft.escalation_label === '' ? current.escalation_label : draft.escalation_label, current.escalation_label)
  assign('contact_email', text(draft.contact_email) ?? null, current.contact_email)
  assign('contact_phone', text(draft.contact_phone) ?? null, current.contact_phone)
  assign('contact_whatsapp_url', text(draft.contact_whatsapp_url) ?? null, current.contact_whatsapp_url)
  assign('contact_page_url', text(draft.contact_page_url) ?? null, current.contact_page_url)
  assign('timezone', text(draft.timezone) ?? null, current.timezone)

  const questions = draft.suggested_questions
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  assign('suggested_questions', questions, current.suggested_questions)

  const languages = draft.supported_languages
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
  assign('supported_languages', languages, current.supported_languages)

  for (const key of ['escalation_messages', 'business_hours'] as const) {
    const raw = draft[key].trim()
    if (raw === '') {
      if (current[key] !== null) patch[key] = null
      continue
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw) as unknown
    } catch {
      throw toTenantError({ code: '22023', message: 'Invalid JSON for ' + key })
    }
    assign(key, parsed, current[key])
  }

  return Object.keys(patch).length > 0 ? patch : null
}

export function emptySettingsDraft(): Record<EditableSettingsKey, string> {
  return {
    display_name: '',
    greeting: '',
    tone: '',
    scope: '',
    suggested_questions: '',
    primary_color: '',
    position: '',
    privacy_url: '',
    supported_languages: '',
    escalation_label: '',
    escalation_messages: '',
    contact_email: '',
    contact_phone: '',
    contact_whatsapp_url: '',
    contact_page_url: '',
    business_hours: '',
    timezone: '',
  }
}

export type KnowledgeGapRow = {
  handoff_reason: string
  question: string
  occurrences: number
  last_seen: string
}

export async function knowledgeGaps(
  client: SupabaseClient,
  from: string,
  to: string,
  limit = 50,
): Promise<KnowledgeGapRow[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    throw toTenantError({ code: '22023', message: 'Use a valid from/to date range' })
  }
  const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
  if (days > 92) {
    throw toTenantError({ code: '22023', message: 'The range must not exceed 92 days' })
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw toTenantError({ code: '22023', message: 'The limit must be between 1 and 200' })
  }
  const data = await callRpc<unknown>(client, 'knowledge_gaps', { p_from: from, p_to: to, p_limit: limit })
  if (!Array.isArray(data)) throw toTenantError({ message: 'Unexpected knowledge-gap response' })
  return data.map((item) => {
    if (!isRecord(item) || typeof item.question !== 'string') {
      throw toTenantError({ message: 'Unexpected knowledge-gap response' })
    }
    return {
      handoff_reason: typeof item.handoff_reason === 'string' ? item.handoff_reason : 'unknown',
      question: item.question,
      occurrences: typeof item.occurrences === 'number' ? item.occurrences : Number(item.occurrences) || 0,
      last_seen: typeof item.last_seen === 'string' ? item.last_seen : '',
    }
  })
}

export function approvedAnswerTitle(question: string): string {
  const normalized = question.trim().replace(/\s+/g, ' ')
  const truncated = normalized.length > 60 ? normalized.slice(0, 60).trimEnd() : normalized
  return 'Approved answer — ' + truncated
}

export function approvedAnswerBody(input: {
  question: string
  handoffReason: string
  occurrences: number
  lastSeen: string
  answer: string
}): string {
  const lines = [
    '# ' + approvedAnswerTitle(input.question).replace(/^Approved answer — /, ''),
    '',
    '> Source gap: "' + input.question.trim() + '" — ' + input.handoffReason + ', ' + input.occurrences + '×, last seen ' + input.lastSeen,
    '> Reviewed by a workspace owner/admin. Not active until the backend confirms activation.',
    '',
    input.answer.trim(),
    '',
  ]
  return lines.join('\n')
}

export function suggestCoveringDocuments(
  documents: readonly { title: string }[],
  question: string,
): { title: string }[] {
  const words = question.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3)
  if (words.length === 0) return []
  const keywords = new Set(words.slice(0, 6))
  return documents.filter((doc) => {
    const title = doc.title.toLowerCase()
    let hits = 0
    for (const word of keywords) {
      if (title.includes(word)) hits += 1
    }
    return hits >= 2 || (doc.title.startsWith('Approved answer — ') && hits >= 1)
  })
}

export function draftFromSettings(settings: BotSettings): Record<EditableSettingsKey, string> {
  return {
    display_name: settings.display_name ?? '',
    greeting: settings.greeting ?? '',
    tone: settings.tone ?? '',
    scope: settings.scope ?? '',
    suggested_questions: settings.suggested_questions.join('\n'),
    primary_color: settings.primary_color ?? '',
    position: settings.position ?? '',
    privacy_url: settings.privacy_url ?? '',
    supported_languages: settings.supported_languages.join(', '),
    escalation_label: settings.escalation_label ?? '',
    escalation_messages:
      settings.escalation_messages && Object.keys(settings.escalation_messages).length > 0
        ? JSON.stringify(settings.escalation_messages, null, 2)
        : '',
    contact_email: settings.contact_email ?? '',
    contact_phone: settings.contact_phone ?? '',
    contact_whatsapp_url: settings.contact_whatsapp_url ?? '',
    contact_page_url: settings.contact_page_url ?? '',
    business_hours: settings.business_hours ? JSON.stringify(settings.business_hours, null, 2) : '',
    timezone: settings.timezone ?? '',
  }
}
