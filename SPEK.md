# POSSESSED UI — MASTER SPECIFICATION, PRD, DESIGN & ONE-SHOT BUILD PROMPT
**Project Name:** Possessed UI (Autonomous Paranormal Chaos-Testing & Self-Healing Agent)  
**Target Event:** Kiroween Hackathon (Kiro IDE)  
**Target Prize Tracks:** Grand Prize ($30,000), Best Resurrection / Frankenstein ($5,000), Best Startup Project ($10,000)  
**Core Technologies:** Kiro IDE (Specs/EARS, Steering, Hooks, MCP), Chrome DevTools Protocol (CDP / Playwright), Property-Based Testing (`fast-check`), Node.js + TypeScript, Self-Contained Live Sandbox UI

---

## PART 0: AUTONOMOUS AGENT EXECUTION DIRECTIVES (YOLO MODE)

You are an autonomous Principal Systems Architect and Full-Stack Engineer. Build **Possessed UI** from scratch to 100% completion in a single uninterrupted run following every specification in this document:

1. **Zero Placeholders or Stubs:** Never write `// TODO`, `// implement later`, or mock stubs without real working logic. Every chaos injector, CDP/DOM observer, Property-Based Test (`fast-check`), self-healing AST/code patcher, MCP JSON-RPC endpoint, and UI animation must work end-to-end.
2. **No Confirmation Pauses:** Do not ask questions. Make decisive technical choices, create all directories, install dependencies, run the test suite, and verify the build autonomously.
3. **Complete `.kiro/` Directory Implementation:** Judges directly grade the `.kiro/` directory. Generate all 9 specification, steering, hook, and MCP configuration files detailed in **Part 4**.
4. **Dual-Mode Live Execution (Local CDP Server + Instant Interactive Web Sandbox):**
   - **Mode A (Full Stack Local + Real CDP Browser):** Node.js + TypeScript backend (`src/server.ts`) with real Playwright/CDP browser controller (`src/engine/cdp-poltergeist.ts`) that launches a real headless/headed Chromium instance against any local URL or the built-in vulnerable target app, injects chaos, captures real console/network exceptions, patches `target-app/checkout.js` on disk, and re-verifies.
   - **Mode B (Zero-Setup Embedded Live Split-Screen Arena):** The web dashboard (`public/index.html` + `public/app.js`) embeds a live, interactive **Split-Screen Target App Arena** (`PhantomPay Checkout & Wallet`) right beside the **Exorcist Command Console**—complete with a visible animated **Ghost Cursor**, live DOM glitching, real double-charge race condition simulation, live code diff patching, and client-side fallback logic so judges can test the full Possession $\rightarrow$ Crash $\rightarrow$ Exorcism $\rightarrow$ Self-Heal loop in 30 seconds (both locally and on GitHub Pages!).

---

## PART 1: PRODUCT REQUIREMENTS DOCUMENT (PRD)

### 1.1 Executive Summary
Modern web applications pass 100% of unit tests yet crash catastrophically in production under chaotic real-world user behavior: rapid double-clicks during slow 3G networks, malformed Unicode/XSS inputs, corrupted `localStorage` states, and out-of-order API responses.

**Possessed UI** is an autonomous **Paranormal Chaos-Testing & Self-Healing Agent** built for Kiro IDE:
1. **The Poltergeist (Chaos & PBT Agent):** Connects via **Model Context Protocol (MCP)** and **Chrome DevTools Protocol (CDP)** to actively "possess" a target web UI—firing `fast-check` Property-Based UI action sequences (rapid multi-clicks, network latency spikes, storage mutation, boundary form payloads) to uncover hidden race conditions and state crashes.
2. **The Medium (CDP Telemetry & EARS Spec Matcher):** Captures exact DOM snapshots, network race traces, and JavaScript stack traces, mapping the crash against `.kiro/specs/possessed-engine/requirements.md` invariants.
3. **The Exorcist (Autonomous Self-Healing Patcher):** Synthesizes an idempotency, debounce, and input-sanitization code patch, applies it to the target source file, triggers `.kiro/hooks/` verification, and re-unleashes the Poltergeist to prove 100% immunity.

