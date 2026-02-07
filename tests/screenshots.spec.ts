import { test, expect } from '@playwright/test';

const ssOpts = { timeout: 20_000, animations: 'disabled' as const };
const ssOptsFull = { ...ssOpts, fullPage: true };

// ---------------------------------------------------------------------------
// Variant A — Command Center
// ---------------------------------------------------------------------------

test.describe('Variant A: Command Center', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/command-center');
    await page.waitForSelector('[data-testid="agent-panel"]');
  });

  test('full page screenshot', async ({ page }) => {
    await expect(page).toHaveScreenshot('command-center-full.png', ssOpts);
  });

  test('agent panel', async ({ page }) => {
    const panel = page.locator('[data-testid="agent-panel"]');
    await expect(panel).toHaveScreenshot('command-center-agent-panel.png', ssOpts);
  });

  test('strategy tree', async ({ page }) => {
    const panel = page.locator('[data-testid="strategy-tree"]');
    await expect(panel).toHaveScreenshot('command-center-strategy-tree.png', ssOpts);
  });

  test('execution log', async ({ page }) => {
    const panel = page.locator('[data-testid="execution-log"]');
    await expect(panel).toHaveScreenshot('command-center-execution-log.png', ssOpts);
  });

  test('verification panel', async ({ page }) => {
    const panel = page.locator('[data-testid="verification-panel"]');
    await expect(panel).toHaveScreenshot('command-center-verification-panel.png', ssOpts);
  });

  test('context panel', async ({ page }) => {
    const panel = page.locator('[data-testid="context-panel"]');
    await expect(panel).toHaveScreenshot('command-center-context-panel.png', ssOpts);
  });
});

// ---------------------------------------------------------------------------
// Variant B — Flow
// ---------------------------------------------------------------------------

test.describe('Variant B: Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flow');
    await page.waitForSelector('[data-testid="summary-ribbon"]');
  });

  test('full page screenshot', async ({ page }) => {
    await expect(page).toHaveScreenshot('flow-full.png', ssOptsFull);
  });

  test('summary ribbon', async ({ page }) => {
    const section = page.locator('[data-testid="summary-ribbon"]');
    await expect(section).toHaveScreenshot('flow-summary-ribbon.png', ssOpts);
  });

  test('strategy roadmap', async ({ page }) => {
    const section = page.locator('[data-testid="strategy-roadmap"]');
    await expect(section).toHaveScreenshot('flow-strategy-roadmap.png', ssOpts);
  });

  test('active work', async ({ page }) => {
    const section = page.locator('[data-testid="active-work"]');
    await expect(section).toHaveScreenshot('flow-active-work.png', ssOpts);
  });

  test('recent activity', async ({ page }) => {
    const section = page.locator('[data-testid="recent-activity"]');
    await expect(section).toHaveScreenshot('flow-recent-activity.png', ssOpts);
  });

  test('knowledge base', async ({ page }) => {
    const section = page.locator('[data-testid="knowledge-base"]');
    await expect(section).toHaveScreenshot('flow-knowledge-base.png', ssOpts);
  });

  test('verification status', async ({ page }) => {
    const section = page.locator('[data-testid="verification-status"]');
    await expect(section).toHaveScreenshot('flow-verification-status.png', ssOpts);
  });
});

// ---------------------------------------------------------------------------
// Variant C — Spatial
// ---------------------------------------------------------------------------

test.describe('Variant C: Spatial', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/spatial');
    await page.waitForSelector('[data-testid="spatial-canvas"]');
  });

  test('full page screenshot', async ({ page }) => {
    await expect(page).toHaveScreenshot('spatial-full.png', ssOpts);
  });

  test('canvas area', async ({ page }) => {
    const canvas = page.locator('[data-testid="spatial-canvas"]');
    await expect(canvas).toHaveScreenshot('spatial-canvas.png', ssOpts);
  });

  test('node click opens detail sidebar', async ({ page }) => {
    const node = page.locator('[data-testid^="node-"]').first();
    await node.click();
    await page.waitForSelector('[data-testid="detail-sidebar"]');
    await expect(page).toHaveScreenshot('spatial-with-sidebar.png', ssOpts);
  });

  test('detail sidebar content', async ({ page }) => {
    const node = page.locator('[data-testid^="node-"]').first();
    await node.click();
    const sidebar = page.locator('[data-testid="detail-sidebar"]');
    await expect(sidebar).toHaveScreenshot('spatial-detail-sidebar.png', ssOpts);
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test.describe('Navigation', () => {
  test('variant nav bar', async ({ page }) => {
    await page.goto('/command-center');
    await page.waitForSelector('[data-testid="variant-nav"]');
    const nav = page.locator('[data-testid="variant-nav"]');
    await expect(nav).toHaveScreenshot('variant-nav.png', ssOpts);
  });

  test('navigating between variants', async ({ page }) => {
    await page.goto('/command-center');
    await page.waitForSelector('[data-testid="agent-panel"]');
    await expect(page).toHaveScreenshot('nav-command-center.png', ssOpts);

    await page.click('text=B: Flow');
    await page.waitForSelector('[data-testid="summary-ribbon"]');
    await expect(page).toHaveScreenshot('nav-flow.png', ssOptsFull);

    await page.click('text=C: Spatial');
    await page.waitForSelector('[data-testid="spatial-canvas"]');
    await expect(page).toHaveScreenshot('nav-spatial.png', ssOpts);
  });
});
