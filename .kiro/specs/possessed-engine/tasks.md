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
  - [x] 5.2 Embed standalone client-side simulation fallback so GitHub Pages static deployments work as a Mode B simulation (not identical to local server mode — no real CDP session in the browser; the footer says so).

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

- [x] **Task 7: Gothic Polish + .kiro/ Audit (Phase 4, 14 Nov 2026)**
  - [x] 7.1 Polish: `.tabs` wrap (perbaiki overflow 9px di 390px —
    scrollWidth 399 vs innerWidth 390, terukur Playwright); tap target
    ≥44px terukur di 390/1280 (terkecil 44px); `:focus-visible`
    outline ectoplasm 2px terverifikasi via Tab; `prefers-reduced-motion`
    mematikan glitch + transisi Ghost Cursor (terukur 0s/none); favicon
    lokal `favicon.svg` tertaut.
  - [x] 7.2 Audit `.kiro/`: 8 klaim palsu/kadaluarsa diperbaiki —
    `exorcise_bug` → `exorcise_and_patch`, label tombol exorcise,
    100-run di 3.2, kode entitas 1.3, streaming DOM/network 1.2,
    "AST/Line Patcher", `isPatched` + target file `/api/exorcise`,
    "9 file .kiro" di design/vault/gen_assets; `mcp.json` menunjuk
    `src/engine/mcp-stdio.ts` yang tidak ada + env var tak terbaca;
    hook `npm run test:pbt` tidak ada di package.json.
  - [x] 7.3 Perbaikan audit: `src/engine/mcp-stdio.ts` dibuat (transport
    stdio JSON-RPC nyata, termasuk `initialize`); `mcp.json` memakai
    `node dist/engine/mcp-stdio.js` + env `POSSESSED_BASE_URL` (yang
    memang dibaca `resolveBaseUrl`); script `test:pbt` ditambahkan ke
    `package.json`; teks 5.2 diluruskan (Mode B = simulasi, bukan identik).
  - [x] 7.4 Tes polish baru `tests/polish-phase4.cjs` (Playwright):
    overflow 390/1280, tap target, focus-visible, reduced-motion,
    favicon 200, footer + marker Phase 4; regresi Vitest + E2E hijau.
