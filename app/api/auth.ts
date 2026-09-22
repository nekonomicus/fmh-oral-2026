// Shared request helpers for the API routes. Callers prove they are one of the two players
// by presenting the shared code, either as a bearer header or as the cookie set on connect.

export const SYNC_COOKIE = 'fmh_sync';

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
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

function presentedCode(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SYNC_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(SYNC_COOKIE.length + 1)) : '';
}

/** null when the server has no SYNC_CODE, false when the caller's code is wrong. */
export function authorize(request: Request): true | false | null {
  const code = process.env.SYNC_CODE;
  if (!code) return null;
  const presented = presentedCode(request);
  return presented.length > 0 && constantTimeEqual(presented, code);
}

export function githubHeaders(token: string, extra: Record<string, string> = {}) {
  return {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'fmh-oral-2026',
    ...extra,
  };
}

export const GITHUB_API = process.env.GITHUB_API_URL ?? 'https://api.github.com';
export const GITHUB_UPLOADS = process.env.GITHUB_UPLOADS_URL ?? 'https://uploads.github.com';
