/**
 * Server tests: HTTP + MCP endpoints on an ephemeral port.
 * Pattern: app.listen(0) + fetch (same as NecroMCP Phase 3).
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
  it('reports phase-1 mode and simulated CDP honestly', async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; mode: string; cdp: string };
    expect(body.ok).toBe(true);
    expect(body.mode).toBe('phase-1');
    expect(body.cdp).toBe('simulated-mode-b');
  });
});

describe('POST /api/possess', () => {
  it('race scenario crashes with $250 and 3-click shrink', async () => {
    const res = await fetch(`${base}/api/possess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'RACE_DOUBLE_CHARGE' }),
    });
    expect(res.status).toBe(200);
    const report = (await res.json()) as PossessionReport;
    expect(report.status).toBe('POSSESSED_CRASH');
    expect(report.shrunkActionSequence).toHaveLength(3);
  });

  it('Phase 2 scenarios are rejected, not faked', async () => {
    for (const scenarioId of ['NETWORK_3G_CHAOS', 'STORAGE_XSS_SPECTER']) {
      const res = await fetch(`${base}/api/possess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('Phase 2');
    }
  });

  it('unknown scenario is a 400', async () => {
    const res = await fetch(`${base}/api/possess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'NOPE' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/exorcise', () => {
  it('heals and re-verifies to IMMUNE with $750', async () => {
    const res = await fetch(`${base}/api/exorcise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'RACE_DOUBLE_CHARGE' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      patchedFile: string;
      verification: PossessionReport;
    };
    expect(body.patchedFile).toBe('target-app/phantom-pay.patched.js');
    expect(body.verification.status).toBe('EXORCISED_IMMUNE');
    expect(body.verification.forensics.stateCorruptionDetail).toContain('$750.00');
  });
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

describe('MCP over HTTP', () => {
  it('GET /mcp/tools lists 3 tools', async () => {
    const res = await fetch(`${base}/mcp/tools`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { tools: unknown[] } };
    expect(body.result.tools).toHaveLength(3);
  });

  it('POST /mcp/call tools/call possess returns a report', async () => {
    const res = await fetch(`${base}/mcp/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'possess_target_ui', arguments: { scenarioId: 'RACE_DOUBLE_CHARGE' } },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { content: Array<{ text: string }> };
    };
    const report = JSON.parse(body.result.content[0].text) as PossessionReport;
    expect(report.status).toBe('POSSESSED_CRASH');
  });
});

describe('static dashboard', () => {
  it('serves index.html with the Phase 1 marker', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Possessed UI Phase 1');
  });
});
