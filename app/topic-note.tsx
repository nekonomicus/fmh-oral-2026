'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { CaseItem } from './study-data';

type TopicNoteButtonProps = {
  item: CaseItem;
  hasNote: boolean;
  onOpen: (item: CaseItem) => void;
  className?: string;
  disabled?: boolean;
};

type TopicNoteDialogProps = {
  item: CaseItem;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  saveError?: boolean;
};

type NoteLink = {
  url: string;
  label: string;
};

function linksFrom(text: string): NoteLink[] {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const unique = new Set(matches.map((match) => match.replace(/[),.;!?]+$/, '')));

  return [...unique].flatMap((url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return [];
      return [{ url: parsed.href, label: parsed.hostname.replace(/^www\./, '') }];
    } catch {
      return [];
    }
  });
}

function NoteGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.75 3.25h7.7l3.8 3.8v13.7H6.75z" />
      <path d="M14.25 3.5v3.75H18" />
      <path d="M9.5 11.25h6M9.5 14.75h6M9.5 18.25h3.75" />
    </svg>
  );
}

export function TopicNoteButton({ item, hasNote, onOpen, className = '', disabled = false }: TopicNoteButtonProps) {
  return (
    <button
      type="button"
      className={`topic-note-trigger ${hasNote ? 'has-note' : ''} ${className}`.trim()}
      onClick={() => onOpen(item)}
      aria-label={`${hasNote ? 'Open saved note' : 'Add note'} for ${item.title}`}
      aria-haspopup="dialog"
      disabled={disabled}
      title={hasNote ? 'Open saved note' : 'Add a note'}
    >
      <NoteGlyph />
      {hasNote && <span className="topic-note-dot" aria-hidden="true" />}
    </button>
  );
}

export function TopicNoteDialog({ item, value, onChange, onClose, saveError = false }: TopicNoteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const lastCommittedRef = useRef<string | null>(value);
  const onChangeRef = useRef(onChange);
  const links = useMemo(() => linksFrom(draft), [draft]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const commit = useCallback(() => {
    const next = draftRef.current;
    if (lastCommittedRef.current === next) return;
    lastCommittedRef.current = next;
    onChangeRef.current(next);
  }, []);

  const closeAndSave = useCallback(() => {
    commit();
    onClose();
  }, [commit, onClose]);

  const downloadNote = () => {
    const heading = `${item.title}\n${item.source} · ${item.miller}\n\n`;
    const blob = new Blob([heading, draft], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeTitle = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'topic';
    anchor.href = url;
    anchor.download = `${safeTitle}-notes.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    draftRef.current = draft;
    const saveTimer = window.setTimeout(commit, 250);
    return () => window.clearTimeout(saveTimer);
  }, [commit, draft]);

  useEffect(() => () => commit(), [commit]);

  useEffect(() => {
    if (saveError) lastCommittedRef.current = null;
  }, [saveError]);

  useEffect(() => {
    if (draftRef.current === lastCommittedRef.current && value !== lastCommittedRef.current) {
      draftRef.current = value;
      lastCommittedRef.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const focusFrame = window.requestAnimationFrame(() => textareaRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (dialog.open) dialog.close();
    };
  }, [item.id]);

  const closeFromBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const bounds = dialog.getBoundingClientRect();
    const inside = event.clientX >= bounds.left
      && event.clientX <= bounds.right
      && event.clientY >= bounds.top
      && event.clientY <= bounds.bottom;
    if (!inside) closeAndSave();
  };

  return (
    <dialog
      ref={dialogRef}
      className="topic-note-dialog"
      aria-labelledby={`topic-note-title-${item.id}`}
      onCancel={(event) => {
        event.preventDefault();
        closeAndSave();
      }}
      onMouseDown={closeFromBackdrop}
    >
      <div className="topic-note-sheet">
        <header className="topic-note-head">
          <div>
            <span className="topic-note-kicker">TOPIC NOTE · {item.source}</span>
            <h2 id={`topic-note-title-${item.id}`}>{item.title}</h2>
            <span className="topic-note-source">{item.miller}</span>
          </div>
          <button type="button" className="topic-note-close" onClick={closeAndSave} aria-label="Close notes">
            <span aria-hidden="true">DONE</span>
          </button>
        </header>

        <textarea
          ref={textareaRef}
          className="topic-note-editor"
          value={draft}
          onChange={(event) => {
            draftRef.current = event.target.value;
            setDraft(event.target.value);
          }}
          onBlur={commit}
          aria-label={`Notes for ${item.title}`}
          spellCheck
        />

        <div className="topic-note-foot">
          <div className={`topic-note-save ${saveError ? 'error' : ''}`} role={saveError ? 'alert' : undefined}>
            {saveError ? (
              <button type="button" onClick={downloadNote}>SAVE FAILED · DOWNLOAD NOTE</button>
            ) : (
              <span>AUTO-SAVED ON THIS DEVICE</span>
            )}
            <span>{draft.length.toLocaleString()} CHAR</span>
          </div>
          {links.length > 0 && (
            <div className="topic-note-links" aria-label="Links in this note">
              <span className="topic-note-links-label">LINKS</span>
              <div>
                {links.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                    {link.label}<span aria-hidden="true"> ↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
