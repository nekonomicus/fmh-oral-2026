export const STORAGE_KEY = 'fmh-oral-26-v1';

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

export function writeTrackerState(next: TrackerState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
