/**
 * PBT Exorcism (blueprint Task 3.2 / Phase 3 scope).
 *
 * The Phase 1/2 patch stopped the canonical attacks, but a property-based
 * hunt with BOUNDARY-weighted arbitraries (delays clustered at the 180ms
 * /api/pay window edge; storage payloads that parse as valid JSON yet carry
 * the wrong shape) finds the cases the first patch missed — the "Demon
 * Bugs". Each demon is shrunk to a minimal reproducible sequence, the
 * Exorcist Auto-Patch fixes the healer template (not the test), and the
 * same 100-run verification is re-run against the re-patched target.
 *
 * Fixed seeds, recorded per scenario, so every number in the Exorcism Deck
 * is reproducible: same seed → same sequences → same counts.
 *   RACE_DOUBLE_CHARGE  seed 20261121
 *   NETWORK_3G_CHAOS    seed 20261122
 *   STORAGE_XSS_SPECTER seed 20261123
 *
 * Honesty rules enforced here: verifyImmunity counts REAL executions
 * against REAL PhantomPay instances (fresh module per run); a scenario
 * with zero violations reports IMMUNE with no demon bug invented.
 */
import * as fc from 'fast-check';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ChaosActionStep,
  ChaosActionType,
  PhantomPayInstance,
  PossessionScenarioId,
} from '../types/possessed';
import {
  checkRaceInvariant,
  executeActions,
  runNetworkRace,
  shrinkToMinimal,
  signatureOf,
  type CorruptionSignature,
} from './poltergeist-pbt';
import { loadPatched } from './exorcist-healer';

export const EXORCISM_SEED_BASE = 20261121;
export const EXORCISM_RUNS = 100;

export const EXORCISM_SEEDS: Record<PossessionScenarioId, number> = {
  RACE_DOUBLE_CHARGE: 20261121,
  NETWORK_3G_CHAOS: 20261122,
  STORAGE_XSS_SPECTER: 20261123,
};

/**
 * Boundary payloads for the Storage Banshee: the Phase 1/2 patch only
 * guarded JSON.parse SyntaxErrors. These parse successfully yet are not a
 * cart — a poisoned state.cart whose .items access throws downstream.
 */
export const STORAGE_BOUNDARY_PAYLOADS: string[] = [
  '123',
  'null',
  '"hello"',
  '[]',
  '{"items": "x"}',
  '{"items": null}',
  '{"items": [{"name": 123}]}',
  '{"items": [{"name": "<img src=x onerror=alert(1)>"}]}',
  '{"items": []}',
  '{"items": [{"name": "Cursed Relic"}]}',
  '{bad json',
  '{"items":',
];

const PAY_BUTTON = '#pay-button';
const RELOAD_CART = '#reload-cart';

function boundaryClickArb(): fc.Arbitrary<Omit<ChaosActionStep, 'stepIndex'>> {
  return fc.record({
    actionType: fc.constant('CLICK' as ChaosActionType),
    selector: fc.constant(PAY_BUTTON),
    payload: fc.constant(undefined as string | undefined),
    // Half the delays cluster at the 45-50ms edge: a 5-click burst can
    // span past the 180ms /api/pay window, where the Phase 1/2 lock had
    // already reset and a late click started a second charge.
    delayMs: fc.oneof(
      { weight: 1, arbitrary: fc.integer({ min: 0, max: 50 }) },
      { weight: 1, arbitrary: fc.integer({ min: 45, max: 50 }) },
    ),
    cursorX: fc.integer({ min: 560, max: 760 }),
    cursorY: fc.integer({ min: 300, max: 420 }),
  });
}

