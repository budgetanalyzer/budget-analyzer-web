// src/api/statementFormatApi.ts
import { apiClient } from '@/api/client';
import {
  StatementFormat,
  CreateStatementFormatRequest,
  UpdateStatementFormatRequest,
} from '@/types/statementFormat';

export const statementFormatApi = {
  /**
   * Get all statement formats
   * GET /v1/statement-formats
   */
  listFormats: async (): Promise<StatementFormat[]> => {
    const response = await apiClient.get<StatementFormat[]>('/v1/statement-formats');
    return response.data;
  },

  /**
   * Get a single statement format by key
   * GET /v1/statement-formats/{formatKey}
   */
  getFormat: async (formatKey: string): Promise<StatementFormat> => {
    const response = await apiClient.get<StatementFormat>(`/v1/statement-formats/${formatKey}`);
    return response.data;
  },

  /**
   * Create a new statement format
   * POST /v1/statement-formats
   */
  createFormat: async (data: CreateStatementFormatRequest): Promise<StatementFormat> => {
    const response = await apiClient.post<StatementFormat>('/v1/statement-formats', data);
    return response.data;
  },

  /**
   * Update an existing statement format
   * PUT /v1/statement-formats/{formatKey}
   */
  updateFormat: async (
    formatKey: string,
    data: UpdateStatementFormatRequest,
  ): Promise<StatementFormat> => {
    const response = await apiClient.put<StatementFormat>(
      `/v1/statement-formats/${formatKey}`,
      data,
    );
    return response.data;
  },
};
