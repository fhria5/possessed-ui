# Kiro Steering Rules: Frontend Resilience & Self-Healing Patterns

1. **Mandatory Mutation Idempotency:**
   - Every financial or state-mutating UI action (e.g., checkout, transfer, submit) MUST implement an in-flight execution lock (`isSubmitting`) AND attach a unique `idempotencyKey` header so rapid multi-clicks cannot trigger duplicate charges.
2. **Stale Request Cancellation:**
   - All user-triggered search, filter, or pricing fetches MUST cancel superseded in-flight requests using `AbortController` to prevent out-of-order network race conditions.
3. **Defensive Storage Deserialization:**
   - Never call `JSON.parse()` on `localStorage` or `sessionStorage` outside a `try/catch` block; always fall back to a validated default state schema on corruption.
