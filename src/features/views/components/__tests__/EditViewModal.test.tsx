import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditViewModal } from '@/features/views/components/EditViewModal';
import type { SavedViewMetadata } from '@/types/view';

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('@/hooks/useViews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useViews')>();
  return { ...actual, useUpdateView: () => ({ mutate: mocks.mutate, isPending: false }) };
});

const view: SavedViewMetadata = {
  id: 'view-1',
  name: 'Original name',
  transactionCount: 4,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

describe('EditViewModal', () => {
  beforeEach(() => mocks.mutate.mockReset());

  it('renames with a name-only request and the schema maximum', async () => {
    const onClose = vi.fn();
    render(<EditViewModal open onClose={onClose} view={view} />);
    const input = screen.getByLabelText('View Name');

    expect(input).toHaveAttribute('maxlength', '255');
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed collection');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(mocks.mutate).toHaveBeenCalledWith(
      { id: 'view-1', request: { name: 'Renamed collection' } },
      { onSuccess: onClose },
    );
  });
});
