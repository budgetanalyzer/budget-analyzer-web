// src/features/transactions/hooks/useImportMessageHandler.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { buildImportSuccessMessage } from '@/features/transactions/utils/messageBuilder';
import { formatApiError } from '@/utils/errorMessages';

interface ImportMessage {
  type: 'success' | 'error';
  text: string;
}

interface UseImportMessageHandlerParams {
  hasActiveFilters: () => boolean;
}

interface UseImportMessageHandlerReturn {
  importMessage: ImportMessage | null;
  handleImportSuccess: (count: number) => void;
  handleImportError: (error: { message?: string }) => void;
  clearImportMessage: () => void;
}

/**
 * Custom hook to handle import success/error messages with auto-dismiss functionality
 *
 * @param params Configuration including filter checker
 * @returns Object with import message state and handlers
 */
export function useImportMessageHandler({
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
    (count: number) => {
      // Build the success message
      const message = buildImportSuccessMessage({
        count,
        filtersActive: hasActiveFilters(),
      });

      setImportMessage(message);

      // Auto-dismiss success messages after 5 seconds
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        setImportMessage(null);
        timeoutRef.current = null;
      }, 5000);
    },
    [hasActiveFilters],
  );

  const handleImportError = useCallback((error: unknown) => {
    const message = formatApiError(error as Error, 'Failed to import transactions');

    setImportMessage({
      type: 'error',
      text: message,
    });
  }, []);

  return {
    importMessage,
    handleImportSuccess,
    handleImportError,
    clearImportMessage,
  };
}
