import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';

vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/hooks/useStatementFormats');

import { usePermission } from '@/features/auth/hooks/usePermission';
import { useStatementFormats } from '@/hooks/useStatementFormats';
import { StatementFormatsListPage } from '@/features/admin/statement-formats/pages/StatementFormatsListPage';
import type { StatementFormat } from '@/types/statementFormat';
import type { ApiError } from '@/types/apiError';

const mockUsePermission = vi.mocked(usePermission);
const mockUseStatementFormats = vi.mocked(useStatementFormats);

const formats: StatementFormat[] = [
  {
    id: 1,
    formatKey: 'acme-csv',
    displayName: 'Acme CSV',
    formatType: 'CSV',
    bankName: 'Acme Bank',
    defaultCurrencyIsoCode: 'USD',
    enabled: true,
  },
  {
    id: 2,
    formatKey: 'beta-csv',
    displayName: 'Beta CSV',
    formatType: 'CSV',
    bankName: 'Beta Bank',
    defaultCurrencyIsoCode: 'EUR',
    enabled: true,
  },
];

function mockQuerySuccess(data: StatementFormat[]) {
  mockUseStatementFormats.mockReturnValue({
    data,
    isLoading: false,
    error: null,
  } as unknown as UseQueryResult<StatementFormat[], ApiError>);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/statement-formats']}>
      <StatementFormatsListPage />
    </MemoryRouter>,
  );
}

describe('StatementFormatsListPage permission gating', () => {
  beforeEach(() => {
    mockUsePermission.mockReset();
    mockUseStatementFormats.mockReset();
  });

  it('hides the Add Format button and per-row Edit when statementformats:write is missing', () => {
    mockUsePermission.mockReturnValue(false);
    mockQuerySuccess(formats);
    renderPage();

    // Rows render
    expect(screen.getByText('Acme Bank')).toBeInTheDocument();
    expect(screen.getByText('Beta Bank')).toBeInTheDocument();
    // Write affordances absent
    expect(screen.queryByRole('button', { name: /Add Format/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(mockUsePermission).toHaveBeenCalledWith('statementformats:write');
  });

  it('shows the Add Format button and per-row Edit when statementformats:write is granted', () => {
    mockUsePermission.mockReturnValue(true);
    mockQuerySuccess(formats);
    renderPage();

    expect(screen.getByText('Acme Bank')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Format/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Edit/ })).toHaveLength(formats.length);
  });
});
