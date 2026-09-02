import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { MemoryRouter as DomMemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewPage } from '@/features/views/pages/ViewPage';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { useCurrencies, useExchangeRatesMap } from '@/hooks/useCurrencies';
import { useMissingCurrencies } from '@/hooks/useMissingCurrencies';
import {
  createAddViewTransactionsRequest,
  createRemoveViewTransactionsRequest,
  useCloneView,
  useCreateView,
  useUpdateViewTransactions,
  useView,
  useViewTransactions,
} from '@/hooks/useViews';
import { renderWithProviders } from '@/testing/test-utils';
import { ApiError } from '@/types/apiError';
import type { Transaction } from '@/types/transaction';
import type { SavedViewMetadata } from '@/types/view';
import { buildExchangeRateMap } from '@/utils/currency';

vi.mock('@/hooks/useViews');
vi.mock('@/hooks/useCurrencies');
vi.mock('@/hooks/useMissingCurrencies');
vi.mock('@/features/auth/hooks/usePermission');

const mockUseCloneView = vi.mocked(useCloneView);
const mockUseCreateView = vi.mocked(useCreateView);
const mockUseView = vi.mocked(useView);
const mockUseViewTransactions = vi.mocked(useViewTransactions);
const mockUseUpdateViewTransactions = vi.mocked(useUpdateViewTransactions);
const mockCreateAddViewTransactionsRequest = vi.mocked(createAddViewTransactionsRequest);
const mockCreateRemoveViewTransactionsRequest = vi.mocked(createRemoveViewTransactionsRequest);
const mockUseCurrencies = vi.mocked(useCurrencies);
const mockUseExchangeRatesMap = vi.mocked(useExchangeRatesMap);
const mockUseMissingCurrencies = vi.mocked(useMissingCurrencies);
const mockUsePermission = vi.mocked(usePermission);
const mockCloneViewMutate = vi.fn();
const mockCreateViewMutate = vi.fn();
const mockUpdateViewTransactionsMutate =
  vi.fn<ReturnType<typeof useUpdateViewTransactions>['mutate']>();
const viewId = '11111111-1111-4111-8111-111111111111';

const view: SavedViewMetadata = {
  id: viewId,
  name: 'Static collection',
  transactionCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

const transactions: Transaction[] = [
  {
    id: 1,
    accountId: 'checking',
    bankName: 'Example Bank',
    date: '2026-01-15',
    currencyIsoCode: 'USD',
    amount: 10,
    type: 'DEBIT',
    description: 'Coffee',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 2,
    accountId: 'checking',
    bankName: 'Example Bank',
    date: '2026-01-16',
    currencyIsoCode: 'USD',
    amount: 20,
    type: 'DEBIT',
    description: 'Groceries',
    createdAt: '2026-01-16T00:00:00Z',
    updatedAt: '2026-01-16T00:00:00Z',
  },
];

const availableTransaction: Transaction = {
  id: 3,
  accountId: 'savings',
  bankName: 'Second Bank',
  date: '2026-01-17',
  currencyIsoCode: 'USD',
  amount: 30,
  type: 'CREDIT',
  description: 'Salary',
  createdAt: '2026-01-17T00:00:00Z',
  updatedAt: '2026-01-17T00:00:00Z',
};

function LocationProbe() {
  const location = useLocation();
  return (
    <output aria-label="Current location">
      {location.pathname}
      {location.search}
      {location.hash}
    </output>
  );
}

function renderPage(initialEntry = `/views/${viewId}`) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/views/:id"
        element={
          <DomMemoryRouter initialEntries={[initialEntry]}>
            <ViewPage />
            <LocationProbe />
          </DomMemoryRouter>
        }
      />
    </Routes>,
    { initialEntries: [initialEntry] },
  );
}

