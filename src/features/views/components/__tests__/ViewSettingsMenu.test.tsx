import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { ViewSettingsMenu } from '@/features/views/components/ViewSettingsMenu';

vi.mock('@/features/auth/hooks/usePermission');

const mockUsePermission = vi.mocked(usePermission);

describe('ViewSettingsMenu', () => {
  beforeEach(() => {
    mockUsePermission.mockReset();
  });

  it('gates rename and delete independently and dispatches their callbacks', async () => {
    mockUsePermission.mockReturnValue(true);
    const onRenameClick = vi.fn();
    const onDeleteClick = vi.fn();
    const user = userEvent.setup();
    render(<ViewSettingsMenu onRenameClick={onRenameClick} onDeleteClick={onDeleteClick} />);

    const trigger = screen.getByRole('button', { name: 'View settings' });
    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Rename View' }));
    expect(onRenameClick).toHaveBeenCalledOnce();

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Delete View' }));
    expect(onDeleteClick).toHaveBeenCalledOnce();
  });

  it('shows delete without rename for delete-only permission', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:delete');
    render(<ViewSettingsMenu onRenameClick={vi.fn()} onDeleteClick={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'View settings' }));

    expect(screen.queryByRole('menuitem', { name: 'Rename View' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete View' })).toBeInTheDocument();
  });

  it('does not render when both action permissions are denied', () => {
    mockUsePermission.mockReturnValue(false);
    render(<ViewSettingsMenu onRenameClick={vi.fn()} onDeleteClick={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'View settings' })).not.toBeInTheDocument();
  });
});
