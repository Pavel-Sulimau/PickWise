# Fortula - Privacy-First Single-Page Spinner
## Revised Implementation Plan

Date: June 12, 2026  
Status: In Progress - MVP foundation implemented  
Scope: MVP with polish-ready architecture

---

## 0. Implementation Progress Log

Last updated: June 12, 2026

### 0.1 Phase Status
1. Phase 1 (Setup): Completed.
2. Phase 2 (Fairness Engine): Completed.
3. Phase 3 (Core State and Persistence): Completed.
4. Phase 4 (Wheel Renderer and Motion): Completed.
5. Phase 5 (Entries and Winner UX): Completed.
6. Phase 6 (Accessibility and Responsiveness): In progress (core items complete, additional focused QA pending).
7. Phase 7 (QA and Hardening): In progress.

### 0.2 Delivered in Codebase
1. Vite + React + TypeScript project scaffold with linting.
2. Secure randomness only using `crypto.getRandomValues` with rejection sampling; no `Math.random` fallback.
3. Unit tests for unbiased index generation.
4. Reducer-driven wheel state with entries, history, settings, and localStorage persistence.
5. Canvas wheel renderer with devicePixelRatio scaling, responsive redraw, narrow-slice label truncation, and deterministic spin targeting.
6. Entry management UX: single add, bulk import, duplicate choice modal, inline edit, delete, clear-all, and shuffle.
7. Winner UX: modal, confetti, optional sound, remove winner, and elimination-only remove-and-spin-again path.
8. Winner history panel with round display, snapshot, timestamp, removed status, and clear action.
9. Secure-randomness unavailable guard state and trust footer note.
10. Dev-only fairness simulation panel (histogram + chi-square summary).

### 0.3 Validation Snapshot
1. `npm run lint`: passing.
2. `npm run test`: passing.
3. `npm run build`: passing.

---

## 1. Product Direction

### 1.1 Product Goal
Build a minimal, modern, one-page random picker where users can manage entries and spin a visually rich wheel with strong fairness guarantees.

### 1.2 Non-Negotiables
1. Privacy-first: names stay on-device only.
2. Equal odds in MVP.
3. Fairness transparency: secure randomness and no hidden weighting.
4. Smooth, intentional animation in idle and spin states.
5. Responsive and accessible experience.

### 1.3 Working Product Name
Use Fortula as the internal and external product name.

---

## 2. Finalized MVP Scope

### 2.1 Entry Management
1. Bulk paste multiline names.
2. Single add entry.
3. Inline edit entry.
4. Delete one entry.
5. Clear all entries with confirmation.
6. Shuffle entries.

### 2.2 Duplicate Handling Policy
1. Always trim whitespace and remove empty lines.
2. Detect duplicates on bulk import.
3. Do not silently deduplicate.
4. Prompt user with two explicit actions:
   - Keep duplicates
   - Remove duplicates

### 2.3 Wheel and Spin Behavior
1. Equal probability for each active entry.
2. Winner selected before animation starts.
3. Spin animation visual only, outcome already fixed.
4. Entry editing disabled during spin.
5. Spin disabled while wheel is spinning.

### 2.4 Winner Experience
1. Winner modal with enlarged name.
2. Confetti celebration.
3. Optional sound effects.
4. Post-win actions:
   - Spin again
   - Remove winner
   - Close
5. Remove and spin again only shown when Elimination mode is enabled.

### 2.5 Winner History Panel (MVP)
1. Show round number.
2. Show winner name snapshot.
3. Show timestamp.
4. Show whether winner was removed.
5. Clear history action.

### 2.6 Explicit UI States (MVP)
1. Zero entries state:
   - Spin disabled
   - Message: Add at least one entry to spin.
2. One entry state:
   - Spin enabled
   - Always selects the single entry
3. Exhausted state (all removed):
   - Message: All entries have been picked.
   - Actions: Add entries, Restore all from history (optional toggle behavior)

---

## 3. Fairness and Randomness Guarantees

### 3.1 Random Source Policy
1. Use secure browser randomness only: crypto.getRandomValues.
2. No Math.random fallback.
3. If secure randomness is unavailable:
   - Disable spin
   - Show message: Your browser does not support secure randomness. Please use a modern browser.

### 3.2 Bias Prevention Rule
Secure random index generation must use rejection sampling to avoid modulo bias.

### 3.3 Winner Selection Flow
1. User presses Spin.
2. Compute active count N.
3. Generate unbiased random integer in range [0, N-1] using rejection sampling.
4. Resolve winner entry.
5. Compute target stop angle for winner segment.
6. Run spin animation toward target angle.
7. Reveal winner modal.

### 3.4 Probability Guarantee
Each active entry has probability 1/N for every spin. Results are independent between spins.

### 3.5 Fairness Verification
1. Include dev-only simulation tool to run large spin batches.
2. Output histogram and chi-square summary.
3. Not shown in production UI.

---

## 4. Privacy Architecture

### 4.1 Data Boundary
1. No backend.
2. No analytics SDK.
3. No ad scripts.
4. No third-party tracking pixels.

### 4.2 Local Persistence
Entries persist locally in browser localStorage across page refreshes and browser restarts until user clears them.

### 4.3 Network Discipline
1. No API calls for user entries.
2. No remote fonts.
3. No remote assets required for core experience.

### 4.4 Trust Messaging
Show persistent footer note: Your entries never leave your device.

