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
// Nerve Center — Monitoring dashboard
// ---------------------------------------------------------------------------

test.describe('Nerve Center', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/nerve-center');
    await page.waitForSelector('[data-testid="nerve-center-shell"]');
  });

  test('full page', async ({ page }) => {
    await expect(page).toHaveScreenshot('nerve-center-full.png', ssOpts);
  });

  test('metrics bar', async ({ page }) => {
    const bar = page.locator('[data-testid="nerve-center-metrics"]');
    await expect(bar).toHaveScreenshot('nerve-center-metrics.png', ssOpts);
  });

  test('agent fleet', async ({ page }) => {
    const fleet = page.locator('[data-testid="nerve-center-fleet"]');
    await expect(fleet).toHaveScreenshot('nerve-center-fleet.png', ssOpts);
  });

  test('verification wall', async ({ page }) => {
    const wall = page.locator('[data-testid="nerve-center-verifications"]');
    await expect(wall).toHaveScreenshot('nerve-center-verifications.png', ssOpts);
  });

  test('execution timeline', async ({ page }) => {
    const timeline = page.locator('[data-testid="nerve-center-timeline"]');
    await expect(timeline).toHaveScreenshot('nerve-center-timeline.png', ssOpts);
  });

  test('attention queue', async ({ page }) => {
    const queue = page.locator('[data-testid="nerve-center-attention"]');
    await expect(queue).toHaveScreenshot('nerve-center-attention.png', ssOpts);
  });

  test('alert bar', async ({ page }) => {
    const bar = page.locator('[data-testid="nerve-center-alerts"]');
    await expect(bar).toHaveScreenshot('nerve-center-alerts.png', ssOpts);
  });
});

// ---------------------------------------------------------------------------
// Mosaic — Strategic overview radiator
// ---------------------------------------------------------------------------

test.describe('Mosaic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mosaic');
    await page.waitForSelector('[data-testid="mosaic-shell"]');
  });

  test('full page', async ({ page }) => {
    await expect(page).toHaveScreenshot('mosaic-full.png', ssOptsFull);
  });

  test('header', async ({ page }) => {
    const header = page.locator('[data-testid="mosaic-header"]');
    await expect(header).toHaveScreenshot('mosaic-header.png', ssOpts);
  });

  test('strategy card', async ({ page }) => {
    const card = page.locator('[data-testid="mosaic-strategy"]');
    await expect(card).toHaveScreenshot('mosaic-strategy.png', ssOpts);
  });

  test('agent fleet card', async ({ page }) => {
    const card = page.locator('[data-testid="mosaic-agents"]');
    await expect(card).toHaveScreenshot('mosaic-agents.png', ssOpts);
  });

  test('active work card', async ({ page }) => {
    const card = page.locator('[data-testid="mosaic-active"]');
    await expect(card).toHaveScreenshot('mosaic-active.png', ssOpts);
  });

  test('review queue card', async ({ page }) => {
    const card = page.locator('[data-testid="mosaic-reviews"]');
    await expect(card).toHaveScreenshot('mosaic-reviews.png', ssOpts);
  });

  test('verification matrix', async ({ page }) => {
    const card = page.locator('[data-testid="mosaic-verifications"]');
    await expect(card).toHaveScreenshot('mosaic-verifications.png', ssOpts);
  });

  test('cost breakdown', async ({ page }) => {
    const card = page.locator('[data-testid="mosaic-cost"]');
    await expect(card).toHaveScreenshot('mosaic-cost.png', ssOpts);
  });

  test('file activity', async ({ page }) => {
    const card = page.locator('[data-testid="mosaic-files"]');
    await expect(card).toHaveScreenshot('mosaic-files.png', ssOpts);
  });

  test('context library', async ({ page }) => {
    const card = page.locator('[data-testid="mosaic-context"]');
    await expect(card).toHaveScreenshot('mosaic-context.png', ssOpts);
  });
});

// ---------------------------------------------------------------------------
// Startup: Chat First
// ---------------------------------------------------------------------------

test.describe('Startup: Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/startup-chat');
    await page.waitForSelector('[data-testid="startup-chat-shell"]');
  });

  test('full page', async ({ page }) => {
    await expect(page).toHaveScreenshot('startup-chat-full.png', ssOpts);
  });

  test('hero area', async ({ page }) => {
    const hero = page.locator('[data-testid="startup-chat-hero"]');
    await expect(hero).toHaveScreenshot('startup-chat-hero.png', ssOpts);
  });

  test('action chips', async ({ page }) => {
    const actions = page.locator('[data-testid="startup-chat-actions"]');
    await expect(actions).toHaveScreenshot('startup-chat-actions.png', ssOpts);
  });

  test('chat input', async ({ page }) => {
    const input = page.locator('[data-testid="startup-chat-input"]');
    await expect(input).toHaveScreenshot('startup-chat-input.png', ssOpts);
  });

  test('recent tasks', async ({ page }) => {
    const recent = page.locator('[data-testid="startup-chat-recent"]');
    await expect(recent).toHaveScreenshot('startup-chat-recent.png', ssOpts);
  });
});

