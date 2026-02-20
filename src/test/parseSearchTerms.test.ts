// src/test/parseSearchTerms.test.ts
import { describe, it, expect } from 'vitest';
import { parseSearchTerms } from '@/utils/parseSearchTerms';

describe('parseSearchTerms', () => {
  it('returns empty array for empty string', () => {
    expect(parseSearchTerms('')).toEqual([]);
    expect(parseSearchTerms('   ')).toEqual([]);
  });

  it('parses single term', () => {
    expect(parseSearchTerms('groceries')).toEqual(['groceries']);
  });

  it('parses multiple space-separated terms (OR)', () => {
    expect(parseSearchTerms('groceries amazon costco')).toEqual(['groceries', 'amazon', 'costco']);
  });

  it('parses quoted phrase as single term', () => {
    expect(parseSearchTerms('"whole foods"')).toEqual(['whole foods']);
  });

  it('parses mixed quoted phrases and bare terms', () => {
    expect(parseSearchTerms('"whole foods" groceries amazon')).toEqual([
      'whole foods',
      'groceries',
      'amazon',
    ]);
  });

  it('handles multiple quoted phrases', () => {
    expect(parseSearchTerms('"whole foods" "trader joe"')).toEqual(['whole foods', 'trader joe']);
  });

  it('lowercases all terms', () => {
    expect(parseSearchTerms('GROCERIES "Whole Foods"')).toEqual(['groceries', 'whole foods']);
  });

  it('ignores empty quotes', () => {
    expect(parseSearchTerms('"" groceries ""')).toEqual(['groceries']);
  });

  it('treats unclosed quote as literal characters', () => {
    // Unclosed quote: garbage in, garbage out
    expect(parseSearchTerms('"whole foods')).toEqual(['"whole', 'foods']);
  });

  it('handles extra whitespace', () => {
    expect(parseSearchTerms('  groceries   amazon  ')).toEqual(['groceries', 'amazon']);
  });
});
