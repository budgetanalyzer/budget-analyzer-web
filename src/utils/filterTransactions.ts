// src/utils/filterTransactions.ts
import { Transaction } from '@/types/transaction';
import { ViewCriteriaApi } from '@/types/view';
import { isDateInRange } from '@/utils/dates';

/**
 * Filters transactions based on view criteria
 * Uses the same logic as TransactionsPage to ensure consistency
 */
export function filterTransactionsByCriteria(
  transactions: Transaction[],
  criteria: ViewCriteriaApi,
): Transaction[] {
  let filtered = transactions;

  // Apply date filter
  if (criteria.startDate && criteria.endDate) {
    filtered = filtered.filter((transaction) =>
      isDateInRange(transaction.date, criteria.startDate!, criteria.endDate!),
    );
  }

  // Apply text search filter (supports quoted phrases and OR matching)
  if (criteria.searchText) {
    const searchTerms = criteria.searchText
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 0);

    if (searchTerms.length > 0) {
      filtered = filtered.filter((transaction) => {
        const description = transaction.description.toLowerCase();
        const bankName = transaction.bankName.toLowerCase();
        // OR: match if ANY term matches
        return searchTerms.some((term) => description.includes(term) || bankName.includes(term));
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
