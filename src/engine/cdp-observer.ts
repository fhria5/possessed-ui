/**
 * CDP & DOM Forensics Medium (blueprint Task 2, Phase 1 scope).
 *
 * Phase 1 reality, stated plainly:
 * - This module captures REAL forensics from a possession run executed
 *   against the real target-app/phantom-pay.js (in-process): DOM snapshot,
 *   console errors, stack trace, and the exact source line of the fault.
 * - It does NOT open a real browser CDP session in Phase 1. The GitHub
 *   Pages demo is Mode B (static browser simulation). A live Playwright/CDP
 *   capture is out of scope until a later phase.
 * - The scope guardrail IS enforced here and everywhere a target URL is
 *   accepted: only localhost / 127.0.0.1 / the embedded sandbox frame.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PossessionForensics, PossessionScenarioId } from '../types/possessed';

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
