'use client';

import { useEffect, useRef } from 'react';

type CaseSearchProps = {
  value: string;
  onChange: (value: string) => void;
  matches: number | null;
  thinking?: boolean;
};

export function CaseSearch({ value, onChange, matches, thinking = false }: CaseSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="case-search" role="search">
      <span className="case-search-glyph" aria-hidden="true">/</span>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onChange('');
            event.currentTarget.blur();
          }
        }}
        placeholder="SEARCH CASES · TITLES, SOURCES, NOTES"
        aria-label="Search cases"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      {value && (
        <>
          <span className="case-search-count" aria-live="polite">
            {thinking ? 'AI · ' : ''}{matches ?? 0} {matches === 1 ? 'MATCH' : 'MATCHES'}
          </span>
          <button type="button" className="case-search-clear" onClick={() => onChange('')} aria-label="Clear search">×</button>
        </>
      )}
    </div>
  );
}
