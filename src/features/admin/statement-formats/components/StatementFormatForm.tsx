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
import type { StatementFormat, FormatType } from '@/types/statementFormat';

interface StatementFormatFormData {
  formatKey: string;
  displayName: string;
  formatType: FormatType;
  bankName: string;
  defaultCurrencyIsoCode: string;
  dateHeader?: string;
  dateFormat?: string;
  descriptionHeader?: string;
  creditHeader?: string;
  debitHeader?: string;
  typeHeader?: string;
  categoryHeader?: string;
  enabled: boolean;
}

interface StatementFormatFormProps {
  initialData?: StatementFormat;
  onSubmit: (data: StatementFormatFormData) => void;
  isSubmitting: boolean;
  mode: 'create' | 'edit';
}

const FORMAT_TYPE_OPTIONS: { value: FormatType; label: string }[] = [
  { value: 'CSV', label: 'CSV' },
  { value: 'PDF', label: 'PDF' },
  { value: 'XLSX', label: 'Excel (XLSX)' },
];

/**
 * Form for creating or editing a statement format
 */
export function StatementFormatForm({
  initialData,
  onSubmit,
  isSubmitting,
  mode,
}: StatementFormatFormProps) {
  const [formatKey, setFormatKey] = useState(initialData?.formatKey || '');
  const [displayName, setDisplayName] = useState(initialData?.displayName || '');
  const [formatType, setFormatType] = useState<FormatType>(initialData?.formatType || 'CSV');
  const [bankName, setBankName] = useState(initialData?.bankName || '');
  const [defaultCurrencyIsoCode, setDefaultCurrencyIsoCode] = useState(
    initialData?.defaultCurrencyIsoCode || '',
  );
  const [dateHeader, setDateHeader] = useState(initialData?.dateHeader || '');
  const [dateFormat, setDateFormat] = useState(initialData?.dateFormat || '');
  const [descriptionHeader, setDescriptionHeader] = useState(initialData?.descriptionHeader || '');
  const [creditHeader, setCreditHeader] = useState(initialData?.creditHeader || '');
  const [debitHeader, setDebitHeader] = useState(initialData?.debitHeader || '');
  const [typeHeader, setTypeHeader] = useState(initialData?.typeHeader || '');
  const [categoryHeader, setCategoryHeader] = useState(initialData?.categoryHeader || '');
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);

  const isCsv = formatType === 'CSV';

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      onSubmit({
        formatKey: formatKey.trim().toLowerCase(),
        displayName: displayName.trim(),
        formatType,
        bankName: bankName.trim(),
        defaultCurrencyIsoCode: defaultCurrencyIsoCode.trim().toUpperCase(),
        dateHeader: isCsv && dateHeader.trim() ? dateHeader.trim() : undefined,
        dateFormat: dateFormat.trim() || undefined,
        descriptionHeader: isCsv && descriptionHeader.trim() ? descriptionHeader.trim() : undefined,
        creditHeader: isCsv && creditHeader.trim() ? creditHeader.trim() : undefined,
        debitHeader: isCsv && debitHeader.trim() ? debitHeader.trim() : undefined,
        typeHeader: isCsv && typeHeader.trim() ? typeHeader.trim() : undefined,
        categoryHeader: isCsv && categoryHeader.trim() ? categoryHeader.trim() : undefined,
        enabled,
      });
    },
    [
      formatKey,
      displayName,
      formatType,
      bankName,
      defaultCurrencyIsoCode,
      dateHeader,
      dateFormat,
      descriptionHeader,
      creditHeader,
      debitHeader,
      typeHeader,
      categoryHeader,
      enabled,
      isCsv,
      onSubmit,
    ],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Format Key */}
      <div className="space-y-2">
        <label htmlFor="formatKey" className="text-sm font-medium">
          Format Key *
        </label>
        <Input
          id="formatKey"
          value={formatKey}
          onChange={(e) => setFormatKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          placeholder="chase-csv"
          maxLength={50}
          pattern="^[a-z0-9-]+$"
          disabled={mode === 'edit'}
          required
        />
        <p className="text-xs text-muted-foreground">
          {mode === 'edit'
            ? 'Format key cannot be changed after creation'
            : 'Unique identifier using lowercase letters, numbers, and hyphens only'}
        </p>
      </div>

      {/* Display Name */}
      <div className="space-y-2">
        <label htmlFor="displayName" className="text-sm font-medium">
          Display Name *
        </label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Chase CSV"
          maxLength={100}
          required
        />
        <p className="text-xs text-muted-foreground">
          Human-readable name shown in dropdowns and lists
        </p>
      </div>

      {/* Format Type */}
      <div className="space-y-2">
        <label htmlFor="formatType" className="text-sm font-medium">
          Format Type *
        </label>
        <Select value={formatType} onValueChange={(val) => setFormatType(val as FormatType)}>
          <SelectTrigger id="formatType" disabled={mode === 'edit'}>
            <SelectValue>
              {FORMAT_TYPE_OPTIONS.find((o) => o.value === formatType)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {FORMAT_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {mode === 'edit'
            ? 'Format type cannot be changed after creation'
            : 'The file format this configuration applies to'}
        </p>
      </div>

      {/* Bank Name */}
      <div className="space-y-2">
        <label htmlFor="bankName" className="text-sm font-medium">
          Bank Name *
        </label>
        <Input
          id="bankName"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          placeholder="Chase"
          maxLength={100}
          required
        />
        <p className="text-xs text-muted-foreground">
          The financial institution this format is for
        </p>
      </div>

      {/* Default Currency */}
      <div className="space-y-2">
        <label htmlFor="defaultCurrencyIsoCode" className="text-sm font-medium">
          Default Currency *
        </label>
        <Input
          id="defaultCurrencyIsoCode"
          value={defaultCurrencyIsoCode}
          onChange={(e) => setDefaultCurrencyIsoCode(e.target.value.toUpperCase())}
          placeholder="USD"
          maxLength={3}
          minLength={3}
          pattern="[A-Z]{3}"
          required
        />
        <p className="text-xs text-muted-foreground">
          ISO 4217 three-letter currency code (e.g., USD, EUR, THB)
        </p>
      </div>

      {/* CSV-specific fields */}
      {isCsv && (
        <>
          <div className="border-t pt-6">
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              CSV Column Headers
            </h3>

            {/* Date Header */}
            <div className="space-y-2 mb-4">
              <label htmlFor="dateHeader" className="text-sm font-medium">
                Date Column Header *
              </label>
              <Input
                id="dateHeader"
                value={dateHeader}
                onChange={(e) => setDateHeader(e.target.value)}
                placeholder="Transaction Date"
                maxLength={50}
                required={isCsv}
              />
            </div>

            {/* Date Format */}
            <div className="space-y-2 mb-4">
              <label htmlFor="dateFormat" className="text-sm font-medium">
                Date Format
              </label>
              <Input
                id="dateFormat"
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                placeholder="MM/dd/yyyy"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Java date format pattern (e.g., MM/dd/yyyy, yyyy-MM-dd)
              </p>
            </div>

            {/* Description Header */}
            <div className="space-y-2 mb-4">
              <label htmlFor="descriptionHeader" className="text-sm font-medium">
                Description Column Header *
              </label>
              <Input
                id="descriptionHeader"
                value={descriptionHeader}
                onChange={(e) => setDescriptionHeader(e.target.value)}
                placeholder="Description"
                maxLength={50}
                required={isCsv}
              />
            </div>

            {/* Credit Header */}
            <div className="space-y-2 mb-4">
              <label htmlFor="creditHeader" className="text-sm font-medium">
                Credit/Amount Column Header *
              </label>
              <Input
                id="creditHeader"
                value={creditHeader}
                onChange={(e) => setCreditHeader(e.target.value)}
                placeholder="Credit"
                maxLength={50}
                required={isCsv}
              />
              <p className="text-xs text-muted-foreground">
                Column for credit amounts (or combined amount column)
              </p>
            </div>

            {/* Debit Header */}
            <div className="space-y-2 mb-4">
              <label htmlFor="debitHeader" className="text-sm font-medium">
                Debit Column Header
              </label>
              <Input
                id="debitHeader"
                value={debitHeader}
                onChange={(e) => setDebitHeader(e.target.value)}
                placeholder="Debit"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Optional separate column for debit amounts
              </p>
            </div>

            {/* Type Header */}
            <div className="space-y-2 mb-4">
              <label htmlFor="typeHeader" className="text-sm font-medium">
                Type Column Header
              </label>
              <Input
                id="typeHeader"
                value={typeHeader}
                onChange={(e) => setTypeHeader(e.target.value)}
                placeholder="Type"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Optional column indicating transaction type
              </p>
            </div>

            {/* Category Header */}
            <div className="space-y-2">
              <label htmlFor="categoryHeader" className="text-sm font-medium">
                Category Column Header
              </label>
              <Input
                id="categoryHeader"
                value={categoryHeader}
                onChange={(e) => setCategoryHeader(e.target.value)}
                placeholder="Category"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Optional column for transaction category
              </p>
            </div>
          </div>
        </>
      )}

      {/* Enabled Status - only shown in edit mode */}
      {mode === 'edit' && (
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
            Disabled formats will not be available for transaction imports
          </p>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex gap-4 pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Format' : 'Update Format'}
        </Button>
      </div>
    </form>
  );
}
