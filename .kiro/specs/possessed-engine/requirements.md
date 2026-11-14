# Requirements — Possessed UI Engine (EARS format)

Sumber: Part 1.3 blueprint (`SPEK.md`).

## Requirement 1: Paranormal Chaos Injection & Property-Based UI Fuzzing

**User Story:** As a QA & reliability engineer, I want to unleash an autonomous
Poltergeist agent on my web application so that hidden race conditions and UI
crashes are discovered automatically.

- **1.1** **WHEN** the user triggers a Possession run via the UI or MCP
  `possess_target_ui` tool, **THE SYSTEM SHALL** execute a `fast-check`
  property-based sequence of chaotic browser actions (rapid button clicks
  <50ms apart, network latency injection, storage mutation, and boundary
  form payloads).
- **1.2** **WHILE** the Poltergeist is active, **THE SYSTEM SHALL** stream
  real-time cursor coordinates and console errors to the dashboard, and
  capture the DOM snapshot plus network timing in the forensics report
  (live DOM-mutation and network-request streams are not implemented —
  forensics carry the snapshot and the timing trace instead).
- **1.3** **IF** a state invariant is violated (e.g., account balance deducted
  twice for a single order, or an unhandled `TypeError` thrown), **THEN THE
  SYSTEM SHALL** halt the possession run, capture the minimal shrunk action
  sequence, and classify the entity (`Chronos Race Poltergeist`,
  `Latency Wraith`, or `Storage & XSS Banshee`).

## Requirement 2: CDP Forensics & Kiro Spec Invariant Diagnostics

**User Story:** As a developer, I want every UI crash captured with exact stack
traces and matched against my EARS requirements so that I know precisely why
the application broke.

- **2.1** **WHEN** a possession anomaly is detected, **THE SYSTEM SHALL**
  capture the failing DOM state, HTTP status/timing trace, and exact source
  file line number via Chrome DevTools Protocol (CDP).
- **2.2** **WHEN** diagnostics complete, **THE SYSTEM SHALL** generate a
  structured incident report in `.kiro/specs/incidents/` and link the failure
  to the violated EARS invariant in
  `.kiro/specs/possessed-engine/requirements.md`.

## Requirement 3: Autonomous Self-Healing Exorcism & Verification

**User Story:** As a software engineer, I want an Exorcist agent to
automatically generate and apply a resilient code patch so that the bug is
fixed and verified without manual debugging.

- **3.1** **WHEN** the user clicks **"PERFORM EXORCISM (SELF-HEAL &
  RE-VERIFY)"** or invokes MCP `exorcise_and_patch`, **THE SYSTEM SHALL**
  synthesize a targeted code patch (adding idempotency keys, submission locks,
  null-safe storage parsing, and AbortController guards) and write it to
  `target-app/phantom-pay.patched.js` (the vulnerable original is never
  overwritten).
- **3.2** **WHEN** a patch is applied, **THE SYSTEM SHALL** automatically
  re-run the possession verification against the patched target (one
  `possess()` run via `/api/exorcise`, plus a bounded 20-run immunity
  check when invoked through MCP `exorcise_and_patch`). The full 100
  `fast-check` runs per scenario are the Phase 3 exorcism runner
  (`tools/run_exorcism.cjs`, report in `public/exorcism-report.json`), not
  part of a single exorcise call.

## Requirement 4: Safety Guardrails & Scope Containment

**User Story:** As a security engineer, I want the Poltergeist chaos agent
strictly sandboxed to `localhost` or explicitly allowlisted staging URLs so
that it can never target external production websites.

- **4.1** **WHERE** a target URL is configured for CDP possession,
  **THE SYSTEM SHALL** enforce a strict allowlist permitting only `localhost`,
  `127.0.0.1`, or the built-in sandbox iframe, immediately blocking any
  external domain.
