/**
 * MCP JSON-RPC 2.0 Server (blueprint Task 4, Phase 2 scope).
 * Tools: possess_target_ui, inspect_cdp_forensics, exorcise_and_patch.
 * Transport here is HTTP (GET /mcp/tools, POST /mcp/call) served by
 * src/server.ts; the stdio transport for Kiro IDE (.kiro/settings/mcp.json)
 * is out of scope until a later phase.
 * possess_target_ui runs the real-browser CDP capture by default
 * (args.cdp, default true); pass cdp: false for the fast in-process path.
 */
import type { PossessionReport, PossessionScenarioId } from '../types/possessed';
import { exorciseViaServer, possessViaServer } from './possess-service';

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
        seed: { type: 'number', description: 'Deterministic fast-check seed (default 20261121).' },
        cdp: { type: 'boolean', description: 'Real Chromium CDP forensics (default true); false = fast in-process path.' },
        patched: { type: 'boolean', description: 'Run against the Exorcist-patched target (default false).' },
        targetUrl: { type: 'string', description: 'Optional explicit target URL — must be localhost/127.0.0.1 (scope guardrail).' },
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

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  opts: { baseUrl?: string } = {},
): Promise<unknown> {
  if (name === 'possess_target_ui') {
    if (!isScenario(args.scenarioId)) throw new Error(`unknown scenarioId: ${String(args.scenarioId)}`);
    const report = await possessViaServer(args.scenarioId, {
      seed: typeof args.seed === 'number' ? args.seed : undefined,
      cdp: typeof args.cdp === 'boolean' ? args.cdp : undefined,
      patched: args.patched === true,
      targetUrl: typeof args.targetUrl === 'string' ? args.targetUrl : undefined,
      baseUrl: opts.baseUrl,
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
    const out = await exorciseViaServer(args.scenarioId);
    lastReport = out.verification;
    return {
      patchedFile: out.patchedFile,
      incidentFile: out.incidentFile,
      verificationStatus: out.verification.status,
      verification: out.verification,
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

export async function handleJsonRpc(
  req: JsonRpcRequest,
  opts: { baseUrl?: string } = {},
): Promise<Record<string, unknown>> {
  const id = req.id ?? null;
  try {
    if (req.method === 'tools/list') {
      return { jsonrpc: '2.0', id, result: { tools: listTools() } };
    }
    if (req.method === 'tools/call') {
      const name = req.params?.name ?? '';
      const result = await callTool(name, req.params?.arguments ?? {}, opts);
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
