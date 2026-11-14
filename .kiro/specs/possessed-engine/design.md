# Design — Possessed UI Engine

Sumber: Part 2 blueprint (`SPEK.md`).

## High-Level Architecture

```text
+-----------------------------------------------------------------------------------+
|                  THE EXORCIST'S SEANCE CONSOLE (Split-Screen UI)                  |
|                                                                                   |
|  [LEFT: Exorcist Control & Telemetry]   |   [RIGHT: Haunted Target App Sandbox]   |
|  - 3 One-Click Possession Presets       |   - Live PhantomPay Checkout App        |
|  - Live PBT Action Stream & Shrinker    |   - Animated Spectral Ghost Cursor      |
|  - EARS Invariant & Diff Patch Viewer   |   - Real Balance / Cart / Console State |
+-------------------+---------------------+---------------------+-------------------+
                    |                                           ^
                    v                                           | (CDP / PostMessage)
+-----------------------------------------------------------------------------------+
|                      POSSESSED UI CORE ENGINE (Node.js / TS)                      |
|                                                                                   |
|  1. Poltergeist Chaos Engine       2. CDP & DOM Medium       3. Exorcist Healer   |
|  - fast-check Action Arbitraries   - Console/Network Hook    - AST/Line Patcher   |
|  - Race Condition / Latency Chaos  - Invariant Checker       - Auto-Regression    |
|                                                                                   |
|  4. MCP JSON-RPC 2.0 Server (tools/list, tools/call)         5. Scope Guardrail   |
+-----------------------------------------------------------------------------------+
```

## Core TypeScript Data Models (`src/types/possessed.ts`)

```typescript
export type PossessionScenarioId =
  | 'RACE_DOUBLE_CHARGE'
  | 'NETWORK_3G_CHAOS'
  | 'STORAGE_XSS_SPECTER';

export interface ChaosActionStep {
  stepIndex: number;
  actionType: 'CLICK' | 'TYPE' | 'THROTTLE_NETWORK' | 'CORRUPT_STORAGE' | 'ABORT_FETCH';
  selector?: string;
  payload?: string;
  delayMs: number;
  cursorX: number;
  cursorY: number;
}

export interface PossessionReport {
  sessionId: string;
  scenarioId: PossessionScenarioId;
  entityName: string;          // e.g., "Chronos Race Poltergeist"
  status: 'POSSESSED_CRASH' | 'EXORCISED_IMMUNE';
  pbtRunsExecuted: number;
  invariantViolated: string;
  shrunkActionSequence: ChaosActionStep[];
  shrinkSteps: number;
  forensics: {
    targetFile: string;
    lineNumber: number;
    consoleError: string;
    stateCorruptionDetail: string; // e.g., "Expected Balance: $750.00 | Actual: $500.00 (Double Charge!)"
  };
  proposedPatch: {
    description: string;
    unifiedDiff: string;
    patchedCode: string;
  };
}
```

## Built-In Vulnerable Target App (`target-app/phantom-pay.js`)

PhantomPay One-Click Checkout. Saldo awal **$1.000,00**, beli **Cursed Relic
$250,00**. Semua saldo simulasi, bukan uang nyata.

Unpatched vulnerable logic:

1. *Double-Click Race Bug:* `handleCheckout()` does not disable the button or
   attach an `idempotencyKey` while awaiting the async `/api/pay` request
   (which takes 180ms). Clicking 3 times in 40ms deducts `$250.00` three
   times → Balance drops to **`$250.00`** instead of **`$750.00`**!
2. *Network Out-of-Order Bug:* Rapidly switching currency/discount codes
   triggers overlapping fetches where a slow stale response overwrites a newer
   response.
3. *Storage Corruption Bug:* Reading `JSON.parse(localStorage.getItem('phantom_cart'))`
   without a `try/catch` throws an uncaught `SyntaxError` and blanks the UI
   when corrupted by the Storage Banshee.

Self-healed (exorcised) logic: clicking **Perform Exorcism (Apply Auto-Patch)**
injects an `inFlightLock` + `idempotencyKey` + `AbortController` + safe
`try/catch` storage fallback into the target app, and immediately re-runs the
Poltergeist attack to show **`$750.00` exact balance** and **`0 Console Errors`**.

## Backend HTTP & MCP API Specification

- `GET /api/health` — server status, CDP availability, Kiro `.kiro/` sync status.
- `POST /api/possess` — body: `{ scenarioId, isPatched, targetUrl? }`. Runs
  `fast-check` chaos action generation (and optional real Playwright/CDP
  headless session) and returns `PossessionReport`.
- `POST /api/exorcise` — body: `{ scenarioId }`. Applies the self-healing
  patch to `target-app/phantom-pay.js` on disk, records an incident resolution
  in `.kiro/specs/incidents/`, and re-runs the PBT verification suite.
- `GET /api/kiro-files` — returns all 9 `.kiro/` files so judges can inspect
  them directly in the browser.
- `GET /mcp/tools` — JSON-RPC 2.0 `tools/list` exposing `possess_target_ui`,
  `inspect_cdp_forensics`, and `exorcise_and_patch`.
- `POST /mcp/call` — JSON-RPC 2.0 `tools/call` handler for Kiro IDE agent
  integration.
