import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { CurrencyEditPage } from '@/features/admin/currencies/pages/CurrencyEditPage';
import { CurrenciesListPage } from '@/features/admin/currencies/pages/CurrenciesListPage';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';

describe('CurrencyEditPage', () => {
  it('loads an existing currency and disables it after confirmation', async () => {
    const user = userEvent.setup();
    let requestBody: unknown;

    server.use(
      http.get('/api/v1/currencies/:id', () =>
        HttpResponse.json({
          id: 5,
          currencyCode: 'GBP',
          providerSeriesId: 'DEXUSUK',
          enabled: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        }),
      ),
      http.get('/api/v1/transactions/count', ({ request }) => {
        expect(new URL(request.url).searchParams.get('currencyIsoCode')).toBe('GBP');
        return HttpResponse.json(2);
      }),
      http.put('/api/v1/currencies/:id', async ({ request }) => {
        requestBody = await request.json();

        return HttpResponse.json({
          id: 5,
          currencyCode: 'GBP',
          providerSeriesId: 'DEXUSUK',
          enabled: false,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-03T00:00:00Z',
        });
      }),
      http.get('/api/v1/currencies', () =>
        HttpResponse.json([
          {
            id: 5,
            currencyCode: 'GBP',
            providerSeriesId: 'DEXUSUK',
            enabled: false,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-03T00:00:00Z',
          },
        ]),
      ),
    );

    renderCurrencyRoutes('/admin/currencies/5');

    expect(await screen.findByDisplayValue('GBP')).toBeDisabled();
    expect(screen.getByDisplayValue('DEXUSUK')).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Status/ }));
    await user.click(screen.getByRole('button', { name: 'Disabled' }));
    await user.click(screen.getByRole('button', { name: 'Update Currency' }));

    expect(await screen.findByRole('heading', { name: 'Disable GBP?' })).toBeInTheDocument();
    expect(screen.getByText(/There are 2 active transactions using GBP/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disable Anyway' }));

    expect(requestBody).toEqual({ enabled: false });
    expect(await screen.findByText('Currency GBP updated successfully')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Currencies' })).toBeInTheDocument();
  });

  it('renders an inline load error when the currency cannot be found', async () => {
    server.use(
      http.get('/api/v1/currencies/:id', () =>
        HttpResponse.json(
          {
            type: 'NOT_FOUND',
            message: 'Currency not found',
          },
          { status: 404 },
        ),
      ),
    );

    renderCurrencyRoutes('/admin/currencies/404');

    expect(
      await screen.findByText('Failed to load currency: Currency not found', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it('renders an API error banner when update fails', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/v1/currencies/:id', () =>
        HttpResponse.json({
          id: 7,
          currencyCode: 'JPY',
          providerSeriesId: 'DEXJPUS',
          enabled: false,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        }),
      ),
      http.put('/api/v1/currencies/:id', () =>
        HttpResponse.json(
          {
            type: 'APPLICATION_ERROR',
            message: 'Currency update failed',
          },
          { status: 500 },
        ),
      ),
    );

    renderCurrencyRoutes('/admin/currencies/7');

    expect(await screen.findByDisplayValue('JPY')).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Status/ }));
    await user.click(screen.getByRole('button', { name: 'Enabled' }));
    await user.click(screen.getByRole('button', { name: 'Update Currency' }));

    expect(await screen.findByText('Currency update failed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit Currency' })).toBeInTheDocument();
  });
});

function renderCurrencyRoutes(initialPath: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/currencies/:id" element={<CurrencyEditPage />} />
      <Route path="/admin/currencies" element={<CurrenciesListPage />} />
    </Routes>,
    { initialEntries: [initialPath], router: 'dom' },
  );
}
