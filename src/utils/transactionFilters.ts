import type { Transaction } from '@/types/transaction';
import type { TransactionFilterValues } from '@/types/transactionFilters';
import { compareLocalDates } from '@/utils/dates';
import { filterTransactionsByTableSearch } from '@/utils/transactionSearch';

export function hasActiveTransactionFilters(filters: TransactionFilterValues): boolean {
  return Boolean(
    filters.globalFilter ||
      filters.dateFilter.from ||
      filters.dateFilter.to ||
      filters.bankNameFilter ||
      filters.accountIdFilter ||
      filters.typeFilter ||
      filters.amountFilter.min !== null ||
      filters.amountFilter.max !== null,
  );
}

export function filterTransactions<T extends Transaction>(
  transactions: T[],
  filters: TransactionFilterValues,
): T[] {
  let filtered = transactions;

  if (filters.dateFilter.from) {
    filtered = filtered.filter(
      (transaction) => compareLocalDates(transaction.date, filters.dateFilter.from!) >= 0,
    );
  }

  if (filters.dateFilter.to) {
    filtered = filtered.filter(
      (transaction) => compareLocalDates(transaction.date, filters.dateFilter.to!) <= 0,
    );
  }

  if (filters.globalFilter) {
    filtered = filterTransactionsByTableSearch(filtered, filters.globalFilter);
  }

  if (filters.bankNameFilter) {
    filtered = filtered.filter((transaction) => transaction.bankName === filters.bankNameFilter);
  }

  if (filters.accountIdFilter) {
    filtered = filtered.filter((transaction) => transaction.accountId === filters.accountIdFilter);
  }

  if (filters.typeFilter) {
    filtered = filtered.filter((transaction) => transaction.type === filters.typeFilter);
  }

  if (filters.amountFilter.min !== null) {
    filtered = filtered.filter(
      (transaction) => Math.abs(transaction.amount) >= filters.amountFilter.min!,
    );
  }

  if (filters.amountFilter.max !== null) {
    filtered = filtered.filter(
      (transaction) => Math.abs(transaction.amount) <= filters.amountFilter.max!,
    );
  }

  return filtered;
}
