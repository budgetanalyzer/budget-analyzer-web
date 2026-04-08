// src/features/admin/transactions/components/TransactionSearchFiltersPanel.tsx
import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
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
import type { TransactionSearchQuery } from '@/types/transactionSearch';
import type { TransactionType } from '@/types/transaction';
import { hasActiveFilters } from '@/features/admin/transactions/utils/urlState';
import { cn } from '@/utils/cn';

interface TransactionSearchFiltersPanelProps {
  query: TransactionSearchQuery;
  onChange: (next: Partial<TransactionSearchQuery>) => void;
  onClear: () => void;
}

type DraftType = 'all' | TransactionType;

interface DraftFilters {
  description: string;
  bankName: string;
  accountId: string;
  minAmount: string;
  maxAmount: string;
  dateFrom: string;
  dateTo: string;
  type: DraftType;
}

function draftFromQuery(query: TransactionSearchQuery): DraftFilters {
  return {
    description: query.description ?? '',
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

function draftToQueryPatch(draft: DraftFilters): Partial<TransactionSearchQuery> {
  return {
    description: draft.description.trim() || undefined,
    bankName: draft.bankName.trim() || undefined,
    accountId: draft.accountId.trim() || undefined,
    minAmount: parseAmount(draft.minAmount),
    maxAmount: parseAmount(draft.maxAmount),
    dateFrom: draft.dateFrom || undefined,
    dateTo: draft.dateTo || undefined,
    type: draft.type === 'all' ? undefined : draft.type,
  };
}

/**
 * Filters tucked behind the "More filters" disclosure. Used both to decide
 * whether to auto-open the panel on mount/query change and to render a count
 * badge on the toggle button.
 */
function countAdvancedFilters(query: TransactionSearchQuery): number {
  let count = 0;
  if (query.type !== undefined) count += 1;
  if (query.minAmount !== undefined) count += 1;
  if (query.maxAmount !== undefined) count += 1;
  if (query.bankName !== undefined && query.bankName !== '') count += 1;
  if (query.accountId !== undefined && query.accountId !== '') count += 1;
  return count;
}

export function TransactionSearchFiltersPanel({
  query,
  onChange,
  onClear,
}: TransactionSearchFiltersPanelProps) {
  const [draft, setDraft] = useState<DraftFilters>(() => draftFromQuery(query));
  const [showMore, setShowMore] = useState<boolean>(() => countAdvancedFilters(query) > 0);

  // Reset the draft whenever the parent query changes (Clear All, browser
  // back/forward, deep-linked URLs).
  useEffect(() => {
    setDraft(draftFromQuery(query));
  }, [query]);

  // Auto-open the disclosure when incoming query has hidden filters so the
  // user can see what's active. Never auto-close — let the user collapse it.
  useEffect(() => {
    if (countAdvancedFilters(query) > 0) {
      setShowMore(true);
    }
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
  const advancedCount = countAdvancedFilters(query);

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

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowMore((s) => !s)}
          aria-expanded={showMore}
          aria-controls="admin-txn-more-filters"
          className="h-9 px-3"
        >
          <SlidersHorizontal className="mr-1.5 h-4 w-4" />
          More filters
          {advancedCount > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary/15 px-1.5 text-xs font-semibold text-primary">
              {advancedCount}
            </span>
          )}
          <ChevronDown
            className={cn('ml-1 h-4 w-4 transition-transform', showMore && 'rotate-180')}
          />
        </Button>
      </div>

      {showMore && (
        <div
          id="admin-txn-more-filters"
          className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-3"
        >
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
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="h-9 px-3">
          <Search className="mr-1.5 h-4 w-4" />
          Search
        </Button>

        <div className="mx-1 h-6 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={!filtersActive}
          className="h-9 px-3"
        >
          <X className="mr-1.5 h-4 w-4" />
          Clear all
        </Button>
      </div>
    </form>
  );
}
