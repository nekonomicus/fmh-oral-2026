import { isPlayerId, type PlayerId, type SharedFile, type FileIndex } from '../sync';
import { GITHUB_API, GITHUB_UPLOADS, githubHeaders } from './auth';

// Attachments live as release assets of one release ("attachments") in a private repo
// named by ATTACHMENTS_REPO (owner/name). Asset names carry the metadata:
//   <caseId>.<player>.<timestamp>.<original-name>

const RELEASE_TAG = 'attachments';
const INDEX_TTL_MS = 45_000;

type Asset = { id: number; name: string; size: number; content_type: string; created_at: string };
type Release = { id: number; tag_name: string };

type Store = { token: string; repo: string };

let releaseIdCache: number | null = null;
let assetsCache: { at: number; assets: Asset[] } | null = null;

export function filesStore(): Store | null {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.ATTACHMENTS_REPO;
  if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  return { token, repo };
}

async function api<T>(store: Store, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: githubHeaders(store.token, init.body ? { 'content-type': 'application/json' } : {}),
  });
  if (!response.ok) throw new Error(`GitHub responded ${response.status} for ${path}`);
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

async function ensureRelease(store: Store): Promise<number> {
  if (releaseIdCache) return releaseIdCache;
  const existing = await fetch(`${GITHUB_API}/repos/${store.repo}/releases/tags/${RELEASE_TAG}`, { headers: githubHeaders(store.token) });
  if (existing.ok) {
    releaseIdCache = ((await existing.json()) as Release).id;
    return releaseIdCache;
  }
  if (existing.status !== 404) throw new Error(`GitHub responded ${existing.status}`);
  // A release needs a commit to tag. Seed an empty repo with a README first.
  const head = await fetch(`${GITHUB_API}/repos/${store.repo}/contents/README.md`, { headers: githubHeaders(store.token) });
  if (head.status === 404) {
    await api(store, `/repos/${store.repo}/contents/README.md`, {
      method: 'PUT',
      body: JSON.stringify({
        message: 'Attachment store for the FMH oral tracker',
        content: Buffer.from('# fmh-oral-files\n\nAttachments for the FMH oral tracker live as release assets here.\n').toString('base64'),
      }),
    });
  }
  const created = await api<Release>(store, `/repos/${store.repo}/releases`, {
    method: 'POST',
    body: JSON.stringify({ tag_name: RELEASE_TAG, name: 'Attachments', body: 'Files attached from the tracker.', draft: false, prerelease: false }),
  });
  releaseIdCache = created.id;
  return created.id;
}

async function listAssets(store: Store, fresh = false): Promise<Asset[]> {
  if (!fresh && assetsCache && Date.now() - assetsCache.at < INDEX_TTL_MS) return assetsCache.assets;
  const releaseId = await ensureRelease(store);
  const assets: Asset[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const chunk = await api<Asset[]>(store, `/repos/${store.repo}/releases/${releaseId}/assets?per_page=100&page=${page}`);
    assets.push(...chunk);
    if (chunk.length < 100) break;
  }
  assetsCache = { at: Date.now(), assets };
  return assets;
}

function parseAsset(asset: Asset): SharedFile | null {
  const [caseId, player, stamp, ...rest] = asset.name.split('.');
  if (!caseId || !isPlayerId(player) || !stamp || rest.length === 0) return null;
  return {
    id: asset.id,
    caseId,
    player,
    name: rest.join('.'),
    size: asset.size,
    type: asset.content_type,
    createdAt: Date.parse(asset.created_at) || Number(stamp) || 0,
  };
}

export async function fileIndex(store: Store): Promise<FileIndex> {
  const index: FileIndex = {};
  for (const asset of await listAssets(store)) {
    const file = parseAsset(asset);
    if (!file) continue;
    const entry = index[file.caseId] ?? (index[file.caseId] = {});
    entry[file.player] = (entry[file.player] ?? 0) + 1;
  }
  return index;
}

export async function filesForCase(store: Store, caseId: string): Promise<SharedFile[]> {
  return (await listAssets(store, true))
    .map(parseAsset)
    .filter((file): file is SharedFile => file !== null && file.caseId === caseId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function safeFileName(name: string) {
  const cleaned = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return (cleaned || 'file').slice(0, 80);
}

export async function uploadFile(store: Store, caseId: string, player: PlayerId, name: string, type: string, body: ArrayBuffer): Promise<SharedFile> {
  const releaseId = await ensureRelease(store);
  const assetName = `${caseId}.${player}.${Date.now()}.${safeFileName(name)}`;
  const response = await fetch(`${GITHUB_UPLOADS}/repos/${store.repo}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`, {
    method: 'POST',
    headers: githubHeaders(store.token, { 'content-type': type || 'application/octet-stream', 'content-length': String(body.byteLength) }),
    body,
  });
  if (!response.ok) throw new Error(`GitHub upload responded ${response.status}`);
  assetsCache = null;
  const file = parseAsset((await response.json()) as Asset);
  if (!file) throw new Error('Uploaded asset has an unexpected name');
  return file;
}

export async function findFile(store: Store, id: number): Promise<SharedFile | null> {
  const cached = assetsCache?.assets.find((asset) => asset.id === id);
  const asset = cached ?? (await listAssets(store, true)).find((entry) => entry.id === id);
  return asset ? parseAsset(asset) : null;
}

export async function deleteFile(store: Store, id: number) {
  await api(store, `/repos/${store.repo}/releases/assets/${id}`, { method: 'DELETE' });
  assetsCache = null;
}

/** Short-lived direct download URL for an asset. */
export async function downloadUrl(store: Store, id: number): Promise<string> {
  const response = await fetch(`${GITHUB_API}/repos/${store.repo}/releases/assets/${id}`, {
    headers: githubHeaders(store.token, { accept: 'application/octet-stream' }),
    redirect: 'manual',
  });
  const location = response.headers.get('location');
  if (response.status >= 300 && response.status < 400 && location) return location;
  throw new Error(`GitHub download responded ${response.status}`);
}
