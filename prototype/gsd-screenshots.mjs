import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const OUT = './screenshots/gsd';
mkdirSync(OUT, { recursive: true });

const args = [
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
  '--disable-dev-shm-usage', '--disable-software-rasterizer',
  '--single-process', '--no-zygote',
];

async function run() {
  const browser = await chromium.launch({ args });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:5173/gsd', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="gsd-shell"]', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // 1. Full page — default state (Phase 3 executing, chat with history)
  console.log('1. gsd-full.png');
  await page.screenshot({ path: `${OUT}/gsd-full.png` });

  // 2. Top bar
  console.log('2. gsd-topbar.png');
  await page.locator('[data-testid="gsd-topbar"]').screenshot({ path: `${OUT}/gsd-topbar.png` });

  // 3. Phase pipeline sidebar
  console.log('3. gsd-pipeline.png');
  await page.locator('[data-testid="gsd-pipeline"]').screenshot({ path: `${OUT}/gsd-pipeline.png` });

  // 4. Chat panel
  console.log('4. gsd-chat.png');
  await page.locator('[data-testid="gsd-chat"]').screenshot({ path: `${OUT}/gsd-chat.png` });

  // 5. Right panel (Phase Detail tab)
  console.log('5. gsd-right-phase.png');
  await page.locator('[data-testid="gsd-right"]').screenshot({ path: `${OUT}/gsd-right-phase.png` });

  // 6. Switch to Agents tab
  console.log('6. gsd-right-agents.png');
  await page.click('button:has-text("Agents")');
  await page.waitForTimeout(300);
  await page.locator('[data-testid="gsd-right"]').screenshot({ path: `${OUT}/gsd-right-agents.png` });
  // Full page with agents tab
  await page.screenshot({ path: `${OUT}/gsd-agents-full.png` });

  // 7. Switch back to Phase tab and click completed phase
  await page.click('button:has-text("Phase")');
  await page.waitForTimeout(200);

  // 8. Click Phase 1 (completed)
  console.log('8. gsd-phase-complete.png');
  await page.locator('[data-testid="gsd-pipeline"]').locator('text=Project scaffold & auth').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/gsd-phase-complete.png` });

  // 9. Click Phase 4 (planning - no plans yet)
  console.log('9. gsd-phase-planning.png');
  await page.locator('[data-testid="gsd-pipeline"]').locator('text=Dashboard UI').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/gsd-phase-planning.png` });

  // 10. Click Phase 3 (executing) back
  console.log('10. gsd-phase-executing.png');
  await page.locator('[data-testid="gsd-pipeline"]').locator('text=API routes & CRUD').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/gsd-phase-executing.png` });

  // 11. Command palette
  console.log('11. gsd-commands.png');
  await page.locator('[data-testid="gsd-commands"]').screenshot({ path: `${OUT}/gsd-commands.png` });

  // 12. Status bar
  console.log('12. gsd-statusbar.png');
  await page.locator('[data-testid="gsd-statusbar"]').screenshot({ path: `${OUT}/gsd-statusbar.png` });

  // 13. Todos section
  console.log('13. gsd-todos.png');
  await page.locator('[data-testid="gsd-todos"]').screenshot({ path: `${OUT}/gsd-todos.png` });

  await browser.close();
  console.log(`\nDone! Screenshots saved to ${OUT}/`);
}

run().catch(e => { console.error(e); process.exit(1); });
