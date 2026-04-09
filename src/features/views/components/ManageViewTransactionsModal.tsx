// src/features/views/components/ManageViewTransactionsModal.tsx
import { useCallback, useMemo, useState } from 'react';
import { Transaction } from '@/types/transaction';
import { SavedView, ViewMembershipResponse } from '@/types/view';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Search, Pin, PinOff, EyeOff, Eye, X } from 'lucide-react';
import { compareLocalDates, formatLocalDate } from '@/utils/dates';
import { formatCurrency } from '@/utils/currency';
import {
  usePinTransaction,
  useUnpinTransaction,
  useExcludeTransaction,
  useUnexcludeTransaction,
} from '@/hooks/useViews';
import { toast } from '@/hooks/useToast';
import { formatApiError } from '@/utils/errorMessages';

interface ManageViewTransactionsModalProps {
  open: boolean;
  onClose: () => void;
  view: SavedView;
  membership: ViewMembershipResponse;
  allTransactions: Transaction[];
}

type MembershipStatus = 'MATCHED' | 'PINNED' | 'EXCLUDED' | 'NONE';

interface TransactionWithMembership extends Transaction {
  membershipStatus: MembershipStatus;
}

export function ManageViewTransactionsModal({
  open,
  onClose,
  view,
  membership,
  allTransactions,
}: ManageViewTransactionsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Mutations
  const { mutate: pinTransaction, isPending: isPinning } = usePinTransaction();
  const { mutate: unpinTransaction, isPending: isUnpinning } = useUnpinTransaction();
  const { mutate: excludeTransaction, isPending: isExcluding } = useExcludeTransaction();
  const { mutate: unexcludeTransaction, isPending: isUnexcluding } = useUnexcludeTransaction();

  const isMutating = isPinning || isUnpinning || isExcluding || isUnexcluding;

  // Build membership status map
  const membershipMap = useMemo(() => {
    const map = new Map<number, MembershipStatus>();
    membership.matched.forEach((id) => map.set(id, 'MATCHED'));
    membership.pinned.forEach((id) => map.set(id, 'PINNED'));
    membership.excluded.forEach((id) => map.set(id, 'EXCLUDED'));
    return map;
  }, [membership]);

  // Add membership status to all transactions
  const transactionsWithMembership = useMemo<TransactionWithMembership[]>(() => {
    return allTransactions.map((txn) => ({
      ...txn,
      membershipStatus: membershipMap.get(txn.id) || 'NONE',
    }));
  }, [allTransactions, membershipMap]);

  // Filter transactions by search query
  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return transactionsWithMembership;

    const query = searchQuery.toLowerCase();
    return transactionsWithMembership.filter(
      (txn) =>
        txn.description.toLowerCase().includes(query) ||
        txn.bankName.toLowerCase().includes(query) ||
        txn.accountId?.toLowerCase().includes(query),
    );
  }, [transactionsWithMembership, searchQuery]);

  // Sort: pinned first, then matched, then excluded, then none
  const sortedTransactions = useMemo(() => {
    const statusOrder: Record<MembershipStatus, number> = {
      PINNED: 0,
      MATCHED: 1,
      EXCLUDED: 2,
      NONE: 3,
    };

    return [...filteredTransactions].sort((a, b) => {
      const statusDiff = statusOrder[a.membershipStatus] - statusOrder[b.membershipStatus];
      if (statusDiff !== 0) return statusDiff;
      // Within same status, sort by date descending
      return compareLocalDates(b.date, a.date);
    });
  }, [filteredTransactions]);

  const handlePin = useCallback(
    (txnId: number) => {
      pinTransaction(
        { viewId: view.id, txnId },
        {
          onSuccess: () => {
            toast.success('Transaction pinned to view');
          },
          onError: (error) => {
            toast.error(formatApiError(error, 'Failed to pin transaction'));
          },
        },
      );
    },
    [pinTransaction, view.id],
  );

  const handleUnpin = useCallback(
    (txnId: number) => {
      unpinTransaction(
        { viewId: view.id, txnId },
        {
          onSuccess: () => {
            toast.success('Transaction unpinned from view');
          },
          onError: (error) => {
            toast.error(formatApiError(error, 'Failed to unpin transaction'));
          },
        },
      );
    },
    [unpinTransaction, view.id],
  );

  const handleExclude = useCallback(
    (txnId: number) => {
      excludeTransaction(
        { viewId: view.id, txnId },
        {
          onSuccess: () => {
            toast.success('Transaction excluded from view');
          },
          onError: (error) => {
            toast.error(formatApiError(error, 'Failed to exclude transaction'));
          },
        },
      );
    },
    [excludeTransaction, view.id],
  );

  const handleUnexclude = useCallback(
    (txnId: number) => {
      unexcludeTransaction(
        { viewId: view.id, txnId },
        {
          onSuccess: () => {
            toast.success('Transaction restored to view');
          },
          onError: (error) => {
            toast.error(formatApiError(error, 'Failed to restore transaction'));
          },
        },
      );
    },
    [unexcludeTransaction, view.id],
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const getMembershipBadge = (status: MembershipStatus) => {
    switch (status) {
      case 'PINNED':
        return (
          <Badge variant="default" className="gap-1">
            <Pin className="h-3 w-3" />
            Pinned
          </Badge>
        );
      case 'MATCHED':
        return (
          <Badge variant="secondary" className="gap-1">
            Matched
          </Badge>
        );
      case 'EXCLUDED':
        return (
          <Badge variant="secondary" className="gap-1 text-muted-foreground">
            <EyeOff className="h-3 w-3" />
            Excluded
          </Badge>
        );
      case 'NONE':
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Not in view
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Transactions</DialogTitle>
          <DialogDescription>
            Add or remove transactions from &ldquo;{view.name}&rdquo;. Pinned transactions stay in
            the view regardless of filters.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredTransactions.length} of {allTransactions.length} transactions
          </div>
        </div>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[120px]">Bank</TableHead>
                  <TableHead className="w-[100px] text-right">Amount</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTransactions.length > 0 ? (
                  sortedTransactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="font-mono text-xs">
                        {formatLocalDate(txn.date)}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">{txn.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {txn.bankName}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(Math.abs(txn.amount), txn.currencyIsoCode)}
                      </TableCell>
                      <TableCell>{getMembershipBadge(txn.membershipStatus)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {txn.membershipStatus === 'PINNED' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnpin(txn.id)}
                              disabled={isMutating}
                            >
                              <PinOff className="mr-1.5 h-3.5 w-3.5" />
                              Unpin
                            </Button>
                          ) : txn.membershipStatus === 'EXCLUDED' ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnexclude(txn.id)}
                                disabled={isMutating}
                              >
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                Restore
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePin(txn.id)}
                                disabled={isMutating}
                              >
                                <Pin className="mr-1.5 h-3.5 w-3.5" />
                                Pin
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePin(txn.id)}
                                disabled={isMutating}
                              >
                                <Pin className="mr-1.5 h-3.5 w-3.5" />
                                Pin
                              </Button>
                              {txn.membershipStatus === 'MATCHED' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleExclude(txn.id)}
                                  disabled={isMutating}
                                >
                                  <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                                  Exclude
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {searchQuery
                        ? 'No transactions match your search.'
                        : 'No transactions found.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
