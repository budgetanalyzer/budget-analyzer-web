import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionSearchFiltersPanel } from '@/features/admin/transactions/components/TransactionSearchFiltersPanel';
import type { TransactionSearchQuery } from '@/types/transactionSearch';

function createQuery(overrides: Partial<TransactionSearchQuery> = {}): TransactionSearchQuery {
  return {
    page: 0,
    size: 50,
    sort: ['date,DESC', 'id,DESC'],
    ...overrides,
  };
}

describe('TransactionSearchFiltersPanel', () => {
  it('shows the currency and signed amount controls with persistent native-amount guidance', () => {
    render(
      <TransactionSearchFiltersPanel
        query={createQuery({ currencyIsoCode: 'EUR', minAmount: -10 })}
        onChange={() => {}}
        onClear={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /More filters 2/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByLabelText('Currency ISO code')).toHaveValue('EUR');
    expect(screen.getByLabelText('Minimum amount')).toHaveValue(-10);
    expect(screen.getByLabelText('Minimum amount')).not.toHaveAttribute('min');
    expect(screen.getByLabelText('Maximum amount')).not.toHaveAttribute('min');
    expect(
      screen.getByText(/Amount bounds and amount sorting compare raw stored numbers/i),
    ).toHaveTextContent(
      'An amount-only search can span currencies; combine a currency with bounds to make the comparison currency-specific.',
    );
  });

  it('normalizes currency and preserves signed bounds when the currency changes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <TransactionSearchFiltersPanel
        query={createQuery({ currencyIsoCode: 'USD', minAmount: -10, maxAmount: 25 })}
        onChange={handleChange}
        onClear={() => {}}
      />,
    );

    const currency = screen.getByLabelText('Currency ISO code');
    await user.clear(currency);
    await user.type(currency, ' eur ');
    await user.click(screen.getByRole('button', { name: /^Search$/ }));

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        currencyIsoCode: 'EUR',
        minAmount: -10,
        maxAmount: 25,
      }),
    );
  });

  it('keeps empty currency and non-finite amount input undefined', async () => {
    const handleChange = vi.fn();

    render(
      <TransactionSearchFiltersPanel
        query={createQuery({ currencyIsoCode: 'USD' })}
        onChange={handleChange}
        onClear={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText('Currency ISO code'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Minimum amount'), { target: { value: '1e999' } });
    fireEvent.submit(screen.getByRole('button', { name: /^Search$/ }).closest('form')!);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        currencyIsoCode: undefined,
        minAmount: undefined,
      }),
    );
  });
});
