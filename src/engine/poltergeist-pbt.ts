/**
 * Poltergeist Chaos & PBT Engine (blueprint Task 1, Phase 1 scope).
 *
 * fast-check generates chaotic UI action sequences; the engine executes them
 * against a real PhantomPay instance (target-app/phantom-pay.js) and checks
 * the EARS invariants. Shrinking is deterministic: greedy removal that
 * preserves the EXACT observed corruption signature (balance + charge count),
 * so the race minimal case is 3 clicks (the $250 / 3-charge signature),
 * not 2 (which would be a different, smaller corruption).
 *
 * Phase 1 executes RACE_DOUBLE_CHARGE and STORAGE_XSS_SPECTER
 * deterministically. NETWORK_3G_CHAOS runs a bounded timing sweep
 * (runNetworkRace): the stale-response race is timing-dependent, so the
 * report states how many pairs were tried instead of pretending certainty.
 */
import * as fc from 'fast-check';
import type {
  ChaosActionStep,
  ChaosActionType,
  PhantomPayInstance,
  PossessionReport,
  PossessionScenarioId,
} from '../types/possessed';
import { captureForensics, classifyEntity, snapshotDom } from './cdp-observer';
import { synthesizePatch } from './exorcist-healer';

/**
 * Canonical demo seed, chosen so the default samples reproduce the
 * blueprint's failures deterministically:
 * - RACE_DOUBLE_CHARGE: 3-click burst (delays 46/14/15ms, all inside the
 *   180ms /api/pay window) → $250.00 / 3 charges.
 * - STORAGE_XSS_SPECTER: corrupt write then reload → SyntaxError.
 * Same seed → same actions, every run.
 */
export const DEFAULT_SEED = 20261121;
export const PAY_BUTTON = '#pay-button';
export const DISCOUNT_INPUT = '#discount-input';
export const RELOAD_CART = '#reload-cart';

function stepArb(actionType: ChaosActionType, selector?: string): fc.Arbitrary<Omit<ChaosActionStep, 'stepIndex'>> {
  return fc.record({
    actionType: fc.constant(actionType),
    selector: fc.constant(selector),
    payload: fc.constant(undefined as string | undefined),
    delayMs: fc.integer({ min: 0, max: 50 }),
    cursorX: fc.integer({ min: 560, max: 760 }),
    cursorY: fc.integer({ min: 300, max: 420 }),
  });
}

/** fast-check arbitrary of chaotic action sequences for a scenario. */
export function chaosSequenceArb(scenarioId: PossessionScenarioId): fc.Arbitrary<ChaosActionStep[]> {
  let inner: fc.Arbitrary<Omit<ChaosActionStep, 'stepIndex'>>;
  if (scenarioId === 'RACE_DOUBLE_CHARGE') {
    inner = stepArb('CLICK', PAY_BUTTON);
    return fc.array(inner, { minLength: 2, maxLength: 5 }).map((steps) => withIndex(steps));
  }
  if (scenarioId === 'NETWORK_3G_CHAOS') {
    const typeArb = fc.record({
      actionType: fc.constant('TYPE' as ChaosActionType),
      selector: fc.constant(DISCOUNT_INPUT),
      payload: fc.constantFrom('GHOST10', 'BOO20', ''),
      delayMs: fc.integer({ min: 0, max: 50 }),
      cursorX: fc.integer({ min: 560, max: 760 }),
      cursorY: fc.integer({ min: 300, max: 420 }),
    });
    const throttleArb = stepArb('THROTTLE_NETWORK');
    const abortArb = stepArb('ABORT_FETCH');
    return fc
      .array(fc.oneof(typeArb, throttleArb, abortArb), { minLength: 2, maxLength: 6 })
      .map((steps) => withIndex(steps));
  }
  const corruptArb = fc.record({
    actionType: fc.constant('CORRUPT_STORAGE' as ChaosActionType),
    selector: fc.constant(undefined as string | undefined),
    payload: fc.constantFrom('{bad json', '{"items":', 'not-json', '<script>alert(1)</script>'),
    delayMs: fc.integer({ min: 0, max: 50 }),
    cursorX: fc.integer({ min: 560, max: 760 }),
    cursorY: fc.integer({ min: 300, max: 420 }),
  });
  return fc
    .array(fc.oneof(corruptArb, stepArb('CLICK', RELOAD_CART)), { minLength: 1, maxLength: 4 })
    .map((steps) => withIndex(steps));
}

function withIndex(steps: Array<Omit<ChaosActionStep, 'stepIndex'>>): ChaosActionStep[] {
  return steps.map((s, i) => ({ ...s, stepIndex: i }));
}

/** Deterministic sequence generation: same seed → same actions. */
export function generateChaosSequence(
  scenarioId: PossessionScenarioId,
  seed: number = DEFAULT_SEED,
  numRuns = 1,
): ChaosActionStep[] {
  const samples = fc.sample(chaosSequenceArb(scenarioId), { seed, numRuns });
  return samples[0];
}

