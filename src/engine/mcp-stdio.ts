/**
 * Possessed UI — MCP stdio transport (Phase 4 audit fix).
 *
 * `.kiro/settings/mcp.json` used to point at this file while it did not
 * exist (and at `tsx`, which is not a dependency). This is the real entry
 * point: a line-delimited JSON-RPC 2.0 server over stdin/stdout that
 * delegates `tools/list` / `tools/call` to the shared handlers in
 * ./mcp-server.ts. Run after build: `node dist/engine/mcp-stdio.js`.
 *
 * Notes:
 * - stdout is the protocol channel: only JSON-RPC replies go there; all
 *   diagnostics go to stderr.
 * - `initialize` / `ping` are answered here (the HTTP handler has no
 *   session concept); `tools/list` and `tools/call` go through
 *   handleJsonRpc. Notifications (no `id`) get no reply.
 * - The CDP path needs the Mode A server for its harness; set
 *   POSSESSED_BASE_URL to its origin (default http://127.0.0.1:8933).
 *   If the server is down, possession falls back to the in-process run and
 *   says so honestly in `cdpCapture`.
 */
import * as readline from 'node:readline';
import { handleJsonRpc } from './mcp-server';
import { resolveBaseUrl } from './possess-service';

const BASE_URL = resolveBaseUrl();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function handleLine(line: string): Promise<void> {
  let req: unknown;
  try {
    req = JSON.parse(line);
  } catch (e) {
    process.stderr.write(`mcp-stdio: invalid JSON line: ${(e as Error).message}\n`);
    return;
  }
  if (!isRecord(req) || typeof req.method !== 'string') {
    process.stderr.write('mcp-stdio: skipping non-request line\n');
    return;
  }
  const hasId = req.id !== undefined && req.id !== null;
  const method = req.method as string;

  // MCP lifecycle: answer initialize/ping here; notifications get no reply.
  if (method === 'notifications/initialized' || method.startsWith('notifications/')) {
    return;
  }
  if (method === 'initialize') {
    if (!hasId) return;
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'possessed-ui-exorcist', version: '0.1.0' },
        },
      }) + '\n',
    );
    return;
  }
  if (method === 'ping') {
    if (!hasId) return;
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: {} }) + '\n');
    return;
  }

  const reply = await handleJsonRpc(
    {
      jsonrpc: '2.0',
      id: (req.id as string | number | null) ?? null,
      method: method as 'tools/list' | 'tools/call',
      params: isRecord(req.params)
        ? (req.params as { name?: string; arguments?: Record<string, unknown> })
        : undefined,
    },
    { baseUrl: BASE_URL },
  );
  if (!hasId) return;
  process.stdout.write(JSON.stringify(reply) + '\n');
}

async function main(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line: string) => {
    void handleLine(line).catch((e: Error) => {
      process.stderr.write(`mcp-stdio: handler error: ${e.message}\n`);
    });
  });
  await new Promise<void>((resolve) => rl.on('close', resolve));
}

if (require.main === module) {
  main().catch((e: Error) => {
    process.stderr.write(`mcp-stdio: fatal: ${e.message}\n`);
    process.exitCode = 1;
  });
}
