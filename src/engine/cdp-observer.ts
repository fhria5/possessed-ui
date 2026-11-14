/**
 * CDP & DOM Forensics Medium (blueprint Task 2).
 *
 * Phase 2 reality:
 * - captureBrowserPossession() opens a REAL Chromium via Playwright and
 *   drives the REAL target-app (public/cdp-harness.html, served from the
 *   local server) — real clicks, real localStorage, real pageerrors with
 *   real stack traces, real CDP network events. That is the forensics the
 *   server path returns (Task 2.1).
 * - The in-process captureForensics() below is kept as a fast fallback
 *   (used when Playwright/Chromium is unavailable, and labelled as such).
 * - The scope guardrail IS enforced before any browser launch: only
 *   localhost / 127.0.0.1 / the embedded sandbox frame.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from 'playwright';
import type {
  ChaosActionStep,
  PossessionForensics,
  PossessionScenarioId,
} from '../types/possessed';

export const TARGET_FILE = 'target-app/phantom-pay.js';

const ENTITY_NAMES: Record<PossessionScenarioId, string> = {
  RACE_DOUBLE_CHARGE: 'Chronos Race Poltergeist',
  NETWORK_3G_CHAOS: 'Latency Wraith',
  STORAGE_XSS_SPECTER: 'Storage & XSS Banshee',
};

export function classifyEntity(scenarioId: PossessionScenarioId): string {
  return ENTITY_NAMES[scenarioId];
}

/** Strict localhost-only scope guardrail (blueprint REQ 4.1). */
export function assertScopeAllowed(targetUrl: string): { allowed: boolean; reason: string } {
  if (targetUrl === 'sandbox' || targetUrl === 'about:blank' || targetUrl.startsWith('sandbox://')) {
    return { allowed: true, reason: 'embedded sandbox frame' };
  }
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { allowed: false, reason: `not a valid URL: ${targetUrl}` };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { allowed: false, reason: `protocol ${parsed.protocol} is not http(s)` };
  }
  if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
    return { allowed: true, reason: `localhost target ${parsed.hostname}` };
  }
  return { allowed: false, reason: `host ${parsed.hostname} is outside the localhost allowlist` };
}

export function targetUrlAllowed(targetUrl: string): boolean {
  return assertScopeAllowed(targetUrl).allowed;
}

/** Find the 1-based source line of a named function in the target file. */
export function findFunctionLine(functionName: string): number {
  const file = path.join(__dirname, '..', '..', TARGET_FILE);
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`function ${functionName}`)) return i + 1;
  }
  return -1;
}

/** Serialize a PhantomPay snapshot into a DOM-like snapshot string. */
export function snapshotDom(snapshot: {
  balance: string;
  balanceCents: number;
  charges: number;
  totalChargedCents: number;
  displayedPrice: string;
  consoleErrors: number;
}): string {
  return [
    '<div id="phantom-pay" data-balance-cents="' + snapshot.balanceCents + '">',
    '  <span id="wallet-balance">' + snapshot.balance + '</span>',
    '  <span id="charges-count">' + snapshot.charges + '</span>',
    '  <span id="total-charged-cents">' + snapshot.totalChargedCents + '</span>',
    '  <span id="displayed-price">' + snapshot.displayedPrice + '</span>',
    '  <span id="console-errors">' + snapshot.consoleErrors + '</span>',
    '</div>',
  ].join('\n');
}