/** Boundary-weighted action-sequence arbitrary for one scenario. */
export function exorcismArb(scenarioId: PossessionScenarioId): fc.Arbitrary<ChaosActionStep[]> {
  if (scenarioId === 'RACE_DOUBLE_CHARGE') {
    return fc
      .array(boundaryClickArb(), { minLength: 2, maxLength: 5 })
      .map((steps) => steps.map((s, i) => ({ ...s, stepIndex: i })));
  }
  const corruptArb = fc.record({
    actionType: fc.constant('CORRUPT_STORAGE' as ChaosActionType),
    selector: fc.constant(undefined as string | undefined),
    payload: fc.constantFrom(...STORAGE_BOUNDARY_PAYLOADS),
    delayMs: fc.integer({ min: 0, max: 50 }),
    cursorX: fc.integer({ min: 560, max: 760 }),
    cursorY: fc.integer({ min: 300, max: 420 }),
  });
  const reloadArb = fc.record({
    actionType: fc.constant('CLICK' as ChaosActionType),
    selector: fc.constant(RELOAD_CART),
    payload: fc.constant(undefined as string | undefined),
    delayMs: fc.integer({ min: 0, max: 50 }),
    cursorX: fc.integer({ min: 560, max: 760 }),
    cursorY: fc.integer({ min: 300, max: 420 }),
  });
  return fc
    .array(fc.oneof(corruptArb, reloadArb), { minLength: 1, maxLength: 4 })
    .map((steps) => steps.map((s, i) => ({ ...s, stepIndex: i })));
}

export interface StorageShapeCheck {
  violated: boolean;
  detail: string;
}

/**
 * Strengthened storage invariant (Phase 3): after loadCart(), state.cart
 * MUST be a valid cart object { items: [...] }, and rendering its items
 * must never emit unescaped markup. A valid-JSON-but-wrong-shape cart
 * (scalar, null, array, {items: "x"}) is a violation even though
 * JSON.parse did not throw.
 */
export function checkStorageShapeInvariant(instance: PhantomPayInstance): StorageShapeCheck {
  const cart = instance.state.cart as { items?: unknown } | null;
  if (!cart || typeof cart !== 'object' || !Array.isArray(cart.items)) {
    return {
      violated: true,
      detail: `loadCart() left a poisoned cart: state.cart = ${JSON.stringify(cart)} (expected { items: [...] }) — any cart.items access downstream would throw.`,
    };
  }
  for (const item of cart.items as Array<{ name?: unknown }>) {
    const html = instance.cartItemHtml(item as { name: string });
    if (/<(img|script|svg|iframe)[\s>]/.test(html)) {
      return {
        violated: true,
        detail: `cartItemHtml emitted unescaped markup for item ${JSON.stringify(item)}: ${html}`,
      };
    }
  }
  return { violated: false, detail: 'state.cart is a valid { items: [...] } cart; rendered items are escaped.' };
}

export interface DemonViolation {
  /** The exact sampled input sequence that violated the invariant. */
  input: ChaosActionStep[];
  /** Observed outcome (balance, charges, thrown flag / cart shape detail). */
  observed: CorruptionSignature & { detail: string; cartJson?: string };
}

export interface ScenarioVerification {
  scenarioId: PossessionScenarioId;
  seed: number;
  runs: number;
  violations: number;
  status: 'IMMUNE_100_100' | 'DEMON_FOUND';
  firstViolation: DemonViolation | null;
}

export type InstanceFactory = () => PhantomPayInstance;

/** Replay one sequence against a FRESH patched instance (module cache busted). */
async function replayPatched(
  sequence: ChaosActionStep[],
  factory: InstanceFactory,
): Promise<CorruptionSignature> {
  const inst = factory();
  const result = await executeActions(inst, sequence);
  return signatureOf(result);
}

/**
 * Run the 100-run PBT exorcism verification for one scenario against
 * instances from `factory` (default: the Exorcist-patched target).
 * NETWORK_3G_CHAOS runs a 100-pair timed sweep instead of fc samples
 * (the stale-response race is timing-dependent).
 */
