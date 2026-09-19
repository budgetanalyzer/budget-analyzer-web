export type TransactionMetadataValue = string | null | undefined;

export const MISSING_TRANSACTION_METADATA = '—';

export function formatTransactionMetadata(value: TransactionMetadataValue): string {
  return value?.trim() ? value : MISSING_TRANSACTION_METADATA;
}

export function deriveTransactionMetadataFilterOptions(
  values: Iterable<TransactionMetadataValue>,
): string[] {
  const options = new Set<string>();

  for (const value of values) {
    if (value?.trim()) {
      options.add(value);
    }
  }

  return [...options].sort();
}
