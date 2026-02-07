import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const OUT = './screenshots/gsd';
mkdirSync(OUT, { recursive: true });

const args = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--disable-software-rasterizer',
  '--single-process',
  '--no-zygote',
];

async function run() {
  const browser = await chromium.launch({ args });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Navigate to GSD
  await page.goto('http://localhost:5173/gsd', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="gsd-shell"]', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Full page
  console.log('Capturing: gsd-full.png');
  await page.screenshot({ path: `${OUT}/gsd-full.png` });

  // Topbar
  console.log('Capturing: gsd-topbar.png');
  const topbar = page.locator('[data-testid="gsd-topbar"]');
  await topbar.screenshot({ path: `${OUT}/gsd-topbar.png` });

  // Agent sidebar
  console.log('Capturing: gsd-sidebar.png');
  const sidebar = page.locator('[data-testid="gsd-sidebar"]');
  await sidebar.screenshot({ path: `${OUT}/gsd-sidebar.png` });

  // Priority queue
  console.log('Capturing: gsd-queue.png');
  const queue = page.locator('[data-testid="gsd-queue"]');
  await queue.screenshot({ path: `${OUT}/gsd-queue.png` });

  // Detail panel (starts with blocked issue selected)
  console.log('Capturing: gsd-detail-blocked.png');
  const detail = page.locator('[data-testid="gsd-detail"]');
  await detail.screenshot({ path: `${OUT}/gsd-detail-blocked.png` });

  // Command bar
  console.log('Capturing: gsd-command-bar.png');
  const bar = page.locator('[data-testid="gsd-command-bar"]');
  await bar.screenshot({ path: `${OUT}/gsd-command-bar.png` });

  // Click in-progress issue (UAH-42: file watcher pipeline)
  console.log('Capturing: gsd-issue-inprogress.png');
  await page.click('[data-testid="gsd-queue-issue-1"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/gsd-issue-inprogress.png` });

  // Detail for in-progress issue
  console.log('Capturing: gsd-detail-inprogress.png');
  await detail.screenshot({ path: `${OUT}/gsd-detail-inprogress.png` });

  // Plan section
  console.log('Capturing: gsd-plan.png');
  const plan = page.locator('[data-testid="gsd-plan"]');
  if (await plan.count() > 0) {
    await plan.screenshot({ path: `${OUT}/gsd-plan.png` });
  }

  // Tasks section
  console.log('Capturing: gsd-tasks.png');
  const tasks = page.locator('[data-testid="gsd-tasks"]');
  if (await tasks.count() > 0) {
    await tasks.screenshot({ path: `${OUT}/gsd-tasks.png` });
  }

  // Click review issue (UAH-51: git auto-snapshot)
  console.log('Capturing: gsd-issue-review.png');
  await page.click('[data-testid="gsd-queue-issue-3"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/gsd-issue-review.png` });

  // Click done issue (UAH-47: Tauri scaffold)
  console.log('Capturing: gsd-issue-done.png');
  await page.click('[data-testid="gsd-queue-issue-6"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/gsd-issue-done.png` });

  // Click planning issue (UAH-55: Claude SDK adapter)
  console.log('Capturing: gsd-issue-planning.png');
  await page.click('[data-testid="gsd-queue-issue-4"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/gsd-issue-planning.png` });

  await browser.close();
  console.log(`\nDone! ${13} screenshots saved to ${OUT}/`);
}

run().catch(e => { console.error(e); process.exit(1); });
