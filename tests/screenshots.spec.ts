import { test, expect } from '@playwright/test';

const ssOpts = { timeout: 20_000, animations: 'disabled' as const };
const ssOptsFull = { ...ssOpts, fullPage: true };

// ---------------------------------------------------------------------------
// AgentOS
// ---------------------------------------------------------------------------

test.describe('AgentOS', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agent-os');
    await page.waitForSelector('[data-testid="agent-os-shell"]');
  });

  test('full page — task board', async ({ page }) => {
    await expect(page).toHaveScreenshot('agent-os-taskboard-full.png', ssOpts);
  });

  test('sidebar', async ({ page }) => {
    const sidebar = page.locator('[data-testid="agent-os-sidebar"]');
    await expect(sidebar).toHaveScreenshot('agent-os-sidebar.png', ssOpts);
  });

  test('task board', async ({ page }) => {
    const board = page.locator('[data-testid="agent-os-taskboard"]');
    await expect(board).toHaveScreenshot('agent-os-taskboard.png', ssOpts);
  });

  test('agent console', async ({ page }) => {
    const console_ = page.locator('[data-testid="agent-os-console"]');
    await expect(console_).toHaveScreenshot('agent-os-console.png', ssOpts);
  });

  test('generative widget', async ({ page }) => {
    const widget = page.locator('[data-testid="agent-os-gen-widget"]');
    await expect(widget).toHaveScreenshot('agent-os-gen-widget.png', ssOpts);
  });

  test('magic input', async ({ page }) => {
    const input = page.locator('[data-testid="agent-os-magic-input"]');
    await expect(input).toHaveScreenshot('agent-os-magic-input.png', ssOpts);
  });

  test('plan view', async ({ page }) => {
    await page.click('text=Plan View');
    await page.waitForSelector('[data-testid="agent-os-planview"]');
    await expect(page).toHaveScreenshot('agent-os-planview-full.png', ssOpts);
  });

  test('plan view content', async ({ page }) => {
    await page.click('text=Plan View');
    const plan = page.locator('[data-testid="agent-os-planview"]');
    await expect(plan).toHaveScreenshot('agent-os-planview.png', ssOpts);
  });
});

// ---------------------------------------------------------------------------
// Hive — Agent-column kanban
// ---------------------------------------------------------------------------

test.describe('Hive', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/hive');
    await page.waitForSelector('[data-testid="hive-shell"]');
  });

  test('full page', async ({ page }) => {
    await expect(page).toHaveScreenshot('hive-full.png', ssOpts);
  });

  test('agent column — running', async ({ page }) => {
    const col = page.locator('[data-testid="hive-agent-agent-1"]');
    await expect(col).toHaveScreenshot('hive-agent-running.png', ssOpts);
  });

  test('agent column — idle', async ({ page }) => {
    const col = page.locator('[data-testid="hive-agent-agent-2"]');
    await expect(col).toHaveScreenshot('hive-agent-idle.png', ssOpts);
  });

  test('unassigned column', async ({ page }) => {
    const col = page.locator('[data-testid="hive-unassigned"]');
    await expect(col).toHaveScreenshot('hive-unassigned.png', ssOpts);
  });

  test('trust badge click cycles', async ({ page }) => {
    const badge = page.locator('[data-testid="hive-trust-agent-1"]');
    await expect(badge).toHaveScreenshot('hive-trust-autonomous.png', ssOpts);
    await badge.click();
    await expect(badge).toHaveScreenshot('hive-trust-supervised.png', ssOpts);
  });
});

// ---------------------------------------------------------------------------
// Pipeline — Stage-gate kanban
// ---------------------------------------------------------------------------

test.describe('Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pipeline');
    await page.waitForSelector('[data-testid="pipeline-shell"]');
  });

  test('full page', async ({ page }) => {
    await expect(page).toHaveScreenshot('pipeline-full.png', ssOpts);
  });

  test('backlog stage', async ({ page }) => {
    const stage = page.locator('[data-testid="pipeline-backlog"]');
    await expect(stage).toHaveScreenshot('pipeline-backlog.png', ssOpts);
  });

  test('working stage', async ({ page }) => {
    const stage = page.locator('[data-testid="pipeline-working"]');
    await expect(stage).toHaveScreenshot('pipeline-working.png', ssOpts);
  });

  test('review gate', async ({ page }) => {
    const stage = page.locator('[data-testid="pipeline-review"]');
    await expect(stage).toHaveScreenshot('pipeline-review.png', ssOpts);
  });

  test('review card', async ({ page }) => {
    const card = page.locator('[data-testid="pipeline-review-card"]').first();
    await expect(card).toHaveScreenshot('pipeline-review-card.png', ssOpts);
  });

  test('done stage', async ({ page }) => {
    const stage = page.locator('[data-testid="pipeline-done"]');
    await expect(stage).toHaveScreenshot('pipeline-done.png', ssOpts);
  });
});

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
    await page.goto('/agent-os');
    await page.waitForSelector('[data-testid="variant-nav"]');
    const nav = page.locator('[data-testid="variant-nav"]');
    await expect(nav).toHaveScreenshot('variant-nav.png', ssOpts);
  });

  test('navigating between variants', async ({ page }) => {
    await page.goto('/hive');
    await page.waitForSelector('[data-testid="hive-shell"]');
    await expect(page).toHaveScreenshot('nav-hive.png', ssOpts);

    await page.click('text=Pipeline');
    await page.waitForSelector('[data-testid="pipeline-shell"]');
    await expect(page).toHaveScreenshot('nav-pipeline.png', ssOpts);

    await page.click('text=Command Center');
    await page.waitForSelector('[data-testid="agent-panel"]');
    await expect(page).toHaveScreenshot('nav-command-center.png', ssOpts);
  });
});
