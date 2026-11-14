/**
 * Real Playwright/CDP capture tests (Task 2.1, Phase 2).
 * Each test opens a REAL Chromium against the harness page served by an
 * ephemeral local server and asserts on REAL browser evidence: DOM
 * snapshot, pageerror stack traces, localStorage, and script execution.
 * Slow by design (~2–5s per browser launch) — generous timeouts.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/server';
import { captureBrowserPossession } from '../src/engine/cdp-observer';
import { possessViaServer } from '../src/engine/possess-service';
import type { PossessionScenarioId } from '../src/types/possessed';

let server: Server;
let base: string;

beforeAll(async () => {
  const app = createApp();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('captureBrowserPossession — real Chromium', () => {
  it('race: triple-click in a real browser double-charges to $250.00', async () => {
    const cap = await captureBrowserPossession({
      scenarioId: 'RACE_DOUBLE_CHARGE',
      baseUrl: base,
    });
    expect(cap.capturedVia).toBe('playwright-cdp');
    expect(cap.browser).toContain('Chrome/');
    expect(cap.cdpProtocol.length).toBeGreaterThan(0);
    expect(cap.violated).toBe(true);
    expect(cap.observed.balance).toBe('$250.00');
    expect(cap.observed.charges).toBe(3);
    expect(cap.domSnapshot).toContain('$250.00');
    expect(cap.domSnapshot).toContain('data-balance-cents="25000"');
    expect(cap.networkEvents.length).toBeGreaterThan(0);
    expect(cap.networkEvents.some((e) => e.url.includes('phantom-pay.js') && e.status === 200)).toBe(true);
  }, 60000);

  it('network: stale response wins in a real browser under CDP 3G throttling', async () => {
    const cap = await captureBrowserPossession({
      scenarioId: 'NETWORK_3G_CHAOS',
      baseUrl: base,
      networkAttempts: 25,
    });
    expect(cap.violated).toBe(true);
    expect(cap.throttling?.profile).toBe('3g');
    expect(cap.throttling?.latencyMs).toBe(300);
    expect(cap.observed.displayedPrice).toBe('$225.00');
    expect(cap.observed.currency).toBe('USD');
    expect(cap.violationDetail).toContain('Stale response won');
  }, 60000);

  it('storage: corrupted cart throws a REAL SyntaxError + XSS executes in a real browser', async () => {
    const cap = await captureBrowserPossession({
      scenarioId: 'STORAGE_XSS_SPECTER',
      baseUrl: base,
    });
    expect(cap.violated).toBe(true);
    expect(cap.pageErrors.length).toBeGreaterThan(0);
    expect(cap.pageErrors[0].message).toContain('JSON');
    expect(cap.pageErrors[0].stack).toContain('phantom-pay.js');
    expect(cap.pageErrors[0].stack).toContain('loadCart');
    expect(cap.observed.xssFired).toBe(1);
    expect(cap.stackTrace).toContain('phantom-pay.js');
  }, 60000);

  it.each(['RACE_DOUBLE_CHARGE', 'NETWORK_3G_CHAOS', 'STORAGE_XSS_SPECTER'] as PossessionScenarioId[])(
    'patched %s is immune in a real browser (0 page errors, XSS never fires)',
    async (scenarioId) => {
      const cap = await captureBrowserPossession({
        scenarioId,
        baseUrl: base,
        patched: true,
        networkAttempts: 12,
      });
      expect(cap.violated).toBe(false);
      expect(cap.pageErrors).toHaveLength(0);
      expect(cap.observed.xssFired).toBe(0);
      expect(cap.observed.patched).toBe(true);
    },
    60000,
  );

  it('guardrail: an external baseUrl throws before any browser launches', async () => {
    await expect(
      captureBrowserPossession({ scenarioId: 'RACE_DOUBLE_CHARGE', baseUrl: 'https://example.com' }),
    ).rejects.toThrow('guardrail');
  }, 30000);
});

describe('possessViaServer — CDP path end to end', () => {
  it('race report carries real-browser forensics (DOM snapshot + Chrome meta)', async () => {
    const report = await possessViaServer('RACE_DOUBLE_CHARGE', { baseUrl: base });
    expect(report.status).toBe('POSSESSED_CRASH');
    expect(report.cdpCapture?.capturedVia).toBe('playwright-cdp');
    expect(report.cdpCapture?.browser).toContain('Chrome/');
    expect(report.forensics.domSnapshot).toContain('$250.00');
    expect(report.forensics.stateCorruptionDetail).toContain('Actual: $250.00');
  }, 60000);

  it('patched network report is immune with EUR winning in the real browser', async () => {
    const report = await possessViaServer('NETWORK_3G_CHAOS', {
      baseUrl: base,
      patched: true,
      networkAttempts: 12,
    });
    expect(report.status).toBe('EXORCISED_IMMUNE');
    expect(report.cdpCapture?.observed?.displayedPrice).toBe('$230.00');
    expect(report.cdpCapture?.observed?.currency).toBe('EUR');
  }, 60000);
});
