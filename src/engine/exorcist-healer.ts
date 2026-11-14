/**
 * Exorcist Self-Healing Patcher (blueprint Task 3, Phase 1 scope).
 *
 * The patch is REAL, not a description: the healer reads the vulnerable
 * target-app/phantom-pay.js, applies exact string replacements for the
 * three known bugs (inFlightLock + idempotencyKey, AbortController-style
 * stale-response guard, try/catch storage fallback), builds a genuine
 * unified diff from the old/new text, and writes the patched source to
 * target-app/phantom-pay.patched.js (the vulnerable original is NEVER
 * overwritten) plus an incident record in .kiro/specs/incidents/.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PossessionScenarioId } from '../types/possessed';

export const VULNERABLE_FILE = 'target-app/phantom-pay.js';
export const PATCHED_FILE = 'target-app/phantom-pay.patched.js';

const DESCRIPTIONS: Record<PossessionScenarioId, string> = {
  RACE_DOUBLE_CHARGE:
    'Add inFlightLock + idempotencyKey to handleCheckout(): concurrent clicks share one /api/pay call, so a triple-click charges exactly once.',
  NETWORK_3G_CHAOS:
    'Add a request-token guard to fetchPrice(): a stale response that resolves after a newer request is ignored instead of overwriting the latest price.',
  STORAGE_XSS_SPECTER:
    'Wrap JSON.parse in loadCart() with try/catch: a corrupted cart falls back to an empty cart and records the failure instead of throwing.',
};

const LOAD_CART_OLD = `  // BUG 3: tanpa try/catch — cart rusak = SyntaxError tak tertangkap.
  function loadCart() {
    const raw = storage().getItem('phantom_cart');
    if (raw === null) {
      state.cart = { items: [] };
      return state.cart;
    }
    state.cart = JSON.parse(raw);
    return state.cart;
  }`;

const LOAD_CART_NEW = `  // EXORCISED: safe deserialization — corrupted cart falls back.
  function loadCart() {
    const raw = storage().getItem('phantom_cart');
    if (raw === null) {
      state.cart = { items: [] };
      return state.cart;
    }
    try {
      state.cart = JSON.parse(raw);
    } catch (err) {
      state.consoleErrors.push('Storage parse failed, fell back to empty cart: ' + err.message);
      state.cart = { items: [] };
    }
    return state.cart;
  }`;

const CHECKOUT_OLD = `  // BUG 1: tanpa inFlightLock dan tanpa idempotencyKey — klik beruntun
  // masing-masing memicu payApi sendiri.
  async function handleCheckout() {
    const charge = await payApi(ITEM_PRICE_CENTS);
    return charge;
  }`;

const CHECKOUT_NEW = `  // EXORCISED: idempotency lock — concurrent clicks share one charge.
  let inFlightCheckout = null;
  async function handleCheckout() {
    if (inFlightCheckout) return inFlightCheckout;
    const idempotencyKey = 'idem_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    inFlightCheckout = payApi(ITEM_PRICE_CENTS).finally(() => { inFlightCheckout = null; });
    const charge = await inFlightCheckout;
    charge.idempotencyKey = idempotencyKey;
    state.lastIdempotencyKey = idempotencyKey;
    return charge;
  }`;

const FETCH_PRICE_OLD = `  // BUG 2: tanpa AbortController — fetch lama yang selesai belakangan
  // menimpa harga terbaru.
  let latestPriceRequest = 0;
  function fetchPrice(currency, discountCode) {
    const requestId = ++latestPriceRequest;
    const delay = 60 + Math.floor(Math.random() * 240); // 60–300ms acak
    return new Promise((resolve) => {
      setTimeout(() => {
        void requestId; // requestId sengaja tidak dipakai untuk membatalkan
        let price = ITEM_PRICE_CENTS;
        if (discountCode === 'GHOST10') price = Math.round(price * 0.9);
        if (currency === 'EUR') price = Math.round(price * 0.92);
        state.currency = currency;
        state.discountCode = discountCode;
        state.displayedPriceCents = price;
        resolve({ priceCents: price, currency, discountCode });
      }, delay);
    });
  }`;

const FETCH_PRICE_NEW = `  // EXORCISED: stale-response guard — superseded requests are ignored.
  let latestPriceRequest = 0;
  function fetchPrice(currency, discountCode) {
    const requestId = ++latestPriceRequest;
    const delay = 60 + Math.floor(Math.random() * 240); // 60–300ms acak
    return new Promise((resolve) => {
      setTimeout(() => {
        if (requestId !== latestPriceRequest) {
          resolve({ priceCents: state.displayedPriceCents, currency: state.currency, discountCode: state.discountCode, stale: true });
          return;
        }
        let price = ITEM_PRICE_CENTS;
        if (discountCode === 'GHOST10') price = Math.round(price * 0.9);
        if (currency === 'EUR') price = Math.round(price * 0.92);
        state.currency = currency;
        state.discountCode = discountCode;
        state.displayedPriceCents = price;
        resolve({ priceCents: price, currency, discountCode });
      }, delay);
    });
  }`;

function replaceOnce(src: string, oldText: string, newText: string, label: string): string {
  const count = src.split(oldText).length - 1;
  if (count !== 1) throw new Error(`Exorcist patch failed: expected exactly 1 occurrence of ${label}, found ${count}`);
  return src.replace(oldText, newText);
}

/** Minimal unified diff (LCS-based) with 3 lines of context. */
export function unifiedDiff(oldText: string, newText: string, oldPath: string, newPath: string): string {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const n = a.length;
  const m = b.length;
  // LCS lengths, computed backwards.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  type Op = { kind: ' ' | '-' | '+'; text: string; aLine: number; bLine: number };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: ' ', text: a[i], aLine: i + 1, bLine: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: '-', text: a[i], aLine: i + 1, bLine: j });
      i++;
    } else {
      ops.push({ kind: '+', text: b[j], aLine: i, bLine: j + 1 });
      j++;
    }
  }
  while (i < n) {
    ops.push({ kind: '-', text: a[i], aLine: i + 1, bLine: j });
    i++;
  }
  while (j < m) {
    ops.push({ kind: '+', text: b[j], aLine: i, bLine: j + 1 });
    j++;
  }
  const changed = ops.map((o, idx) => (o.kind === ' ' ? -1 : idx)).filter((x) => x >= 0);
  if (changed.length === 0) return `--- a/${oldPath}\n+++ b/${newPath}\n`;
  const ctx = 3;
  const keep = new Set<number>();
  for (const c of changed) {
    for (let k = Math.max(0, c - ctx); k <= Math.min(ops.length - 1, c + ctx); k++) keep.add(k);
  }
  const lines: string[] = [`--- a/${oldPath}`, `+++ b/${newPath}`];
  let hunk: Op[] = [];
  const flush = () => {
    if (hunk.length === 0) return;
    const first = hunk[0];
    const last = hunk[hunk.length - 1];
    const aStart = first.kind === '+' ? first.aLine + 1 : first.aLine;
    const bStart = first.kind === '-' ? first.bLine + 1 : first.bLine;
    const aCount = hunk.filter((o) => o.kind !== '+').length;
    const bCount = hunk.filter((o) => o.kind !== '-').length;
    lines.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`);
    for (const o of hunk) lines.push(o.kind + o.text);
    hunk = [];
  };
  let prev = -2;
  for (const idx of [...keep].sort((x, y) => x - y)) {
    if (idx - prev > 1) flush();
    hunk.push(ops[idx]);
    prev = idx;
  }
  flush();
  return lines.join('\n') + '\n';
}

export interface SynthesizedPatch {
  description: string;
  unifiedDiff: string;
  patchedCode: string;
}

export function buildPatchedSource(): string {
  const root = path.join(__dirname, '..', '..');
  const vulnerable = fs.readFileSync(path.join(root, VULNERABLE_FILE), 'utf8');
  let patched = replaceOnce(vulnerable, LOAD_CART_OLD, LOAD_CART_NEW, 'loadCart');
  patched = replaceOnce(patched, CHECKOUT_OLD, CHECKOUT_NEW, 'handleCheckout');
  patched = replaceOnce(patched, FETCH_PRICE_OLD, FETCH_PRICE_NEW, 'fetchPrice');
  const header =
    '// EXORCISED — patched by Possessed UI Exorcist (inFlightLock + idempotencyKey\n' +
    '// + stale-response guard + safe storage fallback). Generated from ' +
    VULNERABLE_FILE + ' — the vulnerable original is never overwritten.\n';
  return header + patched;
}

export function synthesizePatch(scenarioId: PossessionScenarioId): SynthesizedPatch {
  const root = path.join(__dirname, '..', '..');
  const vulnerable = fs.readFileSync(path.join(root, VULNERABLE_FILE), 'utf8');
  const patchedCode = buildPatchedSource();
  return {
    description: DESCRIPTIONS[scenarioId],
    unifiedDiff: unifiedDiff(vulnerable, patchedCode, VULNERABLE_FILE, PATCHED_FILE),
    patchedCode,
  };
}

export interface AppliedPatch {
  patchedFile: string;
  incidentFile: string;
  diff: string;
}

/** Apply the patch: write the patched file + an incident record. */
export function applyPatch(scenarioId: PossessionScenarioId): AppliedPatch {
  const root = path.join(__dirname, '..', '..');
  const patch = synthesizePatch(scenarioId);
  const patchedPath = path.join(root, PATCHED_FILE);
  fs.writeFileSync(patchedPath, patch.patchedCode, 'utf8');
  const incidentsDir = path.join(root, '.kiro', 'specs', 'incidents');
  fs.mkdirSync(incidentsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const incidentFile = path.join(incidentsDir, `${scenarioId.toLowerCase()}-${stamp}.json`);
  fs.writeFileSync(
    incidentFile,
    JSON.stringify(
      {
        scenarioId,
        status: 'EXORCISED',
        description: patch.description,
        patchedFile: PATCHED_FILE,
        resolvedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  return { patchedFile: PATCHED_FILE, incidentFile: path.relative(root, incidentFile), diff: patch.unifiedDiff };
}

/** Load a fresh instance from the patched file (require cache busted). */
export function loadPatched(): import('../types/possessed').PhantomPayInstance {
  const root = path.join(__dirname, '..', '..');
  const patchedPath = path.join(root, PATCHED_FILE);
  delete require.cache[require.resolve(patchedPath)];
  const mod = require(patchedPath) as {
    createPhantomPay: () => import('../types/possessed').PhantomPayInstance;
  };
  return mod.createPhantomPay();
}
