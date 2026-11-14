# Implementation & Verification Tasks — Possessed UI

KOREKSI Phase 0: blueprint menandai semua tugas `[x]`. Belum ada yang dibangun
— semua tugas di bawah ini BELUM dicentang dan dicentang per phase saat selesai
+ terverifikasi.

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

KOREKSI Phase 1 (14 Nov 2026): 2.1 BELUM dicentang — capture Playwright/CDP
sungguhan belum ada; forensik Phase 1 berasal dari run in-process terhadap
target-app nyata + simulasi Mode B. Sisanya tercapai + terverifikasi
(Vitest 48/48, E2E 24/24).

KOREKSI Phase 2 (14 Nov 2026): 2.1 TERCENTANG — capture Playwright/CDP
sungguhan terbukti (Chromium 156 nyata: DOM snapshot, pageerror stack
trace `phantom-pay.js:58:23`, throttling 3G; Vitest 69/69, E2E 55/55).

- [x] **Task 6: PBT Exorcism + Karantina + Deck (Phase 3, 14 Nov 2026)**
  - [x] 6.1 Implement `fast-check` 100-run verification per skenario
    (seed tetap 20261121/20261122/20261123) dengan arbitrary
    berbobot-batas; 2 Demon Bug nyata ditemukan + di-shrink
    (180ms Window 7/100 → 5 klik; Shape-Shifter 33/100 → 1 langkah);
    Network 3G jujur 0/100 tanpa demon.
  - [x] 6.2 Auto-Patch: jendela idempotency 1000ms + validasi bentuk cart
    di `exorcist-healer.ts`; re-verifikasi 100/100 IMMUNE ketiga skenario.
  - [x] 6.3 Karantina tool MCP: `exorcise_and_patch` yang gagal
    verifikasi ditolak `tools/call` (error -32099, status `quarantined`)
    + incident JSON; `GET /api/quarantine` + `GET /api/exorcism`.
  - [x] 6.4 Deck Exorcism di UI (tab baru): demon, input, shrink,
    patch, hasil re-verifikasi dari `exorcism-report.json` (angka nyata).
