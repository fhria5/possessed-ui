/**
 * Possessed UI — Mode A local server (Express), Phase 2.
 * Serves the Mode B dashboard (public/) and the JSON/MCP API.
 * All 3 scenarios are live. /api/possess returns REAL Chromium forensics
 * by default (cdp: true → captureBrowserPossession); pass cdp: false for
 * the fast in-process path. The scope guardrail rejects non-localhost
 * targetUrl values before any browser is launched.
 */
import express from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PossessionScenarioId } from './types/possessed';
import { exorciseViaServer, possessViaServer, resolveBaseUrl } from './engine/possess-service';
import { callTool, getLastReport, handleJsonRpc, listTools } from './engine/mcp-server';

export const PORT = Number(process.env.PORT ?? 8933);
export const ALL_SCENARIOS: PossessionScenarioId[] = [
  'RACE_DOUBLE_CHARGE',
  'NETWORK_3G_CHAOS',
  'STORAGE_XSS_SPECTER',
];

function cdpStatus(): string {
  try {
    require.resolve('playwright');
    return 'playwright-chromium';
  } catch {
    return 'unavailable';
  }
}

function isScenario(value: unknown): value is PossessionScenarioId {
  return (
    value === 'RACE_DOUBLE_CHARGE' || value === 'NETWORK_3G_CHAOS' || value === 'STORAGE_XSS_SPECTER'
  );
}

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // The CDP harness loads the real target app from here.
  app.get('/target-app/:name', (req, res) => {
    const allowed = ['phantom-pay.js', 'phantom-pay.patched.js'];
    if (!allowed.includes(req.params.name)) {
      res.status(404).send('not found');
      return;
    }
    res.sendFile(path.join(__dirname, '..', 'target-app', req.params.name));
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mode: 'phase-2',
      engine: 'ready',
      mcp: true,
      cdp: cdpStatus(),
      scenarios: ALL_SCENARIOS,
      note: 'Mode B demo is a static browser simulation, not a real CDP session. /api/possess forensics come from a real Chromium session unless cdp:false.',
    });
  });

  app.post('/api/possess', async (req, res) => {
    const scenarioId = req.body?.scenarioId as unknown;
    if (!isScenario(scenarioId)) {
      res.status(400).json({ error: `unknown scenarioId: ${String(scenarioId)}` });
      return;
    }
    try {
      const report = await possessViaServer(scenarioId, {
        seed: typeof req.body?.seed === 'number' ? req.body.seed : undefined,
        networkAttempts: typeof req.body?.networkAttempts === 'number' ? req.body.networkAttempts : undefined,
        cdp: typeof req.body?.cdp === 'boolean' ? req.body.cdp : undefined,
        targetUrl: typeof req.body?.targetUrl === 'string' ? req.body.targetUrl : undefined,
        patched: req.body?.patched === true,
        baseUrl:
          typeof req.body?.baseUrl === 'string'
            ? req.body.baseUrl
            : `${req.protocol}://${req.get('host')}`,
      });
      res.json(report);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/exorcise', async (req, res) => {
    const scenarioId = req.body?.scenarioId as unknown;
    if (!isScenario(scenarioId)) {
      res.status(400).json({ error: `unknown scenarioId: ${String(scenarioId)}` });
      return;
    }
    const out = await exorciseViaServer(scenarioId);
    res.json(out);
  });

  app.get('/api/kiro-files', (_req, res) => {
    const kiroRoot = path.join(__dirname, '..', '.kiro');
    const files: Array<{ path: string; content: string }> = [];
    const walk = (dir: string, prefix: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(full, rel);
        else files.push({ path: rel, content: fs.readFileSync(full, 'utf8') });
      }
    };
    if (fs.existsSync(kiroRoot)) walk(kiroRoot, '');
    res.json({ files });
  });

  app.get('/mcp/tools', (_req, res) => {
    res.json({ jsonrpc: '2.0', id: null, result: { tools: listTools() } });
  });

  app.post('/mcp/call', async (req, res) => {
    res.json(
      await handleJsonRpc(req.body ?? {}, {
        baseUrl: `${req.protocol}://${req.get('host')}`,
      }),
    );
  });

  // Convenience REST wrappers over the MCP tools (same handlers).
  app.post('/api/mcp/possess', async (req, res) => {
    try {
      res.json(
        await callTool('possess_target_ui', req.body ?? {}, {
          baseUrl: `${req.protocol}://${req.get('host')}`,
        }),
      );
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
  app.get('/api/mcp/last-report', (_req, res) => {
    const report = getLastReport();
    if (!report) {
      res.status(404).json({ error: 'no possession run yet' });
      return;
    }
    res.json(report);
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Possessed UI Phase 2 listening on http://localhost:${PORT}`);
  });
}

// Re-exported for tests / tooling that need the default origin.
export { resolveBaseUrl };
