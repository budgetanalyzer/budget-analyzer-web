import { buildAuthenticatedUser, MANUAL_TRANSACTION_ID } from 'e2e/fixtures/data';
import { assertCspObservationsClean } from 'e2e/fixtures/cspObservations';
import {
  registerDeferredCreateTransactionResponse,
  registerTransactionPageResponses,
} from 'e2e/fixtures/scenarios';
import { expect, test } from 'e2e/fixtures/test';

test.use({
  authenticatedUser: buildAuthenticatedUser({
    permissions: ['transactions:read', 'transactions:write'],
  }),
});

test('manual transaction creation navigates to cached detail and stays CSP-clean', async ({
  page,
  authenticatedSession,
  browserMocks,
  cspMonitor,
}) => {
  await page.clock.setFixedTime((authenticatedSession.expiresAt - 60 * 60) * 1000);
  registerTransactionPageResponses(browserMocks);
  const creationResponse = registerDeferredCreateTransactionResponse(browserMocks);

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Session Expiring', exact: true }),
  ).not.toBeVisible();
  const expectedDetailUrl = new URL(`transactions/${MANUAL_TRANSACTION_ID}`, page.url()).href;

  const dialogInitiator = page.getByRole('button', { name: 'Create transaction', exact: true });
  await dialogInitiator.click();

  const dialog = page.getByRole('dialog', { name: 'Create transaction', exact: true });
  await expect(dialog).toBeVisible();
  const currencySelect = dialog.getByLabel('Currency');
  expect(await currencySelect.evaluate((element) => element.tagName)).toBe('SELECT');
  await expect(currencySelect).toHaveValue('USD');
  await expect(currencySelect.locator('option')).toHaveText(['USD', 'EUR']);
  await currencySelect.selectOption('EUR');
  await expect(currencySelect).toHaveValue('EUR');
  await currencySelect.selectOption('USD');
  await dialog.getByLabel('Date').fill('2026-09-18');
  await dialog.getByLabel('Description').fill('Manual cash deposit');
  await dialog.getByLabel('Amount').fill('73.45');
  await dialog.getByLabel('Type').selectOption('CREDIT');
  await dialog.getByLabel('Bank name (optional)').fill('   ');
  await dialog.getByLabel('Account ID (optional)').fill('   ');
  browserMocks.assertNoUnexpectedRequests();

  const createRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      request.method() === 'POST' && url.pathname === '/api/v1/transactions' && url.search === ''
    );
  });
  await dialog.getByRole('button', { name: 'Create transaction', exact: true }).click();
  const createRequest = await createRequestPromise;
  await creationResponse.waitForRequest();

  expect(createRequest.postDataJSON()).toEqual({
    date: '2026-09-18',
    description: 'Manual cash deposit',
    amount: 73.45,
    currencyIsoCode: 'USD',
    type: 'CREDIT',
  });
  await expect(dialog.getByRole('button', { name: 'Creating...', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);

  const backdrop = dialog.locator('xpath=preceding-sibling::*[1]');
  await backdrop.click({ position: { x: 4, y: 4 } });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  creationResponse.release();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(expectedDetailUrl);
  await expect(
    page.getByRole('heading', { name: 'Transaction Details', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Manual cash deposit', { exact: true })).toBeVisible();
  await expect(page.getByText('Amount in USD', { exact: true })).toBeVisible();
  await expect(page.getByText('$73.45', { exact: true })).toBeVisible();
  await expect(page.getByText('CREDIT', { exact: true })).toBeVisible();
  await expect(page.getByText('—', { exact: true })).toHaveCount(2);
  browserMocks.assertNoUnexpectedRequests();

  const snapshot = await cspMonitor.snapshot();
  console.info(
    `Manual transaction creation CSP audit: ${snapshot.cspViolations.length} CSP violations, ${snapshot.runtimeStylesheetAdditions.length} runtime-added stylesheets, ${snapshot.finalStyleElements.length} final stylesheets.`,
  );
  expect(snapshot.monitorVersion).toBe(1);
  expect(snapshot.cspViolations).toEqual([]);
  expect(snapshot.runtimeStylesheetAdditions).toEqual([]);
  expect(snapshot.finalStyleElements).toEqual([]);
  assertCspObservationsClean(snapshot);
});
