import { isPlayerId } from '../../sync';
import { authorize, json } from '../auth';
import { deleteFile, downloadUrl, fileIndex, filesForCase, filesStore, findFile, uploadFile } from '../files-store';

export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 40 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
const CASE_ID = /^[a-z-]+-\d{2}$/;

function gate(request: Request) {
  const auth = authorize(request);
  if (auth === null) return json({ error: 'unconfigured' }, 503);
  if (!auth) return json({ error: 'unauthorized' }, 401);
  const store = filesStore();
  if (!store) return json({ error: 'unconfigured' }, 503);
  return store;
}

export async function GET(request: Request) {
  const store = gate(request);
  if (store instanceof Response) return store;
  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  const caseId = url.searchParams.get('case');
  try {
    if (id) {
      const file = await findFile(store, id);
      if (!file) return json({ error: 'not-found' }, 404);
      return Response.redirect(await downloadUrl(store, id), 302);
    }
    if (caseId) {
      if (!CASE_ID.test(caseId)) return json({ error: 'bad-request' }, 400);
      return json({ files: await filesForCase(store, caseId) });
    }
    return json({ index: await fileIndex(store) });
  } catch {
    return json({ error: 'store' }, 502);
  }
}

export async function POST(request: Request) {
  const store = gate(request);
  if (store instanceof Response) return store;
  const url = new URL(request.url);
  const caseId = url.searchParams.get('case') ?? '';
  const player = url.searchParams.get('player');
  const name = url.searchParams.get('name') ?? 'file';
  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!CASE_ID.test(caseId) || !isPlayerId(player)) return json({ error: 'bad-request' }, 400);
  if (!ALLOWED_TYPES.has(type)) return json({ error: 'unsupported-type' }, 415);
  const declared = Number(request.headers.get('content-length'));
  if (declared > MAX_FILE_BYTES) return json({ error: 'too-large' }, 413);
  const body = await request.arrayBuffer();
  if (body.byteLength === 0) return json({ error: 'bad-request' }, 400);
  if (body.byteLength > MAX_FILE_BYTES) return json({ error: 'too-large' }, 413);
  try {
    return json({ file: await uploadFile(store, caseId, player, name, type, body) }, 201);
  } catch {
    return json({ error: 'store' }, 502);
  }
}

export async function DELETE(request: Request) {
  const store = gate(request);
  if (store instanceof Response) return store;
  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  const player = url.searchParams.get('player');
  if (!id || !isPlayerId(player)) return json({ error: 'bad-request' }, 400);
  try {
    const file = await findFile(store, id);
    if (!file) return json({ error: 'not-found' }, 404);
    if (file.player !== player) return json({ error: 'forbidden' }, 403);
    await deleteFile(store, id);
    return json({ ok: true });
  } catch {
    return json({ error: 'store' }, 502);
  }
}
