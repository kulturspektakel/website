// Normalises a band name for forgiving comparison/search: folds diacritics
// (so a query "ubertreib" matches "Uebertreibhaus"), lowercases, turns
// punctuation/symbols into spaces (so "!Band!" -> "band"), and collapses
// whitespace. Used for the "played last year" matching and the Cmd+K search.
export function normalizeBandName(name: string): string {
  return name
    .normalize('NFD') // split base char + combining diacritics
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks (accents)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ') // punctuation/symbols -> space
    .trim()
    .replace(/\s+/g, ' ');
}
