// src/features/transactions/components/PreviewTableRow.tsx
import { memo, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
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
import { PreviewTransaction, TransactionType } from '@/types/transaction';

interface PreviewTableRowProps {
  transaction: PreviewTransaction;
  index: number;
  onUpdate: (index: number, field: keyof PreviewTransaction, value: string | number) => void;
  onRemove: (index: number) => void;
}

export const PreviewTableRow = memo(function PreviewTableRow({
  transaction,
  index,
  onUpdate,
  onRemove,
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

  return (
    <TableRow>
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
