/**
 * Possessed UI — Mode B dashboard engine (Phase 2: 3 scenarios live).
 *
 * This is a SELF-CONTAINED IN-BROWSER MIRROR of target-app/phantom-pay.js
 * (same constants: $1,000 start, $250 item, 180ms /api/pay latency, same
 * vulnerable + patched checkout/price/storage semantics). It is NOT a real
 * CDP browser session and NOT the Node engine — the footer says so. The
 * Node engine (src/engine/*) is the source of truth; this mirror exists so
 * the demo runs identically on static GitHub Pages.
 *
 * Flows:
 *   1. Chronos Race Poltergeist: triple-click Pay in 40ms → $250.00 /
 *      3 charges → exorcise → $750.00 / 1 charge, 0 errors.
 *   2. Latency Wraith: overlapping price fetches → stale GHOST10 price
 *      $225.00 wins over EUR → exorcise (AbortController) → $230.00 EUR.
 *   3. Storage & XSS Banshee: corrupt real localStorage → loadCart()
 *      throws a REAL pageerror + XSS payload executes in real DOM →
 *      exorcise (safe parse + escaping) → fallback, 0 executions.
 */
'use strict';

const ITEM_PRICE_CENTS = 25000;
const START_BALANCE_CENTS = 100000;
const PAY_LATENCY_MS = 180;
const CLICK_GAP_MS = 40;
const XSS_PAYLOAD = '<img src=x onerror="window.__xssFired=(window.__xssFired||0)+1">';

// Real in-browser evidence: uncaught exceptions in this page (e.g. the
// Banshee's loadCart throw) land here via the global error handler.
window.__xssFired = 0;
window.__pageErrors = [];
window.addEventListener('error', (e) => {
  window.__pageErrors.push(e.message);
});

