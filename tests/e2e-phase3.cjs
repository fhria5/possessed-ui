/**
 * E2E Phase 3 — independent Playwright + HTTP check of the PBT Exorcism
 * deck, the /api/exorcism report, the MCP quarantine surface, and a
 * regression smoke run of the race scenario in Mode B.
 * Run: node tests/e2e-phase3.cjs
 * Server must be running on http://localhost:8933 (npm run build && node dist/server.js).
 * The exorcism report must exist (node tools/run_exorcism.cjs).
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.POSSESSED_BASE || 'http://localhost:8933/';
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome';
const REPORT = path.join(__dirname, '..', 'public', 'exorcism-report.json');

let failures = 0;
function check(name, ok, extra = '') {
  console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? ' — ' + extra : ''));
  if (!ok) failures += 1;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

(async () => {
  // --- Exorcism report on disk (the source of the deck's numbers) ---
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  check('exorcism report phase 3', report.phase === 3);
  check('report runs 100/scenario', report.runsPerScenario === 100);
  check('report race before 7/100 demon', report.scenarios.RACE_DOUBLE_CHARGE.before.violations === 7);
  check('report storage before 33/100 demon', report.scenarios.STORAGE_XSS_SPECTER.before.violations === 33);
  check('report network before 0/100 (no demon, honest)', report.scenarios.NETWORK_3G_CHAOS.before.violations === 0);
  check('report after 0/100 all scenarios', Object.values(report.scenarios).every((s) => s.after.violations === 0));
  check('report demon names recorded', report.scenarios.RACE_DOUBLE_CHARGE.demonBug.name.includes('180ms') &&
    report.scenarios.STORAGE_XSS_SPECTER.demonBug.name.includes('Shape-Shifter'));
  check('report race demon shrunk to 5 steps', report.scenarios.RACE_DOUBLE_CHARGE.demonBug.shrunkSequence.length === 5);
  check('report storage demon shrunk to 1 step', report.scenarios.STORAGE_XSS_SPECTER.demonBug.shrunkSequence.length === 1);
  check('report not quarantined', report.quarantine.quarantined === false);

  // --- Server API ---
  const health = await (await fetch(BASE + 'api/health')).json();
  check('health mode phase-4', health.mode === 'phase-4');
  const exorcism = await (await fetch(BASE + 'api/exorcism')).json();
  check('/api/exorcism serves the report', exorcism.phase === 3 && exorcism.runsPerScenario === 100);
  check('/api/exorcism race after 0 violations', exorcism.scenarios.RACE_DOUBLE_CHARGE.after.violations === 0);
  const quarantine = await (await fetch(BASE + 'api/quarantine')).json();
  check('/api/quarantine empty', Array.isArray(quarantine.quarantined) && quarantine.quarantined.length === 0);
  const tools = await (await fetch(BASE + 'mcp/tools')).json();
  check('MCP tools/list returns 3 tools', tools.result.tools.length === 3);
  check('MCP tools none quarantined', tools.result.tools.every((t) => t.quarantined === false));

  // --- MCP exorcise_and_patch over HTTP (bounded verification, not quarantined) ---
  const { json } = await postJson(BASE + 'mcp/call', {
    jsonrpc: '2.0', id: 30, method: 'tools/call',
    params: { name: 'exorcise_and_patch', arguments: { scenarioId: 'RACE_DOUBLE_CHARGE' } },
  });
  const out = JSON.parse(json.result.content[0].text);
  check('MCP exorcise → ok + IMMUNE + 0 violations', out.status === 'ok' &&
    out.verificationStatus === 'EXORCISED_IMMUNE' && out.postPatchViolations === 0);

  // --- Mode B deck in the browser ---
  const browser = await chromium.launch({
    executablePath: fs.existsSync(EXE) ? EXE : undefined,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  check('demo loads', (await page.title()).includes('Possessed UI'));
  check('footer Phase 4 marker', (await page.textContent('footer')).includes('Possessed UI Phase 4'));
  check('footer honesty line present', (await page.textContent('footer')).includes('not a real CDP browser session'));

  await page.click('.tab[data-tab="exorcism"]');
  await page.waitForSelector('#exorcism-deck .deck-card', { timeout: 10000 });
  const deckText = await page.textContent('#exorcism-deck');
  check('deck shows 3 scenario cards', (await page.locator('#exorcism-deck .deck-card').count()) === 3);
  check('deck shows race demon name', deckText.includes('The 180ms Window Demon'));
  check('deck shows storage demon name', deckText.includes('The Shape-Shifter Demon'));
  check('deck shows race before 7/100', deckText.includes('7/100'));
  check('deck shows storage before 33/100', deckText.includes('33/100'));
  check('deck shows 100/100 clean after patch', deckText.includes('100/100 clean runs'));
  check('deck shows shrunk sequence', deckText.includes('Shrunk to 5 steps') && deckText.includes('Shrunk to 1 steps'));
  check('deck shows Auto-Patch text', deckText.includes('Idempotency grace window') && deckText.includes('shape validation'));
  check('deck shows no-demon note for network', deckText.includes('No demon bug found'));

  // --- Regression smoke: race scenario end-to-end in Mode B ---
  await page.click('.scenario[data-scenario="RACE_DOUBLE_CHARGE"]');
  await page.click('#btn-unleash');
  await page.waitForSelector('#possessed-badge:not([hidden])', { timeout: 15000 });
  await page.waitForFunction(
    () => document.getElementById('wallet-balance').textContent.trim() === '$250.00',
    { timeout: 10000 },
  );
  check('race smoke: balance crashes to $250.00', true);
  await page.click('#btn-exorcise');
  await page.waitForSelector('#immune-badge:not([hidden])', { timeout: 15000 });
  check('race smoke: balance healed to $750.00', (await page.textContent('#wallet-balance')).trim() === '$750.00');

  const realErrors = errors.filter((e) => !e.includes('favicon'));
  check('no page errors', realErrors.length === 0, realErrors.join(' | '));
  await browser.close();

  console.log(failures === 0 ? 'E2E-PHASE3-ALL-PASS' : `E2E-PHASE3-${failures}-FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('E2E CRASH:', e);
  process.exit(1);
});
