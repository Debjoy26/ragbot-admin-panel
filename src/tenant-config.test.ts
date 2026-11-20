import { expect, it } from 'vitest'
import { parseTenantConfig } from './tenant-config'

const sample = {
  supabaseUrl: 'https://tenant.example/',
  supabasePublishableKey: 'sb_publishable_sample',
}

it('accepts a public project origin and permits HTTP for a local test stack', () => {
  expect(parseTenantConfig(sample)).toEqual({ ...sample, supabaseUrl: 'https://tenant.example' })
  expect(parseTenantConfig({ ...sample, supabaseUrl: 'http://127.0.0.1:54321' })).not.toBeNull()
})

it.each([
  'http://tenant.example',
  'https://tenant.example/path',
  'https://tenant.example/?key=secret',
  'https://user:password@tenant.example',
])('rejects an invalid project origin: %s', (supabaseUrl) => {
  expect(parseTenantConfig({ ...sample, supabaseUrl })).toBeNull()
})

it('rejects missing config and a server key', () => {
  expect(parseTenantConfig(undefined)).toBeNull()
  expect(parseTenantConfig({ ...sample, supabasePublishableKey: 'sb_secret_sample' })).toBeNull()
})
