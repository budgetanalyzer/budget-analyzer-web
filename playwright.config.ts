import { defineConfig, devices } from '@playwright/test';

const defaultBaseURL = 'https://app.budgetanalyzer.localhost/_prod-smoke/';

function resolveBaseURL(): string {
  const configuredBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseURL;
  let url: URL;

  try {
    url = new URL(configuredBaseURL);
  } catch {
    throw new Error(
      `PLAYWRIGHT_BASE_URL must be an absolute HTTPS URL; received "${configuredBaseURL}".`,
    );
  }

  if (url.protocol !== 'https:') {
    throw new Error(
      `PLAYWRIGHT_BASE_URL must use HTTPS so certificate verification remains enabled; received "${configuredBaseURL}".`,
    );
  }

  return url.href;
}

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results/playwright',
  timeout: 15_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: resolveBaseURL(),
    headless: true,
    ignoreHTTPSErrors: false,
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
