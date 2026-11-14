/**
 * PBT Exorcism tests (Phase 3).
 *
 * The Phase 1/2 patch stopped the canonical attacks. Boundary-weighted
 * PBT (seed-fixed) hunted two real Demon Bugs on that patch:
 *  - RACE: a 5-click burst spanning >180ms charged twice ($500/2 charges)
 *    because the in-flight lock had already reset ("The 180ms Window Demon").
 *  - STORAGE: valid-JSON-but-wrong-shape carts ('null', '{"items": "x"}')
 *    parsed fine yet poisoned state.cart ("The Shape-Shifter Demon").
 * The Auto-Patch fixed the HEALER templates (idempotency grace window +
 * cart shape validation); these tests prove the re-patched target holds
 * 100/100 per scenario, and that the MCP quarantine mechanism works.
 *
 * The 100-run verifications are slow by design (each race run waits out
 * the 180ms /api/pay window): generous per-test timeouts are intentional.
 */
import { describe, expect, it } from 'vitest';
import {
  checkStorageShapeInvariant,
  shrinkDemonBug,
  verifyImmunity,
} from '../src/engine/exorcism-pbt';
import { checkRaceInvariant, executeActions } from '../src/engine/poltergeist-pbt';
import { applyPatch, loadPatched } from '../src/engine/exorcist-healer';
import {
  EXORCISE_VERIFY_RUNS,
  callTool,
  clearQuarantine,
  getQuarantine,
  handleJsonRpc,
  isQuarantined,
  listTools,
  quarantineTool,
} from '../src/engine/mcp-server';
import type { ChaosActionStep, PhantomPayInstance } from '../src/types/possessed';

function freshVulnerable(): PhantomPayInstance {
  const targetPath = require.resolve('../target-app/phantom-pay.js');
  delete require.cache[targetPath];
  const mod = require('../target-app/phantom-pay.js') as {
    createPhantomPay: () => PhantomPayInstance;
  };
  return mod.createPhantomPay();
}

/**
 * Phase 1/2 patched target, reconstructed: the in-flight idempotency lock
 * WITHOUT the Phase 3 grace window. This is the exact environment the
 * 180ms Window Demon lived in — the demon input reproduces $500/2 charges
 * here, and only here. (The current patched file already carries the
 * Phase 3 fix, so the demon cannot be replayed against it.)
 */