### 1.2 Judging Criteria Alignment (20% Each)
* **Potential Impact (20%):** Eliminates brittle manual QA and flaky E2E scripts by turning chaos testing and bug fixing into a continuous, autonomous self-healing loop.
* **Technological Implementation (20%):** Deeply integrates all Kiro IDE pillars: EARS requirements in `.kiro/specs/`, frontend resilience rules in `.kiro/steering/`, automated incident/patch hooks in `.kiro/hooks/`, native MCP server (`tools/list`, `tools/call`), CDP browser control, and `fast-check` Property-Based Testing.
* **Design (20%):** **"The Exorcist's Seance Console"**—an unforgettable split-screen Gothic-Cyberpunk command center featuring a live haunted target app, an animated spectral Ghost Cursor, CRT glitch overlays during possession, and real-time code diff healing.
* **Innovation (20%):** Bridges Chrome DevTools Protocol (CDP) browser chaos directly into Kiro's Spec-Driven self-healing loop via MCP.
* **Presentation (20%):** Includes **3 One-Click Possession Scenarios** (*Double-Click Race Condition*, *3G Network Out-of-Order Chaos*, *Corrupted Storage & XSS Specter*) that run live in under 45 seconds.

### 1.3 Functional Requirements (Kiro EARS Format)

#### Requirement 1: Paranormal Chaos Injection & Property-Based UI Fuzzing
**User Story:** As a QA & reliability engineer, I want to unleash an autonomous Poltergeist agent on my web application so that hidden race conditions and UI crashes are discovered automatically.
* **1.1** **WHEN** the user triggers a Possession run via the UI or MCP `possess_target_ui` tool, **THE SYSTEM SHALL** execute a `fast-check` property-based sequence of chaotic browser actions (rapid button clicks $<50\text{ms}$ apart, network latency injection, storage mutation, and boundary form payloads).
* **1.2** **WHILE** the Poltergeist is active, **THE SYSTEM SHALL** stream real-time cursor coordinates, DOM mutations, intercepted network requests, and console errors to the dashboard.
* **1.3** **IF** a state invariant is violated (e.g., account balance deducted twice for a single order, or an unhandled `TypeError` thrown), **THEN THE SYSTEM SHALL** halt the possession run, capture the minimal shrunk action sequence, and classify the entity class (`RACE_POLTERGEIST`, `NETWORK_WRAITH`, or `STORAGE_BANSHEE`).

#### Requirement 2: CDP Forensics & Kiro Spec Invariant Diagnostics
**User Story:** As a developer, I want every UI crash captured with exact stack traces and matched against my EARS requirements so that I know precisely why the application broke.
* **2.1** **WHEN** a possession anomaly is detected, **THE SYSTEM SHALL** capture the failing DOM state, HTTP status/timing trace, and exact source file line number via Chrome DevTools Protocol (CDP).
* **2.2** **WHEN** diagnostics complete, **THE SYSTEM SHALL** generate a structured incident report in `.kiro/specs/incidents/` and link the failure to the violated EARS invariant in `.kiro/specs/possessed-engine/requirements.md`.

#### Requirement 3: Autonomous Self-Healing Exorcism & Verification
**User Story:** As a software engineer, I want an Exorcist agent to automatically generate and apply a resilient code patch so that the bug is fixed and verified without manual debugging.
* **3.1** **WHEN** the user clicks **"Perform Exorcism (Auto-Heal Code)"** or invokes MCP `exorcise_bug`, **THE SYSTEM SHALL** synthesize a targeted code patch (adding idempotency keys, submission locks, null-safe storage parsing, and AbortController guards) and apply it to the target application.
* **3.2** **WHEN** a patch is applied, **THE SYSTEM SHALL** automatically re-run the exact minimal counterexample sequence plus 100 `fast-check` property runs to verify 0 crashes and 100% invariant compliance.

#### Requirement 4: Safety Guardrails & Scope Containment
**User Story:** As a security engineer, I want the Poltergeist chaos agent strictly sandboxed to `localhost` or explicitly allowlisted staging URLs so that it can never target external production websites.
* **4.1** **WHERE** a target URL is configured for CDP possession, **THE SYSTEM SHALL** enforce a strict allowlist permitting only `localhost`, `127.0.0.1`, or the built-in sandbox iframe, immediately blocking any external domain.

---

## PART 2: TECHNICAL SYSTEM DESIGN (`design.md`)

