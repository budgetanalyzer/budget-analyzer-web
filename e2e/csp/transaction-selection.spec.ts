import { buildAuthenticatedUser } from 'e2e/fixtures/data';
import { assertCspObservationsClean } from 'e2e/fixtures/cspObservations';
import { registerTransactionPageResponses } from 'e2e/fixtures/scenarios';
import { expect, test } from 'e2e/fixtures/test';

test.use({
  authenticatedUser: buildAuthenticatedUser({
    permissions: ['transactions:read', 'transactions:delete'],
  }),
});

test('authenticated transaction selection has no CSP violations or prohibited stylesheets', async ({
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

  const snapshot = await cspMonitor.snapshot();
  console.info(
    `Authenticated transaction CSP audit: ${snapshot.cspViolations.length} CSP violations, ${snapshot.runtimeStylesheetAdditions.length} runtime-added stylesheets, ${snapshot.finalStyleElements.length} final stylesheets.`,
  );
  expect(snapshot.monitorVersion).toBe(1);
  expect(snapshot.cspViolations).toEqual([]);
  expect(snapshot.runtimeStylesheetAdditions).toEqual([]);
  expect(snapshot.finalStyleElements).toEqual([]);
  assertCspObservationsClean(snapshot);
});
