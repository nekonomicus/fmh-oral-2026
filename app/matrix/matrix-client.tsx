'use client';

import { useState, type CSSProperties } from 'react';
import { phases, reserveGroups, type CaseItem } from '../study-data';
import { TopicNoteButton, TopicNoteDialog } from '../topic-note';
import { useTracker, syncStatusLabel } from '../use-tracker';
import { CaseSearch } from '../case-search';
import { matchesSearch, searchTerms } from '../search';
import { useSmartSearch } from '../use-smart-search';
import { SyncButton, SyncDialog } from '../sync-dialog';
import { PLAYERS, partnerOf, tileState } from '../sync';

const rawCases = [...phases.flatMap((phase) => phase.items), ...reserveGroups.flatMap((group) => group.items)];
const phaseItems = (id: string) => phases.find((phase) => phase.id === id)?.items ?? [];
const traumaItems = phaseItems('trauma');
const paediatricItems = phaseItems('peds');
const pick = (items: CaseItem[], indexes: number[]) => indexes.map((index) => items[index]).filter(Boolean);

type Cluster = {
  id: string;
  label: string;
  items: CaseItem[];
};

type Sector = {
  id: string;
  label: string;
  clusters: Cluster[];
};

const sectors: Sector[] = [
  {
    id: 'trauma',
    label: 'Trauma',
    clusters: [
      { id: 'trauma-shoulder', label: 'Shoulder & arm', items: traumaItems.slice(0, 11) },
      { id: 'trauma-elbow', label: 'Elbow & forearm', items: traumaItems.slice(11, 18) },
      { id: 'trauma-spine', label: 'Spine', items: traumaItems.slice(18, 23) },
      { id: 'trauma-pelvis', label: 'Pelvis / hip / femur', items: traumaItems.slice(23, 31) },
      { id: 'trauma-knee', label: 'Knee / lower leg', items: traumaItems.slice(31, 37) },
      { id: 'trauma-foot', label: 'Foot / ankle', items: traumaItems.slice(37, 44) },
      { id: 'trauma-systemic', label: 'Systemic', items: traumaItems.slice(44, 48) },
    ],
  },
  {
    id: 'orthopaedics',
    label: 'Orthopaedics',
    clusters: phases.filter((phase) => ['upper', 'foot', 'knee', 'hip', 'spine'].includes(phase.id)).map((phase) => ({
      id: phase.id,
      label: phase.name,
      items: phase.items,
    })),
  },
  {
    id: 'paediatrics',
    label: 'Paediatrics',
    clusters: [
      { id: 'peds-systemic', label: 'Systemic / neuro', items: pick(paediatricItems, [0, 1]) },
      { id: 'peds-growth', label: 'Leg / growth', items: pick(paediatricItems, [2, 3, 10, 11, 21]) },
      { id: 'peds-foot', label: 'Foot', items: paediatricItems.slice(4, 8) },
      { id: 'peds-hip', label: 'Hip', items: paediatricItems.slice(8, 10) },
      { id: 'peds-trauma', label: 'Trauma', items: paediatricItems.slice(12, 20) },
      { id: 'peds-lesion', label: 'Bone lesion', items: paediatricItems.slice(20, 21) },
    ],
  },
  {
    id: 'general',
    label: 'General',
    clusters: reserveGroups.map((group, index) => ({
      id: `general-${index + 1}`,
      label: group.name.replace(' · CASE LIST', ''),
      items: group.items,
    })),
  },
];

function clusterSpan(count: number) {
  if (count >= 14) return 12;
  if (count >= 7) return 6;
  return 4;
}

