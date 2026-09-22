import { phases, reserveGroups, sideChapters, type CaseItem } from '../../study-data';

// Smart search: asks Gemini which cases match a free-text query (synonyms, German/English,
// clinical descriptions). The instant local text search stays the first pass; this adds to it.
// Env vars: GEMINI_API_KEY (required), GEMINI_MODEL (optional), SYNC_CODE (callers must send it).

export const dynamic = 'force-dynamic';

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const MAX_QUERY_CHARS = 200;
const MAX_RESULTS = 15;
const CACHE_LIMIT = 300;

const allCases: CaseItem[] = [
  ...phases.flatMap((phase) => phase.items),
  ...reserveGroups.flatMap((group) => group.items),
  ...sideChapters,
];
const caseList = allCases.map((item, index) => `${index + 1} | ${item.title} | ${item.source} | ${item.miller}`).join('\n');
const SYSTEM_PROMPT = 'You match a search query to orthopaedic oral-exam case titles (German and English, clinical shorthand). '
  + `Return a JSON array of the matching case numbers, most relevant first, at most ${MAX_RESULTS}. `
  + 'Match on meaning: anatomy, injury type, classification names, procedures, typical patient stories. '
  + 'Only include cases clearly relevant to the query; return [] when nothing fits.';

const cache = new Map<string, string[]>();

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

function authorized(request: Request, code: string) {
  const header = request.headers.get('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return presented.length > 0 && constantTimeEqual(presented, code);
}

async function askGemini(apiKey: string, model: string, query: string): Promise<string[]> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: `CASES:\n${caseList}\n\nQUERY: ${query}` }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: { type: 'ARRAY', items: { type: 'INTEGER' } },
      },
    }),
  });
  if (!response.ok) throw new Error(`Gemini responded ${response.status}`);
  const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  const numbers = JSON.parse(text) as unknown;
  if (!Array.isArray(numbers)) return [];
  const ids: string[] = [];
  for (const value of numbers) {
    const index = typeof value === 'number' ? Math.round(value) - 1 : -1;
    const item = allCases[index];
    if (item && !ids.includes(item.id)) ids.push(item.id);
    if (ids.length >= MAX_RESULTS) break;
  }
  return ids;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  const code = process.env.SYNC_CODE;
  if (!apiKey || !code) return json({ error: 'unconfigured' }, 503);
  if (!authorized(request, code)) return json({ error: 'unauthorized' }, 401);

  let query = '';
  try {
    const body = await request.json() as { query?: unknown };
    query = typeof body.query === 'string' ? body.query.trim().slice(0, MAX_QUERY_CHARS) : '';
  } catch {
    return json({ error: 'bad-request' }, 400);
  }
  if (query.length < 3) return json({ ids: [] });

  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached) return json({ ids: cached, cached: true });

  try {
    const ids = await askGemini(apiKey, process.env.GEMINI_MODEL || DEFAULT_MODEL, query);
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
    cache.set(key, ids);
    return json({ ids });
  } catch {
    return json({ error: 'upstream' }, 502);
  }
}
