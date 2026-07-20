import type { TransactionType } from '@/types/transaction';

export interface TransactionFilterValues {
  globalFilter: string;
  dateFilter: {
    from: string | null;
    to: string | null;
  };
  bankNameFilter: string | null;
  accountIdFilter: string | null;
  typeFilter: TransactionType | null;
  amountFilter: {
    min: number | null;
    max: number | null;
  };
}
