import { test } from '@playwright/test';

const requiredDirectives = new Map<string, readonly string[]>([
  ['script-src', ["'self'"]],
  ['style-src', ["'self'"]],
  ['object-src', ["'none'"]],
  ['base-uri', ["'self'"]],
]);
const unsafeSources = new Set(["'unsafe-inline'", "'unsafe-eval'"]);

function parseContentSecurityPolicy(header: string): Map<string, Set<string>> {
  const directives = new Map<string, Set<string>>();

  for (const segment of header.split(';')) {
    const [name, ...sources] = segment.trim().split(/\s+/);
    if (!name) continue;

    directives.set(name.toLowerCase(), new Set(sources.map((source) => source.toLowerCase())));
  }

  return directives;
}

function navigationFailureMessage(error: unknown, targetUrl: string): string {
  const detail = error instanceof Error ? error.message : String(error);

  if (/ERR_CERT|certificate|SSL|TLS/i.test(detail)) {
    return [
      `TLS prerequisite failed while loading ${targetUrl}.`,
      'Run check-budget-analyzer-local-ca-trust and repair the container trust store if needed; do not disable HTTPS verification.',
      `Browser detail: ${detail}`,
    ].join(' ');
  }

  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|getaddrinfo/i.test(detail)) {
    return [
      `DNS prerequisite failed while loading ${targetUrl}.`,
      'Verify the workstation-managed hostname resolves inside the agent container and that Tilt is healthy.',
      `Browser detail: ${detail}`,
    ].join(' ');
  }

  if (
    /ERR_CONNECTION|ERR_ADDRESS_UNREACHABLE|ERR_TIMED_OUT|ECONN|timed out|Timeout/i.test(detail)
  ) {
    return [
      `Connection prerequisite failed while loading ${targetUrl}.`,
      'Verify the workstation-owned Tilt stack and production-smoke ingress are running and reachable.',
      `Browser detail: ${detail}`,
    ].join(' ');
  }

  return [
    `Browser infrastructure failed while loading ${targetUrl}.`,
    'Verify DNS, trusted local CA installation, and the workstation-owned Tilt stack before retrying.',
    `Browser detail: ${detail}`,
  ].join(' ');
}

test('strict production-smoke response has the required CSP', async ({ page, baseURL }) => {
  if (!baseURL) {
    throw new Error('Harness configuration failure: Playwright baseURL is not configured.');
  }

  const targetUrl = new URL(baseURL);
  const unauthenticatedUserUrl = new URL('/auth/v1/user', targetUrl).href;

  await page.route(unauthenticatedUserUrl, (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthenticated' }),
    }),
  );

  let response;
  try {
    response = await page.goto(targetUrl.href, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    throw new Error(navigationFailureMessage(error, targetUrl.href));
  }

  if (!response) {
    throw new Error(
      `Browser infrastructure failure: navigation to ${targetUrl.href} returned no document response.`,
    );
  }

  const effectiveUrl = new URL(response.url());
  if (effectiveUrl.origin !== targetUrl.origin || effectiveUrl.pathname !== targetUrl.pathname) {
    throw new Error(
      `Wrong-route failure: expected the production-smoke document at ${targetUrl.href}, but navigation resolved to ${effectiveUrl.href}. Verify the external ingress route and PLAYWRIGHT_BASE_URL.`,
    );
  }

  if (response.status() !== 200) {
    throw new Error(
      `Wrong-route or unhealthy-server failure: expected HTTP 200 from ${targetUrl.href}, received HTTP ${response.status()}. Verify the workstation-owned production-smoke resource.`,
    );
  }

  const cspHeader = response.headers()['content-security-policy'];
  if (!cspHeader) {
    throw new Error(
      `CSP response-policy failure: ${effectiveUrl.href} returned HTTP 200 without a Content-Security-Policy header. Verify that the strict /_prod-smoke/ route was used.`,
    );
  }

  const directives = parseContentSecurityPolicy(cspHeader);
  const unsafeFindings = [...directives.entries()].flatMap(([directive, sources]) =>
    [...sources]
      .filter((source) => unsafeSources.has(source))
      .map((source) => `${directive} ${source}`),
  );

  if (unsafeFindings.length > 0) {
    throw new Error(
      `CSP response-policy failure: prohibited unsafe sources were present: ${unsafeFindings.join(', ')}.`,
    );
  }

  const missingRequirements = [...requiredDirectives.entries()].flatMap(
    ([directive, requiredSources]) => {
      const actualSources = directives.get(directive);
      if (!actualSources) return [`missing ${directive}`];

      return requiredSources
        .filter((source) => !actualSources.has(source))
        .map((source) => `${directive} is missing ${source}`);
    },
  );

  if (missingRequirements.length > 0) {
    throw new Error(
      `CSP response-policy failure: ${missingRequirements.join('; ')}. Received: ${cspHeader}`,
    );
  }
});
