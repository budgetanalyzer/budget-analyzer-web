// src/features/transactions/components/PreviewTable.tsx
import { useCallback } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { PreviewTableRow } from '@/features/transactions/components/PreviewTableRow';
import type {
  EditablePreviewTransaction,
  EditablePreviewTransactionField,
  EditablePreviewTransactionValue,
} from '@/features/transactions/types/preview';
import { cn } from '@/utils/cn';

interface PreviewTableProps {
  transactions: EditablePreviewTransaction[];
  onUpdateTransaction: (
    index: number,
    field: EditablePreviewTransactionField,
    value: EditablePreviewTransactionValue,
  ) => void;
  onRemoveTransaction: (index: number) => void;
}

export function PreviewTable({
  transactions,
  onUpdateTransaction,
  onRemoveTransaction,
}: PreviewTableProps) {
  const handleUpdate = useCallback(
    (
      index: number,
      field: EditablePreviewTransactionField,
      value: EditablePreviewTransactionValue,
    ) => {
      onUpdateTransaction(index, field, value);
    },
    [onUpdateTransaction],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onRemoveTransaction(index);
    },
    [onRemoveTransaction],
  );
  const hasDuplicateRows = transactions.some((transaction) => transaction.duplicate);

  if (transactions.length === 0) {
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
          <TableHead className={cn(hasDuplicateRows ? 'w-[220px]' : 'w-[72px]')}>Review</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction, index) => (
          <PreviewTableRow
            key={index}
            transaction={transaction}
            index={index}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
            hasDuplicateRows={hasDuplicateRows}
          />
        ))}
      </TableBody>
    </Table>
  );
}
