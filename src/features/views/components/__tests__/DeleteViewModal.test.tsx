import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteViewModal } from '@/features/views/components/DeleteViewModal';
import { renderWithProviders } from '@/testing/test-utils';
import type { SavedView } from '@/types/view';

const hookMocks = vi.hoisted(() => ({
  deleteMutate: vi.fn(),
  isPending: false,
}));

vi.mock('@/hooks/useViews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useViews')>();

  return {
    ...actual,
    useDeleteView: () => ({
      mutate: hookMocks.deleteMutate,
      isPending: hookMocks.isPending,
    }),
  };
});

const view: SavedView = {
  id: 'view-1',
  name: 'Groceries',
  criteria: {},
  openEnded: false,
  pinnedCount: 2,
  excludedCount: 1,
  transactionCount: 12,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderDeleteViewModal(onClose = vi.fn()) {
  const result = renderWithProviders(
    <Routes>
      <Route
        path="/views/:id"
        element={
          <>
            <DeleteViewModal open onClose={onClose} view={view} />
            <LocationProbe />
          </>
        }
      />
      <Route path="/" element={<LocationProbe />} />
    </Routes>,
    {
      initialEntries: ['/views/view-1'],
    },
  );

  return { onClose, ...result };
}

beforeEach(() => {
  hookMocks.deleteMutate.mockReset();
  hookMocks.isPending = false;
});

describe('DeleteViewModal', () => {
  it('shows the view delete impact before confirmation', () => {
    renderDeleteViewModal();

    expect(screen.getByRole('heading', { name: 'Delete View' })).toBeInTheDocument();
    expect(screen.getByText(/delete .*Groceries/)).toBeInTheDocument();
    expect(screen.getByText('2 pinned transaction(s)')).toBeInTheDocument();
    expect(screen.getByText('1 excluded transaction(s)')).toBeInTheDocument();
  });

  it('closes and navigates home after a successful delete', async () => {
    hookMocks.deleteMutate.mockImplementation((_id, options) => {
      options.onSuccess();
    });
    const { onClose } = renderDeleteViewModal();

    await userEvent.click(screen.getByRole('button', { name: 'Delete View' }));

    expect(hookMocks.deleteMutate).toHaveBeenCalledWith(
      'view-1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('does not close or navigate when delete does not succeed', async () => {
    const { onClose } = renderDeleteViewModal();

    await userEvent.click(screen.getByRole('button', { name: 'Delete View' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/views/view-1');
  });

  it('disables delete actions while deletion is pending', () => {
    hookMocks.isPending = true;

    renderDeleteViewModal();

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
  });
});
