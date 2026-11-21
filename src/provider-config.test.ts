import { expect, it } from 'vitest'
import { parseProviderConfig } from './provider-config'

const sample = {
  apiBaseUrl: 'https://provider.example/',
  supabaseUrl: 'https://staff.example/',
  supabasePublishableKey: 'sb_publishable_sample',
}

it('accepts https origins and permits HTTP for loopback stacks', () => {
  expect(parseProviderConfig(sample)).toEqual({
    apiBaseUrl: 'https://provider.example',
    supabaseUrl: 'https://staff.example',
    supabasePublishableKey: 'sb_publishable_sample',
  })
  expect(parseProviderConfig({ ...sample, apiBaseUrl: 'http://127.0.0.1:8080' })).not.toBeNull()
})

it.each(['http://provider.example', 'https://provider.example/v1', 'https://provider.example/?key=secret'])(
  'rejects an invalid API origin: %s',
  (apiBaseUrl) => {
    expect(parseProviderConfig({ ...sample, apiBaseUrl })).toBeNull()
  },
)

it('rejects missing config and a server key', () => {
  expect(parseProviderConfig(undefined)).toBeNull()
  expect(parseProviderConfig({ ...sample, supabasePublishableKey: 'sb_secret_sample' })).toBeNull()
})
