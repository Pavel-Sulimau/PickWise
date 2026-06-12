import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ConfirmModal } from './components/ConfirmModal';
import { DevFairnessPanel } from './components/DevFairnessPanel';
import { DuplicateChoiceModal } from './components/DuplicateChoiceModal';
import { HistoryPanel } from './components/HistoryPanel';
import { WheelCanvas } from './components/WheelCanvas';
import { WinnerModal } from './components/WinnerModal';
import {
  createInitialWheelState,
  wheelReducer,
} from './reducer/wheelReducer';
import {
  MAX_ENTRIES,
  MAX_ENTRY_NAME_LENGTH,
  SPIN_DURATION_MAX_MS,
  SPIN_DURATION_MIN_MS,
  SPIN_SETTLE_BUFFER_MS,
  type Entry,
} from './types';
import {
  deduplicateCaseInsensitive,
  trimAndFilterLines,
} from './utils/entries';
import { createId } from './utils/ids';
import {
  generateSecureInt,
  generateUnbiasedIndex,
  isSecureRandomAvailable,
} from './utils/random';
import { playWinTone } from './utils/sound';
import { loadPersistedState, savePersistedState } from './utils/storage';
import './App.css';

type PendingImport = {
  names: string[];
  duplicateCount: number;
};

type WinnerState = {
  entryId: string;
  name: string;
  historyId: string;
  removed: boolean;
};

function countDuplicatesAgainstCurrent(names: string[], entries: Entry[]): number {
  const seen = new Set(entries.map((entry) => entry.name.toLowerCase()));
  let duplicates = 0;

  for (const name of names) {
    const normalized = name.toLowerCase();
    if (seen.has(normalized)) {
      duplicates += 1;
      continue;
    }

    seen.add(normalized);
  }

  return duplicates;
}

