import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './e2e',
  snapshotDir: './screenshots',
  snapshotPathTemplate: '{snapshotDir}/{arg}{ext}',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  expect: {
    toHaveScreenshot: {
      timeout: 15_000,
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: 'http://localhost:5174',
    screenshot: 'off',
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        channel: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'bun x vite --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
