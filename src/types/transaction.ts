// src/types/transaction.ts
export type TransactionType = 'CREDIT' | 'DEBIT';

export interface Transaction {
  id: number;
  accountId: string;
  bankName: string;
  date: string;
  currencyIsoCode: string;
  amount: number;
  type: TransactionType;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionUpdateRequest {
  description?: string;
  accountId?: string;
}

// Preview import types
export type PreviewDuplicateReason = 'EXISTING_TRANSACTION' | 'IN_BATCH';
export type PreviewFileWarningCode = 'FILE_ALREADY_IMPORTED';

export interface PreviousFileImportResponse {
  originalFilename: string;
  importedAt: string;
  statementFormatId: number;
  accountId?: string | null;
  transactionCount: number;
}

export interface PreviewFileImportStatusResponse {
  alreadyImported: boolean;
  warningCode?: PreviewFileWarningCode | null;
  previousImport?: PreviousFileImportResponse | null;
}

export interface PreviewTransaction {
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category?: string;
  bankName: string;
  currencyIsoCode: string;
  accountId?: string;
  duplicate: boolean;
  duplicateReason?: PreviewDuplicateReason | null;
}

export interface PreviewResponse {
  sourceFile: string;
  detectedFormat: string;
  previewImportToken: string;
  fileImport: PreviewFileImportStatusResponse;
  transactions: PreviewTransaction[];
}

export interface BatchImportTransactionRequest {
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category?: string;
  bankName: string;
  currencyIsoCode: string;
  accountId?: string;
  allowDuplicate?: boolean;
}

export interface BatchImportRequest {
  previewImportToken: string;
  transactions: BatchImportTransactionRequest[];
}

export interface BatchImportResponse {
  created: number;
  duplicatesSkipped: number;
  duplicatesImported: number;
  transactions: Transaction[];
}

export interface TransactionCountFilter {
  currencyIsoCode?: string;
}
