import { isPlayerId, normalizeSyncDoc, type PlayerId, type SyncDoc, type SyncSnapshot } from '../../sync';

// Two-player progress store. Each player owns one document; the newer timestamp wins.
// Backed by Upstash Redis over REST so it runs on any host. Configure three env vars:
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, SYNC_CODE (shared code both players enter).

export const dynamic = 'force-dynamic';

const KEY_PREFIX = 'fmh-oral-26:';
const MAX_BODY_BYTES = 2 * 1024 * 1024;

type ServerConfig = { url: string; token: string; code: string };

function serverConfig(): ServerConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const code = process.env.SYNC_CODE;
  if (!url || !token || !code) return null;
  return { url: url.replace(/\/+$/, ''), token, code };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function constantTimeEqual(a: string, b: string) {
  const length = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function authorized(request: Request, config: ServerConfig) {
  const header = request.headers.get('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return presented.length > 0 && constantTimeEqual(presented, config.code);
}

async function redis(config: ServerConfig, commands: string[][]): Promise<unknown[]> {
  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!response.ok) throw new Error(`Redis responded ${response.status}`);
  const results = await response.json() as { result?: unknown; error?: string }[];
  return results.map((entry) => {
    if (entry.error) throw new Error(entry.error);
    return entry.result ?? null;
  });
}

function parseDoc(raw: unknown): SyncDoc | null {
  if (typeof raw !== 'string') return null;
  try {
    return normalizeSyncDoc(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function readSnapshot(config: ServerConfig): Promise<SyncSnapshot> {
  const [sam, michael] = await redis(config, [['GET', `${KEY_PREFIX}sam`], ['GET', `${KEY_PREFIX}michael`]]);
  return { sam: parseDoc(sam), michael: parseDoc(michael) };
}

export async function GET(request: Request) {
  const config = serverConfig();
  if (!config) return json({ error: 'unconfigured' }, 503);
  if (!authorized(request, config)) return json({ error: 'unauthorized' }, 401);
  try {
    return json({ snapshot: await readSnapshot(config) });
  } catch {
    return json({ error: 'store' }, 502);
  }
}

export async function PUT(request: Request) {
  const config = serverConfig();
  if (!config) return json({ error: 'unconfigured' }, 503);
  if (!authorized(request, config)) return json({ error: 'unauthorized' }, 401);

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
    await redis(config, [['SET', `${KEY_PREFIX}${player}`, JSON.stringify(doc)]]);
    return json({ snapshot: { ...snapshot, [player]: doc } });
  } catch {
    return json({ error: 'store' }, 502);
  }
}
