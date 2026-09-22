import { isPlayerId, normalizeSyncDoc, type FileIndex, type PlayerId, type SyncDoc, type SyncSnapshot } from '../../sync';
import { GITHUB_API, authorize, githubHeaders, json } from '../auth';
import { fileIndex, filesStore } from '../files-store';

// Two-player progress store. Each player owns one document; the newer timestamp wins.
// Data lives in a private Gist on the site owner's GitHub account, so no extra service is needed.
// Configure two env vars on the host:
//   GITHUB_TOKEN  a token with the "gist" scope
//   SYNC_CODE     the shared code both players enter in the app

export const dynamic = 'force-dynamic';

const GIST_DESCRIPTION = 'fmh-oral-26 sync · progress for Sam and Michael';
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const PLAYER_FILES: Record<PlayerId, string> = { sam: 'sam.json', michael: 'michael.json' };

type ServerConfig = { token: string; code: string };
type GistFile = { content?: string; truncated?: boolean; raw_url?: string };
type Gist = { id: string; description?: string; files: Record<string, GistFile | null> };

let gistIdCache: string | null = null;

function serverConfig(): ServerConfig | null {
  const token = process.env.GITHUB_TOKEN;
  const code = process.env.SYNC_CODE;
  if (!token || !code) return null;
  return { token, code };
}

async function github<T>(config: ServerConfig, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: githubHeaders(config.token, init.body ? { 'content-type': 'application/json' } : {}),
  });
  if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
  return response.json() as Promise<T>;
}

async function findGistId(config: ServerConfig): Promise<string> {
  if (gistIdCache) return gistIdCache;
  const gists = await github<Gist[]>(config, '/gists?per_page=100');
  const existing = gists.find((gist) => gist.description === GIST_DESCRIPTION);
  if (existing) {
    gistIdCache = existing.id;
    return existing.id;
  }
  const created = await github<Gist>(config, '/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      public: false,
      files: Object.fromEntries(Object.values(PLAYER_FILES).map((name) => [name, { content: 'null' }])),
    }),
  });
  gistIdCache = created.id;
  return created.id;
}

async function fileDoc(config: ServerConfig, file: GistFile | null | undefined): Promise<SyncDoc | null> {
  if (!file) return null;
  let content = file.content ?? '';
  if (file.truncated && file.raw_url) {
    const response = await fetch(file.raw_url, { headers: { authorization: `Bearer ${config.token}` } });
    if (!response.ok) throw new Error(`GitHub raw responded ${response.status}`);
    content = await response.text();
  }
  try {
    return normalizeSyncDoc(JSON.parse(content));
  } catch {
    return null;
  }
}

async function attachmentIndex(): Promise<FileIndex> {
  const store = filesStore();
  if (!store) return {};
  try {
    return await fileIndex(store);
  } catch {
    return {};
  }
}

async function readSnapshot(config: ServerConfig): Promise<SyncSnapshot> {
  const id = await findGistId(config);
  let gist: Gist;
  try {
    gist = await github<Gist>(config, `/gists/${id}`);
  } catch (error) {
    gistIdCache = null; // The gist may have been deleted; look it up again next time.
    throw error;
  }
  return {
    sam: await fileDoc(config, gist.files[PLAYER_FILES.sam]),
    michael: await fileDoc(config, gist.files[PLAYER_FILES.michael]),
    files: await attachmentIndex(),
  };
}

async function writeDoc(config: ServerConfig, player: PlayerId, doc: SyncDoc) {
  const id = await findGistId(config);
  await github<Gist>(config, `/gists/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [PLAYER_FILES[player]]: { content: JSON.stringify(doc) } } }),
  });
}

export async function GET(request: Request) {
  const config = serverConfig();
  if (!config || authorize(request) === null) return json({ error: 'unconfigured' }, 503);
  if (!authorize(request)) return json({ error: 'unauthorized' }, 401);
  try {
    return json({ snapshot: await readSnapshot(config) });
  } catch {
    return json({ error: 'store' }, 502);
  }
}

export async function PUT(request: Request) {
  const config = serverConfig();
  if (!config || authorize(request) === null) return json({ error: 'unconfigured' }, 503);
  if (!authorize(request)) return json({ error: 'unauthorized' }, 401);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'too-large' }, 413);
  let player: PlayerId;
  let doc: SyncDoc;
  try {
    const body = JSON.parse(raw) as { player?: unknown; doc?: unknown };
    const parsedDoc = normalizeSyncDoc(body.doc);
    if (!isPlayerId(body.player) || !parsedDoc) throw new Error('bad request');
    player = body.player;
    doc = parsedDoc;
  } catch {
    return json({ error: 'bad-request' }, 400);
  }

  try {
    const snapshot = await readSnapshot(config);
    const current = snapshot[player];
    if (current && current.updatedAt > doc.updatedAt) return json({ error: 'conflict', snapshot }, 409);
    await writeDoc(config, player, doc);
    return json({ snapshot: { ...snapshot, [player]: doc } });
  } catch {
    return json({ error: 'store' }, 502);
  }
}
