/**
 * MCP server tests: tools/list + tools/call round-trips.
 */
import { describe, expect, it } from 'vitest';
import { callTool, getLastReport, handleJsonRpc, listTools } from '../src/engine/mcp-server';
import type { PossessionReport } from '../src/types/possessed';

describe('listTools', () => {
  it('exposes exactly the 3 blueprint tools', () => {
    const tools = listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'exorcise_and_patch',
      'inspect_cdp_forensics',
      'possess_target_ui',
    ]);
    for (const t of tools) {
      expect(t.inputSchema.type).toBe('object');
      expect(Array.isArray(t.inputSchema.required)).toBe(true);
    }
  });
});

describe('callTool', () => {
  it('possess_target_ui reproduces the race and stores the report', async () => {
    const report = (await callTool('possess_target_ui', {
      scenarioId: 'RACE_DOUBLE_CHARGE',
      cdp: false,
    })) as PossessionReport;
    expect(report.status).toBe('POSSESSED_CRASH');
    expect(report.shrunkActionSequence).toHaveLength(3);
    expect(getLastReport()?.sessionId).toBe(report.sessionId);
  });

  it('inspect_cdp_forensics returns the last run forensics', async () => {
    await callTool('possess_target_ui', { scenarioId: 'RACE_DOUBLE_CHARGE', cdp: false });
    const forensics = (await callTool('inspect_cdp_forensics', {})) as {
      targetFile: string;
      stateCorruptionDetail: string;
    };
    expect(forensics.targetFile).toBe('target-app/phantom-pay.js');
    expect(forensics.stateCorruptionDetail).toContain('$250.00');
  });

  it('possess_target_ui rejects an external targetUrl (guardrail)', async () => {
    await expect(
      callTool('possess_target_ui', {
        scenarioId: 'RACE_DOUBLE_CHARGE',
        targetUrl: 'https://example.com/',
      }),
    ).rejects.toThrow('guardrail');
  });

  it('exorcise_and_patch heals and re-verifies to IMMUNE', async () => {
    const out = (await callTool('exorcise_and_patch', {
      scenarioId: 'RACE_DOUBLE_CHARGE',
    })) as {
      status: string;
      verificationStatus: string;
      patchedFile: string;
      verification: PossessionReport;
      postPatchRuns: number;
      postPatchViolations: number;
    };
    expect(out.status).toBe('ok');
    expect(out.verificationStatus).toBe('EXORCISED_IMMUNE');
    expect(out.patchedFile).toBe('target-app/phantom-pay.patched.js');
    expect(out.verification.status).toBe('EXORCISED_IMMUNE');
    expect(out.postPatchRuns).toBeGreaterThan(0);
    expect(out.postPatchViolations).toBe(0);
  }, 60000);

  it('unknown tool throws', async () => {
    await expect(callTool('summon_demon', {})).rejects.toThrow('unknown tool');
  });

  it('unknown scenario throws', async () => {
    await expect(callTool('possess_target_ui', { scenarioId: 'NOPE' })).rejects.toThrow(
      'unknown scenarioId',
    );
  });
});

describe('handleJsonRpc', () => {
  it('tools/list returns JSON-RPC 2.0 envelope', async () => {
    const res = await handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(1);
    const result = res.result as { tools: unknown[] };
    expect(result.tools).toHaveLength(3);
  });

  it('tools/call wraps the result as text content', async () => {
    const res = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 'abc',
      method: 'tools/call',
      params: { name: 'possess_target_ui', arguments: { scenarioId: 'RACE_DOUBLE_CHARGE', cdp: false } },
    });
    expect(res.jsonrpc).toBe('2.0');
    const result = res.result as { content: Array<{ type: string; text: string }> };
    const parsed = JSON.parse(result.content[0].text) as PossessionReport;
    expect(parsed.status).toBe('POSSESSED_CRASH');
  });

  it('unknown method returns -32601, tool error returns -32603', async () => {
    const bad = await handleJsonRpc({ jsonrpc: '2.0', id: 2, method: 'nope' });
    expect((bad.error as { code: number }).code).toBe(-32601);
    const err = await handleJsonRpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'nope', arguments: {} },
    });
    expect((err.error as { code: number }).code).toBe(-32603);
  });
});
