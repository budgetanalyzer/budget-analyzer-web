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
import type { AdminTransactionsQuery } from '@/types/adminTransaction';
import type { TransactionType } from '@/types/transaction';
import { hasActiveFilters } from '@/features/admin/transactions/utils/urlState';

interface AdminTransactionFiltersProps {
  query: AdminTransactionsQuery;
  onChange: (next: Partial<AdminTransactionsQuery>) => void;
  onClear: () => void;
}

type DraftType = 'all' | TransactionType;

interface DraftFilters {
  description: string;
  ownerId: string;
  bankName: string;
  accountId: string;
  minAmount: string;
  maxAmount: string;
  dateFrom: string;
  dateTo: string;
  type: DraftType;
}

function draftFromQuery(query: AdminTransactionsQuery): DraftFilters {
  return {
    description: query.description ?? '',
    ownerId: query.ownerId ?? '',
    bankName: query.bankName ?? '',
    accountId: query.accountId ?? '',
    minAmount: query.minAmount !== undefined ? String(query.minAmount) : '',
    maxAmount: query.maxAmount !== undefined ? String(query.maxAmount) : '',
    dateFrom: query.dateFrom ?? '',
    dateTo: query.dateTo ?? '',
    type: query.type ?? 'all',
  };
}

function parseAmount(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function draftToQueryPatch(draft: DraftFilters): Partial<AdminTransactionsQuery> {
  return {
    description: draft.description.trim() || undefined,
    ownerId: draft.ownerId.trim() || undefined,
    bankName: draft.bankName.trim() || undefined,
    accountId: draft.accountId.trim() || undefined,
    minAmount: parseAmount(draft.minAmount),
    maxAmount: parseAmount(draft.maxAmount),
    dateFrom: draft.dateFrom || undefined,
    dateTo: draft.dateTo || undefined,
    type: draft.type === 'all' ? undefined : draft.type,
  };
}

export function AdminTransactionFilters({
  query,
  onChange,
  onClear,
}: AdminTransactionFiltersProps) {
  const [draft, setDraft] = useState<DraftFilters>(() => draftFromQuery(query));

  // Reset the draft whenever the parent query changes (Clear All, browser
  // back/forward, deep-linked URLs).
  useEffect(() => {
    setDraft(draftFromQuery(query));
  }, [query]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      onChange(draftToQueryPatch(draft));
    },
    [draft, onChange],
  );

  const handleDateChange = useCallback((from: string | null, to: string | null) => {
    setDraft((d) => ({ ...d, dateFrom: from ?? '', dateTo: to ?? '' }));
  }, []);

  const handleTypeChange = useCallback((value: string) => {
    setDraft((d) => ({ ...d, type: value as DraftType }));
  }, []);

  const filtersActive = hasActiveFilters(query);

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search description"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            className="pl-9"
          />
        </div>

        <DateRangeFilter
          from={draft.dateFrom || null}
          to={draft.dateTo || null}
          onChange={handleDateChange}
        />

        <Select value={draft.type} onValueChange={handleTypeChange}>
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
            value={draft.minAmount}
            onChange={(e) => setDraft((d) => ({ ...d, minAmount: e.target.value }))}
            className="w-[90px]"
            min="0"
            step="0.01"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            placeholder="Max"
            value={draft.maxAmount}
            onChange={(e) => setDraft((d) => ({ ...d, maxAmount: e.target.value }))}
            className="w-[90px]"
            min="0"
            step="0.01"
          />
        </div>

        <Button type="submit" size="sm" className="h-9 px-3">
          <Search className="mr-1.5 h-4 w-4" />
          Search
        </Button>

        {filtersActive && (
          <>
            <div className="mx-1 h-6 w-px bg-border" />
            <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-9 px-3">
              <X className="mr-1.5 h-4 w-4" />
              Clear all
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-col">
          <Input
            value={draft.ownerId}
            onChange={(e) => setDraft((d) => ({ ...d, ownerId: e.target.value }))}
            placeholder="Filter by owner ID (e.g. usr_test123)"
            className="w-[280px] font-mono text-xs"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Owner ID is an opaque identifier. Email-based lookup is not currently supported.
          </p>
        </div>
        <Input
          value={draft.bankName}
          onChange={(e) => setDraft((d) => ({ ...d, bankName: e.target.value }))}
          placeholder="Filter by bank name…"
          className="w-[200px]"
        />
        <Input
          value={draft.accountId}
          onChange={(e) => setDraft((d) => ({ ...d, accountId: e.target.value }))}
          placeholder="Filter by account ID…"
          className="w-[200px]"
        />
      </div>
    </form>
  );
}
