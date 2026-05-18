import { describe, expect, it } from 'vitest';
import uiReducer from '@/store/uiSlice';

describe('uiSlice', () => {
  it('keeps Redux scoped to global preferences', () => {
    const state = uiReducer(undefined, { type: '@@INIT' });

    expect(Object.keys(state).sort()).toEqual(['adminSidebarOpen', 'displayCurrency', 'theme']);
  });
});