### 2.1 High-Level Architecture
```
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

### 2.2 Core TypeScript Data Models (`src/types/possessed.ts`)
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

### 2.3 Built-In Vulnerable Target App (`target-app/phantom-pay.js` & Embedded Sandbox)
To guarantee that judges experience a crystal-clear, dramatic bug and self-healing patch without external setup:
- **Target App ("PhantomPay One-Click Checkout"):**
  - User starts with **`$1,000.00` Wallet Balance** and buys a **`$250.00` Cursed Relic**.
  - **Unpatched Vulnerable Logic:**
    1. *Double-Click Race Bug:* `handleCheckout()` does not disable the button or attach an `idempotencyKey` while awaiting the async `/api/pay` request (which takes 180ms). Clicking 3 times in 40ms deducts `$250.00` three times $\rightarrow$ Balance drops to **`$250.00`** instead of **`$750.00`**!
    2. *Network Out-of-Order Bug:* Rapidly switching currency/discount codes triggers overlapping fetches where a slow stale response overwrites a newer response.
    3. *Storage Corruption Bug:* Reading `JSON.parse(localStorage.getItem('phantom_cart'))` without a `try/catch` throws an uncaught `SyntaxError` and blanks the UI when corrupted by the Storage Banshee.
  - **Self-Healed Exorcised Logic:**
    - Clicking **`[✝️ Perform Exorcism (Apply Auto-Patch)]`** injects an `inFlightLock` + `idempotencyKey` + `AbortController` + safe `try/catch` storage fallback into the target app, and immediately re-runs the Poltergeist attack to show **`$750.00` exact balance** and **`0 Console Errors`**.

### 2.4 Backend HTTP & MCP API Specification
* `GET /api/health` — Returns server status, CDP availability, and Kiro `.kiro/` sync status.
* `POST /api/possess` — Body: `{ scenarioId, isPatched, targetUrl? }`. Runs `fast-check` chaos action generation (and optional real Playwright/CDP headless session) and returns `PossessionReport`.
* `POST /api/exorcise` — Body: `{ scenarioId }`. Applies the self-healing patch to `target-app/phantom-pay.js` on disk, records an incident resolution in `.kiro/specs/incidents/`, and re-runs the PBT verification suite.
* `GET /api/kiro-files` — Returns all 9 `.kiro/` files so judges can inspect them directly in the browser.
* `GET /mcp/tools` — JSON-RPC 2.0 `tools/list` exposing `possess_target_ui`, `inspect_cdp_forensics`, and `exorcise_and_patch`.
* `POST /mcp/call` — JSON-RPC 2.0 `tools/call` handler for Kiro IDE agent integration.

---

## PART 3: UI/UX DESIGN SYSTEM ("THE EXORCIST'S SEANCE CONSOLE")

### 3.1 Anti-Slop Visual Direction & Tokens
* **Aesthetic Persona:** Spectral Telemetry & Haunted Split-Screen Laboratory.
* **Color Palette (`public/styles.css`):**
  - `--bg-void: #07080B;` (Primary abyssal background)
  - `--bg-panel: #0F1219;` (Elevated console cards)
  - `--bg-surface: #161B26;` (Interactive controls)
  - `--ectoplasm: #00FF9D;` (Pure / Exorcised / Invariant Verified)
  - `--spectral-violet: #A855F7;` (Poltergeist Chaos Agent / MCP Telemetry)
  - `--blood-crimson: #FF2A54;` (Possessed Crash / Invariant Violated)
  - `--amber-ward: #F59E0B;` (Scope Guardrail & Latency Warning)
* **Signature Visual Mechanics:**
  1. **Animated Ghost Cursor (`#ghost-cursor`):** A glowing violet spectral pointer with a trailing aura that physically flies across the right-hand Target App panel during a Possession run, visibly clicking buttons, typing corrupted payloads, and triggering ripple shockwaves!
  2. **CRT Glitch Effect (`.possessed-glitch`):** When the Poltergeist triggers a crash, the Target App frame briefly shakes with a subtle crimson chromatic aberration border and displays a **"⚠️ UI POSSESSED — INVARIANT VIOLATED"** telemetry badge until exorcised.

