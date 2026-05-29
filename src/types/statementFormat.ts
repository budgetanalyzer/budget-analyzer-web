// src/types/statementFormat.ts
export type FormatType = 'CSV' | 'PDF' | 'XLSX';
export type StatementFormatScope = 'SYSTEM' | 'USER';

export interface StatementFormat {
  id: number;
  formatKey?: string;
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
  formatKey?: string;
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
