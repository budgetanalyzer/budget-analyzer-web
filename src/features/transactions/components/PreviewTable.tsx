// src/features/transactions/components/PreviewTable.tsx
import { useCallback } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { PreviewTableRow } from '@/features/transactions/components/PreviewTableRow';
import { PreviewTransaction, PreviewWarning } from '@/types/transaction';

interface PreviewTableProps {
  transactions: PreviewTransaction[];
  warnings: PreviewWarning[];
  onUpdateTransaction: (
    index: number,
    field: keyof PreviewTransaction,
    value: string | number,
  ) => void;
  onRemoveTransaction: (index: number) => void;
}

export function PreviewTable({
  transactions,
  warnings,
  onUpdateTransaction,
  onRemoveTransaction,
}: PreviewTableProps) {
  const handleUpdate = useCallback(
    (index: number, field: keyof PreviewTransaction, value: string | number) => {
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

  if (transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        No transactions to preview
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[130px]">Date</TableHead>
          <TableHead className="min-w-[200px]">Description</TableHead>
          <TableHead className="w-[120px]">Type</TableHead>
          <TableHead className="w-[160px] text-right">Amount</TableHead>
          <TableHead className="w-[80px]">Currency</TableHead>
          <TableHead className="w-[150px]">Account ID</TableHead>
          <TableHead className="w-[60px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction, index) => (
          <PreviewTableRow
            key={index}
            transaction={transaction}
            index={index}
            warnings={warnings}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
          />
        ))}
      </TableBody>
    </Table>
  );
}
