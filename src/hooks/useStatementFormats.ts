// src/hooks/useStatementFormats.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import {
  StatementFormat,
  CreateStatementFormatRequest,
  StatementFormatListOptions,
  UpdateStatementFormatRequest,
} from '@/types/statementFormat';
import { statementFormatApi } from '@/api/statementFormatApi';
import { ApiError } from '@/types/apiError';

/**
 * Query key factory for statement formats
 */
export const statementFormatsKeys = {
  all: ['statement-formats'] as const,
  list: (options?: StatementFormatListOptions) =>
    [
      ...statementFormatsKeys.all,
      'list',
      { includeHidden: Boolean(options?.includeHidden) },
    ] as const,
  detail: (id: number) => [...statementFormatsKeys.all, 'detail', id] as const,
};

/**
 * Fetch the list of statement formats
 * Cached for 5 minutes since formats may change occasionally
 */
export const useStatementFormats = (
  options?: StatementFormatListOptions,
): UseQueryResult<StatementFormat[], ApiError> => {
  return useQuery<StatementFormat[], ApiError>({
    queryKey: statementFormatsKeys.list(options),
    queryFn: () => statementFormatApi.listFormats(options),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};

/**
 * Fetch a single statement format by ID
 * Used in admin edit forms
 */
export const useStatementFormat = (id?: number): UseQueryResult<StatementFormat, ApiError> => {
  return useQuery<StatementFormat, ApiError>({
    queryKey:
      id === undefined ? [...statementFormatsKeys.all, 'detail'] : statementFormatsKeys.detail(id),
    queryFn: () => {
      if (id === undefined) {
        throw new Error('Statement format ID is required');
      }
      return statementFormatApi.getFormat(id);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: id !== undefined,
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
    mutationFn: ({ id, data }: { id: number; data: UpdateStatementFormatRequest }) =>
      statementFormatApi.updateFormat(id, data),
    onSuccess: async (updatedFormat) => {
      // Invalidate all statement format queries
      // Also invalidate the specific detail query to ensure fresh data in edit forms
      await queryClient.invalidateQueries({ queryKey: statementFormatsKeys.all });
      await queryClient.invalidateQueries({
        queryKey: statementFormatsKeys.detail(updatedFormat.id),
      });
    },
  });
};

/**
 * Hide a statement format from the current user's normal import lists
 */
export const useHideStatementFormat = () => {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (id) => statementFormatApi.hideFormat(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: statementFormatsKeys.all });
    },
  });
};

/**
 * Restore a hidden statement format to the current user's normal import lists
 */
export const useUnhideStatementFormat = () => {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (id) => statementFormatApi.unhideFormat(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: statementFormatsKeys.all });
    },
  });
};