// ---------------------------------------------------------------------------
// Startup: Dashboard Home
// ---------------------------------------------------------------------------

test.describe('Startup: Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/startup-dashboard');
    await page.waitForSelector('[data-testid="startup-dashboard-shell"]');
  });

  test('full page', async ({ page }) => {
    await expect(page).toHaveScreenshot('startup-dashboard-full.png', ssOpts);
  });

  test('welcome header', async ({ page }) => {
    const header = page.locator('[data-testid="startup-dashboard-welcome"]');
    await expect(header).toHaveScreenshot('startup-dashboard-welcome.png', ssOpts);
  });

  test('recent tasks', async ({ page }) => {
    const tasks = page.locator('[data-testid="startup-dashboard-tasks"]');
    await expect(tasks).toHaveScreenshot('startup-dashboard-tasks.png', ssOpts);
  });

  test('agent activity', async ({ page }) => {
    const agents = page.locator('[data-testid="startup-dashboard-agents"]');
    await expect(agents).toHaveScreenshot('startup-dashboard-agents.png', ssOpts);
  });

  test('strategy progress', async ({ page }) => {
    const strategy = page.locator('[data-testid="startup-dashboard-strategy"]');
    await expect(strategy).toHaveScreenshot('startup-dashboard-strategy.png', ssOpts);
  });

  test('quick actions', async ({ page }) => {
    const actions = page.locator('[data-testid="startup-dashboard-actions"]');
    await expect(actions).toHaveScreenshot('startup-dashboard-actions.png', ssOpts);
  });
});

// ---------------------------------------------------------------------------
// Startup: Command Palette
// ---------------------------------------------------------------------------

test.describe('Startup: Command', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/startup-command');
    await page.waitForSelector('[data-testid="startup-command-shell"]');
  });

  test('full page', async ({ page }) => {
    await expect(page).toHaveScreenshot('startup-command-full.png', ssOpts);
  });

  test('command input', async ({ page }) => {
    const input = page.locator('[data-testid="startup-command-input"]');
    await expect(input).toHaveScreenshot('startup-command-input.png', ssOpts);
  });

  test('results panel', async ({ page }) => {
    const results = page.locator('[data-testid="startup-command-results"]');
    await expect(results).toHaveScreenshot('startup-command-results.png', ssOpts);
  });

  test('keyboard hints', async ({ page }) => {
    const hints = page.locator('[data-testid="startup-command-hints"]');
    await expect(hints).toHaveScreenshot('startup-command-hints.png', ssOpts);
  });
});

// ---------------------------------------------------------------------------
// Startup: Mission Brief
// ---------------------------------------------------------------------------

test.describe('Startup: Brief', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/startup-brief');
    await page.waitForSelector('[data-testid="startup-brief-shell"]');
  });

  test('full page', async ({ page }) => {
    await expect(page).toHaveScreenshot('startup-brief-full.png', ssOpts);
  });

  test('brief content', async ({ page }) => {
    const content = page.locator('[data-testid="startup-brief-content"]');
    await expect(content).toHaveScreenshot('startup-brief-content.png', ssOptsFull);
  });

  test('session summary', async ({ page }) => {
    const summary = page.locator('[data-testid="startup-brief-summary"]');
    await expect(summary).toHaveScreenshot('startup-brief-summary.png', ssOpts);
  });

  test('attention section', async ({ page }) => {
    const attention = page.locator('[data-testid="startup-brief-attention"]');
    await expect(attention).toHaveScreenshot('startup-brief-attention.png', ssOpts);
  });

  test('strategy progress', async ({ page }) => {
    const strategy = page.locator('[data-testid="startup-brief-strategy"]');
    await expect(strategy).toHaveScreenshot('startup-brief-strategy.png', ssOpts);
  });

  test('quick actions', async ({ page }) => {
    const actions = page.locator('[data-testid="startup-brief-actions"]');
    await expect(actions).toHaveScreenshot('startup-brief-actions.png', ssOpts);
  });

  test('chat panel', async ({ page }) => {
    const chat = page.locator('[data-testid="startup-brief-chat"]');
    await expect(chat).toHaveScreenshot('startup-brief-chat.png', ssOpts);
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
    await page.goto('/nerve-center');
    await page.waitForSelector('[data-testid="nerve-center-shell"]');
    await expect(page).toHaveScreenshot('nav-nerve-center.png', ssOpts);

    await page.click('text=Mosaic');
    await page.waitForSelector('[data-testid="mosaic-shell"]');
    await expect(page).toHaveScreenshot('nav-mosaic.png', ssOpts);

    await page.click('text=Chat');
    await page.waitForSelector('[data-testid="startup-chat-shell"]');
    await expect(page).toHaveScreenshot('nav-startup-chat.png', ssOpts);
  });
});
