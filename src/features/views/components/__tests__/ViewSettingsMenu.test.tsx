import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewSettingsMenu } from '@/features/views/components/ViewSettingsMenu';
import type { SavedView } from '@/types/view';

const hookState = vi.hoisted(() => ({
  isPending: false,
  updateView: vi.fn(),
}));

vi.mock('@/hooks/useViews', () => ({
  useUpdateView: () => ({ mutate: hookState.updateView, isPending: hookState.isPending }),
}));

const view: SavedView = {
  id: 'view-1',
  name: 'Groceries',
  criteria: {},
  openEnded: false,
  pinnedCount: 1,
  excludedCount: 0,
  transactionCount: 8,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('ViewSettingsMenu', () => {
  beforeEach(() => {
    hookState.isPending = false;
    hookState.updateView.mockReset();
  });

  it('keeps controlled state synchronized for dismissal and Edit/Delete actions', async () => {
    const onEditClick = vi.fn();
    const onDeleteClick = vi.fn();
    const user = userEvent.setup();
    render(
      <ViewSettingsMenu view={view} onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );
    const trigger = screen.getByRole('button', { name: 'View settings' });

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.click(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Edit View' }));
    expect(onEditClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Delete View' }));
    expect(onDeleteClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('updates open-ended state with the existing payload', async () => {
    const user = userEvent.setup();
    render(<ViewSettingsMenu view={view} onEditClick={vi.fn()} onDeleteClick={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'View settings' });
    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Enable Open-Ended' }));

    expect(hookState.updateView).toHaveBeenCalledOnce();
    expect(hookState.updateView).toHaveBeenCalledWith({
      id: 'view-1',
      request: { openEnded: true },
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('disables the trigger and open-ended action while an update is pending', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ViewSettingsMenu view={view} onEditClick={vi.fn()} onDeleteClick={vi.fn()} />,
    );

    const trigger = screen.getByRole('button', { name: 'View settings' });
    await user.click(trigger);
    hookState.isPending = true;
    rerender(<ViewSettingsMenu view={view} onEditClick={vi.fn()} onDeleteClick={vi.fn()} />);

    expect(trigger).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Enable Open-Ended' })).toBeDisabled();
  });
});
