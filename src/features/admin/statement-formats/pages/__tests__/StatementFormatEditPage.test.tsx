import { describe, it, expect } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { StatementFormatEditPage } from '@/features/admin/statement-formats/pages/StatementFormatEditPage';
import { StatementFormatsListPage } from '@/features/admin/statement-formats/pages/StatementFormatsListPage';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';

describe('StatementFormatEditPage', () => {
  it('loads an existing statement format and updates mutable fields', async () => {
    const user = userEvent.setup();
    let requestBody: unknown;

    server.use(
      http.get('/api/v1/statement-formats/:formatKey', () =>
        HttpResponse.json({
          id: 31,
          formatKey: 'acme-csv',
          displayName: 'Acme CSV',
          formatType: 'CSV',
          bankName: 'Acme Bank',
          defaultCurrencyIsoCode: 'USD',
          dateHeader: 'Date',
          dateFormat: 'MM/dd/yyyy',
          descriptionHeader: 'Description',
          creditHeader: 'Credit',
          debitHeader: 'Debit',
          typeHeader: 'Type',
          categoryHeader: 'Category',
          enabled: true,
        }),
      ),
      http.put('/api/v1/statement-formats/:formatKey', async ({ params, request }) => {
        expect(params.formatKey).toBe('acme-csv');
        requestBody = await request.json();

        return HttpResponse.json({
          id: 31,
          formatKey: 'acme-csv',
          displayName: 'Acme CSV Updated',
          formatType: 'CSV',
          bankName: 'Acme Credit',
          defaultCurrencyIsoCode: 'CAD',
          dateHeader: 'Posted Date',
          dateFormat: 'yyyy-MM-dd',
          descriptionHeader: 'Memo',
          creditHeader: 'Amount',
          debitHeader: 'Withdrawal',
          typeHeader: 'Kind',
          categoryHeader: 'Class',
          enabled: false,
        });
      }),
      http.get('/api/v1/statement-formats', () =>
        HttpResponse.json([
          {
            id: 31,
            formatKey: 'acme-csv',
            displayName: 'Acme CSV Updated',
            formatType: 'CSV',
            bankName: 'Acme Credit',
            defaultCurrencyIsoCode: 'CAD',
            enabled: false,
          },
        ]),
      ),
    );

    renderStatementFormatRoutes('/admin/statement-formats/acme-csv');

    expect(await screen.findByDisplayValue('acme-csv')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Format Type/ })).toBeDisabled();

    changeInput(/Display Name/, 'Acme CSV Updated');
    changeInput(/Bank Name/, 'Acme Credit');
    changeInput(/Default Currency/, 'cad');
    changeInput(/Date Column Header/, 'Posted Date');
    changeInput(/Date Format/, 'yyyy-MM-dd');
    changeInput(/Description Column Header/, 'Memo');
    changeInput(/Credit\/Amount Column Header/, 'Amount');
    changeInput(/Debit Column Header/, 'Withdrawal');
    changeInput(/Type Column Header/, 'Kind');
    changeInput(/Category Column Header/, 'Class');
    await user.click(screen.getByRole('button', { name: /Status/ }));
    await user.click(screen.getByRole('button', { name: 'Disabled' }));
    await user.click(screen.getByRole('button', { name: 'Update Format' }));

    expect(requestBody).toEqual({
      displayName: 'Acme CSV Updated',
      bankName: 'Acme Credit',
      defaultCurrencyIsoCode: 'CAD',
      dateHeader: 'Posted Date',
      dateFormat: 'yyyy-MM-dd',
      descriptionHeader: 'Memo',
      creditHeader: 'Amount',
      debitHeader: 'Withdrawal',
      typeHeader: 'Kind',
      categoryHeader: 'Class',
      enabled: false,
    });
    expect(
      await screen.findByText('Format "Acme Credit" updated successfully'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Statement Formats' })).toBeInTheDocument();
  });

  it('renders an inline load error when the statement format cannot be found', async () => {
    server.use(
      http.get('/api/v1/statement-formats/:formatKey', () =>
        HttpResponse.json(
          {
            type: 'NOT_FOUND',
            message: 'Statement format not found',
          },
          { status: 404 },
        ),
      ),
    );

    renderStatementFormatRoutes('/admin/statement-formats/missing-csv');

    expect(
      await screen.findByText(
        'Failed to load statement format: Statement format not found',
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
  });

  it('renders an API error banner when update fails', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/v1/statement-formats/:formatKey', () =>
        HttpResponse.json({
          id: 33,
          formatKey: 'beta-csv',
          displayName: 'Beta CSV',
          formatType: 'CSV',
          bankName: 'Beta Bank',
          defaultCurrencyIsoCode: 'EUR',
          dateHeader: 'Date',
          descriptionHeader: 'Description',
          creditHeader: 'Amount',
          enabled: true,
        }),
      ),
      http.put('/api/v1/statement-formats/:formatKey', () =>
        HttpResponse.json(
          {
            type: 'APPLICATION_ERROR',
            message: 'Statement format update failed',
          },
          { status: 500 },
        ),
      ),
    );

    renderStatementFormatRoutes('/admin/statement-formats/beta-csv');

    expect(await screen.findByDisplayValue('beta-csv')).toBeDisabled();

    await user.clear(screen.getByLabelText(/Bank Name/));
    await user.type(screen.getByLabelText(/Bank Name/), 'Beta Credit');
    await user.click(screen.getByRole('button', { name: 'Update Format' }));

    expect(await screen.findByText('Statement format update failed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit Format' })).toBeInTheDocument();
  });
});

function renderStatementFormatRoutes(initialPath: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/statement-formats/:formatKey" element={<StatementFormatEditPage />} />
      <Route path="/admin/statement-formats" element={<StatementFormatsListPage />} />
    </Routes>,
    { initialEntries: [initialPath], router: 'dom' },
  );
}

function changeInput(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), {
    target: { value },
  });
}
