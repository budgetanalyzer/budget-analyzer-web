import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatementFormatWizardDialog } from '@/components/statement-formats/StatementFormatWizardDialog';
import { renderWithProviders } from '@/testing/test-utils';
import type { StatementFormat } from '@/types/statementFormat';

vi.mock('@/components/statement-formats/csv-wizard/CsvStatementFormatWizardDialog', () => ({
  CsvStatementFormatWizardDialog: ({
    open,
    initialFile,
    onSaved,
  }: {
    open: boolean;
    initialFile?: File;
    onSaved: (format: StatementFormat) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="CSV child">
        <p>CSV sample: {initialFile?.name}</p>
        <button
          type="button"
          onClick={() =>
            onSaved({
              id: 99,
              displayName: 'Custom CSV',
              formatType: 'CSV',
              bankName: 'Example Bank',
              defaultCurrencyIsoCode: 'USD',
              scope: 'USER',
              enabled: true,
            })
          }
        >
          Save CSV child
        </button>
      </div>
    ) : null,
}));

vi.mock('@/components/statement-formats/pdf-wizard/PdfStatementFormatWizardDialog', () => ({
  PdfStatementFormatWizardDialog: ({
    open,
    initialFile,
    onSaved,
  }: {
    open: boolean;
    initialFile?: File;
    onSaved: (format: StatementFormat) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="PDF child">
        <p>PDF sample: {initialFile?.name}</p>
        <button
          type="button"
          onClick={() =>
            onSaved({
              id: 100,
              displayName: 'Custom PDF',
              formatType: 'PDF',
              bankName: 'Example Bank',
              defaultCurrencyIsoCode: 'USD',
              scope: 'USER',
              enabled: true,
            })
          }
        >
          Save PDF child
        </button>
      </div>
    ) : null,
}));

function WizardHarness({ onSaved }: { onSaved: (format: StatementFormat) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open wizard
      </button>
      <StatementFormatWizardDialog open={open} onOpenChange={setOpen} onSaved={onSaved} />
    </>
  );
}

describe('StatementFormatWizardDialog', () => {
  it('routes a CSV sample directly to the CSV child wizard', async () => {
    const user = userEvent.setup();
    const file = new File(['date,amount'], 'sample.csv', { type: 'text/csv' });

    renderWithProviders(<WizardHarness onSaved={vi.fn()} />);

    await user.upload(screen.getByLabelText('Sample file'), file);

    expect(await screen.findByRole('dialog', { name: 'CSV child' })).toBeInTheDocument();
    expect(screen.getByText('CSV sample: sample.csv')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue/ })).not.toBeInTheDocument();
  });

  it('closes and resets the selected sample after a PDF child saves', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });

    renderWithProviders(<WizardHarness onSaved={onSaved} />);

    await user.upload(screen.getByLabelText('Sample file'), file);

    expect(await screen.findByRole('dialog', { name: 'PDF child' })).toBeInTheDocument();
    expect(screen.getByText('PDF sample: sample.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save PDF child' }));

    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 100,
        formatType: 'PDF',
      }),
    );
    expect(screen.queryByRole('dialog', { name: 'PDF child' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open wizard' }));

    expect(screen.getByRole('heading', { name: 'Create statement format' })).toBeInTheDocument();
    expect(screen.getByLabelText('Sample file')).toBeInTheDocument();
    expect(screen.queryByText('Selected file: sample.pdf')).not.toBeInTheDocument();
  });
});
