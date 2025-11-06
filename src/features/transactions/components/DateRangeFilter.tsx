// src/features/transactions/components/DateRangeFilter.tsx
import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/Input';

interface DateRangeFilterProps {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}

export function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  const handleFromChange = (value: string) => {
    onChange(value || null, to);
  };

  const handleToChange = (value: string) => {
    onChange(from, value || null);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="date"
          value={from || ''}
          onChange={(e) => handleFromChange(e.target.value)}
          placeholder="From date"
          className="w-[160px] pl-9"
        />
      </div>
      <span className="text-sm text-muted-foreground">to</span>
      <Input
        type="date"
        value={to || ''}
        onChange={(e) => handleToChange(e.target.value)}
        placeholder="To date"
        className="w-[160px]"
      />
    </div>
  );
}
