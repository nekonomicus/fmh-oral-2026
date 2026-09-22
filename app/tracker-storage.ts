export const STORAGE_KEY = 'fmh-oral-26-v1';
const UPDATED_KEY = 'fmh-oral-26-v1-updated';

export type TrackerState = {
  completed: string[];
  daily: Record<string, string[]>;
  mocks: string[];
  notes: Record<string, string>;
};

export const EMPTY_TRACKER_STATE: TrackerState = {
  completed: [],
  daily: {},
  mocks: [],
  notes: {},
};

export function normalizeTrackerState(value: unknown): TrackerState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY_TRACKER_STATE;
  const candidate = value as Partial<TrackerState>;
  const daily = candidate.daily && typeof candidate.daily === 'object' && !Array.isArray(candidate.daily)
    ? Object.fromEntries(Object.entries(candidate.daily)
      .filter(([, items]) => Array.isArray(items))
      .map(([key, items]) => [key, (items as unknown[]).filter((item): item is string => typeof item === 'string')]))
    : {};
  const notes = candidate.notes && typeof candidate.notes === 'object' && !Array.isArray(candidate.notes)
    ? Object.fromEntries(Object.entries(candidate.notes).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : {};

  return {
    completed: Array.isArray(candidate.completed) ? candidate.completed.filter((item): item is string => typeof item === 'string') : [],
    daily,
    mocks: Array.isArray(candidate.mocks) ? candidate.mocks.filter((item): item is string => typeof item === 'string') : [],
    notes,
  };
}

export function hasTrackerContent(state: TrackerState) {
  return state.completed.length > 0 || state.mocks.length > 0 || Object.keys(state.notes).length > 0;
}

/** Union of two states. Used once when a device first joins a player that already has cloud data. */
export function mergeTrackerStates(base: TrackerState, extra: TrackerState): TrackerState {
  const daily = { ...base.daily };
  for (const [day, items] of Object.entries(extra.daily)) {
    daily[day] = [...new Set([...(daily[day] ?? []), ...items])];
  }
  const notes = { ...base.notes };
  for (const [id, text] of Object.entries(extra.notes)) {
    if (!text.trim()) continue;
    const existing = notes[id]?.trim();
    if (!existing) notes[id] = text;
    else if (existing !== text.trim() && !existing.includes(text.trim())) notes[id] = `${notes[id].trimEnd()}\n\n${text}`;
  }
  return {
    completed: [...new Set([...base.completed, ...extra.completed])],
    daily,
    mocks: [...new Set([...base.mocks, ...extra.mocks])],
    notes,
  };
}

export function isTrackerBackup(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const notesAreValid = candidate.notes === undefined
    || (candidate.notes !== null && typeof candidate.notes === 'object' && !Array.isArray(candidate.notes));

  return Array.isArray(candidate.completed)
    && candidate.daily !== null
    && typeof candidate.daily === 'object'
    && !Array.isArray(candidate.daily)
    && Array.isArray(candidate.mocks)
    && notesAreValid;
}

export function readTrackerState(): TrackerState {
  try {
    return normalizeTrackerState(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return EMPTY_TRACKER_STATE;
  }
}

/** Millisecond timestamp of the last local edit; 0 when unknown (pre-sync data). */
export function readTrackerUpdatedAt(): number {
  try {
    const value = Number(localStorage.getItem(UPDATED_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function writeTrackerState(next: TrackerState, updatedAt?: number): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (updatedAt !== undefined) localStorage.setItem(UPDATED_KEY, String(updatedAt));
    return true;
  } catch {
    return false;
  }
}
