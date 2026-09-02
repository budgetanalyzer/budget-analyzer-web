import type { BrowserMockController, DeferredApiMockController } from './browserMocks';
import {
  buildSavedView,
  buildTransaction,
  buildViewMembership,
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
}
