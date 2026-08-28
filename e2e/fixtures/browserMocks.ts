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
  mockDeferredApi: (response: ApiMockResponse) => DeferredApiMockController;
  releasePendingResponses: () => void;
  unexpectedRequests: () => readonly UnexpectedProtectedRequest[];
  assertNoUnexpectedRequests: () => void;
}

export interface DeferredApiMockController {
  waitForRequest: () => Promise<void>;
  release: () => void;
}

interface RegisteredApiMockResponse {
  response: ApiMockResponse;
  deferred?: {
    requestReceived: Promise<void>;
    markRequestReceived: () => void;
    responseReleased: Promise<void>;
    releaseResponse: () => void;
  };
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
  const apiResponses = new Map<string, RegisteredApiMockResponse>();
  const deferredResponses = new Set<RegisteredApiMockResponse>();
  const unexpected: UnexpectedProtectedRequest[] = [];

  const registerApiResponse = (
    response: ApiMockResponse,
    deferred?: RegisteredApiMockResponse['deferred'],
  ): RegisteredApiMockResponse => {
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

    const registeredResponse = { response, deferred };
    apiResponses.set(key, registeredResponse);
    if (deferred) deferredResponses.add(registeredResponse);
    return registeredResponse;
  };

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
    const registeredResponse = apiResponses.get(
      requestKey(request.method(), new URL(request.url())),
    );
    if (!registeredResponse) {
      await recordAndBlock(route);
      return;
    }

    const { response, deferred } = registeredResponse;
    if (deferred) {
      deferred.markRequestReceived();
      await deferred.responseReleased;
      deferredResponses.delete(registeredResponse);
    }

    await route.fulfill({
      status: response.status ?? 200,
      contentType: response.contentType ?? 'application/json',
      body: response.body ?? JSON.stringify(response.json ?? null),
    });
  });

  return {
    mockApi: (response) => {
      registerApiResponse(response);
    },
    mockDeferredApi: (response) => {
      let markRequestReceived!: () => void;
      let releaseResponse!: () => void;
      const requestReceived = new Promise<void>((resolve) => {
        markRequestReceived = resolve;
      });
      const responseReleased = new Promise<void>((resolve) => {
        releaseResponse = resolve;
      });
      const registeredResponse = registerApiResponse(response, {
        requestReceived,
        markRequestReceived,
        responseReleased,
        releaseResponse,
      });

      return {
        waitForRequest: () => registeredResponse.deferred!.requestReceived,
        release: () => registeredResponse.deferred!.releaseResponse(),
      };
    },
    releasePendingResponses: () => {
      deferredResponses.forEach((response) => response.deferred?.releaseResponse());
      deferredResponses.clear();
    },
    unexpectedRequests: () => [...unexpected],
    assertNoUnexpectedRequests: () => {
      if (unexpected.length === 0) return;
      const drained = unexpected.splice(0);
      throw unexpectedRequestError(drained);
    },
  };
}
