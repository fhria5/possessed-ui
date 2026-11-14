/**
 * Exorcist healer tests: the patch is real text applied to a real file,
 * and the patched file behaves correctly.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyPatch,
  buildPatchedSource,
  loadPatched,
  synthesizePatch,
  unifiedDiff,
} from '../src/engine/exorcist-healer';
import { executeActions } from '../src/engine/poltergeist-pbt';
import type { PhantomPayInstance } from '../src/types/possessed';

function freshVulnerable(): PhantomPayInstance {
  const targetPath = require.resolve('../target-app/phantom-pay.js');
  delete require.cache[targetPath];
  const mod = require('../target-app/phantom-pay.js') as {
    createPhantomPay: () => PhantomPayInstance;
  };
  return mod.createPhantomPay();
}

describe('synthesizePatch', () => {
  it('diff contains all three fixes with -/+ lines', () => {
    const patch = synthesizePatch('RACE_DOUBLE_CHARGE');
    expect(patch.description).toContain('idempotency');
    expect(patch.unifiedDiff).toContain('--- a/target-app/phantom-pay.js');
    expect(patch.unifiedDiff).toContain('+++ b/target-app/phantom-pay.patched.js');
    expect(patch.unifiedDiff).toContain('-  // BUG 1: tanpa inFlightLock');
    expect(patch.unifiedDiff).toContain('+  let inFlightCheckout = null;');
    expect(patch.unifiedDiff).toContain('idempotencyKey');
    expect(patch.unifiedDiff).toContain('stale: true');
    expect(patch.unifiedDiff).toContain('try {');
    expect(patch.unifiedDiff).toContain('@@');
  });

  it('patched source parses and keeps the public API', () => {
    const src = buildPatchedSource();
    expect(src).toContain('EXORCISED');
    expect(src).toContain('createPhantomPay');
    expect(src).toContain('handleCheckout');
    expect(src).toContain('loadCart');
    expect(src).toContain('fetchPrice');
  });

  it('unifiedDiff of identical texts has no hunks', () => {
    const diff = unifiedDiff('a\nb\n', 'a\nb\n', 'x.js', 'y.js');
    expect(diff).toContain('--- a/x.js');
    expect(diff).not.toContain('@@');
  });
});

describe('applyPatch', () => {
  it('writes the patched file and an incident record, without touching the original', () => {
    const before = fs.readFileSync(
      path.join(__dirname, '..', 'target-app', 'phantom-pay.js'),
      'utf8',
    );
    const applied = applyPatch('RACE_DOUBLE_CHARGE');
    expect(applied.patchedFile).toBe('target-app/phantom-pay.patched.js');
    const patched = fs.readFileSync(
      path.join(__dirname, '..', 'target-app', 'phantom-pay.patched.js'),
      'utf8',
    );
    expect(patched).toContain('inFlightCheckout');
    expect(patched).not.toBe(before);
    expect(fs.existsSync(path.join(__dirname, '..', applied.incidentFile))).toBe(true);
    const incident = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', applied.incidentFile), 'utf8'),
    ) as { status: string; scenarioId: string };
    expect(incident.status).toBe('EXORCISED');
    expect(incident.scenarioId).toBe('RACE_DOUBLE_CHARGE');
    // Original untouched.
    expect(
      fs.readFileSync(path.join(__dirname, '..', 'target-app', 'phantom-pay.js'), 'utf8'),
    ).toBe(before);
  });

  it('patched instance: triple-click charges once ($750), corrupt cart falls back', async () => {
    applyPatch('RACE_DOUBLE_CHARGE');
    const patched = loadPatched();
    const clicks = Array.from({ length: 3 }, (_, i) => ({
      stepIndex: i,
      actionType: 'CLICK' as const,
      selector: '#pay-button',
      delayMs: 10,
      cursorX: 600,
      cursorY: 340,
    }));
    const result = await executeActions(patched, clicks);
    expect(result.snapshot.balanceCents).toBe(75000);
    expect(result.snapshot.charges).toBe(1);
    expect(result.snapshot.balance).toBe('$750.00');

    patched.corruptCart('{broken');
    expect(() => patched.loadCart()).not.toThrow();
    expect(patched.state.cart).toEqual({ items: [] });
    expect(patched.state.consoleErrors.length).toBeGreaterThan(0);
  });

  it('vulnerable instance still double-charges (sanity: patch did not leak back)', async () => {
    const vuln = freshVulnerable();
    const clicks = Array.from({ length: 3 }, (_, i) => ({
      stepIndex: i,
      actionType: 'CLICK' as const,
      selector: '#pay-button',
      delayMs: 10,
      cursorX: 600,
      cursorY: 340,
    }));
    const result = await executeActions(vuln, clicks);
    expect(result.snapshot.balanceCents).toBe(25000);
    expect(result.snapshot.charges).toBe(3);
  });
});
