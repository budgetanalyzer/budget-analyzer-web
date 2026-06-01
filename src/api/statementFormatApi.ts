// src/api/statementFormatApi.ts
import { apiClient } from '@/api/client';
import {
  CsvWizardAnalysisResponse,
  CsvWizardMappingPreviewRequest,
  CsvWizardPreviewResponse,
  CsvWizardSaveRequest,
  CreateStatementFormatRequest,
  PdfWizardAnalysisResponse,
  PdfWizardMappingPreviewRequest,
  PdfWizardPreviewResponse,
  PdfWizardSaveRequest,
  StatementFormat,
  UpdateStatementFormatRequest,
} from '@/types/statementFormat';

function buildWizardFormData(file: File, request?: object) {
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
   * Get a single statement format by ID
   * GET /v1/statement-formats/{id}
   */
  getFormat: async (id: number): Promise<StatementFormat> => {
    const response = await apiClient.get<StatementFormat>(`/v1/statement-formats/${id}`);
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
   * PUT /v1/statement-formats/{id}
   */
  updateFormat: async (
    id: number,
    data: UpdateStatementFormatRequest,
  ): Promise<StatementFormat> => {
    const response = await apiClient.put<StatementFormat>(`/v1/statement-formats/${id}`, data);
    return response.data;
  },

  /**
   * Analyze a CSV sample and infer an initial mapping
   * POST /v1/statement-formats/csv-wizard/analyze
   */
  analyzeCsvSample: async (file: File): Promise<CsvWizardAnalysisResponse> => {
    const response = await apiClient.post<CsvWizardAnalysisResponse>(
      '/v1/statement-formats/csv-wizard/analyze',
      buildWizardFormData(file),
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
      buildWizardFormData(file, request),
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
      buildWizardFormData(file, request),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return response.data;
  },

  /**
   * Analyze a PDF sample and return candidate transaction tables
   * POST /v1/statement-formats/pdf-wizard/analyze
   */
  analyzePdfSample: async (file: File): Promise<PdfWizardAnalysisResponse> => {
    const response = await apiClient.post<PdfWizardAnalysisResponse>(
      '/v1/statement-formats/pdf-wizard/analyze',
      buildWizardFormData(file),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return response.data;
  },

  /**
   * Preview a PDF wizard mapping without creating import state
   * POST /v1/statement-formats/pdf-wizard/preview
   */
  previewPdfMapping: async (
    file: File,
    request: PdfWizardMappingPreviewRequest,
  ): Promise<PdfWizardPreviewResponse> => {
    const response = await apiClient.post<PdfWizardPreviewResponse>(
      '/v1/statement-formats/pdf-wizard/preview',
      buildWizardFormData(file, request),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return response.data;
  },

  /**
   * Save a user-scoped PDF statement format from the confirmed mapping
   * POST /v1/statement-formats/pdf-wizard/save
   */
  savePdfWizardFormat: async (
    file: File,
    request: PdfWizardSaveRequest,
  ): Promise<StatementFormat> => {
    const response = await apiClient.post<StatementFormat>(
      '/v1/statement-formats/pdf-wizard/save',
      buildWizardFormData(file, request),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return response.data;
  },
};
