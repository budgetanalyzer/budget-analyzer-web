import { buildAuthenticatedUser } from 'e2e/fixtures/data';
import { assertCspObservationsClean } from 'e2e/fixtures/cspObservations';
import {
  registerDeferredBulkDeleteResponse,
  registerTransactionPageResponses,
} from 'e2e/fixtures/scenarios';
import { expect, test } from 'e2e/fixtures/test';

test.use({
  authenticatedUser: buildAuthenticatedUser({
    permissions: ['transactions:read', 'transactions:delete'],
  }),
});

test('transaction dialog contains focus and blocks dismissal during deletion without CSP findings', async ({
  page,
  authenticatedSession,
  browserMocks,
  cspMonitor,
}) => {
  await page.clock.setFixedTime((authenticatedSession.expiresAt - 60 * 60) * 1000);
  registerTransactionPageResponses(browserMocks);
  const bulkDeleteResponse = registerDeferredBulkDeleteResponse(browserMocks);

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Session Expiring', exact: true }),
  ).not.toBeVisible();

  const transactionRow = page.getByRole('row', {
    name: /Deterministic browser fixture transaction/,
  });
  await expect(transactionRow).toBeVisible();
  await transactionRow.getByRole('checkbox').click();

  const selectionStatus = page.getByText('1 transaction selected', { exact: true });
  const bulkActionBar = selectionStatus.locator('..');
  const dialogInitiator = bulkActionBar.getByRole('button', { name: 'Delete', exact: true });
  await expect(selectionStatus).toBeVisible();
  await expect(dialogInitiator).toBeVisible();
  browserMocks.assertNoUnexpectedRequests();

  await dialogInitiator.click();
  const dialog = page.getByRole('dialog', { name: 'Delete Transactions', exact: true });
  const closeButton = dialog.getByRole('button', { name: 'Close', exact: true });
  const deleteButton = dialog.getByRole('button', { name: 'Delete', exact: true });

  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAccessibleDescription(
    'Are you sure you want to delete 1 transaction? This action cannot be undone.',
  );
  await expect(closeButton).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(deleteButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(dialogInitiator).toBeFocused();

  await dialogInitiator.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await bulkDeleteResponse.waitForRequest();

  const cancelButton = dialog.getByRole('button', { name: 'Cancel', exact: true });
  const pendingDeleteButton = dialog.getByRole('button', { name: 'Deleting...', exact: true });
  await expect(pendingDeleteButton).toBeDisabled();
  await expect(cancelButton).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);

  const backdrop = dialog.locator('xpath=preceding-sibling::*[1]');
  await backdrop.click({ position: { x: 4, y: 4 } });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(cancelButton).toBeDisabled();

  bulkDeleteResponse.release();
  await expect(dialog).not.toBeVisible();
  await expect(selectionStatus).not.toBeVisible();
  browserMocks.assertNoUnexpectedRequests();

  const snapshot = await cspMonitor.snapshot();
  console.info(
    `Transaction dialog CSP audit: ${snapshot.cspViolations.length} CSP violations, ${snapshot.runtimeStylesheetAdditions.length} runtime-added stylesheets, ${snapshot.finalStyleElements.length} final stylesheets.`,
  );
  expect(snapshot.monitorVersion).toBe(1);
  expect(snapshot.cspViolations).toEqual([]);
  expect(snapshot.runtimeStylesheetAdditions).toEqual([]);
  expect(snapshot.finalStyleElements).toEqual([]);
  assertCspObservationsClean(snapshot);
});