### 3.2 Split-Screen Layout (`public/index.html`)
1. **Top Command Header:**
   - Brand: **POSSESSED UI // PARANORMAL CHAOS & SELF-HEALING AGENT**
   - Status Badges: `MCP BRIDGE: ACTIVE`, `CDP OBSERVER: ARMED`, `KIRO SPECS: SYNCED`, `SCOPE GUARD: LOCALHOST ONLY`.
2. **Left Pane (52% width) — The Exorcist's Command Console:**
   - **Step 1: Choose Possession Entity (1-Click Scenarios):**
     - `[👻 1. Chronos Race Poltergeist]` (Rapid triple-click checkout race condition)
     - `[🌫️ 2. Latency Wraith]` (Out-of-order async fetch & network drop chaos)
     - `[💀 3. Storage & XSS Banshee]` (Corrupted `localStorage` JSON + script injection)
   - **Step 2: Action Controls:**
     - Primary CTA: **`[🔮 UNLEASH POLTERGEIST (PBT CHAOS RUN)]`**
     - Healing CTA (appears when possessed): **`[✝️ PERFORM EXORCISM (SELF-HEAL & RE-VERIFY)]`**
     - Reset CTA: **`[↺ Reset Target App to Vulnerable State]`**
   - **Step 3: 3-Tab Telemetry Inspector:**
     - **Tab 1 (`Forensics & Diff`):** Shows the violated EARS requirement, exact stack trace (`phantom-pay.js:42`), minimal shrunk `fast-check` action sequence, and syntax-highlighted **Unified Code Diff** (`-` red lines removed, `+` green self-healing lines added).
     - **Tab 2 (`Live MCP Stream`):** Shows real-time JSON-RPC 2.0 `tools/call` logs between the Poltergeist Agent, CDP Observer, and Exorcist Patcher.
     - **Tab 3 (`.kiro/ Vault`):** Interactive file browser displaying all `.kiro/specs/`, `.kiro/steering/`, `.kiro/hooks/`, and `.kiro/settings/mcp.json` files.
3. **Right Pane (48% width) — Haunted Target Application Sandbox (`PhantomPay`):**
   - Contains the live interactive **PhantomPay Checkout App** (Wallet Balance, Item Card, Discount Input, Pay Now Button, Live Console Output Log, and State Integrity Meter) overlaid by the **Spectral Ghost Cursor** layer.

---

## PART 4: MANDATORY `.KIRO/` DIRECTORY BLUEPRINTS

Generate all 9 files below on disk AND embed them in the frontend `.kiro/ Vault` viewer:

### 4.1 `.kiro/specs/possessed-engine/requirements.md`
Contains the complete EARS requirements defined in **Part 1.3** (`WHEN`, `WHILE`, `WHERE`, `IF... THEN THE SYSTEM SHALL`) covering Chaos Fuzzing, CDP Forensics, Autonomous Self-Healing, and Localhost Scope Containment.

### 4.2 `.kiro/specs/possessed-engine/design.md`
Contains the full architecture diagram, TypeScript interfaces (`PossessionReport`, `ChaosActionStep`), `fast-check` action arbitrary specifications, and idempotency/debounce healing patterns defined in **Part 2**.

### 4.3 `.kiro/specs/possessed-engine/tasks.md`
```markdown
# Implementation & Verification Tasks — Possessed UI

- [x] **Task 1: Poltergeist Chaos & PBT Engine (`src/engine/poltergeist-pbt.ts`)**
  - [x] 1.1 Implement `fast-check` UI action sequence arbitraries (burst clicks, network delays, storage mutations).
  - [x] 1.2 Implement minimal counterexample action shrinking when an invariant fails.
- [x] **Task 2: CDP & DOM Forensics Medium (`src/engine/cdp-observer.ts`)**
  - [x] 2.1 Implement Playwright/CDP console exception, network timing, and DOM state capture.
  - [x] 2.2 Implement strict `localhost` / `127.0.0.1` URL scope guardrail.
- [x] **Task 3: Exorcist Self-Healing Patcher (`src/engine/exorcist-healer.ts`)**
  - [x] 3.1 Synthesize idempotency lock, `AbortController`, and safe JSON storage patches.
  - [x] 3.2 Apply unified diff to `target-app/phantom-pay.js` and auto-log incident resolution.
- [x] **Task 4: MCP JSON-RPC 2.0 Server (`src/engine/mcp-server.ts`)**
  - [x] 4.1 Expose `possess_target_ui`, `inspect_cdp_forensics`, and `exorcise_and_patch` via `tools/list` and `tools/call`.
- [x] **Task 5: Split-Screen Seance Console & Ghost Cursor UI (`public/`)**
  - [x] 5.1 Build Split-Screen dashboard with animated Ghost Cursor and CRT possession glitch effects.
  - [x] 5.2 Embed standalone client-side simulation fallback so GitHub Pages static deployments work identically to local server mode.
```

