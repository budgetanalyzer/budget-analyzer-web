import { buildAuthenticatedUser, SAVED_VIEW_FIXTURE_ID } from 'e2e/fixtures/data';
import { assertCspObservationsClean } from 'e2e/fixtures/cspObservations';
import { registerSavedViewDetailResponses } from 'e2e/fixtures/scenarios';
import { expect, test } from 'e2e/fixtures/test';

test.use({
  authenticatedUser: buildAuthenticatedUser({
    permissions: ['views:read', 'views:write', 'views:delete'],
  }),
});

test('saved-view actions open the duplicate dialog without CSP findings', async ({
  page,
  authenticatedSession,
  browserMocks,
  cspMonitor,
}) => {
  await page.clock.setFixedTime((authenticatedSession.expiresAt - 60 * 60) * 1000);
  registerSavedViewDetailResponses(browserMocks);

  await page.goto(`./views/${SAVED_VIEW_FIXTURE_ID}`);
  await expect(
    page.getByRole('heading', { name: 'Production smoke view', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Session Expiring', exact: true }),
  ).not.toBeVisible();

  const viewActionsTrigger = page.getByRole('button', { name: 'View actions', exact: true });
  await expect(viewActionsTrigger).toBeVisible();
  await viewActionsTrigger.click();

  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText([
    'Rename view',
    'Duplicate view',
    'Delete view',
  ]);
  const destructiveSeparator = menu.getByRole('separator');
  await expect(destructiveSeparator).toHaveCount(1);
  await expect(destructiveSeparator.locator('xpath=preceding-sibling::*[1]')).toHaveText(
    'Duplicate view',
  );
  await expect(destructiveSeparator.locator('xpath=following-sibling::*[1]')).toHaveText(
    'Delete view',
  );
  browserMocks.assertNoUnexpectedRequests();

  await menu.getByRole('menuitem', { name: 'Duplicate view', exact: true }).click();
  const duplicateDialog = page.getByRole('dialog', { name: 'Duplicate view', exact: true });
  await expect(duplicateDialog).toBeVisible();
  await expect(duplicateDialog.getByRole('textbox', { name: 'View Name' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(duplicateDialog).not.toBeVisible();
  await expect(viewActionsTrigger).toBeFocused();
  browserMocks.assertNoUnexpectedRequests();

  const snapshot = await cspMonitor.snapshot();
  console.info(
    `Saved-view actions CSP audit: ${snapshot.cspViolations.length} CSP violations, ${snapshot.runtimeStylesheetAdditions.length} runtime-added stylesheets, ${snapshot.finalStyleElements.length} final stylesheets.`,
  );
  expect(snapshot.monitorVersion).toBe(1);
  expect(snapshot.cspViolations).toEqual([]);
  expect(snapshot.runtimeStylesheetAdditions).toEqual([]);
  expect(snapshot.finalStyleElements).toEqual([]);
  assertCspObservationsClean(snapshot);
});
