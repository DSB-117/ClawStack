import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', // Claude will look for tests here
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000', // CRITICAL: Tells Claude where to test
    trace: 'on-first-retry', // Helps Claude debug failures
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev', // Tells Playwright to start your app if it's not running
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});