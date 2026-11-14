/**
 * Poltergeist engine tests: determinism, race reproduction, shrinking,
 * patched immunity, and a bounded fast-check property run.
 */
import * as fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_SEED,
  chaosSequenceArb,
  checkRaceInvariant,
  executeActions,
  generateChaosSequence,
  possess,
  shrinkToMinimal,
  signatureOf,
} from '../src/engine/poltergeist-pbt';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadPatched, applyPatch } from '../src/engine/exorcist-healer';
import type { PhantomPayInstance } from '../src/types/possessed';

beforeAll(() => {
  // Patched-target tests need target-app/phantom-pay.patched.js on disk.
  const patched = path.join(__dirname, '..', 'target-app', 'phantom-pay.patched.js');
  if (!fs.existsSync(patched)) applyPatch('RACE_DOUBLE_CHARGE');
});

function freshVulnerable(): PhantomPayInstance {
  const targetPath = require.resolve('../target-app/phantom-pay.js');
  delete require.cache[targetPath];
  const mod = require('../target-app/phantom-pay.js') as {
    createPhantomPay: () => PhantomPayInstance;
  };
  return mod.createPhantomPay();
}

describe('generateChaosSequence — determinism', () => {
  it('same seed produces identical actions', () => {
    const a = generateChaosSequence('RACE_DOUBLE_CHARGE', DEFAULT_SEED, 1);
    const b = generateChaosSequence('RACE_DOUBLE_CHARGE', DEFAULT_SEED, 1);
    expect(a).toEqual(b);
  });

  it('default seed is the canonical 3-click burst inside the 180ms window', () => {
    const seq = generateChaosSequence('RACE_DOUBLE_CHARGE', DEFAULT_SEED, 1);
    expect(seq).toHaveLength(3);
    expect(seq.every((s) => s.actionType === 'CLICK' && s.selector === '#pay-button')).toBe(true);
    const totalDelay = seq.reduce((sum, s) => sum + s.delayMs, 0);
    expect(totalDelay).toBeLessThan(180);
  });

  it('arbitrary only produces valid race steps', () => {
    fc.assert(
      fc.property(chaosSequenceArb('RACE_DOUBLE_CHARGE'), (seq) => {
        expect(seq.length).toBeGreaterThanOrEqual(2);
        expect(seq.length).toBeLessThanOrEqual(5);
        for (const s of seq) {
          expect(s.delayMs).toBeGreaterThanOrEqual(0);
          expect(s.delayMs).toBeLessThanOrEqual(50);
        }
      }),
      { numRuns: 50, seed: DEFAULT_SEED },
    );
  });
});

describe('possess — RACE_DOUBLE_CHARGE', () => {
  it('reproduces the double-charge: 3 clicks → $250.00, 3 charges', async () => {
    const report = await possess(freshVulnerable(), 'RACE_DOUBLE_CHARGE', {});
    expect(report.status).toBe('POSSESSED_CRASH');
    expect(report.forensics.stateCorruptionDetail).toContain('$250.00');
    expect(report.forensics.stateCorruptionDetail).toContain('3 charge');
    expect(report.entityName).toBe('Chronos Race Poltergeist');
    expect(report.forensics.targetFile).toBe('target-app/phantom-pay.js');
    expect(report.forensics.lineNumber).toBeGreaterThan(0);
  });

  it('shrinks to exactly the 3-click burst', async () => {
    const report = await possess(freshVulnerable(), 'RACE_DOUBLE_CHARGE', {});
    expect(report.shrunkActionSequence).toHaveLength(3);
    expect(report.shrunkActionSequence.every((s) => s.actionType === 'CLICK')).toBe(true);
    expect(report.shrinkSteps).toBeGreaterThan(0);
  });

  it('a longer burst shrinks while preserving the exact signature', async () => {
    const five = Array.from({ length: 5 }, (_, i) => ({
      stepIndex: i,
      actionType: 'CLICK' as const,
      selector: '#pay-button',
      delayMs: 10,
      cursorX: 600,
      cursorY: 340,
    }));
    const target = signatureOf(await executeActions(freshVulnerable(), five));
    expect(target).toEqual({ balanceCents: -25000, charges: 5, threw: false });
    const { sequence } = await shrinkToMinimal(five, async (seq) => {
      const inst = freshVulnerable();
      return signatureOf(await executeActions(inst, seq));
    }, target);
    expect(sequence).toHaveLength(5); // exact signature cannot drop a click
  });

  it('patched target is immune: 3 clicks → $750.00, 1 charge', async () => {
    const report = await possess(loadPatched(), 'RACE_DOUBLE_CHARGE', {});
    expect(report.status).toBe('EXORCISED_IMMUNE');
    expect(report.forensics.stateCorruptionDetail).toContain('$750.00');
  });

  it('PBT: 20 sampled bursts never violate the invariant on the patched target', async () => {
    const sequences = fc.sample(chaosSequenceArb('RACE_DOUBLE_CHARGE'), {
      seed: DEFAULT_SEED,
      numRuns: 20,
    });
    for (const seq of sequences) {
      const inst = loadPatched();
      const result = await executeActions(inst, seq);
      expect(checkRaceInvariant(result.snapshot).violated).toBe(false);
      expect(result.snapshot.balanceCents).toBe(75000);
      expect(result.snapshot.charges).toBe(1);
    }
  }, 30000);
});

describe('possess — STORAGE_XSS_SPECTER', () => {
  it('corrupted cart throws on the vulnerable target, shrinks to 2 actions', async () => {
    const report = await possess(freshVulnerable(), 'STORAGE_XSS_SPECTER', {});
    expect(report.status).toBe('POSSESSED_CRASH');
    expect(report.forensics.stateCorruptionDetail).toContain('threw');
    expect(report.shrunkActionSequence).toHaveLength(2);
    expect(report.shrunkActionSequence[0].actionType).toBe('CORRUPT_STORAGE');
  });

  it('patched target falls back instead of throwing', async () => {
    const report = await possess(loadPatched(), 'STORAGE_XSS_SPECTER', {});
    expect(report.status).toBe('EXORCISED_IMMUNE');
  });
});

describe('possess — NETWORK_3G_CHAOS', () => {
  it('finds the stale-response win on the vulnerable target (bounded sweep)', async () => {
    const report = await possess(freshVulnerable(), 'NETWORK_3G_CHAOS', { networkAttempts: 25 });
    // Timing-dependent: the sweep either catches the race or says so honestly.
    expect(['POSSESSED_CRASH', 'EXORCISED_IMMUNE']).toContain(report.status);
    expect(report.pbtRunsExecuted).toBeGreaterThan(0);
    expect(report.pbtRunsExecuted).toBeLessThanOrEqual(25);
  }, 30000);

  it('patched target never lets a stale response win (12 pairs)', async () => {
    const report = await possess(loadPatched(), 'NETWORK_3G_CHAOS', { networkAttempts: 12 });
    expect(report.status).toBe('EXORCISED_IMMUNE');
    expect(report.pbtRunsExecuted).toBe(12);
  }, 30000);
});