export interface ExecutionResult {
  snapshot: ReturnType<PhantomPayInstance['snapshot']>;
  consoleError: string;
  stackTrace: string;
}

/** Execute an action sequence against a PhantomPay instance. */
export async function executeActions(
  instance: PhantomPayInstance,
  actions: ChaosActionStep[],
): Promise<ExecutionResult> {
  const pending: Array<Promise<unknown>> = [];
  let consoleError = '';
  let stackTrace = '';
  for (const action of actions) {
    if (action.delayMs > 0) await sleep(action.delayMs);
    if (action.actionType === 'CLICK' && action.selector === PAY_BUTTON) {
      // Fire-and-forget on purpose: the race IS the bug being reproduced.
      pending.push(instance.handleCheckout().catch((e: Error) => {
        consoleError = e.message;
        stackTrace = e.stack ?? '';
      }));
    } else if (action.actionType === 'CLICK' && action.selector === RELOAD_CART) {
      try {
        instance.loadCart();
      } catch (e) {
        consoleError = (e as Error).message;
        stackTrace = (e as Error).stack ?? '';
      }
    } else if (action.actionType === 'CORRUPT_STORAGE') {
      instance.corruptCart(action.payload ?? '{corrupt');
    } else if (action.actionType === 'TYPE' && action.selector === DISCOUNT_INPUT) {
      instance.state.discountCode = action.payload ?? '';
    }
    // THROTTLE_NETWORK / ABORT_FETCH have no in-process effect: real network
    // shaping needs a browser (CDP, Phase 2). They are recorded in the
    // sequence and exercised by runNetworkRace for the NETWORK scenario.
  }
  await Promise.all(pending);
  await sleep(50); // let the 180ms /api/pay window fully settle
  return { snapshot: instance.snapshot(), consoleError, stackTrace };
}

export interface CorruptionSignature {
  balanceCents: number;
  charges: number;
  threw?: boolean;
}

export function signatureOf(result: ExecutionResult): CorruptionSignature {
  return {
    balanceCents: result.snapshot.balanceCents,
    charges: result.snapshot.charges,
    threw: result.consoleError.length > 0,
  };
}

function sameSignature(a: CorruptionSignature, b: CorruptionSignature): boolean {
  return a.balanceCents === b.balanceCents && a.charges === b.charges && a.threw === b.threw;
}

/**
 * Deterministic greedy shrinker: repeatedly try removing one action; keep the
 * removal only when replaying the shorter sequence reproduces the EXACT same
 * corruption signature. Returns the minimal sequence and the shrink step count.
 */
export async function shrinkToMinimal(
  actions: ChaosActionStep[],
  replay: (seq: ChaosActionStep[]) => Promise<CorruptionSignature>,
  target: CorruptionSignature,
): Promise<{ sequence: ChaosActionStep[]; steps: number }> {
  let current = [...actions];
  let steps = 0;
  let improved = true;
  while (improved && current.length > 1) {
    improved = false;
    for (let i = 0; i < current.length; i++) {
      const candidate = current.filter((_, j) => j !== i);
      steps += 1;
      const sig = await replay(candidate);
      if (sameSignature(sig, target)) {
        current = candidate;
        improved = true;
        break;
      }
    }
  }
  return { sequence: current.map((s, i) => ({ ...s, stepIndex: i })), steps };
}

/** Race invariant: ONE checkout of $250 from $1,000 must leave $750, 1 charge. */
export function checkRaceInvariant(snapshot: ReturnType<PhantomPayInstance['snapshot']>): {
  violated: boolean;
  detail: string;
} {
  const expected = 100000 - 25000;
  if (snapshot.balanceCents !== expected || snapshot.charges !== 1) {
    return {
      violated: true,
      detail: `Expected Balance: $750.00 | Actual: ${snapshot.balance} (${snapshot.charges} charge(s), double charge!)`,
    };
  }
  return { violated: false, detail: 'Balance $750.00, exactly 1 charge — invariant holds.' };
}

/** Storage invariant: loading the cart must never throw. */
export function checkStorageInvariant(result: ExecutionResult): { violated: boolean; detail: string } {
  if (result.consoleError.length > 0) {
    return { violated: true, detail: `loadCart() threw: ${result.consoleError}` };
  }
  return { violated: false, detail: 'loadCart() succeeded — invariant holds.' };
}

/**
 * Bounded timing sweep for the network stale-response race: fire a GHOST10
 * price fetch, then 10ms later a plain EUR fetch; the LAST request must win.
 * Returns the first violating pair, or null when none of the attempts raced.
 */
