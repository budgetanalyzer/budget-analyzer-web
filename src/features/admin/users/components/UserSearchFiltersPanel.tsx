// src/features/admin/users/components/UserSearchFiltersPanel.tsx
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
import type { UserSearchQuery, UserStatus } from '@/types/user';
import { hasActiveFilters } from '@/features/admin/users/utils/urlState';
import { cn } from '@/utils/cn';
import {
  isoTimestampToLocalDateInputValue,
  localDateToEndOfDayISOTimestamp,
  localDateToStartOfDayISOTimestamp,
} from '@/utils/dates';

interface UserSearchFiltersPanelProps {
  query: UserSearchQuery;
  onChange: (next: Partial<UserSearchQuery>) => void;
  onClear: () => void;
}

type DraftStatus = 'all' | UserStatus;

interface DraftFilters {
  email: string;
  displayName: string;
  id: string;
  idpSub: string;
  status: DraftStatus;
  createdFromDate: string; // YYYY-MM-DD as produced by DateRangeFilter
  createdToDate: string; // YYYY-MM-DD as produced by DateRangeFilter
}

function draftFromQuery(query: UserSearchQuery): DraftFilters {
  return {
    email: query.email ?? '',
    displayName: query.displayName ?? '',
    id: query.id ?? '',
    idpSub: query.idpSub ?? '',
    status: query.status ?? 'all',
    createdFromDate: query.createdAfter
      ? isoTimestampToLocalDateInputValue(query.createdAfter)
      : '',
    createdToDate: query.createdBefore
      ? isoTimestampToLocalDateInputValue(query.createdBefore)
      : '',
  };
}

function draftToQueryPatch(draft: DraftFilters): Partial<UserSearchQuery> {
  const createdAfter = draft.createdFromDate
    ? localDateToStartOfDayISOTimestamp(draft.createdFromDate)
    : undefined;
  const createdBefore = draft.createdToDate
    ? localDateToEndOfDayISOTimestamp(draft.createdToDate)
    : undefined;
  return {
    email: draft.email.trim() || undefined,
    displayName: draft.displayName.trim() || undefined,
    id: draft.id.trim() || undefined,
    idpSub: draft.idpSub.trim() || undefined,
    status: draft.status === 'all' ? undefined : draft.status,
    createdAfter,
    createdBefore,
  };
}

/**
 * Filters tucked behind the "More filters" disclosure. Used both to decide
 * whether to auto-open the panel on mount/query change and to render a count
 * badge on the toggle button.
 */
function countAdvancedFilters(query: UserSearchQuery): number {
  let count = 0;
  if (query.displayName !== undefined && query.displayName !== '') count += 1;
  if (query.id !== undefined && query.id !== '') count += 1;
  if (query.idpSub !== undefined && query.idpSub !== '') count += 1;
  if (query.createdAfter !== undefined && query.createdAfter !== '') count += 1;
  if (query.createdBefore !== undefined && query.createdBefore !== '') count += 1;
  return count;
}

export function UserSearchFiltersPanel({ query, onChange, onClear }: UserSearchFiltersPanelProps) {
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
    setDraft((d) => ({ ...d, createdFromDate: from ?? '', createdToDate: to ?? '' }));
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setDraft((d) => ({ ...d, status: value as DraftStatus }));
  }, []);

  const filtersActive = hasActiveFilters(query);
  const advancedCount = countAdvancedFilters(query);

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search email"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            className="pl-9"
          />
        </div>

        <Select value={draft.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="DEACTIVATED">Deactivated</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowMore((s) => !s)}
          aria-expanded={showMore}
          aria-controls="admin-user-more-filters"
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
          id="admin-user-more-filters"
          className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-3"
        >
          <Input
            value={draft.displayName}
            onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
            placeholder="Filter by display name…"
            className="w-[220px]"
          />
          <Input
            value={draft.id}
            onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
            placeholder="Filter by user ID…"
            className="w-[200px]"
          />
          <Input
            value={draft.idpSub}
            onChange={(e) => setDraft((d) => ({ ...d, idpSub: e.target.value }))}
            placeholder="Filter by IdP subject…"
            className="w-[240px]"
          />

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Created</span>
            <DateRangeFilter
              from={draft.createdFromDate || null}
              to={draft.createdToDate || null}
              onChange={handleDateChange}
            />
          </div>
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