function createPhantomPayMirror(patched) {
  const state = {
    balanceCents: START_BALANCE_CENTS,
    charges: [],
    consoleErrors: [],
    cart: { items: [] },
    currency: 'USD',
    discountCode: '',
    displayedPriceCents: ITEM_PRICE_CENTS,
  };
  let inFlightCheckout = null;
  let lastCharge = null;
  let lastCheckoutAt = 0;
  const IDEMPOTENCY_WINDOW_MS = 1000;
  let latestPriceRequest = 0;
  let priceAbort = null;

  // Real localStorage when available, memory fallback otherwise.
  const memory = {};
  function storage() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.getItem('__probe');
        return localStorage;
      }
    } catch (e) { /* fall through to memory */ }
    return {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null),
      setItem: (k, v) => { memory[k] = String(v); },
      removeItem: (k) => { delete memory[k]; },
    };
  }

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
  // Patched (mirrors exorcist-healer.ts): inFlightLock + idempotencyKey
  // + 1000ms grace window (Phase 3 Demon Bug fix: a 5-click burst
  // spanning the 180ms /api/pay window charged twice).
  async function handleCheckout() {
    if (patched) {
      if (inFlightCheckout) return inFlightCheckout;
      const now = Date.now();
      if (lastCharge && now - lastCheckoutAt < IDEMPOTENCY_WINDOW_MS) return lastCharge;
      const idempotencyKey = 'idem_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
      inFlightCheckout = payApi(ITEM_PRICE_CENTS).finally(() => { inFlightCheckout = null; });
      const charge = await inFlightCheckout;
      charge.idempotencyKey = idempotencyKey;
      lastCharge = charge;
      lastCheckoutAt = Date.now();
      return charge;
    }
    return payApi(ITEM_PRICE_CENTS);
  }

  function priceFor(currency, discountCode) {
    let price = ITEM_PRICE_CENTS;
    if (discountCode === 'GHOST10') price = Math.round(price * 0.9);
    if (currency === 'EUR') price = Math.round(price * 0.92);
    return price;
  }

  function fetchPriceImpl(currency, discountCode, delayMs) {
    // Patched (mirrors exorcist-healer.ts): AbortController + token guard.
    let controller = null;
    if (patched) {
      if (priceAbort) priceAbort.abort();
      controller = new AbortController();
      priceAbort = controller;
    }
    const requestId = ++latestPriceRequest;
    const delay = delayMs !== undefined ? delayMs : 60 + Math.floor(Math.random() * 240);
    return new Promise((resolve) => {
      setTimeout(() => {
        if (patched && (controller.signal.aborted || requestId !== latestPriceRequest)) {
          resolve({ priceCents: state.displayedPriceCents, currency: state.currency, discountCode: state.discountCode, stale: true });
          return;
        }
        state.currency = currency;
        state.discountCode = discountCode;
        state.displayedPriceCents = priceFor(currency, discountCode);
        resolve({ priceCents: state.displayedPriceCents, currency, discountCode });
      }, delay);
    });
  }

  function fetchPrice(currency, discountCode) {
    return fetchPriceImpl(currency, discountCode, undefined);
  }

  // Scripted reproduction (same role as the 3-click burst): the first fetch
  // is slow (300ms), the second fast (60ms) — a stale win on the vulnerable
  // mirror, a clean EUR win on the patched one.
  async function fetchPricePair() {
    const first = fetchPriceImpl('USD', 'GHOST10', 300);
    await sleep(10);
    const second = fetchPriceImpl('EUR', '', 60);
    await Promise.all([first, second]);
  }

  // Vulnerable: JSON.parse without try/catch — corrupted cart throws.
  // Patched (mirrors exorcist-healer.ts): safe fallback + recorded failure.
  function loadCart() {
    const raw = storage().getItem('phantom_cart');
    if (raw === null) {
      state.cart = { items: [] };
      return state.cart;
    }
    if (patched) {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
          throw new Error('cart shape invalid: expected { items: [...] }');
        }
        state.cart = parsed;
      } catch (err) {
        state.consoleErrors.push('Storage parse failed, fell back to empty cart: ' + err.message);
        state.cart = { items: [] };
      }
      return state.cart;
    }
    state.cart = JSON.parse(raw);
    return state.cart;
  }

  function saveCart(cart) {
    storage().setItem('phantom_cart', JSON.stringify(cart));
    state.cart = cart;
    return cart;
  }

  function corruptCart(raw) {
    storage().setItem('phantom_cart', raw);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Vulnerable: raw interpolation — an <img onerror> payload executes.
  // Patched: escaped — the payload renders as inert text.
  function cartItemHtml(item) {
    const name = patched ? escapeHtml(item.name) : item.name;
    return '<div class="cart-item">' + name + '</div>';
  }

  function formatCents(cents) {
    return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return {
    state,
    handleCheckout,
    fetchPrice,
    fetchPricePair,
    loadCart,
    saveCart,
    corruptCart,
    cartItemHtml,
    formatCents,
    snapshot() {
      return {
        balance: formatCents(state.balanceCents),
        balanceCents: state.balanceCents,
        charges: state.charges.length,
        displayedPrice: formatCents(state.displayedPriceCents),
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
let activeScenario = 'RACE_DOUBLE_CHARGE';
let possessedNow = false;

const SCENARIOS = {
  RACE_DOUBLE_CHARGE: {
    name: 'Chronos Race Poltergeist',
    invariant: 'REQ-1.1: a single checkout must charge exactly once (idempotency).',
    target: 'target-app/phantom-pay.js:handleCheckout',
    note: 'The Ghost Cursor is the Poltergeist: it flies to the Pay button and triple-clicks it in 40ms. The 180ms /api/pay latency is the race window — every click fires its own charge.',
    sequence: ['CLICK #pay-button, delay 0ms', 'CLICK #pay-button, delay 40ms', 'CLICK #pay-button, delay 40ms'],
  },
  NETWORK_3G_CHAOS: {
    name: 'Latency Wraith',
    invariant: 'REQ-2.2: the last requested price must win; a stale response overwrote it.',
    target: 'target-app/phantom-pay.js:fetchPrice',
    note: 'The Ghost Cursor types a discount code, then switches currency — two overlapping fetches under 3G. The slow stale response arrives last and overwrites the fresh price.',
    sequence: ['TYPE #discount-input "GHOST10", delay 0ms', 'TYPE #currency-select "EUR", delay 10ms'],
  },
  STORAGE_XSS_SPECTER: {
    name: 'Storage & XSS Banshee',
    invariant: 'REQ-3.1: loading a corrupted cart must fall back, never throw; rendered cart data must not execute scripts.',
    target: 'target-app/phantom-pay.js:loadCart',
    note: 'The Banshee corrupts real localStorage, then reloads the cart — JSON.parse throws a real pageerror — and renders a script payload into the cart view.',
    sequence: ['CORRUPT_STORAGE phantom_cart "{bad json"', 'CLICK #reload-cart, delay 0ms', 'TYPE #cart-view <img onerror=…>, delay 0ms'],
  },
};

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
  $('displayed-price').textContent = snap.displayedPrice;
  $('price-meta').textContent = mirror.state.currency + (mirror.state.discountCode ? ' · ' + mirror.state.discountCode : ' · no discount');
  const integrity = possessedNow ? 0 : 100;
  $('integrity-fill').style.width = integrity + '%';
  $('integrity-fill').style.background = integrity >= 100 ? 'var(--ectoplasm)' : 'var(--blood-crimson)';
  $('integrity-text').textContent = integrity + '% — ' + (integrity >= 100 ? 'intact' : 'corrupted');
}

function renderCart() {
  const items = mirror.state.cart && Array.isArray(mirror.state.cart.items) ? mirror.state.cart.items : [];
  $('cart-view').innerHTML = items.length
    ? items.map((it) => mirror.cartItemHtml(it)).join('')
    : '<span class="muted">empty</span>';
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

function selectScenario(id) {
  activeScenario = id;
  document.querySelectorAll('.scenario').forEach((b) => {
    const active = b.dataset.scenario === id;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  $('arena-note').textContent = SCENARIOS[id].note;
  resetTarget();
}

document.querySelectorAll('.scenario').forEach((b) => {
  b.addEventListener('click', () => selectScenario(b.dataset.scenario));
});

async function flyGhostTo(el) {
  const ghost = $('ghost-cursor');
  const target = $('target-app');
  const tRect = target.getBoundingClientRect();
  const bRect = el.getBoundingClientRect();
  const x = bRect.left - tRect.left + bRect.width / 2 - 16;
  const y = bRect.top - tRect.top + bRect.height / 2 - 16;
  ghost.classList.add('flying');
  ghost.style.left = x + 'px';
  ghost.style.top = y + 'px';
  await sleep(380);
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

function fillForensics(corruption) {
  const meta = SCENARIOS[activeScenario];
  $('forensics-empty').hidden = true;
  $('forensics-body').hidden = false;
  $('f-invariant').textContent = meta.invariant;
  $('f-entity').textContent = meta.name;
  $('f-target').textContent = meta.target;
  $('f-corruption').textContent = corruption;
  const ol = $('f-sequence');
  ol.innerHTML = '';
  meta.sequence.forEach((text) => {
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
      'The Exorcist patch adds inFlightLock + idempotencyKey, AbortController, and safe storage parsing.';
  }
}

function markPossessed(corruption) {
  possessedNow = true;
  $('target-app').classList.add('possessed');
  $('possessed-badge').hidden = false;
  $('btn-exorcise').hidden = false;
  render();
  fillForensics(corruption);
  showTab('forensics');
}

function markImmune(statusText) {
  possessedNow = false;
  $('target-app').classList.remove('possessed');
  $('possessed-badge').hidden = true;
  $('immune-badge').hidden = false;
  setStatus(statusText);
  render();
}

async function unleashRace() {
  await flyGhostTo($('pay-button'));
  await ghostTripleClick();
  render();
  const snap = mirror.snapshot();
  if (snap.balanceCents === 25000 && snap.charges === 3) {
    setStatus('POSSESSED — balance $250.00, 3 charges. The invariant is violated.');
    logTarget('INVARIANT VIOLATED — expected $750.00, actual $250.00 (double charge!)');
    logMcp({ jsonrpc: '2.0', id: 1, result: { status: 'POSSESSED_CRASH', shrunkActionSequence: ['CLICK', 'CLICK', 'CLICK'], balance: '$250.00' } });
    markPossessed('Expected Balance: $750.00 | Actual: ' + snap.balance + ' (' + snap.charges + ' charge(s), double charge!)');
  } else {
    setStatus('No violation observed — balance ' + snap.balance + '.');
  }
}

async function unleashNetwork() {
  await flyGhostTo($('discount-input'));
  $('discount-input').value = 'GHOST10';
  logTarget('ghost typed GHOST10 → fetchPrice(USD, GHOST10) fired');
  await flyGhostTo($('currency-select'));
  $('currency-select').value = 'EUR';
  logTarget('ghost switched currency to EUR → fetchPrice(EUR, "") fired');
  // Scripted pair decides the verdict (same role as the 3-click burst).
  await mirror.fetchPricePair();
  render();
  const snap = mirror.snapshot();
  if (snap.displayedPrice === '$225.00' && mirror.state.currency === 'USD') {
    setStatus('POSSESSED — stale GHOST10 price $225.00 overwrote the EUR price. The invariant is violated.');
    logTarget('INVARIANT VIOLATED — stale response won: displayed $225.00 (USD/GHOST10) after EUR was requested last.');
    logMcp({ jsonrpc: '2.0', id: 1, result: { status: 'POSSESSED_CRASH', displayedPrice: '$225.00', currency: 'USD' } });
    markPossessed('Stale response won: displayed $225.00 with currency USD after EUR was requested last.');
  } else {
    setStatus('No violation observed — displayed ' + snap.displayedPrice + ' (' + mirror.state.currency + ').');
  }
}

async function unleashStorage() {
  await flyGhostTo($('cart-view'));
  mirror.corruptCart('{bad json');
  logTarget('banshee wrote "{bad json" to localStorage phantom_cart');
  const errorsBefore = window.__pageErrors.length;
  const xssBefore = window.__xssFired;
  // Uncaught on purpose: the SyntaxError surfaces as a REAL pageerror in
  // this browser (same as the CDP capture). The flow continues because the
  // throw happens in a separate task.
  setTimeout(() => { mirror.loadCart(); }, 0);
  await sleep(300);
  mirror.state.cart = { items: [{ name: XSS_PAYLOAD }] };
  renderCart();
  await sleep(300);
  const threw = window.__pageErrors.length > errorsBefore;
  const xssFired = window.__xssFired - xssBefore;
  const errMsg = threw ? window.__pageErrors[window.__pageErrors.length - 1] : 'none';
  if (threw || xssFired > 0) {
    setStatus('POSSESSED — corrupted cart threw + XSS payload executed. The invariant is violated.');
    logTarget('INVARIANT VIOLATED — loadCart() threw: ' + errMsg + '; XSS payload executed: ' + (xssFired > 0 ? 'yes (' + xssFired + 'x)' : 'no'));
    logMcp({ jsonrpc: '2.0', id: 1, result: { status: 'POSSESSED_CRASH', pageError: errMsg, xssFired } });
    markPossessed('loadCart() threw: ' + errMsg + '; XSS payload executed: ' + (xssFired > 0 ? 'yes (' + xssFired + 'x)' : 'no'));
  } else {
    setStatus('No violation observed — cart loaded cleanly.');
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
  possessedNow = false;
  render();
  setStatus('Poltergeist unleashed — Ghost Cursor attacking…');
  logMcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'possess_target_ui', arguments: { scenarioId: activeScenario } } });
  logTarget('possession started — scenario ' + activeScenario + ', seed 20261121');
  if (activeScenario === 'RACE_DOUBLE_CHARGE') await unleashRace();
  else if (activeScenario === 'NETWORK_3G_CHAOS') await unleashNetwork();
  else await unleashStorage();
  $('btn-unleash').disabled = false;
  running = false;
}

async function exorciseRace() {
  await flyGhostTo($('pay-button'));
  await ghostTripleClick();
  render();
  const snap = mirror.snapshot();
  if (snap.balanceCents === 75000 && snap.charges === 1 && snap.consoleErrors === 0) {
    markImmune('EXORCISED — balance $750.00 exactly, 1 charge, 0 console errors. Immune.');
    logTarget('VERIFIED — re-run clean: $750.00, 1 charge, 0 errors.');
    logMcp({ jsonrpc: '2.0', id: 2, result: { status: 'EXORCISED_IMMUNE', verification: '100% invariant compliance' } });
  } else {
    setStatus('Re-run still shows ' + snap.balance + ' — patch did not hold.');
    logTarget('WARNING — re-run failed: ' + snap.balance + ', ' + snap.charges + ' charges.');
  }
}

async function exorciseNetwork() {
  await mirror.fetchPricePair();
  render();
  const snap = mirror.snapshot();
  if (snap.displayedPrice === '$230.00' && mirror.state.currency === 'EUR') {
    markImmune('EXORCISED — displayed $230.00 EUR, stale response aborted. Immune.');
    logTarget('VERIFIED — re-run clean: $230.00 EUR, stale response aborted.');
    logMcp({ jsonrpc: '2.0', id: 2, result: { status: 'EXORCISED_IMMUNE', verification: '100% invariant compliance' } });
  } else {
    setStatus('Re-run still shows ' + snap.displayedPrice + ' (' + mirror.state.currency + ') — patch did not hold.');
    logTarget('WARNING — re-run failed: ' + snap.displayedPrice + '.');
  }
}

async function exorciseStorage() {
  const errorsBefore = window.__pageErrors.length;
  const xssBefore = window.__xssFired;
  setTimeout(() => { mirror.loadCart(); }, 0);
  await sleep(300);
  mirror.state.cart = { items: [{ name: XSS_PAYLOAD }] };
  renderCart();
  await sleep(300);
  const threw = window.__pageErrors.length > errorsBefore;
  const xssFired = window.__xssFired - xssBefore;
  render();
  if (!threw && xssFired === 0) {
    markImmune('EXORCISED — corrupted cart fell back, XSS payload rendered as inert text. Immune.');
    logTarget('VERIFIED — re-run clean: fallback cart, 0 executions.');
    logMcp({ jsonrpc: '2.0', id: 2, result: { status: 'EXORCISED_IMMUNE', verification: '100% invariant compliance' } });
  } else {
    setStatus('Re-run still throws or executes — patch did not hold.');
    logTarget('WARNING — re-run failed: threw=' + threw + ', xssFired=' + xssFired + '.');
  }
}

async function exorcise() {
  if (running) return;
  running = true;
  $('btn-exorcise').disabled = true;
  setStatus('Exorcist working — applying self-healing patch…');
  logMcp({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'exorcise_and_patch', arguments: { scenarioId: activeScenario } } });
  await loadPatchDiff();
  showTab('forensics');
  await sleep(400);
  // Heal: swap in the patched mirror, then re-run the exact attack.
  patchedMode = true;
  mirror = createPhantomPayMirror(true);
  render();
  renderCart();
  logTarget('patch applied — re-running the attack…');
  if (activeScenario === 'RACE_DOUBLE_CHARGE') await exorciseRace();
  else if (activeScenario === 'NETWORK_3G_CHAOS') await exorciseNetwork();
  else await exorciseStorage();
  $('btn-exorcise').disabled = false;
  running = false;
}

function resetTarget() {
  patchedMode = false;
  mirror = createPhantomPayMirror(false);
  possessedNow = false;
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('phantom_cart');
  } catch (e) { /* storage unavailable — memory fallback is already fresh */ }
  window.__xssFired = 0;
  window.__pageErrors = [];
  $('discount-input').value = '';
  $('currency-select').value = 'USD';
  $('target-app').classList.remove('possessed');
  $('possessed-badge').hidden = true;
  $('immune-badge').hidden = true;
  $('btn-exorcise').hidden = true;
  $('forensics-empty').hidden = false;
  $('forensics-body').hidden = true;
  $('target-log').textContent = 'ready — wallet $1,000.00, cart empty.';
  render();
  renderCart();
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
$('discount-input').addEventListener('change', async () => {
  if (running) return;
  await mirror.fetchPrice(mirror.state.currency, $('discount-input').value);
  render();
  logTarget('price fetch settled — displayed ' + mirror.snapshot().displayedPrice + ' (' + mirror.state.currency + ').');
});
$('currency-select').addEventListener('change', async () => {
  if (running) return;
  await mirror.fetchPrice($('currency-select').value, mirror.state.discountCode);
  render();
  logTarget('price fetch settled — displayed ' + mirror.snapshot().displayedPrice + ' (' + mirror.state.currency + ').');
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
renderCart();
loadVault();
loadExorcismDeck();

// Phase 3 Exorcism Deck: real 100-run PBT verification numbers from
// exorcism-report.json (generated at build time). All text is injected
// via textContent — the report contains raw XSS payload strings, which
// must never reach innerHTML.
async function loadExorcismDeck() {
  const deck = $('exorcism-deck');
  const NAMES = {
    RACE_DOUBLE_CHARGE: 'Chronos Race Poltergeist',
    NETWORK_3G_CHAOS: 'Latency Wraith',
    STORAGE_XSS_SPECTER: 'Storage & XSS Banshee',
  };
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function stepSummary(steps) {
    return steps.map((s) => {
      const base = s.actionType + (s.selector ? ' ' + s.selector : '') + (s.payload !== undefined ? ' ' + JSON.stringify(s.payload) : '');
      return base + ', delay ' + s.delayMs + 'ms';
    });
  }
  try {
    const res = await fetch('exorcism-report.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const report = await res.json();
    deck.textContent = '';
    const meta = el('p', 'muted',
      'Generated ' + report.generatedAt + ' · ' + report.runsPerScenario +
      ' runs/scenario · seed base ' + report.seedBase + ' (per-scenario seeds in the report).');
    deck.appendChild(meta);
    if (report.quarantine && report.quarantine.quarantined) {
      deck.appendChild(el('p', 'demon', '⚠️ QUARANTINED: ' + report.quarantine.tool + ' — ' + report.quarantine.reason));
    }
    for (const scenarioId of Object.keys(report.scenarios)) {
      const s = report.scenarios[scenarioId];
      const card = el('article', 'deck-card');
      card.appendChild(el('h3', null, NAMES[scenarioId] || scenarioId));
      card.appendChild(el('p', 'muted', 'seed ' + s.seed + ' · ' + s.before.runs + ' runs'));
      const before = el('p', null,
        'Before patch: ' + s.before.violations + '/' + s.before.runs +
        ' runs violated the invariant (' + s.before.status + ').');
      before.classList.add(s.before.violations > 0 ? 'demon' : 'immune');
      card.appendChild(before);
      if (s.demonBug) {
        const d = s.demonBug;
        card.appendChild(el('p', 'demon', '👹 Demon Bug: ' + d.name));
        card.appendChild(el('p', null, 'Observed: ' + d.observed.detail));
        if (d.observed.cartJson !== undefined) {
          card.appendChild(el('p', null, 'Poisoned cart: ' + d.observed.cartJson));
        }
        const inputTitle = el('p', null, 'Demon input (' + d.input.length + ' steps):');
        card.appendChild(inputTitle);
        const inputList = el('ol', null);
        stepSummary(d.input).forEach((line) => inputList.appendChild(el('li', null, line)));
        card.appendChild(inputList);
        card.appendChild(el('p', null,
          'Shrunk to ' + d.shrunkSequence.length + ' steps in ' + d.shrinkSteps + ' shrink steps:'));
        const shrunkList = el('ol', null);
        stepSummary(d.shrunkSequence).forEach((line) => shrunkList.appendChild(el('li', null, line)));
        card.appendChild(shrunkList);
        card.appendChild(el('p', null, 'Auto-Patch: ' + d.patch));
      } else {
        card.appendChild(el('p', 'immune', 'No demon bug found in ' + s.before.runs + ' boundary-weighted runs.'));
      }
      const after = el('p', null,
        'After Auto-Patch: ' + (s.after.runs - s.after.violations) + '/' + s.after.runs +
        ' clean runs (' + s.after.status + ').');
      after.classList.add(s.after.violations === 0 ? 'immune' : 'demon');
      card.appendChild(after);
      deck.appendChild(card);
    }
  } catch (e) {
    deck.textContent = 'Exorcism report unavailable in this copy (' + e.message + '). Run tools/run_exorcism.cjs to generate it.';
    deck.className = 'muted';
  }
}