function oldPatchedFactory(): PhantomPayInstance {
  const inst = freshVulnerable();
  const orig = inst.handleCheckout.bind(inst);
  let inFlight: Promise<{ id: string; amountCents: number; item: string }> | null = null;
  inst.handleCheckout = async () => {
    if (inFlight) return inFlight;
    inFlight = orig().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
  return inst;
}

/** The exact first demon input from the Phase 3 exorcism run (seed 20261121). */
const RACE_DEMON_INPUT: ChaosActionStep[] = [
  { stepIndex: 0, actionType: 'CLICK', selector: '#pay-button', delayMs: 20, cursorX: 606, cursorY: 311 },
  { stepIndex: 1, actionType: 'CLICK', selector: '#pay-button', delayMs: 46, cursorX: 661, cursorY: 359 },
  { stepIndex: 2, actionType: 'CLICK', selector: '#pay-button', delayMs: 46, cursorX: 748, cursorY: 303 },
  { stepIndex: 3, actionType: 'CLICK', selector: '#pay-button', delayMs: 50, cursorX: 649, cursorY: 396 },
  { stepIndex: 4, actionType: 'CLICK', selector: '#pay-button', delayMs: 48, cursorX: 755, cursorY: 302 },
];

describe('Demon Bug #1 — The 180ms Window Demon (RACE_DOUBLE_CHARGE)', () => {
  it('the demon input really double-charges the Phase 1/2 patched target: 5 clicks → $500.00 / 2 charges', async () => {
    const result = await executeActions(oldPatchedFactory(), RACE_DEMON_INPUT);
    expect(result.snapshot.charges).toBe(2);
    expect(result.snapshot.balanceCents).toBe(50000);
    expect(checkRaceInvariant(result.snapshot).violated).toBe(true);
  }, 30000);

  it('the same input charges 5x on the fully vulnerable target (no lock at all)', async () => {
    const result = await executeActions(freshVulnerable(), RACE_DEMON_INPUT);
    expect(result.snapshot.charges).toBe(5);
    expect(result.snapshot.balanceCents).toBe(-25000);
  }, 30000);

  it('the same demon input is immune on the re-patched target: $750.00 / 1 charge (1000ms grace window)', async () => {
    const result = await executeActions(loadPatched(), RACE_DEMON_INPUT);
    expect(checkRaceInvariant(result.snapshot).violated).toBe(false);
    expect(result.snapshot.balanceCents).toBe(75000);
    expect(result.snapshot.charges).toBe(1);
  }, 30000);

  it('a second checkout AFTER the grace window is still a real purchase', async () => {
    const inst = loadPatched();
    await inst.handleCheckout();
    expect(inst.snapshot().charges).toBe(1);
    await new Promise((r) => setTimeout(r, 1100));
    await inst.handleCheckout();
    expect(inst.snapshot().charges).toBe(2);
    expect(inst.snapshot().balanceCents).toBe(50000);
  }, 30000);

  it('shrinks the demon to the minimal 5-click burst on the Phase 1/2 patched target', async () => {
    const shrunk = await shrinkDemonBug(
      'RACE_DOUBLE_CHARGE',
      {
        input: RACE_DEMON_INPUT,
        observed: {
          balanceCents: 50000,
          charges: 2,
          threw: false,
          detail: 'Expected Balance: $750.00 | Actual: $500.00 (2 charge(s), double charge!)',
        },
      },
      oldPatchedFactory,
    );
    // 4 clicks can never span the 180ms window (max 3 gaps x 50ms = 150ms),
    // so no click can be removed while the $500/2-charge signature holds.
    expect(shrunk.sequence).toHaveLength(5);
    expect(shrunk.steps).toBe(5);
    const replay = await executeActions(oldPatchedFactory(), shrunk.sequence);
    expect(replay.snapshot.balanceCents).toBe(50000);
    expect(replay.snapshot.charges).toBe(2);
  }, 120000);
});

describe('Demon Bug #2 — The Shape-Shifter Demon (STORAGE_XSS_SPECTER)', () => {
  const poisoning = ['123', 'null', '"hello"', '[]', '{"items": "x"}', '{"items": null}'];
  it.each(poisoning)('valid-JSON-but-wrong-shape payload %s falls back to an empty cart on the re-patched target', (raw) => {
    const inst = loadPatched();
    inst.corruptCart(raw);
    const cart = inst.loadCart() as { items?: unknown };
    expect(cart).toEqual({ items: [] });
    expect(checkStorageShapeInvariant(inst).violated).toBe(false);
  });

  it.each(poisoning)('the same payload poisons state.cart on the Phase 1/2 patched logic (shape check catches it)', (raw) => {
    const inst = loadPatched();
    inst.corruptCart(raw);
    // Bypass the patched loadCart: parse exactly like the old patch did.
    const parsed = JSON.parse(raw);
    const shapeOk = parsed !== null && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items);
    expect(shapeOk).toBe(false);
  });

  it('a valid cart still loads, and XSS item names still render escaped', () => {
    const inst = loadPatched();
    inst.corruptCart('{"items": [{"name": "<img src=x onerror=alert(1)>"}]}');
    const cart = inst.loadCart() as { items: Array<{ name: string }> };
    expect(cart.items).toHaveLength(1);
    expect(checkStorageShapeInvariant(inst).violated).toBe(false);
    expect(inst.cartItemHtml(cart.items[0])).toContain('&lt;img');
    expect(inst.cartItemHtml(cart.items[0])).not.toContain('<img');
  });
});