beforeEach(() => {
  mockUsePermission.mockReset();
  mockUsePermission.mockReturnValue(true);
  mockCloneViewMutate.mockReset();
  mockCreateViewMutate.mockReset();
  mockUseUpdateViewTransactions.mockReset();
  mockUpdateViewTransactionsMutate.mockReset();
  mockUseCloneView.mockReturnValue({
    mutate: mockCloneViewMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useCloneView>);
  mockUseCreateView.mockReturnValue({
    mutate: mockCreateViewMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateView>);
  mockCreateAddViewTransactionsRequest.mockImplementation((transactionIds) => ({
    addTransactionIds: [...new Set(transactionIds)],
    removeTransactionIds: [],
  }));
  mockCreateRemoveViewTransactionsRequest.mockImplementation((transactionIds) => ({
    addTransactionIds: [],
    removeTransactionIds: [...new Set(transactionIds)],
  }));
  mockUseUpdateViewTransactions.mockReturnValue({
    mutate: mockUpdateViewTransactionsMutate,
    isPending: false,
    error: null,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateViewTransactions>);
  mockUseMissingCurrencies.mockReturnValue([]);
  mockUseCurrencies.mockReturnValue({
    data: [{ currencyCode: 'USD' }],
    isLoading: false,
  } as unknown as ReturnType<typeof useCurrencies>);
  mockUseExchangeRatesMap.mockReturnValue({
    exchangeRatesMap: new Map(),
    exchangeRatesData: [],
    pendingCurrencies: [],
    failedCurrencies: [],
    isLoading: false,
    error: undefined,
  });
  mockUseView.mockReturnValue({
    data: view,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useView>);
  mockUseViewTransactions.mockReturnValue({
    data: transactions,
    allTransactions: transactions,
    memberTransactionIds: [1, 2],
    missingTransactionIds: [],
    isLoading: false,
    isPending: false,
    isFetching: false,
    isError: false,
    isSuccess: true,
    error: null,
    refetch: vi.fn(),
  });
});

describe('ViewPage static collections', () => {
  it('renders static metadata and write-gated member removal controls', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Static collection' })).toBeInTheDocument();
    expect(screen.getByText('2 transactions')).toBeInTheDocument();
    expect(screen.getByText('Coffee')).toBeInTheDocument();
    const transactionsRegion = screen.getByRole('region', { name: 'Transactions' });
    expect(
      within(transactionsRegion).getByRole('heading', { name: 'Transactions' }),
    ).toBeInTheDocument();
    expect(
      within(transactionsRegion).getByRole('button', {
        name: 'Review possible transfers and refunds',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add transactions' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Remove from view' })).toHaveLength(2);
  });

  it('supports an empty static collection', () => {
    mockUseView.mockReturnValue({
      data: { ...view, transactionCount: 0 },
      isLoading: false,
      error: undefined,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useView>);
    mockUseViewTransactions.mockReturnValue({
      data: [],
      allTransactions: transactions,
      memberTransactionIds: [],
      missingTransactionIds: [],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();
    expect(screen.getByText('0 transactions')).toBeInTheDocument();
    expect(screen.getByText('No transactions in this view.')).toBeInTheDocument();
  });

  it('duplicates the complete source view instead of filtered transaction ids', async () => {
    const user = userEvent.setup();
    renderPage(`/views/${viewId}?q=coffee&minAmount=15&amountCurrency=USD&bankName=Example+Bank`);

    await user.click(screen.getByRole('button', { name: 'View actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate view' }));

    const dialog = screen.getByRole('dialog', { name: 'Duplicate view' });
    expect(
      within(dialog).getByText(
        'The complete saved view will be copied, regardless of active filters.',
      ),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox', { name: 'View Name' }), 'Filtered copy');
    await user.click(within(dialog).getByRole('button', { name: 'Save View' }));

    expect(mockCloneViewMutate).toHaveBeenCalledOnce();
    const [request] = mockCloneViewMutate.mock.calls[0];
    expect(request).toEqual({
      sourceViewId: viewId,
      request: { name: 'Filtered copy' },
    });
    expect(request).not.toHaveProperty('transactionIds');
    expect(mockCreateViewMutate).not.toHaveBeenCalled();
  });

  it('opens over the current URL with the complete snapshot and resets on every opening', async () => {
    const initialEntry = `/views/${viewId}?q=coffee&bankName=Example+Bank`;
    mockUseViewTransactions.mockReturnValue({
      data: transactions,
      allTransactions: [...transactions, availableTransaction],
      memberTransactionIds: [1, 2],
      missingTransactionIds: [],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    });
    renderPage(initialEntry);

    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Add transactions' });
    expect(screen.getByLabelText('Current location')).toHaveTextContent(initialEntry);

    await user.click(trigger);

    let dialog = screen.getByRole('dialog', { name: 'Add transactions to Static collection' });
    expect(within(dialog).getByPlaceholderText('Search descriptions ↵')).toHaveValue('');
    expect(within(dialog).getByText('Coffee')).toBeInTheDocument();
    expect(within(dialog).getByText('Groceries')).toBeInTheDocument();
    expect(within(dialog).getByText('Salary')).toBeInTheDocument();
    expect(screen.getByLabelText('Current location')).toHaveTextContent(initialEntry);

    await user.type(within(dialog).getByPlaceholderText('Search descriptions ↵'), 'salary{Enter}');
    expect(within(dialog).queryByText('Coffee')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(dialog).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);

    dialog = screen.getByRole('dialog', { name: 'Add transactions to Static collection' });
    expect(within(dialog).getByPlaceholderText('Search descriptions ↵')).toHaveValue('');
    expect(within(dialog).getByText('Coffee')).toBeInTheDocument();
    expect(within(dialog).getByText('Salary')).toBeInTheDocument();
  });

  it('closes on successful addition and presents refreshed membership on the same URL', async () => {
    const initialEntry = `/views/${viewId}?q=salary`;
    mockUseViewTransactions.mockReturnValue({
      data: transactions,
      allTransactions: [...transactions, availableTransaction],
      memberTransactionIds: [1, 2],
      missingTransactionIds: [],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    });
    mockUpdateViewTransactionsMutate.mockImplementation((_variables, options) => {
      mockUseView.mockReturnValue({
        data: { ...view, transactionCount: 3 },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useView>);
      mockUseViewTransactions.mockReturnValue({
        data: [...transactions, availableTransaction],
        allTransactions: [...transactions, availableTransaction],
        memberTransactionIds: [1, 2, 3],
        missingTransactionIds: [],
        isLoading: false,
        isPending: false,
        isFetching: false,
        isError: false,
        isSuccess: true,
        error: null,
        refetch: vi.fn(),
      });
      const onSuccess = options?.onSuccess as (() => void) | undefined;
      onSuccess?.();
    });
    renderPage(initialEntry);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add transactions' }));
    const dialog = screen.getByRole('dialog', { name: 'Add transactions to Static collection' });
    await user.click(
      within(dialog).getByRole('checkbox', {
        name: 'Select transaction 3 to add to Static collection',
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add transactions' }));

    expect(mockUpdateViewTransactionsMutate).toHaveBeenCalledWith(
      {
        viewId,
        request: { addTransactionIds: [3], removeTransactionIds: [] },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('3 transactions')).toBeInTheDocument();
    expect(screen.getByText('Salary')).toBeInTheDocument();
    expect(screen.getByLabelText('Current location')).toHaveTextContent(initialEntry);
    expect(screen.queryByText(/successfully added/i)).not.toBeInTheDocument();
  });

  it('exposes one primary action, object actions, and explicit view-scoped Analytics navigation', () => {
    renderPage();

    const pageTitle = screen.getByRole('heading', { name: 'Static collection' });
    const transactionCount = screen.getByText('2 transactions');
    const metadataRow = transactionCount.parentElement;
    const pageHeader = metadataRow?.parentElement?.parentElement;
    expect(pageTitle).toBeInTheDocument();
    expect(metadataRow).not.toBeNull();
    expect(pageHeader).not.toBeNull();
    expect(within(pageHeader!).getAllByRole('link')).toHaveLength(1);
    expect(within(pageHeader!).getAllByRole('button')).toHaveLength(2);
    const analyticsLink = within(metadataRow!).getByRole('link', { name: 'Open in Analytics' });
    const addTransactionsButton = within(pageHeader!).getByRole('button', {
      name: 'Add transactions',
    });
    const viewActionsButton = within(pageHeader!).getByRole('button', { name: 'View actions' });
    expect(analyticsLink).toHaveAttribute(
      'href',
      `/analytics?scope=view&viewId=${viewId}&viewMode=monthly&transactionType=debit`,
    );
    expect(analyticsLink.compareDocumentPosition(addTransactionsButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(addTransactionsButton.compareDocumentPosition(viewActionsButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.queryByRole('link', { name: 'Analyze View' })).not.toBeInTheDocument();
  });

  it('uses only selected-currency row presentation with partial saved-view totals', () => {
    const mixedTransactions = [
      transactions[0],
      { ...transactions[1], currencyIsoCode: 'GBP', amount: 20 },
    ];
    mockUseViewTransactions.mockReturnValue({
      data: mixedTransactions,
      allTransactions: mixedTransactions,
      memberTransactionIds: [1, 2],
      missingTransactionIds: [],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('Sum of visible debits · Partial; 1 unavailable')).toBeInTheDocument();
    expect(screen.getByText('Amount in USD unavailable')).toBeInTheDocument();
    expect(screen.queryByText('£20.00')).not.toBeInTheDocument();
    expect(screen.queryByText('GBP')).not.toBeInTheDocument();
  });

  it('renders an all-unavailable saved-view spend total as unavailable', () => {
    const unavailableTransactions = transactions.map((item) => ({
      ...item,
      currencyIsoCode: 'GBP',
    }));
    mockUseViewTransactions.mockReturnValue({
      data: unavailableTransactions,
      allTransactions: unavailableTransactions,
      memberTransactionIds: [1, 2],
      missingTransactionIds: [],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('Conversion unavailable for all 2 transactions')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('keeps duplicate available while an amount filter is unresolved', async () => {
    mockUseExchangeRatesMap.mockReturnValue({
      exchangeRatesMap: new Map(),
      exchangeRatesData: [],
      pendingCurrencies: ['GBP'],
      failedCurrencies: [],
      isLoading: true,
      error: undefined,
    });
    renderPage(`/views/${viewId}?minAmount=15&amountCurrency=USD`);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'View actions' }));
    const duplicateAction = screen.getByRole('menuitem', { name: 'Duplicate view' });
    expect(duplicateAction).toBeEnabled();
    await user.click(duplicateAction);
    expect(screen.getByRole('dialog', { name: 'Duplicate view' })).toBeInTheDocument();
  });

  it('reports stale snapshot memberships without fetching rows itself', () => {
    mockUseViewTransactions.mockReturnValue({
      data: [transactions[0]],
      allTransactions: transactions,
      memberTransactionIds: [1, 99],
      missingTransactionIds: [99],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/1 membership is not available/)).toBeInTheDocument();
  });

  it('hides all write and delete actions when both permissions are denied', () => {
    mockUsePermission.mockReturnValue(false);
    renderPage();

    expect(screen.queryByRole('button', { name: 'Add transactions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View actions' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Review possible transfers and refunds' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove from view' })).not.toBeInTheDocument();
    expect(mockUseUpdateViewTransactions).not.toHaveBeenCalled();
  });

  it('keeps write and delete object actions independently permission-gated', async () => {
    const user = userEvent.setup();
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    const writeOnly = renderPage();

    expect(screen.getByRole('button', { name: 'Add transactions' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View actions' }));
    expect(screen.getByRole('menuitem', { name: 'Rename view' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicate view' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete view' })).not.toBeInTheDocument();

    writeOnly.unmount();
    mockUsePermission.mockImplementation((permission) => permission === 'views:delete');
    renderPage();

    expect(screen.queryByRole('button', { name: 'Add transactions' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View actions' }));
    expect(screen.queryByRole('menuitem', { name: 'Rename view' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Duplicate view' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete view' })).toBeInTheDocument();
  });

  it('keeps membership selection independent from transaction deletion permission', () => {
    mockUsePermission.mockImplementation((permission) => permission === 'transactions:delete');
    const deletionOnly = renderPage();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove from view' })).not.toBeInTheDocument();

    deletionOnly.unmount();
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    renderPage();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Remove from view' })).toHaveLength(2);
  });

  it('uses nonmembers only as transfer/refund evidence', async () => {
    const memberDebit: Transaction = {
      ...transactions[0],
      currencyIsoCode: 'EUR',
      amount: 10,
    };
    const outsideCredit: Transaction = {
      ...memberDebit,
      id: 3,
      date: '2026-01-16',
      type: 'CREDIT',
      description: 'Coffee refund',
    };
    mockUseExchangeRatesMap.mockReturnValue({
      exchangeRatesMap: buildExchangeRateMap([
        {
          baseCurrency: 'USD',
          targetCurrency: 'EUR',
          date: memberDebit.date,
          publishedDate: memberDebit.date,
          rate: 0.5,
        },
        {
          baseCurrency: 'USD',
          targetCurrency: 'EUR',
          date: outsideCredit.date,
          publishedDate: outsideCredit.date,
          rate: 0.5,
        },
      ]),
      exchangeRatesData: [],
      pendingCurrencies: [],
      failedCurrencies: [],
      isLoading: false,
      error: undefined,
    });
    mockUseViewTransactions.mockReturnValue({
      data: [memberDebit],
      allTransactions: [memberDebit, outsideCredit],
      memberTransactionIds: [1],
      missingTransactionIds: [],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    const user = userEvent.setup();
    const transactionsRegion = screen.getByRole('region', { name: 'Transactions' });
    await user.click(
      within(transactionsRegion).getByRole('button', {
        name: 'Review possible transfers and refunds',
      }),
    );

    const reviewDialog = await screen.findByRole('dialog', {
      name: 'Review possible transfers and refunds',
    });
    const refund = within(reviewDialog).getByRole('region', { name: 'Possible refund' });
    expect(within(refund).getAllByText('$20.00')).toHaveLength(2);
    expect(within(refund).queryByText('€10.00')).not.toBeInTheDocument();
    expect(
      screen.getByText('Not currently in this view; shown as supporting evidence'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Remove debit transaction 1 from this view' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Remove credit transaction 3 from this view' }),
    ).not.toBeInTheDocument();
  });

  it('combines loading and error presentation from metadata and membership', () => {
    mockUseViewTransactions.mockReturnValue({
      data: undefined,
      allTransactions: undefined,
      memberTransactionIds: [],
      missingTransactionIds: [],
      isLoading: true,
      isPending: true,
      isFetching: true,
      isError: false,
      isSuccess: false,
      error: null,
      refetch: vi.fn(),
    });
    const loading = renderPage();
    expect(screen.getByText('Loading view...')).toBeInTheDocument();

    loading.unmount();
    mockUseViewTransactions.mockReturnValue({
      data: undefined,
      allTransactions: undefined,
      memberTransactionIds: [],
      missingTransactionIds: [],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: true,
      isSuccess: false,
      error: new ApiError(503, { type: 'SERVICE_UNAVAILABLE', message: 'Members unavailable' }),
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getAllByText('Members unavailable')).toHaveLength(2);
  });
});
