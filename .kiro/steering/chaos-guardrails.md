# Kiro Steering Rules: Paranormal Chaos Containment Guardrails

1. **Localhost-Only Target Enforcement:**
   - The CDP Poltergeist browser controller is strictly prohibited from navigating to or injecting chaos scripts into non-local domains. Only `http://localhost:*`, `http://127.0.0.1:*`, or the embedded sandbox frame are permitted.
2. **Deterministic Shrinking:**
   - Every chaos failure must be shrunk to the shortest reproducible sequence of user actions before invoking the Exorcist patch generator.
