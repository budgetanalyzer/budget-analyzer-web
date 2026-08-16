import type { CspObservationSnapshot } from 'e2e/fixtures/cspObservations';
import { assertCspObservationsClean, formatCspDiagnostics } from 'e2e/fixtures/cspObservations';
import { registerTransactionPageResponses } from 'e2e/fixtures/scenarios';
import { expect, test } from 'e2e/fixtures/test';

function hasEnforcedStyleViolation(snapshot: CspObservationSnapshot): boolean {
  return snapshot.cspViolations.some(
    (finding) =>
      finding.disposition === 'enforce' && finding.effectiveDirective.startsWith('style-src'),
  );
}

test.beforeEach(async ({ page, browserMocks, cspMonitor }) => {
  registerTransactionPageResponses(browserMocks);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
  browserMocks.assertNoUnexpectedRequests();
  await cspMonitor.reset();
});

test('direct CSS property writes serialize to a style attribute without violating CSP', async ({
  page,
  cspMonitor,
}) => {
  await page.evaluate(() => {
    const target = document.createElement('div');
    target.id = 'e2e-allowed-style-properties';
    document.body.append(target);

    target.style.opacity = '0.5';
    Object.assign(target.style, { transform: 'translateX(1px)' });
    target.style.setProperty('color', 'rgb(1, 2, 3)');
  });

  const target = page.locator('#e2e-allowed-style-properties');
  await expect(target).toHaveAttribute(
    'style',
    'opacity: 0.5; transform: translateX(1px); color: rgb(1, 2, 3);',
  );
  await expect(target).toHaveCSS('opacity', '0.5');
  await expect(target).toHaveCSS('color', 'rgb(1, 2, 3)');

  const snapshot = await cspMonitor.snapshot();
  expect(snapshot.cspViolations).toEqual([]);
  expect(snapshot.runtimeStylesheetAdditions).toEqual([]);
  expect(snapshot.finalStyleElements).toEqual([]);
  expect(snapshot.consoleErrors).toEqual([]);
  expect(() => assertCspObservationsClean(snapshot)).not.toThrow();
});

test('setAttribute style assignment produces an enforced CSP violation', async ({
  page,
  cspMonitor,
}) => {
  await page.evaluate(() => {
    const parent = document.createElement('div');
    parent.style.color = 'rgb(9, 8, 7)';
    const target = document.createElement('div');
    target.id = 'e2e-blocked-style-attribute';
    parent.append(target);
    document.body.append(parent);
    target.setAttribute('style', 'color: rgb(1, 2, 3)');
  });
  await page.waitForFunction(() => {
    const snapshot = window.__budgetAnalyzerCspMonitor?.snapshot();
    return snapshot?.cspViolations.some(
      (finding) =>
        finding.disposition === 'enforce' && finding.effectiveDirective.startsWith('style-src'),
    );
  });

  const target = page.locator('#e2e-blocked-style-attribute');
  await expect(target).toHaveAttribute('style', 'color: rgb(1, 2, 3)');
  await expect(target).toHaveCSS('color', 'rgb(9, 8, 7)');

  const snapshot = await cspMonitor.snapshot();
  const diagnostics = formatCspDiagnostics(snapshot);
  console.info(`Controlled setAttribute CSP diagnostics:\n${diagnostics}`);

  expect(hasEnforcedStyleViolation(snapshot)).toBe(true);
  expect(snapshot.runtimeStylesheetAdditions).toEqual([]);
  expect(diagnostics).toContain('CSP enforce style-src');
  expect(() => assertCspObservationsClean(snapshot)).toThrow(/Browser security observation failed/);
});

test('CSSStyleDeclaration cssText serializes and applies without violating CSP', async ({
  page,
  cspMonitor,
}) => {
  await page.evaluate(() => {
    const target = document.createElement('div');
    target.id = 'e2e-allowed-css-text';
    document.body.append(target);
    target.style.cssText = 'color: rgb(1, 2, 3)';
  });

  const target = page.locator('#e2e-allowed-css-text');
  await expect(target).toHaveAttribute('style', 'color: rgb(1, 2, 3);');
  await expect(target).toHaveCSS('color', 'rgb(1, 2, 3)');

  const snapshot = await cspMonitor.snapshot();
  expect(snapshot.cspViolations).toEqual([]);
  expect(snapshot.runtimeStylesheetAdditions).toEqual([]);
  expect(snapshot.finalStyleElements).toEqual([]);
  expect(snapshot.consoleErrors).toEqual([]);
  expect(() => assertCspObservationsClean(snapshot)).not.toThrow();
});

test('runtime stylesheet insertion fails the repository stylesheet guard', async ({
  page,
  cspMonitor,
}) => {
  await page.evaluate(() => {
    const stylesheet = document.createElement('style');
    stylesheet.id = 'e2e-prohibited-runtime-stylesheet';
    stylesheet.textContent = 'body { color: rgb(3, 2, 1); }';
    document.head.append(stylesheet);
    stylesheet.remove();
  });
  await page.waitForFunction(() =>
    window.__budgetAnalyzerCspMonitor
      ?.snapshot()
      .runtimeStylesheetAdditions.some((finding) =>
        finding.element.includes('#e2e-prohibited-runtime-stylesheet'),
      ),
  );

  const snapshot = await cspMonitor.snapshot();
  const diagnostics = formatCspDiagnostics(snapshot);
  console.info(`Controlled runtime stylesheet diagnostics:\n${diagnostics}`);

  expect(
    snapshot.runtimeStylesheetAdditions.some((finding) =>
      finding.element.includes('#e2e-prohibited-runtime-stylesheet'),
    ),
  ).toBe(true);
  expect(
    snapshot.finalStyleElements.every(
      (finding) => !finding.element.includes('#e2e-prohibited-runtime-stylesheet'),
    ),
  ).toBe(true);
  expect(diagnostics).toContain('repository stylesheet guard: runtime <style> added');
  expect(() => assertCspObservationsClean(snapshot)).toThrow(/Browser security observation failed/);
});
