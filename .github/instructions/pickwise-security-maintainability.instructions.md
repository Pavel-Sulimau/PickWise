---
applyTo: "src/**/*.{ts,tsx}"
description: "Fortula development guardrails for security, fairness, and maintainable React + TypeScript code."
---

# Fortula Security and Maintainability

Use these rules for all product code changes.

## Security and Trust

- Keep all randomness cryptographically secure. Use helpers from `src/utils/random.ts` and do not introduce `Math.random()` for product behavior.
- Preserve user privacy. Keep entries and history client-side unless a feature explicitly requires backend sync.
- Treat user input as untrusted. Always trim, bound, and validate names/counts/durations using shared constants from `src/types.ts`.
- Preserve CSP hardening and environment-aware behavior in `index.html` and `vite.config.ts`.

## Maintainability

- Keep business logic deterministic and testable. Prefer pure helpers in `src/utils/` and reducer-driven state transitions.
- Do not duplicate limits or magic values. Reuse shared constants and existing utility functions.
- Keep components focused and accessible (keyboard support, focus handling, aria labels, escape behavior for modals).
- Prefer explicit TypeScript types over `any`, especially in reducer actions, utility boundaries, and persisted state shapes.

## Change Quality Bar

- For behavior changes, add or update Vitest coverage near the changed logic.
- Maintain green quality checks before merge: `npm run lint`, `npm run test`, and `npm run build`.
- Keep changes minimal and clear: avoid broad refactors unless required to fix correctness, security, or long-term maintainability.