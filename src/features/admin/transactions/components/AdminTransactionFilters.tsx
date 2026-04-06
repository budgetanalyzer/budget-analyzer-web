// src/features/admin/transactions/components/AdminTransactionFilters.tsx
import { useCallback, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { useDebounce } from '@/hooks/useDebounce';
import type { AdminTransactionsQuery } from '@/types/adminTransaction';
import type { TransactionType } from '@/types/transaction';
import { hasActiveFilters } from '@/features/admin/transactions/utils/urlState';

interface AdminTransactionFiltersProps {
  query: AdminTransactionsQuery;
  onChange: (next: Partial<AdminTransactionsQuery>) => void;
  onClear: () => void;
}

export function AdminTransactionFilters({
  query,
  onChange,
  onClear,
}: AdminTransactionFiltersProps) {
  // Description input uses explicit submit (Enter), so we keep local state.
  const [localDescription, setLocalDescription] = useState(query.description ?? '');

  // Owner / bank / account / amounts use a debounced sync to URL.
  const [localOwnerId, setLocalOwnerId] = useState(query.ownerId ?? '');
  const [localBank, setLocalBank] = useState(query.bankName ?? '');
  const [localAccount, setLocalAccount] = useState(query.accountId ?? '');
  const [localMinAmount, setLocalMinAmount] = useState(
    query.minAmount !== undefined ? String(query.minAmount) : '',
  );
  const [localMaxAmount, setLocalMaxAmount] = useState(
    query.maxAmount !== undefined ? String(query.maxAmount) : '',
  );

  // Sync local state when query changes externally (e.g. clear, browser nav).
  useEffect(() => {
    setLocalDescription(query.description ?? '');
  }, [query.description]);
  useEffect(() => {
    setLocalOwnerId(query.ownerId ?? '');
  }, [query.ownerId]);
  useEffect(() => {
    setLocalBank(query.bankName ?? '');
  }, [query.bankName]);
  useEffect(() => {
    setLocalAccount(query.accountId ?? '');
  }, [query.accountId]);
  useEffect(() => {
    setLocalMinAmount(query.minAmount !== undefined ? String(query.minAmount) : '');
  }, [query.minAmount]);
  useEffect(() => {
    setLocalMaxAmount(query.maxAmount !== undefined ? String(query.maxAmount) : '');
  }, [query.maxAmount]);

  const debouncedOwnerId = useDebounce(localOwnerId, 400);
  const debouncedBank = useDebounce(localBank, 400);
  const debouncedAccount = useDebounce(localAccount, 400);
  const debouncedMinAmount = useDebounce(localMinAmount, 400);
  const debouncedMaxAmount = useDebounce(localMaxAmount, 400);

  // Push debounced values into query params (only when they actually change).
  // Each effect only fires when the debounced value has caught up to the live
  // local input. This prevents a stale typed value from being written back to
  // the URL after an external query change (Clear All, browser nav) reset
  // localXxx but the debounced value still holds the old value.
  useEffect(() => {
    if (debouncedOwnerId !== localOwnerId) return;
    const next = debouncedOwnerId.trim() || undefined;
    if (next !== query.ownerId) onChange({ ownerId: next });
  }, [debouncedOwnerId, localOwnerId, query.ownerId, onChange]);

  useEffect(() => {
    if (debouncedBank !== localBank) return;
    const next = debouncedBank.trim() || undefined;
    if (next !== query.bankName) onChange({ bankName: next });
  }, [debouncedBank, localBank, query.bankName, onChange]);

  useEffect(() => {
    if (debouncedAccount !== localAccount) return;
    const next = debouncedAccount.trim() || undefined;
    if (next !== query.accountId) onChange({ accountId: next });
  }, [debouncedAccount, localAccount, query.accountId, onChange]);

  useEffect(() => {
    if (debouncedMinAmount !== localMinAmount) return;
    const parsed = debouncedMinAmount === '' ? undefined : Number(debouncedMinAmount);
    const next = parsed !== undefined && !Number.isNaN(parsed) ? parsed : undefined;
    if (next !== query.minAmount) onChange({ minAmount: next });
  }, [debouncedMinAmount, localMinAmount, query.minAmount, onChange]);

  useEffect(() => {
    if (debouncedMaxAmount !== localMaxAmount) return;
    const parsed = debouncedMaxAmount === '' ? undefined : Number(debouncedMaxAmount);
    const next = parsed !== undefined && !Number.isNaN(parsed) ? parsed : undefined;
    if (next !== query.maxAmount) onChange({ maxAmount: next });
  }, [debouncedMaxAmount, localMaxAmount, query.maxAmount, onChange]);

  const handleSearchSubmit = useCallback(() => {
    const next = localDescription.trim() || undefined;
    onChange({ description: next });
  }, [localDescription, onChange]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSearchSubmit();
      }
    },
    [handleSearchSubmit],
  );

  const handleClearSearch = useCallback(() => {
    setLocalDescription('');
    onChange({ description: undefined });
  }, [onChange]);

  const handleDateChange = useCallback(
    (from: string | null, to: string | null) => {
      onChange({
        dateFrom: from ?? undefined,
        dateTo: to ?? undefined,
      });
    },
    [onChange],
  );

  const handleTypeChange = useCallback(
    (value: string) => {
      const next = value === 'all' ? undefined : (value as TransactionType);
      onChange({ type: next });
    },
    [onChange],
  );

  const handleClearAll = useCallback(() => {
    setLocalDescription('');
    setLocalOwnerId('');
    setLocalBank('');
    setLocalAccount('');
    setLocalMinAmount('');
    setLocalMaxAmount('');
    onClear();
  }, [onClear]);

  const filtersActive = hasActiveFilters(query);

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search description (press Enter)"
            value={localDescription}
            onChange={(e) => setLocalDescription(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9 pr-9"
          />
          {localDescription && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <DateRangeFilter
          from={query.dateFrom ?? null}
          to={query.dateTo ?? null}
          onChange={handleDateChange}
        />

        <Select value={query.type ?? 'all'} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[110px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="DEBIT">Debit</SelectItem>
            <SelectItem value="CREDIT">Credit</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder="Min"
            value={localMinAmount}
            onChange={(e) => setLocalMinAmount(e.target.value)}
            className="w-[90px]"
            min="0"
            step="0.01"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            placeholder="Max"
            value={localMaxAmount}
            onChange={(e) => setLocalMaxAmount(e.target.value)}
            className="w-[90px]"
            min="0"
            step="0.01"
          />
        </div>

        {filtersActive && (
          <>
            <div className="mx-1 h-6 w-px bg-border" />
            <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-9 px-3">
              <X className="mr-1.5 h-4 w-4" />
              Clear all
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-col">
          <Input
            value={localOwnerId}
            onChange={(e) => setLocalOwnerId(e.target.value)}
            placeholder="Filter by owner ID (e.g. usr_test123)"
            className="w-[280px] font-mono text-xs"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Owner ID is an opaque identifier. Email-based lookup is not currently supported.
          </p>
        </div>
        <Input
          value={localBank}
          onChange={(e) => setLocalBank(e.target.value)}
          placeholder="Filter by bank name…"
          className="w-[200px]"
        />
        <Input
          value={localAccount}
          onChange={(e) => setLocalAccount(e.target.value)}
          placeholder="Filter by account ID…"
          className="w-[200px]"
        />
      </div>
    </div>
  );
}
