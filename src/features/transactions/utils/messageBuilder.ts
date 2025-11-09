// src/features/transactions/utils/messageBuilder.ts

export interface ImportSuccessMessageParams {
  count: number;
  filtersActive: boolean;
}

export interface ImportSuccessMessage {
  type: 'success';
  text: string;
}

/**
 * Builds a success message for transaction imports.
 *
 * @param params - Parameters for building the message
 * @returns An object containing the message type and text
 */
export function buildImportSuccessMessage({
  count,
  filtersActive,
}: ImportSuccessMessageParams): ImportSuccessMessage {
  const baseMessage = `Successfully imported ${count} transaction(s)`;

  const filterWarning = filtersActive
    ? '  Some may be hidden by your current filters, [Clear filters] to see all.'
    : '';

  return {
    type: 'success',
    text: `${baseMessage}.${filterWarning}`,
  };
}
