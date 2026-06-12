# Fortula

Fortula is a privacy-first random picker web app with a fair, secure wheel.

## Highlights

- Equal-odds selection with cryptographically secure randomness
- Client-side only data flow (entries stay on device)
- Elimination mode with winner history and restore flow
- Accessible modal system and keyboard-friendly interactions
- Production-ready checks: lint, tests, and build

## Stack

- React 19 + TypeScript
- Vite + Vitest + ESLint
- Framer Motion + canvas-confetti

## Quick Start

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run dev            # local development
npm run lint           # static checks
npm run test           # test suite
npm run test:coverage  # coverage report
npm run build          # production build
npm run preview        # preview build output
```

## Quality Gate

Before merging:

```bash
npm run lint && npm run test && npm run build
```

## Security Notes

- Randomness is sourced from Web Crypto via `src/utils/random.ts`.
- Persistence uses localStorage key `fortula-state-v1`.
- CSP is environment-aware (`vite.config.ts` injects connect-src policy for dev vs build).

## Deploy

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`.
