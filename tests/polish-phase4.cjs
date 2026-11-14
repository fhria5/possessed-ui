/**
 * E2E Phase 4 — independent Playwright + HTTP polish checks.
 * Run: node tests/polish-phase4.cjs
 * Server must be running on http://localhost:8933 (npm run build && node dist/server.js).
 * Checks: no horizontal overflow at 390/1280, tap targets >= 44px,
 * :focus-visible outline, prefers-reduced-motion, favicon, Phase 4 marker,
 * vault file count (audit: kiro-files.json holds ALL .kiro files, not 9),
 * and the MCP stdio transport (src/engine/mcp-stdio.ts) over a real spawn.
 */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.POSSESSED_BASE || 'http://localhost:8933/';
const EXE = '/home/hatch/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome';
const ROOT = path.join(__dirname, '..');

let failures = 0;
function check(name, ok, extra = '') {
  console.log((ok ? 'PASS' : 'FAIL') + ' — ' + name + (extra ? ' — ' + extra : ''));
  if (!ok) failures += 1;
}

async function measureViewport(page, width) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const m = await page.evaluate(() => {
    const inner = window.innerWidth;
    const docW = document.documentElement.scrollWidth;
    const targets = [];
    document.querySelectorAll('button, input, select, a[href]').forEach((el) => {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      targets.push({ id: el.id || (el.textContent || '').trim().slice(0, 24), min: Math.min(r.width, r.height) });
    });
    targets.sort((a, b) => a.min - b.min);
    return { inner, docW, smallest: targets[0] || null, under44: targets.filter((t) => t.min < 44) };
  });
  check(`no horizontal overflow at ${width}px`, m.docW <= m.inner, `scrollWidth=${m.docW} innerWidth=${m.inner}`);
  check(
    `tap targets >= 44px at ${width}px`,
    m.under44.length === 0,
    m.smallest ? `smallest=${m.smallest.min}px (${m.smallest.id})` : 'none',
  );
  return m;
}

async function stdioSmoke() {
  // Spawn the real stdio transport, speak MCP JSON-RPC over its stdin.
  const child = spawn('node', [path.join(ROOT, 'dist', 'engine', 'mcp-stdio.js')], {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, POSSESSED_BASE_URL: 'http://127.0.0.1:8933' },
  });
  let out = '';
  let err = '';
  child.stdout.on('data', (d) => { out += d.toString(); });
  child.stderr.on('data', (d) => { err += d.toString(); });
  const send = (obj) => child.stdin.write(JSON.stringify(obj) + '\n');
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'polish-test', version: '0.0.0' } } });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const lines = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('stdio timeout')), 15000);
    const iv = setInterval(() => {
      const ls = out.split('\n').filter(Boolean);
      if (ls.length >= 2) { clearTimeout(timer); clearInterval(iv); resolve(ls); }
    }, 100);
    child.on('error', reject);
  });
  child.stdin.end();
  await new Promise((r) => child.on('close', r));
  const init = JSON.parse(lines[0]);
  const list = JSON.parse(lines[1]);
  check('mcp-stdio initialize answers', init.result && init.result.serverInfo && init.result.serverInfo.name === 'possessed-ui-exorcist');
  check(
    'mcp-stdio tools/list returns 3 tools',
    list.result && Array.isArray(list.result.tools) && list.result.tools.length === 3,
    list.result && list.result.tools ? list.result.tools.map((t) => t.name).join(',') : '',
  );
  check('mcp-stdio writes nothing to stderr', err.trim() === '', err.trim().slice(0, 120));
}

(async () => {
  const health = await (await fetch(BASE + 'api/health')).json();
  check('health mode phase-4', health.mode === 'phase-4');
  const fav = await fetch(BASE + 'favicon.svg');
  check('favicon 200 (local, not hotlinked)', fav.status === 200 && (fav.headers.get('content-type') || '').includes('svg'));

  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

  // --- Viewport measurements (390 = phone, 1280 = desktop) ---
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await measureViewport(page, 390);
  await measureViewport(page, 1280);

  // --- Focus-visible via keyboard ---
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return { id: el.id, outline: cs.outlineStyle + ' ' + cs.outlineWidth };
  });
  check(':focus-visible outline on Tab', focus.outline.startsWith('solid 2px'), `${focus.id}: ${focus.outline}`);
  check('demo loads', (await page.title()).includes('Possessed UI'));
  check('footer Phase 4 marker', (await page.textContent('footer')).includes('Possessed UI Phase 4'));
  check('footer honesty line present', (await page.textContent('footer')).includes('not a real CDP browser session'));

  // --- Vault audit: kiro-files.json holds ALL .kiro files, not 9 ---
  const vault = await (await fetch(BASE + 'kiro-files.json')).json();
  check('vault lists > 9 .kiro files (audit fix)', vault.files.length > 9, `${vault.files.length} files`);
  check('vault includes incidents', vault.files.some((f) => f.path.startsWith('specs/incidents/')));
  const mcpEntry = vault.files.find((f) => f.path === 'settings/mcp.json');
  check(
    'vault mcp.json points at real stdio entry',
    !!mcpEntry && mcpEntry.content.includes('dist/engine/mcp-stdio.js') && !mcpEntry.content.includes('tsx'),
    mcpEntry ? 'dist/engine/mcp-stdio.js' : 'mcp.json missing',
  );
  await page.close();

  // --- prefers-reduced-motion ---
  const rmPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await rmPage.goto(BASE, { waitUntil: 'networkidle' });
  const rm = await rmPage.evaluate(() => {
    const ghost = getComputedStyle(document.getElementById('ghost-cursor'));
    const target = document.getElementById('target-app');
    target.classList.add('possessed');
    return {
      ghostTransition: ghost.transitionDuration,
      glitchAnimation: getComputedStyle(target).animationName,
      meterTransition: getComputedStyle(document.getElementById('integrity-fill')).transitionDuration,
    };
  });
  check('reduced-motion: ghost cursor transition off', rm.ghostTransition === '0s', rm.ghostTransition);
  check('reduced-motion: glitch animation off', rm.glitchAnimation === 'none', rm.glitchAnimation);
  check('reduced-motion: meter transition off', rm.meterTransition === '0s', rm.meterTransition);
  await rmPage.close();
  await browser.close();

  // --- MCP stdio smoke ---
  await stdioSmoke();

  // --- package.json: test:pbt script exists (hooks reference it) ---
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  check('package.json has test:pbt script', typeof pkg.scripts['test:pbt'] === 'string' && pkg.scripts['test:pbt'].includes('vitest'));

  console.log(failures === 0 ? 'E2E-PHASE4-ALL-PASS' : `E2E-PHASE4-${failures}-FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