### 4.4 `.kiro/steering/frontend-resilience.md`
```markdown
# Kiro Steering Rules: Frontend Resilience & Self-Healing Patterns

1. **Mandatory Mutation Idempotency:**
   - Every financial or state-mutating UI action (e.g., checkout, transfer, submit) MUST implement an in-flight execution lock (`isSubmitting`) AND attach a unique `idempotencyKey` header so rapid multi-clicks cannot trigger duplicate charges.
2. **Stale Request Cancellation:**
   - All user-triggered search, filter, or pricing fetches MUST cancel superseded in-flight requests using `AbortController` to prevent out-of-order network race conditions.
3. **Defensive Storage Deserialization:**
   - Never call `JSON.parse()` on `localStorage` or `sessionStorage` outside a `try/catch` block; always fall back to a validated default state schema on corruption.
```

### 4.5 `.kiro/steering/chaos-guardrails.md`
```markdown
# Kiro Steering Rules: Paranormal Chaos Containment Guardrails

1. **Localhost-Only Target Enforcement:**
   - The CDP Poltergeist browser controller is strictly prohibited from navigating to or injecting chaos scripts into non-local domains. Only `http://localhost:*`, `http://127.0.0.1:*`, or the embedded sandbox frame are permitted.
2. **Deterministic Shrinking:**
   - Every chaos failure must be shrunk to the shortest reproducible sequence of user actions before invoking the Exorcist patch generator.
```

### 4.6 `.kiro/steering/seance-ui-standards.md`
```markdown
# Kiro Steering Rules: "The Exorcist's Seance Console" Visual Standards

