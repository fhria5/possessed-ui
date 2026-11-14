/**
 * Core types for Possessed UI — mirrors blueprint §2.2 (Part 2).
 * PhantomPay amounts are SIMULATED cents, never real money.
 */

export type PossessionScenarioId =
  | 'RACE_DOUBLE_CHARGE'
  | 'NETWORK_3G_CHAOS'
  | 'STORAGE_XSS_SPECTER';

export type ChaosActionType =
  | 'CLICK'
  | 'TYPE'
  | 'THROTTLE_NETWORK'
  | 'CORRUPT_STORAGE'
  | 'ABORT_FETCH';

export interface ChaosActionStep {
  stepIndex: number;
  actionType: ChaosActionType;
  selector?: string;
  payload?: string;
  delayMs: number;
  cursorX: number;
  cursorY: number;
}

export interface PossessionForensics {
  targetFile: string;
  lineNumber: number;
  consoleError: string;
  domSnapshot: string;
  stateCorruptionDetail: string;
  stackTrace: string;
}

export interface CdpCaptureMeta {
  capturedVia: 'playwright-cdp' | 'fallback-in-process';
  browser?: string;
  cdpProtocol?: string;
  targetUrl?: string;
  throttling?: { profile: string; latencyMs: number; downloadKbps: number; uploadKbps: number } | null;
  networkEvents?: Array<{ url: string; status: number; durationMs: number }>;
  observed?: {
    balance: string;
    balanceCents: number;
    charges: number;
    displayedPrice: string;
    currency: string;
    discountCode: string;
    cartStatus: string;
    xssFired: number;
    consoleErrors: string[];
    patched: boolean;
  };
  pageErrors?: Array<{ message: string; stack: string }>;
  reason?: string;
}

export interface PossessionReport {
  sessionId: string;
  scenarioId: PossessionScenarioId;
  entityName: string;
  status: 'POSSESSED_CRASH' | 'EXORCISED_IMMUNE';
  pbtRunsExecuted: number;
  invariantViolated: string;
  shrunkActionSequence: ChaosActionStep[];
  shrinkSteps: number;
  forensics: PossessionForensics;
  proposedPatch: {
    description: string;
    unifiedDiff: string;
    patchedCode: string;
  };
  /** Real-browser capture metadata (Phase 2); absent on the fast in-process path. */
  cdpCapture?: CdpCaptureMeta;
}

export interface PhantomPaySnapshot {
  balance: string;
  balanceCents: number;
  charges: number;
  totalChargedCents: number;
  displayedPrice: string;
  consoleErrors: number;
}

/** Minimal PhantomPay surface the engine drives (see target-app/phantom-pay.js). */
export interface PhantomPayInstance {
  state: {
    balanceCents: number;
    charges: Array<{ id: string; amountCents: number; item: string }>;
    consoleErrors: string[];
    currency: string;
    discountCode: string;
    displayedPriceCents: number;
    cart: unknown;
  };
  loadCart: () => unknown;
  handleCheckout: () => Promise<{ id: string; amountCents: number; item: string }>;
  fetchPrice: (currency: string, discountCode: string) => Promise<{
    priceCents: number;
    currency: string;
    discountCode: string;
    stale?: boolean;
  }>;
  saveCart: (cart: unknown) => unknown;
  corruptCart: (raw: string) => void;
  cartItemHtml: (item: { name: string }) => string;
  snapshot: () => PhantomPaySnapshot;
  formatCents: (cents: number) => string;
  ITEM_PRICE_CENTS: number;
  START_BALANCE_CENTS: number;
}
