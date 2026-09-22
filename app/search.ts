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
