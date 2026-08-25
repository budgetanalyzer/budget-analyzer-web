import { describe, expect, it } from 'vitest';
import { savedViewInvalidationKeys, transactionKeys, viewKeys } from '@/queryKeys';

describe('query key factories', () => {
  it('builds stable transaction and saved-view keys', () => {
    expect(transactionKeys.list()).toEqual(['transactions']);
    expect(transactionKeys.detail(42)).toEqual(['transaction', 42]);
    expect(transactionKeys.count()).toEqual(['transactionCount']);
    expect(viewKeys.list()).toEqual(['views', 'list']);
    expect(viewKeys.detail('view-1')).toEqual(['views', 'detail', 'view-1']);
    expect(viewKeys.membership('view-1')).toEqual(['views', 'transactions', 'view-1']);
  });

  it('defines rename and successful membership invalidation resources', () => {
    expect(savedViewInvalidationKeys.rename('view-1')).toEqual([
      viewKeys.list(),
      viewKeys.detail('view-1'),
    ]);
    expect(savedViewInvalidationKeys.membership('view-1')).toEqual([
      viewKeys.list(),
      viewKeys.detail('view-1'),
      viewKeys.membership('view-1'),
    ]);
  });

  it('adds the complete transaction snapshot for stale creation or addition', () => {
    expect(savedViewInvalidationKeys.staleCreation()).toEqual([
      transactionKeys.list(),
      viewKeys.list(),
    ]);
    expect(savedViewInvalidationKeys.staleAddition('view-1')).toEqual([
      transactionKeys.list(),
      viewKeys.list(),
      viewKeys.detail('view-1'),
      viewKeys.membership('view-1'),
    ]);
  });
});
