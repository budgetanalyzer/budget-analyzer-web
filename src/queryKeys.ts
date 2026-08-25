export const transactionKeys = {
  all: ['transactions'] as const,
  list: () => transactionKeys.all,
  detail: (id: number) => ['transaction', id] as const,
  count: () => ['transactionCount'] as const,
};

export const viewKeys = {
  all: ['views'] as const,
  lists: () => [...viewKeys.all, 'list'] as const,
  list: () => viewKeys.lists(),
  details: () => [...viewKeys.all, 'detail'] as const,
  detail: (id: string) => [...viewKeys.details(), id] as const,
  membership: (id: string) => [...viewKeys.all, 'transactions', id] as const,
};

/**
 * Cache resources affected by each static saved-view mutation outcome.
 * Callers invalidate every returned key without retrying or rewriting request IDs.
 */
export const savedViewInvalidationKeys = {
  rename: (id: string) => [viewKeys.list(), viewKeys.detail(id)] as const,
  membership: (id: string) =>
    [viewKeys.list(), viewKeys.detail(id), viewKeys.membership(id)] as const,
  staleCreation: () => [transactionKeys.list(), viewKeys.list()] as const,
  staleAddition: (id: string) =>
    [transactionKeys.list(), ...savedViewInvalidationKeys.membership(id)] as const,
};
