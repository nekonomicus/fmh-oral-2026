'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listTopicIdsWithImages, subscribeToTopicImageChanges } from './topic-images';
import {
  EMPTY_TRACKER_STATE,
  STORAGE_KEY,
  hasTrackerContent,
  mergeTrackerStates,
  readTrackerState,
  readTrackerUpdatedAt,
  writeTrackerState,
  type TrackerState,
} from './tracker-storage';
import {
  SyncError,
  fetchSnapshot,
  isSyncConfigKey,
  partnerOf,
  pushDoc,
  readSyncConfig,
  writeSyncConfig,
  type SyncConfig,
  type SyncDoc,
  type SyncErrorKind,
  type SyncSnapshot,
} from './sync';

export type SyncStatus = 'off' | 'syncing' | 'synced' | SyncErrorKind;

export type TrackerSync = {
  config: SyncConfig | null;
  status: SyncStatus;
  syncedAt: number | null;
  partner: SyncDoc | null;
  partnerDone: Set<string>;
  connect: (config: SyncConfig) => Promise<SyncStatus>;
  disconnect: () => void;
};

type Options = {
  /** Fills in derived data (today's assignments) without counting as an edit. */
  prepare?: (state: TrackerState) => TrackerState;
  onLoaded?: () => void;
};

const POLL_MS = 30_000;
const PUSH_DEBOUNCE_MS = 600;

