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
  const { data: currencies, isLoading } = useCurrencies();

  const handleCurrencyChange = (currency: string) => {
    dispatch(setDisplayCurrency(currency));
  };

  if (isLoading || !currencies || currencies.length === 0) {
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
          {currencies.map((currency) => (
            <DropdownMenuItem
              key={currency}
              onClick={() => handleCurrencyChange(currency)}
              className={currency === displayCurrency ? 'bg-accent' : ''}
            >
              {currency}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
