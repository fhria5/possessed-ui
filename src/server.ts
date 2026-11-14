/**
 * Possessed UI — Mode A local server (Express).
 * Serves the Mode B dashboard (public/) and the JSON/MCP API.
 * Phase 1: scenarios 2–3 are gated to Phase 2 on /api/possess and
 * /api/exorcise — the engine can run them, the demo does not expose them yet.
 */
import express from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PhantomPayInstance, PossessionScenarioId } from './types/possessed';
import { possess } from './engine/poltergeist-pbt';
import { applyPatch, loadPatched } from './engine/exorcist-healer';
import { callTool, getLastReport, handleJsonRpc, listTools } from './engine/mcp-server';

export const PORT = Number(process.env.PORT ?? 8933);
export const PHASE_1_SCENARIOS: PossessionScenarioId[] = ['RACE_DOUBLE_CHARGE'];

function freshPhantomPay(): PhantomPayInstance {
  const mod = require('../target-app/phantom-pay.js') as {
    createPhantomPay: () => PhantomPayInstance;
  };
  return mod.createPhantomPay();
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

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mode: 'phase-1',
      engine: 'ready',
      mcp: true,
      cdp: 'simulated-mode-b',
      scenarios: PHASE_1_SCENARIOS,
      note: 'Mode B demo is a static browser simulation, not a real CDP session.',
    });
  });

  app.post('/api/possess', async (req, res) => {
    const scenarioId = req.body?.scenarioId as unknown;
    if (!isScenario(scenarioId)) {
      res.status(400).json({ error: `unknown scenarioId: ${String(scenarioId)}` });
      return;
    }
    if (!PHASE_1_SCENARIOS.includes(scenarioId)) {
      res.status(400).json({ error: `scenario ${scenarioId} ships in Phase 2` });
      return;
    }
    const report = await possess(freshPhantomPay(), scenarioId, {
      seed: typeof req.body?.seed === 'number' ? req.body.seed : undefined,
    });
    res.json(report);
  });

  app.post('/api/exorcise', async (req, res) => {
    const scenarioId = req.body?.scenarioId as unknown;
    if (!isScenario(scenarioId)) {
      res.status(400).json({ error: `unknown scenarioId: ${String(scenarioId)}` });
      return;
    }
    if (!PHASE_1_SCENARIOS.includes(scenarioId)) {
      res.status(400).json({ error: `scenario ${scenarioId} ships in Phase 2` });
      return;
    }
    const applied = applyPatch(scenarioId);
    const verification = await possess(loadPatched(), scenarioId, {});
    res.json({ patchedFile: applied.patchedFile, incidentFile: applied.incidentFile, verification });
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
    res.json(await handleJsonRpc(req.body ?? {}));
  });

  // Convenience REST wrappers over the MCP tools (same handlers).
  app.post('/api/mcp/possess', async (req, res) => {
    try {
      res.json(await callTool('possess_target_ui', req.body ?? {}));
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
    console.log(`Possessed UI Phase 1 listening on http://localhost:${PORT}`);
  });
}
