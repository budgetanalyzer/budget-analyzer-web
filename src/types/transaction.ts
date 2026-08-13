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

export interface PreviewFileResponse {
  sourceFile: string;
  statementFormatId: number;
  previewImportToken: string;
  fileImport: PreviewFileImportStatusResponse;
  transactions: PreviewTransaction[];
}

export interface PreviewResponse {
  files: PreviewFileResponse[];
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

export interface BatchImportFileRequest {
  previewImportToken: string;
  transactions: BatchImportTransactionRequest[];
}

export interface BatchImportRequest {
  files: BatchImportFileRequest[];
}

export interface BatchImportFileResponse {
  sourceFile: string;
  created: number;
  duplicatesSkipped: number;
  duplicatesImported: number;
  transactions: Transaction[];
}

export interface BatchImportResponse {
  created: number;
  duplicatesSkipped: number;
  duplicatesImported: number;
  files: BatchImportFileResponse[];
}

export interface TransactionCountFilter {
  currencyIsoCode?: string;
}
