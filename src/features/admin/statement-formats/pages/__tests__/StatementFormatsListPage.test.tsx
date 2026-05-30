import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';

vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/hooks/useStatementFormats');

import { usePermission } from '@/features/auth/hooks/usePermission';
import { useStatementFormats } from '@/hooks/useStatementFormats';
import { StatementFormatsListPage } from '@/features/admin/statement-formats/pages/StatementFormatsListPage';
import { renderWithProviders } from '@/testing/test-utils';
import type { StatementFormat } from '@/types/statementFormat';
import type { ApiError } from '@/types/apiError';

const mockUsePermission = vi.mocked(usePermission);
const mockUseStatementFormats = vi.mocked(useStatementFormats);

const formats: StatementFormat[] = [
  {
    id: 1,
    displayName: 'Acme CSV',
    formatType: 'CSV',
    bankName: 'Acme Bank',
    defaultCurrencyIsoCode: 'USD',
    enabled: true,
  },
  {
    id: 2,
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

function mockQueryError(error: Error) {
  mockUseStatementFormats.mockReturnValue({
    data: undefined,
    isLoading: false,
    error,
  } as unknown as UseQueryResult<StatementFormat[], ApiError>);
}

function renderPage() {
  return renderWithProviders(<StatementFormatsListPage />, {
    initialEntries: ['/admin/statement-formats'],
    router: 'dom',
  });
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

  it('renders the empty state when no statement formats exist', () => {
    mockUsePermission.mockReturnValue(true);
    mockQuerySuccess([]);
    renderPage();

    expect(screen.getByText('No statement formats found')).toBeInTheDocument();
    expect(screen.getByText('Add your first format to get started')).toBeInTheDocument();
  });

  it('renders the API error state when statement formats fail to load', () => {
    mockUsePermission.mockReturnValue(true);
    mockQueryError(new Error('Statement format service unavailable'));
    renderPage();

    expect(
      screen.getByText('Failed to load statement formats: Statement format service unavailable'),
    ).toBeInTheDocument();
  });
});
