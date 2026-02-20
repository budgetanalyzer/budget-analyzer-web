// src/types/statementFormat.ts
export type FormatType = 'CSV' | 'PDF' | 'XLSX';

export interface StatementFormat {
  id: number;
  formatKey: string;
  displayName: string;
  formatType: FormatType;
  bankName: string;
  defaultCurrencyIsoCode: string;
  dateHeader?: string;
  dateFormat?: string;
  descriptionHeader?: string;
  creditHeader?: string;
  debitHeader?: string;
  typeHeader?: string;
  categoryHeader?: string;
  enabled: boolean;
}

export interface CreateStatementFormatRequest {
  formatKey: string;
  displayName: string;
  formatType: FormatType;
  bankName: string;
  defaultCurrencyIsoCode: string;
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
