/**
 * Normalizes a string for search matching:
 * - Unicode NFKD decomposition + lowercase
 * - Strips Arabic diacritics (U+064B–U+065F, U+0670) and tatweel (U+0640)
 * - Unifies Arabic letter variants (أ إ آ ٱ -> ا, ى -> ي, ة -> ه)
 * - Collapses multiple spaces into single space & trims
 * - Ethiopic/Amharic text matches as typed
 */
export function normalizeForSearch(str) {
  if (typeof str !== 'string') return '';

  return str
    .normalize('NFKD')
    .toLowerCase()
    // Strip Arabic diacritics (Tashkeel) and Tatweel
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    // Unify Arabic alef variants: أ إ آ ٱ -> ا
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    // Unify Arabic alef maqsura to ya: ى -> ي
    .replace(/\u0649/g, '\u064A')
    // Unify Arabic ta marbuta to ha: ة -> ه
    .replace(/\u0629/g, '\u0647')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Multi-word AND search matcher.
 * Returns true if ALL query words match at least one of the item fields.
 * Never uses RegExp constructed from raw user input!
 */
export function matchSearchQuery(item, query, fieldExtractors = []) {
  if (!query || !query.trim()) return true;

  const normalizedQuery = normalizeForSearch(query);
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  if (queryTokens.length === 0) return true;

  // Extract and normalize all searchable string values from item
  const searchableTexts = fieldExtractors
    .map((fn) => {
      try {
        return normalizeForSearch(fn(item) || '');
      } catch {
        return '';
      }
    })
    .filter(Boolean);

  // Every query token must appear in at least one searchable text (AND condition)
  return queryTokens.every((token) =>
    searchableTexts.some((text) => text.includes(token))
  );
}
