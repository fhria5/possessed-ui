/**
 * Possessed UI — Mode B dashboard engine.
 *
 * This is a SELF-CONTAINED IN-BROWSER MIRROR of target-app/phantom-pay.js
 * (same constants: $1,000 start, $250 item, 180ms /api/pay latency, same
 * vulnerable + patched checkout semantics). It is NOT a real CDP browser
 * session and NOT the Node engine — the footer says so. The Node engine
 * (src/engine/*) is the source of truth; this mirror exists so the demo
 * runs identically on static GitHub Pages.
 *
 * Flow (scenario 1, Chronos Race Poltergeist):
 *   Unleash → Ghost Cursor triple-clicks Pay in 40ms → $250.00 / 3 charges
 *   → badge "UI POSSESSED" + forensics → Perform Exorcism → patch applied
 *   → auto re-run → $750.00 / 1 charge, 0 console errors → IMMUNE.
 */
'use strict';

const ITEM_PRICE_CENTS = 25000;
const START_BALANCE_CENTS = 100000;
const PAY_LATENCY_MS = 180;
const CLICK_GAP_MS = 40;

function createPhantomPayMirror(patched) {
  const state = {
    balanceCents: START_BALANCE_CENTS,
    charges: [],
    consoleErrors: [],
    cart: { items: [] },
  };
  let inFlightCheckout = null;

  function payApi(amountCents) {
    return new Promise((resolve) => {
      setTimeout(() => {
        state.balanceCents -= amountCents;
        const charge = { id: 'ch_' + Date.now() + '_' + Math.floor(Math.random() * 1e6), amountCents, item: 'Cursed Relic' };
        state.charges.push(charge);
        resolve(charge);
      }, PAY_LATENCY_MS);
    });
  }

  // Vulnerable: no lock — every click fires its own payApi call.
  // Patched (mirrors exorcist-healer.ts): inFlightLock + idempotencyKey.
  async function handleCheckout() {
    if (patched) {
      if (inFlightCheckout) return inFlightCheckout;
      const idempotencyKey = 'idem_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
      inFlightCheckout = payApi(ITEM_PRICE_CENTS).finally(() => { inFlightCheckout = null; });
      const charge = await inFlightCheckout;
      charge.idempotencyKey = idempotencyKey;
      return charge;
    }
    return payApi(ITEM_PRICE_CENTS);
  }

  function formatCents(cents) {
    return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return {
    state,
    handleCheckout,
    formatCents,
    snapshot() {
      return {
        balance: formatCents(state.balanceCents),
        balanceCents: state.balanceCents,
        charges: state.charges.length,
        consoleErrors: state.consoleErrors.length,
      };
    },
  };
}

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let mirror = createPhantomPayMirror(false);
let patchedMode = false;
let running = false;

function logTarget(line) {
  const el = $('target-log');
  el.textContent += '\n' + line;
  el.scrollTop = el.scrollHeight;
}

function logMcp(obj) {
  const el = $('mcp-log');
  const text = JSON.stringify(obj, null, 2);
  el.textContent = el.textContent.startsWith('— no calls') ? text : el.textContent + '\n' + text;
  el.scrollTop = el.scrollHeight;
}

function render() {
  const snap = mirror.snapshot();
  $('wallet-balance').textContent = snap.balance;
  $('wallet-meta').textContent = snap.charges + (snap.charges === 1 ? ' charge' : ' charges') + ' · ' + snap.consoleErrors + ' console errors';
  const integrity = Math.max(0, Math.min(100, Math.round((snap.balanceCents / 75000) * 100)));
  $('integrity-fill').style.width = integrity + '%';
  $('integrity-fill').style.background = integrity >= 100 ? 'var(--ectoplasm)' : 'var(--blood-crimson)';
  $('integrity-text').textContent = integrity + '% — ' + (integrity >= 100 ? 'intact' : 'corrupted');
}

function setStatus(text) {
  $('run-status').textContent = text;
}

function showTab(name) {
  document.querySelectorAll('.tab').forEach((t) => {
    const active = t.dataset.tab === name;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.tab-panel').forEach((p) => {
    p.classList.toggle('active', p.id === 'panel-' + name);
  });
}

document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => showTab(t.dataset.tab));
});

async function flyGhostToPayButton() {
  const ghost = $('ghost-cursor');
  const target = $('target-app');
  const btn = $('pay-button');
  const tRect = target.getBoundingClientRect();
  const bRect = btn.getBoundingClientRect();
  const x = bRect.left - tRect.left + bRect.width / 2 - 16;
  const y = bRect.top - tRect.top + bRect.height / 2 - 16;
  ghost.classList.add('flying');
  ghost.style.left = x + 'px';
  ghost.style.top = y + 'px';
  await sleep(380);
  return { x, y };
}

async function ghostTripleClick() {
  const ghost = $('ghost-cursor');
  const pending = [];
  for (let i = 0; i < 3; i++) {
    if (i > 0) await sleep(CLICK_GAP_MS);
    ghost.classList.add('clicking');
    pending.push(mirror.handleCheckout());
    logTarget('ghost click #' + (i + 1) + ' → handleCheckout() fired');
    setTimeout(() => ghost.classList.remove('clicking'), 120);
  }
  await Promise.all(pending);
  await sleep(60);
}