export function captureForensics(input: {
  scenarioId: PossessionScenarioId;
  functionName: string;
  consoleError: string;
  domSnapshot: string;
  stateCorruptionDetail: string;
}): PossessionForensics {
  const stack = new Error('possession-forensics').stack ?? '';
  const ownFrames = stack
    .split('\n')
    .filter((l) => l.includes('phantom-pay') || l.includes('poltergeist') || l.includes('possessed'))
    .join('\n');
  return {
    targetFile: TARGET_FILE,
    lineNumber: findFunctionLine(input.functionName),
    consoleError: input.consoleError,
    domSnapshot: input.domSnapshot,
    stateCorruptionDetail: input.stateCorruptionDetail,
    stackTrace: ownFrames || stack.split('\n').slice(0, 4).join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Real Playwright/CDP capture (Task 2.1, Phase 2).
// ---------------------------------------------------------------------------

/** Cached headless Chromium (same build the E2E scripts use). */
export const CHROMIUM_EXECUTABLE =
  '/home/hatch/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome';

export const CDP_3G_PROFILE = {
  profile: '3g',
  latencyMs: 300,
  downloadKbps: 400,
  uploadKbps: 400,
} as const;

export interface BrowserObservedState {
  balance: string;
  balanceCents: number;
  charges: number;
  displayedPrice: string;
  currency: string;
  discountCode: string;
  cartStatus: string;
  xssFired: number;
  consoleErrors: string[];
  patched: boolean;
}

export interface BrowserCapture {
  capturedVia: 'playwright-cdp';
  browser: string;
  cdpProtocol: string;
  targetUrl: string;
  throttling: typeof CDP_3G_PROFILE | null;
  domSnapshot: string;
  consoleErrors: string[];
  pageErrors: Array<{ message: string; stack: string }>;
  networkEvents: Array<{ url: string; status: number; durationMs: number }>;
  observed: BrowserObservedState;
  actions: ChaosActionStep[];
  attempts: number;
  violated: boolean;
  violationDetail: string;
  stackTrace: string;
}

const XSS_PAYLOAD = '<img src=x onerror="window.__xssFired=(window.__xssFired||0)+1">';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Drive one scenario in a REAL Chromium and capture real forensics.
 * The browser opens public/cdp-harness.html (served by the local server),
 * which loads the REAL target-app/phantom-pay.js (or .patched.js).
 * The guardrail runs FIRST: an out-of-scope baseUrl throws before any
 * browser is launched.
 */
export async function captureBrowserPossession(opts: {
  scenarioId: PossessionScenarioId;
  baseUrl: string;
  patched?: boolean;
  seed?: number;
  networkAttempts?: number;
}): Promise<BrowserCapture> {
  const { scenarioId } = opts;
  const patched = opts.patched ?? false;
  const seed = opts.seed ?? 20261121;
  const networkAttempts = opts.networkAttempts ?? 12;
  const verdict = assertScopeAllowed(opts.baseUrl);
  if (!verdict.allowed) {
    throw new Error(`target URL rejected by scope guardrail: ${verdict.reason}`);
  }
  const targetUrl =
    `${opts.baseUrl.replace(/\/$/, '')}/cdp-harness.html?seed=${seed}` +
    (patched ? '&patched=1' : '');

  const executablePath = fs.existsSync(CHROMIUM_EXECUTABLE) ? CHROMIUM_EXECUTABLE : undefined;
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  const consoleErrors: string[] = [];
  const pageErrors: Array<{ message: string; stack: string }> = [];
  const networkStarts = new Map<string, number>();
  const networkEvents: BrowserCapture['networkEvents'] = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on('console', (m) => {
      // Favicon 404s are page noise, not possession evidence.
      if (m.type() === 'error' && !m.text().includes('favicon')) consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => {
      pageErrors.push({ message: e.message, stack: e.stack ?? '' });
    });
    page.on('request', (req) => networkStarts.set(req.url(), Date.now()));
    page.on('response', (res) => {
      const started = networkStarts.get(res.url());
      networkEvents.push({
        url: res.url(),
        status: res.status(),
        durationMs: started ? Date.now() - started : -1,
      });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    const version = (await cdp.send('Browser.getVersion')) as {
      product: string;
      protocolVersion: string;
    };
    const throttling = scenarioId === 'NETWORK_3G_CHAOS' ? CDP_3G_PROFILE : null;
    if (throttling) {
      // Real CDP 3G shaping on the page's network traffic. The target
      // app's own /api latency is simulated setTimeout (same as payApi's
      // 180ms); the out-of-order race lives in that fetch layer.
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: throttling.latencyMs,
        downloadThroughput: (throttling.downloadKbps * 1024) / 8,
        uploadThroughput: (throttling.uploadKbps * 1024) / 8,
      });
    }

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (globalThis as unknown as { __possessed?: unknown }).__possessed, {
      timeout: 10000,
    });
    const readState = (): Promise<BrowserObservedState> =>
      page.evaluate(() => (globalThis as unknown as { __possessed: { state: () => BrowserObservedState } }).__possessed.state());

    const actions: ChaosActionStep[] = [];
    let attempts = 1;
    let violated = false;
    let violationDetail = '';

    if (scenarioId === 'RACE_DOUBLE_CHARGE') {
      for (let i = 0; i < 3; i++) {
        if (i > 0) await sleep(40);
        await page.locator('#pay-button').click({ force: true });
        actions.push({ stepIndex: i, actionType: 'CLICK', selector: '#pay-button', delayMs: i === 0 ? 0 : 40, cursorX: 600, cursorY: 340 });
      }
      await sleep(500); // let the 180ms /api/pay window fully settle
      const s = await readState();
      violated = s.balanceCents !== 75000 || s.charges !== 1;
      violationDetail = violated
        ? `Expected Balance: $750.00 | Actual: ${s.balance} (${s.charges} charge(s), double charge!)`
        : `Balance ${s.balance}, exactly 1 charge — invariant holds.`;
    } else if (scenarioId === 'NETWORK_3G_CHAOS') {
      // Bounded sweep in the real browser: fire GHOST10/USD, then 10ms
      // later EUR/no-code; the LAST request must win. Reseed per attempt
      // so the simulated /api delays are deterministic per attempt.
      for (let a = 1; a <= networkAttempts; a++) {
        attempts = a;
        await page.evaluate((s) => (globalThis as unknown as { __possessed: { reseed: (x: number) => void } }).__possessed.reseed(s), seed + a);
        await page.evaluate(async () => {
          const api = (globalThis as unknown as { __possessed: { fetchPrice: (c: string, d: string) => Promise<unknown> } }).__possessed;
          const first = api.fetchPrice('USD', 'GHOST10');
          await new Promise((r) => setTimeout(r, 10));
          const second = api.fetchPrice('EUR', '');
          await Promise.all([first, second]);
        });
        const s = await readState();
        actions.push(
          { stepIndex: 0, actionType: 'TYPE', selector: '#discount-input', payload: 'GHOST10', delayMs: 0, cursorX: 600, cursorY: 340 },
          { stepIndex: 1, actionType: 'TYPE', selector: '#discount-input', payload: '', delayMs: 10, cursorX: 600, cursorY: 340 },
        );
        if (s.currency !== 'EUR' || s.discountCode !== '') {
          violated = true;
          violationDetail = `Stale response won: displayed ${s.displayedPrice} with currency ${s.currency} after EUR was requested last (attempt ${a}/${networkAttempts}).`;
          break;
        }
      }
      if (!violated) {
        const s = await readState();
        violationDetail = `No stale-response win observed in ${networkAttempts} timed pairs — displayed ${s.displayedPrice} (${s.currency}).`;
      }
    } else {
      // STORAGE_XSS_SPECTER: corrupt real localStorage, reload via a REAL
      // button click (uncaught throw = real pageerror), then render an
      // XSS payload through the target's cartItemHtml into real DOM.
      await page.evaluate(() => (globalThis as unknown as { __possessed: { corruptCart: (r: string) => void } }).__possessed.corruptCart('{bad json'));
      actions.push({ stepIndex: 0, actionType: 'CORRUPT_STORAGE', payload: '{bad json', delayMs: 0, cursorX: 600, cursorY: 340 });
      await page.locator('#reload-cart').click({ force: true });
      actions.push({ stepIndex: 1, actionType: 'CLICK', selector: '#reload-cart', delayMs: 0, cursorX: 600, cursorY: 340 });
      await sleep(300);
      await page.evaluate((payload) => (globalThis as unknown as { __possessed: { renderCartItem: (n: string) => void } }).__possessed.renderCartItem(payload), XSS_PAYLOAD);
      actions.push({ stepIndex: 2, actionType: 'TYPE', selector: '#cart-view', payload: XSS_PAYLOAD, delayMs: 0, cursorX: 600, cursorY: 340 });
      await sleep(300);
      const s = await readState();
      const threw = pageErrors.length > 0;
      violated = threw || s.xssFired > 0;
      violationDetail = violated
        ? `loadCart() threw: ${pageErrors[0]?.message ?? 'no pageerror'}; XSS payload executed: ${s.xssFired > 0 ? `yes (${s.xssFired}x)` : 'no'}`
        : 'loadCart() fell back to an empty cart, XSS payload rendered as inert text — invariant holds.';
    }

    const observed = await readState();
    const domSnapshot = await page.locator('#phantom-pay').evaluate((el) => el.outerHTML);
    return {
      capturedVia: 'playwright-cdp',
      browser: version.product,
      cdpProtocol: version.protocolVersion,
      targetUrl,
      throttling,
      domSnapshot,
      consoleErrors,
      pageErrors,
      networkEvents,
      observed,
      actions,
      attempts,
      violated,
      violationDetail,
      stackTrace: pageErrors[0]?.stack ?? '',
    };
  } finally {
    await browser.close();
  }
}
