#!/usr/bin/env npx ts-node
/**
 * Standalone screenshot capture script.
 * Usage: npx playwright test is preferred, but this works without the test runner.
 *   node --loader ts-node/esm e2e/take-screenshots.ts
 *   OR: npx ts-node e2e/take-screenshots.ts
 */

import { chromium } from 'playwright-core';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = join(__dirname, '..', 'screenshots');
const BASE_URL = process.env.BASE_URL || 'http://localhost:5175';

const ssOpts = { animations: 'disabled' as const };

const COMPONENTS = [
  // Primitives
  { testId: 'ss-button', name: 'button' },
  { testId: 'ss-badge', name: 'badge' },
  { testId: 'ss-card', name: 'card' },
  { testId: 'ss-separator', name: 'separator' },
  { testId: 'ss-skeleton', name: 'skeleton' },
  { testId: 'ss-scroll-area', name: 'scroll-area' },
  // Form & Data
  { testId: 'ss-input', name: 'input' },
  { testId: 'ss-textarea', name: 'textarea' },
  { testId: 'ss-checkbox-switch', name: 'checkbox-switch' },
  { testId: 'ss-slider', name: 'slider' },
  { testId: 'ss-progress', name: 'progress' },
  { testId: 'ss-tabs', name: 'tabs' },
  { testId: 'ss-avatar', name: 'avatar' },
  { testId: 'ss-alert', name: 'alert' },
  { testId: 'ss-table', name: 'table' },
  { testId: 'ss-toggle', name: 'toggle' },
  { testId: 'ss-tooltip', name: 'tooltip' },
  // Chat UI
  { testId: 'ss-session-panel', name: 'session-panel' },
  { testId: 'ss-session-panel-empty', name: 'session-panel-empty' },
  // Concept Components
  { testId: 'ss-skill-card', name: 'skill-card' },
  { testId: 'ss-task-card', name: 'task-card' },
  { testId: 'ss-mcp-browser', name: 'mcp-browser' },
  { testId: 'ss-hook-config', name: 'hook-config' },
  { testId: 'ss-worktree', name: 'worktree-selector' },
  { testId: 'ss-research-doc', name: 'research-doc' },
  // Chat Elements
  { testId: 'ss-tool-call', name: 'tool-call-viewer' },
  { testId: 'ss-code-block', name: 'code-block' },
  { testId: 'ss-cost-ticker', name: 'cost-ticker' },
  { testId: 'ss-diff-view', name: 'diff-view' },
  { testId: 'ss-progress-indicator', name: 'progress-indicator' },
];

async function main() {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--single-process',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  // Mock API calls
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/ws', (route) =>
    route.fulfill({ status: 200, body: '' }),
  );

  console.log(`Navigating to ${BASE_URL}/snapshots ...`);
  await page.goto(`${BASE_URL}/snapshots`, { waitUntil: 'networkidle' });

  // Wait for content
  try {
    await page.waitForSelector('[data-testid="section-primitives"]', { timeout: 10_000 });
  } catch {
    console.error('Page did not render section-primitives. Taking debug screenshot.');
    await page.screenshot({ path: join(SCREENSHOTS_DIR, '_debug.png'), fullPage: true });
    await browser.close();
    process.exit(1);
  }

  // Full page screenshot
  console.log('Capturing: snapshots-full.png');
  await page.screenshot({
    path: join(SCREENSHOTS_DIR, 'snapshots-full.png'),
    fullPage: true,
    ...ssOpts,
  });

  // Individual component screenshots
  for (const { testId, name } of COMPONENTS) {
    const el = page.locator(`[data-testid="${testId}"]`);
    const count = await el.count();
    if (count === 0) {
      console.warn(`  SKIP: ${name} (no element with testId="${testId}")`);
      continue;
    }
    await el.scrollIntoViewIfNeeded();
    // Small wait for any layout shifts after scroll
    await page.waitForTimeout(200);
    console.log(`  Capturing: ${name}.png`);
    await el.screenshot({
      path: join(SCREENSHOTS_DIR, `${name}.png`),
      ...ssOpts,
    });
  }

  console.log(`\nDone! ${COMPONENTS.length + 1} screenshots saved to ${SCREENSHOTS_DIR}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
