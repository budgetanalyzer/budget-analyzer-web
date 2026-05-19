import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CurrencyForm } from '@/features/admin/currencies/components/CurrencyForm';

describe('CurrencyForm', () => {
  it('applies the OpenAPI-backed constraints for creating a currency', () => {
    render(<CurrencyForm onSubmit={vi.fn()} isSubmitting={false} mode="create" />);

    const currencyCodeInput = screen.getByLabelText(/Currency Code/);
    const providerSeriesInput = screen.getByLabelText(/FRED Series ID/);

    expect(currencyCodeInput).toHaveAttribute('required');
    expect(currencyCodeInput).toHaveAttribute('maxLength', '3');
    expect(currencyCodeInput).toHaveAttribute('pattern', '[A-Z]{3}');
    expect(providerSeriesInput).toHaveAttribute('required');
    expect(providerSeriesInput).toHaveAttribute('maxLength', '50');
  });

  it('submits normalized create values including the selected enabled flag', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<CurrencyForm onSubmit={onSubmit} isSubmitting={false} mode="create" />);

    await user.type(screen.getByLabelText(/Currency Code/), 'cad');
    await user.type(screen.getByLabelText(/FRED Series ID/), 'dexcaus');
    await user.click(screen.getByRole('button', { name: /Status/ }));
    await user.click(screen.getByRole('button', { name: 'Disabled' }));
    await user.click(screen.getByRole('button', { name: 'Create Currency' }));

    expect(onSubmit).toHaveBeenCalledWith({
      currencyCode: 'CAD',
      providerSeriesId: 'DEXCAUS',
      enabled: false,
    });
  });

  it('loads immutable edit fields and submits only through the edit workflow', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <CurrencyForm
        initialData={{
          id: 42,
          currencyCode: 'GBP',
          providerSeriesId: 'DEXUSUK',
          enabled: true,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
        }}
        onSubmit={onSubmit}
        isSubmitting={false}
        mode="edit"
      />,
    );

    expect(screen.getByLabelText(/Currency Code/)).toHaveValue('GBP');
    expect(screen.getByLabelText(/Currency Code/)).toBeDisabled();
    expect(screen.getByLabelText(/FRED Series ID/)).toHaveValue('DEXUSUK');
    expect(screen.getByLabelText(/FRED Series ID/)).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Status/ }));
    await user.click(screen.getByRole('button', { name: 'Disabled' }));
    await user.click(screen.getByRole('button', { name: 'Update Currency' }));

    expect(onSubmit).toHaveBeenCalledWith({
      currencyCode: 'GBP',
      providerSeriesId: 'DEXUSUK',
      enabled: false,
    });
  });

  it('disables submit while saving', () => {
    render(<CurrencyForm onSubmit={vi.fn()} isSubmitting={true} mode="create" />);

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });
});
