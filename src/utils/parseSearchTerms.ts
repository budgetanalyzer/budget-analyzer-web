// src/utils/parseSearchTerms.ts

/**
 * Parses a search query into individual terms for OR matching.
 *
 * Supports:
 * - Quoted phrases: "whole foods" matches that exact phrase
 * - Bare terms: groceries matches that word anywhere
 * - Multiple terms are OR'd together
 *
 * Examples:
 * - 'groceries' → ['groceries']
 * - '"whole foods" amazon' → ['whole foods', 'amazon']
 * - 'groceries amazon costco' → ['groceries', 'amazon', 'costco']
 *
 * Edge cases (by design):
 * - Unclosed quotes treated as literal: '"whole foods' → ['"whole', 'foods']
 * - Empty quotes ignored: '""' → []
 * - No escaping, no nested quotes, no regex
 */
export function parseSearchTerms(query: string): string[] {
  if (!query.trim()) return [];

  const regex = /"([^"]*)"|\S+/g;
  const terms: string[] = [];
  let match;

  while ((match = regex.exec(query)) !== null) {
    // match[1] is quoted content (without quotes), match[0] is full match
    const term = (match[1] ?? match[0]).trim().toLowerCase();
    if (term) {
      terms.push(term);
    }
  }

  return terms;
}