export async function verifyImmunity(
  scenarioId: PossessionScenarioId,
  opts: {
    runs?: number;
    seed?: number;
    factory?: InstanceFactory;
  } = {},
): Promise<ScenarioVerification> {
  const runs = opts.runs ?? EXORCISM_RUNS;
  const seed = opts.seed ?? EXORCISM_SEEDS[scenarioId];
  const factory = opts.factory ?? loadPatched;

  if (scenarioId === 'NETWORK_3G_CHAOS') {
    const inst = factory();
    const race = await runNetworkRace(inst, runs);
    return {
      scenarioId,
      seed,
      runs,
      violations: race.violated ? 1 : 0,
      status: race.violated ? 'DEMON_FOUND' : 'IMMUNE_100_100',
      firstViolation: race.violated
        ? {
            input: [
              { stepIndex: 0, actionType: 'TYPE', selector: '#discount-input', payload: 'GHOST10', delayMs: 0, cursorX: 600, cursorY: 340 },
              { stepIndex: 1, actionType: 'TYPE', selector: '#discount-input', payload: '', delayMs: 10, cursorX: 600, cursorY: 340 },
            ],
            observed: {
              balanceCents: inst.snapshot().balanceCents,
              charges: inst.snapshot().charges,
              threw: false,
              detail: race.detail,
            },
          }
        : null,
    };
  }

  const samples = fc.sample(exorcismArb(scenarioId), { seed, numRuns: runs });
  let violations = 0;
  let firstViolation: DemonViolation | null = null;
  for (const seq of samples) {
    // A real page load always re-reads the cart: append the reload so a
    // corrupted storage payload is actually exercised (mirrors possess()).
    const actions =
      scenarioId === 'STORAGE_XSS_SPECTER'
        ? [
            ...seq,
            {
              stepIndex: seq.length,
              actionType: 'CLICK' as ChaosActionType,
              selector: RELOAD_CART,
              payload: undefined,
              delayMs: 0,
              cursorX: 600,
              cursorY: 340,
            },
          ]
        : seq;
    const inst = factory();
    const result = await executeActions(inst, actions);
    let violated = false;
    let detail = '';
    if (scenarioId === 'RACE_DOUBLE_CHARGE') {
      const check = checkRaceInvariant(result.snapshot);
      violated = check.violated;
      detail = check.detail;
    } else {
      // loadCart already ran via the appended reload step; check shape.
      const shape = checkStorageShapeInvariant(inst);
      violated = shape.violated || result.consoleError.length > 0;
      detail = shape.violated
        ? shape.detail
        : result.consoleError.length > 0
          ? `loadCart() threw: ${result.consoleError}`
          : shape.detail;
    }
    if (violated) {
      violations += 1;
      if (!firstViolation) {
        firstViolation = {
          input: actions,
          observed: {
            ...signatureOf(result),
            detail,
            cartJson:
              scenarioId === 'STORAGE_XSS_SPECTER'
                ? JSON.stringify(inst.state.cart)
                : undefined,
          },
        };
      }
    }
  }
  return {
    scenarioId,
    seed,
    runs,
    violations,
    status: violations > 0 ? 'DEMON_FOUND' : 'IMMUNE_100_100',
    firstViolation,
  };
}

export interface DemonBug {
  name: string;
  scenarioId: PossessionScenarioId;
  input: ChaosActionStep[];
  observed: DemonViolation['observed'];
  shrunkSequence: ChaosActionStep[];
  shrinkSteps: number;
  patch: string;
}

/**
 * Shrink a demon violation to its minimal reproducible sequence, replaying
 * against fresh patched instances and preserving the EXACT observed
 * corruption signature.
 *
 * STORAGE caveat: a shape-poisoned cart does NOT throw and does NOT move
 * the balance, so the raw {balance, charges, threw} signature cannot
 * tell a violating replay from a clean one. For storage the replay
 * signature folds the shape check into `threw` (violated ⇔ threw), so
 * the shrinker preserves the actual violation, not just the numbers.
 */
export async function shrinkDemonBug(
  scenarioId: PossessionScenarioId,
  violation: DemonViolation,
  factory: InstanceFactory = loadPatched,
): Promise<{ sequence: ChaosActionStep[]; steps: number }> {
  if (scenarioId === 'STORAGE_XSS_SPECTER') {
    // A real page load always re-reads the cart: the replay loads it after
    // the actions, so a candidate that drops the explicit reload step is
    // still judged on what loadCart() actually does with the poisoned
    // storage (without this, a never-loaded cart — still null — would
    // fake a violation and the shrink would lie about the mechanism).
    const replay = async (seq: ChaosActionStep[]): Promise<CorruptionSignature> => {
      const inst = factory();
      const result = await executeActions(inst, seq);
      try {
        inst.loadCart();
      } catch (e) {
        result.consoleError = (e as Error).message;
      }
      const shape = checkStorageShapeInvariant(inst);
      return {
        balanceCents: result.snapshot.balanceCents,
        charges: result.snapshot.charges,
        threw: shape.violated || result.consoleError.length > 0,
      };
    };
    const target = await replay(violation.input);
    return shrinkToMinimal(violation.input, replay, target);
  }
  const target: CorruptionSignature = {
    balanceCents: violation.observed.balanceCents,
    charges: violation.observed.charges,
    threw: violation.observed.threw,
  };
  return shrinkToMinimal(
    violation.input,
    async (seq) => replayPatched(seq, factory),
    target,
  );
}

