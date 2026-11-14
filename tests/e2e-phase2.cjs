/**
 * E2E Phase 2 — independent Playwright check of the live Mode B flow for
 * ALL THREE scenarios, MCP over HTTP (all 3 tools), the real CDP possess
 * path over HTTP, the scope guardrail, and incident files on disk.
 * Run: node tests/e2e-phase2.cjs   (playwright is a repo dependency now)
 * Server must be running on http://localhost:8933 (npm run build && node dist/server.js).
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.POSSESSED_BASE || 'http://localhost:8933/';
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome';
const INCIDENTS = path.join(__dirname, '..', '.kiro', 'specs', 'incidents');

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
  const browser = await chromium.launch({
    executablePath: fs.existsSync(EXE) ? EXE : undefined,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const failedUrls = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  // The XSS payload's broken <img src=x> 404s by design (its onerror IS the
  // execution proof) — track failed URLs so that expected 404 is filtered.
  page.on('response', (r) => { if (r.status() >= 400) failedUrls.push(r.url()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  check('demo loads', (await page.title()).includes('Possessed UI'));
  check('footer honesty line present', (await page.textContent('footer')).includes('not a real CDP browser session'));
  check('footer Phase 2 marker', (await page.textContent('footer')).includes('Possessed UI Phase 2'));
  check('all 3 scenario buttons enabled', (await page.locator('.scenario:enabled').count()) === 3);
  check('initial balance $1,000.00', (await page.textContent('#wallet-balance')).trim() === '$1,000.00');
  check('displayed price $250.00', (await page.textContent('#displayed-price')).trim() === '$250.00');

  async function runScenario(id, unleashAsserts, immuneAsserts) {
    await page.click(`.scenario[data-scenario="${id}"]`);
    await page.click('#btn-unleash');
    await page.waitForSelector('#possessed-badge:not([hidden])', { timeout: 15000 });
    check(id + ' possessed badge appears', true);
    await unleashAsserts();
    await page.click('#btn-exorcise');
    await page.waitForSelector('#immune-badge:not([hidden])', { timeout: 15000 });
    check(id + ' immune badge appears', true);
    await immuneAsserts();
    await page.click('#btn-reset');
    await page.waitForFunction(
      () => document.getElementById('wallet-balance').textContent.trim() === '$1,000.00',
      { timeout: 5000 },
    );
    check(id + ' reset restores $1,000.00', true);
  }

  // --- Scenario 1: Chronos Race Poltergeist ---
  await runScenario(
    'RACE_DOUBLE_CHARGE',
    async () => {
      await page.waitForFunction(
        () => document.getElementById('wallet-balance').textContent.trim() === '$250.00',
        { timeout: 10000 },
      );
      check('race: balance crashes to $250.00', true);
      check('race: meta shows 3 charges', (await page.textContent('#wallet-meta')).includes('3 charges'));
      check('race: forensics shows violation', (await page.textContent('#f-corruption')).includes('Actual: $250.00'));
      check('race: forensics shows 3-click shrink', (await page.locator('#f-sequence li').count()) === 3);
    },
    async () => {
      check('race: balance healed to $750.00', (await page.textContent('#wallet-balance')).trim() === '$750.00');
      check('race: meta shows 1 charge, 0 errors', (await page.textContent('#wallet-meta')).includes('1 charge') && (await page.textContent('#wallet-meta')).includes('0 console errors'));
      check('race: diff loaded in forensics', (await page.textContent('#f-diff')).includes('inFlightCheckout'));
      check('race: integrity back to 100%', (await page.textContent('#integrity-text')).includes('100%'));
    },
  );

  // --- Scenario 2: Latency Wraith ---
  await runScenario(
    'NETWORK_3G_CHAOS',
    async () => {
      await page.waitForFunction(
        () => document.getElementById('displayed-price').textContent.trim() === '$225.00',
        { timeout: 10000 },
      );
      check('network: stale price $225.00 wins', true);
      check('network: currency still USD (stale)', (await page.textContent('#price-meta')).includes('USD'));
      check('network: forensics mentions stale', (await page.textContent('#f-corruption')).includes('Stale response won'));
      check('network: diff mentions AbortController', (await page.textContent('#f-diff')).includes('AbortController'));
    },
    async () => {
      check('network: displayed healed to $230.00 EUR', (await page.textContent('#displayed-price')).trim() === '$230.00');
      check('network: currency EUR after exorcism', (await page.textContent('#price-meta')).includes('EUR'));
    },
  );

  // --- Scenario 3: Storage & XSS Banshee ---
  const errorsBeforeStorage = errors.length;
  await page.click('.scenario[data-scenario="STORAGE_XSS_SPECTER"]');
  await page.click('#btn-unleash');
  await page.waitForSelector('#possessed-badge:not([hidden])', { timeout: 15000 });
  check('storage: possessed badge appears', true);
  const storageErrors = errors.slice(errorsBeforeStorage);
  check('storage: REAL SyntaxError pageerror captured', storageErrors.some((e) => e.includes('JSON') || e.includes('Unexpected token')), storageErrors.join(' | '));
  check('storage: XSS payload executed in real DOM', (await page.evaluate(() => window.__xssFired)) === 1);
  check('storage: forensics mentions throw + XSS', (await page.textContent('#f-corruption')).includes('threw') && (await page.textContent('#f-corruption')).includes('XSS'));
  const errorsBeforeExorcism = errors.length;
  const xssBeforeExorcism = await page.evaluate(() => window.__xssFired);
  await page.click('#btn-exorcise');
  await page.waitForSelector('#immune-badge:not([hidden])', { timeout: 15000 });
  check('storage: immune badge appears', true);
  check('storage: no new pageerror after exorcism', errors.length === errorsBeforeExorcism, errors.slice(errorsBeforeExorcism).join(' | '));
  check('storage: XSS did not fire again after exorcism', (await page.evaluate(() => window.__xssFired)) === xssBeforeExorcism);
  check('storage: cart shows escaped payload as text', (await page.textContent('#cart-view')).includes('&lt;img') || (await page.locator('#cart-view').innerHTML()).includes('&lt;img'));
  await page.click('#btn-reset');
  check('storage: reset clears XSS counter', (await page.evaluate(() => window.__xssFired)) === 0);

  // Vault tab loads the .kiro files.
  await page.click('.tab[data-tab="vault"]');
  await page.waitForSelector('#vault-list button', { timeout: 5000 });
  check('vault lists .kiro files', (await page.locator('#vault-list button').count()) >= 9);
  await page.locator('#vault-list button').first().click();
  check('vault shows file content', (await page.textContent('#vault-content')).length > 50);

  // No unexpected page errors outside the storage scenario's real SyntaxError
  // and the XSS payload's expected /x 404 (its onerror IS the proof).
  const xss404 = failedUrls.some((u) => u.endsWith('/x'));
  const realErrors = errors.filter(
    (e) => !e.includes('favicon') && !e.includes('JSON') && !e.includes('Unexpected token') && !(xss404 && e.includes('404')),
  );
  check('no other page errors', realErrors.length === 0, realErrors.join(' | '));
  check('XSS probe 404 is the expected /x (payload image)', xss404);

  await browser.close();

  // --- MCP over HTTP: all 3 tools ---
  const tools = await (await fetch(BASE + 'mcp/tools')).json();
  check('MCP tools/list returns 3 tools', tools.result.tools.length === 3);
  check('MCP tools include targetUrl + cdp args', JSON.stringify(tools.result.tools).includes('targetUrl'));
  for (const scenarioId of ['RACE_DOUBLE_CHARGE', 'NETWORK_3G_CHAOS', 'STORAGE_XSS_SPECTER']) {
    const { status, json } = await postJson(BASE + 'mcp/call', {
      jsonrpc: '2.0', id: 10, method: 'tools/call',
      params: { name: 'possess_target_ui', arguments: { scenarioId, cdp: false, networkAttempts: 25 } },
    });
    const report = JSON.parse(json.result.content[0].text);
    check(`MCP possess ${scenarioId} → ${report.status}`, status === 200 && ['POSSESSED_CRASH', 'EXORCISED_IMMUNE'].includes(report.status));
  }
  const forensics = await postJson(BASE + 'mcp/call', {
    jsonrpc: '2.0', id: 11, method: 'tools/call',
    params: { name: 'inspect_cdp_forensics', arguments: {} },
  });
  check('MCP inspect_cdp_forensics returns last run', JSON.parse(forensics.json.result.content[0].text).targetFile === 'target-app/phantom-pay.js');
  for (const scenarioId of ['RACE_DOUBLE_CHARGE', 'NETWORK_3G_CHAOS', 'STORAGE_XSS_SPECTER']) {
    const { json } = await postJson(BASE + 'mcp/call', {
      jsonrpc: '2.0', id: 12, method: 'tools/call',
      params: { name: 'exorcise_and_patch', arguments: { scenarioId } },
    });
    const out = JSON.parse(json.result.content[0].text);
    check(`MCP exorcise ${scenarioId} → IMMUNE`, out.verificationStatus === 'EXORCISED_IMMUNE');
  }

  // --- Real CDP possess over HTTP ---
  const cdpRes = await postJson(BASE + 'api/possess', { scenarioId: 'RACE_DOUBLE_CHARGE', cdp: true });
  check('CDP possess via HTTP → POSSESSED_CRASH', cdpRes.json.status === 'POSSESSED_CRASH');
  check('CDP possess forensics from real Chromium', cdpRes.json.cdpCapture?.capturedVia === 'playwright-cdp' && cdpRes.json.cdpCapture?.browser?.includes('Chrome/'));
  check('CDP forensics DOM snapshot has $250.00', (cdpRes.json.forensics?.domSnapshot || '').includes('$250.00'));

  // --- Scope guardrail over HTTP ---
  const guard = await postJson(BASE + 'api/possess', { scenarioId: 'RACE_DOUBLE_CHARGE', targetUrl: 'https://example.com/' });
  check('guardrail rejects example.com over HTTP', guard.status === 400 && (guard.json.error || '').includes('guardrail'));

  // --- Incident files for all 3 scenarios on disk ---
  const files = fs.readdirSync(INCIDENTS);
  for (const scenarioId of ['race_double_charge', 'network_3g_chaos', 'storage_xss_specter']) {
    check(`incident JSON exists for ${scenarioId}`, files.some((f) => f.startsWith(scenarioId + '-')));
  }

  console.log(failures === 0 ? 'E2E-PHASE2-ALL-PASS' : `E2E-PHASE2-${failures}-FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('E2E CRASH:', e);
  process.exit(1);
});
