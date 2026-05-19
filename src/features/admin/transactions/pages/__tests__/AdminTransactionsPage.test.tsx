import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';

import { AdminTransactionsPage } from '@/features/admin/transactions/pages/AdminTransactionsPage';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type {
  PageMetadata,
  PagedResponse,
  TransactionSearchResult,
} from '@/types/transactionSearch';

const groceryTransaction: TransactionSearchResult = {
  id: 1,
  ownerId: 'usr_test123',
  accountId: 'checking-3223',
  bankName: 'Capital One',
  date: '2025-10-14',
  currencyIsoCode: 'USD',
  amount: 100.5,
  type: 'DEBIT',
  description: 'Grocery shopping',
  createdAt: '2025-10-14T10:30:00Z',
  updatedAt: '2025-10-14T10:30:00Z',
};

function createMetadata(overrides: Partial<PageMetadata> = {}): PageMetadata {
  return {
    page: 0,
    size: 50,
    numberOfElements: 1,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
    ...overrides,
  };
}

function createPage(
  content: TransactionSearchResult[],
  metadata: Partial<PageMetadata> = {},
): PagedResponse<TransactionSearchResult> {
  return {
    content,
    metadata: createMetadata({
      numberOfElements: content.length,
      totalElements: content.length,
      totalPages: content.length === 0 ? 0 : 1,
      last: true,
      ...metadata,
    }),
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(initialPath = '/admin/transactions') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/admin/transactions"
        element={
          <>
            <LocationProbe />
            <AdminTransactionsPage />
          </>
        }
      />
    </Routes>,
    { initialEntries: [initialPath] },
  );
}

describe('AdminTransactionsPage', () => {
  it('renders successful transaction search results', async () => {
    renderPage();

    expect(await screen.findByText('Grocery shopping')).toBeInTheDocument();
    expect(screen.getByText('Capital One')).toBeInTheDocument();
    expect(screen.getByText('$100.50')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–1 of 1 transactions')).toBeInTheDocument();
  });

  it('submits filters, serializes them to the URL, and requests the parsed API query', async () => {
    const user = userEvent.setup();
    let latestRequestUrl: URL | null = null;

    server.use(
      http.get('/api/v1/transactions/search', ({ request }) => {
        latestRequestUrl = new URL(request.url);
        return HttpResponse.json(createPage([groceryTransaction]));
      }),
    );

    renderPage();

    await screen.findByText('Grocery shopping');

    await user.type(screen.getByPlaceholderText('Search description'), 'coffee');
    await user.type(screen.getByPlaceholderText('From date'), '2026-01-01');
    await user.type(screen.getByPlaceholderText('To date'), '2026-01-31');
    await user.click(screen.getByRole('button', { name: /More filters/i }));
    await user.type(screen.getByPlaceholderText(/bank name/i), 'Chase');
    await user.type(screen.getByPlaceholderText(/account ID/i), 'checking-0001');
    await user.type(screen.getByPlaceholderText('Min'), '10.5');
    await user.type(screen.getByPlaceholderText('Max'), '99.25');
    await user.click(screen.getByRole('button', { name: /^Search$/ }));

    await waitFor(() => {
      const params = new URLSearchParams(
        screen.getByTestId('location').textContent?.split('?')[1] ?? '',
      );
      expect(params.get('q')).toBe('coffee');
      expect(params.get('dateFrom')).toBe('2026-01-01');
      expect(params.get('dateTo')).toBe('2026-01-31');
      expect(params.get('bank')).toBe('Chase');
      expect(params.get('account')).toBe('checking-0001');
      expect(params.get('minAmount')).toBe('10.5');
      expect(params.get('maxAmount')).toBe('99.25');
    });

    await waitFor(() => {
      expect(latestRequestUrl?.searchParams.get('description')).toBe('coffee');
      expect(latestRequestUrl?.searchParams.get('dateFrom')).toBe('2026-01-01');
      expect(latestRequestUrl?.searchParams.get('dateTo')).toBe('2026-01-31');
      expect(latestRequestUrl?.searchParams.get('bankName')).toBe('Chase');
      expect(latestRequestUrl?.searchParams.get('accountId')).toBe('checking-0001');
      expect(latestRequestUrl?.searchParams.get('minAmount')).toBe('10.5');
      expect(latestRequestUrl?.searchParams.get('maxAmount')).toBe('99.25');
    });
  });

  it('parses URL state into visible filters and defaulted API request params', async () => {
    let requestUrl: URL | null = null;

    server.use(
      http.get('/api/v1/transactions/search', ({ request }) => {
        requestUrl = new URL(request.url);
        return HttpResponse.json(createPage([groceryTransaction]));
      }),
    );

    renderPage(
      '/admin/transactions?q=rent&bank=Chase&type=credit&minAmount=15&page=-3&size=999&sort=notAllowed,DESC',
    );

    expect(await screen.findByDisplayValue('rent')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Chase')).toBeInTheDocument();
    expect(screen.getByDisplayValue('15')).toBeInTheDocument();

    await waitFor(() => {
      expect(requestUrl?.searchParams.get('description')).toBe('rent');
      expect(requestUrl?.searchParams.get('bankName')).toBe('Chase');
      expect(requestUrl?.searchParams.get('type')).toBe('CREDIT');
      expect(requestUrl?.searchParams.get('minAmount')).toBe('15');
      expect(requestUrl?.searchParams.get('page')).toBe('0');
      expect(requestUrl?.searchParams.get('size')).toBe('50');
      expect(requestUrl?.searchParams.getAll('sort')).toEqual(['date,DESC', 'id,DESC']);
    });
  });

  it('renders an empty transaction result state', async () => {
    server.use(http.get('/api/v1/transactions/search', () => HttpResponse.json(createPage([]))));

    renderPage();

    expect(await screen.findByText('No transactions found')).toBeInTheDocument();
    expect(screen.getByText('Adjust filters to broaden the search')).toBeInTheDocument();
  });

  it('renders API errors from transaction search', async () => {
    server.use(
      http.get('/api/v1/transactions/search', () =>
        HttpResponse.json(
          {
            type: 'APPLICATION_ERROR',
            code: 'TXN_SEARCH_FAILED',
            message: 'Transaction search failed',
          },
          { status: 500 },
        ),
      ),
    );

    renderPage();

    expect(
      await screen.findByText('Transaction search failed', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Error code: TXN_SEARCH_FAILED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('serializes pagination and sorting changes to URL state', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/v1/transactions/search', ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page') ?? '0');

        return HttpResponse.json(
          createPage([groceryTransaction], {
            page,
            numberOfElements: 1,
            totalElements: 3,
            totalPages: 3,
            first: page === 0,
            last: page === 2,
          }),
        );
      }),
    );

    renderPage();

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/admin/transactions?page=1');
    });

    await user.click(screen.getByRole('button', { name: /Amount/ }));
    await waitFor(() => {
      const params = new URLSearchParams(
        screen.getByTestId('location').textContent?.split('?')[1] ?? '',
      );
      expect(params.get('page')).toBeNull();
      expect(params.getAll('sort')).toEqual(['amount,DESC', 'id,DESC']);
    });
  });
});
