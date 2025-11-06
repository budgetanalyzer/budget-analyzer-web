// src/hooks/useImportMessageHandler.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { Transaction } from '@/types/transaction';
import { buildImportSuccessMessage } from '@/lib/importMessageBuilder';

interface ImportMessage {
  type: 'success' | 'error' | 'warning';
  text: string;
}

interface UseImportMessageHandlerParams {
  earliestExchangeRateDate: string | null;
  earliestRateText: string;
  hasActiveFilters: () => boolean;
}

interface UseImportMessageHandlerReturn {
  importMessage: ImportMessage | null;
  handleImportSuccess: (count: number, importedTransactions: Transaction[]) => void;
  handleImportError: (error: { message?: string }) => void;
  clearImportMessage: () => void;
}

/**
 * Custom hook to handle import success/error messages with auto-dismiss functionality
 *
 * @param params Configuration including earliest exchange rate date, rate text, and filter checker
 * @returns Object with import message state and handlers
 */
export function useImportMessageHandler({
  earliestExchangeRateDate,
  earliestRateText,
  hasActiveFilters,
}: UseImportMessageHandlerParams): UseImportMessageHandlerReturn {
  const [importMessage, setImportMessage] = useState<ImportMessage | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const clearImportMessage = useCallback(() => {
    setImportMessage(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleImportSuccess = useCallback(
    (count: number, importedTransactions: Transaction[]) => {
      // Check if any transactions are older than our earliest exchange rate
      // Optimization: Find earliest transaction in O(n) instead of sorting O(n log n)
      let hasOldTransactions = false;

      if (earliestExchangeRateDate && importedTransactions.length > 0) {
        // Find the earliest transaction using reduce (O(n))
        const earliestTransaction = importedTransactions.reduce((earliest, current) =>
          current.date < earliest.date ? current : earliest,
        );

        // Only need to check the earliest transaction
        hasOldTransactions = earliestTransaction.date < earliestExchangeRateDate;
      }

      // Build the success message based on conditions
      const message = buildImportSuccessMessage({
        count,
        hasOldTransactions,
        earliestRateText,
        filtersActive: hasActiveFilters(),
      });

      setImportMessage(message);

      // Auto-dismiss success messages (but not warnings)
      if (message.type === 'success') {
        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        // Set new timeout
        timeoutRef.current = setTimeout(() => {
          setImportMessage(null);
          timeoutRef.current = null;
        }, 5000);
      }
    },
    [earliestExchangeRateDate, earliestRateText, hasActiveFilters],
  );

  const handleImportError = useCallback((error: { message?: string }) => {
    setImportMessage({
      type: 'error',
      text: error.message || 'Failed to import transactions',
    });
  }, []);

  return {
    importMessage,
    handleImportSuccess,
    handleImportError,
    clearImportMessage,
  };
}
