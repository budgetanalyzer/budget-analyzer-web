// src/components/ViewModeSelector.tsx
import { cn } from '@/lib/utils';

interface ViewModeSelectorProps {
  selectedMode: 'monthly' | 'yearly';
  onChange: (mode: 'monthly' | 'yearly') => void;
}

export function ViewModeSelector({ selectedMode, onChange }: ViewModeSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-input bg-muted p-1">
      <button
        onClick={() => onChange('monthly')}
        className={cn(
          'relative min-w-[4rem] rounded-md px-4 py-2 text-sm font-medium transition-all',
          selectedMode === 'monthly'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="View monthly analytics"
        aria-pressed={selectedMode === 'monthly'}
      >
        Monthly
      </button>
      <button
        onClick={() => onChange('yearly')}
        className={cn(
          'relative min-w-[4rem] rounded-md px-4 py-2 text-sm font-medium transition-all',
          selectedMode === 'yearly'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="View yearly analytics"
        aria-pressed={selectedMode === 'yearly'}
      >
        Yearly
      </button>
    </div>
  );
}
