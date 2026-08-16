import { test as base, expect } from '@playwright/test';
import { snapshotCspObservations } from 'e2e/fixtures/cspObservations';
import { registerTransactionPageResponses } from 'e2e/fixtures/scenarios';
import { test } from 'e2e/fixtures/test';

test('unexpected API requests are blocked and reported with the exact request', async ({
  page,
  browserMocks,
}) => {
  registerTransactionPageResponses(browserMocks);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
  browserMocks.assertNoUnexpectedRequests();

  const status = await page.evaluate(async () => {
    const response = await fetch('/api/v1/e2e-unregistered?case=fail-closed');
    return response.status;
  });

  expect(status).toBe(599);
  expect(() => browserMocks.assertNoUnexpectedRequests()).toThrow(
    /unexpected protected request\(s\): GET \/api\/v1\/e2e-unregistered\?case=fail-closed[\s\S]*No request reached a real protected service/,
  );
});

base(
  'missing pre-navigation monitor installation reports an actionable failure',
  async ({ page }) => {
    await expect(snapshotCspObservations(page)).rejects.toThrow(
      /CSP monitor is not installed[\s\S]*page\.addInitScript\(\)[\s\S]*before navigation/,
    );
  },
);
