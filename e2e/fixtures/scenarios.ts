import type { BrowserMockController, DeferredApiMockController } from './browserMocks';
import {
  buildSavedView,
  buildTransaction,
  buildViewMembership,
  SAVED_VIEW_ELIGIBLE_TRANSACTION_ID,
  SAVED_VIEW_FIXTURE_ID,
} from './data';

export function registerTransactionPageResponses(browserMocks: BrowserMockController): void {
  browserMocks.mockApi({
    method: 'GET',
    url: '/api/v1/transactions',
    json: [buildTransaction()],
  });
  browserMocks.mockApi({
    method: 'GET',
    url: '/api/v1/currencies?enabledOnly=true',
    json: [],
  });
  browserMocks.mockApi({
    method: 'GET',
    url: '/api/v1/currencies?enabledOnly=false',
    json: [],
  });
  browserMocks.mockApi({
    method: 'GET',
    url: '/api/v1/views',
    json: [],
  });
}

export function registerDeferredBulkDeleteResponse(
  browserMocks: BrowserMockController,
): DeferredApiMockController {
  return browserMocks.mockDeferredApi({
    method: 'POST',
    url: '/api/v1/transactions/bulk-delete',
    json: { deletedCount: 1, notFoundIds: [] },
  });
}

export function registerSavedViewDetailResponses(browserMocks: BrowserMockController): void {
  registerSavedViewResponses(browserMocks, [buildTransaction()]);
}

export function registerSavedViewAdditionResponses(browserMocks: BrowserMockController): void {
  registerSavedViewResponses(browserMocks, [
    buildTransaction({ description: 'Existing saved-view member' }),
    buildTransaction({
      id: SAVED_VIEW_ELIGIBLE_TRANSACTION_ID,
      accountId: 'e2e-savings-002',
      bankName: 'Second Fixture Bank',
      date: '2026-08-16',
      amount: 84.25,
      type: 'CREDIT',
      description: 'Eligible transaction for saved-view addition',
      createdAt: '2026-08-16T12:00:00Z',
      updatedAt: '2026-08-16T12:00:00Z',
    }),
  ]);
}

export function registerDeferredAddViewTransactionsResponse(
  browserMocks: BrowserMockController,
): DeferredApiMockController {
  return browserMocks.mockDeferredApi({
    method: 'PATCH',
    url: `/api/v1/views/${SAVED_VIEW_FIXTURE_ID}/transactions`,
    status: 204,
    body: '',
  });
}

function registerSavedViewResponses(
  browserMocks: BrowserMockController,
  transactions: ReturnType<typeof buildTransaction>[],
): void {
  const savedView = buildSavedView();

  browserMocks.mockApi({
    method: 'GET',
    url: '/api/v1/views',
    json: [savedView],
  });
  browserMocks.mockApi({
    method: 'GET',
    url: `/api/v1/views/${SAVED_VIEW_FIXTURE_ID}`,
    json: savedView,
  });
  browserMocks.mockApi({
    method: 'GET',
    url: `/api/v1/views/${SAVED_VIEW_FIXTURE_ID}/transactions`,
    json: buildViewMembership(),
  });
  browserMocks.mockApi({
    method: 'GET',
    url: '/api/v1/transactions',
    json: transactions,
  });
  browserMocks.mockApi({
    method: 'GET',
    url: '/api/v1/currencies?enabledOnly=true',
    json: [],
  });
  browserMocks.mockApi({
    method: 'GET',
    url: '/api/v1/currencies?enabledOnly=false',
    json: [],
  });
}
