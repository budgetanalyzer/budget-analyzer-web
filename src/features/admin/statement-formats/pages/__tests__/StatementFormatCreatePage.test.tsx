import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { StatementFormatCreatePage } from '@/features/admin/statement-formats/pages/StatementFormatCreatePage';
import { StatementFormatsListPage } from '@/features/admin/statement-formats/pages/StatementFormatsListPage';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';

describe('StatementFormatCreatePage', () => {
  it('creates a statement format with the submitted payload and navigates with success feedback', async () => {
    const user = userEvent.setup();
    let requestBody: unknown;

    server.use(
      http.post('/api/v1/statement-formats', async ({ request }) => {
        requestBody = await request.json();

        return HttpResponse.json(
          {
            id: 21,
            formatKey: 'acme-csv',
            displayName: 'Acme CSV',
            formatType: 'CSV',
            bankName: 'Acme Bank',
            defaultCurrencyIsoCode: 'USD',
            dateHeader: 'Posted Date',
            dateFormat: 'MM/dd/yyyy',
            descriptionHeader: 'Memo',
            creditHeader: 'Amount',
            debitHeader: 'Debit',
            typeHeader: 'Type',
            categoryHeader: 'Category',
            enabled: true,
          },
          { status: 201 },
        );
      }),
      http.get('/api/v1/statement-formats', () =>
        HttpResponse.json([
          {
            id: 21,
            formatKey: 'acme-csv',
            displayName: 'Acme CSV',
            formatType: 'CSV',
            bankName: 'Acme Bank',
            defaultCurrencyIsoCode: 'USD',
            enabled: true,
          },
        ]),
      ),
    );

    renderStatementFormatRoutes('/admin/statement-formats/new');

    await user.type(screen.getByLabelText(/Format Key/), 'acme-csv');
    await user.type(screen.getByLabelText(/Display Name/), 'Acme CSV');
    await user.type(screen.getByLabelText(/Bank Name/), 'Acme Bank');
    await user.type(screen.getByLabelText(/Default Currency/), 'usd');
    await user.type(screen.getByLabelText(/Date Column Header/), 'Posted Date');
    await user.type(screen.getByLabelText(/Date Format/), 'MM/dd/yyyy');
    await user.type(screen.getByLabelText(/Description Column Header/), 'Memo');
    await user.type(screen.getByLabelText(/Credit\/Amount Column Header/), 'Amount');
    await user.type(screen.getByLabelText(/Debit Column Header/), 'Debit');
    await user.type(screen.getByLabelText(/Type Column Header/), 'Type');
    await user.type(screen.getByLabelText(/Category Column Header/), 'Category');
    await user.click(screen.getByRole('button', { name: 'Create Format' }));

    expect(requestBody).toEqual({
      formatKey: 'acme-csv',
      displayName: 'Acme CSV',
      formatType: 'CSV',
      bankName: 'Acme Bank',
      defaultCurrencyIsoCode: 'USD',
      dateHeader: 'Posted Date',
      dateFormat: 'MM/dd/yyyy',
      descriptionHeader: 'Memo',
      creditHeader: 'Amount',
      debitHeader: 'Debit',
      typeHeader: 'Type',
      categoryHeader: 'Category',
    });
    expect(await screen.findByText('Format "Acme Bank" created successfully')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Statement Formats' })).toBeInTheDocument();
  });

  it('renders an API error banner when create fails', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/v1/statement-formats', () =>
        HttpResponse.json(
          {
            type: 'VALIDATION_ERROR',
            code: 'FORMAT_KEY_ALREADY_EXISTS',
            message: 'Format key already exists',
          },
          { status: 422 },
        ),
      ),
    );

    renderStatementFormatRoutes('/admin/statement-formats/new');

    await user.type(screen.getByLabelText(/Format Key/), 'duplicate-csv');
    await user.type(screen.getByLabelText(/Display Name/), 'Duplicate CSV');
    await user.type(screen.getByLabelText(/Bank Name/), 'Duplicate Bank');
    await user.type(screen.getByLabelText(/Default Currency/), 'usd');
    await user.type(screen.getByLabelText(/Date Column Header/), 'Date');
    await user.type(screen.getByLabelText(/Description Column Header/), 'Description');
    await user.type(screen.getByLabelText(/Credit\/Amount Column Header/), 'Amount');
    await user.click(screen.getByRole('button', { name: 'Create Format' }));

    expect(await screen.findByText('A format with this key already exists')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add New Format' })).toBeInTheDocument();
  });
});

function renderStatementFormatRoutes(initialPath: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/statement-formats/new" element={<StatementFormatCreatePage />} />
      <Route path="/admin/statement-formats" element={<StatementFormatsListPage />} />
    </Routes>,
    { initialEntries: [initialPath], router: 'dom' },
  );
}
