import { buildAuthenticatedUser } from 'e2e/fixtures/data';
import { registerTransactionPageResponses } from 'e2e/fixtures/scenarios';
import { expect, test } from 'e2e/fixtures/test';

test.use({
  authenticatedUser: buildAuthenticatedUser({
    permissions: ['transactions:read', 'transactions:delete'],
  }),
});

test('authenticated transaction selection workflow has no prohibited runtime styling', async ({
  page,
  browserMocks,
  cspMonitor,
}) => {
  registerTransactionPageResponses(browserMocks);

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();

  const transactionRow = page.getByRole('row', {
    name: /Deterministic browser fixture transaction/,
  });
  await expect(transactionRow).toBeVisible();
  browserMocks.assertNoUnexpectedRequests();

  await transactionRow.getByRole('checkbox').click();
  const selectionStatus = page.getByText('1 transaction selected', { exact: true });
  await expect(selectionStatus).toBeVisible();

  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await expect(selectionStatus).not.toBeVisible();
  browserMocks.assertNoUnexpectedRequests();

  await cspMonitor.assertClean();
});
