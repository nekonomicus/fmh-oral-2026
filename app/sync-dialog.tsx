'use client';

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { PLAYERS, partnerOf, playerLabel, type PlayerId } from './sync';
import type { TrackerSync } from './use-tracker';

const STATUS_DOT: Record<TrackerSync['status'], string> = {
  off: '',
  syncing: 'busy',
  synced: 'ok',
  unauthorized: 'bad',
  unconfigured: 'bad',
  network: 'bad',
  conflict: 'bad',
};

export function SyncButton({ sync, onOpen }: { sync: TrackerSync; onOpen: () => void }) {
  if (!sync.config) {
    return <button type="button" onClick={onOpen} aria-haspopup="dialog">CONNECT</button>;
  }
  return (
    <button type="button" className="sync-button" onClick={onOpen} aria-haspopup="dialog" title="Sync settings">
      <span className={`sync-dot ${STATUS_DOT[sync.status]}`} aria-hidden="true" />
      {playerLabel(sync.config.player)}
    </button>
  );
}

export function SyncDialog({ sync, onClose }: { sync: TrackerSync; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [player, setPlayer] = useState<PlayerId>(sync.config?.player ?? 'sam');
  const [code, setCode] = useState(sync.config?.code ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError('ENTER THE SHARED CODE');
      return;
    }
    setBusy(true);
    setError('');
    const result = await sync.connect({ player, code: trimmed });
    setBusy(false);
    if (result === 'unauthorized') setError('CODE REJECTED');
    else if (result === 'unconfigured') setError('SERVER HAS NO SYNC STORE YET · SEE README');
    else onClose();
  };

  const closeFromBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || busy) return;
    const bounds = dialog.getBoundingClientRect();
    const inside = event.clientX >= bounds.left && event.clientX <= bounds.right
      && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    if (!inside) onClose();
  };

  const partner = sync.config ? playerLabel(partnerOf(sync.config.player)) : null;

  return (
    <dialog
      ref={dialogRef}
      className="sync-dialog"
      aria-labelledby="sync-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onMouseDown={closeFromBackdrop}
    >
      <form className="sync-sheet" onSubmit={(event) => void submit(event)}>
        <span className="topic-note-kicker">TWO-PLAYER SYNC</span>
        <h2 id="sync-dialog-title">{sync.config ? 'Connected' : 'Connect'}</h2>
        <p className="sync-help">
          PICK YOUR NAME AND ENTER THE SHARED CODE ON EVERY DEVICE. CHECKS AND NOTES SYNC · IMAGES STAY ON EACH DEVICE.
        </p>

        <div className="sync-players" role="radiogroup" aria-label="Player">
          {PLAYERS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={player === option.id}
              className={player === option.id ? 'selected done' : ''}
              onClick={() => setPlayer(option.id)}
              disabled={busy}
            >
              <span className="check" aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>

        <label className="sync-code">
          <span>SHARED CODE</span>
          <input
            type="password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={busy}
          />
        </label>

        <div className="sync-foot">
          <span className={error ? 'save-warning' : ''} role={error ? 'alert' : 'status'}>
            {error || (sync.config ? `SEEING ${partner}'S PROGRESS TOO` : 'ASK SAM FOR THE CODE')}
          </span>
          <div className="sync-actions">
            {sync.config && (
              <button type="button" onClick={() => { sync.disconnect(); onClose(); }} disabled={busy}>DISCONNECT</button>
            )}
            <button type="button" onClick={onClose} disabled={busy}>CLOSE</button>
            <button type="submit" className="primary" disabled={busy}>{busy ? 'CONNECTING…' : sync.config ? 'UPDATE' : 'CONNECT'}</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
