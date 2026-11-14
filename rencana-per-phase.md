# Rencana Per Phase — Possessed UI (Kiroween 2026, Frankenstein)

App kedua Kiroween. App pertama: FreshTrack. Pengganti NecroMCP (DIBATALKAN user
14 Nov 2026 ~21:48 — jangan sentuh repo/folder NecroMCP).

Sumber spek: `SPEK.md` (salinan verbatim blueprint user,
`Possessed_UI_Master_Blueprint_and_One-Shot_Prompt_25_7319.md`).
Repo: https://github.com/fhria5/possessed-ui (publik, MIT, /.kiro di root).
Demo: belum live (Phase 1).
Deadline submit Kiroween: **5 Des 2026 06:00 WITA**.

## Batas jujur (mengikat)

- Klaim blueprint "selesai 100% dalam satu run tanpa jeda (YOLO)" **DITOLAK** —
  build bertahap per phase, tiap phase diverifikasi sebelum lanjut.
- Demo GitHub Pages = **Mode B (simulasi statis di browser)**, bukan CDP browser
  sungguhan. CDP/Playwright nyata hanya di Mode A (server lokal).
- Saldo PhantomPay ($1.000, item $250) adalah **simulasi, bukan uang nyata**.
- `tasks.md` di blueprint menandai semua tugas `[x]` — diperbaiki di Phase 0
  menjadi BELUM dicentang (belum ada yang dibangun).
- Write-up Devpost wajib jujur soal porsi yang dibangun Kiro vs dibangun
  langsung di Muse mengikuti spek `.kiro/`.

## Phase 0 — Spek + repo (SELESAI di sini)

Scope: `SPEK.md` verbatim, rencana ini, README, LICENSE MIT, `.gitignore`
(yang TIDAK mengabaikan `.kiro/`), 9 file `.kiro/` dari Part 4 blueprint
(dengan koreksi tasks.md), `target-app/phantom-pay.js` versi VULNERABLE saja,
`tools/create_repo.py`; repo GitHub `fhria5/possessed-ui` dibuat + semua file
ter-push; verifikasi via API tree.

Exit: repo publik ada, tree terverifikasi, `.kiro/` tidak terabaikan,
0 baris kode engine/UI.

## Phase 1 — MVP (SELESAI 14 Nov 2026 ~22:15 WITA)

Scope tercapai: engine inti (Poltergeist PBT + CDP observer + Exorcist healer),
MCP server (tools/list + tools/call), server Express Mode A, UI split-screen
Mode B, skenario 1 Chronos Race Poltergeist end-to-end (possess → crash $250 →
exorcise → $750 + 0 error), demo Pages live https://fhria5.github.io/possessed-ui/.

Angka: Vitest 48/48; E2E Playwright independen 24/24 (lokal, file = Pages);
seed kanonis 20261121 → burst 3 klik → $250,00 / 3 charge, shrink 3 klik;
patched re-run IMMUNE $750,00 / 1 charge; network sweep patched 12/12 tanpa
stale-response win. Repo 60+ blob, commit Phase 1 (lihat GitHub).

Catatan: Task 2.1 (.kiro) BELUM dicentang — capture Playwright/CDP sungguhan
belum ada; forensik Phase 1 berasal dari run in-process terhadap target-app
nyata + simulasi Mode B di browser. Jujur di footer demo + /api/health.

## Phase 2 — 3 skenario + MCP + guardrail (SELESAI 14 Nov 2026 ~22:40 WITA)

Scope tercapai: skenario 2 Latency Wraith + skenario 3 Storage & XSS Banshee
end-to-end di demo Mode B (stale $225.00 → exorcise → $230.00 EUR;
SyntaxError nyata + XSS 1x → exorcise → fallback, 0 eksekusi); CDP
SUNGGUHAN via Playwright (Task 2.1 — Chromium 156 nyata, DOM snapshot,
pageerror stack trace `phantom-pay.js:58:23`, throttling 3G tercatat);
forensik server dari CDP nyata (default `cdp: true`, fallback in-process
dilabeli jujur); MCP end-to-end via HTTP (ketiga tool); guardrail
localhost-only ditegakkan + diuji (example.com → 400); incident JSON untuk
ketiga skenario; patch Exorcist kini AbortController + escaping HTML.

Angka: Vitest 69/69 (48 regresi Phase 1 tetap hijau + 21 baru, termasuk
8 tes CDP browser nyata); E2E Playwright independen 55/55 (Mode B 3
skenario + MCP + CDP via HTTP + guardrail + incident). Repo 53 blob,
commit Phase 2 (lihat GitHub). Demo: https://fhria5.github.io/possessed-ui/

## Phase 3 — PBT Exorcism + self-heal + verifikasi 100 run (SELESAI 14 Nov 2026 ~23:01 WITA)

Scope tercapai: fast-check 100 run/scenario (seed tetap 20261121/20261122/
20261123) dengan arbitrary berbobot-batas menemukan 2 Demon Bug NYATA pada
patch Phase 1/2 — **The 180ms Window Demon** (burst 5 klik
[20,46,46,50,48]ms menembus jendela /api/pay 180ms → $500,00/2 charge;
7/100 run; shrink minimal tetap 5 klik, 5 langkah) dan **The Shape-Shifter
Demon** (cart JSON valid tapi bentuk salah — `null`, `{"items": "x"}` —
meracuni state.cart; 33/100 run; shrink ke 1 langkah `CORRUPT_STORAGE
"null"`, 3 langkah). Auto-Patch memperbaiki template healer (jendela
idempotency 1000ms + validasi bentuk cart `{ items: [...] }`), lalu
re-verifikasi **100/100 IMMUNE di ketiga skenario**. Network 3G jujur
0/100 tanpa demon bug — tidak ada yang dikarang. Karantina tool MCP:
`exorcise_and_patch` yang gagal verifikasi ditolak `tools/call` dengan
status `quarantined` + alasan (error -32099) dan tercatat di incident
JSON; verifikasi pasca-patch tidak dikarantina. Deck Exorcism di UI (tab
baru) menampilkan demon, input, shrink, patch, dan hasil re-verifikasi
dari `exorcism-report.json` (angka nyata, tanpa placeholder).

Angka: Vitest 93/93 (69 regresi Phase 1–2 tetap hijau + 24 baru,
termasuk 100-run ×3 skenario + hunter-vs-vulnerable + karantina);
E2E Playwright independen Phase 2 55/55 (regresi) + Phase 3 32/32
(deck + /api/exorcism + /api/quarantine + MCP + smoke race). Repo 60+ blob.
Demo: https://fhria5.github.io/possessed-ui/

## Phase 4 — Polish + uji HP

Scope: polish gothic final (favicon, `:focus-visible`, tap target ≥44px,
responsif 390/1280 tanpa overflow, `prefers-reduced-motion`); audit `.kiro/`
(klaim harus cocok dengan yang benar-benar ada); checklist uji HP 9 item.

Exit: user menyatakan sempurna sesudah uji HP dia sendiri.

## Phase 5 — Video + submit

Scope: video demo <3 menit, YouTube **Public** (bukan Unlisted); write-up
Devpost (jujur soal porsi Kiro + Mode B simulasi); submit kategori
**Frankenstein**; posting Social Blitz + blog (bonus prize).

Target: 30 Nov–2 Des 2026. Deadline: 5 Des 2026 06:00 WITA.
