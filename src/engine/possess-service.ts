/**
 * Possessed UI — server-path possession service (Phase 2).
 *
 * Shared by the Express routes (src/server.ts) and the MCP tools
 * (src/engine/mcp-server.ts) so both return the same reports.
 *
 * Default (cdp: true): the report's forensics come from a REAL Chromium
 * session (captureBrowserPossession) — real DOM snapshot, real console
 * errors, real pageerror stack traces. The in-process fast-check run still
 * produces the PBT report skeleton (shrunk sequence, patch); the browser
 * capture then overwrites forensics + status + actions with what the real
 * browser observed. If the browser capture fails, the in-process report is
 * returned and cdpCapture says so honestly (fallback-in-process).
 *
 * cdp: false keeps the Phase 1 fast in-process path (used by unit tests).
 */
import {
  assertScopeAllowed,
  captureBrowserPossession,
  findFunctionLine,
  TARGET_FILE,
} from './cdp-observer';
import { applyPatch, loadPatched } from './exorcist-healer';
import { possess } from './poltergeist-pbt';
import type {
  PhantomPayInstance,
  PossessionReport,
  PossessionScenarioId,
} from '../types/possessed';

export interface PossessOptions {
  seed?: number;
  networkAttempts?: number;
  /** Real-browser forensics (default true on server paths). */
  cdp?: boolean;
  /** Optional explicit target URL — enforced by the scope guardrail. */
  targetUrl?: string;
  /** Origin serving public/cdp-harness.html (needed for the CDP run). */
  baseUrl?: string;
  /** Run against the Exorcist-patched target instead of the vulnerable one. */
  patched?: boolean;
}

const FUNCTION_NAMES: Record<PossessionScenarioId, string> = {
  RACE_DOUBLE_CHARGE: 'handleCheckout',
  NETWORK_3G_CHAOS: 'fetchPrice',
  STORAGE_XSS_SPECTER: 'loadCart',
};

const INVARIANTS: Record<PossessionScenarioId, string> = {
  RACE_DOUBLE_CHARGE: 'REQ-1.1: a single checkout must charge exactly once (idempotency).',
  NETWORK_3G_CHAOS: 'REQ-2.2: the last requested price must win; a stale response overwrote it.',
  STORAGE_XSS_SPECTER: 'REQ-3.1: loading a corrupted cart must fall back, never throw; rendered cart data must not execute scripts.',
};

function freshPhantomPay(): PhantomPayInstance {
  const mod = require('../../target-app/phantom-pay.js') as {
    createPhantomPay: () => PhantomPayInstance;
  };
  return mod.createPhantomPay();
}

export function resolveBaseUrl(explicit?: string): string {
  if (explicit) return explicit;
  if (process.env.POSSESSED_BASE_URL) return process.env.POSSESSED_BASE_URL;
  return 'http://127.0.0.1:8933';
}

export async function possessViaServer(
  scenarioId: PossessionScenarioId,
  opts: PossessOptions = {},
): Promise<PossessionReport> {
  const useCdp = opts.cdp ?? true;
  const patched = opts.patched ?? false;
  if (opts.targetUrl !== undefined) {
    const verdict = assertScopeAllowed(opts.targetUrl);
    if (!verdict.allowed) {
      throw new Error(`target URL rejected by scope guardrail: ${verdict.reason}`);
    }
  }
  const instance = patched ? loadPatched() : freshPhantomPay();
  // On the CDP path the browser does the real network sweep; skip the
  // in-process timing sweep (its verdict is overwritten below anyway).
  const report = await possess(instance, scenarioId, {
    seed: opts.seed,
    networkAttempts: useCdp && scenarioId === 'NETWORK_3G_CHAOS' ? 0 : opts.networkAttempts,
  });
  if (!useCdp) return report;

  try {
    const capture = await captureBrowserPossession({
      scenarioId,
      baseUrl: resolveBaseUrl(opts.baseUrl),
      patched,
      seed: opts.seed,
      networkAttempts: opts.networkAttempts ?? 12,
    });
    report.status = capture.violated ? 'POSSESSED_CRASH' : 'EXORCISED_IMMUNE';
    report.invariantViolated = capture.violated ? INVARIANTS[scenarioId] : '';
    report.shrunkActionSequence = capture.actions;
    report.shrinkSteps = 0; // browser actions are already minimal (3 clicks / 2 fetches / 3 steps)
    report.pbtRunsExecuted = capture.attempts;
    report.forensics = {
      targetFile: TARGET_FILE,
      lineNumber: findFunctionLine(FUNCTION_NAMES[scenarioId]),
      consoleError: capture.pageErrors[0]?.message ?? capture.consoleErrors[0] ?? '',
      domSnapshot: capture.domSnapshot,
      stateCorruptionDetail: capture.violationDetail,
      stackTrace:
        capture.stackTrace ||
        'no page exception in this real-browser run — evidence is the DOM snapshot + observed state (see cdpCapture)',
    };
    report.cdpCapture = {
      capturedVia: 'playwright-cdp',
      browser: capture.browser,
      cdpProtocol: capture.cdpProtocol,
      targetUrl: capture.targetUrl,
      throttling: capture.throttling,
      networkEvents: capture.networkEvents,
      observed: capture.observed,
      pageErrors: capture.pageErrors,
    };
  } catch (e) {
    report.cdpCapture = {
      capturedVia: 'fallback-in-process',
      reason: (e as Error).message,
    };
  }
  return report;
}

export interface ExorciseResult {
  patchedFile: string;
  incidentFile: string;
  verification: PossessionReport;
}

export async function exorciseViaServer(
  scenarioId: PossessionScenarioId,
): Promise<ExorciseResult> {
  const applied = applyPatch(scenarioId);
  const verification = await possess(loadPatched(), scenarioId, {});
  return {
    patchedFile: applied.patchedFile,
    incidentFile: applied.incidentFile,
    verification,
  };
}
