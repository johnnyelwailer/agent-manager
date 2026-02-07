import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots', 'metamorph');

async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({
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
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Helper: take full page + element screenshots
  async function snap(name: string) {
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `${name}.png`),
      animations: 'disabled',
    });
    console.log(`  captured: ${name}.png`);
  }

  async function snapElement(selector: string, name: string) {
    try {
      const el = page.locator(selector);
      await el.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${name}.png`),
        animations: 'disabled',
      });
      console.log(`  captured: ${name}.png`);
    } catch (e) {
      console.log(`  SKIP: ${name}.png (element not found: ${selector})`);
    }
  }

  // ---- Board Mode ----
  console.log('\n--- Board Mode ---');
  page.on('console', msg => console.log('  [browser]', msg.text()));
  page.on('pageerror', err => console.log('  [browser error]', err.message));
  await page.goto('http://localhost:5173/metamorph', { waitUntil: 'networkidle' });
  console.log('  page loaded, waiting for shell...');
  await page.waitForSelector('[data-testid="metamorph-shell"]', { timeout: 15_000 });
  await page.waitForTimeout(500); // let animations settle

  await snap('metamorph-board-full');
  await snapElement('[data-testid="metamorph-topbar"]', 'metamorph-topbar');
  await snapElement('[data-testid="metamorph-sidebar"]', 'metamorph-sidebar');
  await snapElement('[data-testid="metamorph-board"]', 'metamorph-board');
  await snapElement('[data-testid="metamorph-detail"]', 'metamorph-detail');
  await snapElement('[data-testid="metamorph-prompt-bar"]', 'metamorph-prompt-bar');
  await snapElement('[data-testid="metamorph-suggestions"]', 'metamorph-suggestions');
  await snapElement('[data-testid^="metamorph-card-"]', 'metamorph-card');
  await snapElement('[data-testid="metamorph-detail-plan"]', 'metamorph-detail-plan');
  await snapElement('[data-testid="metamorph-detail-tasks"]', 'metamorph-detail-tasks');
  await snapElement('[data-testid="metamorph-detail-actions"]', 'metamorph-detail-actions');
  await snapElement('[data-testid="metamorph-agents"]', 'metamorph-agents');
  await snapElement('[data-testid="metamorph-issue-list"]', 'metamorph-issue-list');

  // ---- Elaboration Mode ----
  console.log('\n--- Elaboration Mode ---');
  const input = page.locator('[data-testid="metamorph-prompt-input"]');
  await input.fill('Add WebSocket reconnection with exponential backoff');
  await page.click('text=Elaborate Plan');
  await page.waitForSelector('[data-testid="metamorph-elaboration"]', { timeout: 5_000 });
  await page.waitForTimeout(500); // let mock plan generate

  await snap('metamorph-elaboration-full');
  await snapElement('[data-testid="metamorph-elab-prompt"]', 'metamorph-elab-prompt');
  await snapElement('[data-testid="metamorph-elab-plan"]', 'metamorph-elab-plan');

  // ---- Wider viewport for full board visibility ----
  console.log('\n--- Wide Viewport (1920x1080) ---');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173/metamorph');
  await page.waitForSelector('[data-testid="metamorph-shell"]', { timeout: 10_000 });
  await page.waitForTimeout(500);

  await snap('metamorph-board-wide');

  // Elaboration at wide viewport
  const input2 = page.locator('[data-testid="metamorph-prompt-input"]');
  await input2.fill('Add WebSocket reconnection with exponential backoff');
  await page.click('text=Elaborate Plan');
  await page.waitForSelector('[data-testid="metamorph-elaboration"]', { timeout: 5_000 });
  await page.waitForTimeout(500);

  await snap('metamorph-elaboration-wide');

  await browser.close();
  console.log(`\nDone! Screenshots saved to ${SCREENSHOTS_DIR}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
