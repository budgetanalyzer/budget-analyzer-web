// src/api/statementFormatApi.ts
import { apiClient } from '@/api/client';
import {
  CsvWizardAnalysisResponse,
  CsvWizardMappingPreviewRequest,
  CsvWizardPreviewResponse,
  CsvWizardSaveRequest,
  CreateStatementFormatRequest,
  StatementFormat,
  UpdateStatementFormatRequest,
} from '@/types/statementFormat';

function buildCsvWizardFormData(file: File, request?: object) {
  const formData = new FormData();
  formData.append('file', file);

  if (request) {
    formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
  }

  return formData;
}

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

  /**
   * Analyze a CSV sample and infer an initial mapping
   * POST /v1/statement-formats/csv-wizard/analyze
   */
  analyzeCsvSample: async (file: File): Promise<CsvWizardAnalysisResponse> => {
    const response = await apiClient.post<CsvWizardAnalysisResponse>(
      '/v1/statement-formats/csv-wizard/analyze',
      buildCsvWizardFormData(file),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return response.data;
  },

  /**
   * Preview a CSV wizard mapping without creating import state
   * POST /v1/statement-formats/csv-wizard/preview
   */
  previewCsvMapping: async (
    file: File,
    request: CsvWizardMappingPreviewRequest,
  ): Promise<CsvWizardPreviewResponse> => {
    const response = await apiClient.post<CsvWizardPreviewResponse>(
      '/v1/statement-formats/csv-wizard/preview',
      buildCsvWizardFormData(file, request),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return response.data;
  },

  /**
   * Save a user-scoped CSV statement format from the confirmed mapping
   * POST /v1/statement-formats/csv-wizard/save
   */
  saveCsvWizardFormat: async (
    file: File,
    request: CsvWizardSaveRequest,
  ): Promise<StatementFormat> => {
    const response = await apiClient.post<StatementFormat>(
      '/v1/statement-formats/csv-wizard/save',
      buildCsvWizardFormData(file, request),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return response.data;
  },
};
