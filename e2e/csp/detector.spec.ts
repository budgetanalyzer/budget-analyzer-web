import { assertCspObservationsClean, formatCspDiagnostics } from 'e2e/fixtures/cspObservations';
import { registerTransactionPageResponses } from 'e2e/fixtures/scenarios';
import { expect, test } from 'e2e/fixtures/test';

test('controlled style mutations prove the strict CSP detector fails closed', async ({
  page,
  browserMocks,
  cspMonitor,
}) => {
  registerTransactionPageResponses(browserMocks);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
  browserMocks.assertNoUnexpectedRequests();

  await cspMonitor.reset();
  await page.evaluate(() => {
    const target = document.createElement('div');
    target.id = 'e2e-controlled-style-attribute';
    document.body.append(target);
    target.setAttribute('style', 'color: rgb(1, 2, 3)');

    const stylesheet = document.createElement('style');
    stylesheet.id = 'e2e-controlled-style-element';
    stylesheet.textContent = '#e2e-controlled-style-attribute { color: rgb(3, 2, 1); }';
    document.head.append(stylesheet);
    stylesheet.remove();
  });

  const snapshot = await cspMonitor.snapshot();
  const diagnostics = formatCspDiagnostics(snapshot);
  console.info(`Controlled CSP detector diagnostics:\n${diagnostics}`);

  expect(
    snapshot.styleAttributeMutations.some((finding) =>
      finding.element.includes('#e2e-controlled-style-attribute'),
    ),
  ).toBe(true);
  expect(
    snapshot.styleElementMutations.some((finding) =>
      finding.element.includes('#e2e-controlled-style-element'),
    ),
  ).toBe(true);
  expect(
    snapshot.finalStyleElements.every(
      (finding) => !finding.element.includes('#e2e-controlled-style-element'),
    ),
  ).toBe(true);
  expect(
    snapshot.cspViolations.some((finding) => finding.effectiveDirective.startsWith('style-src')),
  ).toBe(true);
  expect(diagnostics).toContain('e2e-controlled-style-attribute');
  expect(diagnostics).toContain('e2e-controlled-style-element');
  expect(() => assertCspObservationsClean(snapshot)).toThrow(/Strict CSP observation failed/);

  await page.evaluate(() => {
    document.querySelector('#e2e-controlled-style-attribute')?.remove();
    document.querySelector('#e2e-controlled-style-element')?.remove();
  });
  await cspMonitor.reset();
});
