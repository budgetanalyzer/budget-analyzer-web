import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { ImportButton } from '@/features/transactions/components/ImportButton';
import { usePreviewTransactions } from '@/features/transactions/hooks/usePreviewTransactions';
import { StatementFormatManagementPage } from '@/features/statement-formats/pages/StatementFormatManagementPage';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { StatementFormat } from '@/types/statementFormat';

vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/features/transactions/hooks/usePreviewTransactions');
vi.mock('@/hooks/useToast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('@/components/statement-formats/StatementFormatWizardDialog', () => ({
  StatementFormatWizardDialog: () => null,
}));

const mockUsePermission = vi.mocked(usePermission);
const mockUsePreviewTransactions = vi.mocked(usePreviewTransactions);

function installStatementFormatHandlers(initialFormats: StatementFormat[]) {
  let formats = initialFormats;
  const hideRequests: number[] = [];
  const unhideRequests: number[] = [];

  server.use(
    http.get('/api/v1/statement-formats', ({ request }) => {
      const url = new URL(request.url);
      const includeHidden = url.searchParams.get('includeHidden') === 'true';

      return HttpResponse.json(
        includeHidden ? formats : formats.filter((format) => !format.hidden),
      );
    }),
    http.post('/api/v1/statement-formats/:id/hide', ({ params }) => {
      const id = Number(params.id);
      hideRequests.push(id);
      formats = formats.map((format) => (format.id === id ? { ...format, hidden: true } : format));

      return new HttpResponse(null, { status: 204 });
    }),
    http.post('/api/v1/statement-formats/:id/unhide', ({ params }) => {
      const id = Number(params.id);
      unhideRequests.push(id);
      formats = formats.map((format) => (format.id === id ? { ...format, hidden: false } : format));

      return new HttpResponse(null, { status: 204 });
    }),
    http.get('/api/v1/currencies', () => HttpResponse.json([])),
  );

  return { hideRequests, unhideRequests };
}

function getFormatRow(formatName: string) {
  const row = screen.getByText(formatName).closest('tr');

  if (!row) {
    throw new Error(`Could not find row for ${formatName}`);
  }

  return within(row);
}

function systemFormat(overrides: Partial<StatementFormat> = {}): StatementFormat {
  return {
    id: 101,
    displayName: 'System Checking CSV',
    formatType: 'CSV',
    bankName: 'System Bank',
    defaultCurrencyIsoCode: 'USD',
    scope: 'SYSTEM',
    enabled: true,
    ...overrides,
  };
}

function customFormat(overrides: Partial<StatementFormat> = {}): StatementFormat {
  return {
    id: 202,
    displayName: 'Custom Checking CSV',
    formatType: 'CSV',
    bankName: 'Custom Bank',
    defaultCurrencyIsoCode: 'USD',
    scope: 'USER',
    enabled: true,
    ...overrides,
  };
}

beforeEach(() => {
  mockUsePermission.mockReset();
  mockUsePermission.mockReturnValue(true);
  mockUsePreviewTransactions.mockReset();
  mockUsePreviewTransactions.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof usePreviewTransactions>);
});

describe('StatementFormatManagementPage API behavior', () => {
  it('hides a system format and keeps it recoverable after refetch', async () => {
    const user = userEvent.setup();
    const handlers = installStatementFormatHandlers([systemFormat()]);

    renderWithProviders(<StatementFormatManagementPage />, {
      initialEntries: ['/statement-formats'],
      router: 'dom',
    });

    expect(await screen.findByText('System Checking CSV')).toBeInTheDocument();

    await user.click(
      getFormatRow('System Checking CSV').getByRole('button', { name: /hide from import/i }),
    );

    await waitFor(() => {
      expect(handlers.hideRequests).toEqual([101]);
      expect(getFormatRow('System Checking CSV').getByText('Hidden')).toBeInTheDocument();
    });
  });

  it('hides a custom format and updates its visibility state after refetch', async () => {
    const user = userEvent.setup();
    installStatementFormatHandlers([customFormat()]);

    renderWithProviders(<StatementFormatManagementPage />, {
      initialEntries: ['/statement-formats'],
      router: 'dom',
    });

    expect(await screen.findByText('Custom Checking CSV')).toBeInTheDocument();

    await user.click(
      getFormatRow('Custom Checking CSV').getByRole('button', { name: /hide from import/i }),
    );

    await waitFor(() => {
      expect(getFormatRow('Custom Checking CSV').getByText('Hidden')).toBeInTheDocument();
    });
  });

  it('restores a hidden format and posts the unhide request for that format ID', async () => {
    const user = userEvent.setup();
    const handlers = installStatementFormatHandlers([
      systemFormat({ id: 303, displayName: 'Hidden System CSV', hidden: true }),
    ]);

    renderWithProviders(<StatementFormatManagementPage />, {
      initialEntries: ['/statement-formats'],
      router: 'dom',
    });

    expect(await screen.findByText('Hidden System CSV')).toBeInTheDocument();

    await user.click(
      getFormatRow('Hidden System CSV').getByRole('button', { name: /restore to import/i }),
    );

    await waitFor(() => {
      expect(handlers.unhideRequests).toEqual([303]);
      expect(getFormatRow('Hidden System CSV').getByText('Visible')).toBeInTheDocument();
    });
  });

  it('omits hidden formats from import selection while keeping them visible on the management page', async () => {
    const user = userEvent.setup();
    installStatementFormatHandlers([
      systemFormat({ id: 404, displayName: 'Visible Import CSV' }),
      systemFormat({ id: 405, displayName: 'Recoverable Hidden CSV', hidden: true }),
    ]);

    renderWithProviders(
      <>
        <ImportButton />
        <StatementFormatManagementPage />
      </>,
      {
        initialEntries: ['/statement-formats'],
        router: 'dom',
      },
    );

    expect(await screen.findByText('Recoverable Hidden CSV')).toBeInTheDocument();
    expect(getFormatRow('Recoverable Hidden CSV').getByText('Hidden')).toBeInTheDocument();
    expect(
      getFormatRow('Recoverable Hidden CSV').getByRole('button', { name: /restore to import/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /import transactions/i }));
    await user.click(await screen.findByRole('button', { name: 'Select Format' }));

    expect(screen.getByRole('button', { name: 'Visible Import CSV' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Recoverable Hidden CSV' }),
    ).not.toBeInTheDocument();
  });
});
