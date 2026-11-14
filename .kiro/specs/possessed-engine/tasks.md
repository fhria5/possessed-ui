# Implementation & Verification Tasks — Possessed UI

KOREKSI Phase 0: blueprint menandai semua tugas `[x]`. Belum ada yang dibangun
— semua tugas di bawah ini BELUM dicentang dan dicentang per phase saat selesai
+ terverifikasi.

- [ ] **Task 1: Poltergeist Chaos & PBT Engine (`src/engine/poltergeist-pbt.ts`)**
  - [ ] 1.1 Implement `fast-check` UI action sequence arbitraries (burst clicks, network delays, storage mutations).
  - [ ] 1.2 Implement minimal counterexample action shrinking when an invariant fails.
- [ ] **Task 2: CDP & DOM Forensics Medium (`src/engine/cdp-observer.ts`)**
  - [ ] 2.1 Implement Playwright/CDP console exception, network timing, and DOM state capture.
  - [ ] 2.2 Implement strict `localhost` / `127.0.0.1` URL scope guardrail.
- [ ] **Task 3: Exorcist Self-Healing Patcher (`src/engine/exorcist-healer.ts`)**
  - [ ] 3.1 Synthesize idempotency lock, `AbortController`, and safe JSON storage patches.
  - [ ] 3.2 Apply unified diff to `target-app/phantom-pay.js` and auto-log incident resolution.
- [ ] **Task 4: MCP JSON-RPC 2.0 Server (`src/engine/mcp-server.ts`)**
  - [ ] 4.1 Expose `possess_target_ui`, `inspect_cdp_forensics`, and `exorcise_and_patch` via `tools/list` and `tools/call`.
- [ ] **Task 5: Split-Screen Seance Console & Ghost Cursor UI (`public/`)**
  - [ ] 5.1 Build Split-Screen dashboard with animated Ghost Cursor and CRT possession glitch effects.
  - [ ] 5.2 Embed standalone client-side simulation fallback so GitHub Pages static deployments work identically to local server mode.