export function useTracker({ prepare, onLoaded }: Options = {}) {
  const [tracker, setTracker] = useState<TrackerState>(EMPTY_TRACKER_STATE);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [imageTopics, setImageTopics] = useState<Set<string>>(new Set());
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('off');
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [partner, setPartner] = useState<SyncDoc | null>(null);

  const trackerRef = useRef<TrackerState>(EMPTY_TRACKER_STATE);
  const updatedAtRef = useRef(0);
  const dirtyRef = useRef(false);
  const configRef = useRef<SyncConfig | null>(null);
  const prepareRef = useRef(prepare);
  const onLoadedRef = useRef(onLoaded);
  const pushTimerRef = useRef<number | null>(null);
  const reconcilingRef = useRef<Promise<SyncStatus> | null>(null);

  useEffect(() => {
    prepareRef.current = prepare;
    onLoadedRef.current = onLoaded;
  }, [prepare, onLoaded]);

  const loadLocal = useCallback(() => {
    const loaded = readTrackerState();
    const prepared = prepareRef.current ? prepareRef.current(loaded) : loaded;
    let failed = false;
    if (prepared !== loaded) failed = !writeTrackerState(prepared);
    trackerRef.current = prepared;
    updatedAtRef.current = readTrackerUpdatedAt();
    dirtyRef.current = failed;
    setTracker(prepared);
    setSaveError(failed);
  }, []);

  useEffect(() => {
    const initialSync = window.setTimeout(() => {
      loadLocal();
      const config = readSyncConfig();
      configRef.current = config;
      setSyncConfig(config);
      setReady(true);
      onLoadedRef.current?.();
    }, 0);

    const syncFromStorage = (event: StorageEvent) => {
      if (isSyncConfigKey(event.key)) {
        const config = readSyncConfig();
        configRef.current = config;
        setSyncConfig(config);
      }
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      if (dirtyRef.current) return;
      loadLocal();
    };
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, [loadLocal]);

  useEffect(() => {
    let cancelled = false;
    const refreshImageTopics = () => {
      void listTopicIdsWithImages()
        .then((topicIds) => {
          if (!cancelled) setImageTopics(topicIds);
        })
        .catch(() => {
          // The note drawer reports image-storage errors without touching tracker data.
        });
    };
    refreshImageTopics();
    const unsubscribe = subscribeToTopicImageChanges(refreshImageTopics);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const adoptRemote = useCallback((doc: SyncDoc) => {
    const prepared = prepareRef.current ? prepareRef.current(doc.state) : doc.state;
    const saved = writeTrackerState(prepared, doc.updatedAt);
    trackerRef.current = prepared;
    updatedAtRef.current = doc.updatedAt;
    dirtyRef.current = !saved;
    setTracker(prepared);
    setSaveError(!saved);
  }, []);

  const applySnapshot = useCallback((config: SyncConfig, snapshot: SyncSnapshot) => {
    setPartner(snapshot[partnerOf(config.player)]);
    setSyncStatus('synced');
    setSyncedAt(Date.now());
  }, []);

  const pushLocal = useCallback(async (config: SyncConfig): Promise<SyncSnapshot> => {
    if (!updatedAtRef.current) {
      updatedAtRef.current = Date.now();
      writeTrackerState(trackerRef.current, updatedAtRef.current);
    }
    try {
      return await pushDoc(config, { state: trackerRef.current, updatedAt: updatedAtRef.current });
    } catch (error) {
      if (error instanceof SyncError && error.kind === 'conflict' && error.snapshot) {
        const mine = error.snapshot[config.player];
        if (mine) adoptRemote(mine);
        return error.snapshot;
      }
      throw error;
    }
  }, [adoptRemote]);

  const reconcile = useCallback((config: SyncConfig, mode: 'poll' | 'join'): Promise<SyncStatus> => {
    if (reconcilingRef.current) return reconcilingRef.current;
    const run = (async () => {
      setSyncStatus('syncing');
      try {
        let snapshot = await fetchSnapshot(config);
        const mine = snapshot[config.player];
        const local = trackerRef.current;
        if (mode === 'join' && mine && hasTrackerContent(local)) {
          // First connection from a device that already has entries: keep both sides.
          adoptRemote({ state: mergeTrackerStates(mine.state, local), updatedAt: Date.now() });
          snapshot = await pushLocal(config);
        } else if (mine && mine.updatedAt > updatedAtRef.current) {
          adoptRemote(mine);
        } else if (!mine || updatedAtRef.current > mine.updatedAt) {
          snapshot = await pushLocal(config);
        }
        if (configRef.current?.player !== config.player) return 'off';
        applySnapshot(config, snapshot);
        return 'synced';
      } catch (error) {
        const kind: SyncStatus = error instanceof SyncError ? error.kind : 'network';
        if (configRef.current) setSyncStatus(kind);
        return kind;
      } finally {
        reconcilingRef.current = null;
      }
    })();
    reconcilingRef.current = run;
    return run;
  }, [adoptRemote, applySnapshot, pushLocal]);

  useEffect(() => {
    if (!syncConfig) return;
    const config = syncConfig;
    const poll = () => {
      if (document.visibilityState === 'hidden') return;
      void reconcile(config, 'poll');
    };
    const interval = window.setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', poll);
    window.addEventListener('focus', poll);
    const kickoff = window.setTimeout(poll, 0);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', poll);
      window.removeEventListener('focus', poll);
    };
  }, [syncConfig, reconcile]);

  const schedulePush = useCallback(() => {
    const config = configRef.current;
    if (!config) return;
    if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);
    pushTimerRef.current = window.setTimeout(() => {
      pushTimerRef.current = null;
      setSyncStatus('syncing');
      pushLocal(config)
        .then((snapshot) => {
          if (configRef.current === config) applySnapshot(config, snapshot);
        })
        .catch((error: unknown) => {
          if (configRef.current === config) setSyncStatus(error instanceof SyncError ? error.kind : 'network');
        });
    }, PUSH_DEBOUNCE_MS);
  }, [applySnapshot, pushLocal]);

  const persist = useCallback((next: TrackerState) => {
    const updatedAt = Date.now();
    trackerRef.current = next;
    updatedAtRef.current = updatedAt;
    setTracker(next);
    const saved = writeTrackerState(next, updatedAt);
    dirtyRef.current = !saved;
    setSaveError(!saved);
    schedulePush();
  }, [schedulePush]);

  const mutate = useCallback((update: (current: TrackerState) => TrackerState) => {
    const current = dirtyRef.current ? trackerRef.current : readTrackerState();
    persist(update(current));
  }, [persist]);

  /** Replaces everything (restore from backup). */
  const replace = useCallback((next: TrackerState) => {
    persist(next);
  }, [persist]);

  const toggleCase = useCallback((id: string) => {
    mutate((current) => {
      const next = new Set(current.completed);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...current, completed: [...next] };
    });
  }, [mutate]);

  const toggleMock = useCallback((id: string) => {
    mutate((current) => {
      const next = new Set(current.mocks);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...current, mocks: [...next] };
    });
  }, [mutate]);

  const saveNote = useCallback((id: string, value: string) => {
    mutate((current) => {
      const notes = { ...current.notes };
      if (value.length > 0) notes[id] = value;
      else delete notes[id];
      return { ...current, notes };
    });
  }, [mutate]);

  const connect = useCallback(async (config: SyncConfig): Promise<SyncStatus> => {
    if (reconcilingRef.current) await reconcilingRef.current;
    configRef.current = config;
    const result = await reconcile(config, 'join');
    if (result === 'unauthorized' || result === 'unconfigured') {
      configRef.current = null;
      setSyncStatus('off');
      setPartner(null);
      return result;
    }
    writeSyncConfig(config);
    setSyncConfig(config);
    return result;
  }, [reconcile]);

  const disconnect = useCallback(() => {
    if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);
    pushTimerRef.current = null;
    configRef.current = null;
    writeSyncConfig(null);
    setSyncConfig(null);
    setPartner(null);
    setSyncStatus('off');
    setSyncedAt(null);
  }, []);

  const hasSavedNote = useCallback(
    (id: string) => Boolean(tracker.notes[id]?.trim()) || imageTopics.has(id),
    [tracker.notes, imageTopics],
  );

  const sync: TrackerSync = {
    config: syncConfig,
    status: syncConfig ? syncStatus : 'off',
    syncedAt,
    partner,
    partnerDone: new Set(partner?.state.completed ?? []),
    connect,
    disconnect,
  };

  return {
    tracker,
    trackerRef,
    ready,
    saveError,
    setSaveError,
    mutate,
    replace,
    toggleCase,
    toggleMock,
    saveNote,
    hasSavedNote,
    sync,
  };
}

export function syncStatusLabel(sync: TrackerSync, fallback = 'AUTO-SAVED ON THIS DEVICE') {
  if (!sync.config) return fallback;
  const who = sync.config.player.toUpperCase();
  switch (sync.status) {
    case 'syncing':
      return sync.syncedAt ? `SYNCED AS ${who} · UPDATING…` : `SYNCING AS ${who}…`;
    case 'synced':
      return `SYNCED AS ${who} · ${new Date(sync.syncedAt ?? Date.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    case 'unauthorized':
      return 'SYNC CODE REJECTED · RECONNECT';
    case 'unconfigured':
      return 'SYNC NOT SET UP ON SERVER · SAVED ON THIS DEVICE';
    case 'conflict':
    case 'network':
      return `OFFLINE AS ${who} · SAVED ON THIS DEVICE`;
    default:
      return fallback;
  }
}
