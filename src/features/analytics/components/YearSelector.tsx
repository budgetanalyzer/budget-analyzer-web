// src/features/analytics/components/YearSelector.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useRef, useEffect } from 'react';
import { cn } from '@/utils/cn';

interface YearSelectorProps {
  selectedYear: number;
  years: number[];
  onChange: (year: number) => void;
}

const MAX_VISIBLE_YEARS = 5;

export function YearSelector({ selectedYear, years, onChange }: YearSelectorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedButtonRef = useRef<HTMLButtonElement>(null);

  const totalYears = years.length;
  const showArrows = totalYears > MAX_VISIBLE_YEARS;

  // Scroll to selected year on mount and when selected year changes
  useEffect(() => {
    if (selectedButtonRef.current && scrollContainerRef.current) {
      selectedButtonRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedYear]);

  const scrollLeft = useCallback(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.offsetWidth * 0.8;
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  }, []);

  const scrollRight = useCallback(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.offsetWidth * 0.8;
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }, []);

  const handleYearClick = useCallback(
    (year: number) => {
      if (year !== selectedYear) {
        onChange(year);
      }
    },
    [selectedYear, onChange],
  );

  return (
    <div className="flex items-center gap-2">
      {showArrows && (
        <button
          onClick={scrollLeft}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          aria-label="Scroll to earlier years"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      <div
        ref={scrollContainerRef}
        className={cn(
          'flex items-center gap-1 rounded-lg border border-input bg-muted p-1',
          showArrows && 'max-w-md overflow-x-auto scroll-smooth',
          showArrows && '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
        style={{
          scrollSnapType: showArrows ? 'x mandatory' : undefined,
        }}
      >
        {years.map((year) => {
          const isSelected = year === selectedYear;
          return (
            <button
              key={year}
              ref={isSelected ? selectedButtonRef : null}
              onClick={() => handleYearClick(year)}
              className={cn(
                'relative min-w-[4rem] rounded-md px-4 py-2 text-sm font-medium transition-all',
                'scroll-snap-align-center',
                isSelected
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              aria-label={`View analytics for ${year}`}
              aria-pressed={isSelected}
            >
              {year}
            </button>
          );
        })}
      </div>

      {showArrows && (
        <button
          onClick={scrollRight}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          aria-label="Scroll to later years"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
