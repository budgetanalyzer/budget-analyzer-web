// src/features/transactions/components/EditableTransactionRow.tsx
import { useState, useCallback, memo } from 'react';
import { Transaction } from '@/types/transaction';
import { ExchangeRateResponse } from '@/types/currency';
import { TableRow, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { TransactionAmountBadge } from '@/features/transactions/components/TransactionAmountBadge';
import { formatLocalDate } from '@/utils/dates';
import { MoreVertical, Pencil, Trash2, Check, X } from 'lucide-react';

interface EditableTransactionRowProps {
  transaction: Transaction;
  displayCurrency: string;
  exchangeRatesMap: Map<string, Map<string, ExchangeRateResponse>>;
  isExchangeRatesLoading: boolean;
  onSave: (id: number, data: { description?: string; accountId?: string }) => void;
  onDelete: (transaction: Transaction) => void;
  onRowClick: (transaction: Transaction) => void;
  isUpdating: boolean;
}

export const EditableTransactionRow = memo(function EditableTransactionRow({
  transaction,
  displayCurrency,
  exchangeRatesMap,
  isExchangeRatesLoading,
  onSave,
  onDelete,
  onRowClick,
  isUpdating,
}: EditableTransactionRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingDescription, setEditingDescription] = useState('');
  const [editingAccountId, setEditingAccountId] = useState('');

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setEditingDescription(transaction.description);
    setEditingAccountId(transaction.accountId || '');
  }, [transaction.description, transaction.accountId]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditingDescription('');
    setEditingAccountId('');
  }, []);

  const handleSubmitEdit = useCallback(() => {
    // Check if anything actually changed
    const descriptionChanged = editingDescription !== transaction.description;
    const accountIdChanged = editingAccountId !== (transaction.accountId || '');

    if (!descriptionChanged && !accountIdChanged) {
      // Nothing changed, just exit edit mode
      handleCancelEdit();
      return;
    }

    // Build update payload with only changed fields
    const updateData: { description?: string; accountId?: string } = {};
    if (descriptionChanged) {
      updateData.description = editingDescription;
    }
    if (accountIdChanged) {
      updateData.accountId = editingAccountId;
    }

    onSave(transaction.id, updateData);
    handleCancelEdit();
  }, [
    editingDescription,
    editingAccountId,
    transaction.description,
    transaction.accountId,
    transaction.id,
    onSave,
    handleCancelEdit,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelEdit();
      }
    },
    [handleCancelEdit],
  );

  const handleRowClick = useCallback(() => {
    if (!isEditing) {
      onRowClick(transaction);
    }
  }, [isEditing, onRowClick, transaction]);

  return (
    <TableRow
      onClick={handleRowClick}
      className={
        isEditing
          ? 'border-b transition-colors'
          : 'cursor-pointer border-b transition-colors data-[state=selected]:bg-muted'
      }
    >
      {/* Date */}
      <TableCell>{formatLocalDate(transaction.date)}</TableCell>

      {/* Description */}
      <TableCell>
        {isEditing ? (
          <Input
            value={editingDescription}
            onChange={(e) => setEditingDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isUpdating}
            className="max-w-md"
            autoFocus
          />
        ) : (
          <div className="max-w-md truncate">{transaction.description}</div>
        )}
      </TableCell>

      {/* Bank Name */}
      <TableCell>{transaction.bankName}</TableCell>

      {/* Account ID */}
      <TableCell>
        {isEditing ? (
          <Input
            value={editingAccountId}
            onChange={(e) => setEditingAccountId(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isUpdating}
            className="max-w-md"
          />
        ) : (
          <div className="max-w-md truncate">{transaction.accountId || ''}</div>
        )}
      </TableCell>

      {/* Type */}
      <TableCell>
        <Badge variant={transaction.type === 'CREDIT' ? 'success' : 'secondary'}>
          {transaction.type}
        </Badge>
      </TableCell>

      {/* Amount */}
      <TableCell>
        {isExchangeRatesLoading ? (
          <div className="flex items-center justify-end gap-2">
            <Skeleton className="h-5 w-24" />
          </div>
        ) : (
          <TransactionAmountBadge
            amount={transaction.amount}
            date={transaction.date}
            currencyCode={transaction.currencyIsoCode}
            displayCurrency={displayCurrency}
            exchangeRatesMap={exchangeRatesMap}
            isCredit={transaction.type === 'CREDIT'}
          />
        )}
      </TableCell>

      {/* Actions */}
      <TableCell>
        {isEditing ? (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-500 dark:hover:bg-green-950 dark:hover:text-green-400"
              onClick={(e) => {
                e.stopPropagation();
                handleSubmitEdit();
              }}
              disabled={isUpdating}
              title="Save changes"
            >
              <Check className="h-4 w-4" />
              <span className="sr-only">Save</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation();
                handleCancelEdit();
              }}
              disabled={isUpdating}
              title="Cancel editing"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Cancel</span>
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-transparent"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit();
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  destructive
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(transaction);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
});