export async function runNetworkRace(
  instance: PhantomPayInstance,
  attempts = 12,
): Promise<{ violated: boolean; attempts: number; detail: string }> {
  for (let i = 0; i < attempts; i++) {
    const first = instance.fetchPrice('USD', 'GHOST10');
    await sleep(10);
    const second = instance.fetchPrice('EUR', '');
    await Promise.all([first, second]);
    const snap = instance.snapshot();
    if (instance.state.currency !== 'EUR' || instance.state.discountCode !== '') {
      return {
        violated: true,
        attempts: i + 1,
        detail: `Stale response won: displayed ${snap.displayedPrice} with currency ${instance.state.currency} after EUR was requested last (attempt ${i + 1}/${attempts}).`,
      };
    }
  }
  return {
    violated: false,
    attempts,
    detail: `No stale-response win observed in ${attempts} timed pairs — race is timing-dependent, not proven absent.`,
  };
}

/** Full possession run for one scenario against one PhantomPay instance. */
export async function possess(
  instance: PhantomPayInstance,
  scenarioId: PossessionScenarioId,
  opts: { seed?: number; networkAttempts?: number } = {},
): Promise<PossessionReport> {
  const seed = opts.seed ?? DEFAULT_SEED;
  const sessionId = `poss-${scenarioId.toLowerCase()}-${seed}`;
  const entityName = classifyEntity(scenarioId);
  const patch = synthesizePatch(scenarioId);

  if (scenarioId === 'NETWORK_3G_CHAOS') {
    const race = await runNetworkRace(instance, opts.networkAttempts ?? 12);
    const snap = instance.snapshot();
    const forensics = captureForensics({
      scenarioId,
      functionName: 'fetchPrice',
      consoleError: '',
      domSnapshot: snapshotDom(snap),
      stateCorruptionDetail: race.detail,
    });
    return {
      sessionId,
      scenarioId,
      entityName,
      status: race.violated ? 'POSSESSED_CRASH' : 'EXORCISED_IMMUNE',
      pbtRunsExecuted: race.attempts,
      invariantViolated: race.violated
        ? 'REQ-2.2: the last requested price must win; a stale response overwrote it.'
        : '',
      shrunkActionSequence: race.violated
        ? [
            { stepIndex: 0, actionType: 'TYPE', selector: DISCOUNT_INPUT, payload: 'GHOST10', delayMs: 0, cursorX: 600, cursorY: 340 },
            { stepIndex: 1, actionType: 'TYPE', selector: DISCOUNT_INPUT, payload: '', delayMs: 10, cursorX: 600, cursorY: 340 },
          ]
        : [],
      shrinkSteps: 0,
      forensics,
      proposedPatch: patch,
    };
  }

  const actions = generateChaosSequence(scenarioId, seed, 1);
  if (scenarioId === 'STORAGE_XSS_SPECTER') {
    // A real page load always re-reads the cart after chaos: append the
    // reload so the corrupted storage is actually exercised.
    actions.push({
      stepIndex: actions.length,
      actionType: 'CLICK',
      selector: RELOAD_CART,
      delayMs: 0,
      cursorX: 600,
      cursorY: 340,
    });
  }
  const result = await executeActions(instance, actions);
  const check =
    scenarioId === 'RACE_DOUBLE_CHARGE'
      ? checkRaceInvariant(result.snapshot)
      : checkStorageInvariant(result);
  const functionName = scenarioId === 'RACE_DOUBLE_CHARGE' ? 'handleCheckout' : 'loadCart';
  const forensics = captureForensics({
    scenarioId,
    functionName,
    consoleError: result.consoleError,
    domSnapshot: snapshotDom(result.snapshot),
    stateCorruptionDetail: check.detail,
  });

  if (!check.violated) {
    return {
      sessionId,
      scenarioId,
      entityName,
      status: 'EXORCISED_IMMUNE',
      pbtRunsExecuted: 1,
      invariantViolated: '',
      shrunkActionSequence: [],
      shrinkSteps: 0,
      forensics,
      proposedPatch: patch,
    };
  }

  const target = signatureOf(result);
  const { sequence, steps } = await shrinkToMinimal(actions, async (seq) => {
    // Fresh module per replay: target-app keeps its in-memory storage at
    // module level, so a poisoned cart from an earlier replay would leak
    // into the next one and corrupt the shrink.
    const targetPath = require.resolve('../../target-app/phantom-pay.js');
    delete require.cache[targetPath];
    const { createPhantomPay } = require('../../target-app/phantom-pay.js') as {
      createPhantomPay: () => PhantomPayInstance;
    };
    const replayInstance = createPhantomPay();
    const replayResult = await executeActions(replayInstance, seq);
    return signatureOf(replayResult);
  }, target);

  return {
    sessionId,
    scenarioId,
    entityName,
    status: 'POSSESSED_CRASH',
    pbtRunsExecuted: 1,
    invariantViolated:
      scenarioId === 'RACE_DOUBLE_CHARGE'
        ? 'REQ-1.1: a single checkout must charge exactly once (idempotency).'
        : 'REQ-3.1: loading a corrupted cart must fall back, never throw.',
    shrunkActionSequence: sequence,
    shrinkSteps: steps,
    forensics,
    proposedPatch: patch,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
