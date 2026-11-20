import { describe, expect, it } from 'vitest'
import {
  buildSettingsPatch,
  draftFromSettings,
  errorMessage,
  mediaTypeForFile,
  shortId,
  toISODate,
  toTenantError,
} from './tenant-api'
import type { BotSettings } from './tenant-api'

const settings: BotSettings = {
  bot_id: 'bot-1',
  slug: 'support',
  enabled: true,
  settings_version: 3,
  tone: 'helpful',
  scope: 'support',
  max_bytes: 1024,
  max_pages: 10,
  display_name: 'Support',
  greeting: 'Hello',
  suggested_questions: ['Hours?'],
  primary_color: '#123456',
  position: 'bottom-right',
  privacy_url: null,
  supported_languages: ['en'],
  escalation_label: 'Talk to a person',
  escalation_messages: { en: 'We will help' },
  contact_email: null,
  contact_phone: null,
  contact_whatsapp_url: null,
  contact_page_url: null,
  business_hours: null,
  timezone: null,
}

describe('toTenantError', () => {
  it.each([
    ['22023', 'invalid-input'],
    ['42501', 'permission'],
    ['RB030', 'stale'],
    ['RB031', 'too-large'],
    ['RB032', 'mfa-required'],
    ['RB033', 'forbidden'],
    ['RB034', 'quota'],
    ['RB035', 'invalid-settings'],
    ['RB036', 'missing-policy'],
    ['RB037', 'not-found'],
    ['RB038', 'upload-missing'],
    ['RB039', 'disabled'],
  ])('maps %s to %s', (code, kind) => {
    expect(toTenantError({ code, message: 'backend: ' + code }).kind).toBe(kind)
  })

  it('finds a backend code inside the message text', () => {
    expect(toTenantError({ message: 'admin_update_settings: settings changed (RB030)' }).kind).toBe('stale')
  })

  it('treats transport failures as unavailable', () => {
    expect(toTenantError(new TypeError('fetch failed')).kind).toBe('unavailable')
  })

  it('keeps unknown errors explicit', () => {
    const error = toTenantError({ message: 'boom' })
    expect(error.kind).toBe('unknown')
    expect(errorMessage(error)).toContain('Something went wrong')
  })
})

describe('buildSettingsPatch', () => {
  it('returns null when nothing changed', () => {
    expect(buildSettingsPatch(settings, draftFromSettings(settings))).toBeNull()
  })

  it('includes only changed whitelisted fields', () => {
    const draft = { ...draftFromSettings(settings), display_name: 'Support desk', tone: 'helpful' }
    expect(buildSettingsPatch(settings, draft)).toEqual({ display_name: 'Support desk' })
  })

  it('parses list and JSON fields', () => {
    const draft = {
      ...draftFromSettings(settings),
      supported_languages: 'en, es',
      escalation_messages: '{"en":"Hi","es":"Hola"}',
      business_hours: '',
    }
    expect(buildSettingsPatch(settings, draft)).toEqual({
      supported_languages: ['en', 'es'],
      escalation_messages: { en: 'Hi', es: 'Hola' },
    })
  })

  it('rejects invalid JSON as an input error', () => {
    const draft = { ...draftFromSettings(settings), escalation_messages: '{oops' }
    expect(() => buildSettingsPatch(settings, draft)).toThrowError()
    try {
      buildSettingsPatch(settings, draft)
    } catch (error) {
      expect(toTenantError(error).kind).toBe('invalid-input')
    }
  })
})

describe('helpers', () => {
  it('detects supported upload types by extension', () => {
    const pdf = new File(['x'], 'guide.pdf', { type: 'application/pdf' })
    const markdown = new File(['x'], 'guide.md', { type: '' })
    const text = new File(['x'], 'guide.txt', { type: '' })
    const bad = new File(['x'], 'guide.png', { type: 'image/png' })
    expect(mediaTypeForFile(pdf)).toBe('application/pdf')
    expect(mediaTypeForFile(markdown)).toBe('text/markdown')
    expect(mediaTypeForFile(text)).toBe('text/plain')
    expect(mediaTypeForFile(bad)).toBeNull()
  })

  it('formats helpers without secrets', () => {
    expect(shortId('abcdef123456')).toBe('abcdef12')
    expect(toISODate(new Date('2026-11-01T00:00:00Z'))).toBe('2026-11-01')
  })
})
