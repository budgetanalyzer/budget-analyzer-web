import { test as base, expect } from '@playwright/test';
import type { User } from '@/types/auth';
import type { SessionStatus } from '@/types/session';
import { installBrowserMocks, type BrowserMockController } from './browserMocks';
import { createCspObserverController, type CspObserverController } from './cspObservations';
import { buildAuthenticatedUser, buildSessionStatus } from './data';

interface BrowserFixtures {
  authenticatedUser: User;
  authenticatedSession: SessionStatus;
  browserMocks: BrowserMockController;
  cspMonitor: CspObserverController;
}

export const test = base.extend<BrowserFixtures>({
  authenticatedUser: [buildAuthenticatedUser(), { option: true }],
  authenticatedSession: [buildSessionStatus(), { option: true }],
  browserMocks: async ({ page, authenticatedUser, authenticatedSession }, provide) => {
    const browserMocks = await installBrowserMocks(page, authenticatedUser, authenticatedSession);
    await provide(browserMocks);
    browserMocks.assertNoUnexpectedRequests();
  },
  cspMonitor: async ({ page }, provide) => {
    await provide(await createCspObserverController(page));
  },
});

export { expect };
