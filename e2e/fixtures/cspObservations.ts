import type { ConsoleMessage, Page } from '@playwright/test';

export interface ScenarioTiming {
  documentElapsedMs: number;
  scenarioElapsedMs: number;
  readyState: DocumentReadyState;
}

export interface SourceLocation {
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface CspViolationObservation extends SourceLocation {
  effectiveDirective: string;
  violatedDirective: string;
  blockedUri: string;
  disposition: SecurityPolicyViolationEventDisposition;
  timing: ScenarioTiming;
}

export interface StyleElementObservation {
  element: string;
  timing: ScenarioTiming;
}

export interface StyleAttributeObservation {
  element: string;
  mutation: 'added' | 'changed' | 'removed';
  timing: ScenarioTiming;
}

export interface FinalDomStyleObservation {
  element: string;
}

export interface BrowserConsoleObservation extends SourceLocation {
  message: string;
  timing: ScenarioTiming;
}

export interface CspObservationSnapshot {
  monitorVersion: 1;
  cspViolations: CspViolationObservation[];
  styleElementMutations: StyleElementObservation[];
  styleAttributeMutations: StyleAttributeObservation[];
  finalStyleElements: FinalDomStyleObservation[];
  finalStyleAttributes: FinalDomStyleObservation[];
  consoleErrors: BrowserConsoleObservation[];
}

interface BrowserObservationChannels {
  cspViolations: CspViolationObservation[];
  styleElementMutations: StyleElementObservation[];
  styleAttributeMutations: StyleAttributeObservation[];
}

interface BrowserCspMonitor {
  version: 1;
  reset: () => void;
  snapshot: () => Omit<CspObservationSnapshot, 'consoleErrors'>;
  timing: () => ScenarioTiming;
}

declare global {
  interface Window {
    __budgetAnalyzerCspMonitor?: BrowserCspMonitor;
  }
}

const relevantConsoleError =
  /content security policy|securitypolicyviolation|refused to (?:apply|execute|load)|violates the following content security policy directive/i;

function sanitizeUrl(value: string): string {
  if (!value || /^(?:inline|eval|self|none)$/i.test(value)) return value;

  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.slice(0, 240);
  }
}

