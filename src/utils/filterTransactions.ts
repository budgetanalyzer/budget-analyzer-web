// src/utils/filterTransactions.ts
import { Transaction } from '@/types/transaction';
import { ViewCriteriaApi } from '@/types/view';
import { compareLocalDates } from '@/utils/dates';
import { parseSearchTerms } from '@/utils/parseSearchTerms';

/**
 * Filters transactions based on view criteria
 * Uses the saved-view API semantics so local view summaries match backend membership.
 */
export function filterTransactionsByCriteria(
  transactions: Transaction[],
  criteria: ViewCriteriaApi,
): Transaction[] {
  let filtered = transactions;

  // Apply date filter
  if (criteria.dateFrom) {
    filtered = filtered.filter(
      (transaction) => compareLocalDates(transaction.date, criteria.dateFrom!) >= 0,
    );
  }

  if (criteria.dateTo) {
    filtered = filtered.filter(
      (transaction) => compareLocalDates(transaction.date, criteria.dateTo!) <= 0,
    );
  }

  // Saved-view searchText matches transaction descriptions only.
  if (criteria.searchText) {
    const searchTerms = parseSearchTerms(criteria.searchText);

    if (searchTerms.length > 0) {
      filtered = filtered.filter((transaction) => {
        const description = transaction.description.toLowerCase();
        return searchTerms.some((term) => description.includes(term));
      });
    }
  }

  // Apply bank name filter
  if (criteria.bankNames && criteria.bankNames.length > 0) {
    filtered = filtered.filter((transaction) => criteria.bankNames!.includes(transaction.bankName));
  }

  // Apply currency filter
  if (criteria.currencyIsoCodes && criteria.currencyIsoCodes.length > 0) {
    filtered = filtered.filter((transaction) =>
      criteria.currencyIsoCodes!.includes(transaction.currencyIsoCode),
    );
  }

  // Apply account ID filter
  if (criteria.accountIds && criteria.accountIds.length > 0) {
    filtered = filtered.filter((transaction) =>
      criteria.accountIds!.includes(transaction.accountId),
    );
  }

  // Apply transaction type filter
  if (criteria.type) {
    filtered = filtered.filter((transaction) => transaction.type === criteria.type);
  }

  // Apply amount filter (min)
  if (criteria.minAmount !== undefined && criteria.minAmount !== null) {
    filtered = filtered.filter(
      (transaction) => Math.abs(transaction.amount) >= criteria.minAmount!,
    );
  }

  // Apply amount filter (max)
  if (criteria.maxAmount !== undefined && criteria.maxAmount !== null) {
    filtered = filtered.filter(
      (transaction) => Math.abs(transaction.amount) <= criteria.maxAmount!,
    );
  }

  return filtered;
}
