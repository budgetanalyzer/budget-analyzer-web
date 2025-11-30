// src/components/CurrencySelector.tsx
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/DropdownMenu';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setDisplayCurrency } from '@/store/uiSlice';
import { useCurrencies } from '@/hooks/useCurrencies';

export function CurrencySelector() {
  const dispatch = useAppDispatch();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);
  const { data: currencies, isLoading } = useCurrencies(true); // Only show enabled currencies

  const handleCurrencyChange = (currency: string) => {
    dispatch(setDisplayCurrency(currency));
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <span className="font-medium">{displayCurrency}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* USD is always first - it's the base currency with no exchange rates */}
          <DropdownMenuItem
            key="USD"
            onClick={() => handleCurrencyChange('USD')}
            className={displayCurrency === 'USD' ? 'bg-accent' : ''}
          >
            USD
          </DropdownMenuItem>
          {/* Then show all other enabled currencies */}
          {currencies?.map((currencySeries) => (
            <DropdownMenuItem
              key={currencySeries.id}
              onClick={() => handleCurrencyChange(currencySeries.currencyCode)}
              className={currencySeries.currencyCode === displayCurrency ? 'bg-accent' : ''}
            >
              {currencySeries.currencyCode}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
