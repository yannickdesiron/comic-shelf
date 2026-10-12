/**
 * Text folding for the shelf search.
 *
 * SQLite's LIKE only folds ASCII case, so "leonard" never matches "Léonard".
 * For a collection full of Franco-Belgian series that is the most common
 * search quietly returning nothing. We fold both sides of the comparison to
 * lowercase without diacritics, through the `unaccent` SQL function that
 * `createDb` registers.
 */

/** Lowercases and strips diacritics: "Léonard" and "LEONARD" both fold to "leonard". */
export function foldText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining marks left over from NFD
    .toLowerCase();
}

/**
 * Builds the pattern for a folded LIKE. `%` and `_` typed by the user are
 * literal characters, not wildcards: searching for "100%" should look for
 * "100%", and a lone "%" should find nothing rather than everything.
 *
 * Use with `escape '\'` in the query.
 */
export function likePattern(query: string): string {
  const escaped = foldText(query).replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${escaped}%`;
}

/**
 * ISBNs are stored without separators, but the number printed on the back of
 * an album has them. Returns the digits (and a trailing X) of a query that
 * looks like part of an ISBN, or null when it does not.
 */
export function isbnFragment(query: string): string | null {
  const stripped = query.replace(/[\s-]/g, "").toUpperCase();
  if (stripped.length < 4) return null;
  return /^\d+X?$/.test(stripped) ? stripped : null;
}
