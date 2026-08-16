import type { Page, Route } from '@playwright/test';
import type { User } from '@/types/auth';
import type { SessionStatus } from '@/types/session';

export interface ApiMockResponse {
  method: string;
  url: string;
  status?: number;
  json?: unknown;
  body?: string;
  contentType?: string;
}

export interface UnexpectedProtectedRequest {
  method: string;
  url: string;
}

export interface BrowserMockController {
  mockApi: (response: ApiMockResponse) => void;
  unexpectedRequests: () => readonly UnexpectedProtectedRequest[];
  assertNoUnexpectedRequests: () => void;
}

function canonicalUrl(url: URL): string {
  const parameters = [...url.searchParams.entries()].sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
  );
  const search = new URLSearchParams(parameters).toString();
  return `${url.pathname}${search ? `?${search}` : ''}`;
}

function requestKey(method: string, url: URL): string {
  return `${method.toUpperCase()} ${canonicalUrl(url)}`;
}

function unexpectedRequestError(requests: readonly UnexpectedProtectedRequest[]): Error {
  const diagnostics = requests.map((request) => `${request.method} ${request.url}`).join(', ');
  return new Error(
    `Browser mock failure: unexpected protected request(s): ${diagnostics}. Register an exact scenario-owned auth/API response before navigation. No request reached a real protected service.`,
  );
}

async function fulfillJson(route: Route, status: number, json: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(json),
  });
}

export async function installBrowserMocks(
  page: Page,
  user: User,
  session: SessionStatus,
): Promise<BrowserMockController> {
  const apiResponses = new Map<string, ApiMockResponse>();
  const unexpected: UnexpectedProtectedRequest[] = [];

  const recordAndBlock = async (route: Route): Promise<void> => {
    const request = route.request();
    const url = new URL(request.url());
    unexpected.push({ method: request.method(), url: canonicalUrl(url) });
    await fulfillJson(route, 599, {
      type: 'E2E_UNEXPECTED_REQUEST',
      message: 'The browser harness blocked an unregistered protected request.',
    });
  };

  await page.route('**/auth/**', recordAndBlock);
  await page.route('**/auth/v1/user', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || canonicalUrl(url) !== '/auth/v1/user') {
      await recordAndBlock(route);
      return;
    }
    await fulfillJson(route, 200, user);
  });
  await page.route('**/auth/v1/session', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || canonicalUrl(url) !== '/auth/v1/session') {
      await recordAndBlock(route);
      return;
    }
    await fulfillJson(route, 200, session);
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const response = apiResponses.get(requestKey(request.method(), new URL(request.url())));
    if (!response) {
      await recordAndBlock(route);
      return;
    }

    await route.fulfill({
      status: response.status ?? 200,
      contentType: response.contentType ?? 'application/json',
      body: response.body ?? JSON.stringify(response.json ?? null),
    });
  });

  return {
    mockApi: (response) => {
      const absoluteUrl = new URL(response.url, 'https://e2e.invalid');
      if (!absoluteUrl.pathname.startsWith('/api/')) {
        throw new Error(
          `Browser mock configuration failure: API mock URL must start with /api/; received ${response.url}.`,
        );
      }
      const key = requestKey(response.method, absoluteUrl);
      if (apiResponses.has(key)) {
        throw new Error(`Browser mock configuration failure: duplicate response for ${key}.`);
      }
      apiResponses.set(key, response);
    },
    unexpectedRequests: () => [...unexpected],
    assertNoUnexpectedRequests: () => {
      if (unexpected.length === 0) return;
      const drained = unexpected.splice(0);
      throw unexpectedRequestError(drained);
    },
  };
}
