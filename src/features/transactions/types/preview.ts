import type { BatchImportTransactionRequest, PreviewTransaction } from '@/types/transaction';

export type EditablePreviewTransaction = PreviewTransaction &
  Pick<BatchImportTransactionRequest, 'allowDuplicate'>;

export type EditablePreviewTransactionField = keyof EditablePreviewTransaction;

export type EditablePreviewTransactionValue = string | number | boolean | null | undefined;
