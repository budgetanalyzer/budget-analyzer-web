// src/features/transactions/components/PreviewTableRow.tsx
import { memo, useCallback } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { PreviewDuplicateReason, TransactionType } from '@/types/transaction';
import type {
  EditablePreviewTransaction,
  EditablePreviewTransactionField,
  EditablePreviewTransactionValue,
} from '@/features/transactions/types/preview';
import { cn } from '@/utils/cn';

interface PreviewTableRowProps {
  transaction: EditablePreviewTransaction;
  index: number;
  onUpdate: (
    index: number,
    field: EditablePreviewTransactionField,
    value: EditablePreviewTransactionValue,
  ) => void;
  onRemove: (index: number) => void;
  hasDuplicateRows: boolean;
}

function getDuplicateStatusLabel(reason?: PreviewDuplicateReason | null): string {
  if (reason === 'IN_BATCH') {
    return 'Duplicate in file';
  }

  if (reason === 'EXISTING_TRANSACTION') {
    return 'Already imported';
  }

  return 'Possible duplicate';
}

export const PreviewTableRow = memo(function PreviewTableRow({
  transaction,
  index,
  onUpdate,
  onRemove,
  hasDuplicateRows,
}: PreviewTableRowProps) {
  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(index, 'date', e.target.value);
    },
    [index, onUpdate],
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(index, 'description', e.target.value);
    },
    [index, onUpdate],
  );

  const handleTypeChange = useCallback(
    (value: string) => {
      onUpdate(index, 'type', value as TransactionType);
    },
    [index, onUpdate],
  );

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value) || 0;
      onUpdate(index, 'amount', value);
    },
    [index, onUpdate],
  );

  const handleAccountIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(index, 'accountId', e.target.value);
    },
    [index, onUpdate],
  );

  const handleRemove = useCallback(() => {
    onRemove(index);
  }, [index, onRemove]);

  const handleAllowDuplicateChange = useCallback(
    (checked: boolean | 'indeterminate') => {
      onUpdate(index, 'allowDuplicate', checked === true);
    },
    [index, onUpdate],
  );

  const importAnywayId = `preview-import-anyway-${index}`;
  const duplicateStatusLabel = getDuplicateStatusLabel(transaction.duplicateReason);

  return (
    <TableRow
      className={cn(
        transaction.duplicate && 'border-l-4 border-l-warning bg-warning/10 hover:bg-warning/15',
      )}
    >
      {/* Date */}
      <TableCell className="w-[130px]">
        <div className="relative">
          <Input
            type="date"
            value={transaction.date}
            onChange={handleDateChange}
            className="w-full"
          />
        </div>
      </TableCell>

      {/* Description */}
      <TableCell className="min-w-[200px]">
        <div className="relative">
          <Input
            type="text"
            value={transaction.description}
            onChange={handleDescriptionChange}
            maxLength={500}
            className="w-full"
          />
        </div>
      </TableCell>

      {/* Type */}
      <TableCell className="w-[120px]">
        <Select value={transaction.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DEBIT">DEBIT</SelectItem>
            <SelectItem value="CREDIT">CREDIT</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      {/* Amount */}
      <TableCell className="w-[160px]">
        <div className="relative">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={transaction.amount}
            onChange={handleAmountChange}
            className="w-full text-right"
          />
        </div>
      </TableCell>

      {/* Currency (read-only) */}
      <TableCell className="w-[80px]">
        <Badge variant="secondary">{transaction.currencyIsoCode}</Badge>
      </TableCell>

      {/* Account ID */}
      <TableCell className="w-[150px]">
        <Input
          type="text"
          value={transaction.accountId || ''}
          onChange={handleAccountIdChange}
          placeholder="Optional"
          maxLength={100}
          className="w-full"
        />
      </TableCell>

      {/* Review actions */}
      <TableCell className={cn(hasDuplicateRows ? 'w-[220px] min-w-[220px]' : 'w-[72px]')}>
        <div className="flex items-center justify-end gap-3">
          {transaction.duplicate && (
            <div className="min-w-0 rounded-md bg-warning/15 px-2 py-1.5">
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-warning">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {duplicateStatusLabel}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <Checkbox
                  id={importAnywayId}
                  checked={transaction.allowDuplicate === true}
                  onCheckedChange={handleAllowDuplicateChange}
                />
                <label
                  htmlFor={importAnywayId}
                  className="whitespace-nowrap text-xs font-medium text-muted-foreground"
                >
                  Import anyway
                </label>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="h-8 w-8 shrink-0 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400"
            aria-label="Remove transaction"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});