function sanitizeConsoleMessage(value: string): string {
  return value.replace(/https?:\/\/[^\s'"<>]+/g, (url) => sanitizeUrl(url)).slice(0, 500);
}

/** Runs in the document before application scripts. Keep this function self-contained. */
export function installBrowserCspMonitor(): void {
  if (window.__budgetAnalyzerCspMonitor) return;

  const installedAt = performance.now();
  let scenarioStartedAt = installedAt;
  let observations: BrowserObservationChannels = {
    cspViolations: [],
    styleElementMutations: [],
    styleAttributeMutations: [],
  };

  const timing = (): ScenarioTiming => ({
    documentElapsedMs: Math.max(0, performance.now() - installedAt),
    scenarioElapsedMs: Math.max(0, performance.now() - scenarioStartedAt),
    readyState: document.readyState,
  });

  const safeUrl = (value: string): string => {
    if (!value || /^(?:inline|eval|self|none)$/i.test(value)) return value;

    try {
      const url = new URL(value, window.location.href);
      return `${url.origin}${url.pathname}`;
    } catch {
      return value.slice(0, 240);
    }
  };

  const elementSummary = (element: Element): string => {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id.slice(0, 80)}` : '';
    const classes = [...element.classList]
      .slice(0, 3)
      .map((className) => `.${className.slice(0, 80)}`)
      .join('');
    return `${tag}${id}${classes}`;
  };

  const recordStyleElement = (element: Element): void => {
    observations.styleElementMutations.push({
      element: elementSummary(element),
      timing: timing(),
    });
  };

  const recordAddedStyles = (node: Node): void => {
    if (!(node instanceof Element)) return;
    if (node.matches('style')) recordStyleElement(node);
    node.querySelectorAll('style').forEach(recordStyleElement);
  };

  document.addEventListener('securitypolicyviolation', (event) => {
    observations.cspViolations.push({
      effectiveDirective: event.effectiveDirective,
      violatedDirective: event.violatedDirective,
      blockedUri: safeUrl(event.blockedURI),
      disposition: event.disposition,
      sourceFile: event.sourceFile ? safeUrl(event.sourceFile) : undefined,
      lineNumber: event.lineNumber || undefined,
      columnNumber: event.columnNumber || undefined,
      timing: timing(),
    });
  });

  const observer = new MutationObserver((mutationRecords) => {
    for (const mutationRecord of mutationRecords) {
      if (mutationRecord.type === 'childList') {
        mutationRecord.addedNodes.forEach(recordAddedStyles);
        continue;
      }

      if (mutationRecord.type === 'attributes' && mutationRecord.target instanceof Element) {
        const hasStyle = mutationRecord.target.hasAttribute('style');
        const mutation =
          mutationRecord.oldValue === null ? 'added' : hasStyle ? 'changed' : 'removed';
        observations.styleAttributeMutations.push({
          element: elementSummary(mutationRecord.target),
          mutation,
          timing: timing(),
        });
      }
    }
  });

  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style'],
    attributeOldValue: true,
  });

  window.__budgetAnalyzerCspMonitor = {
    version: 1,
    timing,
    reset: () => {
      observations = {
        cspViolations: [],
        styleElementMutations: [],
        styleAttributeMutations: [],
      };
      scenarioStartedAt = performance.now();
    },
    snapshot: () => ({
      monitorVersion: 1,
      cspViolations: [...observations.cspViolations],
      styleElementMutations: [...observations.styleElementMutations],
      styleAttributeMutations: [...observations.styleAttributeMutations],
      finalStyleElements: [...document.querySelectorAll('style')].map((element) => ({
        element: elementSummary(element),
      })),
      finalStyleAttributes: [...document.querySelectorAll('[style]')].map((element) => ({
        element: elementSummary(element),
      })),
    }),
  };
}

function missingMonitorError(): Error {
  return new Error(
    'CSP monitor is not installed in the page. Install it with page.addInitScript() before navigation; observations cannot fail closed after application startup.',
  );
}

function formatTiming(timing: ScenarioTiming): string {
  return `${Math.round(timing.scenarioElapsedMs)}ms/${timing.readyState}`;
}

function formatLocation(observation: SourceLocation): string {
  if (!observation.sourceFile) return '';
  const line = observation.lineNumber ? `:${observation.lineNumber}` : '';
  const column = observation.columnNumber ? `:${observation.columnNumber}` : '';
  return ` at ${observation.sourceFile}${line}${column}`;
}

function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  const unique = new Map<string, T>();
  values.forEach((value) => {
    const findingKey = key(value);
    if (!unique.has(findingKey)) unique.set(findingKey, value);
  });
  return [...unique.values()];
}

export function formatCspDiagnostics(snapshot: CspObservationSnapshot): string {
  const primaryFindings = [
    ...uniqueBy(
      snapshot.cspViolations,
      (violation) =>
        `${violation.disposition}|${violation.effectiveDirective}|${violation.blockedUri}|${violation.sourceFile}|${violation.lineNumber}|${violation.columnNumber}`,
    ).map(
      (violation) =>
        `CSP ${violation.disposition} ${violation.effectiveDirective} blocked ${violation.blockedUri || 'unknown'}${formatLocation(violation)} [${formatTiming(violation.timing)}]`,
    ),
    ...uniqueBy(snapshot.styleElementMutations, (observation) => observation.element).map(
      (observation) =>
        `runtime <style> added: ${observation.element} [${formatTiming(observation.timing)}]`,
    ),
    ...uniqueBy(
      snapshot.styleAttributeMutations.filter((observation) => observation.mutation !== 'removed'),
      (observation) => `${observation.mutation}|${observation.element}`,
    ).map(
      (observation) =>
        `runtime style attribute ${observation.mutation}: ${observation.element} [${formatTiming(observation.timing)}]`,
    ),
    ...uniqueBy(snapshot.finalStyleElements, (observation) => observation.element).map(
      (observation) => `final DOM <style> present: ${observation.element}`,
    ),
    ...uniqueBy(snapshot.finalStyleAttributes, (observation) => observation.element).map(
      (observation) => `final DOM style attribute present: ${observation.element}`,
    ),
  ];
  const supportingEvidence = uniqueBy(
    snapshot.consoleErrors,
    (observation) =>
      `${observation.message}|${observation.sourceFile}|${observation.lineNumber}|${observation.columnNumber}`,
  ).map(
    (observation) =>
      `console evidence: ${observation.message}${formatLocation(observation)} [${formatTiming(observation.timing)}]`,
  );

  return [...primaryFindings, ...supportingEvidence].join('\n');
}

export function assertCspObservationsClean(snapshot: CspObservationSnapshot): void {
  const hasRuntimeStyleAttribute = snapshot.styleAttributeMutations.some(
    (observation) => observation.mutation !== 'removed',
  );
  const hasExecutableFinding =
    snapshot.cspViolations.length > 0 ||
    snapshot.styleElementMutations.length > 0 ||
    hasRuntimeStyleAttribute ||
    snapshot.finalStyleElements.length > 0 ||
    snapshot.finalStyleAttributes.length > 0;

  if (!hasExecutableFinding) return;

  throw new Error(`Strict CSP observation failed:\n${formatCspDiagnostics(snapshot)}`);
}

export interface CspObserverController {
  reset: () => Promise<void>;
  snapshot: () => Promise<CspObservationSnapshot>;
  assertClean: () => Promise<void>;
}

export async function createCspObserverController(page: Page): Promise<CspObserverController> {
  const consoleErrors: BrowserConsoleObservation[] = [];

  const consoleListener = (message: ConsoleMessage): void => {
    if (message.type() !== 'error' || !relevantConsoleError.test(message.text())) return;

    const location = message.location();
    void page
      .evaluate(() => window.__budgetAnalyzerCspMonitor?.timing())
      .then((timing) => {
        if (!timing) return;
        consoleErrors.push({
          message: sanitizeConsoleMessage(message.text()),
          sourceFile: location.url ? sanitizeUrl(location.url) : undefined,
          lineNumber: location.lineNumber || undefined,
          columnNumber: location.columnNumber || undefined,
          timing,
        });
      })
      .catch(() => undefined);
  };

  page.on('console', consoleListener);
  await page.addInitScript(installBrowserCspMonitor);

  const reset = async (): Promise<void> => {
    consoleErrors.length = 0;
    const resetSucceeded = await page.evaluate(() => {
      if (!window.__budgetAnalyzerCspMonitor) return false;
      window.__budgetAnalyzerCspMonitor.reset();
      return true;
    });
    if (!resetSucceeded) throw missingMonitorError();
    consoleErrors.length = 0;
  };

  const snapshot = async (): Promise<CspObservationSnapshot> => {
    const browserSnapshot = await page.evaluate(() =>
      window.__budgetAnalyzerCspMonitor?.snapshot(),
    );
    if (!browserSnapshot) throw missingMonitorError();

    const result: CspObservationSnapshot = {
      ...browserSnapshot,
      consoleErrors: [...consoleErrors],
    };
    consoleErrors.length = 0;
    await page.evaluate(() => window.__budgetAnalyzerCspMonitor?.reset());
    return result;
  };

  return {
    reset,
    snapshot,
    assertClean: async () => assertCspObservationsClean(await snapshot()),
  };
}

export async function snapshotCspObservations(page: Page): Promise<CspObservationSnapshot> {
  const browserSnapshot = await page.evaluate(() => window.__budgetAnalyzerCspMonitor?.snapshot());
  if (!browserSnapshot) throw missingMonitorError();
  return { ...browserSnapshot, consoleErrors: [] };
}
