import { useState, useCallback, FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import type { CurrencySeriesResponse } from '@/types/currency';

interface CurrencyFormProps {
  initialData?: CurrencySeriesResponse;
  onSubmit: (data: { currencyCode: string; providerSeriesId: string; enabled: boolean }) => void;
  isSubmitting: boolean;
  mode: 'create' | 'edit';
}

/**
 * Form for creating or editing a currency
 */
export function CurrencyForm({ initialData, onSubmit, isSubmitting, mode }: CurrencyFormProps) {
  const [currencyCode, setCurrencyCode] = useState(initialData?.currencyCode || '');
  const [providerSeriesId, setProviderSeriesId] = useState(initialData?.providerSeriesId || '');
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      onSubmit({
        currencyCode: currencyCode.trim(),
        providerSeriesId: providerSeriesId.trim(),
        enabled,
      });
    },
    [currencyCode, providerSeriesId, enabled, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Currency Code */}
      <div className="space-y-2">
        <label htmlFor="currencyCode" className="text-sm font-medium">
          Currency Code *
        </label>
        <Input
          id="currencyCode"
          value={currencyCode}
          onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
          placeholder="EUR"
          maxLength={3}
          pattern="[A-Z]{3}"
          disabled={mode === 'edit'} // Currency code is immutable
          required
        />
        <p className="text-xs text-muted-foreground">
          {mode === 'edit'
            ? 'Currency code cannot be changed after creation'
            : 'ISO 4217 three-letter code (e.g., EUR, GBP, JPY)'}
        </p>
      </div>

      {/* FRED Series ID */}
      <div className="space-y-2">
        <label htmlFor="providerSeriesId" className="text-sm font-medium">
          FRED Series ID *
        </label>
        <Input
          id="providerSeriesId"
          value={providerSeriesId}
          onChange={(e) => setProviderSeriesId(e.target.value.toUpperCase())}
          placeholder="DEXUSEU"
          maxLength={50}
          disabled={mode === 'edit'} // FRED series ID is immutable
          required
        />
        <p className="text-xs text-muted-foreground">
          {mode === 'edit'
            ? 'FRED series ID cannot be changed after creation'
            : 'Federal Reserve Economic Data series ID (e.g., DEXUSEU for USD to EUR)'}
        </p>
      </div>

      {/* Enabled Status */}
      <div className="space-y-2">
        <label htmlFor="enabled" className="text-sm font-medium">
          Status *
        </label>
        <Select value={String(enabled)} onValueChange={(val) => setEnabled(val === 'true')}>
          <SelectTrigger id="enabled">
            <SelectValue>{enabled ? 'Enabled' : 'Disabled'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Enabled</SelectItem>
            <SelectItem value="false">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Disabled currencies will not fetch exchange rate data
        </p>
      </div>

      {/* Submit Button */}
      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Currency' : 'Update Currency'}
        </Button>
      </div>
    </form>
  );
}