function fillForensics(snap) {
  $('forensics-empty').hidden = true;
  $('forensics-body').hidden = false;
  $('f-invariant').textContent = 'REQ-1.1: a single checkout must charge exactly once (idempotency).';
  $('f-entity').textContent = 'Chronos Race Poltergeist';
  $('f-target').textContent = 'target-app/phantom-pay.js:handleCheckout';
  $('f-corruption').textContent = 'Expected Balance: $750.00 | Actual: ' + snap.balance + ' (' + snap.charges + ' charge(s), double charge!)';
  const ol = $('f-sequence');
  ol.innerHTML = '';
  [
    'CLICK #pay-button, delay 0ms',
    'CLICK #pay-button, delay 40ms',
    'CLICK #pay-button, delay 40ms',
  ].forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    ol.appendChild(li);
  });
}

async function loadPatchDiff() {
  try {
    const res = await fetch('patch.diff');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    $('f-diff').textContent = await res.text();
  } catch (e) {
    $('f-diff').textContent = 'Patch diff unavailable in this copy (' + e.message + '). ' +
      'The Exorcist patch adds inFlightLock + idempotencyKey to handleCheckout().';
  }
}

async function unleash() {
  if (running) return;
  running = true;
  $('btn-unleash').disabled = true;
  $('btn-exorcise').hidden = true;
  $('immune-badge').hidden = true;
  $('possessed-badge').hidden = true;
  $('target-app').classList.remove('possessed');
  setStatus('Poltergeist unleashed — Ghost Cursor attacking Pay…');
  logMcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'possess_target_ui', arguments: { scenarioId: 'RACE_DOUBLE_CHARGE' } } });
  logTarget('possession started — scenario RACE_DOUBLE_CHARGE, seed 20261121');
  await flyGhostToPayButton();
  await ghostTripleClick();
  render();
  const snap = mirror.snapshot();
  if (snap.balanceCents === 25000 && snap.charges === 3) {
    $('target-app').classList.add('possessed');
    $('possessed-badge').hidden = false;
    $('btn-exorcise').hidden = false;
    setStatus('POSSESSED — balance $250.00, 3 charges. The invariant is violated.');
    logTarget('INVARIANT VIOLATED — expected $750.00, actual $250.00 (double charge!)');
    logMcp({ jsonrpc: '2.0', id: 1, result: { status: 'POSSESSED_CRASH', shrunkActionSequence: ['CLICK', 'CLICK', 'CLICK'], balance: '$250.00' } });
    fillForensics(snap);
    showTab('forensics');
  } else {
    setStatus('No violation observed — balance ' + snap.balance + '.');
  }
  $('btn-unleash').disabled = false;
  running = false;
}

async function exorcise() {
  if (running) return;
  running = true;
  $('btn-exorcise').disabled = true;
  setStatus('Exorcist working — applying idempotency patch…');
  logMcp({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'exorcise_and_patch', arguments: { scenarioId: 'RACE_DOUBLE_CHARGE' } } });
  await loadPatchDiff();
  showTab('forensics');
  await sleep(400);
  // Heal: swap in the patched mirror, then re-run the exact attack.
  patchedMode = true;
  mirror = createPhantomPayMirror(true);
  render();
  logTarget('patch applied — inFlightLock + idempotencyKey active. Re-running the attack…');
  await flyGhostToPayButton();
  await ghostTripleClick();
  render();
  const snap = mirror.snapshot();
  if (snap.balanceCents === 75000 && snap.charges === 1 && snap.consoleErrors === 0) {
    $('target-app').classList.remove('possessed');
    $('possessed-badge').hidden = true;
    $('immune-badge').hidden = false;
    setStatus('EXORCISED — balance $750.00 exactly, 1 charge, 0 console errors. Immune.');
    logTarget('VERIFIED — re-run clean: $750.00, 1 charge, 0 errors.');
    logMcp({ jsonrpc: '2.0', id: 2, result: { status: 'EXORCISED_IMMUNE', verification: '100% invariant compliance' } });
  } else {
    setStatus('Re-run still shows ' + snap.balance + ' — patch did not hold.');
    logTarget('WARNING — re-run failed: ' + snap.balance + ', ' + snap.charges + ' charges.');
  }
  $('btn-exorcise').disabled = false;
  running = false;
}

function resetTarget() {
  patchedMode = false;
  mirror = createPhantomPayMirror(false);
  $('target-app').classList.remove('possessed');
  $('possessed-badge').hidden = true;
  $('immune-badge').hidden = true;
  $('btn-exorcise').hidden = true;
  $('forensics-empty').hidden = false;
  $('forensics-body').hidden = true;
  $('target-log').textContent = 'ready — wallet $1,000.00, cart empty.';
  render();
  setStatus('Idle. PhantomPay is vulnerable — balance $1,000.00.');
}

$('btn-unleash').addEventListener('click', unleash);
$('btn-exorcise').addEventListener('click', exorcise);
$('btn-reset').addEventListener('click', resetTarget);
$('pay-button').addEventListener('click', async () => {
  if (running) return;
  logTarget('manual click → handleCheckout() fired');
  await mirror.handleCheckout();
  render();
  const snap = mirror.snapshot();
  logTarget('settled — balance ' + snap.balance + ', ' + snap.charges + ' charge(s).');
});

// .kiro/ Vault: file list from kiro-files.json (generated at deploy time).
async function loadVault() {
  const list = $('vault-list');
  try {
    const res = await fetch('kiro-files.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    data.files.forEach((f) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '.kiro/' + f.path;
      btn.addEventListener('click', () => {
        const pre = $('vault-content');
        pre.hidden = false;
        pre.textContent = f.content;
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  } catch (e) {
    const li = document.createElement('li');
    li.textContent = 'Vault unavailable in this copy (' + e.message + '). Files are in the repo under .kiro/.';
    li.className = 'muted';
    list.appendChild(li);
  }
}

render();
loadVault();
