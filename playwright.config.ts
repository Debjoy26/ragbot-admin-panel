import { defineConfig } from '@playwright/test'

const origin = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: origin, browserName: 'chromium' },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: origin + '/app/',
    reuseExistingServer: false,
  },
})
