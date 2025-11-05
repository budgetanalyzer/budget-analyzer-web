// src/components/TransactionTypeSelector.tsx
import { cn } from '@/lib/utils';

interface TransactionTypeSelectorProps {
  selectedType: 'debit' | 'credit';
  onChange: (type: 'debit' | 'credit') => void;
}

export function TransactionTypeSelector({ selectedType, onChange }: TransactionTypeSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-input bg-muted p-1">
      <button
        onClick={() => onChange('debit')}
        className={cn(
          'relative min-w-[4rem] rounded-md px-4 py-2 text-sm font-medium transition-all',
          selectedType === 'debit'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="View debit transactions"
        aria-pressed={selectedType === 'debit'}
      >
        Debit
      </button>
      <button
        onClick={() => onChange('credit')}
        className={cn(
          'relative min-w-[4rem] rounded-md px-4 py-2 text-sm font-medium transition-all',
          selectedType === 'credit'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="View credit transactions"
        aria-pressed={selectedType === 'credit'}
      >
        Credit
      </button>
    </div>
  );
}
