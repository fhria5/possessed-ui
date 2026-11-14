# Possessed UI — Autonomous Paranormal Chaos-Testing & Self-Healing Agent

**Kiroween 2026 — kategori Frankenstein.** App kedua Kiroween (app pertama:
FreshTrack). Pengganti NecroMCP (dibatalkan user 14 Nov 2026).

Repo: https://github.com/fhria5/possessed-ui
Demo: https://fhria5.github.io/possessed-ui/ (live, Phase 3).

## Konsep

Aplikasi web lolos 100% unit test tapi tetap crash di produksi saat pengguna
berperilaku kacau: double-click saat jaringan lambat, input aneh, localStorage
rusak, respons API datang tak berurutan. Possessed UI adalah agen otonom yang:

1. **Poltergeist** — "merasuki" UI target lewat CDP/Playwright + fast-check PBT:
   klik beruntun, lonjakan latensi, mutasi storage, payload batas.
2. **Medium** — menangkap DOM snapshot, jejak jaringan, dan stack trace, lalu
   memetakan crash ke invariant EARS di `.kiro/specs/`.
3. **Exorcist** — mensintesis patch (idempotency lock, `AbortController`,
   safe storage parse, sanitasi HTML), menulisnya ke
   `target-app/phantom-pay.patched.js` (file vulnerable asli tidak pernah
   ditimpa), lalu menyerang ulang untuk membuktikan 0 crash.

## 3 skenario

| # | Entitas | Bug yang ditangkap |
|---|---------|-------------------|
| 1 | Chronos Race Poltergeist | Double-click checkout → tagihan ganda ($250, bukan $750) |
| 2 | Latency Wraith | Fetch tumpang tindih → respons basi menimpa yang baru |
| 3 | Storage & XSS Banshee | `localStorage` rusak + injeksi skrip → UI blank |

Target app bawaan: **PhantomPay Checkout** — saldo $1.000, beli Cursed Relic
$250. Semua saldo simulasi, bukan uang nyata.

## Dual-mode

- **Mode A** — server Express + CDP/Playwright nyata (lokal).
- **Mode B** — dashboard statis GitHub Pages dengan simulasi di browser
  (bukan CDP sungguhan — ditulis jujur di footer demo).

## Status

- **Phase 0 SELESAI** (14 Nov 2026): spek + repo + 9 file `.kiro/` +
  `target-app/phantom-pay.js` versi vulnerable. Belum ada engine/UI.
- **Phase 1 SELESAI + LIVE** (14 Nov 2026): engine inti (Poltergeist PBT +
  CDP observer + Exorcist healer + MCP server), server Express Mode A,
  UI split-screen Mode B, skenario 1 Chronos Race Poltergeist end-to-end
  (crash $250 → exorcise → $750 + 0 error). Vitest 48/48, E2E 24/24.
- **Phase 2 SELESAI + LIVE** (14 Nov 2026): ketiga skenario end-to-end di
  demo Mode B + CDP sungguhan (Playwright/Chromium nyata — DOM snapshot,
  stack trace asli, throttling 3G) + MCP penuh + guardrail localhost.
  Vitest 69/69, E2E 55/55. Demo: https://fhria5.github.io/possessed-ui/
- **Phase 3 SELESAI + LIVE** (14 Nov 2026): PBT Exorcism — 100 run/scenario
  (seed tetap 20261121/20261122/20261123) dengan arbitrary berbobot-batas
  menemukan 2 Demon Bug nyata pada patch Phase 1/2: **The 180ms Window
  Demon** (burst 5 klik [20,46,46,50,48]ms menembus jendela /api/pay →
  $500,00/2 charge; 7/100 run) dan **The Shape-Shifter Demon** (cart JSON
  valid tapi bentuk salah — `null`, `{"items": "x"}` — meracuni state.cart;
  33/100 run). Keduanya di-shrink (5 langkah / 1 langkah), di-Auto-Patch
  (jendela idempotency 1000ms + validasi bentuk cart), lalu re-verifikasi
  **100/100 IMMUNE di ketiga skenario**; Network 3G jujur 0/100 tanpa demon.
  Karantina tool MCP (`exorcise_and_patch` ditolak status `quarantined` bila
  verifikasi gagal) + Deck Exorcism di UI. Vitest 93/93, E2E 55/55 + 32/32.
- **Phase 4 SELESAI + LIVE** (14 Nov 2026): polish gothic final + audit
  `.kiro/` — `.tabs` wrap (perbaiki overflow 9px di 390px), tap target
  ≥44px terukur di 390/1280, `:focus-visible` terverifikasi,
  `prefers-reduced-motion` terukur, favicon lokal; 8 klaim palsu/kadaluarsa
  di `.kiro/` diperbaiki (nama tool MCP, label tombol, 100-run, "9 file
  .kiro", `mcp-stdio.ts` yang hilang, `npm run test:pbt` yang hilang);
  `src/engine/mcp-stdio.ts` dibuat (transport stdio JSON-RPC nyata).
  Checklist uji HP 9 item di `rencana-per-phase.md` — menunggu laporan uji
  HP user sebelum Phase 4 dinyatakan selesai penuh.
- Phase 5 (berikutnya): video + submit.

## Struktur

```text
possessed-ui/
├── .kiro/                  # specs (EARS) + steering + hooks + settings/mcp.json
├── src/
│   ├── types/possessed.ts  # PossessionReport, ChaosActionStep, …
│   ├── engine/             # poltergeist-pbt, cdp-observer (Playwright nyata), exorcist-healer, mcp-server, possess-service, exorcism-pbt (100-run PBT + karantina)
│   └── server.ts           # Express Mode A: /api/* + /mcp/* + /target-app/*
├── target-app/
│   ├── phantom-pay.js          # target rentan (3 bug)
│   └── phantom-pay.patched.js  # hasil Exorcist (dibuat ulang tiap exorcise)
├── public/                 # Mode B dashboard (index.html + styles.css + app.js)
├── docs/                   # salinan public/ untuk GitHub Pages (dibuat tiap deploy)
├── tests/                  # Vitest 93 + Playwright E2E Phase 2 (55 checks) + E2E Phase 3 (32 checks)
├── SPEK.md                 # blueprint verbatim
├── rencana-per-phase.md    # rencana Phase 0–5 + batas jujur
└── tools/
    ├── create_repo.py      # pembuatan repo + push via GitHub API
    ├── deploy_possessed.py # build + push + Pages
    ├── run_exorcism.cjs    # 100-run PBT Exorcism: before → Auto-Patch → after + exorcism-report.json
    └── gen_assets.cjs      # patch.diff + kiro-files.json untuk Mode B
```

## Batas jujur

- Klaim "selesai 100% satu run (YOLO)" di blueprint DITOLAK — build bertahap
  per phase, tiap phase diverifikasi.
- Demo Pages = simulasi Mode B, bukan CDP browser sungguhan.
- Write-up Devpost wajib jujur soal porsi yang dibangun Kiro vs Muse.
