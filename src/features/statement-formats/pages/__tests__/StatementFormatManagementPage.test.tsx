import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseQueryResult } from '@tanstack/react-query';

vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/hooks/useStatementFormats');
vi.mock('@/hooks/useToast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { usePermission } from '@/features/auth/hooks/usePermission';
import {
  useHideStatementFormat,
  useStatementFormats,
  useUnhideStatementFormat,
} from '@/hooks/useStatementFormats';
import { toast } from '@/hooks/useToast';
import { StatementFormatManagementPage } from '@/features/statement-formats/pages/StatementFormatManagementPage';
import { renderWithProviders } from '@/testing/test-utils';
import type { ApiError } from '@/types/apiError';
import type { StatementFormat } from '@/types/statementFormat';

const mockUsePermission = vi.mocked(usePermission);
const mockUseStatementFormats = vi.mocked(useStatementFormats);
const mockUseHideStatementFormat = vi.mocked(useHideStatementFormat);
const mockUseUnhideStatementFormat = vi.mocked(useUnhideStatementFormat);
const mockToast = vi.mocked(toast);

type VisibilityMutate = (
  id: number,
  options?: {
    onSuccess?: () => void;
    onError?: (error: ApiError) => void;
    onSettled?: () => void;
  },
) => void;

const formats: StatementFormat[] = [
  {
    id: 1,
    displayName: 'Hidden Beta',
    formatType: 'CSV',
    bankName: 'Beta Bank',
    defaultCurrencyIsoCode: 'EUR',
    scope: 'USER',
    hidden: true,
    enabled: true,
  },
  {
    id: 2,
    displayName: 'Visible Disabled',
    formatType: 'PDF',
    bankName: 'Delta Bank',
    defaultCurrencyIsoCode: 'CAD',
    scope: 'SYSTEM',
    enabled: false,
  },
  {
    id: 3,
    displayName: 'Visible Alpha',
    formatType: 'CSV',
    bankName: 'Acme Bank',
    defaultCurrencyIsoCode: 'USD',
    scope: 'SYSTEM',
    enabled: true,
  },
];

function mockQuerySuccess(data: StatementFormat[]) {
  mockUseStatementFormats.mockReturnValue({
    data,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<StatementFormat[], ApiError>);
}

function mockQueryError(error: Error) {
  mockUseStatementFormats.mockReturnValue({
    data: undefined,
    isLoading: false,
    error,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<StatementFormat[], ApiError>);
}

function renderPage() {
  return renderWithProviders(<StatementFormatManagementPage />, {
    initialEntries: ['/statement-formats'],
    router: 'dom',
  });
}

describe('StatementFormatManagementPage', () => {
  const hideMutate = vi.fn<VisibilityMutate>();
  const unhideMutate = vi.fn<VisibilityMutate>();

  beforeEach(() => {
    mockUsePermission.mockReset();
    mockUseStatementFormats.mockReset();
    mockUseHideStatementFormat.mockReset();
    mockUseUnhideStatementFormat.mockReset();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
    hideMutate.mockReset();
    unhideMutate.mockReset();
    mockUseHideStatementFormat.mockReturnValue({
      mutate: hideMutate,
    } as unknown as ReturnType<typeof useHideStatementFormat>);
    mockUseUnhideStatementFormat.mockReturnValue({
      mutate: unhideMutate,
    } as unknown as ReturnType<typeof useUnhideStatementFormat>);
  });

  it('requests visible and hidden formats and sorts visible enabled rows first', () => {
    mockUsePermission.mockReturnValue(true);
    mockQuerySuccess(formats);

    renderPage();

    expect(mockUseStatementFormats).toHaveBeenCalledWith({ includeHidden: true });
    const rows = screen.getAllByRole('row').map((row) => row.textContent ?? '');
    expect(rows[1]).toContain('Visible Alpha');
    expect(rows[2]).toContain('Visible Disabled');
    expect(rows[3]).toContain('Hidden Beta');
  });

  it('shows visibility states but no actions when write permission is missing', () => {
    mockUsePermission.mockReturnValue(false);
    mockQuerySuccess(formats);

    renderPage();

    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.getAllByText('Visible')).toHaveLength(2);
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hide from import/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restore to import/i })).not.toBeInTheDocument();
  });

  it('hides and restores formats with mutation callbacks', async () => {
    mockUsePermission.mockReturnValue(true);
    mockQuerySuccess(formats);
    hideMutate.mockImplementation((_id, options) => {
      options?.onSuccess?.();
      options?.onSettled?.();
    });
    unhideMutate.mockImplementation((_id, options) => {
      options?.onSuccess?.();
      options?.onSettled?.();
    });
    const user = userEvent.setup();

    renderPage();

    await user.click(screen.getAllByRole('button', { name: /hide from import/i })[0]);
    await user.click(screen.getByRole('button', { name: /restore to import/i }));

    expect(hideMutate).toHaveBeenCalledWith(3, expect.any(Object));
    expect(unhideMutate).toHaveBeenCalledWith(1, expect.any(Object));
    expect(mockToast.success).toHaveBeenCalledWith('Visible Alpha is hidden from import lists.');
    expect(mockToast.success).toHaveBeenCalledWith('Hidden Beta is available for imports again.');
  });

  it('renders API load errors', () => {
    mockUsePermission.mockReturnValue(true);
    mockQueryError(new Error('Statement format service unavailable'));

    renderPage();

    expect(screen.getByText('An Error Occurred')).toBeInTheDocument();
    expect(screen.getByText('Statement format service unavailable')).toBeInTheDocument();
  });
});
