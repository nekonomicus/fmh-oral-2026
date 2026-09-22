import type { CaseItem } from './study-data';

export function normalizeSearch(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss');
}

export function searchTerms(query: string) {
  return normalizeSearch(query).split(/\s+/).filter(Boolean);
}

export function matchesSearch(item: CaseItem, note: string | undefined, terms: string[]) {
  if (terms.length === 0) return true;
  const haystack = normalizeSearch(`${item.title} ${item.source} ${item.miller} ${note ?? ''}`);
  return terms.every((term) => haystack.includes(term));
}

/** Asks the server's Gemini-backed search for semantically matching case ids. */
export async function smartSearch(query: string, code: string, signal?: AbortSignal): Promise<string[]> {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${code}` },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!response.ok) throw new Error(`Search responded ${response.status}`);
  const body = await response.json() as { ids?: unknown };
  return Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
}
