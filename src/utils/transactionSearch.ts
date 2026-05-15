import type { Transaction } from '@/types/transaction';

export function filterTransactionsByTableSearch<T extends Pick<Transaction, 'description'>>(
  transactions: T[],
  searchText: string,
): T[] {
  const query = searchText.trim().toLowerCase();

  if (!query) {
    return transactions;
  }

  return transactions.filter((transaction) =>
    transaction.description.toLowerCase().includes(query),
  );
}
