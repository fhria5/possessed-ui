/**
 * E2E Phase 1 — independent Playwright check of the live Mode B flow
 * against the LOCAL server (same files as Pages).
 * Run: NODE_PATH=/home/hatch/workspace/shoppal-v2/node_modules node tests/e2e-phase1.cjs
 * Server must be running on http://localhost:8933 (npm run build && node dist/server.js).
 */
const { chromium } = require('playwright');

const BASE = process.env.POSSESSED_BASE || 'http://localhost:8933/';
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome';

let failures = 0;
function check(name, ok, extra = '') {
  console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? ' — ' + extra : ''));
  if (!ok) failures += 1;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  check('demo loads', (await page.title()).includes('Possessed UI'));
  check('footer honesty line present', (await page.textContent('footer')).includes('not a real CDP browser session'));
  check('footer Phase 1 marker', (await page.textContent('footer')).includes('Possessed UI Phase 1'));
  check('scenario 2 disabled (Phase 2)', await page.locator('.scenario').nth(1).isDisabled());
  check('scenario 3 disabled (Phase 2)', await page.locator('.scenario').nth(2).isDisabled());
  check('initial balance $1,000.00', (await page.textContent('#wallet-balance')).trim() === '$1,000.00');

  // Unleash the Poltergeist.
  await page.click('#btn-unleash');
  await page.waitForSelector('#possessed-badge:not([hidden])', { timeout: 10000 });
  check('possessed badge appears', true);
  await page.waitForFunction(
    () => document.getElementById('wallet-balance').textContent.trim() === '$250.00',
    { timeout: 10000 },
  );
  check('balance crashes to $250.00', true);
  check('meta shows 3 charges', (await page.textContent('#wallet-meta')).includes('3 charges'));
  check('target has glitch class', await page.locator('#target-app').evaluate((el) => el.classList.contains('possessed')));
  check('exorcism button appears', await page.locator('#btn-exorcise').isVisible());
  check('forensics shows violation', (await page.textContent('#f-corruption')).includes('Actual: $250.00'));
  check('forensics shows 3-click shrink', (await page.locator('#f-sequence li').count()) === 3);

  // Perform Exorcism → auto re-run → immune.
  await page.click('#btn-exorcise');
  await page.waitForSelector('#immune-badge:not([hidden])', { timeout: 15000 });
  check('immune badge appears', true);
  check('balance healed to $750.00', (await page.textContent('#wallet-balance')).trim() === '$750.00');
  check('meta shows 1 charge, 0 errors', (await page.textContent('#wallet-meta')).includes('1 charge') && (await page.textContent('#wallet-meta')).includes('0 console errors'));
  check('diff loaded in forensics', (await page.textContent('#f-diff')).includes('inFlightCheckout'));
  check('integrity back to 100%', (await page.textContent('#integrity-text')).includes('100%'));

  // Reset → vulnerable again.
  await page.click('#btn-reset');
  await page.waitForFunction(
    () => document.getElementById('wallet-balance').textContent.trim() === '$1,000.00',
    { timeout: 5000 },
  );
  check('reset restores $1,000.00', true);
  check('exorcism button hidden after reset', await page.locator('#btn-exorcise').isHidden());

  // Vault tab loads the .kiro files.
  await page.click('.tab[data-tab="vault"]');
  await page.waitForSelector('#vault-list button', { timeout: 5000 });
  check('vault lists .kiro files', (await page.locator('#vault-list button').count()) >= 9);
  await page.locator('#vault-list button').first().click();
  check('vault shows file content', (await page.textContent('#vault-content')).length > 50);

  // No unexpected page errors (favicon 404 is tolerated: there is no favicon yet).
  const realErrors = errors.filter((e) => !e.includes('favicon'));
  check('no page errors', realErrors.length === 0, realErrors.join(' | '));

  await browser.close();
  console.log(failures === 0 ? 'E2E-PHASE1-ALL-PASS' : `E2E-PHASE1-${failures}-FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('E2E CRASH:', e);
  process.exit(1);
});
