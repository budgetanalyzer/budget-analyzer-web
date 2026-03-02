// src/features/transactions/components/PreviewTableRow.tsx
import { memo, useCallback } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { PreviewTransaction, PreviewWarning, TransactionType } from '@/types/transaction';
import { cn } from '@/utils/cn';

interface PreviewTableRowProps {
  transaction: PreviewTransaction;
  index: number;
  warnings: PreviewWarning[];
  onUpdate: (index: number, field: keyof PreviewTransaction, value: string | number) => void;
  onRemove: (index: number) => void;
}

export const PreviewTableRow = memo(function PreviewTableRow({
  transaction,
  index,
  warnings,
  onUpdate,
  onRemove,
}: PreviewTableRowProps) {
  const getFieldWarning = useCallback(
    (field: string): PreviewWarning | undefined => {
      return warnings.find((w) => w.index === index && w.field === field);
    },
    [warnings, index],
  );

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

  const dateWarning = getFieldWarning('date');
  const descriptionWarning = getFieldWarning('description');
  const amountWarning = getFieldWarning('amount');

  return (
    <TableRow>
      {/* Date */}
      <TableCell className="w-[130px]">
        <div className="relative">
          <Input
            type="date"
            value={transaction.date}
            onChange={handleDateChange}
            className={cn(
              'w-full',
              dateWarning && 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
            )}
          />
          {dateWarning && (
            <AlertTriangle
              className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-yellow-500"
              aria-label={dateWarning.message}
            />
          )}
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
            className={cn(
              'w-full',
              descriptionWarning && 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
            )}
          />
          {descriptionWarning && (
            <AlertTriangle
              className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-yellow-500"
              aria-label={descriptionWarning.message}
            />
          )}
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
            className={cn(
              'w-full text-right',
              amountWarning && 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
            )}
          />
          {amountWarning && (
            <AlertTriangle
              className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-yellow-500"
              aria-label={amountWarning.message}
            />
          )}
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

      {/* Remove */}
      <TableCell className="w-[60px]">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400"
          title="Remove transaction"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Remove</span>
        </Button>
      </TableCell>
    </TableRow>
  );
});
