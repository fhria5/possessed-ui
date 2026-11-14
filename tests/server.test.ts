/**
 * Server tests: HTTP + MCP endpoints on an ephemeral port.
 * Pattern: app.listen(0) + fetch (same as NecroMCP Phase 3).
 * Phase 3: all 3 scenarios live; /api/possess defaults to real Chromium
 * CDP forensics (cdp: true) — fast tests below pass cdp: false explicitly.
 * The real-browser path is covered by tests/cdp.test.ts + E2E Phase 2.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/server';
import type { PossessionReport } from '../src/types/possessed';

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

describe('GET /api/health', () => {
  it('reports phase-4 mode and real Playwright CDP', async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; mode: string; cdp: string; scenarios: string[] };
    expect(body.ok).toBe(true);
    expect(body.mode).toBe('phase-4');
    expect(body.cdp).toBe('playwright-chromium');
    expect(body.scenarios).toEqual(['RACE_DOUBLE_CHARGE', 'NETWORK_3G_CHAOS', 'STORAGE_XSS_SPECTER']);
  });
});

describe('POST /api/possess (fast in-process path, cdp:false)', () => {
  it('race scenario crashes with $250 and 3-click shrink', async () => {
    const res = await fetch(`${base}/api/possess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'RACE_DOUBLE_CHARGE', cdp: false }),
    });
    expect(res.status).toBe(200);
    const report = (await res.json()) as PossessionReport;
    expect(report.status).toBe('POSSESSED_CRASH');
    expect(report.shrunkActionSequence).toHaveLength(3);
    expect(report.cdpCapture).toBeUndefined();
  });

  it('network scenario runs (timing-dependent verdict, honest either way)', async () => {
    const res = await fetch(`${base}/api/possess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'NETWORK_3G_CHAOS', cdp: false, networkAttempts: 25 }),
    });
    expect(res.status).toBe(200);
    const report = (await res.json()) as PossessionReport;
    expect(['POSSESSED_CRASH', 'EXORCISED_IMMUNE']).toContain(report.status);
  }, 30000);

  it('storage scenario crashes on corrupted cart', async () => {
    const res = await fetch(`${base}/api/possess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'STORAGE_XSS_SPECTER', cdp: false }),
    });
    expect(res.status).toBe(200);
    const report = (await res.json()) as PossessionReport;
    expect(report.status).toBe('POSSESSED_CRASH');
    expect(report.forensics.stateCorruptionDetail).toContain('threw');
  });

  it('unknown scenario is a 400', async () => {
    const res = await fetch(`${base}/api/possess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'NOPE' }),
    });
    expect(res.status).toBe(400);
  });

  it('external targetUrl is rejected by the scope guardrail', async () => {
    for (const targetUrl of ['https://example.com/', 'https://fhria5.github.io/possessed-ui/']) {
      const res = await fetch(`${base}/api/possess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: 'RACE_DOUBLE_CHARGE', targetUrl }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('guardrail');
    }
  });

  it('localhost targetUrl is accepted', async () => {
    const res = await fetch(`${base}/api/possess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'RACE_DOUBLE_CHARGE', cdp: false, targetUrl: base + '/' }),
    });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/exorcise', () => {
  it.each(['RACE_DOUBLE_CHARGE', 'NETWORK_3G_CHAOS', 'STORAGE_XSS_SPECTER'] as const)(
    'heals %s and re-verifies to IMMUNE',
    async (scenarioId) => {
      const res = await fetch(`${base}/api/exorcise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        patchedFile: string;
        incidentFile: string;
        verification: PossessionReport;
      };
      expect(body.patchedFile).toBe('target-app/phantom-pay.patched.js');
      expect(body.incidentFile).toContain(scenarioId.toLowerCase());
      expect(body.verification.status).toBe('EXORCISED_IMMUNE');
    },
    30000,
  );
});

describe('GET /api/kiro-files', () => {
  it('returns the 9 .kiro files with contents', async () => {
    const res = await fetch(`${base}/api/kiro-files`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { files: Array<{ path: string; content: string }> };
    const required = [
      'specs/possessed-engine/requirements.md',
      'specs/possessed-engine/design.md',
      'specs/possessed-engine/tasks.md',
      'steering/frontend-resilience.md',
      'steering/chaos-guardrails.md',
      'steering/seance-ui-standards.md',
      'hooks/possession-auto-heal.json',
      'hooks/pbt-immunity-check.json',
      'settings/mcp.json',
    ];
    for (const p of required) {
      const found = body.files.find((f) => f.path === p);
      expect(found, `missing .kiro file ${p}`).toBeDefined();
      expect(found!.content.length).toBeGreaterThan(0);
    }
  });
});

describe('CDP harness route', () => {
  it('serves the real target app for the browser capture', async () => {
    const res = await fetch(`${base}/target-app/phantom-pay.js`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('createPhantomPay');
    const harness = await fetch(`${base}/cdp-harness.html`);
    expect(harness.status).toBe(200);
    expect(await harness.text()).toContain('__possessed');
  });
});

describe('MCP over HTTP', () => {
  it('GET /mcp/tools lists 3 tools', async () => {
    const res = await fetch(`${base}/mcp/tools`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { tools: unknown[] } };
    expect(body.result.tools).toHaveLength(3);
  });

  it('POST /mcp/call tools/call possess returns a report (fast path)', async () => {
    const res = await fetch(`${base}/mcp/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'possess_target_ui',
          arguments: { scenarioId: 'RACE_DOUBLE_CHARGE', cdp: false },
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { content: Array<{ text: string }> };
    };
    const report = JSON.parse(body.result.content[0].text) as PossessionReport;
    expect(report.status).toBe('POSSESSED_CRASH');
  });

  it('POST /mcp/call exorcise_and_patch heals to IMMUNE', async () => {
    const res = await fetch(`${base}/mcp/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'exorcise_and_patch',
          arguments: { scenarioId: 'NETWORK_3G_CHAOS' },
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { content: Array<{ text: string }> };
    };
    const out = JSON.parse(body.result.content[0].text) as { verificationStatus: string };
    expect(out.verificationStatus).toBe('EXORCISED_IMMUNE');
  }, 30000);
});

describe('static dashboard', () => {
  it('serves index.html with the Phase 4 marker', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Possessed UI Phase 4');
  });
});
