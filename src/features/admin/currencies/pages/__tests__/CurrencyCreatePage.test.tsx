import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { CurrencyCreatePage } from '@/features/admin/currencies/pages/CurrencyCreatePage';
import { CurrenciesListPage } from '@/features/admin/currencies/pages/CurrenciesListPage';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';

describe('CurrencyCreatePage', () => {
  it('creates a currency with the submitted payload and navigates with success feedback', async () => {
    const user = userEvent.setup();
    let requestBody: unknown;

    server.use(
      http.post('/api/v1/currencies', async ({ request }) => {
        requestBody = await request.json();

        return HttpResponse.json(
          {
            id: 99,
            currencyCode: 'CAD',
            providerSeriesId: 'DEXCAUS',
            enabled: true,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
          { status: 201 },
        );
      }),
      http.get('/api/v1/currencies', () =>
        HttpResponse.json([
          {
            id: 99,
            currencyCode: 'CAD',
            providerSeriesId: 'DEXCAUS',
            enabled: true,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ]),
      ),
    );

    renderCurrencyRoutes('/admin/currencies/new');

    await user.type(screen.getByLabelText(/Currency Code/), 'cad');
    await user.type(screen.getByLabelText(/FRED Series ID/), 'dexcaus');
    await user.click(screen.getByRole('button', { name: 'Create Currency' }));

    expect(requestBody).toEqual({
      currencyCode: 'CAD',
      providerSeriesId: 'DEXCAUS',
      enabled: true,
    });
    expect(await screen.findByText('Currency CAD created successfully')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Currencies' })).toBeInTheDocument();
  });

  it('renders an API error banner when create fails', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/v1/currencies', () =>
        HttpResponse.json(
          {
            type: 'VALIDATION_ERROR',
            code: 'INVALID_PROVIDER_SERIES_ID',
            message: 'Provider rejected this series id',
          },
          { status: 422 },
        ),
      ),
    );

    renderCurrencyRoutes('/admin/currencies/new');

    await user.type(screen.getByLabelText(/Currency Code/), 'gbp');
    await user.type(screen.getByLabelText(/FRED Series ID/), 'badseries');
    await user.click(screen.getByRole('button', { name: 'Create Currency' }));

    expect(
      await screen.findByText('The requested currency series id is invalid'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add New Currency' })).toBeInTheDocument();
  });
});

function renderCurrencyRoutes(initialPath: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/currencies/new" element={<CurrencyCreatePage />} />
      <Route path="/admin/currencies" element={<CurrenciesListPage />} />
    </Routes>,
    { initialEntries: [initialPath], router: 'dom' },
  );
}
