import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Search, X } from 'lucide-react';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { useDebounce } from '@/hooks/useDebounce';
import type { TransactionType } from '@/types/transaction';
import type { TransactionFilterValues } from '@/types/transactionFilters';
import { hasActiveTransactionFilters } from '@/utils/transactionFilters';

interface TransactionFilterBarProps {
  filters: TransactionFilterValues;
  availableBankNames: string[];
  availableAccountIds: string[];
  onDateFilterChange: (from: string | null, to: string | null) => void;
  onSearchChange: (query: string) => void;
  onBankNameFilterChange: (bankName: string | null) => void;
  onAccountIdFilterChange: (accountId: string | null) => void;
  onTypeFilterChange: (type: TransactionType | null) => void;
  onAmountFilterChange: (min: number | null, max: number | null) => void;
  onClearAllFilters: () => void;
  contextualAction?: ReactNode;
}

interface TransactionSearchInputProps {
  appliedValue: string;
  onSearchChange: (query: string) => void;
}

function TransactionSearchInput({ appliedValue, onSearchChange }: TransactionSearchInputProps) {
  const [draftValue, setDraftValue] = useState(appliedValue);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDraftValue(event.target.value);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        onSearchChange(draftValue);
      }
    },
    [draftValue, onSearchChange],
  );

  const handleClear = useCallback(() => {
    setDraftValue('');
    onSearchChange('');
  }, [onSearchChange]);

  return (
    <div className="relative min-w-[240px] flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search descriptions ↵"
        value={draftValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="pl-9 pr-9"
      />
      {draftValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface AmountFilterInputsProps {
  appliedMin: number | null;
  appliedMax: number | null;
  onAmountFilterChange: (min: number | null, max: number | null) => void;
}

function parseAmountInput(value: string): number | null {
  if (!value) return null;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function AmountFilterInputs({
  appliedMin,
  appliedMax,
  onAmountFilterChange,
}: AmountFilterInputsProps) {
  const [draftMin, setDraftMin] = useState(appliedMin?.toString() ?? '');
  const [draftMax, setDraftMax] = useState(appliedMax?.toString() ?? '');
  const debouncedMin = useDebounce(draftMin, 400);
  const debouncedMax = useDebounce(draftMax, 400);

  useEffect(() => {
    if (debouncedMin !== draftMin || debouncedMax !== draftMax) return;

    const min = parseAmountInput(debouncedMin);
    const max = parseAmountInput(debouncedMax);
    if (min === appliedMin && max === appliedMax) return;

    onAmountFilterChange(min, max);
  }, [
    appliedMax,
    appliedMin,
    debouncedMax,
    debouncedMin,
    draftMax,
    draftMin,
    onAmountFilterChange,
  ]);

  const handleMinChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDraftMin(event.target.value);
  }, []);

  const handleMaxChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDraftMax(event.target.value);
  }, []);

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        aria-label="Minimum amount"
        placeholder="Min"
        value={draftMin}
        onChange={handleMinChange}
        className="w-[80px]"
        min="0"
        step="0.01"
      />
      <span className="text-muted-foreground">-</span>
      <Input
        type="number"
        aria-label="Maximum amount"
        placeholder="Max"
        value={draftMax}
        onChange={handleMaxChange}
        className="w-[80px]"
        min="0"
        step="0.01"
      />
    </div>
  );
}

export function TransactionFilterBar({
  filters,
  availableBankNames,
  availableAccountIds,
  onDateFilterChange,
  onSearchChange,
  onBankNameFilterChange,
  onAccountIdFilterChange,
  onTypeFilterChange,
  onAmountFilterChange,
  onClearAllFilters,
  contextualAction,
}: TransactionFilterBarProps) {
  const handleBankNameChange = useCallback(
    (bankName: string) => {
      onBankNameFilterChange(bankName === 'all' ? null : bankName);
    },
    [onBankNameFilterChange],
  );

  const handleAccountIdChange = useCallback(
    (accountId: string) => {
      onAccountIdFilterChange(accountId === 'all' ? null : accountId);
    },
    [onAccountIdFilterChange],
  );

  const handleTypeChange = useCallback(
    (type: string) => {
      onTypeFilterChange(type === 'all' ? null : (type as TransactionType));
    },
    [onTypeFilterChange],
  );

  const hasActiveFilters = hasActiveTransactionFilters(filters);
  const amountFilterKey = `${filters.amountFilter.min ?? ''}:${filters.amountFilter.max ?? ''}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TransactionSearchInput
        key={filters.globalFilter}
        appliedValue={filters.globalFilter}
        onSearchChange={onSearchChange}
      />
      <DateRangeFilter
        from={filters.dateFilter.from}
        to={filters.dateFilter.to}
        onChange={onDateFilterChange}
      />
      {availableBankNames.length > 1 && (
        <Select value={filters.bankNameFilter ?? 'all'} onValueChange={handleBankNameChange}>
          <SelectTrigger className="w-[150px]" aria-label="Filter by bank">
            <SelectValue placeholder="All Banks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Banks</SelectItem>
            {availableBankNames.map((bank) => (
              <SelectItem key={bank} value={bank}>
                {bank}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {availableAccountIds.length > 1 && (
        <Select value={filters.accountIdFilter ?? 'all'} onValueChange={handleAccountIdChange}>
          <SelectTrigger className="w-[150px]" aria-label="Filter by account">
            <SelectValue placeholder="All Accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {availableAccountIds.map((account) => (
              <SelectItem key={account} value={account}>
                {account}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={filters.typeFilter ?? 'all'} onValueChange={handleTypeChange}>
        <SelectTrigger className="w-[100px]" aria-label="Filter by transaction type">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="DEBIT">Debit</SelectItem>
          <SelectItem value="CREDIT">Credit</SelectItem>
        </SelectContent>
      </Select>
      <AmountFilterInputs
        key={amountFilterKey}
        appliedMin={filters.amountFilter.min}
        appliedMax={filters.amountFilter.max}
        onAmountFilterChange={onAmountFilterChange}
      />
      {hasActiveFilters && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />
          <Button variant="ghost" size="sm" onClick={onClearAllFilters} className="h-9 px-3">
            <X className="mr-1.5 h-4 w-4" />
            Clear
          </Button>
          {contextualAction}
        </>
      )}
    </div>
  );
}
