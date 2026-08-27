// src/features/transactions/components/EditableTransactionRow.tsx
import { useState, useCallback, memo } from 'react';
import { Transaction, type TransactionUpdateRequest } from '@/types/transaction';
import type { DisplayAmount } from '@/types/displayAmount';
import { TableRow, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Checkbox } from '@/components/ui/Checkbox';
import { MessageBanner } from '@/components/MessageBanner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { TransactionAmountBadge } from '@/features/transactions/components/TransactionAmountBadge';
import { formatLocalDate } from '@/utils/dates';
import { MoreVertical, Pencil, Trash2, Check, X } from 'lucide-react';

export type EditableTransactionSaveHandler = (
  id: number,
  data: TransactionUpdateRequest,
  callbacks: {
    onSuccess: () => void;
    onError: (message: string) => void;
  },
) => void;

interface EditableTransactionRowProps {
  transaction: Transaction;
  displayAmount: DisplayAmount;
  isAmountLoading: boolean;
  onSave: EditableTransactionSaveHandler;
  onDelete: (transaction: Transaction) => void;
  onRowClick: (transaction: Transaction) => void;
  isUpdating: boolean;
  columnWidths: Record<string, string>;
  visibleColumnCount: number;
  canSelect: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isSelected: boolean;
  selectionDisabled?: boolean;
  selectionLabel?: string;
  selectionStatus?: string;
  onSelectionChange: (checked: boolean) => void;
}

export const EditableTransactionRow = memo(function EditableTransactionRow({
  transaction,
  displayAmount,
  isAmountLoading,
  onSave,
  onDelete,
  onRowClick,
  isUpdating,
  columnWidths,
  visibleColumnCount,
  canSelect,
  canEdit,
  canDelete,
  isSelected,
  selectionDisabled = false,
  selectionLabel,
  selectionStatus,
  onSelectionChange,
}: EditableTransactionRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingDescription, setEditingDescription] = useState('');
  const [editingAccountId, setEditingAccountId] = useState('');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setEditingDescription(transaction.description);
    setEditingAccountId(transaction.accountId || '');
    setSaveErrorMessage(null);
  }, [transaction.description, transaction.accountId]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditingDescription('');
    setEditingAccountId('');
    setSaveErrorMessage(null);
  }, []);

  const handleSaveSuccess = useCallback(() => {
    handleCancelEdit();
  }, [handleCancelEdit]);

  const handleSaveError = useCallback((message: string) => {
    setSaveErrorMessage(message);
  }, []);

  const handleDismissSaveError = useCallback(() => {
    setSaveErrorMessage(null);
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
    const updateData: TransactionUpdateRequest = {};
    if (descriptionChanged) {
      updateData.description = editingDescription;
    }
    if (accountIdChanged) {
      updateData.accountId = editingAccountId;
    }

    setSaveErrorMessage(null);
    onSave(transaction.id, updateData, {
      onSuccess: handleSaveSuccess,
      onError: handleSaveError,
    });
  }, [
    editingDescription,
    editingAccountId,
    transaction.description,
    transaction.accountId,
    transaction.id,
    onSave,
    handleCancelEdit,
    handleSaveSuccess,
    handleSaveError,
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
    <>
      <TableRow
        onClick={handleRowClick}
        className={
          isEditing
            ? 'border-b transition-colors'
            : isSelected
              ? 'cursor-pointer border-b bg-muted transition-colors'
              : 'cursor-pointer border-b transition-colors data-[state=selected]:bg-muted'
        }
      >
        {/* Checkbox */}
        {canSelect && (
          <TableCell className={columnWidths.select} onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelectionChange}
              disabled={isEditing || selectionDisabled}
              aria-label={selectionLabel}
            />
          </TableCell>
        )}

        {/* Date */}
        <TableCell className={columnWidths.date}>{formatLocalDate(transaction.date)}</TableCell>

        {/* Description */}
        <TableCell className={columnWidths.description}>
          {isEditing ? (
            <Input
              value={editingDescription}
              onChange={(e) => setEditingDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isUpdating}
              className="w-full"
              maxLength={500}
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="truncate">{transaction.description}</div>
              {selectionStatus && (
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {selectionStatus}
                </span>
              )}
            </div>
          )}
        </TableCell>

        {/* Bank Name */}
        <TableCell className={columnWidths.bankName}>
          <div className="truncate">{transaction.bankName}</div>
        </TableCell>

        {/* Account ID */}
        <TableCell className={columnWidths.accountId}>
          {isEditing ? (
            <Input
              value={editingAccountId}
              onChange={(e) => setEditingAccountId(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isUpdating}
              className="w-full"
              maxLength={100}
            />
          ) : (
            <div className="truncate">{transaction.accountId || ''}</div>
          )}
        </TableCell>

        {/* Type */}
        <TableCell className={columnWidths.type}>
          <Badge variant={transaction.type === 'CREDIT' ? 'success' : 'secondary'}>
            {transaction.type}
          </Badge>
        </TableCell>

        {/* Amount */}
        <TableCell className={columnWidths.amount}>
          {isAmountLoading ? (
            <div className="flex items-center justify-end gap-2">
              <Skeleton className="h-5 w-24" />
            </div>
          ) : (
            <TransactionAmountBadge
              displayAmount={displayAmount}
              isCredit={transaction.type === 'CREDIT'}
            />
          )}
        </TableCell>

        {/* Actions */}
        <TableCell className={columnWidths.actions}>
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
                  {canEdit && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit();
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
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
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </TableCell>
      </TableRow>
      {saveErrorMessage && (
        <TableRow>
          <TableCell colSpan={visibleColumnCount} className="p-2">
            <MessageBanner
              type="error"
              message={saveErrorMessage}
              onClose={handleDismissSaveError}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
});
