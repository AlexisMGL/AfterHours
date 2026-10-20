import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 90000, expect: { timeout: 15000 }, fullyParallel: false, workers: 1,
  // Continuous GPU readback for screencasts severely slows SwiftShader at 2x.
  // Keep action/DOM/source traces and a failure screenshot without that stream.
  reporter: 'list', use: { baseURL: 'http://127.0.0.1:4173', trace: { mode:'retain-on-failure',screenshots:false,snapshots:true,sources:true }, screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run dev -- --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 60000 },
});
