import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionSearchTable } from '@/features/admin/transactions/components/TransactionSearchTable';
import { renderWithProviders } from '@/testing/test-utils';
import type { PageMetadata, TransactionSearchResult } from '@/types/transactionSearch';

const metadata: PageMetadata = {
  page: 0,
  size: 50,
  numberOfElements: 2,
  totalElements: 75,
  totalPages: 2,
  first: true,
  last: false,
};

const transactions: TransactionSearchResult[] = [
  {
    id: 1,
    ownerId: 'usr_1',
    accountId: 'eur-account',
    bankName: 'Euro Bank',
    date: '2026-08-02',
    currencyIsoCode: 'EUR',
    amount: -5,
    type: 'DEBIT',
    description: 'Negative stored amount',
    createdAt: '2026-08-02T00:00:00Z',
    updatedAt: '2026-08-02T00:00:00Z',
  },
  {
    id: 2,
    ownerId: 'usr_2',
    accountId: 'jpy-account',
    bankName: 'Japan Bank',
    date: '2026-08-01',
    currencyIsoCode: 'JPY',
    amount: 1500,
    type: 'CREDIT',
    description: 'Positive stored amount',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  },
];

function renderTable(onSortChange = vi.fn(), onPageChange = vi.fn()) {
  renderWithProviders(
    <TransactionSearchTable
      data={transactions}
      metadata={metadata}
      sort={['date,DESC', 'id,DESC']}
      isLoading={false}
      isFetching={false}
      onPageChange={onPageChange}
      onSizeChange={() => {}}
      onSortChange={onSortChange}
    />,
  );
}

describe('TransactionSearchTable', () => {
  it('formats signed rows in their stored ISO currencies', () => {
    renderTable();

    expect(screen.getByText('-€5.00')).toBeInTheDocument();
    expect(screen.getByText('¥1,500')).toBeInTheDocument();
    expect(screen.getByText('EUR')).toBeInTheDocument();
    expect(screen.getByText('JPY')).toBeInTheDocument();
  });

  it('delegates raw amount sorting and pagination to the server', async () => {
    const user = userEvent.setup();
    const handleSortChange = vi.fn();
    const handlePageChange = vi.fn();
    renderTable(handleSortChange, handlePageChange);

    const bodyRows = screen.getAllByRole('row').slice(1);
    expect(within(bodyRows[0]).getByText('Negative stored amount')).toBeInTheDocument();
    expect(within(bodyRows[1]).getByText('Positive stored amount')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Amount/ }));
    expect(handleSortChange).toHaveBeenCalledWith(['amount,DESC', 'id,DESC']);
    expect(within(bodyRows[0]).getByText('Negative stored amount')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(handlePageChange).toHaveBeenCalledWith(1);
  });
});
