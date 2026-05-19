import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StatementFormatForm } from '@/features/admin/statement-formats/components/StatementFormatForm';

describe('StatementFormatForm', () => {
  it('applies the OpenAPI-backed constraints for creating a CSV statement format', () => {
    render(<StatementFormatForm onSubmit={vi.fn()} isSubmitting={false} mode="create" />);

    const formatKeyInput = screen.getByLabelText(/Format Key/);
    const displayNameInput = screen.getByLabelText(/Display Name/);
    const bankNameInput = screen.getByLabelText(/Bank Name/);
    const currencyInput = screen.getByLabelText(/Default Currency/);
    const dateHeaderInput = screen.getByLabelText(/Date Column Header/);
    const dateFormatInput = screen.getByLabelText(/Date Format/);
    const descriptionHeaderInput = screen.getByLabelText(/Description Column Header/);
    const creditHeaderInput = screen.getByLabelText(/Credit\/Amount Column Header/);
    const debitHeaderInput = screen.getByLabelText(/Debit Column Header/);
    const typeHeaderInput = screen.getByLabelText(/Type Column Header/);
    const categoryHeaderInput = screen.getByLabelText(/Category Column Header/);

    expect(formatKeyInput).toHaveAttribute('required');
    expect(formatKeyInput).toHaveAttribute('maxLength', '50');
    expect(formatKeyInput).toHaveAttribute('pattern', '^[a-z0-9-]+$');
    expect(displayNameInput).toHaveAttribute('required');
    expect(displayNameInput).toHaveAttribute('maxLength', '100');
    expect(bankNameInput).toHaveAttribute('required');
    expect(bankNameInput).toHaveAttribute('maxLength', '100');
    expect(currencyInput).toHaveAttribute('required');
    expect(currencyInput).toHaveAttribute('maxLength', '3');
    expect(currencyInput).toHaveAttribute('minLength', '3');
    expect(currencyInput).toHaveAttribute('pattern', '[A-Z]{3}');
    expect(dateHeaderInput).toHaveAttribute('required');
    expect(descriptionHeaderInput).toHaveAttribute('required');
    expect(creditHeaderInput).toHaveAttribute('required');
    expect(dateHeaderInput).toHaveAttribute('maxLength', '50');
    expect(dateFormatInput).toHaveAttribute('maxLength', '50');
    expect(descriptionHeaderInput).toHaveAttribute('maxLength', '50');
    expect(creditHeaderInput).toHaveAttribute('maxLength', '50');
    expect(debitHeaderInput).toHaveAttribute('maxLength', '50');
    expect(typeHeaderInput).toHaveAttribute('maxLength', '50');
    expect(categoryHeaderInput).toHaveAttribute('maxLength', '50');
  });

  it('submits normalized CSV create values with column mappings', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<StatementFormatForm onSubmit={onSubmit} isSubmitting={false} mode="create" />);

    await user.type(screen.getByLabelText(/Format Key/), 'Acme_CSV!');
    await user.type(screen.getByLabelText(/Display Name/), '  Acme CSV  ');
    await user.type(screen.getByLabelText(/Bank Name/), '  Acme Bank  ');
    await user.type(screen.getByLabelText(/Default Currency/), 'usd');
    await user.type(screen.getByLabelText(/Date Column Header/), '  Posted Date  ');
    await user.type(screen.getByLabelText(/Date Format/), '  MM/dd/yyyy  ');
    await user.type(screen.getByLabelText(/Description Column Header/), '  Memo  ');
    await user.type(screen.getByLabelText(/Credit\/Amount Column Header/), '  Amount  ');
    await user.type(screen.getByLabelText(/Debit Column Header/), '  Debit  ');
    await user.type(screen.getByLabelText(/Type Column Header/), '  Type  ');
    await user.type(screen.getByLabelText(/Category Column Header/), '  Category  ');
    await user.click(screen.getByRole('button', { name: 'Create Format' }));

    expect(onSubmit).toHaveBeenCalledWith({
      formatKey: 'acmecsv',
      displayName: 'Acme CSV',
      formatType: 'CSV',
      bankName: 'Acme Bank',
      defaultCurrencyIsoCode: 'USD',
      dateHeader: 'Posted Date',
      dateFormat: 'MM/dd/yyyy',
      descriptionHeader: 'Memo',
      creditHeader: 'Amount',
      debitHeader: 'Debit',
      typeHeader: 'Type',
      categoryHeader: 'Category',
      enabled: true,
    });
  });

  it('omits CSV column mappings when a non-CSV format is selected', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<StatementFormatForm onSubmit={onSubmit} isSubmitting={false} mode="create" />);

    await user.type(screen.getByLabelText(/Format Key/), 'statement-pdf');
    await user.type(screen.getByLabelText(/Display Name/), 'Statement PDF');
    await user.click(screen.getByRole('button', { name: /Format Type/ }));
    await user.click(screen.getByRole('button', { name: 'PDF' }));
    await user.type(screen.getByLabelText(/Bank Name/), 'Acme Bank');
    await user.type(screen.getByLabelText(/Default Currency/), 'eur');

    expect(screen.queryByLabelText(/Date Column Header/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create Format' }));

    expect(onSubmit).toHaveBeenCalledWith({
      formatKey: 'statement-pdf',
      displayName: 'Statement PDF',
      formatType: 'PDF',
      bankName: 'Acme Bank',
      defaultCurrencyIsoCode: 'EUR',
      dateHeader: undefined,
      dateFormat: undefined,
      descriptionHeader: undefined,
      creditHeader: undefined,
      debitHeader: undefined,
      typeHeader: undefined,
      categoryHeader: undefined,
      enabled: true,
    });
  });

  it('loads immutable edit fields and submits mutable values including status', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <StatementFormatForm
        initialData={{
          id: 7,
          formatKey: 'acme-csv',
          displayName: 'Acme CSV',
          formatType: 'CSV',
          bankName: 'Acme Bank',
          defaultCurrencyIsoCode: 'USD',
          dateHeader: 'Date',
          dateFormat: 'MM/dd/yyyy',
          descriptionHeader: 'Description',
          creditHeader: 'Credit',
          debitHeader: 'Debit',
          typeHeader: 'Type',
          categoryHeader: 'Category',
          enabled: true,
        }}
        onSubmit={onSubmit}
        isSubmitting={false}
        mode="edit"
      />,
    );

    expect(screen.getByLabelText(/Format Key/)).toHaveValue('acme-csv');
    expect(screen.getByLabelText(/Format Key/)).toBeDisabled();
    expect(screen.getByRole('button', { name: /Format Type/ })).toBeDisabled();

    await user.clear(screen.getByLabelText(/Display Name/));
    await user.type(screen.getByLabelText(/Display Name/), 'Acme CSV Updated');
    await user.clear(screen.getByLabelText(/Bank Name/));
    await user.type(screen.getByLabelText(/Bank Name/), 'Acme Credit');
    await user.click(screen.getByRole('button', { name: /Status/ }));
    await user.click(screen.getByRole('button', { name: 'Disabled' }));
    await user.click(screen.getByRole('button', { name: 'Update Format' }));

    expect(onSubmit).toHaveBeenCalledWith({
      formatKey: 'acme-csv',
      displayName: 'Acme CSV Updated',
      formatType: 'CSV',
      bankName: 'Acme Credit',
      defaultCurrencyIsoCode: 'USD',
      dateHeader: 'Date',
      dateFormat: 'MM/dd/yyyy',
      descriptionHeader: 'Description',
      creditHeader: 'Credit',
      debitHeader: 'Debit',
      typeHeader: 'Type',
      categoryHeader: 'Category',
      enabled: false,
    });
  });

  it('disables submit while saving', () => {
    render(<StatementFormatForm onSubmit={vi.fn()} isSubmitting={true} mode="create" />);

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });
});
