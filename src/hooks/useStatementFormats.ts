// src/hooks/useStatementFormats.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import {
  StatementFormat,
  CreateStatementFormatRequest,
  UpdateStatementFormatRequest,
} from '@/types/statementFormat';
import { statementFormatApi } from '@/api/statementFormatApi';
import { ApiError } from '@/types/apiError';

/**
 * Query key factory for statement formats
 */
const statementFormatsKeys = {
  all: ['statement-formats'] as const,
  detail: (formatKey: string) => [...statementFormatsKeys.all, 'detail', formatKey] as const,
};

/**
 * Fetch the list of statement formats
 * Cached for 5 minutes since formats may change occasionally
 */
export const useStatementFormats = (): UseQueryResult<StatementFormat[], ApiError> => {
  return useQuery<StatementFormat[], ApiError>({
    queryKey: statementFormatsKeys.all,
    queryFn: () => statementFormatApi.listFormats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};

/**
 * Fetch a single statement format by formatKey
 * Used in admin edit forms
 */
export const useStatementFormat = (
  formatKey: string,
): UseQueryResult<StatementFormat, ApiError> => {
  return useQuery<StatementFormat, ApiError>({
    queryKey: statementFormatsKeys.detail(formatKey),
    queryFn: () => statementFormatApi.getFormat(formatKey),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: !!formatKey,
  });
};

/**
 * Create a new statement format
 * Admin mutation hook
 */
export const useCreateStatementFormat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStatementFormatRequest) => statementFormatApi.createFormat(data),
    onSuccess: async () => {
      // Invalidate all statement format queries
      await queryClient.invalidateQueries({ queryKey: statementFormatsKeys.all });
    },
  });
};

/**
 * Update an existing statement format
 * Admin mutation hook
 */
export const useUpdateStatementFormat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ formatKey, data }: { formatKey: string; data: UpdateStatementFormatRequest }) =>
      statementFormatApi.updateFormat(formatKey, data),
    onSuccess: async (updatedFormat) => {
      // Invalidate all statement format queries
      // Also invalidate the specific detail query to ensure fresh data in edit forms
      await queryClient.invalidateQueries({ queryKey: statementFormatsKeys.all });
      await queryClient.invalidateQueries({
        queryKey: statementFormatsKeys.detail(updatedFormat.formatKey),
      });
    },
  });
};
