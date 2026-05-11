// src/features/transactions/utils/messageBuilder.ts

export interface ImportSuccessMessageParams {
  created: number;
  duplicatesSkipped: number;
  duplicatesImported: number;
  filtersActive: boolean;
}

export interface ImportSuccessMessage {
  type: 'success';
  text: string;
}

function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Builds a success message for transaction imports.
 *
 * @param params - Parameters for building the message
 * @returns An object containing the message type and text
 */
export function buildImportSuccessMessage({
  created,
  duplicatesSkipped,
  duplicatesImported,
  filtersActive,
}: ImportSuccessMessageParams): ImportSuccessMessage {
  const duplicateImportText =
    duplicatesImported > 0 ? `, including ${formatCount(duplicatesImported, 'duplicate')}` : '';
  const skippedDuplicateText =
    duplicatesSkipped > 0 ? ` Skipped ${formatCount(duplicatesSkipped, 'duplicate')}.` : '';
  const baseMessage = `Successfully imported ${formatCount(
    created,
    'transaction',
  )}${duplicateImportText}.${skippedDuplicateText}`;

  const filterWarning = filtersActive
    ? '  Some may be hidden by your current filters, [Clear filters] to see all.'
    : '';

  return {
    type: 'success',
    text: `${baseMessage}${filterWarning}`,
  };
}
