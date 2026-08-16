import type { BrowserMockController } from './browserMocks';
import { buildTransaction } from './data';

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
