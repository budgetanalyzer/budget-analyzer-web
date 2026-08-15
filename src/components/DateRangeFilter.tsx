// src/components/DateRangeFilter.tsx
import { useCallback, type ChangeEvent } from 'react';
import { Input } from '@/components/ui/Input';

interface DateRangeFilterProps {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}

export function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  const handleFromChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value || null, to);
    },
    [onChange, to],
  );

  const handleToChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(from, event.target.value || null);
    },
    [from, onChange],
  );

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={from || ''}
        onChange={handleFromChange}
        placeholder="From date"
        className="w-[160px]"
      />
      <span className="text-sm text-muted-foreground">to</span>
      <Input
        type="date"
        value={to || ''}
        onChange={handleToChange}
        placeholder="To date"
        className="w-[160px]"
      />
    </div>
  );
}
