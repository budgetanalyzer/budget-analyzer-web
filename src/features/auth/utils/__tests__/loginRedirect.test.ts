import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildLoginRedirectUrl,
  navigateToLogin,
  replaceWithLogin,
} from '@/features/auth/utils/loginRedirect';

const assign = vi.fn();
const replace = vi.fn();

beforeEach(() => {
  assign.mockReset();
  replace.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      assign,
      origin: 'https://app.budgetanalyzer.localhost',
      replace,
    },
    writable: true,
  });
});

describe('loginRedirect', () => {
  it('preserves and encodes a safe local pathname, query string, and hash', () => {
    expect(buildLoginRedirectUrl('/transactions/42?view=recent&sort=desc#details')).toBe(
      '/oauth2/authorization/idp?returnUrl=%2Ftransactions%2F42%3Fview%3Drecent%26sort%3Ddesc%23details',
    );
  });

  it.each([
    'https://attacker.example/steal',
    '//attacker.example/steal',
    '/\\attacker.example/steal',
    'transactions/42',
  ])('rejects unsafe return URL %s', (returnUrl) => {
    expect(buildLoginRedirectUrl(returnUrl)).toBe('/oauth2/authorization/idp');
  });

  it('keeps explicit login actions available on every call', () => {
    navigateToLogin('/');
    navigateToLogin('/analytics');

    expect(assign).toHaveBeenNthCalledWith(1, '/oauth2/authorization/idp?returnUrl=%2F');
    expect(assign).toHaveBeenNthCalledWith(2, '/oauth2/authorization/idp?returnUrl=%2Fanalytics');
  });

  it('starts at most one automatic replace navigation per document', () => {
    replaceWithLogin('/analytics');
    replaceWithLogin('/transactions/42');

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/oauth2/authorization/idp?returnUrl=%2Fanalytics');
  });
});
