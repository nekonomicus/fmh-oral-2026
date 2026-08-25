'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { phases, reserveGroups, type CaseItem } from '../study-data';

const STORAGE_KEY = 'fmh-oral-26-v1';
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

function readStore(): Record<string, unknown> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function completedFrom(stored: Record<string, unknown>) {
  const items = Array.isArray(stored.completed) ? stored.completed : [];
  return new Set(items.filter((item): item is string => typeof item === 'string'));
}

function readCompleted() {
  return completedFrom(readStore());
}

function clusterSpan(count: number) {
  if (count >= 14) return 12;
  if (count >= 7) return 6;
  return 4;
}

export default function MatrixClient() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const completedRef = useRef<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = readCompleted();
      completedRef.current = next;
      setCompleted(next);
    };
    const initialSync = window.setTimeout(() => {
      sync();
      setReady(true);
    }, 0);
    window.addEventListener('storage', sync);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggleCase = (id: string) => {
    if (!ready) return;
    const next = new Set(completedRef.current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    completedRef.current = next;
    setCompleted(next);
    const stored = readStore();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...stored,
      completed: [...next],
      daily: stored.daily && typeof stored.daily === 'object' && !Array.isArray(stored.daily) ? stored.daily : {},
      mocks: Array.isArray(stored.mocks) ? stored.mocks : [],
    }));
  };

  const doneCount = rawCases.filter((item) => completed.has(item.id)).length;
  const progress = Math.round((doneCount / rawCases.length) * 100);

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
        </div>
      </section>

      <nav className="matrix-nav" aria-label="Matrix sections">
        {sectors.map((sector) => <a key={sector.id} href={`#${sector.id}`}>{sector.label}</a>)}
      </nav>

      <section className="matrix-content">
        <div className="section-line"><span>RAW CASES</span><span>{rawCases.length} TOTAL</span></div>
        {sectors.map((sector) => {
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
                          return (
                            <button
                              type="button"
                              className={`matrix-tile ${item.title.length > 70 ? 'long' : ''} ${done ? 'done' : ''}`}
                              key={item.id}
                              onClick={() => toggleCase(item.id)}
                              disabled={!ready}
                              aria-pressed={done}
                              aria-label={`${item.title}. ${done ? 'Completed' : 'Not completed'}`}
                            >
                              <span className="matrix-case-title">{item.title}</span>
                              <span className="matrix-case-meta">{item.source} · {item.miller}</span>
                              <span className="matrix-status" aria-hidden="true">{done ? '✓' : ''}</span>
                            </button>
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

      <footer><span>CLICK TO UPDATE</span><span>{rawCases.length} HISTORICAL CASES · LIVE PROGRESS</span></footer>
    </main>
  );
}
