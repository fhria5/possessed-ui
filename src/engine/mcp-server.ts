/**
 * MCP JSON-RPC 2.0 Server (blueprint Task 4, Phase 1 scope).
 * Tools: possess_target_ui, inspect_cdp_forensics, exorcise_and_patch.
 * Transport here is HTTP (GET /mcp/tools, POST /mcp/call) served by
 * src/server.ts; the stdio transport for Kiro IDE (.kiro/settings/mcp.json)
 * is out of scope until a later phase.
 */
import type { PhantomPayInstance, PossessionReport, PossessionScenarioId } from '../types/possessed';
import { possess } from './poltergeist-pbt';
import { applyPatch, loadPatched } from './exorcist-healer';

// target-app/phantom-pay.js is plain JS (no types): load via require.
function freshPhantomPay(): PhantomPayInstance {
  const mod = require('../../target-app/phantom-pay.js') as {
    createPhantomPay: () => PhantomPayInstance;
  };
  return mod.createPhantomPay();
}

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: { type: string; properties: Record<string, unknown>; required: string[] };
}

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: 'possess_target_ui',
    description: 'Run a Poltergeist chaos possession against PhantomPay for one scenario and return the PossessionReport.',
    inputSchema: {
      type: 'object',
      properties: {
        scenarioId: { type: 'string', enum: ['RACE_DOUBLE_CHARGE', 'NETWORK_3G_CHAOS', 'STORAGE_XSS_SPECTER'] },
        seed: { type: 'number', description: 'Deterministic fast-check seed (default 20261114).' },
      },
      required: ['scenarioId'],
    },
  },
  {
    name: 'inspect_cdp_forensics',
    description: 'Return the forensics of the most recent possession run (DOM snapshot, stack trace, violated invariant).',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'exorcise_and_patch',
    description: 'Apply the Exorcist self-healing patch for a scenario, then re-run the possession against the patched target to prove immunity.',
    inputSchema: {
      type: 'object',
      properties: {
        scenarioId: { type: 'string', enum: ['RACE_DOUBLE_CHARGE', 'NETWORK_3G_CHAOS', 'STORAGE_XSS_SPECTER'] },
      },
      required: ['scenarioId'],
    },
  },
];

let lastReport: PossessionReport | null = null;

export function listTools(): McpToolDef[] {
  return MCP_TOOLS;
}

export function getLastReport(): PossessionReport | null {
  return lastReport;
}

function isScenario(value: unknown): value is PossessionScenarioId {
  return (
    value === 'RACE_DOUBLE_CHARGE' || value === 'NETWORK_3G_CHAOS' || value === 'STORAGE_XSS_SPECTER'
  );
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'possess_target_ui') {
    if (!isScenario(args.scenarioId)) throw new Error(`unknown scenarioId: ${String(args.scenarioId)}`);
    const instance: PhantomPayInstance = freshPhantomPay();
    const report = await possess(instance, args.scenarioId, {
      seed: typeof args.seed === 'number' ? args.seed : undefined,
    });
    lastReport = report;
    return report;
  }
  if (name === 'inspect_cdp_forensics') {
    if (!lastReport) throw new Error('no possession run yet — call possess_target_ui first');
    return lastReport.forensics;
  }
  if (name === 'exorcise_and_patch') {
    if (!isScenario(args.scenarioId)) throw new Error(`unknown scenarioId: ${String(args.scenarioId)}`);
    const applied = applyPatch(args.scenarioId);
    const patched = loadPatched();
    const verification = await possess(patched, args.scenarioId, {});
    lastReport = verification;
    return {
      patchedFile: applied.patchedFile,
      incidentFile: applied.incidentFile,
      verificationStatus: verification.status,
      verification,
    };
  }
  throw new Error(`unknown tool: ${name}`);
}

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}

export async function handleJsonRpc(req: JsonRpcRequest): Promise<Record<string, unknown>> {
  const id = req.id ?? null;
  try {
    if (req.method === 'tools/list') {
      return { jsonrpc: '2.0', id, result: { tools: listTools() } };
    }
    if (req.method === 'tools/call') {
      const name = req.params?.name ?? '';
      const result = await callTool(name, req.params?.arguments ?? {});
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify(result) }] },
      };
    }
    return { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${req.method}` } };
  } catch (e) {
    return { jsonrpc: '2.0', id, error: { code: -32603, message: (e as Error).message } };
  }
}