1. **Intentional Dark Laboratory Palette:** Use `#07080B` void background, `#00FF9D` ectoplasm green for verified immunity, `#A855F7` spectral violet for Poltergeist actions, and `#FF2A54` crimson for invariant crashes.
2. **Visualized Agency:** Every automated chaos action must animate the spectral Ghost Cursor over the target element so judges visually witness the bug reproduction.
```

### 4.7 `.kiro/hooks/possession-auto-heal.json`
```json
{
  "name": "Possession Incident Auto-Exorcist",
  "description": "Triggers whenever a CDP possession crash report is written to .kiro/specs/incidents/, prompting Kiro to synthesize a resilience patch",
  "trigger": {
    "event": "onFileSave",
    "filePattern": ".kiro/specs/incidents/*.json"
  },
  "actions": [
    {
      "type": "agentPrompt",
      "prompt": "A new UI possession crash was captured via CDP. Inspect the stack trace, apply the resilience patterns from .kiro/steering/frontend-resilience.md, patch the target component, and run npm run test:pbt."
    }
  ],
  "enabled": true
}
```

### 4.8 `.kiro/hooks/pbt-immunity-check.json`
```json
{
  "name": "PBT Immunity Regression Gate",
  "description": "Runs fast-check property-based chaos suites automatically whenever target-app or engine files are patched",
  "trigger": {
    "event": "onFileSave",
    "filePattern": "target-app/**/*.js"
  },
  "actions": [
    {
      "type": "command",
      "command": "npm run test:pbt"
    }
  ],
  "enabled": true
}
```

### 4.9 `.kiro/settings/mcp.json`
```json
{
  "mcpServers": {
    "possessed-ui-exorcist": {
      "command": "npx",
      "args": ["tsx", "src/engine/mcp-stdio.ts"],
      "env": {
        "POSSESSED_SCOPE_ALLOWLIST": "localhost,127.0.0.1",
        "POSSESSED_PBT_RUNS": "100"
      },
      "disabled": false,
      "autoApprove": [
        "possess_target_ui",
        "inspect_cdp_forensics"
      ]
    }
  }
}
```

---

## PART 5: REPOSITORY STRUCTURE & EXECUTION SEQUENCE

```text
possessed-ui/
├── .kiro/
│   ├── specs/
│   │   ├── possessed-engine/
│   │   │   ├── requirements.md
│   │   │   ├── design.md
│   │   │   └── tasks.md
│   │   └── incidents/
│   │       └── .gitkeep
│   ├── steering/
│   │   ├── frontend-resilience.md
│   │   ├── chaos-guardrails.md
│   │   └── seance-ui-standards.md
│   ├── hooks/
│   │   ├── possession-auto-heal.json
│   │   └── pbt-immunity-check.json
│   └── settings/
│       └── mcp.json
├── target-app/
│   └── phantom-pay.js            # Real vulnerable target module patched live on disk
├── src/
│   ├── types/possessed.ts
│   ├── engine/
│   │   ├── poltergeist-pbt.ts    # fast-check chaos sequence generator & shrinker
│   │   ├── cdp-observer.ts       # CDP/DOM forensics & localhost guardrail
│   │   ├── exorcist-healer.ts    # Unified diff generator & live file patcher
│   │   ├── mcp-server.ts         # JSON-RPC 2.0 MCP Server
│   │   └── mcp-stdio.ts          # Stdio MCP transport for Kiro IDE
│   └── server.ts                 # Express API + static dashboard host
├── public/
│   ├── index.html                # Split-Screen Seance Console + Haunted Target App
│   ├── styles.css                # Spectral dark UI + Ghost Cursor + CRT Glitch animations
│   └── app.js                    # Interactive Ghost Cursor choreography + embedded fallback
├── tests/
│   └── possessed.pbt.test.ts     # Vitest + fast-check unit & property test suites
├── package.json
├── tsconfig.json
└── README.md
```

### Immediate Build & Verification Steps
1. Scaffold `package.json` (`express`, `cors`, `fast-check`, `vitest`, `tsx`, `typescript`, `@types/node`, `@types/express`) with scripts `"start"`, `"dev"`, `"test"`, and `"test:pbt"`.
2. Write all 9 `.kiro/` files and `target-app/phantom-pay.js`.
3. Implement all backend modules in `src/engine/` and `src/server.ts`.
4. Build the complete Split-Screen Seance Console in `public/index.html`, `public/styles.css`, and `public/app.js` with smooth animated Ghost Cursor choreography and client-side fallback execution.
5. Run `npm test` to verify 100% of unit and `fast-check` property-based tests pass.

---

## PART 6: 3-MINUTE WINNING DEMO VIDEO SCRIPT

* **0:00 – 0:25 | The Hook:**
  "Unit tests lie. Your app passes CI, yet crashes in production when users double-click on slow Wi-Fi or corrupt local storage. Meet **Possessed UI**—an autonomous paranormal chaos and self-healing agent built with Kiro IDE, MCP, and Chrome DevTools Protocol."
* **0:25 – 1:15 | Unleashing the Poltergeist:**
  Select **`1. Chronos Race Poltergeist`** and click **`[🔮 Unleash Poltergeist]`**. Watch the glowing violet **Ghost Cursor** fly across the right-hand **PhantomPay** checkout app, triple-clicking `Pay $250` in 40 milliseconds. The UI glitches crimson as the wallet balance drops from `$1,000` to **`$250`** instead of **`$750`**—a real `$500` double-charge race condition!
* **1:15 – 2:15 | Kiro Spec Forensics & Autonomous Exorcism:**
  Show the left console: `fast-check` shrunk the chaos sequence to 3 clicks, matched the violation against `.kiro/specs/possessed-engine/requirements.md`, and generated a unified code diff adding an idempotency lock. Click **`[✝️ Perform Exorcism]`**—the code patches live, and the Ghost Cursor attacks again, now blocked cleanly with **`$750.00` exact balance** and **`0 errors`**.
* **2:15 – 2:45 | Multi-Entity Chaos & `.kiro/` Vault:**
  Run **`Storage & XSS Banshee`** to show instant self-healing of corrupted `localStorage`, then open the **`.kiro/ Vault`** tab to highlight EARS specs, steering rules, agent hooks, and MCP integration.
* **2:45 – 3:00 | Closing:**
  "Possessed UI turns chaos engineering from manual bug hunting into autonomous self-healing software."