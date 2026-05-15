import { Transaction } from '@/types/transaction';
import { parseSearchTerms } from '@/utils/parseSearchTerms';

export function filterTransactionsByTableSearch<
  T extends Pick<Transaction, 'description' | 'bankName'>,
>(transactions: T[], searchText: string): T[] {
  const searchTerms = parseSearchTerms(searchText);

  if (searchTerms.length === 0) {
    return transactions;
  }

  return transactions.filter((transaction) => {
    const description = transaction.description.toLowerCase();
    const bankName = transaction.bankName.toLowerCase();

    return searchTerms.some((term) => description.includes(term) || bankName.includes(term));
  });
}