export default function MatrixClient() {
  const [activeNote, setActiveNote] = useState<CaseItem | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { tracker, ready, saveError, toggleCase, saveNote, hasSavedNote, fileState, sync } = useTracker();

  const completed = new Set(tracker.completed);
  const notes = tracker.notes;
  const doneCount = rawCases.filter((item) => completed.has(item.id)).length;
  const progress = Math.round((doneCount / rawCases.length) * 100);

  const partnerId = sync.config ? partnerOf(sync.config.player) : null;
  const partnerMeta = partnerId ? PLAYERS.find((player) => player.id === partnerId) : null;
  const partnerCount = sync.partner ? rawCases.filter((item) => sync.partnerDone.has(item.id)).length : 0;
  const partnerPercent = Math.round((partnerCount / rawCases.length) * 100);
  const player = sync.config?.player ?? null;
  const stateOf = (item: CaseItem) => tileState(completed.has(item.id), sync.partnerDone.has(item.id), player);
  const bothCount = rawCases.filter((item) => stateOf(item) === 'done').length;
  const [peek, setPeek] = useState<CaseItem | null>(null);
  const jumpTo = (item: CaseItem) => {
    const tile = document.getElementById(`case-${item.id}`);
    if (!tile) return;
    tile.scrollIntoView({ block: 'center' });
    tile.querySelector<HTMLButtonElement>('.matrix-tile')?.focus({ preventScroll: true });
  };

  const terms = searchTerms(query);
  const searching = terms.length > 0;
  const smart = useSmartSearch(query, sync.config?.code ?? null);
  const smartIds = new Set(smart.ids);
  const visible = (item: CaseItem) => smartIds.has(item.id) || matchesSearch(item, notes[item.id], terms);
  const visibleSectors = sectors
    .map((sector) => ({
      ...sector,
      clusters: sector.clusters
        .map((cluster) => ({ ...cluster, items: searching ? cluster.items.filter(visible) : cluster.items }))
        .filter((cluster) => cluster.items.length > 0),
    }))
    .filter((sector) => sector.clusters.length > 0);
  const matchCount = searching ? visibleSectors.reduce((sum, sector) => sum + sector.clusters.reduce((inner, cluster) => inner + cluster.items.length, 0), 0) : null;
  const statusLabel = syncStatusLabel(sync, 'CLICK TO UPDATE');

  return (
    <main className="shell matrix-page" aria-busy={!ready}>
      <header className="topbar">
        {/* Native links keep route changes reliable in the hosted Vinext build. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="wordmark wordmark-link" href="/">ORAL / 26</a>
        <div className="top-actions">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">DAILY</a>
          <span className="current-view" aria-current="page">MATRIX</span>
          <SyncButton sync={sync} onOpen={() => setSyncOpen(true)} />
          <span className="exam-date">20/21 NOV</span>
        </div>
      </header>

      <section className="matrix-hero">
        <div>
          <p className="eyebrow">FMH ORTHOPAEDICS</p>
          <h1>Case<br />matrix</h1>
        </div>
        <div className="overall" aria-label={`Case completion ${progress} percent`}>
          <div className="overall-value" aria-live="polite"><strong>{progress}%</strong><span>{doneCount} / {rawCases.length}</span></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          {partnerMeta && (
            <div className="partner-progress" aria-label={`${partnerMeta.label} completion ${partnerPercent} percent`}>
              <div className="partner-line">
                <span>{partnerMeta.label}</span>
                <span>{sync.partner ? `${partnerPercent}% · ${partnerCount} / ${rawCases.length}` : 'NOT CONNECTED YET'}</span>
              </div>
              <div className="progress-track partner"><span style={{ width: `${partnerPercent}%` }} /></div>
            </div>
          )}
        </div>
      </section>

      <section className="board" aria-label="All cases at a glance">
        <div className="section-line">
          <span>AT A GLANCE</span>
          <span>
            {partnerMeta ? `BOTH ${bothCount} · ` : ''}{doneCount} DONE · {rawCases.length} TOTAL
          </span>
        </div>
        <div className="board-grid">
          {sectors.flatMap((sector) => sector.clusters.flatMap((cluster) => cluster.items)).map((item) => {
            const state = stateOf(item);
            return (
              <button
                key={item.id}
                type="button"
                className={`board-cell ${state}`}
                onMouseEnter={() => setPeek(item)}
                onFocus={() => setPeek(item)}
                onMouseLeave={() => setPeek((current) => (current?.id === item.id ? null : current))}
                onClick={() => {
                  setPeek(item);
                  jumpTo(item);
                }}
                aria-label={`${item.title}. ${completed.has(item.id) ? 'Completed' : 'Not completed'}`}
              />
            );
          })}
        </div>
        <div className="board-peek" aria-live="polite">
          {peek ? (
            <>
              <span className="board-peek-title">{peek.title}</span>
              <span>{peek.source} · {peek.miller}{partnerMeta ? ` · ${PLAYERS.map((option) => `${option.label} ${(option.id === player ? completed : sync.partnerDone).has(peek.id) ? '✓' : '–'}`).join(' · ')}` : ''}</span>
            </>
          ) : (
            <span>{partnerMeta ? 'LEFT HALF MICHAEL · RIGHT HALF SAM · FULL WHEN BOTH' : 'HOVER OR TAP A SQUARE · CONNECT TO SEE BOTH PLAYERS'}</span>
          )}
        </div>
      </section>

      <nav className="matrix-nav" aria-label="Matrix sections">
        {sectors.map((sector) => <a key={sector.id} href={`#${sector.id}`}>{sector.label}</a>)}
      </nav>

      <CaseSearch value={query} onChange={setQuery} matches={matchCount} thinking={smart.busy} />

      <section className="matrix-content">
        <div className="section-line">
          <span>{searching ? 'SEARCH' : 'RAW CASES'}</span>
          <span>{searching ? `${matchCount} OF ${rawCases.length}` : `${rawCases.length} TOTAL`}</span>
        </div>
        {searching && visibleSectors.length === 0 && <div className="empty-state">NO MATCHES</div>}
        {visibleSectors.map((sector) => {
          const sectorItems = sector.clusters.flatMap((cluster) => cluster.items);
          const sectorDone = sectorItems.filter((item) => completed.has(item.id)).length;
          const sectorPercent = Math.round((sectorDone / sectorItems.length) * 100);
          return (
            <section className="matrix-sector" id={sector.id} key={sector.id}>
              <header className="matrix-sector-head">
                <h2>{sector.label}</h2>
                <span>{sectorDone} / {sectorItems.length} · {sectorPercent}%</span>
              </header>
              <div className="matrix-groups">
                {sector.clusters.map((cluster) => {
                  const clusterDone = cluster.items.filter((item) => completed.has(item.id)).length;
                  return (
                    <section
                      className="matrix-cluster"
                      key={cluster.id}
                      style={{ '--cluster-span': clusterSpan(cluster.items.length) } as CSSProperties}
                    >
                      <header className="matrix-cluster-head">
                        <h3>{cluster.label}</h3>
                        <span>{clusterDone} / {cluster.items.length}</span>
                      </header>
                      <div className="matrix-grid">
                        {cluster.items.map((item) => {
                          const done = completed.has(item.id);
                          const state = stateOf(item);
                          const partnerDone = state !== 'none' && (state !== 'done' ? !done : true) && Boolean(partnerMeta);
                          return (
                            <div
                              className={`matrix-tile-wrap ${item.title.length > 70 ? 'long' : ''} ${state === 'done' ? 'done' : ''}`}
                              key={item.id}
                              id={`case-${item.id}`}
                            >
                              <button
                                type="button"
                                className={`matrix-tile ${state}`}
                                onClick={() => toggleCase(item.id)}
                                disabled={!ready}
                                aria-pressed={done}
                                aria-label={`${item.title}. ${done ? 'Completed' : 'Not completed'}${partnerDone ? '. Partner completed' : ''}`}
                              >
                                <span className="matrix-case-title">{item.title}</span>
                                <span className="matrix-case-meta">{item.source} · {item.miller}</span>
                                <span className="matrix-status" aria-hidden="true">{done ? '✓' : ''}</span>
                              </button>
                              <TopicNoteButton
                                item={item}
                                hasNote={hasSavedNote(item.id)}
                                fileState={fileState(item.id)}
                                onOpen={setActiveNote}
                                className="matrix-note-trigger"
                                disabled={!ready}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>
          );
        })}
      </section>

      <footer>
        <span className={saveError ? 'save-warning' : ''}>{saveError ? 'SAVE FAILED · OPEN THE NOTE TO DOWNLOAD A COPY' : statusLabel}</span>
        <span>{rawCases.length} HISTORICAL CASES · LIVE PROGRESS</span>
      </footer>
      {activeNote && (
        <TopicNoteDialog
          item={activeNote}
          value={notes[activeNote.id] ?? ''}
          onChange={(value) => saveNote(activeNote.id, value)}
          onClose={() => setActiveNote(null)}
          saveError={saveError}
          savedLabel={syncStatusLabel(sync)}
          sync={sync.config}
          onFilesChanged={sync.refreshFiles}
        />
      )}
      {syncOpen && <SyncDialog sync={sync} onClose={() => setSyncOpen(false)} />}
    </main>
  );
}
