---
applyTo: "**"
description: "Repo-wide baseline rules for secure, maintainable, and concise Fortula development."
---

# Fortula General Engineering Baseline

Use these rules across the whole repository.

## Scope

- This file defines default standards for all files.
- When a more specific instruction applies, follow both; use the specific one for file-level details.

## Security and Safety

- Keep security-first behavior intact. Do not weaken privacy guarantees, CSP posture, or fairness semantics.
- Never introduce secrets, tokens, or credentials into code, docs, tests, or configuration files.
- Validate untrusted input and avoid unsafe assumptions in parsing, persistence, and user-facing flows.

## Maintainability

- Prefer small, focused changes over broad refactors.
- Reuse existing utilities, constants, and patterns before introducing new abstractions.
- Keep naming clear and intent-driven; avoid hidden side effects.

## Documentation and Config Hygiene

- Keep README and related docs aligned with actual behavior and scripts.
- For config changes, preserve least-privilege defaults and explicit rationale.
- Remove stale notes and avoid duplicating source-of-truth information.

## Quality Bar

- Verify impacted areas with the project checks (`lint`, `test`, `build`) when changes affect behavior.
- Add or update tests for logic changes and keep the codebase easy to reason about.