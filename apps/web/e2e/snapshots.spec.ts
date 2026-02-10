import { test, expect } from 'playwright/test';

const ssOpts = { timeout: 20_000, animations: 'disabled' as const };
const ssOptsFull = { ...ssOpts, fullPage: true };

// ---------------------------------------------------------------------------
// Mock API responses so page renders without a backend
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  // Mock all API calls that the root layout makes
  await page.route('**/api/sessions', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/adapters', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  // Mock WebSocket upgrade to prevent connection errors
  await page.route('**/ws', (route) =>
    route.fulfill({ status: 200, body: '' }),
  );

  await page.goto('/snapshots');
  // Wait for the snapshot page content to render
  await page.waitForSelector('[data-testid="section-primitives"]', { timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Full page
// ---------------------------------------------------------------------------

test('full page', async ({ page }) => {
  await expect(page).toHaveScreenshot('snapshots-full.png', ssOptsFull);
});

// ---------------------------------------------------------------------------
// App Shell — High-Level Screens
// ---------------------------------------------------------------------------

test('app-shell-running', async ({ page }) => {
  const el = page.locator('[data-testid="ss-shell-running"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('shell-running.png', ssOpts);
});

test('app-shell-completed', async ({ page }) => {
  const el = page.locator('[data-testid="ss-shell-completed"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('shell-completed.png', ssOpts);
});

test('app-shell-empty', async ({ page }) => {
  const el = page.locator('[data-testid="ss-shell-empty"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('shell-empty.png', ssOpts);
});

test('app-shell-three-panel', async ({ page }) => {
  const el = page.locator('[data-testid="ss-shell-three-panel"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('shell-three-panel.png', ssOpts);
});

test('app-shell-focused', async ({ page }) => {
  const el = page.locator('[data-testid="ss-shell-focused"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('shell-focused.png', ssOpts);
});

test('app-shell-collapsed', async ({ page }) => {
  const el = page.locator('[data-testid="ss-shell-collapsed"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('shell-collapsed.png', ssOpts);
});

test('app-shell-no-sessions', async ({ page }) => {
  const el = page.locator('[data-testid="ss-shell-no-sessions"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('shell-no-sessions.png', ssOpts);
});

test('app-shell-detail-collapsed', async ({ page }) => {
  const el = page.locator('[data-testid="ss-shell-detail-collapsed"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('shell-detail-collapsed.png', ssOpts);
});

// ---------------------------------------------------------------------------
// Primitives (shadcn/ui)
// ---------------------------------------------------------------------------

test('button', async ({ page }) => {
  const el = page.locator('[data-testid="ss-button"]');
  await expect(el).toHaveScreenshot('button.png', ssOpts);
});

test('badge', async ({ page }) => {
  const el = page.locator('[data-testid="ss-badge"]');
  await expect(el).toHaveScreenshot('badge.png', ssOpts);
});

test('card', async ({ page }) => {
  const el = page.locator('[data-testid="ss-card"]');
  await expect(el).toHaveScreenshot('card.png', ssOpts);
});

test('separator', async ({ page }) => {
  const el = page.locator('[data-testid="ss-separator"]');
  await expect(el).toHaveScreenshot('separator.png', ssOpts);
});

test('skeleton', async ({ page }) => {
  const el = page.locator('[data-testid="ss-skeleton"]');
  await expect(el).toHaveScreenshot('skeleton.png', ssOpts);
});

test('scroll-area', async ({ page }) => {
  const el = page.locator('[data-testid="ss-scroll-area"]');
  await expect(el).toHaveScreenshot('scroll-area.png', ssOpts);
});

// ---------------------------------------------------------------------------
// Form & Data Components
// ---------------------------------------------------------------------------

test('input', async ({ page }) => {
  const el = page.locator('[data-testid="ss-input"]');
  await expect(el).toHaveScreenshot('input.png', ssOpts);
});

test('textarea', async ({ page }) => {
  const el = page.locator('[data-testid="ss-textarea"]');
  await expect(el).toHaveScreenshot('textarea.png', ssOpts);
});

test('checkbox-switch', async ({ page }) => {
  const el = page.locator('[data-testid="ss-checkbox-switch"]');
  await expect(el).toHaveScreenshot('checkbox-switch.png', ssOpts);
});

test('slider', async ({ page }) => {
  const el = page.locator('[data-testid="ss-slider"]');
  await expect(el).toHaveScreenshot('slider.png', ssOpts);
});

test('progress', async ({ page }) => {
  const el = page.locator('[data-testid="ss-progress"]');
  await expect(el).toHaveScreenshot('progress.png', ssOpts);
});

test('tabs', async ({ page }) => {
  const el = page.locator('[data-testid="ss-tabs"]');
  await expect(el).toHaveScreenshot('tabs.png', ssOpts);
});

test('avatar', async ({ page }) => {
  const el = page.locator('[data-testid="ss-avatar"]');
  await expect(el).toHaveScreenshot('avatar.png', ssOpts);
});

test('alert', async ({ page }) => {
  const el = page.locator('[data-testid="ss-alert"]');
  await expect(el).toHaveScreenshot('alert.png', ssOpts);
});

test('table', async ({ page }) => {
  const el = page.locator('[data-testid="ss-table"]');
  await expect(el).toHaveScreenshot('table.png', ssOpts);
});

test('toggle', async ({ page }) => {
  const el = page.locator('[data-testid="ss-toggle"]');
  await expect(el).toHaveScreenshot('toggle.png', ssOpts);
});

test('tooltip', async ({ page }) => {
  const el = page.locator('[data-testid="ss-tooltip"]');
  await expect(el).toHaveScreenshot('tooltip.png', ssOpts);
});

// ---------------------------------------------------------------------------
// Chat UI (assistant-ui)
// ---------------------------------------------------------------------------

test('session-panel', async ({ page }) => {
  const el = page.locator('[data-testid="ss-session-panel"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('session-panel.png', ssOpts);
});

test('session-panel-empty', async ({ page }) => {
  const el = page.locator('[data-testid="ss-session-panel-empty"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('session-panel-empty.png', ssOpts);
});

// ---------------------------------------------------------------------------
// Concept Components
// ---------------------------------------------------------------------------

test('skill-card', async ({ page }) => {
  const el = page.locator('[data-testid="ss-skill-card"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('skill-card.png', ssOpts);
});

test('task-card', async ({ page }) => {
  const el = page.locator('[data-testid="ss-task-card"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('task-card.png', ssOpts);
});

test('mcp-browser', async ({ page }) => {
  const el = page.locator('[data-testid="ss-mcp-browser"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('mcp-browser.png', ssOpts);
});

test('hook-config', async ({ page }) => {
  const el = page.locator('[data-testid="ss-hook-config"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('hook-config.png', ssOpts);
});

test('worktree-selector', async ({ page }) => {
  const el = page.locator('[data-testid="ss-worktree"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('worktree-selector.png', ssOpts);
});

test('research-doc', async ({ page }) => {
  const el = page.locator('[data-testid="ss-research-doc"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('research-doc.png', ssOpts);
});

// ---------------------------------------------------------------------------
// Chat Elements
// ---------------------------------------------------------------------------

test('tool-call-viewer', async ({ page }) => {
  const el = page.locator('[data-testid="ss-tool-call"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('tool-call-viewer.png', ssOpts);
});

test('code-block', async ({ page }) => {
  const el = page.locator('[data-testid="ss-code-block"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('code-block.png', ssOpts);
});

test('cost-ticker', async ({ page }) => {
  const el = page.locator('[data-testid="ss-cost-ticker"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('cost-ticker.png', ssOpts);
});

test('diff-view', async ({ page }) => {
  const el = page.locator('[data-testid="ss-diff-view"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('diff-view.png', ssOpts);
});

test('progress-indicator', async ({ page }) => {
  const el = page.locator('[data-testid="ss-progress-indicator"]');
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot('progress-indicator.png', ssOpts);
});
