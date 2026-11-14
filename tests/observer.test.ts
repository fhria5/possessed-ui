/**
 * CDP observer tests: scope guardrail + forensics capture.
 */
import { describe, expect, it } from 'vitest';
import {
  assertScopeAllowed,
  captureForensics,
  findFunctionLine,
  snapshotDom,
} from '../src/engine/cdp-observer';

describe('assertScopeAllowed — localhost-only guardrail', () => {
  it.each([
    ['http://localhost:8933/', true],
    ['http://127.0.0.1:3000/x', true],
    ['sandbox', true],
    ['about:blank', true],
    ['sandbox://phantom-pay', true],
  ])('allows %s', (url, expected) => {
    expect(assertScopeAllowed(url).allowed).toBe(expected);
  });

  it.each([
    'https://example.com/',
    'https://fhria5.github.io/possessed-ui/',
    'http://192.168.1.10:8080/',
    'file:///etc/passwd',
    'not-a-url',
  ])('blocks %s', (url) => {
    const verdict = assertScopeAllowed(url);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason.length).toBeGreaterThan(0);
  });
});

describe('captureForensics', () => {
  it('resolves the real source line of handleCheckout', () => {
    const line = findFunctionLine('handleCheckout');
    expect(line).toBeGreaterThan(0);
    expect(findFunctionLine('loadCart')).toBeGreaterThan(0);
    expect(findFunctionLine('noSuchFunction')).toBe(-1);
  });

  it('builds a forensics record with DOM snapshot + detail', () => {
    const snap = snapshotDom({
      balance: '$250.00',
      balanceCents: 25000,
      charges: 3,
      totalChargedCents: 75000,
      displayedPrice: '$250.00',
      consoleErrors: 0,
    });
    expect(snap).toContain('data-balance-cents="25000"');
    const f = captureForensics({
      scenarioId: 'RACE_DOUBLE_CHARGE',
      functionName: 'handleCheckout',
      consoleError: '',
      domSnapshot: snap,
      stateCorruptionDetail: 'Expected Balance: $750.00 | Actual: $250.00',
    });
    expect(f.targetFile).toBe('target-app/phantom-pay.js');
    expect(f.lineNumber).toBe(findFunctionLine('handleCheckout'));
    expect(f.domSnapshot).toContain('$250.00');
    expect(f.stateCorruptionDetail).toContain('Actual: $250.00');
    expect(f.stackTrace.length).toBeGreaterThan(0);
  });
});
