import {
  buildAuthenticatedUser,
  SAVED_VIEW_ELIGIBLE_TRANSACTION_ID,
  SAVED_VIEW_FIXTURE_ID,
  SAVED_VIEW_MEMBER_TRANSACTION_ID,
} from 'e2e/fixtures/data';
import { assertCspObservationsClean } from 'e2e/fixtures/cspObservations';
import {
  registerDeferredAddViewTransactionsResponse,
  registerSavedViewAdditionResponses,
} from 'e2e/fixtures/scenarios';
import { expect, test } from 'e2e/fixtures/test';

test.use({
  authenticatedUser: buildAuthenticatedUser({
    permissions: ['views:read', 'views:write'],
  }),
});

test('saved-view transaction addition stays modal and CSP-clean through pending success', async ({
  page,
  authenticatedSession,
  browserMocks,
  cspMonitor,
}) => {
  await page.clock.setFixedTime((authenticatedSession.expiresAt - 60 * 60) * 1000);
  registerSavedViewAdditionResponses(browserMocks);
  const additionResponse = registerDeferredAddViewTransactionsResponse(browserMocks);

  await page.goto(`./views/${SAVED_VIEW_FIXTURE_ID}?q=Existing`);
  await expect(
    page.getByRole('heading', { name: 'Production smoke view', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Session Expiring', exact: true }),
  ).not.toBeVisible();

  const dialogInitiator = page.getByRole('button', { name: 'Add transactions', exact: true });
  await dialogInitiator.click();

  const dialog = page.getByRole('dialog', {
    name: 'Add transactions to Production smoke view',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder('Search descriptions ↵')).toHaveValue('');
  await expect(dialog.getByRole('button', { name: 'Filter by bank' })).toHaveText('All Banks');
  await expect(dialog.getByRole('button', { name: 'Filter by account' })).toHaveText(
    'All Accounts',
  );
  await expect(dialog.getByRole('button', { name: 'Filter by transaction type' })).toHaveText(
    'all',
  );
  await expect(dialog.getByRole('spinbutton', { name: 'Minimum amount' })).toHaveValue('');
  await expect(dialog.getByRole('spinbutton', { name: 'Maximum amount' })).toHaveValue('');

  const memberRow = dialog.getByRole('row', { name: /Existing saved-view member/ });
  const eligibleRow = dialog.getByRole('row', {
    name: /Eligible transaction for saved-view addition/,
  });
  await expect(memberRow).toBeVisible();
  await expect(eligibleRow).toBeVisible();
  await expect(
    memberRow.getByRole('checkbox', {
      name: `Transaction ${SAVED_VIEW_MEMBER_TRANSACTION_ID} is already in Production smoke view`,
    }),
  ).toBeDisabled();
  await expect(memberRow.getByText('Already in view', { exact: true })).toBeVisible();

  const eligibleCheckbox = eligibleRow.getByRole('checkbox', {
    name: `Select transaction ${SAVED_VIEW_ELIGIBLE_TRANSACTION_ID} to add to Production smoke view`,
  });
  await expect(eligibleCheckbox).toBeEnabled();
  await eligibleCheckbox.click();
  await expect(dialog.getByText('1 eligible transaction selected', { exact: true })).toBeVisible();
  browserMocks.assertNoUnexpectedRequests();

  const membershipRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      request.method() === 'PATCH' &&
      url.pathname === `/api/v1/views/${SAVED_VIEW_FIXTURE_ID}/transactions` &&
      url.search === ''
    );
  });
  await dialog.getByRole('button', { name: 'Add transactions', exact: true }).click();
  const membershipRequest = await membershipRequestPromise;
  await additionResponse.waitForRequest();

  expect(membershipRequest.method()).toBe('PATCH');
  expect(new URL(membershipRequest.url()).pathname).toBe(
    `/api/v1/views/${SAVED_VIEW_FIXTURE_ID}/transactions`,
  );
  expect(membershipRequest.postDataJSON()).toEqual({
    addTransactionIds: [SAVED_VIEW_ELIGIBLE_TRANSACTION_ID],
    removeTransactionIds: [],
  });

  await expect(dialog.getByRole('button', { name: 'Adding...', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);

  const backdrop = dialog.locator('xpath=preceding-sibling::*[1]');
  await backdrop.click({ position: { x: 4, y: 4 } });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  additionResponse.release();
  await expect(dialog).not.toBeVisible();
  await expect(dialogInitiator).toBeFocused();
  browserMocks.assertNoUnexpectedRequests();

  const snapshot = await cspMonitor.snapshot();
  console.info(
    `Saved-view transaction addition CSP audit: ${snapshot.cspViolations.length} CSP violations, ${snapshot.runtimeStylesheetAdditions.length} runtime-added stylesheets, ${snapshot.finalStyleElements.length} final stylesheets.`,
  );
  expect(snapshot.monitorVersion).toBe(1);
  expect(snapshot.cspViolations).toEqual([]);
  expect(snapshot.runtimeStylesheetAdditions).toEqual([]);
  expect(snapshot.finalStyleElements).toEqual([]);
  assertCspObservationsClean(snapshot);
});
