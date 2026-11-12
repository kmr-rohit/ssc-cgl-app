import { defineConfig, devices } from '@playwright/test';
// Signed-out UI tests on the dev server, plus installable-app (PWA) tests on the production build.
// Sync/auth logic is covered by `npm run test:sync` (local Supabase stack) and `npm run test:db` (RLS).
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
    { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: false, timeout: 120_000 },
  ],
  projects: [
    { name: 'desktop', testIgnore: /pwa\.spec/, use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173' } },
    { name: 'phone', testIgnore: /pwa\.spec/, use: { ...devices['Pixel 5'], baseURL: 'http://localhost:5173' } },
    { name: 'pwa', testMatch: /pwa\.spec/, use: { ...devices['Pixel 5'], baseURL: 'http://localhost:4173', trace: 'off' } },
  ],
});
