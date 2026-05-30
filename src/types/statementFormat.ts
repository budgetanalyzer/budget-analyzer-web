// src/types/statementFormat.ts
import type { PreviewTransaction } from '@/types/transaction';
export type FormatType = 'CSV' | 'PDF' | 'XLSX';
export type StatementFormatScope = 'SYSTEM' | 'USER';

export interface StatementFormat {
  id: number;
  displayName: string;
  formatType: FormatType;
  bankName: string;
  defaultCurrencyIsoCode: string;
  scope?: StatementFormatScope;
  ownerId?: string | null;
  dateHeader?: string;
  dateFormat?: string;
  descriptionHeader?: string;
  creditHeader?: string;
  debitHeader?: string;
  typeHeader?: string;
  categoryHeader?: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateStatementFormatRequest {
  displayName: string;
  formatType: FormatType;
  bankName: string;
  defaultCurrencyIsoCode: string;
  scope?: StatementFormatScope;
  dateHeader?: string;
  dateFormat?: string;
  descriptionHeader?: string;
  creditHeader?: string;
  debitHeader?: string;
  typeHeader?: string;
  categoryHeader?: string;
}

export interface UpdateStatementFormatRequest {
  displayName?: string;
  bankName?: string;
  defaultCurrencyIsoCode?: string;
  dateHeader?: string;
  dateFormat?: string;
  descriptionHeader?: string;
  creditHeader?: string;
  debitHeader?: string;
  typeHeader?: string;
  categoryHeader?: string;
  enabled?: boolean;
}

export type CsvWizardAmountMode = 'SINGLE_AMOUNT_WITH_TYPE' | 'DEBIT_CREDIT_COLUMNS';

export interface CsvWizardColumnMappingRequest {
  dateColumn?: string;
  dateFormat?: string;
  descriptionColumn?: string;
  amountMode: CsvWizardAmountMode;
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  typeColumn?: string;
  categoryColumn?: string;
}

export type CsvWizardColumnMappingResponse = CsvWizardColumnMappingRequest;

export interface CsvWizardWarningResponse {
  field?: string;
  message?: string;
}

export interface CsvWizardAnalysisResponse {
  headers?: string[];
  sampleRows?: Record<string, string>[];
  inferredMapping?: CsvWizardColumnMappingResponse;
  confidence?: number;
  columnConfidences?: Record<string, number>;
  warnings?: CsvWizardWarningResponse[];
}

export interface CsvWizardMappingPreviewRequest {
  bankName: string;
  defaultCurrencyIsoCode: string;
  accountId?: string;
  mapping: CsvWizardColumnMappingRequest;
}

export interface CsvWizardSaveRequest {
  displayName: string;
  bankName: string;
  defaultCurrencyIsoCode: string;
  mapping: CsvWizardColumnMappingRequest;
}

export interface CsvWizardPreviewResponse {
  transactions?: PreviewTransaction[];
  warnings?: CsvWizardWarningResponse[];
}
