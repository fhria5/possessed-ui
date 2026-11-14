// EXORCISED — patched by Possessed UI Exorcist (inFlightLock + idempotencyKey
// + stale-response guard + safe storage fallback). Generated from target-app/phantom-pay.js — the vulnerable original is never overwritten.
/**
 * PhantomPay One-Click Checkout — VULNERABLE target app (Phase 0 artifact).
 *
 * Saldo awal $1.000,00; beli Cursed Relic $250,00. Semua saldo SIMULASI,
 * bukan uang nyata. File ini sengaja rentan: berisi 3 bug dari blueprint §2.3
 * yang nantinya ditangkap Poltergeist dan diperbaiki Exorcist (Phase 3).
 *
 * Bug 1 (RACE_DOUBLE_CHARGE): handleCheckout() tidak mengunci tombol dan
 *   tidak memakai idempotencyKey selama menunggu /api/pay (180ms) — klik
 *   3x dalam 40ms mendebit $250 tiga kali (saldo $250, bukan $750).
 * Bug 2 (NETWORK_3G_CHAOS): fetch harga/diskon tumpang tindih tanpa
 *   AbortController — respons basi yang lambat menimpa respons terbaru.
 * Bug 3 (STORAGE_XSS_SPECTER): JSON.parse(localStorage) tanpa try/catch —
 *   cart rusak melempar SyntaxError dan mengosongkan UI.
 *
 * Jalankan di browser: load file ini, lalu panggil window.PhantomPay.
 * Di Node: require('./phantom-pay.js') (tanpa localStorage sungguhan —
 * storage di sini memakai memori).
 */
'use strict';

const ITEM_PRICE_CENTS = 25000; // Cursed Relic $250.00
const START_BALANCE_CENTS = 100000; // Wallet $1,000.00
const PAY_LATENCY_MS = 180; // /api/pay lambat — jendela race condition

// Storage tiruan (pengganti localStorage saat jalan di Node).
const memoryStorage = {
  _data: {},
  getItem(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
  setItem(key, value) { this._data[key] = String(value); },
  removeItem(key) { delete this._data[key]; },
  clear() { this._data = {}; },
};

function storage() {
  if (typeof localStorage !== 'undefined') return localStorage;
  return memoryStorage;
}

function createPhantomPay() {
  const state = {
    balanceCents: START_BALANCE_CENTS,
    charges: [], // tiap /api/pay yang "berhasil" menambah satu charge
    consoleErrors: [],
    currency: 'USD',
    discountCode: '',
    displayedPriceCents: ITEM_PRICE_CENTS,
    cart: null,
  };

  // EXORCISED: safe deserialization — corrupted cart falls back.
  function loadCart() {
    const raw = storage().getItem('phantom_cart');
    if (raw === null) {
      state.cart = { items: [] };
      return state.cart;
    }
    try {
      state.cart = JSON.parse(raw);
    } catch (err) {
      state.consoleErrors.push('Storage parse failed, fell back to empty cart: ' + err.message);
      state.cart = { items: [] };
    }
    return state.cart;
  }

  // Simulasi /api/pay: butuh 180ms, lalu mendebit saldo.
  function payApi(amountCents) {
    return new Promise((resolve) => {
      setTimeout(() => {
        state.balanceCents -= amountCents;
        const charge = {
          id: 'ch_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
          amountCents,
          item: 'Cursed Relic',
        };
        state.charges.push(charge);
        resolve(charge);
      }, PAY_LATENCY_MS);
    });
  }

  // EXORCISED: idempotency lock — concurrent clicks share one charge.
  let inFlightCheckout = null;
  async function handleCheckout() {
    if (inFlightCheckout) return inFlightCheckout;
    const idempotencyKey = 'idem_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    inFlightCheckout = payApi(ITEM_PRICE_CENTS).finally(() => { inFlightCheckout = null; });
    const charge = await inFlightCheckout;
    charge.idempotencyKey = idempotencyKey;
    state.lastIdempotencyKey = idempotencyKey;
    return charge;
  }

  // EXORCISED: stale-response guard — superseded requests are ignored.
  let latestPriceRequest = 0;
  function fetchPrice(currency, discountCode) {
    const requestId = ++latestPriceRequest;
    const delay = 60 + Math.floor(Math.random() * 240); // 60–300ms acak
    return new Promise((resolve) => {
      setTimeout(() => {
        if (requestId !== latestPriceRequest) {
          resolve({ priceCents: state.displayedPriceCents, currency: state.currency, discountCode: state.discountCode, stale: true });
          return;
        }
        let price = ITEM_PRICE_CENTS;
        if (discountCode === 'GHOST10') price = Math.round(price * 0.9);
        if (currency === 'EUR') price = Math.round(price * 0.92);
        state.currency = currency;
        state.discountCode = discountCode;
        state.displayedPriceCents = price;
        resolve({ priceCents: price, currency, discountCode });
      }, delay);
    });
  }

  function saveCart(cart) {
    storage().setItem('phantom_cart', JSON.stringify(cart));
    state.cart = cart;
    return cart;
  }

  function corruptCart(raw) {
    // Dipakai Storage Banshee: menulis string bukan-JSON ke storage.
    storage().setItem('phantom_cart', raw);
  }

  function formatCents(cents) {
    return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function snapshot() {
    return {
      balance: formatCents(state.balanceCents),
      balanceCents: state.balanceCents,
      charges: state.charges.length,
      totalChargedCents: state.charges.reduce((s, c) => s + c.amountCents, 0),
      displayedPrice: formatCents(state.displayedPriceCents),
      consoleErrors: state.consoleErrors.length,
    };
  }

  return {
    state,
    loadCart,
    handleCheckout,
    fetchPrice,
    saveCart,
    corruptCart,
    snapshot,
    formatCents,
    ITEM_PRICE_CENTS,
    START_BALANCE_CENTS,
  };
}

const PhantomPay = createPhantomPay();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createPhantomPay, PhantomPay };
}
if (typeof window !== 'undefined') {
  window.PhantomPay = PhantomPay;
}