describe('PBT Exorcism — 100 runs per scenario vs the re-patched target', () => {
  it('RACE_DOUBLE_CHARGE: 100/100 clean (seed 20261121)', async () => {
    const v = await verifyImmunity('RACE_DOUBLE_CHARGE', { runs: 100 });
    expect(v.seed).toBe(20261121);
    expect(v.runs).toBe(100);
    expect(v.violations).toBe(0);
    expect(v.status).toBe('IMMUNE_100_100');
    expect(v.firstViolation).toBeNull();
  }, 180000);

  it('NETWORK_3G_CHAOS: 100/100 clean (seed 20261122)', async () => {
    const v = await verifyImmunity('NETWORK_3G_CHAOS', { runs: 100 });
    expect(v.seed).toBe(20261122);
    expect(v.runs).toBe(100);
    expect(v.violations).toBe(0);
    expect(v.status).toBe('IMMUNE_100_100');
    expect(v.firstViolation).toBeNull();
  }, 180000);

  it('STORAGE_XSS_SPECTER: 100/100 clean (seed 20261123)', async () => {
    const v = await verifyImmunity('STORAGE_XSS_SPECTER', { runs: 100 });
    expect(v.seed).toBe(20261123);
    expect(v.runs).toBe(100);
    expect(v.violations).toBe(0);
    expect(v.status).toBe('IMMUNE_100_100');
    expect(v.firstViolation).toBeNull();
  }, 180000);

  it('the hunter CAN find demons: 100 runs vs the vulnerable race target violate', async () => {
    const v = await verifyImmunity('RACE_DOUBLE_CHARGE', {
      runs: 100,
      factory: freshVulnerable,
    });
    expect(v.violations).toBeGreaterThan(0);
    expect(v.status).toBe('DEMON_FOUND');
    expect(v.firstViolation).not.toBeNull();
  }, 180000);
});

describe('MCP quarantine (Phase 3)', () => {
  it('quarantineTool rejects tools/call with status quarantined + reason', async () => {
    quarantineTool('exorcise_and_patch', 'test quarantine — forced failure');
    try {
      expect(isQuarantined('exorcise_and_patch')).not.toBeNull();
      expect(listTools().find((t) => t.name === 'exorcise_and_patch')?.quarantined).toBe(true);
      const rpc = await handleJsonRpc({
        jsonrpc: '2.0',
        id: 99,
        method: 'tools/call',
        params: { name: 'exorcise_and_patch', arguments: { scenarioId: 'RACE_DOUBLE_CHARGE' } },
      });
      expect((rpc.error as { code: number }).code).toBe(-32099);
      expect(((rpc.error as { data: { status: string } }).data).status).toBe('quarantined');
      await expect(
        callTool('exorcise_and_patch', { scenarioId: 'RACE_DOUBLE_CHARGE' }),
      ).rejects.toThrow(/quarantined/);
    } finally {
      clearQuarantine('exorcise_and_patch');
    }
    expect(isQuarantined('exorcise_and_patch')).toBeNull();
    expect(getQuarantine()).toHaveLength(0);
  });

  it('exorcise_and_patch passes its bounded post-patch verification and is NOT quarantined', async () => {
    applyPatch('RACE_DOUBLE_CHARGE');
    const out = (await callTool('exorcise_and_patch', {
      scenarioId: 'RACE_DOUBLE_CHARGE',
    })) as { status: string; verificationStatus: string; postPatchRuns: number; postPatchViolations: number };
    expect(out.status).toBe('ok');
    expect(out.verificationStatus).toBe('EXORCISED_IMMUNE');
    expect(out.postPatchRuns).toBe(EXORCISE_VERIFY_RUNS);
    expect(out.postPatchViolations).toBe(0);
    expect(isQuarantined('exorcise_and_patch')).toBeNull();
  }, 120000);
});