function removeDuplicatesAgainstCurrent(names: string[], entries: Entry[]): string[] {
  const filtered = deduplicateCaseInsensitive(names);
  const seen = new Set(entries.map((entry) => entry.name.toLowerCase()));

  return filtered.filter((name) => {
    const normalized = name.toLowerCase();
    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function computeTargetRotation(
  currentRotation: number,
  winnerIndex: number,
  totalEntries: number,
  extraTurns: number,
): number {
  const pointerDeg = -90;
  const segmentSizeDeg = 360 / totalEntries;
  const winnerCenterDeg = winnerIndex * segmentSizeDeg + segmentSizeDeg / 2;
  const baselineTarget = currentRotation + 360 * (5 + extraTurns);
  const alignedBase = pointerDeg - winnerCenterDeg;
  const turnsNeeded = Math.ceil((baselineTarget - alignedBase) / 360);
  return alignedBase + turnsNeeded * 360;
}

function App() {
  const reduceMotion = useReducedMotion() ?? false;

  const [state, dispatch] = useReducer(wheelReducer, undefined, () => {
    const persisted = loadPersistedState();
    return createInitialWheelState(persisted);
  });

  const [singleDraft, setSingleDraft] = useState('');
  const [bulkDraft, setBulkDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [rotationDeg, setRotationDeg] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentSpinDurationMs, setCurrentSpinDurationMs] = useState(
    state.settings.spinDurationMs,
  );
  const [confirmClearEntries, setConfirmClearEntries] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [pendingWinner, setPendingWinner] = useState<Omit<WinnerState, 'removed'> | null>(
    null,
  );
  const [winnerState, setWinnerState] = useState<WinnerState | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [syncedSidePanelHeight, setSyncedSidePanelHeight] = useState<number | null>(
    null,
  );
  const spinSettledRef = useRef(true);
  const confettiRef = useRef<ReturnType<typeof confetti.create> | null>(null);
  const wheelPanelRef = useRef<HTMLElement>(null);

  const secureRandomAvailable = useMemo(() => isSecureRandomAvailable(), []);

  useEffect(() => {
    savePersistedState({
      entries: state.entries,
      history: state.history,
      settings: state.settings,
    });
  }, [state.entries, state.history, state.settings]);

  useEffect(() => {
    // Keep CSP strict by avoiding blob-backed workers for confetti rendering.
    confettiRef.current = confetti.create(undefined, {
      resize: true,
      useWorker: false,
    });

    return () => {
      confettiRef.current?.reset();
      confettiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const panel = wheelPanelRef.current;
    if (!panel) {
      return;
    }

    const updateSyncedHeight = () => {
      setSyncedSidePanelHeight(Math.round(panel.getBoundingClientRect().height));
    };

    updateSyncedHeight();

    const observer = new ResizeObserver(() => {
      updateSyncedHeight();
    });

    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  const spinDisabled =
    isSpinning || !secureRandomAvailable || state.entries.length === 0;
  const entryLimitReached = state.entries.length >= MAX_ENTRIES;

  const hasRemovedWinners = state.history.some((item) => item.removedAfterWin);
  const isExhausted = state.entries.length === 0 && hasRemovedWinners;

  const winnerCanBeRemoved =
    winnerState !== null &&
    !winnerState.removed &&
    state.entries.some((entry) => entry.id === winnerState.entryId);

  const workspaceGridStyle: CSSProperties | undefined =
    syncedSidePanelHeight !== null
      ? ({
          '--synced-side-panel-height': `${syncedSidePanelHeight}px`,
        } as CSSProperties)
      : undefined;

  function runSpinWithEntries(entries: Entry[]): void {
    if (entries.length === 0 || !secureRandomAvailable) {
      return;
    }

    const winnerIndex =
      entries.length === 1 ? 0 : generateUnbiasedIndex(entries.length);
    const winner = entries[winnerIndex];
    if (!winner) {
      return;
    }

    const extraTurns =
      reduceMotion || entries.length === 1 ? 0 : generateSecureInt(0, 3);
    const spinDuration = reduceMotion ? 700 : state.settings.spinDurationMs;
    const targetRotation = computeTargetRotation(
      rotationDeg,
      winnerIndex,
      entries.length,
      extraTurns,
    );

    setWinnerState(null);
    spinSettledRef.current = false;
    setPendingWinner({
      entryId: winner.id,
      name: winner.name,
      historyId: createId('history'),
    });
    setCurrentSpinDurationMs(spinDuration);
    setIsSpinning(true);
    window.requestAnimationFrame(() => {
      setRotationDeg(targetRotation);
    });
  }

  function handleSpin(): void {
    runSpinWithEntries(state.entries);
  }

  const handleSpinEnd = useCallback((): void => {
    if (spinSettledRef.current) {
      return;
    }

    spinSettledRef.current = true;

    if (!pendingWinner) {
      setIsSpinning(false);
      return;
    }

    setIsSpinning(false);

    dispatch({
      type: 'record-winner',
      payload: {
        id: pendingWinner.historyId,
        winnerEntryId: pendingWinner.entryId,
        winnerNameSnapshot: pendingWinner.name,
        timestamp: Date.now(),
        removedAfterWin: false,
      },
    });

    let removed = false;
    if (state.settings.autoRemoveWinner) {
      dispatch({
        type: 'remove-winner',
        payload: {
          id: pendingWinner.entryId,
          historyId: pendingWinner.historyId,
        },
      });
      removed = true;
    }

    setWinnerState({
      ...pendingWinner,
      removed,
    });
    setLiveAnnouncement(`Winner: ${pendingWinner.name}`);

    if (state.settings.confettiEnabled) {
      (confettiRef.current ?? confetti)({
        particleCount: reduceMotion ? 85 : 220,
        spread: reduceMotion ? 40 : 88,
        origin: { y: 0.6 },
      });
    }

    if (state.settings.soundEnabled) {
      void playWinTone();
    }

    setPendingWinner(null);
  }, [
    pendingWinner,
    reduceMotion,
    state.settings.autoRemoveWinner,
    state.settings.confettiEnabled,
    state.settings.soundEnabled,
  ]);

  useEffect(() => {
    if (!isSpinning || !pendingWinner) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      handleSpinEnd();
    }, currentSpinDurationMs + SPIN_SETTLE_BUFFER_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isSpinning, pendingWinner, currentSpinDurationMs, handleSpinEnd]);

  function handleSingleAdd(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (entryLimitReached) {
      return;
    }

    const next = singleDraft.trim().slice(0, MAX_ENTRY_NAME_LENGTH);
    if (!next) {
      return;
    }

    dispatch({ type: 'add-entry', payload: { name: next } });
    setSingleDraft('');
  }

  function handleBulkImport(): void {
    if (entryLimitReached) {
      return;
    }

    const names = trimAndFilterLines(bulkDraft, MAX_ENTRIES - state.entries.length);
    if (names.length === 0) {
      return;
    }

    const duplicateCount = countDuplicatesAgainstCurrent(names, state.entries);
    if (duplicateCount > 0) {
      setPendingImport({ names, duplicateCount });
      return;
    }

    dispatch({ type: 'add-many', payload: { names } });
    setBulkDraft('');
  }

  function applyDuplicateChoice(removeDuplicates: boolean): void {
    if (!pendingImport) {
      return;
    }

    const nextNames = removeDuplicates
      ? removeDuplicatesAgainstCurrent(pendingImport.names, state.entries)
      : pendingImport.names;

    if (nextNames.length > 0) {
      dispatch({ type: 'add-many', payload: { names: nextNames } });
    }

    setBulkDraft('');
    setPendingImport(null);
  }

  function handleEditStart(entry: Entry): void {
    setEditingId(entry.id);
    setEditingDraft(entry.name);
  }

  function commitEdit(): void {
    if (!editingId) {
      return;
    }

    dispatch({ type: 'edit-entry', payload: { id: editingId, name: editingDraft } });
    setEditingId(null);
    setEditingDraft('');
  }

  function handleRemoveWinner(): void {
    if (!winnerState || !winnerCanBeRemoved) {
      return;
    }

    dispatch({
      type: 'remove-winner',
      payload: { id: winnerState.entryId, historyId: winnerState.historyId },
    });
    setWinnerState({ ...winnerState, removed: true });
  }

  function handleRemoveAndSpinAgain(): void {
    if (!winnerState) {
      return;
    }

    const wasPresent = state.entries.some((entry) => entry.id === winnerState.entryId);
    const remainingEntries = wasPresent
      ? state.entries.filter((entry) => entry.id !== winnerState.entryId)
      : state.entries;

    if (wasPresent) {
      dispatch({
        type: 'remove-winner',
        payload: { id: winnerState.entryId, historyId: winnerState.historyId },
      });
    }

    setWinnerState(null);
    runSpinWithEntries(remainingEntries);
  }

  return (
    <motion.main
      className="app-shell"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      <header className="app-header">
        <div className="header-topline">
          <p className="eyebrow">Fair random picker</p>
          <p className="trust-pill">Private by default</p>
        </div>
        <h1>PickWise</h1>
        <p className="subtitle">Equal-odds wheel picks in seconds.</p>
        <p className="privacy-note">
          Secure randomness runs in your browser with no hidden weighting.
        </p>
        <div className="header-tags" aria-label="Trust highlights">
          <span>Secure RNG</span>
          <span>Client-side spins</span>
          <span>No weighting</span>
        </div>
      </header>

      {!secureRandomAvailable ? (
        <p className="warning" role="alert">
          Your browser does not support secure randomness. Please use a modern browser.
        </p>
      ) : null}

      <section className="workspace-grid" style={workspaceGridStyle}>
        <section className="panel entry-panel" aria-label="Entries">
          <div className="panel-head">
            <h2>Entries</h2>
            <div className="row-actions">
              <button
                type="button"
                className="ghost"
                disabled={isSpinning || state.entries.length < 2 || !secureRandomAvailable}
                onClick={() => dispatch({ type: 'shuffle-entries' })}
              >
                Shuffle
              </button>
              <button
                type="button"
                className="ghost"
                disabled={isSpinning || state.entries.length === 0}
                onClick={() => setConfirmClearEntries(true)}
              >
                Clear all
              </button>
            </div>
          </div>

          <form className="add-row" onSubmit={handleSingleAdd}>
            <label className="sr-only" htmlFor="single-entry-input">
              Add one name
            </label>
            <input
              id="single-entry-input"
              value={singleDraft}
              onChange={(event) =>
                setSingleDraft(event.target.value.slice(0, MAX_ENTRY_NAME_LENGTH))
              }
              placeholder="Add one name"
              maxLength={MAX_ENTRY_NAME_LENGTH}
              disabled={isSpinning || entryLimitReached}
            />
            <button
              type="submit"
              className="primary"
              disabled={isSpinning || entryLimitReached}
            >
              Add
            </button>
          </form>

          <div className="bulk-import">
            <label htmlFor="bulk-import">Bulk paste</label>
            <textarea
              id="bulk-import"
              value={bulkDraft}
              onChange={(event) => setBulkDraft(event.target.value)}
              disabled={isSpinning || entryLimitReached}
              rows={5}
              placeholder={'Paste names, one per line'}
            />
            <button
              type="button"
              className="secondary"
              onClick={handleBulkImport}
              disabled={isSpinning || entryLimitReached}
            >
              Import lines
            </button>
          </div>

          <ul className="entry-list" aria-label="Active entries">
            {state.entries.map((entry) => (
              <li key={entry.id}>
                {editingId === entry.id ? (
                  <input
                    value={editingDraft}
                    onChange={(event) =>
                      setEditingDraft(event.target.value.slice(0, MAX_ENTRY_NAME_LENGTH))
                    }
                    onBlur={commitEdit}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitEdit();
                      }
                    }}
                    maxLength={MAX_ENTRY_NAME_LENGTH}
                    autoFocus
                    disabled={isSpinning}
                  />
                ) : (
                  <span>{entry.name}</span>
                )}
                <div className="row-actions">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => handleEditStart(entry)}
                    disabled={isSpinning}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() =>
                      dispatch({ type: 'delete-entry', payload: { id: entry.id } })
                    }
                    disabled={isSpinning}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {state.entries.length === 0 ? (
            <p className="muted" role="status">
              {isExhausted
                ? 'All entries have been picked.'
                : 'Add at least one entry to spin.'}
            </p>
          ) : null}

          {entryLimitReached ? (
            <p className="muted" role="status">
              Entry limit reached ({MAX_ENTRIES}). Remove an entry to add more.
            </p>
          ) : null}
        </section>

        <section ref={wheelPanelRef} className="panel wheel-panel" aria-label="Wheel">
          <WheelCanvas
            entries={state.entries}
            winningEntryId={winnerState?.entryId}
            rotationDeg={rotationDeg}
            isSpinning={isSpinning}
            spinDurationMs={currentSpinDurationMs}
            reducedMotion={reduceMotion}
            onSpinTransitionEnd={handleSpinEnd}
          />
          <div className="wheel-actions">
            <button
              type="button"
              className="primary spin-button"
              disabled={spinDisabled}
              onClick={handleSpin}
            >
              {isSpinning ? 'Spinning...' : 'Spin'}
            </button>
            {isExhausted ? (
              <button
                type="button"
                className="secondary"
                onClick={() => dispatch({ type: 'restore-from-history' })}
              >
                Restore removed winners
              </button>
            ) : null}
          </div>

          <section className="settings" aria-label="Wheel settings">
            <h2>Settings</h2>
            <label>
              <input
                type="checkbox"
                checked={state.settings.confettiEnabled}
                onChange={(event) =>
                  dispatch({
                    type: 'update-settings',
                    payload: { confettiEnabled: event.target.checked },
                  })
                }
              />
              Confetti on win
            </label>
            <label>
              <input
                type="checkbox"
                checked={state.settings.soundEnabled}
                onChange={(event) =>
                  dispatch({
                    type: 'update-settings',
                    payload: { soundEnabled: event.target.checked },
                  })
                }
              />
              Sound on win
            </label>
            <label>
              <input
                type="checkbox"
                checked={state.settings.eliminationMode}
                onChange={(event) =>
                  dispatch({
                    type: 'update-settings',
                    payload: { eliminationMode: event.target.checked },
                  })
                }
              />
              Elimination mode
            </label>
            <label>
              <input
                type="checkbox"
                checked={state.settings.autoRemoveWinner}
                onChange={(event) =>
                  dispatch({
                    type: 'update-settings',
                    payload: { autoRemoveWinner: event.target.checked },
                  })
                }
              />
              Auto-remove winner
            </label>
            <label>
              Spin duration (ms)
              <input
                type="range"
                min={SPIN_DURATION_MIN_MS}
                max={SPIN_DURATION_MAX_MS}
                step={100}
                value={state.settings.spinDurationMs}
                onChange={(event) =>
                  dispatch({
                    type: 'update-settings',
                    payload: { spinDurationMs: Number(event.target.value) },
                  })
                }
              />
              <span>{state.settings.spinDurationMs}</span>
            </label>
          </section>
        </section>

        <HistoryPanel
          history={state.history}
          onClearHistory={() => dispatch({ type: 'clear-history' })}
        />
      </section>

      <DevFairnessPanel defaultEntryCount={Math.max(3, state.entries.length)} />

      <footer className="trust-footer">
        Your entries never leave your device.
      </footer>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      <AnimatePresence>
        {pendingImport ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <DuplicateChoiceModal
              duplicateCount={pendingImport.duplicateCount}
              totalCount={pendingImport.names.length}
              onCancel={() => setPendingImport(null)}
              onKeep={() => applyDuplicateChoice(false)}
              onRemove={() => applyDuplicateChoice(true)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {winnerState ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
          >
            <WinnerModal
              winnerName={winnerState.name}
              eliminationMode={state.settings.eliminationMode}
              canRemove={winnerCanBeRemoved}
              onClose={() => setWinnerState(null)}
              onSpinAgain={() => {
                setWinnerState(null);
                // Keep behavior consistent for both auto-remove and manual-remove modes.
                runSpinWithEntries(state.entries);
              }}
              onRemoveWinner={handleRemoveWinner}
              onRemoveAndSpinAgain={handleRemoveAndSpinAgain}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {confirmClearEntries ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ConfirmModal
              title="Clear all entries?"
              message="This removes every active entry from the wheel."
              cancelLabel="Cancel"
              confirmLabel="Clear all"
              onCancel={() => setConfirmClearEntries(false)}
              onConfirm={() => {
                setConfirmClearEntries(false);
                dispatch({ type: 'clear-entries' });
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.main>
  );
}

export default App;
