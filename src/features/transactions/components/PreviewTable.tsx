// src/features/transactions/components/PreviewTable.tsx
import { useCallback } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { PreviewTableRow } from '@/features/transactions/components/PreviewTableRow';
import type {
  EditablePreviewTableRow,
  EditablePreviewTransactionField,
  EditablePreviewTransactionValue,
} from '@/features/transactions/types/preview';
import { columnWidthClass } from '@/utils/columnWidth';

interface PreviewTableProps {
  rows: EditablePreviewTableRow[];
  onUpdateTransaction: (
    fileIndex: number,
    transactionIndex: number,
    field: EditablePreviewTransactionField,
    value: EditablePreviewTransactionValue,
  ) => void;
  onRemoveTransaction: (fileIndex: number, transactionIndex: number) => void;
}

export function PreviewTable({
  rows,
  onUpdateTransaction,
  onRemoveTransaction,
}: PreviewTableProps) {
  const handleUpdate = useCallback(
    (
      fileIndex: number,
      transactionIndex: number,
      field: EditablePreviewTransactionField,
      value: EditablePreviewTransactionValue,
    ) => {
      onUpdateTransaction(fileIndex, transactionIndex, field, value);
    },
    [onUpdateTransaction],
  );

  const handleRemove = useCallback(
    (fileIndex: number, transactionIndex: number) => {
      onRemoveTransaction(fileIndex, transactionIndex);
    },
    [onRemoveTransaction],
  );
  const hasDuplicateRows = rows.some(({ transaction }) => transaction.duplicate);
  const reviewColumnWidth = hasDuplicateRows ? 220 : 72;

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        No transactions to preview
      </div>
    );
  }

  return (
    <Table hideScrollbar={false}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[130px]">Date</TableHead>
          <TableHead className="min-w-[200px]">Description</TableHead>
          <TableHead className="w-[120px]">Type</TableHead>
          <TableHead className="w-[160px] text-right">Amount</TableHead>
          <TableHead className="w-[80px]">Currency</TableHead>
          <TableHead className="w-[150px]">Account ID</TableHead>
          <TableHead className={columnWidthClass(reviewColumnWidth)}>Review</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ fileIndex, transactionIndex, transaction }) => (
          <PreviewTableRow
            key={`${fileIndex}-${transactionIndex}`}
            transaction={transaction}
            fileIndex={fileIndex}
            transactionIndex={transactionIndex}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
            reviewColumnWidth={reviewColumnWidth}
          />
        ))}
      </TableBody>
    </Table>
  );
}
