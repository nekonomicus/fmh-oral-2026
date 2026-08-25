'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { phases, reserveGroups, sideChapters, type CaseItem, type StudyPhase } from './study-data';

const STORAGE_KEY = 'fmh-oral-26-v1';
const EXAM_DATE = new Date(2026, 10, 19, 12);
const FINAL_START = new Date(2026, 10, 16, 12);

type TrackerState = {
  completed: string[];
  daily: Record<string, string[]>;
  mocks: string[];
};

const emptyState: TrackerState = { completed: [], daily: {}, mocks: [] };
const coreCases = phases.flatMap((phase) => phase.items);
const reserveCases = reserveGroups.flatMap((group) => group.items);
const allCases = [...coreCases, ...reserveCases];

function localDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function phaseFor(date: Date): StudyPhase | undefined {
  return phases.find((phase) => date >= localDate(phase.start) && date <= localDate(phase.end));
}

function percent(done: number, total: number) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function calendarDaysBetween(from: Date, to: Date) {
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.ceil((toUtc - fromUtc) / 86_400_000);
}

function currentAssignments(date: Date, completed: Set<string>) {
  const phase = phaseFor(date);
  const weekend = date.getDay() === 0 || date.getDay() === 6;

  if (date >= FINAL_START && date <= EXAM_DATE) {
    const trauma = phases[0].items.filter((item) => !completed.has(item.id));
    const ortho = phases.slice(1).flatMap((item) => item.items).filter((item) => !completed.has(item.id));
    return [trauma[0], ortho[0], trauma[1], ortho[1]].filter(Boolean).map((item) => item.id);
  }

  const firstPool = (phase?.items ?? coreCases).filter((item) => !completed.has(item.id));
  const fallback = coreCases.filter((item) => !completed.has(item.id) && !firstPool.some((pick) => pick.id === item.id));
  return [...firstPool, ...fallback].slice(0, weekend ? 3 : 2).map((item) => item.id);
}

function normalizeState(value: unknown): TrackerState {
  if (!value || typeof value !== 'object') return emptyState;
  const candidate = value as Partial<TrackerState>;
  return {
    completed: Array.isArray(candidate.completed) ? candidate.completed.filter((item): item is string => typeof item === 'string') : [],
    daily: candidate.daily && typeof candidate.daily === 'object' ? candidate.daily as Record<string, string[]> : {},
    mocks: Array.isArray(candidate.mocks) ? candidate.mocks.filter((item): item is string => typeof item === 'string') : [],
  };
}