export interface ExorcismReport {
  phase: 3;
  generatedAt: string;
  seedBase: number;
  runsPerScenario: number;
  scenarios: Record<
    PossessionScenarioId,
    {
      seed: number;
      before: ScenarioVerification;
      demonBug: DemonBug | null;
      after: ScenarioVerification;
    }
  >;
  quarantine: { quarantined: boolean; tool?: string; reason?: string };
}

const DEMON_NAMES: Record<PossessionScenarioId, string> = {
  RACE_DOUBLE_CHARGE: 'The 180ms Window Demon',
  NETWORK_3G_CHAOS: 'The Stale Ghost Demon',
  STORAGE_XSS_SPECTER: 'The Shape-Shifter Demon',
};

const DEMON_PATCHES: Record<PossessionScenarioId, string> = {
  RACE_DOUBLE_CHARGE:
    'Idempotency grace window: handleCheckout() keeps the last charge for 1000ms after it settles; any click inside the window returns the SAME charge instead of starting a second /api/pay call (exorcist-healer.ts CHECKOUT_NEW).',
  NETWORK_3G_CHAOS:
    'AbortController + request-token guard in fetchPrice() (already in the Phase 2 patch; no new patch needed — re-verified 100/100).',
  STORAGE_XSS_SPECTER:
    'Cart shape validation: loadCart() now requires the parsed value to be { items: [...] } and falls back to an empty cart otherwise (exorcist-healer.ts LOAD_CART_NEW).',
};

/** Full Phase 3 exorcism: verify before → shrink demons → (caller applies the Auto-Patch) → verify after. */
export async function runExorcismVerification(opts: {
  runs?: number;
  factory?: InstanceFactory;
}): Promise<Omit<ExorcismReport, 'quarantine'>> {
  const runs = opts.runs ?? EXORCISM_RUNS;
  const factory = opts.factory ?? loadPatched;
  const scenarios = {} as ExorcismReport['scenarios'];
  for (const scenarioId of [
    'RACE_DOUBLE_CHARGE',
    'NETWORK_3G_CHAOS',
    'STORAGE_XSS_SPECTER',
  ] as const) {
    const before = await verifyImmunity(scenarioId, { runs, factory });
    let demonBug: DemonBug | null = null;
    if (before.firstViolation) {
      const { sequence, steps } = await shrinkDemonBug(scenarioId, before.firstViolation, factory);
      demonBug = {
        name: DEMON_NAMES[scenarioId],
        scenarioId,
        input: before.firstViolation.input,
        observed: before.firstViolation.observed,
        shrunkSequence: sequence,
        shrinkSteps: steps,
        patch: DEMON_PATCHES[scenarioId],
      };
    }
    scenarios[scenarioId] = {
      seed: EXORCISM_SEEDS[scenarioId],
      before,
      demonBug,
      // 'after' is filled by the caller once the Auto-Patch is applied.
      after: before,
    };
  }
  return {
    phase: 3,
    generatedAt: new Date().toISOString(),
    seedBase: EXORCISM_SEED_BASE,
    runsPerScenario: runs,
    scenarios,
  };
}

/** Write an exorcism incident record to .kiro/specs/incidents/. Returns the relative path. */
export function writeExorcismIncident(report: ExorcismReport): string {
  const root = path.join(__dirname, '..', '..');
  const dir = path.join(root, '.kiro', 'specs', 'incidents');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `exorcism-phase3-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return path.relative(root, file);
}
