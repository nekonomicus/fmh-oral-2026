import { normalizeTrackerState, type TrackerState } from './tracker-storage';

export type PlayerId = 'sam' | 'michael';

export const PLAYERS: { id: PlayerId; label: string; initial: string }[] = [
  { id: 'sam', label: 'SAM', initial: 'S' },
  { id: 'michael', label: 'MICHAEL', initial: 'M' },
];

export function isPlayerId(value: unknown): value is PlayerId {
  return PLAYERS.some((player) => player.id === value);
}

export function playerLabel(id: PlayerId) {
  return PLAYERS.find((player) => player.id === id)?.label ?? id.toUpperCase();
}

export function partnerOf(id: PlayerId): PlayerId {
  return id === 'sam' ? 'michael' : 'sam';
}

export type SyncDoc = { state: TrackerState; updatedAt: number };
/** Per case: how many shared files each player attached. */
export type FileIndex = Record<string, Partial<Record<PlayerId, number>>>;
export type SyncSnapshot = Record<PlayerId, SyncDoc | null> & { files: FileIndex };
export type SharedFile = {
  id: number;
  caseId: string;
  player: PlayerId;
  name: string;
  size: number;
  type: string;
  createdAt: number;
};
export type SyncConfig = { player: PlayerId; code: string };
export type SyncErrorKind = 'unauthorized' | 'unconfigured' | 'network' | 'conflict';

const CONFIG_KEY = 'fmh-oral-26-sync';
const ENDPOINT = '/api/sync';

export class SyncError extends Error {
  kind: SyncErrorKind;
  snapshot: SyncSnapshot | null;

  constructor(kind: SyncErrorKind, snapshot: SyncSnapshot | null = null) {
    super(kind);
    this.kind = kind;
    this.snapshot = snapshot;
  }
}

export function normalizeSyncDoc(value: unknown): SyncDoc | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<SyncDoc>;
  if (typeof candidate.updatedAt !== 'number' || !Number.isFinite(candidate.updatedAt)) return null;
  return { state: normalizeTrackerState(candidate.state), updatedAt: candidate.updatedAt };
}

export function normalizeFileIndex(value: unknown): FileIndex {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const index: FileIndex = {};
  for (const [caseId, counts] of Object.entries(value as Record<string, unknown>)) {
    if (!counts || typeof counts !== 'object') continue;
    const entry: Partial<Record<PlayerId, number>> = {};
    for (const player of PLAYERS) {
      const count = (counts as Record<string, unknown>)[player.id];
      if (typeof count === 'number' && count > 0) entry[player.id] = count;
    }
    if (Object.keys(entry).length > 0) index[caseId] = entry;
  }
  return index;
}

export function normalizeSnapshot(value: unknown): SyncSnapshot {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return { sam: normalizeSyncDoc(source.sam), michael: normalizeSyncDoc(source.michael), files: normalizeFileIndex(source.files) };
}

const SYNC_COOKIE = 'fmh_sync';

/** Lets <img> and download links authenticate without a header. */
export function setSyncCookie(code: string | null) {
  try {
    document.cookie = code
      ? `${SYNC_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=31536000; SameSite=Lax`
      : `${SYNC_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // Cookies blocked: file previews will not load, everything else works.
  }
}

export function normalizeSharedFile(value: unknown): SharedFile | null {
  if (!value || typeof value !== 'object') return null;
  const file = value as Partial<SharedFile>;
  if (typeof file.id !== 'number' || typeof file.caseId !== 'string' || !isPlayerId(file.player) || typeof file.name !== 'string') return null;
  return {
    id: file.id,
    caseId: file.caseId,
    player: file.player,
    name: file.name,
    size: typeof file.size === 'number' ? file.size : 0,
    type: typeof file.type === 'string' ? file.type : 'application/octet-stream',
    createdAt: typeof file.createdAt === 'number' ? file.createdAt : 0,
  };
}

async function filesRequest(config: SyncConfig, query: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`/api/files?${query}`, {
      ...init,
      cache: 'no-store',
      headers: { authorization: `Bearer ${config.code}`, ...(init.headers ?? {}) },
    });
  } catch {
    throw new SyncError('network');
  }
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (response.status === 401) throw new SyncError('unauthorized');
  if (response.status === 503) throw new SyncError('unconfigured');
  if (response.status === 413) throw new Error('FILE IS TOO LARGE · 40 MB MAX');
  if (response.status === 415) throw new Error('USE AN IMAGE, PDF, OR PPTX');
  if (!response.ok || !body) throw new SyncError('network');
  return body;
}

export async function listSharedFiles(config: SyncConfig, caseId: string): Promise<SharedFile[]> {
  const body = await filesRequest(config, `case=${encodeURIComponent(caseId)}`);
  return Array.isArray(body.files) ? body.files.map(normalizeSharedFile).filter((file): file is SharedFile => file !== null) : [];
}

export async function uploadSharedFile(config: SyncConfig, caseId: string, name: string, type: string, blob: Blob): Promise<SharedFile> {
  const query = `case=${encodeURIComponent(caseId)}&player=${config.player}&name=${encodeURIComponent(name)}`;
  const body = await filesRequest(config, query, { method: 'POST', headers: { 'content-type': type }, body: blob });
  const file = normalizeSharedFile(body.file);
  if (!file) throw new SyncError('network');
  return file;
}

export async function deleteSharedFile(config: SyncConfig, id: number) {
  await filesRequest(config, `id=${id}&player=${config.player}`, { method: 'DELETE' });
}

export function sharedFileUrl(id: number) {
  return `/api/files?id=${id}`;
}

export function readSyncConfig(): SyncConfig | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null') as Partial<SyncConfig> | null;
    if (!parsed || !isPlayerId(parsed.player) || typeof parsed.code !== 'string' || !parsed.code) return null;
    return { player: parsed.player, code: parsed.code };
  } catch {
    return null;
  }
}

export function writeSyncConfig(config: SyncConfig | null) {
  try {
    if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    // The connection still works for this page load; it just will not be remembered.
  }
}

export function isSyncConfigKey(key: string | null) {
  return key === null || key === CONFIG_KEY;
}

async function request(config: SyncConfig, init: RequestInit): Promise<SyncSnapshot> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      ...init,
      cache: 'no-store',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.code}`, ...(init.headers ?? {}) },
    });
  } catch {
    throw new SyncError('network');
  }
  const body = await response.json().catch(() => null) as { snapshot?: unknown; error?: string } | null;
  if (response.status === 401) throw new SyncError('unauthorized');
  if (response.status === 503) throw new SyncError('unconfigured');
  if (response.status === 409) throw new SyncError('conflict', normalizeSnapshot(body?.snapshot));
  if (!response.ok || !body) throw new SyncError('network');
  return normalizeSnapshot(body.snapshot);
}

export function fetchSnapshot(config: SyncConfig) {
  return request(config, { method: 'GET' });
}

export function pushDoc(config: SyncConfig, doc: SyncDoc) {
  return request(config, { method: 'PUT', body: JSON.stringify({ player: config.player, doc }) });
}

/** Visual state of a case: left half is Michael, right half is Sam, full when both are done. */
export type TileState = 'none' | 'done' | 'half-sam' | 'half-michael';

export function tileState(mine: boolean, partner: boolean, player: PlayerId | null): TileState {
  if (!player) return mine ? 'done' : 'none';
  if (mine && partner) return 'done';
  if (mine) return `half-${player}`;
  if (partner) return `half-${partnerOf(player)}`;
  return 'none';
}