export default function Home() {
  const [today, setToday] = useState(new Date(2026, 7, 25, 12));
  const todayKey = dateKey(today);
  const activePhase = phaseFor(today);
  const weekend = today.getDay() === 0 || today.getDay() === 6;
  const [tracker, setTracker] = useState<TrackerState>(emptyState);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(activePhase?.id ?? 'trauma');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const actualToday = new Date();
    actualToday.setHours(12, 0, 0, 0);
    const actualKey = dateKey(actualToday);
    const actualPhase = phaseFor(actualToday);
    let loaded = emptyState;
    try {
      loaded = normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
    } catch {
      loaded = emptyState;
    }

    if (!loaded.daily[actualKey]) {
      const completed = new Set(loaded.completed);
      loaded = {
        ...loaded,
        daily: { ...loaded.daily, [actualKey]: currentAssignments(actualToday, completed) },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
    }

    setToday(actualToday);
    setTracker(loaded);
    setExpanded(actualPhase?.id ?? 'spine');
    setReady(true);
  }, []);

  const save = (next: TrackerState) => {
    setTracker(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const completed = new Set(tracker.completed);
  const completeCore = coreCases.filter((item) => completed.has(item.id)).length;
  const completeReserve = [...reserveCases, ...sideChapters].filter((item) => completed.has(item.id)).length;
  const overall = percent(completeCore, coreCases.length);
  const daysLeft = Math.max(0, calendarDaysBetween(today, EXAM_DATE));
  const todayItems = (tracker.daily[todayKey] ?? [])
    .map((id) => allCases.find((item) => item.id === id))
    .filter((item): item is CaseItem => Boolean(item));

  const toggleCase = (id: string) => {
    const next = new Set(tracker.completed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    save({ ...tracker, completed: [...next] });
  };

  const toggleMock = (id: string) => {
    const next = new Set(tracker.mocks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    save({ ...tracker, mocks: [...next] });
  };

  const exportProgress = () => {
    const blob = new Blob([JSON.stringify(tracker, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fmh-oral-progress-${todayKey}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importProgress = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = normalizeState(JSON.parse(String(reader.result)));
        save(next);
      } catch {
        // An invalid backup leaves the current tracker untouched.
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <main className="shell">
      <header className="topbar">
        <span className="wordmark">ORAL / 26</span>
        <div className="top-actions">
          <button type="button" onClick={exportProgress}>BACKUP</button>
          <button type="button" onClick={() => importRef.current?.click()}>RESTORE</button>
          <input ref={importRef} className="file-input" type="file" accept="application/json" onChange={importProgress} />
          <span className="exam-date">19 NOV · {daysLeft} DAYS</span>
        </div>
      </header>

      <section className="hero">
        <div className="hero-title">
          <p className="eyebrow">FMH ORTHOPAEDICS</p>
          <h1>Daily<br />review</h1>
        </div>
        <div className="overall" aria-label={`Overall progress ${overall} percent`}>
          <div className="overall-value"><strong>{overall}%</strong><span>{completeCore} / {coreCases.length}</span></div>
          <div className="progress-track"><span style={{ width: `${overall}%` }} /></div>
          <div className="overall-split"><span>48 TRAUMA</span><span>48 ORTHO</span></div>
        </div>
      </section>

      <section className="today-section">
        <div className="section-line">
          <span>TODAY</span>
          <span>{today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()} · {weekend ? '120–150 MIN' : '60–90 MIN'}</span>
        </div>
        <div className="today-list">
          {ready && todayItems.length === 0 ? (
            <div className="empty-state">CORE COMPLETE</div>
          ) : todayItems.map((item) => (
            <CaseRow key={item.id} item={item} done={completed.has(item.id)} onToggle={toggleCase} prominent />
          ))}
          {weekend && (
            <button
              type="button"
              className={`mock-row ${tracker.mocks.includes(`weekend-${todayKey}`) ? 'done' : ''}`}
              onClick={() => toggleMock(`weekend-${todayKey}`)}
            >
              <span className="check" aria-hidden="true" />
              <span>4-CASE MOCK</span>
              <span className="case-meta">2 TRAUMA · 2 ORTHO</span>
            </button>
          )}
        </div>
      </section>

      <section className="plan-section">
        <div className="section-line"><span>PLAN</span><span>{coreCases.length} CASES</span></div>
        <div className="phase-list">
          {phases.map((phase, index) => {
            const done = phase.items.filter((item) => completed.has(item.id)).length;
            const phasePercent = percent(done, phase.items.length);
            const isOpen = expanded === phase.id;
            return (
              <article className={`phase ${activePhase?.id === phase.id ? 'active' : ''} ${isOpen ? 'open' : ''}`} key={phase.id}>
                <button type="button" className="phase-head" onClick={() => setExpanded(isOpen ? null : phase.id)} aria-expanded={isOpen}>
                  <span className="phase-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="phase-name">{phase.name}</span>
                  <span className="phase-dates">{phase.window}</span>
                  <span className="phase-count">{done} / {phase.items.length}</span>
                  <span className="phase-percent">{phasePercent}%</span>
                  <span className="phase-toggle" aria-hidden="true">+</span>
                </button>
                {isOpen && (
                  <div className="phase-body">
                    <div className="chapter-strip"><span>{phase.miller}</span><span>{phase.pages}</span></div>
                    <div className="case-list">
                      {phase.items.map((item) => (
                        <CaseRow key={item.id} item={item} done={completed.has(item.id)} onToggle={toggleCase} />
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="final-block">
          <div><span className="phase-index">07</span><strong>Final mix</strong><span className="phase-dates">16–18 NOV</span></div>
          <div className="final-mocks">
            {['16 NOV', '17 NOV', '18 NOV'].map((label, index) => {
              const id = `final-${index + 1}`;
              return (
                <button key={id} type="button" className={tracker.mocks.includes(id) ? 'done' : ''} onClick={() => toggleMock(id)}>
                  <span className="check" />
                  <span>{label}</span>
                  <span>2 + 2</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="reserve-section">
        <details>
          <summary>
            <span>RESERVE</span>
            <span>{completeReserve} / {reserveCases.length + sideChapters.length}</span>
          </summary>
          <div className="reserve-body">
            {reserveGroups.map((group) => (
              <div className="reserve-group" key={group.name}>
                <div className="chapter-strip"><span>{group.name}</span><span>{group.items.length}</span></div>
                {group.items.map((item) => <CaseRow key={item.id} item={item} done={completed.has(item.id)} onToggle={toggleCase} />)}
              </div>
            ))}
            <div className="reserve-group">
              <div className="chapter-strip"><span>MILLER OUTSIDE CORE</span><span>{sideChapters.length}</span></div>
              {sideChapters.map((item) => <CaseRow key={item.id} item={item} done={completed.has(item.id)} onToggle={toggleCase} />)}
            </div>
          </div>
        </details>
      </section>

      <footer><span>AUTO-SAVED ON THIS DEVICE</span><span>MILLER 9E · HISTORICAL CASES · FMH 2+2</span></footer>
    </main>
  );
}

function CaseRow({ item, done, onToggle, prominent = false }: { item: CaseItem; done: boolean; onToggle: (id: string) => void; prominent?: boolean }) {
  return (
    <button
      type="button"
      className={`case-row ${prominent ? 'prominent' : ''} ${done ? 'done' : ''}`}
      onClick={() => onToggle(item.id)}
      aria-pressed={done}
    >
      <span className="check" aria-hidden="true" />
      <span className="case-copy">
        <span className="case-title">{item.title}</span>
        <span className="case-meta">{item.source} · {item.miller}</span>
      </span>
      {prominent && <span className="case-time">30 MIN</span>}
    </button>
  );
}