---

## 5. Technical Architecture

### 5.1 Stack
1. Vite + React + TypeScript.
2. Canvas for wheel rendering.
3. DOM for controls, entries, winner modal, history, and accessibility semantics.
4. Framer Motion for UI transitions.
5. Canvas confetti for celebration.

### 5.2 Canvas Accessibility and Reliability Requirements
1. Scale canvas by devicePixelRatio.
2. Redraw on resize.
3. Hide or truncate labels on narrow slices.
4. Keep full entry list in accessible DOM.
5. Winner announcements via aria-live region in DOM.
6. Keyboard operability must never depend on canvas text.

### 5.3 Fonts and Assets
1. Use system font stack or locally bundled fonts only.
2. Do not fetch fonts from external CDNs.

---

## 6. Data Model

### 6.1 Core Types
```ts
type Entry = {
  id: string;
  name: string;
  createdAt: number;
};

type WheelSettings = {
  soundEnabled: boolean; // default false
  confettiEnabled: boolean; // default true
  eliminationMode: boolean; // default false
  autoRemoveWinner: boolean; // default false
  spinDurationMs: number; // default 5200
};

type SpinHistoryItem = {
  id: string;
  winnerEntryId: string;
  winnerNameSnapshot: string;
  timestamp: number;
  removedAfterWin: boolean;
};

type WheelState = {
  entries: Entry[]; // active entries only
  history: SpinHistoryItem[];
  settings: WheelSettings;
};
```

### 6.2 State Model Decision
Use active entries list only for MVP, not soft-delete flags. History preserves immutable winner snapshots.

---

## 7. Animation Plan

### 7.1 Idle Animation
Subtle breathing or slow drift while idle. Must remain visually calm and never distract from entry editing.

### 7.2 Spin Timing (Deterministic)
1. Default duration: 5200ms.
2. Base rotations: 5 full turns.
3. Extra rotations: random 0 to 3 turns for visual variety.
4. Easing: strong ease-out curve.
5. Optional micro-bounce on stop.

### 7.3 Reduced Motion
1. Honor prefers-reduced-motion.
2. Replace long spin with short minimal transition.
3. Disable confetti burst intensity if reduced motion enabled.

---

## 8. Sound Policy

1. Sound effects are optional.
2. Sound default is off.
3. Play only after explicit user interaction.
4. No autoplay on page load.

---

## 9. User Flows

### 9.1 First-Time User
1. User opens page.
2. Sees empty state and privacy note.
3. Adds entries via bulk paste or single add.
4. If duplicates detected, chooses keep or remove.
5. Spins wheel.
6. Gets winner modal with celebration and actions.

### 9.2 Elimination Flow
1. User enables Elimination mode.
2. Spins.
3. On winner modal, can remove winner.
4. Remove and spin again shortcut available only in this mode.

### 9.3 Session Continuity
1. Reload page.
2. Entries and settings restore from localStorage.
3. History remains available until cleared by user.

---

## 10. Implementation Phases

### Phase 1: Setup
1. Initialize Vite + React + TypeScript.
2. Configure linting and formatting.
3. Establish folder layout.

### Phase 2: Fairness Engine
1. Implement secure random utility with rejection sampling.
2. Add unavailable-crypto guard path.
3. Add unit tests for unbiased index generation.

### Phase 3: Core State and Persistence
1. Build reducer for spin lifecycle and actions.
2. Implement localStorage persistence and restore.
3. Add history snapshot handling.

### Phase 4: Wheel Renderer and Motion
1. Canvas wheel drawing with DPI scaling.
2. Idle animation.
3. Deterministic spin animation toward selected winner.

### Phase 5: Entries and Winner UX
1. Bulk import with duplicate-choice prompt.
2. One-by-one add, edit, delete, clear-all.
3. Winner modal actions and elimination mode behavior.

### Phase 6: Accessibility and Responsiveness
1. Keyboard flows and focus management.
2. aria-live winner announcement.
3. Desktop, tablet, and mobile layouts.

### Phase 7: QA and Hardening
1. Functional test matrix.
2. Fairness simulation audit.
3. Performance checks and network purity verification.

---

## 11. Time Estimates

1. Functional MVP estimate: 14 to 16 hours.
2. Polished MVP estimate: 24 to 32 hours.

---

## 12. Acceptance Criteria

1. Equal-odds spins implemented using secure randomness only.
2. Rejection sampling implemented and tested.
3. Duplicate handling requires explicit user choice.
4. Winner modal includes enlarge, confetti, and optional sound.
5. Remove winner supported.
6. Remove and spin again only available in Elimination mode.
7. Winner history panel visible and functional.
8. Entries and settings persist across browser restarts.
9. Zero third-party network calls for app functionality.
10. Works on modern desktop and mobile browsers.
11. Keyboard and reduced-motion support verified.

---

## 13. Out of Scope for MVP

1. Weighted entries.
2. Multi-wheel management.
3. Cloud save and share links.
4. CSV upload.
5. Image entries.
6. Collaboration mode.

---

## 14. Next Step

Complete final QA hardening and acceptance walkthrough:
1. Run a keyboard-only flow audit for all critical interactions.
2. Verify reduced-motion behavior end-to-end on target browsers/devices.
3. Perform network purity check in browser devtools (no unexpected third-party requests).
4. Execute manual acceptance-criteria checklist and capture sign-off notes.
