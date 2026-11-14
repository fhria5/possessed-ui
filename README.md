# Possessed UI — Autonomous Paranormal Chaos-Testing & Self-Healing Agent

**Kiroween 2026 — kategori Frankenstein.** App kedua Kiroween (app pertama:
FreshTrack). Pengganti NecroMCP (dibatalkan user 14 Nov 2026).

Repo: https://github.com/fhria5/possessed-ui
Demo: https://fhria5.github.io/possessed-ui/ (live, Phase 1).

## Konsep

Aplikasi web lolos 100% unit test tapi tetap crash di produksi saat pengguna
berperilaku kacau: double-click saat jaringan lambat, input aneh, localStorage
rusak, respons API datang tak berurutan. Possessed UI adalah agen otonom yang:

1. **Poltergeist** — "merasuki" UI target lewat CDP/Playwright + fast-check PBT:
   klik beruntun, lonjakan latensi, mutasi storage, payload batas.
2. **Medium** — menangkap DOM snapshot, jejak jaringan, dan stack trace, lalu
   memetakan crash ke invariant EARS di `.kiro/specs/`.
3. **Exorcist** — mensintesis patch (idempotency, debounce, sanitasi input),
   menerapkannya ke file target, lalu menyerang ulang untuk membuktikan 0 crash.

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
- Phase 3 (berikutnya): PBT Exorcism 100 run + self-heal + incident lengkap.

## Struktur

```text
possessed-ui/
├── .kiro/                  # specs (EARS) + steering + hooks + settings/mcp.json
├── src/
│   ├── types/possessed.ts  # PossessionReport, ChaosActionStep, …
│   ├── engine/             # poltergeist-pbt, cdp-observer (Playwright nyata), exorcist-healer, mcp-server, possess-service
│   └── server.ts           # Express Mode A: /api/* + /mcp/* + /target-app/*
├── target-app/
│   ├── phantom-pay.js          # target rentan (3 bug)
│   └── phantom-pay.patched.js  # hasil Exorcist (dibuat ulang tiap exorcise)
├── public/                 # Mode B dashboard (index.html + styles.css + app.js)
├── docs/                   # salinan public/ untuk GitHub Pages (dibuat tiap deploy)
├── tests/                  # Vitest 69 + Playwright E2E Phase 2 (55 checks)
├── SPEK.md                 # blueprint verbatim
├── rencana-per-phase.md    # rencana Phase 0–5 + batas jujur
└── tools/
    ├── create_repo.py      # pembuatan repo + push via GitHub API
    ├── deploy_possessed.py # build + push + Pages
    └── gen_assets.cjs      # patch.diff + kiro-files.json untuk Mode B
```

## Batas jujur

- Klaim "selesai 100% satu run (YOLO)" di blueprint DITOLAK — build bertahap
  per phase, tiap phase diverifikasi.
- Demo Pages = simulasi Mode B, bukan CDP browser sungguhan.
- Write-up Devpost wajib jujur soal porsi yang dibangun Kiro vs Muse.
